package com.hustleup.social;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface StoryViewRepository extends JpaRepository<StoryView, StoryView.StoryViewId> {
    long countByIdStoryId(String storyId);
}
