/**
 * Data Transfer Object (DTO) for the {@link com.hustleup.social.model.Story} entity.
 *
 * <h2>Why a DTO for stories?</h2>
 * For the same reasons as {@link PostDto}: the Story entity is a database-facing object
 * managed by JPA/Hibernate.  Exposing it directly would:
 * <ul>
 *   <li>Leak internal fields and JPA proxy details.</li>
 *   <li>Make it impossible to add computed fields like {@code likedByCurrentUser}
 *       and {@code viewedByCurrentUser} without polluting the entity.</li>
 *   <li>Tightly couple the JSON API shape to the database schema.</li>
 * </ul>
 *
 * <h2>Transformation pattern</h2>
 * Static factory methods ({@code from(...)}) accept a Story entity plus contextual
 * parameters and produce an immutable DTO.  The factory methods form a chain with
 * increasing specificity:
 * <pre>
 *   from(story, liked, viewed)
 *     └── from(story, liked, viewed, authorAvatarUrl)   ← primary factory
 * </pre>
 *
 * <h2>Flags not on the entity</h2>
 * {@code likedByCurrentUser} and {@code viewedByCurrentUser} are computed outside the
 * entity by querying the {@code story_likes} and {@code story_views} tables respectively,
 * then passed into the factory method.  This keeps the entity clean and the DTO
 * self-contained.
 */
package com.hustleup.social.dto;

import com.hustleup.social.model.Story;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

// @Data: generates getters, setters, equals, hashCode, toString for all fields.
@Data
// @Builder: enables StoryDto.builder()...build() construction in the factory methods.
@Builder
public class StoryDto {

    /** The story's UUID string primary key. */
    private String id;

    /** UUID string of the story's author. */
    private String authorId;

    /** Display name of the story's author (snapshot from time of creation). */
    private String authorName;

    /**
     * The author's current profile picture URL.
     *
     * <p>Not stored on the Story entity — injected during conversion by the controller,
     * which bulk-loads author avatars from the User table to avoid N+1 queries.
     */
    private String authorAvatarUrl;

    /**
     * Text content of the story.
     * Non-null for TEXT-type stories; null for IMAGE/VIDEO stories unless a caption
     * is provided.
     */
    private String content;

    /**
     * URL of the story's media file (image or video).
     * Null for TEXT-type stories.
     */
    private String mediaUrl;

    /**
     * The story type (TEXT, IMAGE, or VIDEO).
     *
     * <p>Serialised as its string name by Jackson ({@code @JsonProperty} is not needed
     * because the Jackson enum serialiser uses the name by default).
     */
    private Story.StoryType type;

    /** Timestamp of when the story was created. */
    private LocalDateTime createdAt;

    /**
     * Timestamp after which the story is no longer shown to users.
     * Typically 24 hours after creation.
     */
    private LocalDateTime expiresAt;

    /** Total number of likes on this story (denormalised counter). */
    private Integer likesCount;

    /** Total number of unique views on this story (denormalised counter). */
    private Integer viewsCount;

    /**
     * Whether the currently authenticated user has liked this story.
     *
     * <p>Computed by querying the story_likes table in the controller and passed into
     * the factory method.  Allows the client to show a filled/unfilled heart icon
     * without a separate API call.
     */
    private boolean likedByCurrentUser;

    /**
     * Whether the currently authenticated user has already viewed this story.
     *
     * <p>Computed by querying the story_views table in the controller.
     * When {@code true}, the client typically shows a "seen" indicator, greying out
     * the story ring or marking it as read.
     */
    private boolean viewedByCurrentUser;

    // ── Static factory methods ────────────────────────────────────────────────

    /**
     * Factory without author avatar — used when avatar enrichment is not available.
     *
     * @param story              the Story entity to convert
     * @param likedByCurrentUser whether the current user has liked this story
     * @param viewedByCurrentUser whether the current user has already viewed this story
     * @return a StoryDto with {@code authorAvatarUrl = null}
     */
    public static StoryDto from(Story story, boolean likedByCurrentUser, boolean viewedByCurrentUser) {
        // Delegate to the full factory with a null avatar URL.
        return from(story, likedByCurrentUser, viewedByCurrentUser, null);
    }

    /**
     * Full factory: converts a Story entity to a StoryDto with all computed fields.
     *
     * <p>This is the primary factory used by {@link com.hustleup.social.controller.StoryController}.
     * All null-safety for counter fields is handled here so callers don't need to worry about it.
     *
     * @param story              the Story entity to convert
     * @param likedByCurrentUser whether the current user has liked this story
     * @param viewedByCurrentUser whether the current user has already viewed this story
     * @param authorAvatarUrl    the story author's current profile picture URL (may be null)
     * @return a fully populated StoryDto ready for JSON serialisation
     */
    public static StoryDto from(Story story, boolean likedByCurrentUser, boolean viewedByCurrentUser, String authorAvatarUrl) {
        return StoryDto.builder()
                .id(story.getId())
                .authorId(story.getAuthorId())
                .authorName(story.getAuthorName())
                .authorAvatarUrl(authorAvatarUrl)        // injected externally, not from entity
                .content(story.getContent())
                .mediaUrl(story.getMediaUrl())
                .type(story.getType())
                .createdAt(story.getCreatedAt())
                .expiresAt(story.getExpiresAt())
                // Null-safe counter reads: default to 0 rather than passing null to the client
                .likesCount(story.getLikesCount() == null ? 0 : story.getLikesCount())
                .viewsCount(story.getViewsCount() == null ? 0 : story.getViewsCount())
                .likedByCurrentUser(likedByCurrentUser)
                .viewedByCurrentUser(viewedByCurrentUser)
                .build();
    }
}
