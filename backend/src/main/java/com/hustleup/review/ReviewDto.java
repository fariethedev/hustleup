package com.hustleup.review;

import lombok.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ReviewDto {
    private UUID id;
    private UUID bookingId;
    private UUID reviewerId;
    private String reviewerName;
    private UUID reviewedId;
    private int rating;
    private String comment;
    private LocalDateTime createdAt;

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
    }
}
