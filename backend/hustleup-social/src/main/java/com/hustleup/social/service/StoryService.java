package com.hustleup.social.service;

import com.hustleup.social.model.Story;
import com.hustleup.social.model.StoryLike;
import com.hustleup.social.model.StoryView;
import com.hustleup.social.repository.StoryLikeRepository;
import com.hustleup.social.repository.StoryRepository;
import com.hustleup.social.repository.StoryViewRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class StoryService {

    private final StoryRepository storyRepository;
    private final StoryLikeRepository storyLikeRepository;
    private final StoryViewRepository storyViewRepository;

    @Value("${app.stories.expiration-hours:24}")
    private int storyExpirationHours;

    @Transactional
    public Story saveStory(Story story) {
        if (story.getExpiresAt() == null) {
            story.setExpiresAt(LocalDateTime.now().plusHours(storyExpirationHours));
        }
        if (story.getLikesCount() == null) {
            story.setLikesCount(0);
        }
        if (story.getViewsCount() == null) {
            story.setViewsCount(0);
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
                .orElseThrow(() -> new IllegalArgumentException("Story not found with id: " + id));
    }

    @Transactional
    public void deleteStory(String id) {
        storyRepository.deleteById(id);
        log.info("Story deleted: {}", id);
    }

    @Scheduled(fixedRate = 3600000) // Every hour
    @Transactional
    public void cleanupExpiredStories() {
        try {
            LocalDateTime now = LocalDateTime.now();
            long deletedCount = storyRepository.deleteByExpiresAtBefore(now);
            log.info("Cleanup task: Deleted {} expired stories", deletedCount);
        } catch (Exception e) {
            log.error("Error during story cleanup task", e);
        }
    }

    @Transactional
    public Story likeStory(String storyId, String userId) {
        Story story = getStory(storyId);
        StoryLike.StoryLikeId likeId = new StoryLike.StoryLikeId(storyId, userId);

        try {
            if (!storyLikeRepository.existsById(likeId)) {
                StoryLike storyLike = new StoryLike();
                storyLike.setId(likeId);
                storyLikeRepository.save(storyLike);
                storyLikeRepository.flush(); // Force immediate flush to catch constraint violations
                
                int currentCount = story.getLikesCount() != null ? story.getLikesCount() : 0;
                story.setLikesCount(currentCount + 1);
                story = storyRepository.save(story);
                log.debug("Story liked: storyId={}, userId={}, newLikeCount={}", storyId, userId, story.getLikesCount());
            }
        } catch (org.springframework.dao.DataIntegrityViolationException e) {
            // Duplicate like - already liked
            log.debug("Story already liked by this user: storyId={}, userId={}", storyId, userId);
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
            
            int currentCount = story.getLikesCount() != null ? story.getLikesCount() : 0;
            story.setLikesCount(Math.max(0, currentCount - 1));
            story = storyRepository.save(story);
            log.debug("Story unliked: storyId={}, userId={}, newLikeCount={}", storyId, userId, story.getLikesCount());
        }
        return story;
    }

    @Transactional
    public Story viewStory(String storyId, String userId) {
        Story story = getStory(storyId);
        StoryView.StoryViewId viewId = new StoryView.StoryViewId(storyId, userId);

        try {
            // Try to save the view - if it already exists, the unique constraint will prevent duplicate
            if (!storyViewRepository.existsById(viewId)) {
                StoryView storyView = new StoryView();
                storyView.setId(viewId);
                storyViewRepository.save(storyView);
                storyViewRepository.flush(); // Force immediate flush to catch constraint violations
                
                int currentCount = story.getViewsCount() != null ? story.getViewsCount() : 0;
                story.setViewsCount(currentCount + 1);
                story = storyRepository.save(story);
                log.debug("Story viewed: storyId={}, userId={}, newViewCount={}", storyId, userId, story.getViewsCount());
            }
        } catch (org.springframework.dao.DataIntegrityViolationException |
                 org.springframework.dao.CannotAcquireLockException |
                 org.springframework.dao.DeadlockLoserDataAccessException e) {
            // Duplicate view or deadlock - silently ignore, view already counted
            log.debug("Story view skipped (duplicate or deadlock): storyId={}, userId={}", storyId, userId);
        }
        return story;
    }
}
