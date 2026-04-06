/**
 * Spring Data JPA repository for {@link com.hustleup.social.model.PostLike} entities.
 *
 * <p>The {@code PostLike} entity uses a composite primary key ({@link com.hustleup.social.model.PostLike.PostLikeId})
 * consisting of ({@code post_id}, {@code user_id}).  This repository's type parameter
 * is therefore {@code JpaRepository<PostLike, PostLike.PostLikeId>}.
 *
 * <h2>Idempotent like checking</h2>
 * The {@link #existsById} method (inherited from JpaRepository) takes a
 * {@code PostLike.PostLikeId} object and executes an efficient {@code EXISTS} query
 * against the primary key — no full row fetch needed.  The controller uses this to
 * prevent duplicate likes.
 *
 * <h2>Batch query for liked-post flags</h2>
 * {@link #findByIdUserIdAndIdPostIdIn} loads all likes for one user across a batch of
 * posts in a single SQL query.  This is critical for the feed: instead of issuing one
 * query per post to check if the user liked it (N+1), we issue one query for all posts
 * at once (1 query).
 */
package com.hustleup.social.repository;

import com.hustleup.social.model.PostLike;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface PostLikeRepository extends JpaRepository<PostLike, PostLike.PostLikeId> {

    /**
     * Checks whether a specific like record exists (composite key lookup).
     *
     * <p>Inherited from {@link JpaRepository}, included here for documentation clarity.
     * Spring Data generates {@code SELECT COUNT(*) > 0 FROM post_likes WHERE post_id = ? AND user_id = ?}.
     *
     * @param id the composite key containing postId and userId
     * @return true if the like row exists, false otherwise
     */
    boolean existsById(PostLike.PostLikeId id);

    /**
     * Counts the number of likes on a specific post.
     *
     * <p>Spring Data derives this from the method name:
     * {@code SELECT COUNT(*) FROM post_likes WHERE post_id = ?}
     *
     * <p>Note: the denormalised {@code likes_count} column on the Post entity is
     * generally used in preference to this count query for performance.  This method
     * is available for verification/audit purposes.
     *
     * @param postId the UUID string of the post to count likes for
     * @return the number of likes on that post
     */
    long countByIdPostId(String postId);

    /**
     * Loads all like records for a specific user across a batch of post IDs.
     *
     * <p>Spring Data derives the query:
     * {@code SELECT * FROM post_likes WHERE user_id = ? AND post_id IN (?,...)}
     *
     * <p>Used by the feed controller to determine which posts in the current feed
     * the user has already liked — in a single efficient batch query rather than one
     * query per post.
     *
     * @param userId  the UUID string of the user
     * @param postIds the collection of post UUID strings to check
     * @return list of PostLike records for the user among the specified posts
     */
    List<PostLike> findByIdUserIdAndIdPostIdIn(String userId, Collection<String> postIds);

    /**
     * Returns all post IDs that a user has ever liked.
     *
     * <p>Used by the {@link com.hustleup.social.service.RecommendationEngine} to build
     * the "author affinity" scoring signal: if a user has liked many posts by author X,
     * then new posts from author X should score higher in the personalised feed.
     *
     * <p>Returns only the IDs (not full rows) to keep the result set small.
     *
     * @param userId the UUID string of the user whose liked posts to retrieve
     * @return list of post UUID strings that the user has liked
     */
    @Query("SELECT pl.id.postId FROM PostLike pl WHERE pl.id.userId = :userId")
    List<String> findLikedPostIdsByUserId(@Param("userId") String userId);
}
