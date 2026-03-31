package com.hustleup.social;

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
    private final StoryLikeRepository storyLikeRepository;
    private final StoryViewRepository storyViewRepository;

    public Story saveStory(Story story) {
        if (story.getExpiresAt() == null) {
            story.setExpiresAt(LocalDateTime.now().plusHours(24));
        }
        return storyRepository.save(story);
    }

    public List<Story> getActiveStories() {
        return storyRepository.findByExpiresAtAfterOrderByCreatedAtDesc(LocalDateTime.now());
    }

    public List<Story> getActiveStoriesByAuthor(String authorId) {
        return storyRepository.findByAuthorIdAndExpiresAtAfterOrderByCreatedAtDesc(authorId, LocalDateTime.now());
    }

    public Story getStory(String id) {
        return storyRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Story not found"));
    }

    public void deleteStory(String id) {
        storyRepository.deleteById(id);
    }

    @Scheduled(fixedRate = 3600000) // Every hour
    @Transactional
    public void cleanupExpiredStories() {
        storyRepository.deleteByExpiresAtBefore(LocalDateTime.now());
    }

    @Transactional
    public Story likeStory(String storyId, String userId) {
        Story story = getStory(storyId);
        StoryLike.StoryLikeId likeId = new StoryLike.StoryLikeId();
        likeId.setStoryId(storyId);
        likeId.setUserId(userId);

        if (!storyLikeRepository.existsById(likeId)) {
            StoryLike storyLike = new StoryLike();
            storyLike.setId(likeId);
            storyLikeRepository.save(storyLike);
            story.setLikesCount((story.getLikesCount() == null ? 0 : story.getLikesCount()) + 1);
            return storyRepository.save(story);
        }
        return story;
    }

    @Transactional
    public Story unlikeStory(String storyId, String userId) {
        Story story = getStory(storyId);
        StoryLike.StoryLikeId likeId = new StoryLike.StoryLikeId();
        likeId.setStoryId(storyId);
        likeId.setUserId(userId);

        if (storyLikeRepository.existsById(likeId)) {
            storyLikeRepository.deleteById(likeId);
            story.setLikesCount(Math.max(0, (story.getLikesCount() == null ? 0 : story.getLikesCount()) - 1));
            return storyRepository.save(story);
        }
        return story;
    }

    @Transactional
    public Story viewStory(String storyId, String userId) {
        Story story = getStory(storyId);
        StoryView.StoryViewId viewId = new StoryView.StoryViewId();
        viewId.setStoryId(storyId);
        viewId.setUserId(userId);

        if (!storyViewRepository.existsById(viewId)) {
            StoryView storyView = new StoryView();
            storyView.setId(viewId);
            storyViewRepository.save(storyView);
            story.setViewsCount((story.getViewsCount() == null ? 0 : story.getViewsCount()) + 1);
            return storyRepository.save(story);
        }
        return story;
    }
}
