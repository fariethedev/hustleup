/**
 * A buyer's report that an order went wrong, and the thing that stops the money moving
 * while somebody looks at it.
 *
 * <h2>Why this exists at all</h2>
 * Money for both bookings and storefront orders sits on the platform's Stripe balance until
 * either the buyer confirms receipt or a hold period expires after delivery. The hold is what
 * protects a buyer who never presses anything — but it is also a deadline, and a buyer whose
 * parcel never arrived should not have to win a race against it. Opening a claim stops that
 * clock: nothing releases while a claim is OPEN, however long the review takes.
 *
 * <h2>Why one table for two kinds of order</h2>
 * Bookings and shop orders are separate entities with separate lifecycles, but a claim says
 * the same thing about either: this buyer paid, and did not get what they paid for. Splitting
 * it in two would mean two tables, two admin queues and two chances for the freeze to be
 * wired into one release path and forgotten in the other. {@link #orderType} carries which
 * side it belongs to and {@link #orderId} the row, deliberately as a soft reference — a claim
 * outliving a deleted order is a record worth keeping, not a constraint violation.
 */
package com.hustleup.marketplace.protection.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(
        name = "protection_claims",
        indexes = {
                // The freeze check: "is there an open claim against this order?", asked on
                // every release attempt and every payout sweep.
                @Index(name = "idx_claim_order", columnList = "order_type, order_id, status"),
                // The admin queue, and a buyer's own list of claims.
                @Index(name = "idx_claim_status", columnList = "status"),
                @Index(name = "idx_claim_buyer", columnList = "buyer_id")
        }
)
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ProtectionClaim {

    @Id
    @org.hibernate.annotations.UuidGenerator
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(columnDefinition = "VARCHAR(36)")
    private UUID id;

    /** BOOKING or SHOP_ORDER — which table {@link #orderId} points into. */
    @Enumerated(EnumType.STRING)
    @Column(name = "order_type", nullable = false, length = 20)
    private ClaimOrderType orderType;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "order_id", nullable = false, columnDefinition = "VARCHAR(36)")
    private UUID orderId;

    /** Denormalised so the admin queue and the freeze check need no join. */
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "buyer_id", nullable = false, columnDefinition = "VARCHAR(36)")
    private UUID buyerId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "seller_id", nullable = false, columnDefinition = "VARCHAR(36)")
    private UUID sellerId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private ClaimReason reason;

    /** The buyer's account of what happened, in their own words. */
    @Column(columnDefinition = "TEXT")
    private String detail;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    @Column(nullable = false, length = 20)
    private ClaimStatus status = ClaimStatus.OPEN;

    /** What the admin decided and why — shown back to both parties. */
    @Column(name = "resolution_note", columnDefinition = "TEXT")
    private String resolutionNote;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "resolved_by", columnDefinition = "VARCHAR(36)")
    private UUID resolvedBy;

    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    /** Which order table this claim points at. */
    public enum ClaimOrderType { BOOKING, SHOP_ORDER }

    /** What the buyer says went wrong. */
    public enum ClaimReason { NOT_RECEIVED, DAMAGED, NOT_AS_DESCRIBED, OTHER }

    /**
     * Lifecycle. Only {@link #OPEN} freezes the money — both resolutions are terminal, and
     * which one it was is the record of where the money went.
     */
    public enum ClaimStatus { OPEN, REFUNDED, REJECTED }
}
