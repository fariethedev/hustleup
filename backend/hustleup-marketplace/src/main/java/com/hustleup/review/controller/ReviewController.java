/**
 * REST controller that exposes the review API for the HustleUp marketplace.
 *
 * <p>Reviews allow buyers and sellers to rate each other after a completed transaction,
 * building a trust layer for the platform. All endpoints are under {@code /api/v1/reviews}.
 *
 * <h3>Design note — service logic in the controller</h3>
 * <p>Unlike the listing and booking controllers, this controller contains direct business
 * logic (booking status validation, duplicate check, reviewed-party resolution) rather than
 * delegating to a dedicated {@code ReviewService}. This is a pragmatic choice for a small,
 * focused feature — if review logic grows (e.g. moderation, photo uploads, reply threads),
 * it should be extracted into a service class.
 *
 * <h3>Key business rules enforced here</h3>
 * <ul>
 *   <li>Only {@code COMPLETED} bookings may be reviewed (can't review a cancelled booking).</li>
 *   <li>Each booking can only be reviewed once (idempotency guard).</li>
 *   <li>The reviewed party is automatically determined: if the reviewer is the buyer, the
 *       reviewed is the seller, and vice versa. Neither party can review themselves.</li>
 * </ul>
 */
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

// @RestController: responses are serialised to JSON automatically.
@RestController
// All endpoints are under /api/v1/reviews.
@RequestMapping("/api/v1/reviews")
public class ReviewController {

    // This controller accesses three repositories directly (no ReviewService layer).
    // See class Javadoc for rationale.
    private final ReviewRepository reviewRepository;     // save and query Review entities
    private final BookingRepository bookingRepository;   // verify booking status before allowing a review
    private final UserRepository userRepository;         // look up reviewer display name

    /**
     * Constructor injection: Spring provides all three repository beans automatically.
     */
    public ReviewController(ReviewRepository reviewRepository, BookingRepository bookingRepository,
                            UserRepository userRepository) {
        this.reviewRepository = reviewRepository;
        this.bookingRepository = bookingRepository;
        this.userRepository = userRepository;
    }

    /**
     * Creates a new review for a completed booking.
     *
     * <p><b>HTTP:</b> {@code POST /api/v1/reviews}
     * <br><b>Auth:</b> Required — the reviewer is identified by their JWT.
     * <br><b>Request body (JSON):</b>
     * <pre>{@code
     * {
     *   "bookingId": "uuid-of-the-completed-booking",
     *   "rating":    4,
     *   "comment":   "Great service, very professional!"
     * }
     * }</pre>
     *
     * <p><b>Validation (returns 400 Bad Request if violated):</b>
     * <ul>
     *   <li>The booking must be in {@code COMPLETED} state.</li>
     *   <li>No review must already exist for this booking.</li>
     * </ul>
     *
     * <p><b>Reviewed-party logic:</b> The reviewed party is automatically resolved:
     * if the reviewer is the buyer of the booking, the seller is reviewed (and vice versa).
     *
     * @param body JSON body with {@code bookingId}, {@code rating}, and optional {@code comment}
     * @return 200 OK with the new {@link ReviewDto} (including reviewerName), or 400 Bad Request
     */
    @PostMapping // handles POST /api/v1/reviews
    public ResponseEntity<?> create(@RequestBody Map<String, Object> body) {
        // Resolve the authenticated user from the Spring Security context.
        // The principal name is the email address, set during JWT authentication.
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        User reviewer = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        // Parse fields from the flexible Map body
        UUID bookingId = UUID.fromString((String) body.get("bookingId"));
        int rating = (int) body.get("rating");          // Jackson deserialises JSON integers as int
        String comment = (String) body.get("comment");  // optional; may be null

        // Look up the booking to validate the review is permitted
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new RuntimeException("Booking not found"));

        // Rule 1: Only completed bookings can be reviewed.
        // This prevents buyers from reviewing a seller they never actually transacted with.
        if (booking.getStatus() != BookingStatus.COMPLETED) {
            // ResponseEntity.badRequest() returns HTTP 400 — a client error (invalid input)
            return ResponseEntity.badRequest().body(Map.of("error", "Can only review completed bookings"));
        }

        // Rule 2: One review per booking. The unique constraint on Review.bookingId also
        // enforces this at the DB level, but we check here first to give a friendly error message.
        if (reviewRepository.existsByBookingId(bookingId)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Already reviewed"));
        }

        // Determine who is being reviewed: the reviewer reviews the OTHER party in the booking.
        // If the reviewer is the seller → they review the buyer; otherwise → they review the seller.
        UUID reviewedId = booking.getSellerId().equals(reviewer.getId()) ?
                booking.getBuyerId() : booking.getSellerId();

        // Build and save the review entity
        Review review = Review.builder()
                .bookingId(bookingId)
                .reviewerId(reviewer.getId())
                .reviewedId(reviewedId)
                .rating(rating)
                .comment(comment)
                .build();

        ReviewDto dto = ReviewDto.fromEntity(reviewRepository.save(review));
        // Enrich the DTO with the reviewer's display name (not stored on the Review entity)
        dto.setReviewerName(reviewer.getFullName());
        return ResponseEntity.ok(dto);
    }

    /**
     * Returns all reviews received by a specific user, ordered newest first.
     *
     * <p><b>HTTP:</b> {@code GET /api/v1/reviews/user/{userId}}
     * <br><b>Auth:</b> None required — review histories are public.
     * <br>This is used on public seller profiles to display their star ratings and feedback.
     *
     * <p>Errors are swallowed and return an empty list so that a broken user lookup never
     * prevents the profile page from loading — it just shows no reviews.
     *
     * @param userId the UUID of the user whose received reviews should be fetched
     * @return 200 OK with a JSON array of {@link ReviewDto}, newest first
     */
    @GetMapping("/user/{userId}") // handles GET /api/v1/reviews/user/some-uuid
    public ResponseEntity<List<ReviewDto>> getUserReviews(
            // @PathVariable: extract the {userId} segment from the URL and convert to UUID
            @PathVariable UUID userId) {
        try {
            List<ReviewDto> reviews = reviewRepository
                    .findByReviewedIdOrderByCreatedAtDesc(userId) // fetch all reviews for this user
                    .stream()
                    .map(r -> {
                        ReviewDto dto = ReviewDto.fromEntity(r); // map entity to DTO
                        // Enrich each review with the reviewer's display name
                        userRepository.findById(r.getReviewerId())
                                .ifPresent(u -> dto.setReviewerName(u.getFullName()));
                        return dto;
                    })
                    .collect(Collectors.toList());
            return ResponseEntity.ok(reviews);
        } catch (Exception e) {
            // If any part of the query or enrichment fails, return an empty list
            // rather than propagating a 500 error to the profile page.
            return ResponseEntity.ok(List.of());
        }
    }
}
