package com.hustleup.marketplace.listing.service;

import com.hustleup.common.email.EmailService;
import com.hustleup.common.model.User;
import com.hustleup.common.repository.UserRepository;
import com.hustleup.marketplace.listing.model.Listing;
import com.hustleup.marketplace.listing.model.ListingStatus;
import com.hustleup.marketplace.listing.repository.ListingRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.*;
import java.util.stream.Collectors;

/**
 * One email a night listing everything the people you follow put up that day.
 *
 * <h2>What this replaces</h2>
 * <p>Every notification row is emailed as it is written — see {@code NotificationEmailRelay}
 * — and posting a listing writes one row per follower. A seller clearing out a flat and
 * listing eight things in an afternoon therefore sent each of their followers eight separate
 * emails, all saying the same thing with a different title. That is the fastest way to teach
 * somebody to filter mail from this domain, and once they have, every email after it is lost
 * too: the booking, the payout, the message. The cost of the per-listing email was never
 * really the listing email.
 *
 * <p>LISTING is therefore excluded from the immediate relay and arrives here instead. The
 * in-app notification is unchanged and still written the moment the listing is saved — the
 * bell is free, it is the mail that needed rationing.
 *
 * <h2>The day it covers</h2>
 * <p>Runs at midnight and reports the calendar day that has just ended, in {@code app.digest.zone}
 * rather than the server's clock. The audience is in one city; a digest that arrives at 2am
 * local because the container runs UTC is a different product from one that arrives at
 * midnight, and Railway containers do not run in Warsaw.
 *
 * <h2>Duplicate sends</h2>
 * <p>There is no lock. The cron fires once per instance, so a single instance sends one
 * digest and two instances would send two. Every other scheduled job in this service makes
 * the same assumption — the payout sweep and the Adzuna import both do — so this matches
 * what is already deployed rather than inventing a locking scheme for one job. If this ever
 * runs more than one replica, that becomes real for all three at once, and the fix belongs
 * in one place rather than here.
 */
@Service
@RequiredArgsConstructor
public class NewListingDigestService {

    private static final Logger log = LoggerFactory.getLogger(NewListingDigestService.class);

    /** Listings named in full in the email; the rest are counted. Keeps a big day readable. */
    private static final int MAX_LISTED = 12;

    private final ListingRepository listingRepository;
    private final UserRepository userRepository;
    private final EmailService emailService;
    private final JdbcTemplate jdbcTemplate;

    /** The clock the digest's "day" is measured against. The audience is in Poland. */
    @Value("${app.digest.zone:Europe/Warsaw}")
    private String zoneId;

    /** Lets an environment turn the nightly mail off without removing the bean. */
    @Value("${app.digest.new-listings.enabled:true}")
    private boolean enabled;

    @Value("${app.frontend.url:https://hustlespace.space}")
    private String frontendUrl;

    /**
     * Midnight, in the configured zone.
     *
     * <p>The zone is on the annotation as well as in the window calculation: without it Spring
     * fires the cron on the server's clock, so the job would run at midnight UTC and then
     * correctly report a Warsaw day that had not finished yet.
     */
    @Scheduled(cron = "${app.digest.new-listings.cron:0 0 0 * * *}", zone = "${app.digest.zone:Europe/Warsaw}")
    public void sendNightlyDigest() {
        if (!enabled) return;
        try {
            ZoneId zone = ZoneId.of(zoneId);
            LocalDate day = LocalDate.now(zone).minusDays(1);
            send(day.atStartOfDay(), day.plusDays(1).atStartOfDay(), day);
        } catch (Exception e) {
            // A failed digest must never take the scheduler down with it; the next night is
            // a fresh attempt and a missed digest is not worth a restart loop.
            log.warn("New-listing digest failed: {}", e.getMessage(), e);
        }
    }

