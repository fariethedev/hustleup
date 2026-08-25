/**
 * Issues, serves and validates digital event tickets.
 *
 * <p>Tickets are never created directly by a client. They are a side effect of an EVENT booking
 * being confirmed — {@link com.hustleup.marketplace.booking.service.BookingService} calls
 * {@link #issueForBooking} when a ticket purchase completes or an organiser approves a request
 * to join, and {@link #voidForBooking} when a booking is cancelled or refunded. That keeps the
 * booking the single source of truth for "is this person coming" and leaves tickets as the
 * presentation of that fact.
 *
 * <h3>Who can see what</h3>
 * <ul>
 *   <li><b>Attendee</b> — their own tickets, including the QR payload needed to get in.</li>
 *   <li><b>Organiser</b> — every ticket for events they own, without the QR payloads, plus the
 *       ability to scan.</li>
 *   <li><b>Anyone else</b> — nothing. Every read below is scoped to the authenticated user.</li>
 * </ul>
 */
package com.hustleup.marketplace.ticket.service;

import com.hustleup.common.model.User;
import com.hustleup.common.repository.UserRepository;
import com.hustleup.common.storage.FileStorageService;
import com.hustleup.marketplace.booking.model.Booking;
import com.hustleup.marketplace.booking.repository.BookingRepository;
import com.hustleup.marketplace.listing.model.Listing;
import com.hustleup.marketplace.listing.repository.ListingRepository;
import com.hustleup.marketplace.ticket.dto.ScanResultDto;
import com.hustleup.marketplace.ticket.dto.TicketDto;
import com.hustleup.marketplace.ticket.model.EventTicket;
import com.hustleup.marketplace.ticket.model.TicketStatus;
import com.hustleup.marketplace.ticket.repository.EventTicketRepository;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
public class TicketService {

    /** Prefix on the QR payload, so a scanner can reject a QR code that isn't ours at all. */
    private static final String QR_PREFIX = "HUTKT";

    /**
     * Alphabet for the human-readable code. Deliberately excludes {@code I L O U 0 1} — those
     * are the characters people misread and mistype when an organiser is keying a code in by
     * hand at the door.
     */
    private static final String CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";

    /** SecureRandom, not Random: these values are credentials, so they must not be predictable. */
    private static final SecureRandom RANDOM = new SecureRandom();

    private static final DateTimeFormatter TIME_ONLY = DateTimeFormatter.ofPattern("HH:mm");

    private final EventTicketRepository ticketRepository;
    private final ListingRepository listingRepository;
    private final BookingRepository bookingRepository;
    private final UserRepository userRepository;
    private final FileStorageService fileStorageService;

