package com.hustleup.social.repository;

import com.hustleup.social.model.PostLike;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface PostLikeRepository extends JpaRepository<PostLike, PostLike.PostLikeId> {
    boolean existsById(PostLike.PostLikeId id);
    long countByIdPostId(String postId);
    List<PostLike> findByIdUserIdAndIdPostIdIn(String userId, Collection<String> postIds);
}
