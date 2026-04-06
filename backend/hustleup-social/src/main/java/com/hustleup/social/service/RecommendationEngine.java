/**
 * Content recommendation engine for the HustleUp social feed.
 *
 * <p>Produces a ranked list of posts tailored to a specific authenticated user ("recommend")
 * or a generic trending ranking for anonymous users ("trending").
 *
 * <h2>Scoring algorithm</h2>
 * Each candidate post receives a numeric score based on five additive signals:
 *
 * <pre>
 *  score = recency + engagement + social_boost + author_affinity + media_boost + seen_penalty
 *
 *  recency       = 100 × e^(-0.06 × age_in_hours)   — exponential decay, ~50 at 11.5 h
 *  engagement    = min(likes × 1.5 + comments × 3, 50)
 *  social_boost  = +70 if the post's author is followed by the viewer
 *  author_affinity = min(previous_likes_from_author × 12, 48)
 *  media_boost   = +15 if the post has images or video
 *  seen_penalty  = -20 if the viewer has already liked the post
 * </pre>
 *
 * Posts from the viewer themselves are excluded entirely.
 *
 * <h2>Why not a machine-learning model?</h2>
 * A hand-tuned scoring function is simpler to understand, debug, and adjust than a
 * trained model.  The weights above were chosen empirically and can be tweaked in code
 * without retraining.  When data volumes grow large enough to justify it, this class
 * could be replaced with a model-driven ranker without changing the controller.
 *
 * <h2>Candidate pool</h2>
 * Only posts from the last {@value #POOL_DAYS} days are considered, to keep the pool
 * small and computationally cheap.  Very old posts score near zero on recency anyway.
 *
 * <h2>Performance</h2>
 * All database queries are batched:
 * <ul>
 *   <li>One query for recent posts.</li>
 *   <li>One query for followed user UUIDs.</li>
 *   <li>One query for liked post IDs.</li>
 *   <li>One query for the author UUID → avatar URL mapping.</li>
 * </ul>
 * Scoring is done in memory (no per-post DB hits).
 */
package com.hustleup.social.service;

import com.hustleup.common.model.User;
import com.hustleup.common.repository.UserRepository;
import com.hustleup.social.dto.PostDto;
import com.hustleup.social.model.Follow;
import com.hustleup.social.model.Post;
import com.hustleup.social.repository.FollowRepository;
import com.hustleup.social.repository.PostLikeRepository;
import com.hustleup.social.repository.PostRepository;
import com.hustleup.common.storage.FileStorageService;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.*;
import java.util.stream.Collectors;

// @Service: Spring will manage this as a singleton bean, injectable anywhere in the application.
@Service
public class RecommendationEngine {

    // ── Algorithm constants ───────────────────────────────────────────────────

    /** Number of days to look back when building the candidate pool. Older posts are excluded. */
    private static final int  POOL_DAYS     = 10;

    /** Maximum number of ranked posts to return in one call. Prevents excessively large responses. */
    private static final int  MAX_RESULTS   = 60;

    /**
     * Exponential decay constant for the recency scoring formula.
     *
     * <p>The formula is {@code 100 × e^(-k × hours)}.  With k = 0.06:
     * <ul>
     *   <li>At age 0 h: score = 100</li>
     *   <li>At age ~11.5 h: score ≈ 50  (half-life)</li>
     *   <li>At age 46 h: score ≈ 7</li>
     *   <li>At age 10 days: score ≈ 0</li>
     * </ul>
     */
    private static final double RECENCY_K   = 0.06;

    // ── Dependencies ──────────────────────────────────────────────────────────

    /** Used to load the candidate pool of recent posts. */
    private final PostRepository     postRepo;

    /** Used to retrieve posts the viewer has liked, for author-affinity scoring. */
    private final PostLikeRepository likeRepo;

    /** Used to retrieve the viewer's follow list, for social-graph scoring. */
    private final FollowRepository   followRepo;

    /** Used to bulk-load author avatars for the resulting DTOs. */
    private final UserRepository     userRepo;

    /** Used to refresh pre-signed media URLs before including them in DTOs. */
    private final FileStorageService storageService;

