package com.hustleup.marketplace.feedback.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * What a seller thinks of HustleSpace, asked once a sale is finished.
 *
 * <h3>Why this is not a Review</h3>
 * {@link com.hustleup.marketplace.review.model.Review} is one person's judgement of another
 * person, and it feeds a public rating: the stars on a shop card, the leaderboard, the
 * average on a storefront. Completion used to demand one from the seller about the buyer,
 * which produced the wrong thing twice over. It gated the seller's own payout behind an
 * opinion they had no particular reason to hold, and what it collected — a rating of the
 * buyer — is barely surfaced anywhere, while the rating that actually matters to the
 * marketplace is the buyer's rating of the seller, which the buyer gives separately.
 *
 * <p>The moment a sale completes is genuinely a good moment to ask the seller something. It
 * is just not a good moment to ask them about the buyer. It is the moment they have finished
 * a full loop through the product — listing, negotiating, shipping, getting paid — and can
 * say whether it worked.
 *
 * <h3>Private, and therefore honest</h3>
 * This is never shown next to anyone's name and never affects anyone's rating. A seller
 * saying "payouts take too long" is telling the operators something useful, and would not say
 * it at all if it were going to sit on their shop page. Only an admin reads it.
 *
 * <p>{@code bookingId} is nullable so the same table can take feedback that is not tied to a
 * particular sale later — a prompt from the dashboard, say — without a schema change.
 */
@Entity
@Table(name = "platform_feedback")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class PlatformFeedback {

    @Id
    @org.hibernate.annotations.UuidGenerator
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(columnDefinition = "VARCHAR(36)")
    private UUID id;

    /** Who gave it. */
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "user_id", nullable = false, columnDefinition = "VARCHAR(36)")
    private UUID userId;

    /**
     * The sale that prompted it, or null when the feedback was volunteered rather than
     * asked for at the end of a transaction.
     */
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "booking_id", columnDefinition = "VARCHAR(36)")
    private UUID bookingId;

    /**
     * Which side of the transaction they were on when asked.
     *
     * <p>Stored rather than derived, because it is a fact about the moment: someone who sold
     * today may buy tomorrow, and "this is what sellers say about us" has to keep meaning
     * that when the same person appears in both roles.
     */
    @Column(name = "author_role", length = 16, nullable = false)
    @Builder.Default
    private String authorRole = "SELLER";

    /** 1–5. How the platform is working for them. */
    @Column(nullable = false)
    private int rating;

    /**
     * What should be better. Optional and free text on purpose — a fixed list of options
     * only ever collects the problems somebody already thought of.
     */
    @Column(columnDefinition = "TEXT")
    private String improvement;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
