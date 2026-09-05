package com.hustleup.marketplace.feedback.repository;

import com.hustleup.marketplace.feedback.model.PlatformFeedback;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

/** Storage for {@link PlatformFeedback}. Written by sellers, read only by admins. */
public interface PlatformFeedbackRepository extends JpaRepository<PlatformFeedback, UUID> {

    /**
     * Whether this person has already answered for this sale.
     *
     * <p>The prompt is fire-and-forget on the client, and a seller who completes an order on
     * two devices, or reloads mid-submit, would otherwise leave two answers about the same
     * sale and quietly skew the average.
     */
    boolean existsByUserIdAndBookingId(UUID userId, UUID bookingId);

    /** Newest first, for the admin view. */
    List<PlatformFeedback> findAllByOrderByCreatedAtDesc();

    /**
     * Average score and count in one query.
     *
     * <p>Returns {@code [avg, count]}; avg is null when nothing has been submitted, because
     * SQL {@code AVG()} over an empty set is NULL — callers substitute zero rather than
     * printing "NaN out of 5".
     */
    @Query("SELECT AVG(f.rating), COUNT(f) FROM PlatformFeedback f")
    List<Object[]> summary();
}
