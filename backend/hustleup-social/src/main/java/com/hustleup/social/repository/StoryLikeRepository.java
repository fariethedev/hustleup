/**
 * Spring Data JPA repository for {@link com.hustleup.social.model.StoryLike} entities.
 *
 * <p>Provides data-access operations for story like records.  Each row represents
 * exactly one like of one story by one user — enforced by the composite primary key
 * ({@code story_id}, {@code user_id}).
 *
 * <h2>Composite key</h2>
 * The entity's ID type is {@link com.hustleup.social.model.StoryLike.StoryLikeId}.
 * The inherited {@code existsById(StoryLikeId)} method is used to perform idempotency
 * checks before inserting a new like row.
 *
 * <h2>{@code @Repository} annotation</h2>
 * {@code @Repository} is optional for Spring Data interfaces (auto-detected), but
 * included here for explicitness.
 */
package com.hustleup.social.repository;

import com.hustleup.social.model.StoryLike;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

// @Repository: signals that this interface is a data-access component.
// Spring Data auto-detects it, but the annotation makes the role explicit.
@Repository
public interface StoryLikeRepository extends JpaRepository<StoryLike, StoryLike.StoryLikeId> {

    /**
     * Batch-loads all like records for a specific user across a list of story IDs.
     *
     * <p>Used by {@link com.hustleup.social.controller.StoryController#getActiveStories}
     * to determine which stories the current user has already liked — in a single
     * batch query rather than one query per story.
     *
     * <p>Spring Data generates:
     * {@code SELECT * FROM story_likes WHERE user_id = ? AND story_id IN (?,...)}
     *
     * <p>The caller then collects the storyIds from the results into a Set for O(1)
     * lookup when building each StoryDto's {@code likedByCurrentUser} flag.
     *
     * @param userId   the UUID string of the user
     * @param storyIds list of story UUID strings to check like status for
     * @return list of StoryLike records for that user among those stories
     */
    List<StoryLike> findByIdUserIdAndIdStoryIdIn(String userId, List<String> storyIds);
}
