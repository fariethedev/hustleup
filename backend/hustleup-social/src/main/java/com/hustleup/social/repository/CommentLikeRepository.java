package com.hustleup.social.repository;

import com.hustleup.social.model.CommentLike;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.List;

/**
 * Likes on comments. Mirrors {@link PostLikeRepository}'s query shapes exactly, for the
 * same reasons — see that interface.
 */
public interface CommentLikeRepository extends JpaRepository<CommentLike, CommentLike.CommentLikeId> {

    /**
     * Which of these comments the given user has liked.
     *
     * <p>One query for a whole comment thread rather than one per comment. A busy post can
     * carry dozens of comments and their replies, and the per-comment version is the N+1
     * problem in its most literal form.
     */
    List<CommentLike> findByIdUserIdAndIdCommentIdIn(String userId, Collection<String> commentIds);

    /** Removes every like on a comment, for when the comment or its post is deleted. */
    @Transactional
    void deleteByIdCommentId(String commentId);

    /**
     * Removes every like on any of these comments — used when a post is deleted, so the
     * whole thread's likes go in one statement rather than one per comment.
     */
    @Transactional
    void deleteByIdCommentIdIn(Collection<String> commentIds);
}
