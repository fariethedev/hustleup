/**
 * JPA entity representing a comment on a feed post.
 *
 * <p>Comments belong to a {@link Post} via the {@code post_id} foreign key and can
 * optionally be nested (replies to other comments) via the {@code parent_id} field.
 *
 * <h2>Table: {@code comments}</h2>
 *
 * <h2>Threading model</h2>
 * {@code parent_id} enables a simple two-level threading model:
 * <ul>
 *   <li>Top-level comments have {@code parent_id = null}.</li>
 *   <li>Replies have {@code parent_id} set to the ID of the parent comment.</li>
 * </ul>
 * The client is responsible for grouping comments into a threaded view; the server
 * returns a flat, chronologically ordered list via {@link com.hustleup.social.repository.CommentRepository}.
 *
 * <h2>Author identity</h2>
 * Like {@link Post}, this entity stores {@code author_id} and {@code author_name} as
 * strings rather than a JPA relationship to the User entity in the common library.
 * This avoids cross-service coupling and keeps queries simple.
 */
package com.hustleup.social.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import java.time.LocalDateTime;

// Marks this class as a JPA-managed entity that maps to a database table.
@Entity

// Explicitly name the table "comments" (the default would derive to "comment").
@Table(name = "comments")
public class Comment {

    /**
     * Primary key — a UUID string assigned by the application before persisting.
     * VARCHAR(36) is exactly the right size for a hyphenated UUID like
     * "123e4567-e89b-12d3-a456-426614174000".
     */
    @Id
    @Column(columnDefinition = "VARCHAR(36)")
    private String id;

    /**
     * Foreign key referencing the {@link Post} this comment belongs to.
     *
     * <p>We store this as a plain String rather than a {@code @ManyToOne} relationship
     * to keep the entity lightweight.  A proper foreign key constraint enforcing
     * referential integrity is assumed to exist at the database level.
     */
    @Column(name = "post_id", nullable = false, columnDefinition = "VARCHAR(36)")
    private String postId;

    /**
     * UUID string of the {@link com.hustleup.common.model.User} who wrote this comment.
     * Stored as a string to avoid coupling to the User entity.
     */
    @Column(name = "author_id", nullable = false, columnDefinition = "VARCHAR(36)")
    private String authorId;

    /**
     * Snapshot of the commenter's display name at the time they commented.
     * Not updated if the user later changes their name (historical accuracy).
     */
    @Column(name = "author_name", nullable = false)
    private String authorName;

    /**
     * The text content of the comment.
     *
     * <p>Stored as MySQL TEXT (up to ~65k bytes) to accommodate longer replies.
     * {@code nullable = false} enforces that comments cannot be empty at the DB level.
     */
    @Column(columnDefinition = "TEXT", nullable = false)
    private String content;

    /**
     * Optional reference to a parent comment's ID, enabling reply threading.
     *
     * <p>Null for top-level comments.  When set, identifies the comment being replied to.
     * The client uses this to indent replies under their parent in the UI.
     */
    @Column(name = "parent_id", columnDefinition = "VARCHAR(36)")
    private String parentId;

    /**
     * Timestamp of creation, populated automatically by Hibernate.
     *
     * <p>The {@code updatable = false} constraint prevents accidental updates;
     * once a row is created, this timestamp is permanent.
     * The chronological ordering on this field is used by
     * {@link com.hustleup.social.repository.CommentRepository#findByPostIdOrderByCreatedAtAsc}.
     */
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    /** No-args constructor required by JPA for reflective instantiation. */
    public Comment() {}

    // ── Getters and Setters ───────────────────────────────────────────────────

    /** Returns this comment's UUID primary key. */
    public String getId() { return id; }
    /** Sets the UUID primary key (assigned before first save). */
    public void setId(String id) { this.id = id; }

    /** Returns the UUID of the post this comment belongs to. */
    public String getPostId() { return postId; }
    /** Sets the parent post UUID. */
    public void setPostId(String postId) { this.postId = postId; }

    /** Returns the UUID of the user who wrote this comment. */
    public String getAuthorId() { return authorId; }
    /** Sets the author's UUID. */
    public void setAuthorId(String authorId) { this.authorId = authorId; }

    /** Returns the display name of the author at the time of commenting. */
    public String getAuthorName() { return authorName; }
    /** Sets the author's display name. */
    public void setAuthorName(String authorName) { this.authorName = authorName; }

    /** Returns the text content of the comment. */
    public String getContent() { return content; }
    /** Sets the text content of the comment. */
    public void setContent(String content) { this.content = content; }

    /** Returns the creation timestamp (set by Hibernate on insert). */
    public LocalDateTime getCreatedAt() { return createdAt; }
    /** Allows override of the creation timestamp (e.g. in test fixtures). */
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    /** Returns the parent comment's UUID, or null if this is a top-level comment. */
    public String getParentId() { return parentId; }
    /** Sets the parent comment UUID for reply threading. */
    public void setParentId(String parentId) { this.parentId = parentId; }
}
