/**
 * JPA entity representing a single bookable time slot a seller has opened up for one of
 * their listings (typically a service-type listing such as HAIR_BEAUTY or SKILL).
 *
 * <p>Sellers create slots ahead of time (e.g. "Tue 10:00–11:00"); buyers pick an open slot
 * when booking instead of freely negotiating a schedule. A slot can only ever be attached
 * to one {@link com.hustleup.marketplace.booking.model.Booking} at a time — once booked it
 * is hidden from other buyers until it is freed again (booking cancelled).
 *
 * <h3>Table: {@code availability_slots}</h3>
 */
package com.hustleup.marketplace.availability.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "availability_slots")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Availability {

    @Id
    @org.hibernate.annotations.UuidGenerator
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(columnDefinition = "VARCHAR(36)")
    private UUID id;

    // Soft foreign key to the listing this slot belongs to.
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "listing_id", nullable = false, columnDefinition = "VARCHAR(36)")
    private UUID listingId;

    // Denormalised for fast "all my slots across all my listings" queries without a join.
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "seller_id", nullable = false, columnDefinition = "VARCHAR(36)")
    private UUID sellerId;

    @Column(name = "start_time", nullable = false)
    private LocalDateTime startTime;

    @Column(name = "end_time", nullable = false)
    private LocalDateTime endTime;

    // True once a buyer has booked this slot — hidden from other buyers, and cannot be
    // deleted by the seller until the booking referencing it is cancelled.
    @Column(nullable = false)
    @Builder.Default
    private boolean booked = false;

    @Column(name = "created_at")
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
