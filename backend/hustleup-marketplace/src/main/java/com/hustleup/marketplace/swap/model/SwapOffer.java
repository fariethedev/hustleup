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
 * <h3>Cash on top</h3>
 * Either shape can carry a {@link #cashAmount} in one direction or the other — "my iPhone
 * 12 plus 800 zł for your iPhone 15". Barter alone only clears when both sides happen to
 * value their items equally, which is rare enough that without a top-up most otherwise
 * workable trades die in the message thread. The cash is a term of the agreement, settled
 * between the two people alongside the handover; this feature has no payment leg of its own
 * (see {@link com.hustleup.marketplace.swap.model.SwapStatus}).
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

import java.math.BigDecimal;
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

    // ── Cash top-up ───────────────────────────────────────────────────────────
    // Optional money on top of the barter, in either direction. Null/zero is a pure swap,
    // which is what every offer made before this feature existed is.

    /**
     * Money added on top of the items, or null for a straight trade.
     *
     * <p>Always a positive magnitude — which side pays is {@link #cashDirection}, never the
     * sign of this number. See {@link CashDirection} for why.
     */
    @Column(name = "cash_amount", precision = 12, scale = 2)
    private BigDecimal cashAmount;

    /** Who pays {@link #cashAmount}. Null exactly when there is no cash in the deal. */
    @Enumerated(EnumType.STRING)
    @Column(name = "cash_direction", length = 20)
    private CashDirection cashDirection;

    /**
     * Currency of {@link #cashAmount}.
     *
     * <p>Stored per-offer rather than assumed platform-wide, for the same reason
     * {@code ShopOrder} stores it: the default may be PLN today, but an accepted trade is a
     * record of what two people agreed, and a later change to the platform default must not
     * silently reinterpret the amount somebody already shook hands on.
     */
    @Column(name = "cash_currency", length = 3)
    private String cashCurrency;

    /** True when this offer has real money attached, not just items. */
    public boolean hasCash() {
        return cashAmount != null && cashAmount.compareTo(BigDecimal.ZERO) > 0 && cashDirection != null;
    }

    // ── Conversation ──────────────────────────────────────────────────────────

    /** Optional note from the proposer explaining the trade. */
    @Column(columnDefinition = "TEXT")
    private String message;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    @Column(nullable = false)
    private SwapStatus status = SwapStatus.PENDING;

    // ── Handover ──────────────────────────────────────────────────────────────
    // Kept separate from {@link #status} for the same reason FulfilmentStatus is separate
    // from BookingStatus: status answers a commercial question (was this trade agreed), and
    // overloading it to also answer "has the item physically arrived" would give one field
    // two owners. A swap has two parcels in flight at once, so each side confirms its own
    // arrival independently — there is no single "delivered" moment to record.

    /** When the proposer confirmed the target owner's item reached them. Null until then. */
    @Column(name = "proposer_received_at")
    private LocalDateTime proposerReceivedAt;

    /**
     * Photo/video the proposer uploaded as proof of what arrived.
     *
     * <p>Required by the service rather than nullable-by-convention: a confirmation with
     * nothing behind it is one person's word, which is exactly what is disputed when a swap
     * goes wrong. Stored as the raw key — presign via FileStorageService before serving.
     */
    @Column(name = "proposer_proof_url", length = 1024)
    private String proposerProofUrl;

    /** When the listing owner confirmed the proposer's item reached them. */
    @Column(name = "owner_received_at")
    private LocalDateTime ownerReceivedAt;

    /** The listing owner's proof of what arrived. See {@link #proposerProofUrl}. */
    @Column(name = "owner_proof_url", length = 1024)
    private String ownerProofUrl;

    /** True once both parcels have landed and been evidenced — the trade is finished. */
    public boolean isHandoverComplete() {
        return proposerReceivedAt != null && ownerReceivedAt != null;
    }

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
