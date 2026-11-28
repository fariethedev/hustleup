package com.hustleup.marketplace.viewing;

import com.hustleup.common.model.Notification;
import com.hustleup.common.model.User;
import com.hustleup.common.repository.NotificationRepository;
import com.hustleup.common.repository.UserRepository;
import com.hustleup.common.storage.FileStorageService;
import com.hustleup.marketplace.listing.model.Listing;
import com.hustleup.marketplace.listing.model.ListingStatus;
import com.hustleup.marketplace.listing.model.ListingType;
import com.hustleup.marketplace.listing.repository.ListingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * Viewing appointments for rooms and flats. Renting is not haggled over from the listing:
 * a would-be tenant books a time to see the place, and everyone can see how many others
 * are coming.
 *
 * <ul>
 *   <li>{@code GET    /api/v1/listings/{id}/viewings} - public: upcoming count, first names
 *       and avatars of other viewers, booked times, and the caller's own appointment. The
 *       agent additionally gets every appointment with its note.</li>
 *   <li>{@code POST   /api/v1/listings/{id}/viewings} - book or reschedule your viewing.</li>
 *   <li>{@code DELETE /api/v1/listings/{id}/viewings/mine} - cancel it.</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/v1/listings/{listingId}/viewings")
@RequiredArgsConstructor
public class RentalViewingController {

    /** Viewings are usually shown in small groups; past this a time is full. */
    static final int MAX_PER_SLOT = 6;

    private final RentalViewingRepository viewings;
    private final ListingRepository listings;
    private final UserRepository users;
    private final NotificationRepository notifications;
    private final FileStorageService storage;

    @GetMapping
    public Map<String, Object> list(@PathVariable UUID listingId) {
        Listing listing = rental(listingId);
        User me = currentUser().orElse(null);
        boolean agent = me != null && me.getId().equals(listing.getSellerId());
        List<RentalViewing> upcoming = viewings.findByListingIdAndStatusAndScheduledAtAfterOrderByScheduledAtAsc(
                listingId, RentalViewing.Status.BOOKED, LocalDateTime.now(ZoneOffset.UTC));

        Map<UUID, User> people = new HashMap<>();
        users.findAllById(upcoming.stream().map(RentalViewing::getViewerId).distinct().toList())
                .forEach(u -> people.put(u.getId(), u));

        List<Map<String, Object>> viewers = new ArrayList<>();
        List<Map<String, Object>> appointments = new ArrayList<>();
        Map<String, Integer> perSlot = new TreeMap<>();
        Map<String, Object> mine = null;
        for (RentalViewing v : upcoming) {
            perSlot.merge(iso(v.getScheduledAt()), 1, Integer::sum);
            User u = people.get(v.getViewerId());
            boolean isMe = me != null && me.getId().equals(v.getViewerId());
            if (isMe) mine = Map.of("id", v.getId(), "scheduledAt", iso(v.getScheduledAt()));
            if (!isMe && viewers.size() < 12) {
                // First name and photo only: enough to see the place has interest without
                // turning the listing into a directory of strangers' details.
                Map<String, Object> p = new LinkedHashMap<>();
                p.put("name", firstName(u));
                p.put("avatarUrl", avatar(u));
                p.put("scheduledAt", iso(v.getScheduledAt()));
                viewers.add(p);
            }
            if (agent) {
                Map<String, Object> a = new LinkedHashMap<>();
                a.put("id", v.getId());
                a.put("viewerId", v.getViewerId());
                a.put("name", u != null ? u.displayName() : "Hustler");
                a.put("avatarUrl", avatar(u));
                a.put("scheduledAt", iso(v.getScheduledAt()));
                a.put("note", v.getNote());
                appointments.add(a);
            }
        }
        List<Map<String, Object>> slots = new ArrayList<>();
        perSlot.forEach((at, n) -> slots.add(Map.of("scheduledAt", at, "count", n, "full", n >= MAX_PER_SLOT)));

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("count", upcoming.size());
        out.put("viewers", viewers);
        out.put("slots", slots);
        out.put("mine", mine);
        out.put("maxPerSlot", MAX_PER_SLOT);
        if (agent) out.put("appointments", appointments);
        return out;
    }

    @PostMapping
    @PreAuthorize("isAuthenticated()")
    @Transactional
    public Map<String, Object> book(@PathVariable UUID listingId, @RequestBody Map<String, String> body) {
        Listing listing = rental(listingId);
        if (listing.getStatus() != null && listing.getStatus() != ListingStatus.ACTIVE)
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This place is no longer available.");
        User me = currentUser().orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        if (me.getId().equals(listing.getSellerId()))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "You can't book a viewing of your own listing.");

