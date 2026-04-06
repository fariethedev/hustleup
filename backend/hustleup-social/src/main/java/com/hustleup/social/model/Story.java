/**
 * JPA entity representing an ephemeral Story — a short-lived post that disappears after 24 hours.
 *
 * <p>Stories differ from regular feed {@link Post}s in that they have an explicit
 * {@link #expiresAt} timestamp.  A scheduled job in {@link com.hustleup.social.service.StoryService}
 * runs every hour to purge rows where {@code expires_at < NOW()}.
 *
 * <h2>Table: {@code stories}</h2>
 *
 * <h2>Story types</h2>
 * The {@link StoryType} enum restricts what kind of content a story can contain:
 * <ul>
 *   <li>{@code TEXT} — text-only, requires {@link #content}, no media file.</li>
 *   <li>{@code IMAGE} — requires a media upload stored at {@link #mediaUrl}.</li>
 *   <li>{@code VIDEO} — requires a media upload stored at {@link #mediaUrl}.</li>
 * </ul>
 * The type is stored as its string name in the database ({@code EnumType.STRING}) so
 * records remain human-readable and are not broken by enum reordering.
 *
 * <h2>Denormalised counters</h2>
 * Same design as {@link Post}: {@link #likesCount} and {@link #viewsCount} are
 * intentionally denormalised to avoid aggregation queries on every feed render.
 */
package com.hustleup.social.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import java.time.LocalDateTime;

// @Entity and @Table work together: Hibernate will manage the "stories" table for this class.
@Entity
@Table(name = "stories")
public class Story {

    /**
     * UUID string primary key, assigned by the application before persisting.
     * VARCHAR(36) holds a hyphenated UUID exactly.
     */
    @Id
    @Column(columnDefinition = "VARCHAR(36)")
    private String id;

    /**
     * UUID string of the {@link com.hustleup.common.model.User} who created this story.
     * Stored as a string (not a @ManyToOne) to avoid cross-service coupling.
     */
    @Column(name = "author_id", nullable = false, columnDefinition = "VARCHAR(36)")
    private String authorId;

    /**
     * Snapshot of the author's display name at the time of story creation.
     * Not updated if the user later changes their name.
     */
    @Column(name = "author_name", nullable = false)
    private String authorName;

    /**
     * Text content of the story (required for TEXT type, optional for media types).
     * Stored as MySQL TEXT to support longer captions.
     */
    @Column(columnDefinition = "TEXT")
    private String content;

    /**
     * Storage URL of the story's media file (image or video).
     * Null for TEXT-type stories.  Set by uploading through {@link com.hustleup.common.storage.FileStorageService}.
     */
    @Column(name = "media_url")
    private String mediaUrl;

    /**
     * The format of this story's content.
     *
     * <p>{@code @Enumerated(EnumType.STRING)} stores the enum's name (e.g. "IMAGE")
     * rather than its ordinal (e.g. 1).  This makes the DB column human-readable and
     * prevents bugs if the enum order is ever changed.
     */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private StoryType type;

    /**
     * Timestamp of creation, set automatically by Hibernate on first insert.
     * {@code updatable = false} prevents modification after creation.
     */
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    /**
     * Denormalised count of likes on this story.
     * Incremented/decremented by {@link com.hustleup.social.service.StoryService}.
     * Defaults to 0.
     */
    @Column(name = "likes_count")
    private Integer likesCount = 0;

    /**
     * Denormalised count of unique views on this story.
     * Incremented the first time each user views it.
     * Defaults to 0.
     */
    @Column(name = "views_count")
    private Integer viewsCount = 0;

    /**
     * The date/time after which this story should no longer be visible.
     *
     * <p>Set by {@link com.hustleup.social.service.StoryService#saveStory} to
     * {@code now + app.stories.expiration-hours} (default 24 hours).
     * Active stories are queried by filtering {@code expires_at > NOW()}.
     */
    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    /**
     * Enumeration of the valid story content types.
     *
     * <p>The ordering of values in this enum does not matter because we use
     * {@code EnumType.STRING} for persistence.
     */
    public enum StoryType {
        /** A media story containing a video file. */
        VIDEO,
        /** A media story containing an image file. */
        IMAGE,
        /** A text-only story (no media). */
        TEXT
    }

    /** No-args constructor required by JPA for reflective instantiation. */
    public Story() {}

    // ── Getters and Setters ───────────────────────────────────────────────────

    /** Returns the story's UUID primary key. */
    public String getId() { return id; }
    /** Sets the story's UUID primary key. */
    public void setId(String id) { this.id = id; }

    /** Returns the UUID of the user who created this story. */
    public String getAuthorId() { return authorId; }
    /** Sets the author's UUID. */
    public void setAuthorId(String authorId) { this.authorId = authorId; }

    /** Returns the display name snapshot of the author. */
    public String getAuthorName() { return authorName; }
    /** Sets the author's display name. */
    public void setAuthorName(String authorName) { this.authorName = authorName; }

    /** Returns the text content (null for non-TEXT stories). */
    public String getContent() { return content; }
    /** Sets the text content. */
    public void setContent(String content) { this.content = content; }

    /** Returns the media URL (null for TEXT stories). */
    public String getMediaUrl() { return mediaUrl; }
    /** Sets the media URL. */
    public void setMediaUrl(String mediaUrl) { this.mediaUrl = mediaUrl; }

    /** Returns the story type (TEXT, IMAGE, or VIDEO). */
    public StoryType getType() { return type; }
    /** Sets the story type. */
    public void setType(StoryType type) { this.type = type; }

    /** Returns the creation timestamp (set by Hibernate). */
    public LocalDateTime getCreatedAt() { return createdAt; }
    /** Allows manual override of the creation timestamp. */
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    /**
     * Returns the like count, defaulting to 0 if the database value is null.
     * The null guard protects against rows created before the default was added.
     */
    public Integer getLikesCount() { return likesCount == null ? 0 : likesCount; }
    /** Sets the like count. */
    public void setLikesCount(Integer likesCount) { this.likesCount = likesCount; }

    /**
     * Returns the view count, defaulting to 0 if the database value is null.
     */
    public Integer getViewsCount() { return viewsCount == null ? 0 : viewsCount; }
    /** Sets the view count. */
    public void setViewsCount(Integer viewsCount) { this.viewsCount = viewsCount; }

    /** Returns the expiration timestamp (after which the story is no longer shown). */
    public LocalDateTime getExpiresAt() { return expiresAt; }
    /** Sets the expiration timestamp (normally set by StoryService). */
    public void setExpiresAt(LocalDateTime expiresAt) { this.expiresAt = expiresAt; }
}
