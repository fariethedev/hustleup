package com.hustleup.socialservice.social;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface PostLikeRepository extends JpaRepository<PostLike, PostLike.PostLikeId> {
    List<PostLike> findByIdUserIdAndIdPostIdIn(String userId, Collection<String> postIds);
}
