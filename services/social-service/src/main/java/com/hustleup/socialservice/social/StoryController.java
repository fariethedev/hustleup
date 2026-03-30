package com.hustleup.socialservice.social;

import com.hustleup.socialservice.storage.FileStorageService;
import com.hustleup.socialservice.user.User;
import com.hustleup.socialservice.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/stories")
@RequiredArgsConstructor
public class StoryController {

    private final StoryService storyService;
    private final FileStorageService storageService;
    private final UserRepository userRepository;

    @GetMapping
    public ResponseEntity<?> getActiveStories() {
        return ResponseEntity.ok(storyService.getActiveStories());
    }

    @PostMapping
    public ResponseEntity<?> createStory(@RequestParam("type") String type, @RequestParam(value = "content", required = false) String content, @RequestParam(value = "media", required = false) MultipartFile media) {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        User currentUser = userRepository.findByEmail(email).orElseThrow(() -> new RuntimeException("User not found"));
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
            story.setMediaUrl(storageService.store(media));
        }
        return ResponseEntity.ok(storyService.saveStory(story));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteStory(@PathVariable String id) {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        User currentUser = userRepository.findByEmail(email).orElseThrow(() -> new RuntimeException("User not found"));
        Story story = storyService.getStory(id);
        if (!story.getAuthorId().equals(currentUser.getId().toString())) {
            throw new RuntimeException("Not authorized to delete this story");
        }
        storyService.deleteStory(id);
        return ResponseEntity.ok().build();
    }
}
