package com.hustleup.social.repository;

import com.hustleup.social.model.DatingSwipe;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DatingSwipeRepository extends JpaRepository<DatingSwipe, UUID> {

    Optional<DatingSwipe> findBySwiperIdAndTargetId(UUID swiperId, UUID targetId);

    /** Every profile this user has already swiped on (either direction) — excluded from future discovery. */
    List<DatingSwipe> findBySwiperId(UUID swiperId);

    /**
     * Used to detect a mutual like: has {@code targetId} already liked {@code swiperId} back?
     *
     * <p>Takes a collection rather than a single action so a super like counts as a like — a
     * plain {@code …AndAction(…, "LIKE")} would miss a match where the other side super liked
     * first, silently swallowing the most enthusiastic swipe in the app.
     */
    boolean existsBySwiperIdAndTargetIdAndActionIn(UUID swiperId, UUID targetId, Collection<String> actions);

    /** The swipe a rewind undoes — the most recent one this user made. */
    Optional<DatingSwipe> findFirstBySwiperIdOrderByCreatedAtDesc(UUID swiperId);

    /** Everyone who has already liked (or super liked) this user — powers the "likes you" badge. */
    List<DatingSwipe> findByTargetIdAndActionIn(UUID targetId, Collection<String> actions);
}