        LocalDateTime at = parse(body.get("scheduledAt"));
        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);
        if (at.isBefore(now.plusMinutes(30)))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Pick a time at least 30 minutes from now.");
        if (at.isAfter(now.plusDays(60)))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Viewings can be booked up to 60 days ahead.");

        RentalViewing existing = viewings.findFirstByListingIdAndViewerIdAndStatus(
                listingId, me.getId(), RentalViewing.Status.BOOKED).orElse(null);
        boolean sameSlot = existing != null && existing.getScheduledAt().equals(at);
        if (!sameSlot && viewings.countByListingIdAndStatusAndScheduledAt(listingId, RentalViewing.Status.BOOKED, at) >= MAX_PER_SLOT)
            throw new ResponseStatusException(HttpStatus.CONFLICT, "That time is full, please pick another.");

        String note = body.get("note") == null ? null : body.get("note").trim();
        if (note != null && note.length() > 500) note = note.substring(0, 500);
        if (note != null && note.isEmpty()) note = null;

        RentalViewing v = existing != null ? existing : RentalViewing.builder()
                .listingId(listingId).sellerId(listing.getSellerId()).viewerId(me.getId()).build();
        v.setScheduledAt(at);
        v.setNote(note);
        v.setUpdatedAt(now);
        v = viewings.save(v);

        notify(listing.getSellerId(),
                (existing != null ? "Viewing moved: " : "New viewing: ") + listing.getTitle(),
                me.displayName() + (existing != null ? " moved their viewing to " : " booked a viewing for ")
                        + at.toString().replace('T', ' ') + " UTC.",
                listingId);
        return Map.of("id", v.getId(), "scheduledAt", iso(v.getScheduledAt()));
    }

    @DeleteMapping("/mine")
    @PreAuthorize("isAuthenticated()")
    @Transactional
    public Map<String, Object> cancel(@PathVariable UUID listingId) {
        User me = currentUser().orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        RentalViewing v = viewings.findFirstByListingIdAndViewerIdAndStatus(listingId, me.getId(), RentalViewing.Status.BOOKED)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "You have no viewing booked here."));
        v.setStatus(RentalViewing.Status.CANCELLED);
        v.setUpdatedAt(LocalDateTime.now(ZoneOffset.UTC));
        viewings.save(v);
        listings.findById(listingId).ifPresent(l -> notify(l.getSellerId(), "Viewing cancelled: " + l.getTitle(),
                me.displayName() + " cancelled their viewing.", listingId));
        return Map.of("cancelled", true);
    }

    private Listing rental(UUID id) {
        Listing l = listings.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Listing not found"));
        if (l.getListingType() != ListingType.RENTAL)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Viewings are only for rentals.");
        return l;
    }

    private Optional<User> currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getName())) return Optional.empty();
        return users.findByEmail(auth.getName());
    }

    private void notify(UUID userId, String title, String message, UUID listingId) {
        try {
            notifications.save(Notification.builder().userId(userId).title(title).message(message)
                    .notificationType("RENTAL_VIEWING").referenceId(listingId).build());
        } catch (Exception ignored) {
            // A missed notification must not undo the booking.
        }
    }

    private String avatar(User u) {
        if (u == null || u.getAvatarUrl() == null) return null;
        try { return storage.refreshUrl(u.getAvatarUrl()); } catch (Exception e) { return null; }
    }

    private static String firstName(User u) {
        if (u == null) return "Someone";
        String n = u.getFullName() != null && !u.getFullName().isBlank() ? u.getFullName().trim() : u.displayName();
        return n.split("\\s+")[0];
    }

    /** Times travel as UTC instants ("2026-12-01T14:00:00Z") and are stored as UTC wall-clock. */
    private static String iso(LocalDateTime t) {
        return t.atOffset(ZoneOffset.UTC).toInstant().toString();
    }

    private static LocalDateTime parse(String raw) {
        if (raw == null || raw.isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "scheduledAt is required");
        try {
            return OffsetDateTime.parse(raw.trim()).withOffsetSameInstant(ZoneOffset.UTC).toLocalDateTime().truncatedTo(ChronoUnit.MINUTES);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "scheduledAt must be an ISO date-time with offset");
        }
    }
}
