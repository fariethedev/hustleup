/**
 * One row of a leaderboard.
 *
 * <p>Carries every ranked metric rather than just the one being sorted on, so the client
 * can switch between the "most sales" / "most earned" / "highest score" boards without a
 * refetch, and so each row can show context beyond its rank.
 */
package com.hustleup.marketplace.reputation.dto;

import lombok.*;

import java.math.BigDecimal;
import java.util.UUID;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class LeaderboardEntryDto {

    /** 1-based position on the board this row was returned for. */
    private int rank;

    private UUID userId;
    private String userName;
    private String avatarUrl;
    private String city;
    private boolean verified;

    // ── Ranked metrics ────────────────────────────────────────────────────────
    private long salesCount;
    private BigDecimal earnings;
    private String currency;
    private int hustleScore;
    private String tier;
    private double avgRating;

    /**
     * How many reviews that average is built from.
     *
     * <p>An average alone is misleading on a leaderboard: 5.0 from a single review outranks
     * 4.8 from forty on the eye, when the second seller is plainly the safer trade. Shipping
     * the count lets the row show "4.8 (40)" so a rank can be read honestly.
     */
    private long reviewCount;
    private long acceptedSwaps;
}
