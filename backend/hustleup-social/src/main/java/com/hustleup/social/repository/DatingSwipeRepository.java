package com.hustleup.social.repository;

import com.hustleup.social.model.DatingSwipe;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DatingSwipeRepository extends JpaRepository<DatingSwipe, UUID> {

    Optional<DatingSwipe> findBySwiperIdAndTargetId(UUID swiperId, UUID targetId);

    /** Every profile this user has already swiped on (either direction) — excluded from future discovery. */
    List<DatingSwipe> findBySwiperId(UUID swiperId);

    /** Used to detect a mutual like: has {@code targetId} already liked {@code swiperId} back? */
    boolean existsBySwiperIdAndTargetIdAndAction(UUID swiperId, UUID targetId, String action);
}
