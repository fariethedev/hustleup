/**
 * Spring Data JPA repository for {@link com.hustleup.social.model.Post} entities.
 *
 * <h2>How Spring Data JPA repositories work</h2>
 * <p>By extending {@link org.springframework.data.jpa.repository.JpaRepository}, this
 * interface gets a full suite of CRUD methods for free (save, findById, findAll, delete,
 * count, etc.) without writing a single line of SQL.  Spring Data generates the
 * implementation class at startup using proxy-based code generation.
 *
 * <h2>Derived query methods</h2>
 * Spring Data parses the method name to automatically generate a JPQL query:
 * <ul>
 *   <li>{@code findAllByOrderByCreatedAtDesc} → {@code SELECT p FROM Post p ORDER BY p.createdAt DESC}</li>
 *   <li>{@code findByAuthorIdOrderByCreatedAtDesc} → filters by author, ordered by date</li>
 *   <li>{@code findAllByOrderByLikesCountDescCreatedAtDesc} → double-sort: likes then date</li>
 * </ul>
 * No SQL or JPQL annotations needed — the method name IS the query specification.
 *
 * <h2>Custom JPQL queries</h2>
 * For queries that are too complex to express via method names, {@code @Query} is used
 * with JPQL (Java Persistence Query Language — similar to SQL but uses class/field names,
 * not table/column names).
 *
 * <h2>Type parameters</h2>
 * {@code JpaRepository<Post, String>} — the second type parameter is the type of the
 * primary key field.  Post uses a {@code String} UUID as its ID.
 */
package com.hustleup.social.repository;

import com.hustleup.social.model.Post;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDateTime;
import java.util.List;

public interface PostRepository extends JpaRepository<Post, String> {

    /**
     * Returns all posts ordered by creation date, newest first.
     *
     * <p>Used for the default "latest" feed sort.
     * Spring Data derives the query from the method name:
     * {@code ORDER BY created_at DESC}.
     *
     * @return all posts, newest first
     */
    List<Post> findAllByOrderByCreatedAtDesc();

    /**
     * Returns all posts by a specific author, ordered by creation date.
     *
     * <p>Used for profile pages that display a user's own posts.
     *
     * @param authorId the UUID string of the author to filter by
     * @return the author's posts, newest first
     */
    List<Post> findByAuthorIdOrderByCreatedAtDesc(String authorId);

    /**
     * Returns all posts ordered by like count (descending), then creation date (descending).
     *
     * <p>Used for the "trending" feed sort — posts with more likes appear first;
     * ties are broken by recency.
     *
     * @return all posts, most-liked first
     */
    List<Post> findAllByOrderByLikesCountDescCreatedAtDesc();

    /**
     * Returns all posts ordered by comment count (descending), then creation date.
     *
     * <p>Used for the "popular" feed sort — posts that sparked the most discussion
     * appear first.
     *
     * @return all posts, most-commented first
     */
    List<Post> findAllByOrderByCommentsCountDescCreatedAtDesc();

    /**
     * Fetches posts created within a recent time window, ordered newest first.
     *
     * <p>Used by the {@link com.hustleup.social.service.RecommendationEngine} to build
     * the candidate pool for personalised and trending feeds.  Limiting to a time window
     * (e.g. last 10 days) keeps the pool fresh and the ranking algorithm fast.
     *
     * <p>Uses {@code @Query} because method-name derivation cannot express
     * {@code WHERE created_at >= :since} cleanly. JPQL uses the Java field name
     * ({@code p.createdAt}) not the DB column name ({@code created_at}).
     *
     * @param since the lower bound timestamp; only posts created after this time are returned
     * @return recent posts, newest first
     */
    @Query("SELECT p FROM Post p WHERE p.createdAt >= :since ORDER BY p.createdAt DESC")
    List<Post> findRecentPosts(@Param("since") LocalDateTime since);

    /**
     * Fetches posts authored by any user in the given list, ordered newest first.
     *
     * <p>Used by the recommendation engine to load posts from users the current viewer
     * follows, for the "social graph boost" scoring signal.
     *
     * <p>{@code IN :authorIds} is a JPQL collection parameter — Hibernate expands it
     * to {@code IN ('id1', 'id2', ...)} at query time.
     *
     * @param authorIds list of author UUID strings to filter by
     * @return posts from those authors, newest first
     */
    @Query("SELECT p FROM Post p WHERE p.authorId IN :authorIds ORDER BY p.createdAt DESC")
    List<Post> findByAuthorIdIn(@Param("authorIds") List<String> authorIds);
}
