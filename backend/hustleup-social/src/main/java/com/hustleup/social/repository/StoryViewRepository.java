package com.hustleup.social.repository;

import com.hustleup.social.model.StoryView;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface StoryViewRepository extends JpaRepository<StoryView, StoryView.StoryViewId> {
    long countByIdStoryId(String storyId);
    List<StoryView> findByIdUserIdAndIdStoryIdIn(String userId, List<String> storyIds);
}
