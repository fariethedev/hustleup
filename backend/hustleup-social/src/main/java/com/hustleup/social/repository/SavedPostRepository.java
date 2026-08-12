/**
 * Spring Data JPA repository for {@link com.hustleup.social.model.SavedPost} entities.
 *
 * <p>Mirrors {@link PostLikeRepository}'s query shapes exactly — see that interface's
 * javadoc for the rationale behind the composite-key {@code existsById} check and the
 * batch {@code findByIdUserIdAndIdPostIdIn} lookup (avoids N+1 queries when computing
 * "did I save this?" for every post in a feed page).
 */
package com.hustleup.social.repository;

import com.hustleup.social.model.SavedPost;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface SavedPostRepository extends JpaRepository<SavedPost, SavedPost.SavedPostId> {

    boolean existsById(SavedPost.SavedPostId id);

    /** Batch check: which of these posts has this user saved? One query, not one-per-post. */
    List<SavedPost> findByIdUserIdAndIdPostIdIn(String userId, Collection<String> postIds);

    /** Every post ID a user has saved, newest save first — powers the "Saved" tab. */
    @Query("SELECT sp.id.postId FROM SavedPost sp WHERE sp.id.userId = :userId ORDER BY sp.createdAt DESC")
    List<String> findSavedPostIdsByUserId(@Param("userId") String userId);
}
