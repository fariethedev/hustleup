package com.hustleup.social;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface StoryLikeRepository extends JpaRepository<StoryLike, StoryLike.StoryLikeId> {
    List<StoryLike> findByIdUserIdAndIdStoryIdIn(String userId, List<String> storyIds);
}
