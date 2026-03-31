package com.hustleup.social.repository;

import com.hustleup.social.model.Follow;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;
import java.util.Optional;

public interface FollowRepository extends JpaRepository<Follow, UUID> {
    int countByFollowingId(UUID followingId);
    int countByFollowerId(UUID followerId);
    boolean existsByFollowerIdAndFollowingId(UUID followerId, UUID followingId);
    Optional<Follow> findByFollowerIdAndFollowingId(UUID followerId, UUID followingId);
}
