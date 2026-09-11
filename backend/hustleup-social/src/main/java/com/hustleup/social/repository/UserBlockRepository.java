package com.hustleup.social.repository;

import com.hustleup.social.model.UserBlock;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface UserBlockRepository extends JpaRepository<UserBlock, UUID> {

    boolean existsByBlockerIdAndBlockedId(UUID blockerId, UUID blockedId);

    Optional<UserBlock> findByBlockerIdAndBlockedId(UUID blockerId, UUID blockedId);

    /**
     * Everyone this person has blocked, most recent first.
     *
     * <p>Blocking was write-only: you could block someone from their profile and never see
     * the list again, so the only way to undo one was to remember who it was and navigate
     * back to them. A setting you cannot review is a setting you cannot change your mind
     * about.
     */
    java.util.List<UserBlock> findByBlockerIdOrderByCreatedAtDesc(UUID blockerId);
}
