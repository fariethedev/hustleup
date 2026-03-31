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
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/stories")
@RequiredArgsConstructor
public class StoryController {

    private final StoryService storyService;
    private final FileStorageService storageService;
    private final UserRepository userRepository;
    private final StoryLikeRepository storyLikeRepository;
    private final StoryViewRepository storyViewRepository;

    @GetMapping
    public ResponseEntity<?> getActiveStories() {
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
    }

    @PostMapping("/{id}/likes")
    public ResponseEntity<?> likeStory(@PathVariable String id) {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        User currentUser = userRepository.findByEmail(email).orElseThrow();
        String userId = currentUser.getId().toString();
        
        Story updatedStory = storyService.likeStory(id, userId);
        
        boolean isLiked = storyLikeRepository.existsById(new StoryLike.StoryLikeId(id, userId));
        boolean isViewed = storyViewRepository.existsById(new StoryView.StoryViewId(id, userId));
        
        return ResponseEntity.ok(StoryDto.from(updatedStory, isLiked, isViewed));
    }

    @PostMapping("/{id}/views")
    public ResponseEntity<?> viewStory(@PathVariable String id) {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        User currentUser = userRepository.findByEmail(email).orElse(null);
        
        if (currentUser == null) {
            return ResponseEntity.ok().build();
        }

        String userId = currentUser.getId().toString();
        Story updatedStory = storyService.viewStory(id, userId);
        
        boolean isLiked = storyLikeRepository.existsById(new StoryLike.StoryLikeId(id, userId));
        // We know it's viewed now because we just called viewStory, but let's be safe
        boolean isViewed = true; 
        
        return ResponseEntity.ok(StoryDto.from(updatedStory, isLiked, isViewed));
    }

    @DeleteMapping("/{id}/likes")
    public ResponseEntity<?> unlikeStory(@PathVariable String id) {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        User currentUser = userRepository.findByEmail(email).orElseThrow();
        String userId = currentUser.getId().toString();
        
        Story updatedStory = storyService.unlikeStory(id, userId);
        
        boolean isLiked = false;
        boolean isViewed = storyViewRepository.existsById(new StoryView.StoryViewId(id, userId));
        
        return ResponseEntity.ok(StoryDto.from(updatedStory, isLiked, isViewed));
    }

    @PostMapping
    public ResponseEntity<?> createStory(
            @RequestParam("type") String type,
            @RequestParam(value = "content", required = false) String content,
            @RequestParam(value = "media", required = false) MultipartFile media) {

        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        User currentUser = userRepository.findByEmail(email).orElseThrow();

        Story story = new Story();
        story.setId(UUID.randomUUID().toString());
        story.setAuthorId(currentUser.getId().toString());
        story.setAuthorName(currentUser.getFullName());
        story.setType(Story.StoryType.valueOf(type.toUpperCase()));
        story.setContent(content);
        story.setCreatedAt(LocalDateTime.now());
        story.setExpiresAt(LocalDateTime.now().plusHours(24));

        if (story.getType() == Story.StoryType.TEXT && (content == null || content.isBlank())) {
            throw new RuntimeException("Story content is required");
        }

        if (story.getType() != Story.StoryType.TEXT && (media == null || media.isEmpty())) {
            throw new RuntimeException("Story media is required");
        }

        if (media != null && !media.isEmpty()) {
            String url = storageService.store(media);
            story.setMediaUrl(url);
        }

        return ResponseEntity.ok(storyService.saveStory(story));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteStory(@PathVariable String id) {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        User currentUser = userRepository.findByEmail(email).orElseThrow();

        Story story = storyService.getStory(id);

        if (!story.getAuthorId().equals(currentUser.getId().toString())) {
            throw new RuntimeException("Not authorized to delete this story");
        }

        storyService.deleteStory(id);
        return ResponseEntity.ok().build();
    }
}
