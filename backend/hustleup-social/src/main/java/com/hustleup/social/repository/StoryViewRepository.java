/**
 * Spring Data JPA repository for {@link com.hustleup.social.model.StoryView} entities.
 *
 * <p>Provides data-access operations for story view records.  Each row represents
 * exactly one view of one story by one user (enforced by the composite primary key).
 *
 * <h2>Composite key</h2>
 * The entity's ID is {@link com.hustleup.social.model.StoryView.StoryViewId},
 * a composite of ({@code story_id}, {@code user_id}).  Spring Data uses this in
 * {@code existsById} and {@code save} operations.
 *
 * <h2>{@code @Repository} annotation</h2>
 * {@code @Repository} is technically not needed here because Spring Data auto-detects
 * interfaces extending {@code JpaRepository} and registers them as beans.  It is
 * included as documentation — it makes the role of this interface explicit when
 * reading the code.
 */
package com.hustleup.social.repository;

import com.hustleup.social.model.StoryView;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

// @Repository: marks this as a Spring-managed data-access bean (technically optional here,
// but adds clarity and enables Spring's exception translation for persistence exceptions).
@Repository
public interface StoryViewRepository extends JpaRepository<StoryView, StoryView.StoryViewId> {

    /**
     * Counts the total number of unique views on a specific story.
     *
     * <p>Each row in story_views represents one unique viewer, so the count is also the
     * number of unique viewers.  Used for the view counter display on a story.
     *
     * <p>Spring Data generates:
     * {@code SELECT COUNT(*) FROM story_views WHERE story_id = ?}
     *
     * @param storyId the UUID string of the story to count views for
     * @return the number of unique users who have viewed this story
     */
    long countByIdStoryId(String storyId);

    /**
     * Batch-loads all view records for a specific user across a list of story IDs.
     *
     * <p>Used by {@link com.hustleup.social.controller.StoryController#getActiveStories}
     * to determine which stories the current user has already seen — in a single
     * query instead of one-per-story (avoiding the N+1 query problem).
     *
     * <p>Spring Data generates:
     * {@code SELECT * FROM story_views WHERE user_id = ? AND story_id IN (?,...)}
     *
     * @param userId   the UUID string of the user
     * @param storyIds list of story UUID strings to check view status for
     * @return list of StoryView records for that user among those stories
     */
    List<StoryView> findByIdUserIdAndIdStoryIdIn(String userId, List<String> storyIds);
}
