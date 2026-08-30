package com.hustleup.social.repository;

import com.hustleup.social.model.Community;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/** Data access for member-created communities. */
@Repository
public interface CommunityRepository extends JpaRepository<Community, String> {

    /** Browse order: the busiest communities first, ties broken by newest. */
    List<Community> findAllByOrderByMemberCountDescCreatedAtDesc();

    /** Communities are addressable by their readable slug as well as their id. */
    Optional<Community> findBySlug(String slug);

    boolean existsBySlug(String slug);

    /** Resolves a batch of ids in one query — used to label posts in the joined feed. */
    List<Community> findByIdIn(List<String> ids);
}
