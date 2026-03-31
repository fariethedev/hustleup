package com.hustleup.review.repository;

import com.hustleup.review.model.Review;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.UUID;

public interface ReviewRepository extends JpaRepository<Review, UUID> {
    List<Review> findByReviewedIdOrderByCreatedAtDesc(UUID reviewedId);

    boolean existsByBookingId(UUID bookingId);

    int countByReviewedId(UUID reviewedId);

    @Query("SELECT AVG(r.rating) FROM Review r WHERE r.reviewedId = :userId")
    Double averageRatingForUser(@Param("userId") UUID userId);
}
