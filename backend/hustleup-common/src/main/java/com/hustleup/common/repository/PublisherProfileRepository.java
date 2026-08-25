package com.hustleup.common.repository;

import com.hustleup.common.model.PublisherProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Data access for {@link PublisherProfile}.
 *
 * <p>Lives in {@code hustleup-common} because three services need it: auth (apply + admin
 * review), marketplace (gate job posting) and social (gate article publishing).
 */
@Repository
public interface PublisherProfileRepository extends JpaRepository<PublisherProfile, UUID> {

    /**
     * The caller's application of a given kind, whatever state it is in.
     *
     * <p>Used both by the "what's my status?" endpoint and by the posting gates — the
     * gates then check {@link PublisherProfile#isActive()} rather than merely that a row
     * exists, so a PENDING or SUSPENDED publisher cannot post.
     */
    Optional<PublisherProfile> findByUserIdAndType(UUID userId, PublisherProfile.PublisherType type);

    /** Every application this user has made, across both types. */
    List<PublisherProfile> findByUserId(UUID userId);

    /** The admin review queue, filtered by state and ordered oldest-first so nobody is starved. */
    List<PublisherProfile> findByStatusOrderByAppliedAtAsc(PublisherProfile.PublisherStatus status);

    /** All applications, newest decision activity first — the admin "all" tab. */
    List<PublisherProfile> findAllByOrderByAppliedAtDesc();

    /** Approved publishers of one kind — powers the public "verified companies" directory. */
    List<PublisherProfile> findByTypeAndStatus(PublisherProfile.PublisherType type,
                                               PublisherProfile.PublisherStatus status);

    /** How many applications sit in a given state — for the admin dashboard counters. */
    long countByStatus(PublisherProfile.PublisherStatus status);
}
