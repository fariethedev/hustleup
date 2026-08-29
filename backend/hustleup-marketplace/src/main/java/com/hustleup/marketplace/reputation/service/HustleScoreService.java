/**
 * Computes the Hustle Score and the marketplace leaderboards.
 *
 * <h2>What the score is trying to say</h2>
 * "This person is <em>currently</em> reliable to trade with" — not "this person was good
 * once". That single design goal drives two decisions that make it different from a plain
 * sales counter:
 *
 * <ul>
 *   <li><b>Only delivered work counts.</b> Sales are counted from {@code COMPLETED}
 *       bookings. A {@code BOOKED} row is an agreement, not an outcome; counting it would
 *       let someone climb the board by agreeing to sales they never fulfil.</li>
 *   <li><b>It decays.</b> A score earned last term should not read the same as one earned
 *       last week. The inactivity multiplier fades a dormant seller's score without ever
 *       deleting their history, and a single new sale restores it.</li>
 * </ul>
 *
 * <h2>Composition</h2>
 * Five components, each capped so no single axis can dominate. The caps matter: without
 * them a seller of one very expensive item would outrank someone with fifty happy
 * customers, which is the opposite of what a trust signal should say.
 *
 * <pre>
 *   sales     completed sales x 12    capped 360
 *   earnings  gross x 0.15            capped 250
 *   rating    (avg / 5) x 180         needs >= 1 review
 *   reviews   count x 6               capped  90
 *   swaps     accepted swaps x 15     capped 120
 *                                     -------------
 *                             raw total capped 1000, then x activity multiplier
 * </pre>
 *
 * <h2>A note on currency</h2>
 * Earnings are summed in their stored units without FX conversion. The platform is
 * effectively single-currency (PLN), so this is correct today, but a genuinely
 * multi-currency marketplace would need conversion before these sums mean anything.
 */
package com.hustleup.marketplace.reputation.service;

import com.hustleup.common.model.User;
import com.hustleup.common.repository.UserRepository;
import com.hustleup.common.storage.FileStorageService;
import com.hustleup.marketplace.booking.repository.BookingRepository;
import com.hustleup.marketplace.reputation.dto.HustleScoreDto;
import com.hustleup.marketplace.reputation.dto.LeaderboardEntryDto;
import com.hustleup.marketplace.review.repository.ReviewRepository;
import com.hustleup.marketplace.swap.repository.SwapOfferRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Slf4j
public class HustleScoreService {

    // ── Tunables ──────────────────────────────────────────────────────────────
    private static final int MAX_SCORE = 1000;

    private static final double POINTS_PER_SALE = 12;
    private static final int CAP_SALES = 360;

    private static final double POINTS_PER_CURRENCY_UNIT = 0.15;
    private static final int CAP_EARNINGS = 250;

    private static final int WEIGHT_RATING = 180;

    private static final double POINTS_PER_REVIEW = 6;
    private static final int CAP_REVIEWS = 90;

    private static final double POINTS_PER_SWAP = 15;
    private static final int CAP_SWAPS = 120;

    /** Platform currency. See the class note on FX. */
    private static final String CURRENCY = "PLN";

    private final BookingRepository bookingRepository;
    private final ReviewRepository reviewRepository;
    private final SwapOfferRepository swapOfferRepository;
    private final UserRepository userRepository;
    private final FileStorageService fileStorageService;

