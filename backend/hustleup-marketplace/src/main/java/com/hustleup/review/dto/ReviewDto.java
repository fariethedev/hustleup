/**
 * Data Transfer Object (DTO) for a {@link Review} entity.
 *
 * <p>The {@code ReviewDto} is the JSON shape returned by review endpoints. It extends the raw
 * entity data with {@code reviewerName} — a display-friendly field that requires a separate
 * lookup in the users table and is therefore not stored on the review entity itself.
 *
 * <p>Like all DTOs in this service, this class is a pure data holder. No business logic lives
 * here — only the entity → DTO mapping factory method.
 */
package com.hustleup.review.dto;

import com.hustleup.review.model.Review;
import lombok.*;
import java.time.LocalDateTime;
import java.util.UUID;

// Lombok: generates getters, setters, no-arg constructor, all-args constructor, and builder.
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ReviewDto {

    // --- Identity ---
    private UUID id;        // unique identifier of this review

    // --- Booking reference ---
    private UUID bookingId; // the booking this review is attached to (one-to-one)

    // --- Reviewer info ---
    private UUID reviewerId;      // UUID of the user who wrote the review
    private String reviewerName;  // display name of the reviewer — NOT stored on entity, resolved by service/controller

    // --- Reviewed party ---
    private UUID reviewedId; // UUID of the user who received the review

    // --- Content ---
    private int rating;      // star rating (1–5 by convention)
    private String comment;  // written comment, may be null

    // --- Timestamps ---
    private LocalDateTime createdAt; // when the review was submitted

    /**
     * Converts a {@link Review} entity into a {@code ReviewDto}.
     *
     * <p>Note: {@code reviewerName} is NOT populated here — it requires a User lookup and
     * must be set separately after calling this method:
     * <pre>{@code
     *   ReviewDto dto = ReviewDto.fromEntity(review);
     *   userRepository.findById(review.getReviewerId())
     *       .ifPresent(u -> dto.setReviewerName(u.getFullName()));
     * }</pre>
     *
     * @param review the entity read from the database
     * @return a DTO with all scalar entity fields copied; {@code reviewerName} is null
     */
    public static ReviewDto fromEntity(Review review) {
        return ReviewDto.builder()
                .id(review.getId())
                .bookingId(review.getBookingId())
                .reviewerId(review.getReviewerId())
                .reviewedId(review.getReviewedId())
                .rating(review.getRating())
                .comment(review.getComment())
                .createdAt(review.getCreatedAt())
                .build();
        // Note: reviewerName is intentionally left null here.
        // It must be set by the caller after performing a User lookup.
    }
}
