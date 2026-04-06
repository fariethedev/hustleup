/**
 * JPA entity that records a single view of a {@link Story} by a specific user.
 *
 * <p>Each row represents "user Y viewed story X".  A unique constraint on the table
 * (and the composite primary key itself) ensures that a user's view is counted only once
 * regardless of how many times they open the story.
 *
 * <h2>Table: {@code story_views}</h2>
 *
 * <h2>Unique constraint</h2>
 * The {@code @UniqueConstraint(columnNames = {"story_id", "user_id"})} on the table
 * annotation adds an explicit database-level unique index as a safety net in addition
 * to the composite primary key (which already implies uniqueness).
 *
 * <h2>Why track views?</h2>
 * <ul>
 *   <li>Allows the story author to see a view count on their story.</li>
 *   <li>Allows the viewer's client to know which stories are "new" (unread).</li>
 *   <li>Could be used for analytics to understand story engagement over time.</li>
 * </ul>
 *
 * <h2>Timestamp field name</h2>
 * The timestamp column is named {@code viewed_at} (not {@code created_at}) to make
 * the intent of the column clear when reading raw database rows.
 */
package com.hustleup.social.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import java.io.Serializable;
import java.time.LocalDateTime;

// @Entity maps this class to the story_views table in the database.
@Entity

// The uniqueConstraints attribute adds an explicit DB-level UNIQUE index on
// (story_id, user_id), preventing duplicate view rows if the composite PK check
// somehow fails (e.g. from a concurrent insert race condition).
@Table(name = "story_views",
    uniqueConstraints = @UniqueConstraint(columnNames = {"story_id", "user_id"}))
public class StoryView {

    /**
     * The composite primary key (story_id + user_id).
     * Using @EmbeddedId means one row uniquely represents one user viewing one story.
     */
    @EmbeddedId
    private StoryViewId id;

    /**
     * Timestamp of when the view was first recorded.
     *
     * <p>Named {@code viewed_at} rather than {@code created_at} to clearly communicate
     * the semantics of the column.  Automatically set by Hibernate; not updatable.
     */
    @CreationTimestamp
    @Column(name = "viewed_at", updatable = false)
    private LocalDateTime viewedAt;

    /** No-args constructor required by JPA. */
    public StoryView() {}

    /** Returns the composite primary key. */
    public StoryViewId getId() { return id; }
    /** Sets the composite primary key (must be set before saving). */
    public void setId(StoryViewId id) { this.id = id; }

    /** Returns the timestamp of when this view was recorded. */
    public LocalDateTime getViewedAt() { return viewedAt; }
    /** Allows override of the view timestamp (e.g. for tests or backfill migrations). */
    public void setViewedAt(LocalDateTime viewedAt) { this.viewedAt = viewedAt; }

    /**
     * Composite primary key for {@link StoryView}.
     *
     * <p>Must be {@code @Embeddable} so JPA knows to inline its fields into the
     * {@code story_views} table rather than creating a separate table.
     * Must implement {@link Serializable} as required by the JPA spec for ID classes.
     * Must implement {@link #equals} and {@link #hashCode} for correct Hibernate identity checks.
     */
    @Embeddable
    public static class StoryViewId implements Serializable {

        /** The UUID string of the story that was viewed. */
        @Column(name = "story_id", columnDefinition = "VARCHAR(36)")
        private String storyId;

        /** The UUID string of the user who viewed the story. */
        @Column(name = "user_id", columnDefinition = "VARCHAR(36)")
        private String userId;

        /** No-args constructor required by JPA. */
        public StoryViewId() {}

        /**
         * Convenience constructor for inline key creation:
         * {@code new StoryView.StoryViewId(storyId, userId)}.
         *
         * @param storyId the story's UUID string
         * @param userId  the viewer's UUID string
         */
        public StoryViewId(String storyId, String userId) {
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
         * Two view IDs are equal only if both storyId and userId match.
         * Required for Hibernate to correctly compare key objects when checking the session cache.
         */
        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (o == null || getClass() != o.getClass()) return false;
            StoryViewId that = (StoryViewId) o;
            return java.util.Objects.equals(storyId, that.storyId) &&
                   java.util.Objects.equals(userId, that.userId);
        }

        /**
         * Hash code consistent with equals — uses both fields.
         * Always override hashCode when you override equals.
         */
        @Override
        public int hashCode() {
            return java.util.Objects.hash(storyId, userId);
        }
    }
}
