package com.hustleup.review.controller;

import com.hustleup.booking.model.Booking;
import com.hustleup.booking.model.BookingStatus;
import com.hustleup.booking.repository.BookingRepository;
import com.hustleup.review.dto.ReviewDto;
import com.hustleup.review.model.Review;
import com.hustleup.review.repository.ReviewRepository;
import com.hustleup.common.model.User;
import com.hustleup.common.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/reviews")
public class ReviewController {

    private final ReviewRepository reviewRepository;
    private final BookingRepository bookingRepository;
    private final UserRepository userRepository;

    public ReviewController(ReviewRepository reviewRepository, BookingRepository bookingRepository,
                            UserRepository userRepository) {
        this.reviewRepository = reviewRepository;
        this.bookingRepository = bookingRepository;
        this.userRepository = userRepository;
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody Map<String, Object> body) {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        User reviewer = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        UUID bookingId = UUID.fromString((String) body.get("bookingId"));
        int rating = (int) body.get("rating");
        String comment = (String) body.get("comment");

        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new RuntimeException("Booking not found"));

        if (booking.getStatus() != BookingStatus.COMPLETED) {
            return ResponseEntity.badRequest().body(Map.of("error", "Can only review completed bookings"));
        }

        if (reviewRepository.existsByBookingId(bookingId)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Already reviewed"));
        }

        UUID reviewedId = booking.getSellerId().equals(reviewer.getId()) ?
                booking.getBuyerId() : booking.getSellerId();

        Review review = Review.builder()
                .bookingId(bookingId)
                .reviewerId(reviewer.getId())
                .reviewedId(reviewedId)
                .rating(rating)
                .comment(comment)
                .build();

        ReviewDto dto = ReviewDto.fromEntity(reviewRepository.save(review));
        dto.setReviewerName(reviewer.getFullName());
        return ResponseEntity.ok(dto);
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<List<ReviewDto>> getUserReviews(@PathVariable UUID userId) {
        List<ReviewDto> reviews = reviewRepository.findByReviewedIdOrderByCreatedAtDesc(userId).stream()
                .map(r -> {
                    ReviewDto dto = ReviewDto.fromEntity(r);
                    userRepository.findById(r.getReviewerId()).ifPresent(u -> dto.setReviewerName(u.getFullName()));
                    return dto;
                })
                .collect(Collectors.toList());
        return ResponseEntity.ok(reviews);
    }
}
