/**
 * JPA entity representing a review left by one user for another after a completed booking.
 *
 * <p>Reviews are the trust mechanism of the HustleUp marketplace. After a
 * {@link com.hustleup.booking.model.Booking} reaches {@link com.hustleup.booking.model.BookingStatus#COMPLETED},
 * either party (buyer or seller) can leave a star rating and written comment for the other.
 *
 * <h3>Key business rules encoded in this entity</h3>
 * <ul>
 *   <li><b>One review per booking</b> — the {@code unique = true} constraint on {@code bookingId}
 *       prevents a user from leaving multiple reviews for the same transaction.</li>
 *   <li><b>Bi-directional</b> — a buyer can review the seller AND the seller can review the
 *       buyer. {@code reviewerId} is who wrote the review; {@code reviewedId} is who received it.
 *       The controller logic determines which side the authenticated user is on.</li>
 *   <li><b>Booking-anchored</b> — reviews must be tied to a real completed booking, preventing
 *       fake reviews from users who never transacted with each other.</li>
 * </ul>
 *
 * <h3>JPA design notes</h3>
 * <p>All foreign key fields ({@code bookingId}, {@code reviewerId}, {@code reviewedId}) are stored
 * as UUID columns rather than JPA {@code @ManyToOne} join fields, consistent with the rest of
 * the codebase's cross-module referencing strategy.
 */
package com.hustleup.review.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.LocalDateTime;
import java.util.UUID;

// @Entity — Hibernate maps this class to a database table.
@Entity
// @Table(name = "reviews") — explicit table name, consistent with the "reviews" plural convention.
@Table(name = "reviews")
// Lombok: @Getter/@Setter generate all accessors; @Builder provides a fluent builder;
// @NoArgsConstructor is required by JPA; @AllArgsConstructor is used by @Builder.
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Review {

    // @Id + @UuidGenerator: primary key is auto-generated as a UUID by Hibernate.
    @Id
    @org.hibernate.annotations.UuidGenerator
    // Store UUID as VARCHAR(36) — universal, human-readable, and cross-database compatible.
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(columnDefinition = "VARCHAR(36)")
    private UUID id; // globally unique identifier for this review

    // The booking that this review is attached to.
    // unique = true enforces the "one review per booking" rule at the database level —
    // even if application logic fails, the DB constraint prevents duplicates.
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "booking_id", nullable = false, unique = true, columnDefinition = "VARCHAR(36)")
    private UUID bookingId; // the booking that triggered this review (soft FK to bookings table)

    // The user who wrote the review. Determined at review-creation time by the controller,
    // which reads the authenticated user's ID.
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "reviewer_id", nullable = false, columnDefinition = "VARCHAR(36)")
    private UUID reviewerId; // UUID of the user who wrote this review

    // The user being reviewed. The controller determines this by checking which side of
    // the booking the reviewer was on: if the reviewer is the buyer, the reviewed is the seller,
    // and vice versa.
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "reviewed_id", nullable = false, columnDefinition = "VARCHAR(36)")
    private UUID reviewedId; // UUID of the user who is being reviewed

    // Star rating on a 1–5 scale (convention; no DB constraint — enforced in client validation).
    // int is used rather than Integer because a rating is always required (nullable = false).
    @Column(nullable = false)
    private int rating; // 1 = poor, 5 = excellent (convention enforced by the client)

    // Optional written feedback. TEXT allows long comments without a character limit.
    @Column(columnDefinition = "TEXT")
    private String comment; // written feedback from the reviewer, or null if not provided

    // Timestamp set once when the review is first saved. Reviews are immutable after creation —
    // there is no updatedAt because reviews cannot be edited.
    @Column(name = "created_at")
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now(); // when the review was submitted
}
