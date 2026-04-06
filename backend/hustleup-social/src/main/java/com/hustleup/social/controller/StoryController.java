/**
 * REST controller for ephemeral Stories — short-lived media posts that expire after 24 hours.
 *
 * <p>Stories are inspired by the "Stories" feature found in Instagram/Snapchat.
 * They differ from regular feed posts in two key ways:
 * <ol>
 *   <li><b>Expiration</b> — every story has an {@code expires_at} timestamp. The
 *       {@link com.hustleup.social.service.StoryService} runs a scheduled job every hour
 *       to delete expired stories from the database.</li>
 *   <li><b>View tracking</b> — when a user opens a story, a {@code StoryView} record is
 *       created so the author can see a view count and the viewer's client knows not to
 *       highlight the story as unread.</li>
 * </ol>
 *
 * <h2>Base path</h2>
 * {@code /api/v1/stories}
 *
 * <h2>Authentication</h2>
 * Creating, deleting, liking, and viewing stories require authentication.
 * Browsing active stories works for anonymous users but without personalisation flags.
 *
 * <h2>Logging</h2>
 * Uses SLF4J via Lombok's {@code @Slf4j} for structured log messages.
 * Every mutation (create, like, delete) logs at INFO level; errors log at ERROR level.
 */
package com.hustleup.social.controller;

import com.hustleup.social.dto.StoryDto;
import com.hustleup.social.model.Story;
import com.hustleup.social.model.StoryLike;
import com.hustleup.social.model.StoryView;
import com.hustleup.social.repository.StoryLikeRepository;
import com.hustleup.social.repository.StoryViewRepository;
import com.hustleup.social.service.StoryService;
import com.hustleup.common.storage.FileStorageService;
import com.hustleup.common.repository.UserRepository;
import com.hustleup.common.model.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;

// @RestController: handles HTTP requests and serialises return values as JSON.
@RestController

// All endpoints under /api/v1/stories.
@RequestMapping("/api/v1/stories")

// Lombok generates a constructor that accepts all final fields, enabling Spring's
// constructor injection without writing boilerplate constructor code.
@RequiredArgsConstructor

// Lombok injects a private static final Logger field named "log".
@Slf4j
public class StoryController {

    // ── Dependencies (injected by @RequiredArgsConstructor) ───────────────────

    /** Business logic layer for stories: save, retrieve, like/unlike, cleanup. */
    private final StoryService storyService;

    /** Handles file uploads and URL refreshing for story media (images/videos). */
    private final FileStorageService storageService;

    /** Used to resolve the authenticated user from their email address. */
    private final UserRepository userRepository;

    /** Repository for the story_likes join table; used to check like status. */
    private final StoryLikeRepository storyLikeRepository;

    /** Repository for the story_views join table; used to check view status. */
    private final StoryViewRepository storyViewRepository;

    // ── Endpoints ─────────────────────────────────────────────────────────────

