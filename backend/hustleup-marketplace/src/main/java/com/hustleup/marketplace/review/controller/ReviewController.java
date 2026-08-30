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
package com.hustleup.marketplace.review.controller;

import com.hustleup.marketplace.booking.model.Booking;
import com.hustleup.marketplace.booking.model.BookingStatus;
import com.hustleup.marketplace.booking.repository.BookingRepository;
import com.hustleup.marketplace.review.dto.ReviewDto;
import com.hustleup.marketplace.review.model.Review;
import com.hustleup.marketplace.review.repository.ReviewRepository;
import com.hustleup.marketplace.shop.model.ShopOrder;
import com.hustleup.marketplace.shop.repository.ShopOrderRepository;
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
    private final ShopOrderRepository shopOrderRepository; // verify storefront orders the same way

    /**
     * Constructor injection: Spring provides all three repository beans automatically.
     */
    public ReviewController(ReviewRepository reviewRepository, BookingRepository bookingRepository,
                            UserRepository userRepository, ShopOrderRepository shopOrderRepository) {
        this.reviewRepository = reviewRepository;
        this.bookingRepository = bookingRepository;
        this.userRepository = userRepository;
        this.shopOrderRepository = shopOrderRepository;
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
        UUID bookingId = parseId(body.get("bookingId"));
        UUID shopOrderId = parseId(body.get("shopOrderId"));
        String comment = (String) body.get("comment");  // optional; may be null

        // Rating is the one field with no safe default. A malformed or absent value used to
        // reach `(int) body.get("rating")` and throw a ClassCastException / NPE, surfacing as
        // a 500 on what is plainly a bad request.
        Object rawRating = body.get("rating");
        if (!(rawRating instanceof Number)) {
            return ResponseEntity.badRequest().body(Map.of("error", "A rating between 1 and 5 is required"));
        }
        int rating = ((Number) rawRating).intValue();
        if (rating < 1 || rating > 5) {
            return ResponseEntity.badRequest().body(Map.of("error", "A rating between 1 and 5 is required"));
        }

        // Exactly one source. Reviews are earned by a specific transaction, so a request that
        // names neither has nothing to prove the reviewer ever dealt with the seller, and one
        // that names both is ambiguous about which transaction is being spent.
        if ((bookingId == null) == (shopOrderId == null)) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "A review must reference exactly one booking or shop order"));
        }

        UUID reviewedId;

        if (bookingId != null) {
            Booking booking = bookingRepository.findById(bookingId)
                    .orElseThrow(() -> new RuntimeException("Booking not found"));

            // Rule 1: Only completed bookings can be reviewed.
            // This prevents buyers from reviewing a seller they never actually transacted with.
            if (booking.getStatus() != BookingStatus.COMPLETED) {
                // ResponseEntity.badRequest() returns HTTP 400 — a client error (invalid input)
                return ResponseEntity.badRequest().body(Map.of("error", "Can only review completed bookings"));
            }

            // Rule 2: one review per person per booking — NOT one per booking. The old check
            // asked whether anyone had reviewed, so a seller rating their buyer silently removed
            // the buyer's ability to rate the seller, which is the review a shop page lives on.
            if (reviewRepository.existsByBookingIdAndReviewerId(bookingId, reviewer.getId())) {
                return ResponseEntity.badRequest().body(Map.of("error", "You have already reviewed this booking"));
            }

            // Determine who is being reviewed: the reviewer reviews the OTHER party in the booking.
            // If the reviewer is the seller → they review the buyer; otherwise → they review the seller.
            reviewedId = booking.getSellerId().equals(reviewer.getId())
                    ? booking.getBuyerId() : booking.getSellerId();
        } else {
            ShopOrder order = shopOrderRepository.findById(shopOrderId)
                    .orElseThrow(() -> new RuntimeException("Shop order not found"));

            // Only the buyer reviews here. A booking is a negotiation between two people and
            // both sides rate each other; a storefront sale is one-directional, and letting a
            // seller rate the customer who bought a mug would be a way to retaliate against a
            // bad review, not a reputation signal anyone benefits from.
            if (!order.getBuyerId().equals(reviewer.getId())) {
                return ResponseEntity.status(403).body(Map.of("error", "You can only review your own orders"));
            }

            // FULFILLED, not PAID: paying starts the transaction, and the thing being rated is
            // whether the seller actually delivered. Rating at PAID would let someone score a
            // seller for an order that had not shipped.
            if (order.getStatus() != ShopOrder.ShopOrderStatus.FULFILLED) {
                return ResponseEntity.badRequest().body(Map.of(
                        "error", "You can review an order once the seller has marked it fulfilled"));
            }

            if (reviewRepository.existsByShopOrderIdAndReviewerId(shopOrderId, reviewer.getId())) {
                return ResponseEntity.badRequest().body(Map.of("error", "You have already reviewed this order"));
            }

            reviewedId = order.getSellerId();
        }

        // Nobody reviews themselves. The booking path can reach this when a seller buys
        // through their own listing, and the storefront path when they order from their own
        // shop — both are ways to write yourself a five-star review, and the rating is what
        // the shop card, the profile and the leaderboard are all built on.
        if (reviewedId.equals(reviewer.getId())) {
            return ResponseEntity.badRequest().body(Map.of("error", "You cannot review yourself"));
        }

        // Build and save the review entity
        Review review = Review.builder()
                .bookingId(bookingId)
                .shopOrderId(shopOrderId)
                .reviewerId(reviewer.getId())
                .reviewedId(reviewedId)
                .rating(rating)
                .comment(comment)
                .build();

        ReviewDto dto = ReviewDto.fromEntity(reviewRepository.save(review));
        // Enrich the DTO with the reviewer's display name (not stored on the Review entity)
        dto.setReviewerName(reviewer.displayName());
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
                                .ifPresent(u -> dto.setReviewerName(u.displayName()));
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

    /**
     * Reads an optional UUID out of the request body.
     *
     * <p>Returns null for absent, blank and unparseable values alike. The caller decides what
     * a missing id means; the alternative — {@code UUID.fromString((String) body.get(...))} —
     * threw on every one of those cases and surfaced as a 500.
     */
    private static UUID parseId(Object raw) {
        if (!(raw instanceof String str) || str.isBlank()) return null;
        try {
            return UUID.fromString(str.trim());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
