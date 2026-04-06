/**
 * Business logic service for {@link com.hustleup.social.model.Story} entities.
 *
 * <p>This service encapsulates all story lifecycle operations: creating, retrieving,
 * liking, unliking, viewing, deleting, and automatic expiration cleanup.  Placing this
 * logic in a {@code @Service} class rather than directly in the controller provides
 * several benefits:
 * <ul>
 *   <li><b>Testability</b> — the business logic can be unit-tested without an HTTP layer.</li>
 *   <li><b>Reusability</b> — multiple controllers or scheduled tasks can call the same logic.</li>
 *   <li><b>Transaction boundary</b> — {@code @Transactional} ensures atomicity; either all
 *       database changes in a method succeed or all are rolled back.</li>
 * </ul>
 *
 * <h2>Scheduled cleanup</h2>
 * Stories are ephemeral — they expire after a configurable number of hours (default: 24).
 * The {@link #cleanupExpiredStories} method is annotated with {@code @Scheduled} to run
 * automatically every hour, deleting all expired rows from the database.
 * Spring's scheduling infrastructure must be enabled (via {@code @EnableScheduling})
 * elsewhere in the application.
 *
 * <h2>Race condition handling</h2>
 * The like and view methods use {@code try/catch} around
 * {@link org.springframework.dao.DataIntegrityViolationException} to handle the case
 * where two requests from the same user arrive simultaneously and both attempt to insert
 * a like/view row.  The second insert will fail the unique constraint; we catch it and
 * treat it as a no-op.  The {@code flush()} call forces Hibernate to send the INSERT
 * to the database immediately (within the transaction) so the constraint is checked
 * before we attempt to update the counter.
 */
package com.hustleup.social.service;

import com.hustleup.social.model.Story;
import com.hustleup.social.model.StoryLike;
import com.hustleup.social.model.StoryView;
import com.hustleup.social.repository.StoryLikeRepository;
import com.hustleup.social.repository.StoryRepository;
import com.hustleup.social.repository.StoryViewRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

// @Service: marks this class as a Spring-managed service bean.
// Spring will create a singleton instance and inject it wherever it's needed.
@Service

// @RequiredArgsConstructor: Lombok generates a constructor for all final fields,
// enabling Spring's constructor injection without boilerplate.
@RequiredArgsConstructor

// @Slf4j: Lombok injects a private static final Logger named "log" for structured logging.
@Slf4j
public class StoryService {

    // ── Dependencies ──────────────────────────────────────────────────────────

    /** JPA repository for Story entities — provides save, findById, delete, etc. */
    private final StoryRepository storyRepository;

    /** JPA repository for StoryLike join-table records — used to track which users liked which stories. */
    private final StoryLikeRepository storyLikeRepository;

    /** JPA repository for StoryView join-table records — used to track which users viewed which stories. */
    private final StoryViewRepository storyViewRepository;

