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
    private long acceptedSwaps;
}
