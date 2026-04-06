/**
 * JPA entity representing a "like" on a {@link Story}.
 *
 * <p>Follows the same composite-primary-key design as {@link PostLike}: the natural key
 * ({@code story_id}, {@code user_id}) serves as the primary key via {@code @EmbeddedId},
 * preventing duplicate likes at the database level without a separate unique constraint.
 *
 * <h2>Table: {@code story_likes}</h2>
 *
 * <h2>Why a separate table for story likes vs. post likes?</h2>
 * Story likes are intentionally separated from post likes because:
 * <ul>
 *   <li>Stories are ephemeral and their likes can be bulk-deleted with them.</li>
 *   <li>The schema stays normalised and queries remain simple.</li>
 *   <li>Analytics on story engagement vs. post engagement can be queried independently.</li>
 * </ul>
 *
 * <h2>{@code equals} and {@code hashCode}</h2>
 * The embedded ID class manually implements {@link #equals} and {@link #hashCode}
 * based on both fields.  This is required for JPA composite keys to work correctly —
 * Hibernate uses these methods internally for entity identity comparisons and caching.
 */
package com.hustleup.social.model;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import java.io.Serializable;
import java.time.LocalDateTime;

// @Entity maps this class to the story_likes table.
@Entity
@Table(name = "story_likes")
public class StoryLike {

    /**
     * The composite primary key (story_id + user_id).
     * Using @EmbeddedId allows Spring Data to use the full key object in
     * methods like existsById() and deleteById().
     */
    @EmbeddedId
    private StoryLikeId id;

    /**
     * Timestamp of when the like was recorded.
     * Set automatically by Hibernate; not updatable after creation.
     */
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    /** No-args constructor required by JPA. */
    public StoryLike() {}

    /** Returns the composite primary key object. */
    public StoryLikeId getId() { return id; }
    /** Sets the composite primary key (must be set before saving). */
    public void setId(StoryLikeId id) { this.id = id; }

    /** Returns the timestamp of when the like was recorded. */
    public LocalDateTime getCreatedAt() { return createdAt; }
    /** Allows override of the creation timestamp (e.g. for tests). */
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    /**
     * Composite primary key for {@link StoryLike}.
     *
     * <p>{@code @Embeddable} means the fields of this class are "inlined" into the
     * parent entity's table — there is no separate table for this key class.
     *
     * <p>Must implement {@link Serializable} (a JPA requirement for all ID types).
     * Must implement {@link #equals} and {@link #hashCode} so Hibernate can correctly
     * identify and compare key objects in its session cache.
     */
    @Embeddable
    public static class StoryLikeId implements Serializable {

        /** The UUID string of the story that was liked. */
        @Column(name = "story_id", columnDefinition = "VARCHAR(36)")
        private String storyId;

        /** The UUID string of the user who liked the story. */
        @Column(name = "user_id", columnDefinition = "VARCHAR(36)")
        private String userId;

        /** No-args constructor required by JPA for reflective instantiation. */
        public StoryLikeId() {}

        /**
         * Convenience constructor for inline creation:
         * {@code new StoryLike.StoryLikeId(storyId, userId)}.
         *
         * @param storyId the story's UUID string
         * @param userId  the user's UUID string
         */
        public StoryLikeId(String storyId, String userId) {
            this.storyId = storyId;
            this.userId = userId;
        }

        /** Returns the story UUID string. */
        public String getStoryId() { return storyId; }
        /** Sets the story UUID string. */
        public void setStoryId(String storyId) { this.storyId = storyId; }

        /** Returns the user UUID string. */
        public String getUserId() { return userId; }
        /** Sets the user UUID string. */
        public void setUserId(String userId) { this.userId = userId; }

        /**
         * Equality is based on both fields.  Two IDs are equal only if both the story
         * and the user match — needed for Hibernate's internal entity identity checks.
         */
        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (o == null || getClass() != o.getClass()) return false;
            StoryLikeId that = (StoryLikeId) o;
            return java.util.Objects.equals(storyId, that.storyId) &&
                   java.util.Objects.equals(userId, that.userId);
        }

        /**
         * Hash code consistent with equals — uses both fields.
         * Required whenever equals() is overridden.
         */
        @Override
        public int hashCode() {
            return java.util.Objects.hash(storyId, userId);
        }
    }
}