    /**
     * Constructor injection: all five dependencies are required and final.
     * Spring provides them automatically.
     */
    public RecommendationEngine(PostRepository postRepo,
                                PostLikeRepository likeRepo,
                                FollowRepository followRepo,
                                UserRepository userRepo,
                                FileStorageService storageService) {
        this.postRepo      = postRepo;
        this.likeRepo      = likeRepo;
        this.followRepo    = followRepo;
        this.userRepo      = userRepo;
        this.storageService = storageService;
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Produces a fully personalised ranked feed for an authenticated user.
     *
     * <p>Steps:
     * <ol>
     *   <li>Load posts from the last {@value #POOL_DAYS} days as the candidate set.</li>
     *   <li>Load the viewer's following list (for the social-graph score signal).</li>
     *   <li>Load the viewer's liked post IDs and map them to author UUIDs (for author affinity).</li>
     *   <li>Score each post using the composite formula; exclude the viewer's own posts.</li>
     *   <li>Sort descending by score, cap at {@value #MAX_RESULTS}.</li>
     *   <li>Convert to DTOs with refreshed URLs and author avatars.</li>
     * </ol>
     *
     * @param userId            the UUID of the viewer
     * @param alreadyLikedPostIds the set of post IDs the viewer has already liked
     *                            (used for the "seen" penalty and passed in from the controller
     *                            to avoid a second DB query)
     * @return ranked list of PostDtos, most relevant first
     */
    public List<PostDto> recommend(UUID userId, Set<String> alreadyLikedPostIds) {
        String uid = userId.toString();

        // 1. Candidate pool — posts from the last POOL_DAYS days.
        List<Post> candidates = postRepo.findRecentPosts(LocalDateTime.now().minusDays(POOL_DAYS));

        // 2. Social graph — load the set of UUIDs this user follows.
        Set<String> following = followRepo.findByFollowerId(userId)
                .stream().map(f -> f.getFollowingId().toString()).collect(Collectors.toSet());

        // 3. Author affinity — count how many posts the viewer has liked per author.
        // More liked posts from an author → higher affinity → higher score for new posts.
        List<String> likedPostIds = likeRepo.findLikedPostIdsByUserId(uid);
        Map<String, Integer> authorAffinity = new HashMap<>();
        if (!likedPostIds.isEmpty()) {
            // Load the actual liked post objects to get their authorIds.
            postRepo.findAllById(likedPostIds).forEach(p -> {
                if (p.getAuthorId() != null)
                    authorAffinity.merge(p.getAuthorId(), 1, Integer::sum); // count per author
            });
        }

        // 4. Score, exclude own posts, sort by score descending, cap results.
        long nowMs = System.currentTimeMillis();
        List<Post> ranked = candidates.stream()
                .filter(p -> !uid.equals(p.getAuthorId())) // never recommend your own posts to yourself
                .sorted(Comparator.comparingDouble(
                        (Post p) -> score(p, nowMs, following, authorAffinity, alreadyLikedPostIds))
                        .reversed()) // highest score first
                .limit(MAX_RESULTS)
                .collect(Collectors.toList());

        // 5. Convert to DTOs.
        return toDtos(ranked, alreadyLikedPostIds);
    }

    /**
     * Produces a generic trending feed for unauthenticated users.
     *
     * <p>Uses only recency, engagement, and media boost — no personalisation.
     * Falls back to this when no JWT is present in the request.
     *
     * @return trending posts, scored by engagement + recency, capped at {@value #MAX_RESULTS}
     */
    public List<PostDto> trending() {
        long nowMs = System.currentTimeMillis();
        List<Post> candidates = postRepo.findRecentPosts(LocalDateTime.now().minusDays(POOL_DAYS));
        List<Post> ranked = candidates.stream()
                .sorted(Comparator.comparingDouble(
                        (Post p) -> trendingScore(p, nowMs)).reversed())
                .limit(MAX_RESULTS)
                .collect(Collectors.toList());
        return toDtos(ranked, Set.of()); // no liked-by info for anonymous users
    }

    // ── Scoring helpers ────────────────────────────────────────────────────────

    /**
     * Computes the personalised composite score for a single post.
     *
     * @param p              the post to score
     * @param nowMs          current epoch time in milliseconds (pre-computed for efficiency)
     * @param following      set of author UUIDs that the viewer follows
     * @param authorAffinity map of authorId → count of liked posts by that author
     * @param likedByMe      set of post IDs the viewer has already liked
     * @return the post's numeric score (higher = more relevant)
     */
    private double score(Post p, long nowMs, Set<String> following,
                         Map<String, Integer> authorAffinity, Set<String> likedByMe) {
        double r = recency(p, nowMs);                                           // decays over time
        double e = engagement(p);                                                // likes + comments signal
        double s = following.contains(p.getAuthorId()) ? 70.0 : 0.0;           // followed author boost
        double a = Math.min(authorAffinity.getOrDefault(p.getAuthorId(), 0) * 12.0, 48.0); // affinity (capped)
        double m = hasMedia(p) ? 15.0 : 0.0;                                   // media richness boost
        // Slight down-rank posts the user has already liked (they've seen them).
        double seen = likedByMe.contains(p.getId()) ? -20.0 : 0.0;
        return r + e + s + a + m + seen;
    }

    /**
     * Simplified trending score (no social signals, no affinity, no seen penalty).
     *
     * @param p     the post to score
     * @param nowMs current epoch time in milliseconds
     * @return the post's trending score
     */
    private double trendingScore(Post p, long nowMs) {
        return recency(p, nowMs) + engagement(p) + (hasMedia(p) ? 15.0 : 0.0);
    }

    /**
     * Computes the recency score using exponential decay.
     *
     * <p>A post created right now scores 100; the score halves approximately every
     * 11.5 hours.  After 10 days it is effectively 0, which is why the candidate
     * pool is limited to {@value #POOL_DAYS} days.
     *
     * @param p     the post whose creation time to use
     * @param nowMs current epoch time in milliseconds
     * @return a value in (0, 100] representing how recent this post is
     */
    private double recency(Post p, long nowMs) {
        if (p.getCreatedAt() == null) return 0.0;
        // Convert createdAt to epoch millis using UTC offset.
        double ageHours = (nowMs - p.getCreatedAt().toInstant(ZoneOffset.UTC).toEpochMilli()) / 3_600_000.0;
        return 100.0 * Math.exp(-RECENCY_K * ageHours); // exponential decay formula
    }

    /**
     * Computes the engagement score from likes and comments.
     *
     * <p>Comments are weighted 2× more than likes because they represent a stronger
     * signal of interest (the user took time to write something).  The cap of 50
     * prevents viral posts from dominating the feed indefinitely — every post eventually
     * decays on recency regardless of engagement.
     *
     * @param p the post to score
     * @return engagement score in [0, 50]
     */
    private double engagement(Post p) {
        double likes    = p.getLikesCount()    != null ? p.getLikesCount()    * 1.5 : 0;
        double comments = p.getCommentsCount() != null ? p.getCommentsCount() * 3.0 : 0;
        return Math.min(likes + comments, 50.0); // cap at 50 so viral posts don't dominate forever
    }

    /**
     * Returns true if the post has any attached media (images or videos).
     *
     * <p>Posts with rich media tend to be more engaging visually, so they receive
     * a small score boost.
     *
     * @param p the post to check
     * @return true if the post has a media_url or image_url set
     */
    private boolean hasMedia(Post p) {
        return (p.getMediaUrls() != null && !p.getMediaUrls().isBlank())
                || (p.getImageUrl() != null && !p.getImageUrl().isBlank());
    }

    // ── DTO conversion ────────────────────────────────────────────────────────

    /**
     * Converts a list of ranked Post entities to PostDtos, enriching each with:
     * <ul>
     *   <li>Refreshed (re-signed) media URLs.</li>
     *   <li>The author's current profile picture URL (bulk-loaded in one DB query).</li>
     *   <li>The {@code likedByCurrentUser} flag.</li>
     * </ul>
     *
     * @param posts    the ranked list of posts to convert
     * @param likedIds the set of post IDs liked by the current user (for the liked flag)
     * @return list of PostDtos ready for JSON serialisation
     */
    private List<PostDto> toDtos(List<Post> posts, Set<String> likedIds) {
        // Bulk-load all distinct author UUIDs in one DB call to avoid N+1 queries.
        List<UUID> authorUUIDs = posts.stream()
                .map(Post::getAuthorId)
                .filter(Objects::nonNull)
                .distinct()
                .map(id -> { try { return UUID.fromString(id); } catch (Exception e) { return null; } })
                .filter(Objects::nonNull)
                .collect(Collectors.toList());

        // Build a map of authorId (string) → avatarUrl for O(1) lookup below.
        Map<String, String> avatarMap = userRepo.findAllById(authorUUIDs).stream()
                .filter(u -> u.getAvatarUrl() != null && !u.getAvatarUrl().isBlank())
                .collect(Collectors.toMap(u -> u.getId().toString(), User::getAvatarUrl));

        // Convert each Post to a DTO, injecting the liked flag, URL refresher, and avatar.
        return posts.stream()
                .map(p -> PostDto.from(p, likedIds.contains(p.getId()),
                        storageService::refreshUrl, avatarMap.get(p.getAuthorId())))
                .collect(Collectors.toList());
    }
}
