package com.hustleup.marketplace.feedback.controller;

import com.hustleup.common.model.User;
import com.hustleup.common.repository.UserRepository;
import com.hustleup.marketplace.feedback.model.PlatformFeedback;
import com.hustleup.marketplace.feedback.repository.PlatformFeedbackRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * How HustleSpace is doing, according to the people selling on it.
 *
 * <p>Asked once a sale completes — see {@link PlatformFeedback} for why that replaced making
 * the seller rate the buyer. Writing is open to any signed-in user; reading is admin-only,
 * and deliberately so: this is private feedback about the product, not a public review of a
 * person, and it is only honest while sellers know it is not going on their shop page.
 */
@RestController
@RequestMapping("/api/v1/feedback")
public class FeedbackController {

    private final PlatformFeedbackRepository feedbackRepository;
    private final UserRepository userRepository;

    public FeedbackController(PlatformFeedbackRepository feedbackRepository, UserRepository userRepository) {
        this.feedbackRepository = feedbackRepository;
        this.userRepository = userRepository;
    }

    private User currentUser() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null) return null;
        return userRepository.findByEmail(auth.getName()).orElse(null);
    }

    /**
     * Records one answer. <b>POST /api/v1/feedback</b>
     *
     * <p>Body: {@code {"rating": 4, "improvement": "...", "bookingId": "...", "authorRole": "SELLER"}}.
     * Only {@code rating} is required — a seller who scores the platform and says nothing
     * else has still told us something, and demanding a sentence would mostly collect
     * whitespace.
     */
    @PostMapping
    public ResponseEntity<?> submit(@RequestBody Map<String, Object> body) {
        User me = currentUser();
        if (me == null) return ResponseEntity.status(401).body(Map.of("error", "Sign in to send feedback"));

        Object rawRating = body.get("rating");
        int rating = rawRating instanceof Number ? ((Number) rawRating).intValue() : 0;
        if (rating < 1 || rating > 5) {
            return ResponseEntity.badRequest().body(Map.of("error", "Pick a rating from 1 to 5"));
        }

        UUID bookingId = null;
        Object rawBooking = body.get("bookingId");
        if (rawBooking instanceof String s && !s.isBlank()) {
            try {
                bookingId = UUID.fromString(s);
            } catch (IllegalArgumentException ignored) {
                // A malformed id is not worth refusing the feedback over — the rating is the
                // point, and the booking is only context.
            }
        }

        // Second answer about the same sale: accept it quietly rather than erroring. The
        // client fires this and moves on, so a 400 here would surface as a failure on a
        // screen the seller has already left.
        if (bookingId != null && feedbackRepository.existsByUserIdAndBookingId(me.getId(), bookingId)) {
            return ResponseEntity.ok(Map.of("recorded", false, "reason", "already answered"));
        }

        String improvement = body.get("improvement") instanceof String s ? s.trim() : null;
        String role = body.get("authorRole") instanceof String s && !s.isBlank()
                ? s.trim().toUpperCase() : "SELLER";

        feedbackRepository.save(PlatformFeedback.builder()
                .userId(me.getId())
                .bookingId(bookingId)
                .authorRole("BUYER".equals(role) ? "BUYER" : "SELLER")
                .rating(rating)
                .improvement(improvement == null || improvement.isBlank() ? null : improvement)
                .build());

        return ResponseEntity.ok(Map.of("recorded", true));
    }

    /**
     * Everything sellers have said, newest first. <b>GET /api/v1/feedback</b>
     *
     * <p>Admin-only — enforced by {@code CommonSecurityConfig}, which puts
     * {@code /api/v1/feedback} behind the ADMIN role for GET.
     */
    @GetMapping
    public ResponseEntity<?> all() {
        List<PlatformFeedback> rows = feedbackRepository.findAllByOrderByCreatedAtDesc();

        List<Map<String, Object>> out = new ArrayList<>();
        for (PlatformFeedback f : rows) {
            Map<String, Object> m = new HashMap<>();
            m.put("id", f.getId().toString());
            m.put("rating", f.getRating());
            m.put("improvement", f.getImprovement());
            m.put("authorRole", f.getAuthorRole());
            m.put("bookingId", f.getBookingId() == null ? null : f.getBookingId().toString());
            m.put("createdAt", f.getCreatedAt() == null ? null : f.getCreatedAt().toString());
            // Named so an admin can follow up, which is the whole point of reading these.
            userRepository.findById(f.getUserId()).ifPresent(u -> {
                m.put("userName", u.displayName());
                m.put("userEmail", u.getEmail());
            });
            out.add(m);
        }

        Object[] agg = feedbackRepository.summary().isEmpty() ? null : feedbackRepository.summary().get(0);
        double avg = agg != null && agg[0] != null ? ((Number) agg[0]).doubleValue() : 0.0;
        long count = agg != null && agg[1] != null ? ((Number) agg[1]).longValue() : 0L;

        return ResponseEntity.ok(Map.of(
                "average", Math.round(avg * 10.0) / 10.0,
                "count", count,
                "items", out));
    }
}