    /**
     * Builds and sends the digest for one window.
     *
     * <p>Separated from the schedule so it can be called for a specific day — a re-send after
     * an outage, or a test — without waiting for midnight.
     *
     * @return how many emails were sent
     */
    public int send(LocalDateTime from, LocalDateTime to, LocalDate labelDay) {
        List<Listing> listings = listingRepository
                .findByCreatedAtBetweenAndStatusOrderByCreatedAtAsc(from, to, ListingStatus.ACTIVE);
        if (listings.isEmpty()) {
            log.info("New-listing digest for {}: nothing posted, no mail sent", labelDay);
            return 0;
        }

        // Sellers first, then everyone following any of them — two queries regardless of how
        // busy the day was, rather than one per listing as the per-listing path did.
        Set<UUID> sellerIds = listings.stream()
                .map(Listing::getSellerId).filter(Objects::nonNull).collect(Collectors.toSet());
        if (sellerIds.isEmpty()) return 0;

        Map<UUID, List<UUID>> followersBySeller = followersOf(sellerIds);
        if (followersBySeller.isEmpty()) {
            log.info("New-listing digest for {}: {} listings, nobody following the sellers",
                    labelDay, listings.size());
            return 0;
        }

        // Invert to one bundle per recipient. Somebody following three sellers who all posted
        // gets one email covering all three, which is the whole point.
        Map<UUID, List<Listing>> byFollower = new HashMap<>();
        for (Listing l : listings) {
            for (UUID follower : followersBySeller.getOrDefault(l.getSellerId(), List.of())) {
                // Never mail somebody their own listing back.
                if (follower.equals(l.getSellerId())) continue;
                byFollower.computeIfAbsent(follower, k -> new ArrayList<>()).add(l);
            }
        }
        if (byFollower.isEmpty()) return 0;

        Map<UUID, User> sellers = usersById(sellerIds);
        Map<UUID, User> recipients = usersById(byFollower.keySet());

        int sent = 0;
        for (Map.Entry<UUID, List<Listing>> e : byFollower.entrySet()) {
            User to_ = recipients.get(e.getKey());
            if (to_ == null || to_.getEmail() == null || to_.getEmail().isBlank()) continue;
            try {
                emailService.send(to_.getEmail(), subject(e.getValue()), body(e.getValue(), sellers));
                sent++;
            } catch (Exception ex) {
                // One bad address does not cost everybody else their digest.
                log.warn("Digest to {} failed: {}", e.getKey(), ex.getMessage());
            }
        }
        log.info("New-listing digest for {}: {} listings -> {} emails", labelDay, listings.size(), sent);
        return sent;
    }

    // ---- Data ---------------------------------------------------------------

    /** seller id -> everyone following them. One query for the whole day's sellers. */
    private Map<UUID, List<UUID>> followersOf(Set<UUID> sellerIds) {
        String placeholders = String.join(",", Collections.nCopies(sellerIds.size(), "?"));
        Object[] args = sellerIds.stream().map(UUID::toString).toArray();
        Map<UUID, List<UUID>> out = new HashMap<>();
        // Varargs overload, not query(String, Object[], RowCallbackHandler) — that one is
        // deprecated and resolves ambiguously against the PreparedStatementSetter form.
        jdbcTemplate.query(
                "SELECT following_id, follower_id FROM follows WHERE following_id IN (" + placeholders + ")",
                rs -> {
                    try {
                        UUID seller = UUID.fromString(rs.getString("following_id"));
                        UUID follower = UUID.fromString(rs.getString("follower_id"));
                        out.computeIfAbsent(seller, k -> new ArrayList<>()).add(follower);
                    } catch (IllegalArgumentException ignored) {
                        // A malformed id in one row should not abandon the whole digest.
                    }
                },
                args);
        return out;
    }

    private Map<UUID, User> usersById(Collection<UUID> ids) {
        return userRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(User::getId, u -> u, (a, b) -> a));
    }

    // ---- Presentation -------------------------------------------------------

    private String subject(List<Listing> listings) {
        int n = listings.size();
        return n == 1
                ? "1 new listing from someone you follow"
                : n + " new listings from people you follow";
    }

    private String body(List<Listing> listings, Map<UUID, User> sellers) {
        StringBuilder rows = new StringBuilder();
        for (Listing l : listings.stream().limit(MAX_LISTED).toList()) {
            User seller = sellers.get(l.getSellerId());
            String who = seller != null ? escape(seller.displayName()) : "A seller";
            String price = l.getPrice() == null ? ""
                    : " &middot; <span style=\"color:#111\">" + escape(formatPrice(l)) + "</span>";
            rows.append("""
                    <tr><td style="padding:10px 0;border-bottom:1px solid #eee">
                      <a href="%s/listing/%s" style="font-size:15px;color:#111;text-decoration:none;font-weight:600">%s</a>
                      <div style="font-size:13px;color:#666;margin-top:2px">%s%s</div>
                    </td></tr>
                    """.formatted(frontendUrl, l.getId(), escape(l.getTitle()), who, price));
        }

        int hidden = listings.size() - Math.min(listings.size(), MAX_LISTED);
        String more = hidden <= 0 ? "" :
                "<p style=\"margin:14px 0 0;font-size:13px;color:#666\">and %d more</p>".formatted(hidden);

        return """
                <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:560px">
                  <h2 style="margin:0 0 4px;font-size:18px;color:#111">%s</h2>
                  <p style="margin:0 0 12px;font-size:14px;color:#666">Posted yesterday by people you follow.</p>
                  <table style="width:100%%;border-collapse:collapse">%s</table>
                  %s
                  <p style="margin:20px 0 0;font-size:13px;color:#888">
                    One email a day, not one per listing. You're receiving this because you follow
                    these sellers on HustleSpace.
                  </p>
                </div>
                """.formatted(subject(listings), rows, more);
    }

    /** Deliberately plain: the currency is the seller's own and is shown as stored. */
    private String formatPrice(Listing l) {
        return l.getPrice().stripTrailingZeros().toPlainString()
                + " " + (l.getCurrency() == null || l.getCurrency().isBlank() ? "PLN" : l.getCurrency());
    }

    /** Titles are typed by sellers and go into HTML. */
    private static String escape(String s) {
        return s == null ? "" : s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }
}
