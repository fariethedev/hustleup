package com.hustleup.socialservice.social;

import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class StoryService {

    private final StoryRepository storyRepository;

    public Story saveStory(Story story) {
        if (story.getExpiresAt() == null) {
            story.setExpiresAt(LocalDateTime.now().plusHours(24));
        }
        return storyRepository.save(story);
    }

    public List<Story> getActiveStories() {
        return storyRepository.findByExpiresAtAfterOrderByCreatedAtDesc(LocalDateTime.now());
    }

    public Story getStory(String id) {
        return storyRepository.findById(id).orElseThrow(() -> new RuntimeException("Story not found"));
    }

    public void deleteStory(String id) {
        storyRepository.deleteById(id);
    }

    @Scheduled(fixedRate = 3600000)
    @Transactional
    public void cleanupExpiredStories() {
        storyRepository.deleteByExpiresAtBefore(LocalDateTime.now());
    }
}
