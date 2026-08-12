/**
 * A user's Hustle Score plus the raw numbers it was derived from.
 *
 * <p>The breakdown is returned alongside the total on purpose: a reputation number that
 * cannot be explained is not trusted, and "why is my score that?" is the first question
 * anyone asks. Every component here maps to something the user can actually influence.
 */
package com.hustleup.marketplace.reputation.dto;

import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class HustleScoreDto {

    private UUID userId;
    private String userName;
    private String avatarUrl;

    /** Final score, 0–1000, after the inactivity multiplier is applied. */
    private int score;

    /** Human label for the score band, e.g. "Hustler". */
    private String tier;

    // ── Underlying stats ──────────────────────────────────────────────────────
    private long salesCount;
    private BigDecimal earnings;
    private String currency;
    private double avgRating;
    private long reviewCount;
    private long acceptedSwaps;
    private LocalDateTime lastSaleAt;

    /**
     * The inactivity multiplier that was applied (1.0 = fully active).
     * Surfaced so the UI can say "your score is dimmed — make a sale to restore it".
     */
    private double activityMultiplier;

    /** Points contributed by each component, before the multiplier. */
    private Breakdown breakdown;

    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    public static class Breakdown {
        private int sales;
        private int earnings;
        private int rating;
        private int reviews;
        private int swaps;
    }
}
