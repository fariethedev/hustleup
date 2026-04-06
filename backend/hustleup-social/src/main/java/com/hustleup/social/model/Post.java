/**
 * JPA entity representing a social feed post.
 *
 * <p>A Post is the core unit of content in the HustleUp social feed. Any registered user
 * can create a post containing text, images, videos, or a combination thereof.
 *
 * <h2>Why JPA / Hibernate?</h2>
 * JPA (Java Persistence API) is the standard way to map Java objects to relational database
 * tables.  Hibernate is the JPA implementation used here (bundled with Spring Boot).
 * It means we write Java classes and let the framework generate SQL — reducing boilerplate
 * and making the domain model the single source of truth.
 *
 * <h2>Table: {@code posts}</h2>
 * Each instance of this class corresponds to one row in the {@code posts} table.
 *
 * <h2>Primary key strategy</h2>
 * UUIDs are generated in application code (not auto-incremented by the DB) so we can
 * assign IDs before a row is inserted.  This is useful for distributed systems where you
 * might create an ID before you've even hit the database.
 *
 * <h2>Denormalised counters</h2>
 * {@code likes_count} and {@code comments_count} are intentionally denormalised — they
 * duplicate data that could be derived with a COUNT(*) query.  The trade-off: slightly
 * more complex writes (must update the counter on like/comment) in exchange for very
 * cheap reads (no join or subquery needed to display the count on every feed card).
 *
 * <h2>Media storage</h2>
 * Media URLs are stored as comma-separated values in TEXT columns rather than a separate
 * table.  This keeps reads simple (one query for post + media) at the cost of flexibility.
 * A future migration could normalise this into a {@code post_media} table.
 */
package com.hustleup.social.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import java.time.LocalDateTime;

// @Entity tells JPA that this class is a managed entity — Hibernate will map it to a DB table.
@Entity

// @Table overrides the default table name (which would be "post") to explicitly use "posts".
@Table(name = "posts")
public class Post {

    /**
     * Primary key — a UUID string (e.g. "550e8400-e29b-41d4-a716-446655440000").
     *
     * <p>We use {@code VARCHAR(36)} because a UUID formatted as a hyphenated string is exactly
     * 36 characters.  The ID is assigned in application code using {@link java.util.UUID#randomUUID()}.
     */
    @Id
    @Column(columnDefinition = "VARCHAR(36)")
    private String id;

    /**
     * UUID string of the {@link com.hustleup.common.model.User} who created this post.
     *
     * <p>We store this as a plain String rather than a {@code @ManyToOne} JPA relationship
     * because the User entity lives in a different microservice's domain.  Cross-service
     * joins would tightly couple the services; instead we store the ID and look up the
     * User separately only when needed (e.g. in the DTO conversion layer).
     */
    @Column(name = "author_id", nullable = false, columnDefinition = "VARCHAR(36)")
    private String authorId;

    /**
     * Denormalised display name of the author at the time of posting.
     *
     * <p>This is a snapshot — if the user later changes their name, existing posts still
     * show the name they had when the post was created.  This is intentional (historical
     * accuracy) and avoids a JOIN to the users table for every post in the feed.
     */
    @Column(name = "author_name", nullable = false)
    private String authorName;

    /**
     * The text body of the post.
     *
     * <p>{@code columnDefinition = "TEXT"} maps to MySQL's {@code TEXT} type, which holds
     * up to ~65,535 bytes — much more than {@code VARCHAR(255)} and appropriate for
     * long-form user content.
     */
    @Column(columnDefinition = "TEXT")
    private String content;

    /**
     * Legacy single-image URL for backward compatibility with older clients.
     *
     * <p>When multiple media files are uploaded, this field holds the URL of the first
     * image in the list.  Newer clients should use the {@link #mediaUrls} field instead.
     */
    @Column(name = "image_url")
    private String imageUrl;

    /**
     * Comma-separated list of media URLs (images and/or videos).
     *
     * <p>Example: {@code "https://cdn.../img1.jpg,https://cdn.../clip.mp4"}
     * The ordering matches the {@link #mediaTypes} column.
     * {@code TEXT} column supports an arbitrary number of media items.
     */
    @Column(name = "media_urls", columnDefinition = "TEXT")
    private String mediaUrls;

    /**
     * Comma-separated list of media types parallel to {@link #mediaUrls}.
     *
     * <p>Each entry is either {@code "IMAGE"} or {@code "VIDEO"}.
     * Example: {@code "IMAGE,VIDEO,IMAGE"}
     */
    @Column(name = "media_types", columnDefinition = "TEXT")
    private String mediaTypes;