    /**
     * Retrieves all currently active (non-expired) stories, ordered newest first.
     *
     * <p><b>GET /api/v1/stories</b>
     *
     * <p>For authenticated users, each {@link StoryDto} includes:
     * <ul>
     *   <li>{@code likedByCurrentUser} — true if the current user has liked this story</li>
     *   <li>{@code viewedByCurrentUser} — true if the current user has already viewed it</li>
     *   <li>{@code authorAvatarUrl} — the author's profile picture (bulk-loaded)</li>
     * </ul>
     *
     * <p>For anonymous users, liked/viewed flags are always false.
     *
     * @return 200 OK with a JSON array of {@link StoryDto} objects;
     *         500 if an unexpected error occurs
     */
    @GetMapping
    public ResponseEntity<?> getActiveStories() {
        try {
            // Delegate to the service, which filters by expires_at > now.
            List<Story> stories = storyService.getActiveStories();
            List<String> storyIds = stories.stream().map(Story::getId).toList();

            // Attempt to identify the current user; anonymous users get minimal data.
            String email = SecurityContextHolder.getContext().getAuthentication().getName();
            User currentUser = userRepository.findByEmail(email).orElse(null);

            if (currentUser == null) {
                // Anonymous: return stories without personalisation flags.
                return ResponseEntity.ok(stories.stream()
                        .map(s -> StoryDto.from(s, false, false))
                        .toList());
            }

            String userId = currentUser.getId().toString();

            // Batch query: which stories has this user liked? (avoids N+1 queries)
            java.util.Set<String> likedStoryIds = storyLikeRepository.findByIdUserIdAndIdStoryIdIn(userId, storyIds)
                    .stream()
                    .map(sl -> sl.getId().getStoryId())
                    .collect(java.util.stream.Collectors.toSet());

            // Batch query: which stories has this user already viewed?
            java.util.Set<String> viewedStoryIds = storyViewRepository.findByIdUserIdAndIdStoryIdIn(userId, storyIds)
                    .stream()
                    .map(sv -> sv.getId().getStoryId())
                    .collect(java.util.stream.Collectors.toSet());

            // Bulk-load author avatars — one DB query instead of one per story.
            List<UUID> authorUUIDs = stories.stream()
                    .map(Story::getAuthorId)
                    .filter(Objects::nonNull)
                    .distinct()
                    .map(id -> { try { return UUID.fromString(id); } catch (Exception e) { return null; } })
                    .filter(Objects::nonNull)
                    .toList();
            Map<String, String> authorAvatarMap = userRepository.findAllById(authorUUIDs).stream()
                    .filter(u -> u.getAvatarUrl() != null && !u.getAvatarUrl().isBlank())
                    .collect(Collectors.toMap(u -> u.getId().toString(), User::getAvatarUrl));

            // Map each Story entity to a DTO with personalisation flags.
            return ResponseEntity.ok(stories.stream()
                    .map(s -> StoryDto.from(s, likedStoryIds.contains(s.getId()), viewedStoryIds.contains(s.getId()), authorAvatarMap.get(s.getAuthorId())))
                    .toList());
        } catch (Exception e) {
            log.error("Error fetching active stories", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(createErrorResponse("Failed to fetch stories: " + e.getMessage()));
        }
    }

    /**
     * Likes a story on behalf of the authenticated user.
     *
     * <p><b>POST /api/v1/stories/{id}/likes</b>
     *
     * <p>Auth: required.
     *
     * <p>Idempotent: if the user has already liked the story, the like count is not
     * incremented again (handled by {@link StoryService#likeStory}).
     *
     * @param id the UUID string of the story to like
     * @return 200 OK with the updated {@link StoryDto};
     *         404 if the story does not exist;
     *         500 on unexpected errors
     */
    @PostMapping("/{id}/likes")
    public ResponseEntity<?> likeStory(@PathVariable String id) {
        try {
            String email = SecurityContextHolder.getContext().getAuthentication().getName();
            User currentUser = userRepository.findByEmail(email)
                    .orElseThrow(() -> new IllegalArgumentException("User not found"));
            String userId = currentUser.getId().toString();

            // Delegate the idempotency check and counter increment to the service.
            Story updatedStory = storyService.likeStory(id, userId);

            // Re-check the like/view status after the update for accurate DTO flags.
            boolean isLiked = storyLikeRepository.existsById(new StoryLike.StoryLikeId(id, userId));
            boolean isViewed = storyViewRepository.existsById(new StoryView.StoryViewId(id, userId));

            log.info("Story liked: storyId={}, userId={}", id, userId);
            return ResponseEntity.ok(StoryDto.from(updatedStory, isLiked, isViewed));
        } catch (IllegalArgumentException e) {
            log.warn("Bad request for like story: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(createErrorResponse(e.getMessage()));
        } catch (Exception e) {
            log.error("Error liking story: {}", id, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(createErrorResponse("Failed to like story: " + e.getMessage()));
        }
    }

    /**
     * Records a view of a story by the authenticated user.
     *
     * <p><b>POST /api/v1/stories/{id}/views</b>
     *
     * <p>Auth: required. Anonymous users receive 200 OK with an empty body (view is ignored).
     *
     * <p>Idempotent: a user's view is only counted once, regardless of how many times
     * this endpoint is called (enforced by the {@code UNIQUE} constraint on {@code story_views}).
     *
     * @param id the UUID string of the story being viewed
     * @return 200 OK with the updated {@link StoryDto};
     *         404 if the story does not exist;
     *         500 on unexpected errors
     */
    @PostMapping("/{id}/views")
    public ResponseEntity<?> viewStory(@PathVariable String id) {
        try {
            String email = SecurityContextHolder.getContext().getAuthentication().getName();
            User currentUser = userRepository.findByEmail(email).orElse(null);

            // If anonymous, acknowledge the request but don't record anything.
            if (currentUser == null) {
                return ResponseEntity.ok().build();
            }

            String userId = currentUser.getId().toString();
            // Service handles duplicate detection via the unique constraint.
            Story updatedStory = storyService.viewStory(id, userId);

            boolean isLiked = storyLikeRepository.existsById(new StoryLike.StoryLikeId(id, userId));
            boolean isViewed = true; // we just recorded the view — it's definitely true

            return ResponseEntity.ok(StoryDto.from(updatedStory, isLiked, isViewed));
        } catch (IllegalArgumentException e) {
            log.warn("Story not found for view: {}", id);
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(createErrorResponse("Story not found"));
        } catch (Exception e) {
            log.error("Error viewing story: {}", id, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(createErrorResponse("Failed to record view: " + e.getMessage()));
        }
    }

    /**
     * Removes the current user's like from a story.
     *
     * <p><b>DELETE /api/v1/stories/{id}/likes</b>
     *
     * <p>Auth: required.
     *
     * <p>Idempotent: if the user hasn't liked the story, this is a no-op.
     *
     * @param id the UUID string of the story to unlike
     * @return 200 OK with the updated {@link StoryDto} (likedByCurrentUser = false)
     */
    @DeleteMapping("/{id}/likes")
    public ResponseEntity<?> unlikeStory(@PathVariable String id) {
        try {
            String email = SecurityContextHolder.getContext().getAuthentication().getName();
            User currentUser = userRepository.findByEmail(email)
                    .orElseThrow(() -> new IllegalArgumentException("User not found"));
            String userId = currentUser.getId().toString();

            Story updatedStory = storyService.unlikeStory(id, userId);

            boolean isLiked = false; // just unliked — definitely false
            boolean isViewed = storyViewRepository.existsById(new StoryView.StoryViewId(id, userId));

            log.info("Story unliked: storyId={}, userId={}", id, userId);
            return ResponseEntity.ok(StoryDto.from(updatedStory, isLiked, isViewed));
        } catch (IllegalArgumentException e) {
            log.warn("Bad request for unlike story: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(createErrorResponse(e.getMessage()));
        } catch (Exception e) {
            log.error("Error unliking story: {}", id, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(createErrorResponse("Failed to unlike story: " + e.getMessage()));
        }
    }

    /**
     * Creates a new story for the authenticated user.
     *
     * <p><b>POST /api/v1/stories</b> (multipart/form-data)
     *
     * <p>Request parameters:
     * <ul>
     *   <li>{@code type} — required; one of {@code TEXT}, {@code IMAGE}, {@code VIDEO}</li>
     *   <li>{@code content} — required for TEXT type; ignored for media types</li>
     *   <li>{@code media} — required for IMAGE/VIDEO types; a single file upload</li>
     * </ul>
     *
     * <p>The story's expiration time is set automatically by
     * {@link StoryService#saveStory} based on the {@code app.stories.expiration-hours}
     * configuration property (default: 24 hours).
     *
     * @param type    the story type ("TEXT", "IMAGE", or "VIDEO")
     * @param content optional text content (required if type == TEXT)
     * @param media   optional media file (required if type != TEXT)
     * @return 201 Created with the saved {@link StoryDto};
     *         400 for invalid type or missing required fields;
     *         500 on unexpected errors
     */
    @PostMapping
    public ResponseEntity<?> createStory(
            @RequestParam("type") String type,
            @RequestParam(value = "content", required = false) String content,
            @RequestParam(value = "media", required = false) MultipartFile media) {
        try {
            String email = SecurityContextHolder.getContext().getAuthentication().getName();
            User currentUser = userRepository.findByEmail(email)
                    .orElseThrow(() -> new IllegalArgumentException("User not found"));

            // Parse the story type enum — return 400 if the value is not recognised.
            Story.StoryType storyType;
            try {
                storyType = Story.StoryType.valueOf(type.toUpperCase());
            } catch (IllegalArgumentException e) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(createErrorResponse("Invalid story type. Allowed types: TEXT, IMAGE, VIDEO"));
            }

            // Validate that TEXT stories have content and media stories have a file.
            if (storyType == Story.StoryType.TEXT && (content == null || content.isBlank())) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(createErrorResponse("Story content is required for TEXT type"));
            }

            if (storyType != Story.StoryType.TEXT && (media == null || media.isEmpty())) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(createErrorResponse("Story media is required for " + storyType + " type"));
            }

            // Build the Story entity — expires_at will be set by StoryService.saveStory().
            Story story = new Story();
            story.setId(UUID.randomUUID().toString());
            story.setAuthorId(currentUser.getId().toString());
            story.setAuthorName(currentUser.getFullName());
            story.setType(storyType);
            story.setContent(content);
            story.setCreatedAt(LocalDateTime.now());
            story.setLikesCount(0);
            story.setViewsCount(0);

            // Upload the media file to storage and store the resulting URL on the entity.
            if (media != null && !media.isEmpty()) {
                String url = storageService.store(media);
                story.setMediaUrl(url);
            }

            // Persist via service, which also sets the expiration time.
            Story savedStory = storyService.saveStory(story);
            log.info("Story created: id={}, authorId={}, type={}", savedStory.getId(), currentUser.getId(), storyType);
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(StoryDto.from(savedStory, false, false));
        } catch (IllegalArgumentException e) {
            log.warn("Bad request for create story: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(createErrorResponse(e.getMessage()));
        } catch (Exception e) {
            log.error("Error creating story", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(createErrorResponse("Failed to create story: " + e.getMessage()));
        }
    }

    /**
     * Deletes a story.
     *
     * <p><b>DELETE /api/v1/stories/{id}</b>
     *
     * <p>Auth: required. Only the story's author can delete it; attempts by other
     * users are rejected with 403 Forbidden.
     *
     * @param id the UUID string of the story to delete
     * @return 200 OK on success;
     *         403 if the authenticated user is not the author;
     *         404 if the story does not exist;
     *         500 on unexpected errors
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteStory(@PathVariable String id) {
        try {
            String email = SecurityContextHolder.getContext().getAuthentication().getName();
            User currentUser = userRepository.findByEmail(email)
                    .orElseThrow(() -> new IllegalArgumentException("User not found"));

            // Load the story to verify ownership before deleting.
            Story story = storyService.getStory(id);

            // Ownership check: compare story's authorId to the current user's UUID string.
            if (!story.getAuthorId().equals(currentUser.getId().toString())) {
                log.warn("Unauthorized delete attempt: userId={}, storyId={}, authorId={}",
                        currentUser.getId(), id, story.getAuthorId());
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(createErrorResponse("You are not authorized to delete this story"));
            }

            storyService.deleteStory(id);
            log.info("Story deleted: id={}, userId={}", id, currentUser.getId());
            return ResponseEntity.ok().build();
        } catch (IllegalArgumentException e) {
            log.warn("Story not found for delete: {}", id);
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(createErrorResponse("Story not found"));
        } catch (Exception e) {
            log.error("Error deleting story: {}", id, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(createErrorResponse("Failed to delete story: " + e.getMessage()));
        }
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /**
     * Creates a standardised error response body as a single-entry map.
     *
     * <p>Using a consistent error shape ({@code {"message": "..."}}) makes it easy for
     * the front-end to display error messages without special-casing each endpoint.
     *
     * @param message the human-readable error description
     * @return a map with a single "message" key
     */
    private Map<String, String> createErrorResponse(String message) {
        Map<String, String> error = new HashMap<>();
        error.put("message", message);
        return error;
    }
}
