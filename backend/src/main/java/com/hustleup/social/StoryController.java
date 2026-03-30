package com.hustleup.social;

import com.hustleup.storage.FileStorageService;
import com.hustleup.user.UserRepository;
import com.hustleup.user.User;
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

    @GetMapping
    public ResponseEntity<?> getActiveStories() {
        List<Story> stories = storyService.getActiveStories();
        
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        User currentUser = userRepository.findByEmail(email).orElse(null);
        
        if (currentUser == null) {
            return ResponseEntity.ok(stories.stream()
                    .map(s -> StoryDto.from(s, false))
                    .toList());
        }

        String userId = currentUser.getId().toString();
        java.util.Set<String> likedStoryIds = storyLikeRepository.findByIdUserIdAndIdStoryIdIn(
                        userId, 
                        stories.stream().map(Story::getId).toList())
                .stream()
                .map(sl -> sl.getId().getStoryId())
                .collect(java.util.stream.Collectors.toSet());

        return ResponseEntity.ok(stories.stream()
                .map(s -> StoryDto.from(s, likedStoryIds.contains(s.getId())))
                .toList());
    }

    @PostMapping("/{id}/likes")
    public ResponseEntity<?> likeStory(@PathVariable String id) {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        User currentUser = userRepository.findByEmail(email).orElseThrow();
        
        Story updatedStory = storyService.likeStory(id, currentUser.getId().toString());
        return ResponseEntity.ok(StoryDto.from(updatedStory, true));
    }

    @DeleteMapping("/{id}/likes")
    public ResponseEntity<?> unlikeStory(@PathVariable String id) {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        User currentUser = userRepository.findByEmail(email).orElseThrow();
        
        Story updatedStory = storyService.unlikeStory(id, currentUser.getId().toString());
        return ResponseEntity.ok(StoryDto.from(updatedStory, false));
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
