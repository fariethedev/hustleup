/**
 * JPA entity representing a barter offer against a listing — the core of "Swap Mode".
 *
 * <p>A {@code SwapOffer} is what a {@link com.hustleup.marketplace.booking.model.Booking}
 * would be if the counter-offer were an object instead of a number. Where a booking
 * negotiates {@code offeredPrice → counterPrice → agreedPrice}, a swap negotiates
 * "this thing of mine, for that thing of yours".
 *
 * <h3>Two shapes of offer</h3>
 * The thing being offered is deliberately allowed to be one of two forms, because
 * students trade things they have never listed:
 * <ul>
 *   <li>{@code offeredListingId} — a listing the proposer already owns. Preferred, because
 *       it gives the other side something concrete to inspect (photos, price, reviews).</li>
 *   <li>{@code offeredText} — free text such as "2hrs of calculus tutoring". The escape
 *       hatch for skills and favours that nobody would bother creating a listing for.</li>
 * </ul>
 * Exactly one is required; {@link com.hustleup.marketplace.swap.service.SwapService}
 * enforces that at write time rather than relying on a DB constraint, so the API can
 * return a readable 400 instead of a driver-level integrity error.
 *
 * <h3>Soft foreign keys</h3>
 * As with {@link com.hustleup.marketplace.listing.model.Listing}, user references are
 * stored as bare UUIDs rather than JPA relationships — the User entity belongs to the
 * common module and we do not want this table coupled to its schema.
 *
 * <h3>Why targetOwnerId is denormalised</h3>
 * It is derivable by joining through {@code targetListingId}, but the single hottest
 * query in this feature is "show me offers waiting on me". Storing the owner directly
 * keeps that a plain indexed lookup instead of a join on every poll of the inbox.
 */
package com.hustleup.marketplace.swap.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(
        name = "swap_offers",
        indexes = {
                // Backs the inbox query ("offers waiting on me"), which is polled most often.
                @Index(name = "idx_swap_target_owner", columnList = "target_owner_id, status"),
                // Backs the outbox query ("offers I have sent").
                @Index(name = "idx_swap_proposer", columnList = "proposer_id, status"),
                // Backs the per-listing offer count shown on the listing page.
                @Index(name = "idx_swap_target_listing", columnList = "target_listing_id, status")
        }
)
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class SwapOffer {

    @Id
    @org.hibernate.annotations.UuidGenerator
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(columnDefinition = "VARCHAR(36)")
    private UUID id;

    // ── Who wants what ────────────────────────────────────────────────────────

    /** The listing the proposer wants to receive. */
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "target_listing_id", nullable = false, columnDefinition = "VARCHAR(36)")
    private UUID targetListingId;

    /** Owner of {@link #targetListingId} — denormalised so the inbox needs no join. */
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "target_owner_id", nullable = false, columnDefinition = "VARCHAR(36)")
    private UUID targetOwnerId;

    /** The user making the offer. */
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "proposer_id", nullable = false, columnDefinition = "VARCHAR(36)")
    private UUID proposerId;

    // ── What is being offered in return (exactly one of these) ────────────────

    /** A listing the proposer owns and is putting up in trade. Null for a text offer. */
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "offered_listing_id", columnDefinition = "VARCHAR(36)")
    private UUID offeredListingId;

    /** Free-text offer, e.g. "2hrs of calc tutoring". Null when a listing is offered. */
    @Column(name = "offered_text", length = 280)
    private String offeredText;

    // ── Conversation ──────────────────────────────────────────────────────────

    /** Optional note from the proposer explaining the trade. */
    @Column(columnDefinition = "TEXT")
    private String message;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    @Column(nullable = false)
    private SwapStatus status = SwapStatus.PENDING;

    // ── Bookkeeping ───────────────────────────────────────────────────────────

    /**
     * Optimistic locking. Matters more here than on most tables: accept and decline are
     * both single-shot state transitions, and two taps on a flaky mobile connection must
     * not both succeed.
     */
    @Version
    @Builder.Default
    private Long version = 0L;

    @Column(name = "created_at")
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    /** When the owner accepted/declined, or the proposer withdrew. Null while PENDING. */
    @Column(name = "responded_at")
    private LocalDateTime respondedAt;
}