    /**
     * Optional reference to a marketplace listing associated with this post.
     *
     * <p>Allows sellers to cross-post their listings into the social feed so followers
     * can discover products without leaving the feed.  Null if the post is not linked
     * to a listing.
     */
    @Column(name = "linked_listing_id")
    private String linkedListingId;

    /**
     * Denormalised count of likes on this post.
     *
     * <p>Incremented/decremented when a user likes/unlikes the post.
     * Defaults to {@code 0} so null checks are rarely needed.
     * Guarded by {@code Math.max(0, ...)} in the controller to prevent going negative.
     */
    @Column(name = "likes_count")
    private Integer likesCount = 0;

    /**
     * Denormalised count of comments on this post.
     *
     * <p>Same pattern as {@link #likesCount} — incremented when a comment is added.
     * Note: comments are not currently deleted through the API, so no decrement logic exists.
     */
    @Column(name = "comments_count")
    private Integer commentsCount = 0;

    /**
     * Whether this post was published anonymously.
     *
     * <p>When true, the client should NOT expose the author's identity.
     * The authorId is still stored internally for moderation purposes.
     */
    @Column(name = "anonymous", nullable = false)
    private boolean anonymous = false;

    /**
     * Timestamp of when the post was created, set automatically by Hibernate.
     *
     * <p>{@code @CreationTimestamp} tells Hibernate to set this field to the current
     * date/time when the entity is first persisted.  {@code updatable = false} ensures
     * Hibernate never overwrites it on subsequent saves.
     */
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    /** Required no-args constructor for JPA (Hibernate needs to instantiate entities via reflection). */
    public Post() {}

    // ── Getters and Setters ───────────────────────────────────────────────────
    // Standard JavaBeans convention. Spring Data and Jackson use these for reading
    // and writing entity fields.

    /** Returns the post's UUID primary key. */
    public String getId() { return id; }
    /** Sets the post's UUID primary key (called once, before first save). */
    public void setId(String id) { this.id = id; }

    /** Returns the UUID string of the post's author. */
    public String getAuthorId() { return authorId; }
    /** Sets the UUID string of the post's author. */
    public void setAuthorId(String authorId) { this.authorId = authorId; }

    /** Returns the display name of the author at time of posting. */
    public String getAuthorName() { return authorName; }
    /** Sets the display name of the author. */
    public void setAuthorName(String authorName) { this.authorName = authorName; }

    /** Returns the text body of the post. */
    public String getContent() { return content; }
    /** Sets the text body of the post. */
    public void setContent(String content) { this.content = content; }

    /** Returns the legacy single image URL (may be null for text-only posts). */
    public String getImageUrl() { return imageUrl; }
    /** Sets the legacy single image URL. */
    public void setImageUrl(String imageUrl) { this.imageUrl = imageUrl; }

    /** Returns the comma-separated media URLs string. */
    public String getMediaUrls() { return mediaUrls; }
    /** Sets the comma-separated media URLs string. */
    public void setMediaUrls(String mediaUrls) { this.mediaUrls = mediaUrls; }

    /** Returns the comma-separated media types string (parallel to mediaUrls). */
    public String getMediaTypes() { return mediaTypes; }
    /** Sets the comma-separated media types string. */
    public void setMediaTypes(String mediaTypes) { this.mediaTypes = mediaTypes; }

    /** Returns the ID of the linked marketplace listing, or null if none. */
    public String getLinkedListingId() { return linkedListingId; }
    /** Sets the linked listing ID. */
    public void setLinkedListingId(String linkedListingId) { this.linkedListingId = linkedListingId; }

    /**
     * Returns the like count, defaulting to 0 if the database value is null.
     * The null check guards against rows created before the default was added.
     */
    public Integer getLikesCount() { return likesCount == null ? 0 : likesCount; }
    /** Sets the like count. */
    public void setLikesCount(Integer likesCount) { this.likesCount = likesCount; }

    /**
     * Returns the comment count, defaulting to 0 if the database value is null.
     */
    public Integer getCommentsCount() { return commentsCount == null ? 0 : commentsCount; }
    /** Sets the comment count. */
    public void setCommentsCount(Integer commentsCount) { this.commentsCount = commentsCount; }

    /** Returns true if this post was published anonymously. */
    public boolean isAnonymous() { return anonymous; }
    /** Sets the anonymous flag. */
    public void setAnonymous(boolean anonymous) { this.anonymous = anonymous; }

    /** Returns the creation timestamp (set automatically by Hibernate). */
    public LocalDateTime getCreatedAt() { return createdAt; }
    /** Allows manual override of the creation timestamp (e.g. in tests or data migrations). */
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
