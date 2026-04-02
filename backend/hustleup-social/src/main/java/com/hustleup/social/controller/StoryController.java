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
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/stories")
@RequiredArgsConstructor
@Slf4j
public class StoryController {

    private final StoryService storyService;
    private final FileStorageService storageService;
    private final UserRepository userRepository;
    private final StoryLikeRepository storyLikeRepository;
    private final StoryViewRepository storyViewRepository;

    @GetMapping
    public ResponseEntity<?> getActiveStories() {
        try {
            List<Story> stories = storyService.getActiveStories();
            List<String> storyIds = stories.stream().map(Story::getId).toList();
            
            String email = SecurityContextHolder.getContext().getAuthentication().getName();
            User currentUser = userRepository.findByEmail(email).orElse(null);
            
            if (currentUser == null) {
                return ResponseEntity.ok(stories.stream()
                        .map(s -> StoryDto.from(s, false, false))
                        .toList());
            }
    
            String userId = currentUser.getId().toString();
            
            java.util.Set<String> likedStoryIds = storyLikeRepository.findByIdUserIdAndIdStoryIdIn(userId, storyIds)
                    .stream()
                    .map(sl -> sl.getId().getStoryId())
                    .collect(java.util.stream.Collectors.toSet());

            java.util.Set<String> viewedStoryIds = storyViewRepository.findByIdUserIdAndIdStoryIdIn(userId, storyIds)
                    .stream()
                    .map(sv -> sv.getId().getStoryId())
                    .collect(java.util.stream.Collectors.toSet());

            return ResponseEntity.ok(stories.stream()
                    .map(s -> StoryDto.from(s, likedStoryIds.contains(s.getId()), viewedStoryIds.contains(s.getId())))
                    .toList());
        } catch (Exception e) {
            log.error("Error fetching active stories", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(createErrorResponse("Failed to fetch stories: " + e.getMessage()));
        }
    }

    @PostMapping("/{id}/likes")
    public ResponseEntity<?> likeStory(@PathVariable String id) {
        try {
            String email = SecurityContextHolder.getContext().getAuthentication().getName();
            User currentUser = userRepository.findByEmail(email)
                    .orElseThrow(() -> new IllegalArgumentException("User not found"));
            String userId = currentUser.getId().toString();
            
            Story updatedStory = storyService.likeStory(id, userId);
            
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

    @PostMapping("/{id}/views")
    public ResponseEntity<?> viewStory(@PathVariable String id) {
        try {
            String email = SecurityContextHolder.getContext().getAuthentication().getName();
            User currentUser = userRepository.findByEmail(email).orElse(null);
            
            if (currentUser == null) {
                return ResponseEntity.ok().build();
            }

            String userId = currentUser.getId().toString();
            Story updatedStory = storyService.viewStory(id, userId);
            
            boolean isLiked = storyLikeRepository.existsById(new StoryLike.StoryLikeId(id, userId));
            boolean isViewed = true;
            
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

    @DeleteMapping("/{id}/likes")
    public ResponseEntity<?> unlikeStory(@PathVariable String id) {
        try {
            String email = SecurityContextHolder.getContext().getAuthentication().getName();
            User currentUser = userRepository.findByEmail(email)
                    .orElseThrow(() -> new IllegalArgumentException("User not found"));
            String userId = currentUser.getId().toString();
            
            Story updatedStory = storyService.unlikeStory(id, userId);
            
            boolean isLiked = false;
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

    @PostMapping
    public ResponseEntity<?> createStory(
            @RequestParam("type") String type,
            @RequestParam(value = "content", required = false) String content,
            @RequestParam(value = "media", required = false) MultipartFile media) {
        try {
            String email = SecurityContextHolder.getContext().getAuthentication().getName();
            User currentUser = userRepository.findByEmail(email)
                    .orElseThrow(() -> new IllegalArgumentException("User not found"));

            Story.StoryType storyType;
            try {
                storyType = Story.StoryType.valueOf(type.toUpperCase());
            } catch (IllegalArgumentException e) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(createErrorResponse("Invalid story type. Allowed types: TEXT, IMAGE, VIDEO"));
            }

            if (storyType == Story.StoryType.TEXT && (content == null || content.isBlank())) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(createErrorResponse("Story content is required for TEXT type"));
            }

            if (storyType != Story.StoryType.TEXT && (media == null || media.isEmpty())) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(createErrorResponse("Story media is required for " + storyType + " type"));
            }

            Story story = new Story();
            story.setId(UUID.randomUUID().toString());
            story.setAuthorId(currentUser.getId().toString());
            story.setAuthorName(currentUser.getFullName());
            story.setType(storyType);
            story.setContent(content);
            story.setCreatedAt(LocalDateTime.now());
            story.setLikesCount(0);
            story.setViewsCount(0);

            if (media != null && !media.isEmpty()) {
                String url = storageService.store(media);
                story.setMediaUrl(url);
            }

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

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteStory(@PathVariable String id) {
        try {
            String email = SecurityContextHolder.getContext().getAuthentication().getName();
            User currentUser = userRepository.findByEmail(email)
                    .orElseThrow(() -> new IllegalArgumentException("User not found"));

            Story story = storyService.getStory(id);

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

    private Map<String, String> createErrorResponse(String message) {
        Map<String, String> error = new HashMap<>();
        error.put("message", message);
        return error;
    }
}