    public HustleScoreService(BookingRepository bookingRepository,
                              ReviewRepository reviewRepository,
                              SwapOfferRepository swapOfferRepository,
                              UserRepository userRepository,
                              FileStorageService fileStorageService) {
        this.bookingRepository = bookingRepository;
        this.reviewRepository = reviewRepository;
        this.swapOfferRepository = swapOfferRepository;
        this.userRepository = userRepository;
        this.fileStorageService = fileStorageService;
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Scores a single user.
     *
     * <p>Reuses the same bulk pass as the leaderboard rather than issuing per-user queries;
     * at this data size that is cheaper than it looks and keeps one code path for scoring,
     * so a profile badge can never disagree with the leaderboard.
     */
    public HustleScoreDto scoreFor(UUID userId) {
        Stats s = allStats(null).getOrDefault(userId, Stats.empty(userId));
        HustleScoreDto dto = toScoreDto(s);
        userRepository.findById(userId).ifPresent(u -> {
            dto.setUserName(u.displayName());
            dto.setAvatarUrl(refresh(u.getAvatarUrl()));
        });
        return dto;
    }

    /**
     * Builds a leaderboard.
     *
     * @param metric one of {@code sales}, {@code earnings}, {@code score}
     * @param window one of {@code week}, {@code month}, {@code all}
     * @param limit  max rows (clamped to 1..100)
     */
    public List<LeaderboardEntryDto> leaderboard(String metric, String window, int limit) {
        LocalDateTime since = switch (window == null ? "all" : window.toLowerCase()) {
            case "week"  -> LocalDateTime.now().minusDays(7);
            case "month" -> LocalDateTime.now().minusDays(30);
            default      -> null;
        };

        Collection<Stats> all = allStats(since).values();

        Comparator<Stats> order = switch (metric == null ? "sales" : metric.toLowerCase()) {
            case "earnings" -> Comparator.comparing((Stats s) -> s.earnings).reversed()
                    .thenComparing(s -> -s.salesCount);
            case "score"    -> Comparator.comparingInt((Stats s) -> -finalScore(s))
                    .thenComparing(s -> -s.salesCount);
            // Ties on sale count break toward the bigger earner, so the board is stable
            // rather than flipping between equal-sales sellers on every request.
            default         -> Comparator.comparingLong((Stats s) -> -s.salesCount)
                    .thenComparing(s -> s.earnings, Comparator.reverseOrder());
        };

        List<Stats> ranked = all.stream()
                // Someone with no completed sales and no accepted swaps has done nothing
                // to rank — showing them as "rank 14 with 0" makes the board look dead.
                .filter(s -> s.salesCount > 0 || s.acceptedSwaps > 0)
                .sorted(order)
                .limit(Math.max(1, Math.min(limit, 100)))
                .toList();

        // Resolve the display fields for just the ranked slice, in one query.
        Map<UUID, User> users = userRepository.findAllById(ranked.stream().map(s -> s.userId).toList())
                .stream().collect(Collectors.toMap(User::getId, u -> u));

        List<LeaderboardEntryDto> out = new ArrayList<>();
        for (int i = 0; i < ranked.size(); i++) {
            Stats s = ranked.get(i);
            User u = users.get(s.userId);
            out.add(LeaderboardEntryDto.builder()
                    .rank(i + 1)
                    .userId(s.userId)
                    .userName(u != null ? u.displayName() : "Unknown hustler")
                    .avatarUrl(u != null ? refresh(u.getAvatarUrl()) : null)
                    .city(u != null ? u.getCity() : null)
                    .verified(u != null && u.isIdVerified())
                    .salesCount(s.salesCount)
                    .earnings(s.earnings)
                    .currency(CURRENCY)
                    .hustleScore(finalScore(s))
                    .tier(tierFor(finalScore(s)))
                    .avgRating(s.avgRating)
                    .reviewCount(s.reviewCount)
                    .acceptedSwaps(s.acceptedSwaps)
                    .build());
        }
        return out;
    }

    // ── Scoring ───────────────────────────────────────────────────────────────

    private HustleScoreDto toScoreDto(Stats s) {
        HustleScoreDto.Breakdown breakdown = breakdownFor(s);
        return HustleScoreDto.builder()
                .userId(s.userId)
                .score(finalScore(s))
                .tier(tierFor(finalScore(s)))
                .salesCount(s.salesCount)
                .earnings(s.earnings)
                .currency(CURRENCY)
                .avgRating(s.avgRating)
                .reviewCount(s.reviewCount)
                .acceptedSwaps(s.acceptedSwaps)
                .lastSaleAt(s.lastSaleAt)
                .activityMultiplier(activityMultiplier(s.lastSaleAt))
                .breakdown(breakdown)
                .build();
    }

    private HustleScoreDto.Breakdown breakdownFor(Stats s) {
        int salesPts = (int) Math.min(CAP_SALES, Math.round(s.salesCount * POINTS_PER_SALE));
        int earnPts = (int) Math.min(CAP_EARNINGS,
                Math.round(s.earnings.doubleValue() * POINTS_PER_CURRENCY_UNIT));
        // An unrated seller scores 0 here rather than an assumed average — reputation
        // should be earned, not granted by default.
        int ratingPts = s.reviewCount > 0 ? (int) Math.round((s.avgRating / 5.0) * WEIGHT_RATING) : 0;
        int reviewPts = (int) Math.min(CAP_REVIEWS, Math.round(s.reviewCount * POINTS_PER_REVIEW));
        int swapPts = (int) Math.min(CAP_SWAPS, Math.round(s.acceptedSwaps * POINTS_PER_SWAP));

        return HustleScoreDto.Breakdown.builder()
                .sales(salesPts).earnings(earnPts).rating(ratingPts)
                .reviews(reviewPts).swaps(swapPts)
                .build();
    }

    private int finalScore(Stats s) {
        HustleScoreDto.Breakdown b = breakdownFor(s);
        int raw = b.getSales() + b.getEarnings() + b.getRating() + b.getReviews() + b.getSwaps();
        raw = Math.min(MAX_SCORE, raw);
        return (int) Math.round(raw * activityMultiplier(s.lastSaleAt));
    }

    /**
     * Fades a dormant seller's score. Stepped rather than continuous so the number is
     * predictable and explainable ("you're in the 60-day band"), and floored at 0.6 so
     * history is dimmed rather than erased.
     */
    private double activityMultiplier(LocalDateTime lastSaleAt) {
        if (lastSaleAt == null) return 0.6;
        long days = ChronoUnit.DAYS.between(lastSaleAt, LocalDateTime.now());
        if (days <= 30) return 1.0;
        if (days <= 60) return 0.9;
        if (days <= 90) return 0.75;
        return 0.6;
    }

    private String tierFor(int score) {
        if (score >= 750) return "Mogul";
        if (score >= 500) return "Operator";
        if (score >= 250) return "Hustler";
        if (score >= 100) return "Grinder";
        return "Rookie";
    }

    // ── Bulk stat assembly ────────────────────────────────────────────────────

    /**
     * Loads every user's stats in a fixed number of queries (four), regardless of how many
     * users exist.
     *
     * @param since if non-null, sales/earnings are limited to that window; ratings, swaps
     *              and the last-sale timestamp remain all-time, because a rating window
     *              would make the score jump around for reasons the user cannot act on.
     */
    private Map<UUID, Stats> allStats(LocalDateTime since) {
        Map<UUID, Stats> map = new HashMap<>();

        List<Object[]> sales = (since == null)
                ? bookingRepository.sellerSalesTotals()
                : bookingRepository.sellerSalesTotalsSince(since);
        for (Object[] row : sales) {
            UUID id = asUuid(row[0]);
            if (id == null) continue;
            Stats s = map.computeIfAbsent(id, Stats::empty);
            s.salesCount = ((Number) row[1]).longValue();
            s.earnings = row[2] instanceof BigDecimal bd ? bd : new BigDecimal(String.valueOf(row[2]));
        }

        for (Object[] row : reviewRepository.ratingTotalsByUser()) {
            UUID id = asUuid(row[0]);
            if (id == null) continue;
            Stats s = map.computeIfAbsent(id, Stats::empty);
            s.avgRating = row[1] == null ? 0.0 : ((Number) row[1]).doubleValue();
            s.reviewCount = ((Number) row[2]).longValue();
        }

        for (Object[] row : swapOfferRepository.acceptedSwapCountsByUser()) {
            UUID id = asUuid(row[0]);
            if (id == null) continue;
            Stats s = map.computeIfAbsent(id, Stats::empty);
            s.acceptedSwaps = ((Number) row[1]).longValue();
        }

        for (Object[] row : bookingRepository.lastCompletedSaleBySeller()) {
            UUID id = asUuid(row[0]);
            if (id == null) continue;
            Stats s = map.computeIfAbsent(id, Stats::empty);
            s.lastSaleAt = (LocalDateTime) row[1];
        }

        return map;
    }

    /** Rows arrive as UUID or String depending on JPQL vs native query. */
    private UUID asUuid(Object raw) {
        if (raw == null) return null;
        if (raw instanceof UUID u) return u;
        try {
            return UUID.fromString(raw.toString());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private String refresh(String url) {
        if (url == null || url.isBlank()) return null;
        try {
            return fileStorageService.refreshUrl(url);
        } catch (Exception e) {
            return url;
        }
    }

    /** Mutable per-user accumulator used only inside this service. */
    private static class Stats {
        UUID userId;
        long salesCount;
        BigDecimal earnings = BigDecimal.ZERO;
        double avgRating;
        long reviewCount;
        long acceptedSwaps;
        LocalDateTime lastSaleAt;

        static Stats empty(UUID id) {
            Stats s = new Stats();
            s.userId = id;
            return s;
        }
    }
}