    /**
     * The number of hours a story remains active before expiring.
     *
     * <p>{@code @Value} injects a value from the application's configuration
     * ({@code application.properties} or environment variables).
     * The syntax {@code :24} provides a default value of 24 if the property is not set.
     * This makes it easy to change the expiration duration in different environments
     * (e.g. a shorter TTL in development for testing).
     */
    @Value("${app.stories.expiration-hours:24}")
    private int storyExpirationHours;

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Saves a new story to the database, setting defaults if not already present.
     *
     * <p>{@code @Transactional} wraps the entire method in a database transaction:
     * if anything fails, all changes are rolled back.  This is important here because
     * we may set multiple fields before saving.
     *
     * <p>The method initialises:
     * <ul>
     *   <li>{@code expires_at} — set to now + {@link #storyExpirationHours} if not already set.</li>
     *   <li>{@code likes_count} — defaulted to 0 if null.</li>
     *   <li>{@code views_count} — defaulted to 0 if null.</li>
     * </ul>
     *
     * @param story the Story entity to persist (should have id, authorId, type set)
     * @return the saved Story entity (with database-generated fields populated)
     */
    @Transactional
    public Story saveStory(Story story) {
        // Set expiration if the caller didn't specify one.
        if (story.getExpiresAt() == null) {
            story.setExpiresAt(LocalDateTime.now().plusHours(storyExpirationHours));
        }
        // Ensure counters start at 0, not null (null would break client JSON parsing).
        if (story.getLikesCount() == null) {
            story.setLikesCount(0);
        }
        if (story.getViewsCount() == null) {
            story.setViewsCount(0);
        }
        return storyRepository.save(story);
    }

    /**
     * Returns all currently active (non-expired) stories, ordered newest first.
     *
     * <p>Active means {@code expires_at > NOW()}.  The repository method handles
     * the timestamp filtering.
     *
     * @return list of active stories, newest first
     */
    public List<Story> getActiveStories() {
        return storyRepository.findByExpiresAtAfterOrderByCreatedAtDesc(LocalDateTime.now());
    }

    /**
     * Returns active stories by a specific author.
     *
     * <p>Used when viewing a user's profile stories section.
     *
     * @param authorId the UUID string of the story author
     * @return list of the author's active stories, newest first
     */
    public List<Story> getActiveStoriesByAuthor(String authorId) {
        return storyRepository.findByAuthorIdAndExpiresAtAfterOrderByCreatedAtDesc(authorId, LocalDateTime.now());
    }

    /**
     * Loads a single story by ID, throwing if not found.
     *
     * <p>Note: does not check if the story is expired — callers that need to enforce
     * expiry should check {@code story.getExpiresAt()} themselves.
     *
     * @param id the UUID string of the story to load
     * @return the Story entity
     * @throws IllegalArgumentException if no story with the given ID exists
     */
    public Story getStory(String id) {
        return storyRepository.findById(id)
                // Throw IllegalArgumentException (not RuntimeException) so the controller
                // can map it to a specific HTTP 404 response.
                .orElseThrow(() -> new IllegalArgumentException("Story not found with id: " + id));
    }

    /**
     * Deletes a story by ID.
     *
     * <p>{@code @Transactional} ensures that if the delete fails, no partial state is committed.
     *
     * @param id the UUID string of the story to delete
     */
    @Transactional
    public void deleteStory(String id) {
        storyRepository.deleteById(id);
        log.info("Story deleted: {}", id);
    }

    /**
     * Scheduled task that deletes all expired stories from the database.
     *
     * <p>{@code @Scheduled(fixedRate = 3600000)} runs this method every 3,600,000 milliseconds
     * (= 1 hour) after the previous execution completes.  Spring's task scheduler calls this
     * automatically — no manual invocation needed.
     *
     * <p>Why is cleanup needed? Because stories are only soft-filtered by {@code expires_at}
     * in read queries.  Without cleanup, the table would grow indefinitely.  The scheduled
     * job performs a hard DELETE to reclaim storage.
     *
     * <p>{@code @Transactional} wraps the bulk delete in a transaction.
     */
    @Scheduled(fixedRate = 3600000) // Every hour (3,600,000 ms = 60 min × 60 sec × 1000 ms)
    @Transactional
    public void cleanupExpiredStories() {
        try {
            LocalDateTime now = LocalDateTime.now();
            // deleteByExpiresAtBefore returns the count of deleted rows for logging.
            long deletedCount = storyRepository.deleteByExpiresAtBefore(now);
            log.info("Cleanup task: Deleted {} expired stories", deletedCount);
        } catch (Exception e) {
            // Log the error but don't re-throw — a cleanup failure should not crash the app.
            log.error("Error during story cleanup task", e);
        }
    }

    /**
     * Records a like for a story by a user, incrementing the like counter.
     *
     * <p>Idempotent: if the user has already liked the story, this is a no-op.
     * The idempotency is enforced in two layers:
     * <ol>
     *   <li>Application check: {@code existsById(likeId)} before inserting.</li>
     *   <li>Database constraint: the composite primary key rejects duplicate rows.</li>
     * </ol>
     *
     * <p>The {@code flush()} call forces Hibernate to send the INSERT to the DB
     * immediately, so any constraint violation is caught within this transaction
     * rather than at commit time when it would be harder to handle.
     *
     * @param storyId the UUID string of the story to like
     * @param userId  the UUID string of the user who is liking
     * @return the updated Story entity with the incremented like count
     */
    @Transactional
    public Story likeStory(String storyId, String userId) {
        Story story = getStory(storyId);
        StoryLike.StoryLikeId likeId = new StoryLike.StoryLikeId(storyId, userId);

        try {
            if (!storyLikeRepository.existsById(likeId)) {
                // Insert the like record.
                StoryLike storyLike = new StoryLike();
                storyLike.setId(likeId);
                storyLikeRepository.save(storyLike);
                storyLikeRepository.flush(); // Force immediate flush to catch constraint violations

                // Increment the denormalised counter on the story row.
                int currentCount = story.getLikesCount() != null ? story.getLikesCount() : 0;
                story.setLikesCount(currentCount + 1);
                story = storyRepository.save(story);
                log.debug("Story liked: storyId={}, userId={}, newLikeCount={}", storyId, userId, story.getLikesCount());
            }
        } catch (org.springframework.dao.DataIntegrityViolationException e) {
            // Two concurrent requests from the same user both tried to insert a like row.
            // The second one hit the unique constraint — treat it as an already-liked no-op.
            log.debug("Story already liked by this user: storyId={}, userId={}", storyId, userId);
        }
        return story;
    }

    /**
     * Removes a like for a story by a user, decrementing the like counter.
     *
     * <p>Idempotent: if the user has not liked the story, this is a no-op.
     * The like count is guarded by {@code Math.max(0, ...)} to prevent going negative
     * due to data inconsistency.
     *
     * @param storyId the UUID string of the story to unlike
     * @param userId  the UUID string of the user who is unliking
     * @return the updated Story entity with the decremented like count
     */
    @Transactional
    public Story unlikeStory(String storyId, String userId) {
        Story story = getStory(storyId);
        // Build the composite key manually (can't use the all-args constructor here
        // because we need to set fields on a new instance).
        StoryLike.StoryLikeId likeId = new StoryLike.StoryLikeId();
        likeId.setStoryId(storyId);
        likeId.setUserId(userId);

        if (storyLikeRepository.existsById(likeId)) {
            storyLikeRepository.deleteById(likeId);

            // Decrement but never go below 0 (data inconsistency safety guard).
            int currentCount = story.getLikesCount() != null ? story.getLikesCount() : 0;
            story.setLikesCount(Math.max(0, currentCount - 1));
            story = storyRepository.save(story);
            log.debug("Story unliked: storyId={}, userId={}, newLikeCount={}", storyId, userId, story.getLikesCount());
        }
        return story;
    }

    /**
     * Records a view of a story by a user, incrementing the view counter.
     *
     * <p>Idempotent: each user's view is counted only once, regardless of how many
     * times they open the story.  Duplicate-view detection uses the same two-layer
     * strategy as like detection (application + DB constraint).
     *
     * <p>Catches {@link org.springframework.dao.DataIntegrityViolationException} and
     * also {@link org.springframework.dao.DeadlockLoserDataAccessException} because
     * concurrent view requests from the same user can cause a deadlock in MySQL when
     * both transactions try to update the views_count row.
     *
     * @param storyId the UUID string of the story being viewed
     * @param userId  the UUID string of the viewer
     * @return the updated Story entity with the incremented view count
     */
    @Transactional
    public Story viewStory(String storyId, String userId) {
        Story story = getStory(storyId);
        StoryView.StoryViewId viewId = new StoryView.StoryViewId(storyId, userId);

        try {
            // Try to save the view — if it already exists, the unique constraint prevents duplicate.
            if (!storyViewRepository.existsById(viewId)) {
                StoryView storyView = new StoryView();
                storyView.setId(viewId);
                storyViewRepository.save(storyView);
                storyViewRepository.flush(); // Force immediate flush to catch constraint violations

                // Increment the denormalised view counter.
                int currentCount = story.getViewsCount() != null ? story.getViewsCount() : 0;
                story.setViewsCount(currentCount + 1);
                story = storyRepository.save(story);
                log.debug("Story viewed: storyId={}, userId={}, newViewCount={}", storyId, userId, story.getViewsCount());
            }
        } catch (org.springframework.dao.DataIntegrityViolationException |
                 org.springframework.dao.CannotAcquireLockException |
                 org.springframework.dao.DeadlockLoserDataAccessException e) {
            // Duplicate view or deadlock — the view was already counted. Silently ignore.
            log.debug("Story view skipped (duplicate or deadlock): storyId={}, userId={}", storyId, userId);
        }
        return story;
    }
}
