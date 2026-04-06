/**
 * JPA entity representing a booking on the HustleUp marketplace.
 *
 * <p>A {@code Booking} ties a <em>buyer</em> to a specific {@link com.hustleup.listing.model.Listing}
 * and captures the full price negotiation lifecycle between the two parties. It is the central
 * transactional object of the marketplace — once a booking reaches {@link BookingStatus#BOOKED},
 * money can change hands (via a payment gateway, not yet implemented) and the service is delivered.
 *
 * <h3>Booking lifecycle (state machine)</h3>
 * <pre>
 *   POSTED → INQUIRED → NEGOTIATING → BOOKED → COMPLETED
 *                  ↘              ↘         ↘
 *                CANCELLED     CANCELLED  CANCELLED
 * </pre>
 * <ul>
 *   <li>{@code POSTED} — the listing was seen; a booking record exists but no formal request yet.</li>
 *   <li>{@code INQUIRED} — the buyer sent a booking request (with or without a custom price).</li>
 *   <li>{@code NEGOTIATING} — the seller responded with a counter-offer price.</li>
 *   <li>{@code BOOKED} — both parties accepted a price; service is scheduled.</li>
 *   <li>{@code COMPLETED} — the seller marked the service as delivered.</li>
 *   <li>{@code CANCELLED} — either party cancelled; {@code cancelReason} records why.</li>
 * </ul>
 *
 * <h3>Three-price model</h3>
 * <p>The entity tracks three price fields to represent the negotiation trail:
 * <ol>
 *   <li>{@code offeredPrice} — what the buyer initially proposed</li>
 *   <li>{@code counterPrice} — the seller's counter-proposal (set during NEGOTIATING)</li>
 *   <li>{@code agreedPrice} — the final locked price set when the booking becomes BOOKED</li>
 * </ol>
 *
 * <h3>JPA design decisions</h3>
 * <p>Like {@link com.hustleup.listing.model.Listing}, foreign key references to other entities
 * ({@code buyerId}, {@code sellerId}, {@code listingId}) are stored as UUID columns rather than
 * JPA {@code @ManyToOne} relationships. This keeps the module boundary clean and avoids
 * accidental lazy-loading issues.
 */
package com.hustleup.booking.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

// @Entity — Hibernate will map this class to the "bookings" database table.
@Entity
// @Table(name = "bookings") makes the mapping explicit rather than relying on the default
// (which would be "booking" — singular, which is inconsistent with our "listings" convention).
@Table(name = "bookings")
// Lombok: @Getter/@Setter generate accessors; @Builder provides a fluent construction API;
// @NoArgsConstructor is required by JPA (Hibernate needs a no-arg constructor to instantiate entities);
// @AllArgsConstructor is used by @Builder internally.
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Booking {

    // @Id — primary key of the bookings table.
    @Id
    // @UuidGenerator — Hibernate auto-generates a UUID when the entity is first persisted.
    @org.hibernate.annotations.UuidGenerator
    // Store the UUID as a 36-character hyphenated string (e.g. "550e8400-e29b-41d4-a716-446655440000")
    // for human readability in database tools. Some databases have native UUID types, but VARCHAR
    // works universally.
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(columnDefinition = "VARCHAR(36)")
    private UUID id; // globally unique identifier for this booking

    // Soft foreign key to the users table — the buyer who initiated the booking.
    // Not a @ManyToOne join to keep the module boundary clean.
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "buyer_id", nullable = false, columnDefinition = "VARCHAR(36)")
    private UUID buyerId; // UUID of the user who requested the booking

    // Soft foreign key to the users table — the seller who owns the listing being booked.
    // Denormalised here (also accessible via listingId → Listing.sellerId) for query efficiency:
    // fetching all a seller's bookings is a simple indexed lookup rather than a join.
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "seller_id", nullable = false, columnDefinition = "VARCHAR(36)")
    private UUID sellerId; // UUID of the seller whose service is being booked

    // Soft foreign key to the listings table — which service/product is being booked.
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "listing_id", nullable = false, columnDefinition = "VARCHAR(36)")
    private UUID listingId; // UUID of the listing that this booking is for

    // --- Three-price negotiation trail ---

    // The price the buyer proposed when creating the booking.
    // If null (buyer didn't specify), the service layer defaults to the listing's asking price.
    @Column(name = "offered_price", precision = 12, scale = 4)
    private BigDecimal offeredPrice; // buyer's opening offer

    // Set when the seller counter-offers via the /counter endpoint.
    // Null until the booking enters the NEGOTIATING state.
    @Column(name = "counter_price", precision = 12, scale = 4)
    private BigDecimal counterPrice; // seller's counter-proposal (may be null)

    // The price that both parties agreed on; set when the booking is accepted (BOOKED state).
    // This is the value that would be charged in a payment integration.
    @Column(name = "agreed_price", precision = 12, scale = 4)
    private BigDecimal agreedPrice; // final locked price (null until BOOKED)

    // ISO 4217 currency code; inherited from the listing's currency at booking creation time
    // so the price context is preserved even if the listing is later edited.
    @Builder.Default
    private String currency = "GBP"; // currency of all price fields

    // When the buyer wants the service to be delivered.
    // Optional — not all services require a specific time slot.
    @Column(name = "scheduled_at")
    private LocalDateTime scheduledAt; // requested delivery date/time, or null if flexible

    // The current state in the booking lifecycle state machine.
    // @Enumerated(EnumType.STRING) stores it as "INQUIRED" etc. rather than a number.
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private BookingStatus status = BookingStatus.POSTED; // starts at POSTED when the row is created

    // Free-text reason recorded when either party cancels.
    // Null for non-cancelled bookings.
    @Column(name = "cancel_reason")
    private String cancelReason; // human-readable reason for cancellation, or null

    // @Version enables optimistic locking: if two concurrent requests try to update the same
    // booking (e.g. both buyer and seller click accept simultaneously), the second save will
    // fail with ObjectOptimisticLockingFailureException rather than silently overwriting.
    @Version
    @Builder.Default
    private Long version = 0L; // incremented by Hibernate on every save; used for conflict detection

    // Audit timestamps — managed in application code rather than DB triggers for timezone control.
    @Column(name = "created_at")
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now(); // when the booking was first created

    // Must be manually updated in service code whenever the booking state changes.
    @Column(name = "updated_at")
    @Builder.Default
    private LocalDateTime updatedAt = LocalDateTime.now(); // when the booking was last modified
}
