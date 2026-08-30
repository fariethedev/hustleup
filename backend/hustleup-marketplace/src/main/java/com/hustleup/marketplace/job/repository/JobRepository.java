package com.hustleup.marketplace.job.repository;

import com.hustleup.marketplace.job.model.Job;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/** Data access for job adverts. */
@Repository
public interface JobRepository extends JpaRepository<Job, UUID> {

    /**
     * The public board: open, unexpired adverts, newest first, with optional category and
     * free-text filters.
     *
     * <p>Both filters are "null means don't filter", expressed as {@code :param IS NULL OR
     * ...} so one query serves every combination the board can ask for instead of four
     * near-identical methods. The search matches title, company and description because
     * users type all three into that box.
     */
    @Query("""
           SELECT j FROM Job j
           WHERE j.status = com.hustleup.marketplace.job.model.Job$JobStatus.OPEN
             AND (j.expiresAt IS NULL OR j.expiresAt > :now)
             AND (:category IS NULL OR j.category = :category)
             AND (:q IS NULL OR LOWER(j.title) LIKE %:q%
                             OR LOWER(j.companyName) LIKE %:q%
                             OR LOWER(j.description) LIKE %:q%)
           ORDER BY j.createdAt DESC
           """)
    Page<Job> findBoard(LocalDateTime now, String category, String q, Pageable pageable);

    /** Everything one company has posted, any state — their "manage adverts" view. */
    List<Job> findByPublisherUserIdOrderByCreatedAtDesc(UUID publisherUserId);

    /** Admin/moderation view of everything ever posted. */
    List<Job> findAllByOrderByCreatedAtDesc();

    long countByStatus(Job.JobStatus status);

    /**
     * Whether an imported advert is already stored.
     *
     * <p>The dedupe check behind every import run. A job board re-serves the same adverts
     * on every query, so without this each run would duplicate the whole result set.
     */
    boolean existsByExternalId(String externalId);

    /**
     * Imported adverts older than a cut-off.
     *
     * <p>Aggregated jobs go stale fast and nothing here can tell when one is filled — the
     * board simply stops returning it. Dropping old ones is the only way to keep the board
     * from filling with roles that no longer exist. Native adverts are excluded: those are
     * their employer's to close.
     */
    List<Job> findBySourceNameIsNotNullAndCreatedAtBefore(java.time.LocalDateTime before);
}
