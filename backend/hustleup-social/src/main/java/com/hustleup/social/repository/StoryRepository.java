/**
 * Spring Data JPA repository for {@link com.hustleup.social.model.Story} entities.
 *
 * <p>Provides the data-access layer for ephemeral stories.  The most important
 * design aspect here is that stories have an {@code expires_at} column — queries
 * that retrieve "active" stories must filter by this timestamp.
 *
 * <h2>Key concepts</h2>
 * <ul>
 *   <li><b>Active stories</b> are those where {@code expires_at > NOW()}.</li>
 *   <li>Expired stories are left in the database until the scheduled cleanup job
 *       in {@link com.hustleup.social.service.StoryService} runs (every hour).</li>
 *   <li>The {@link #deleteByExpiresAtBefore} method is transactional bulk-delete
 *       used by that cleanup job.</li>
 * </ul>
 *
 * <h2>Derived query method naming</h2>
 * {@code findByExpiresAtAfterOrderByCreatedAtDesc} breaks down as:
 * <ul>
 *   <li>{@code findBy} — SELECT statement</li>
 *   <li>{@code ExpiresAt} — filter on the {@code expires_at} column</li>
 *   <li>{@code After} — the SQL condition is {@code > ?} (strictly after the parameter)</li>
 *   <li>{@code OrderByCreatedAt} — ORDER BY {@code created_at}</li>
 *   <li>{@code Desc} — descending (newest first)</li>
 * </ul>
 */
package com.hustleup.social.repository;

import com.hustleup.social.model.Story;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDateTime;
import java.util.List;

public interface StoryRepository extends JpaRepository<Story, String> {

    /**
     * Returns all active (non-expired) stories, newest first.
     *
     * <p>"After" means {@code expires_at > now}, so only stories whose expiration
     * is in the future are returned.  Passing {@code LocalDateTime.now()} as the
     * parameter retrieves the currently visible stories.
     *
     * <p>Spring Data generates:
     * {@code SELECT * FROM stories WHERE expires_at > ? ORDER BY created_at DESC}
     *
     * @param now the current timestamp (filter boundary); stories expiring after this are included
     * @return list of active stories, ordered by creation time descending
     */
    List<Story> findByExpiresAtAfterOrderByCreatedAtDesc(LocalDateTime now);

    /**
     * Returns active stories by a specific author, newest first.
     *
     * <p>Used to display a specific user's active stories on their profile page.
     *
     * <p>Spring Data generates:
     * {@code SELECT * FROM stories WHERE author_id = ? AND expires_at > ? ORDER BY created_at DESC}
     *
     * @param authorId the UUID string of the story author
     * @param now      the current timestamp; only stories expiring after this are included
     * @return list of the author's active stories, newest first
     */
    List<Story> findByAuthorIdAndExpiresAtAfterOrderByCreatedAtDesc(String authorId, LocalDateTime now);

    /**
     * Deletes all stories that expired before the given timestamp, in bulk.
     *
     * <p>Called hourly by the {@link com.hustleup.social.service.StoryService#cleanupExpiredStories}
     * scheduled task.  Returns the number of rows deleted for logging purposes.
     *
     * <p>Spring Data generates:
     * {@code DELETE FROM stories WHERE expires_at < ?}
     *
     * <p>"Before" means {@code expires_at < now} — stories that should have been
     * gone by now.  This is the complement of the "After" filter above.
     *
     * @param now the current timestamp; stories with expires_at before this are deleted
     * @return the number of story rows that were deleted
     */
    long deleteByExpiresAtBefore(LocalDateTime now);
}
