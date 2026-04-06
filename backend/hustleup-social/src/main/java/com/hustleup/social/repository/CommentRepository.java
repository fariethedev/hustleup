/**
 * Spring Data JPA repository for {@link com.hustleup.social.model.Comment} entities.
 *
 * <p>Provides CRUD operations for post comments, plus a single custom derived
 * query method for fetching a post's comment thread in chronological order.
 *
 * <h2>Inherited methods (from JpaRepository)</h2>
 * <ul>
 *   <li>{@code save(comment)} — insert or update a comment</li>
 *   <li>{@code findById(id)} — look up a comment by its UUID</li>
 *   <li>{@code deleteById(id)} — delete a comment by its UUID</li>
 *   <li>{@code count()} — total number of comments in the table</li>
 * </ul>
 *
 * <h2>Why no delete or edit endpoint?</h2>
 * Comment editing and deletion have not been implemented in the current API.
 * This repository could easily support them via the inherited {@code deleteById}
 * and {@code save} methods when that feature is added.
 */
package com.hustleup.social.repository;

import com.hustleup.social.model.Comment;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface CommentRepository extends JpaRepository<Comment, String> {

    /**
     * Returns all comments for a specific post, ordered oldest-first (ascending).
     *
     * <p>Chronological ordering makes sense for comment threads — you read the
     * conversation from top to bottom.  Spring Data generates:
     * {@code SELECT * FROM comments WHERE post_id = ? ORDER BY created_at ASC}
     *
     * <p>The method name breaks down as:
     * <ul>
     *   <li>{@code findBy} — SELECT query</li>
     *   <li>{@code PostId} — WHERE post_id = ?</li>
     *   <li>{@code OrderByCreatedAt} — ORDER BY created_at</li>
     *   <li>{@code Asc} — ascending (oldest first)</li>
     * </ul>
     *
     * @param postId the UUID string of the post whose comments to fetch
     * @return list of comments for that post, ordered by creation time ascending
     */
    List<Comment> findByPostIdOrderByCreatedAtAsc(String postId);
}