    public TicketService(EventTicketRepository ticketRepository, ListingRepository listingRepository,
                         BookingRepository bookingRepository, UserRepository userRepository,
                         FileStorageService fileStorageService) {
        this.ticketRepository = ticketRepository;
        this.listingRepository = listingRepository;
        this.bookingRepository = bookingRepository;
        this.userRepository = userRepository;
        this.fileStorageService = fileStorageService;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Issuing and voiding — called by BookingService, not by any controller
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * Creates one ticket per seat on a confirmed EVENT booking.
     *
     * <p>Idempotent by design: if tickets already exist for this booking the existing ones are
     * returned untouched. A booking can reach a confirmed state more than once (an organiser
     * accepting an already-accepted request, a retried request), and issuing a second set of
     * tickets would silently double an event's head count.
     *
     * @param booking the confirmed booking; its {@code quantity} decides how many seats are issued
     * @param listing the EVENT listing being attended
     * @return the tickets now attached to this booking, in seat order
     */
    @Transactional
    public List<EventTicket> issueForBooking(Booking booking, Listing listing) {
        List<EventTicket> existing = ticketRepository.findByBookingId(booking.getId());
        if (!existing.isEmpty()) return existing;

        int seats = booking.getQuantity() != null && booking.getQuantity() > 0 ? booking.getQuantity() : 1;

        List<EventTicket> tickets = new ArrayList<>(seats);
        for (int seat = 1; seat <= seats; seat++) {
            tickets.add(EventTicket.builder()
                    .bookingId(booking.getId())
                    .listingId(listing.getId())
                    .ownerId(booking.getBuyerId())
                    .organiserId(listing.getSellerId())
                    .ticketCode(generateUniqueCode())
                    .qrSecret(generateSecret())
                    .ticketNumber(seat)
                    .ticketsInBooking(seats)
                    .status(TicketStatus.VALID)
                    .build());
        }
        return ticketRepository.saveAll(tickets);
    }

    /**
     * Voids every ticket attached to a booking, so a cancelled or refunded attendee can't walk
     * in on an old QR code. Rows are kept (not deleted) so a scan of the void ticket returns an
     * explicit "cancelled" at the door rather than an ambiguous "not found".
     *
     * <p>Already-checked-in tickets are left alone: the person is physically inside the venue,
     * and rewriting history to say they never were would corrupt the organiser's head count.
     */
    @Transactional
    public void voidForBooking(UUID bookingId) {
        List<EventTicket> tickets = ticketRepository.findByBookingId(bookingId);
        List<EventTicket> toVoid = tickets.stream()
                .filter(t -> t.getStatus() == TicketStatus.VALID)
                .peek(t -> t.setStatus(TicketStatus.CANCELLED))
                .toList();
        if (!toVoid.isEmpty()) ticketRepository.saveAll(toVoid);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Attendee-facing reads
    // ─────────────────────────────────────────────────────────────────────────────

    /** Every ticket the authenticated user holds, newest first — their ticket wallet. */
    public List<TicketDto> myTickets() {
        User me = currentUser();
        return toDtos(ticketRepository.findByOwnerIdOrderByCreatedAtDesc(me.getId()), me.getId());
    }

    /**
     * A single ticket. Readable by its owner (who gets the QR payload) and by the event's
     * organiser (who doesn't).
     */
    public TicketDto getTicket(UUID ticketId) {
        User me = currentUser();
        EventTicket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new RuntimeException("Ticket not found"));
        if (!ticket.getOwnerId().equals(me.getId()) && !ticket.getOrganiserId().equals(me.getId())) {
            throw new RuntimeException("Not authorized to view this ticket");
        }
        return toDtos(List.of(ticket), me.getId()).get(0);
    }

    /** The authenticated user's tickets for one specific event — used by the listing page. */
    public List<TicketDto> myTicketsForEvent(UUID listingId) {
        User me = currentUser();
        List<EventTicket> mine = ticketRepository.findByOwnerIdOrderByCreatedAtDesc(me.getId()).stream()
                .filter(t -> t.getListingId().equals(listingId))
                .toList();
        return toDtos(mine, me.getId());
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Organiser-facing reads
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * The full door list for one of the organiser's own events, in the order tickets were sold.
     *
     * @throws RuntimeException if the caller does not own the listing
     */
    public List<TicketDto> ticketsForEvent(UUID listingId) {
        User me = currentUser();
        requireOrganiser(listingId, me);
        return toDtos(ticketRepository.findByListingIdOrderByCreatedAtAsc(listingId), me.getId());
    }

    /**
     * Head-count summary for one of the organiser's events: how many seats are out, how many
     * have walked through the door, and how many are still expected.
     */
    public Map<String, Object> doorSummary(UUID listingId) {
        User me = currentUser();
        requireOrganiser(listingId, me);

        long checkedIn = ticketRepository.countByListingIdAndStatus(listingId, TicketStatus.CHECKED_IN);
        long cancelled = ticketRepository.countByListingIdAndStatus(listingId, TicketStatus.CANCELLED);
        long issued = ticketRepository.countByListingId(listingId) - cancelled;

        Map<String, Object> summary = new HashMap<>();
        summary.put("listingId", listingId);
        summary.put("issued", issued);
        summary.put("checkedIn", checkedIn);
        summary.put("expected", Math.max(0, issued - checkedIn));
        summary.put("cancelled", cancelled);
        return summary;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // The door
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * Validates a scanned QR payload (or a manually typed admission code) and, if it is good,
     * admits the holder.
     *
     * <p>Accepts either form so a dead phone battery doesn't stop the queue:
     * <ul>
     *   <li>{@code HUTKT:HU-4F2A-91BC:<secret>} — straight from the QR scanner</li>
     *   <li>{@code HU-4F2A-91BC} — typed in by the organiser from the printed ticket</li>
     * </ul>
     * A typed code is accepted without the secret because the person typing it is the
     * authenticated organiser of that event, and the code alone is useless to anyone else.
     *
     * <p>Only failures that mean "something is broken" throw. Every ordinary rejection comes
     * back as a 200 with {@code admitted = false} and a reason, so the scanner UI can show a
     * red screen and move on to the next person.
     *
     * @param rawInput  QR payload or admission code
     * @param listingId the event whose door this is; the ticket must belong to it
     */
    @Transactional
    public ScanResultDto scan(String rawInput, UUID listingId) {
        User me = currentUser();
        requireOrganiser(listingId, me);

        String input = rawInput == null ? "" : rawInput.trim();
        String code;
        String secret = null;

        if (input.toUpperCase().startsWith(QR_PREFIX + ":")) {
            // Split into at most 3 so a secret that somehow contains a colon survives intact.
            String[] parts = input.split(":", 3);
            if (parts.length < 3) return miss(listingId, "That QR code isn't a HustleSpace ticket");
            code = parts[1].trim().toUpperCase();
            secret = parts[2].trim();
        } else {
            code = input.toUpperCase();
        }

        Optional<EventTicket> found = ticketRepository.findByTicketCode(code);
        if (found.isEmpty()) return miss(listingId, "No ticket matches that code");

        EventTicket ticket = found.get();

        // A scanned QR must carry the right secret. A mismatch means the code is real but the
        // QR was fabricated, which is worth treating as "not found" rather than telling the
        // holder they were one field away from getting in.
        if (secret != null && !secret.equals(ticket.getQrSecret())) {
            return miss(listingId, "That ticket couldn't be verified");
        }

        if (!ticket.getListingId().equals(listingId)) {
            return result(false, "WRONG_EVENT", "This ticket is for a different event", ticket, listingId, me.getId());
        }
        if (ticket.getStatus() == TicketStatus.CANCELLED) {
            return result(false, "CANCELLED", "This ticket was cancelled or refunded", ticket, listingId, me.getId());
        }
        if (ticket.getStatus() == TicketStatus.CHECKED_IN) {
            String at = ticket.getCheckedInAt() != null ? ticket.getCheckedInAt().format(TIME_ONLY) : "earlier";
            return result(false, "ALREADY_CHECKED_IN", "Already checked in at " + at, ticket, listingId, me.getId());
        }

        ticket.setStatus(TicketStatus.CHECKED_IN);
        ticket.setCheckedInAt(LocalDateTime.now());
        ticket.setCheckedInBy(me.getId());
        EventTicket admitted = ticketRepository.save(ticket);

        return result(true, "ADMITTED", "Welcome in", admitted, listingId, me.getId());
    }

    /**
     * Lets an attendee check themselves in, for events run without anyone on a door.
     *
     * <p>Same terminal state as an organiser scan, but only the ticket's own holder may call it
     * and only for a ticket that is still valid.
     */
    @Transactional
    public TicketDto selfCheckIn(UUID ticketId) {
        User me = currentUser();
        EventTicket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new RuntimeException("Ticket not found"));

        if (!ticket.getOwnerId().equals(me.getId())) {
            throw new RuntimeException("This isn't your ticket");
        }
        if (ticket.getStatus() == TicketStatus.CANCELLED) {
            throw new RuntimeException("This ticket was cancelled");
        }
        if (ticket.getStatus() == TicketStatus.CHECKED_IN) {
            // Not an error worth failing on — they're already in. Return the ticket as-is so the
            // UI just re-renders the "you're in" state.
            return toDtos(List.of(ticket), me.getId()).get(0);
        }

        ticket.setStatus(TicketStatus.CHECKED_IN);
        ticket.setCheckedInAt(LocalDateTime.now());
        ticket.setCheckedInBy(me.getId());
        return toDtos(List.of(ticketRepository.save(ticket)), me.getId()).get(0);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Internals
    // ─────────────────────────────────────────────────────────────────────────────

    /** Builds a scan result for a code that resolved to no ticket at all. */
    private ScanResultDto miss(UUID listingId, String reason) {
        return result(false, "NOT_FOUND", reason, null, listingId, null);
    }

    private ScanResultDto result(boolean admitted, String outcome, String reason,
                                 EventTicket ticket, UUID listingId, UUID viewerId) {
        long cancelled = ticketRepository.countByListingIdAndStatus(listingId, TicketStatus.CANCELLED);
        return ScanResultDto.builder()
                .admitted(admitted)
                .outcome(outcome)
                .reason(reason)
                // The organiser scanning is not the ticket's owner, so toDto withholds the QR
                // payload here — the door screen shows who walked in, not a copy of their ticket.
                .ticket(ticket == null ? null : toDtos(List.of(ticket), viewerId).get(0))
                .checkedInCount(ticketRepository.countByListingIdAndStatus(listingId, TicketStatus.CHECKED_IN))
                .totalTickets(ticketRepository.countByListingId(listingId) - cancelled)
                .build();
    }

    /**
     * Maps tickets to DTOs, resolving the listing, booking and user records they reference.
     *
     * <p>Batched deliberately: a door list can be hundreds of tickets for the same event and the
     * same handful of buyers, so listings, bookings and users are each fetched once up front
     * rather than per ticket. Mapping a single ticket goes through the same path with a
     * one-element list, so there is only one version of this logic to keep correct.
     *
     * @param viewerId the authenticated caller; the QR payload is only included on tickets they own
     */
    private List<TicketDto> toDtos(List<EventTicket> tickets, UUID viewerId) {
        if (tickets.isEmpty()) return List.of();

        Map<UUID, Listing> listings = new HashMap<>();
        listingRepository.findAllById(tickets.stream().map(EventTicket::getListingId).distinct().toList())
                .forEach(l -> listings.put(l.getId(), l));

        Map<UUID, Booking> bookings = new HashMap<>();
        bookingRepository.findAllById(tickets.stream().map(EventTicket::getBookingId).distinct().toList())
                .forEach(b -> bookings.put(b.getId(), b));

        List<UUID> userIds = tickets.stream()
                .flatMap(t -> java.util.stream.Stream.of(t.getOwnerId(), t.getOrganiserId()))
                .distinct().toList();
        Map<UUID, User> users = new HashMap<>();
        userRepository.findAllById(userIds).forEach(u -> users.put(u.getId(), u));

        List<TicketDto> dtos = new ArrayList<>(tickets.size());
        for (EventTicket t : tickets) {
            Listing listing = listings.get(t.getListingId());
            Booking booking = bookings.get(t.getBookingId());
            User owner = users.get(t.getOwnerId());
            User organiser = users.get(t.getOrganiserId());
            boolean isOwner = viewerId != null && viewerId.equals(t.getOwnerId());

            dtos.add(TicketDto.builder()
                    .id(t.getId())
                    .bookingId(t.getBookingId())
                    .ticketCode(t.getTicketCode())
                    .qrPayload(isOwner ? qrPayload(t) : null)
                    .ticketNumber(t.getTicketNumber())
                    .ticketsInBooking(t.getTicketsInBooking())
                    .listingId(t.getListingId())
                    .eventTitle(listing != null ? listing.getTitle() : "Event")
                    .eventDescription(listing != null ? listing.getDescription() : null)
                    .eventImageUrl(firstMediaUrl(listing))
                    .eventCity(listing != null ? listing.getLocationCity() : null)
                    .eventVenue(listing != null ? listing.getEventVenue() : null)
                    .eventStartsAt(eventStart(listing, booking))
                    .organiserId(t.getOrganiserId())
                    .organiserName(displayName(organiser))
                    .ownerId(t.getOwnerId())
                    .ownerName(displayName(owner))
                    .pricePaid(perSeatPrice(booking, t))
                    .currency(booking != null ? booking.getCurrency() : null)
                    .paymentStatus(booking != null ? booking.getPaymentStatus() : null)
                    .status(t.getStatus().name())
                    .checkedInAt(t.getCheckedInAt())
                    .createdAt(t.getCreatedAt())
                    .build());
        }
        return dtos;
    }

    /**
     * When the event starts. Prefers the organiser's published event time; falls back to the
     * time the buyer scheduled on the booking, which is all the older bookings have.
     */
    private LocalDateTime eventStart(Listing listing, Booking booking) {
        if (listing != null && listing.getEventStartsAt() != null) return listing.getEventStartsAt();
        return booking != null ? booking.getScheduledAt() : null;
    }

    /**
     * What this one seat cost. The booking's agreed price covers every seat it bought, so it is
     * divided by the number of tickets issued against it.
     */
    private BigDecimal perSeatPrice(Booking booking, EventTicket ticket) {
        if (booking == null) return null;
        BigDecimal total = booking.getAgreedPrice() != null ? booking.getAgreedPrice() : booking.getOfferedPrice();
        if (total == null) return null;
        int seats = ticket.getTicketsInBooking() != null && ticket.getTicketsInBooking() > 0
                ? ticket.getTicketsInBooking() : 1;
        return total.divide(BigDecimal.valueOf(seats), 2, RoundingMode.HALF_UP);
    }

    /** The listing's lead image, run through the storage layer so S3/CDN URLs are fresh. */
    private String firstMediaUrl(Listing listing) {
        if (listing == null || listing.getMediaUrls() == null || listing.getMediaUrls().isBlank()) return null;
        String first = listing.getMediaUrls().split(",")[0].trim();
        return first.isEmpty() ? null : fileStorageService.refreshUrl(first);
    }

    private String displayName(User user) {
        if (user == null) return "HustleSpace user";
        if (user.getFullName() != null && !user.getFullName().isBlank()) return user.getFullName();
        return user.getEmail() != null ? user.getEmail().split("@")[0] : "HustleSpace user";
    }

    /** The exact string the ticket's QR code encodes. */
    private String qrPayload(EventTicket ticket) {
        return QR_PREFIX + ":" + ticket.getTicketCode() + ":" + ticket.getQrSecret();
    }

    /**
     * Generates an unused admission code in the form {@code HU-XXXX-XXXX}.
     *
     * <p>Two four-character groups from a 30-character alphabet is a little over 6.5×10^11
     * combinations, so a collision is vanishingly unlikely — but the code is a unique column and
     * a collision would surface as a database error at the worst possible moment, so this
     * re-rolls on the off chance. The attempt cap stops a bug elsewhere (an exhausted or broken
     * random source) turning into an infinite loop inside a request.
     */
    private String generateUniqueCode() {
        for (int attempt = 0; attempt < 10; attempt++) {
            String code = "HU-" + randomBlock(4) + "-" + randomBlock(4);
            if (!ticketRepository.existsByTicketCode(code)) return code;
        }
        throw new IllegalStateException("Could not generate a unique ticket code");
    }

    private String randomBlock(int length) {
        StringBuilder sb = new StringBuilder(length);
        for (int i = 0; i < length; i++) {
            sb.append(CODE_ALPHABET.charAt(RANDOM.nextInt(CODE_ALPHABET.length())));
        }
        return sb.toString();
    }

    /** 20 characters of the same alphabet — the part of the ticket that is never shown as text. */
    private String generateSecret() {
        return randomBlock(20);
    }

    /** Throws unless the authenticated user is the seller on the given listing. */
    private void requireOrganiser(UUID listingId, User me) {
        Listing listing = listingRepository.findById(listingId)
                .orElseThrow(() -> new RuntimeException("Event not found"));
        if (!listing.getSellerId().equals(me.getId())) {
            throw new RuntimeException("You don't run this event");
        }
    }

    private User currentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }
}
