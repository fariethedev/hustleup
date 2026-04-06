/**
 * Spring Data JPA repository for {@link Review} entities.
 *
 * <p>Extending {@link JpaRepository}{@code <Review, UUID>} gives full CRUD support out of
 * the box. The additional methods declared here cover the two main use cases:
 * <ol>
 *   <li>Fetching all reviews written about a specific user (for their public profile)</li>
 *   <li>Aggregating review statistics (average rating, count) used in listing and
 *       recommendation scoring</li>
 * </ol>
 *
 * <p>The aggregation query ({@link #averageRatingForUser}) returns a {@link Double} rather
 * than a primitive {@code double} so that it can be {@code null} when a user has no reviews
 * yet — callers check for null and fall back to 0.0.
 */
package com.hustleup.review.repository;

import com.hustleup.review.model.Review;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.UUID;

// JpaRepository<Review, UUID>: manages Review entities with UUID primary keys.
public interface ReviewRepository extends JpaRepository<Review, UUID> {

    /**
     * Returns all reviews written <em>about</em> a specific user, newest first.
     *
     * <p>Spring derives the query from the method name:
     * {@code findBy} + {@code ReviewedId} (field) + {@code OrderByCreatedAtDesc} (sort).
     * Used to display a user's review feed on their public profile page.
     *
     * @param reviewedId the UUID of the user who was reviewed
     * @return list of reviews received by this user, sorted by creation date descending
     */
    List<Review> findByReviewedIdOrderByCreatedAtDesc(UUID reviewedId);

    /**
     * Checks whether a review already exists for a given booking.
     *
     * <p>Used as a guard in the review creation endpoint to enforce the "one review per
     * booking" rule at the application level (in addition to the database UNIQUE constraint).
     * Returning early from the application layer gives a more descriptive error message than
     * the constraint violation would.
     *
     * @param bookingId the UUID of the booking to check
     * @return {@code true} if a review has already been submitted for this booking
     */
    boolean existsByBookingId(UUID bookingId);

    /**
     * Counts the total number of reviews received by a user.
     *
     * <p>Used to display the review count on listing cards and seller profiles, and as
     * part of the quality score in the recommendation algorithm.
     *
     * @param reviewedId the UUID of the user who was reviewed
     * @return the number of reviews this user has received
     */
    int countByReviewedId(UUID reviewedId);

    /**
     * Computes the average star rating for all reviews received by a specific user.
     *
     * <p>Uses a JPQL {@code AVG()} aggregate function. Unlike Spring's derived query
     * feature, aggregation functions require an explicit {@code @Query} annotation because
     * Spring cannot infer them from the method name alone.
     *
     * <p>Returns {@code null} (not 0.0) when the user has received no reviews at all,
     * because {@code AVG()} of an empty set is SQL NULL. Callers should check for null
     * and substitute a default of 0.0.
     *
     * @param userId the UUID of the user whose reviews are averaged
     * @return the average rating as a {@link Double}, or {@code null} if no reviews exist
     */
    @Query("SELECT AVG(r.rating) FROM Review r WHERE r.reviewedId = :userId")
    Double averageRatingForUser(@Param("userId") UUID userId);
}
