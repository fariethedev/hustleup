/**
 * REST controller for the HustleUp social feed.
 *
 * <p>This is the most heavily used controller in the social service. It owns all
 * endpoints related to posts: creating posts, browsing the feed (with multiple sort
 * strategies), commenting, and liking/unliking posts.
 *
 * <h2>Base path</h2>
 * {@code /api/v1/feed}
 *
 * <h2>Authentication</h2>
 * Most write operations (create post, like, comment) require an authenticated user.
 * Read operations (feed, comments) are accessible to anonymous users, though
 * personalised features (recommendation feed, "liked by me" flags) require auth.
 *
 * <h2>Caching strategy</h2>
 * The standard feed variants (latest, trending, popular) are cached in Redis under the
 * {@code "feed"} cache key. This avoids hitting MySQL on every page load.
 * Any mutation (new post, like/unlike) evicts ALL entries from the feed cache so the
 * next read reflects the fresh data. The "recommended" sort is intentionally NOT cached
 * because it is personalised per user and changes rapidly.
 *
 * <h2>Kafka events</h2>
 * When a post is created, a {@code POST_CREATED} event is published to the
 * {@code feed-events} Kafka topic so downstream consumers (e.g. analytics, push
 * notification services) can react asynchronously without coupling to this request.
 */
package com.hustleup.social.controller;

import com.hustleup.social.dto.PostDto;
import com.hustleup.social.model.Comment;
import com.hustleup.social.model.Post;
import com.hustleup.social.model.PostLike;
import com.hustleup.social.model.Follow;
import com.hustleup.social.repository.CommentRepository;
import com.hustleup.social.repository.PostLikeRepository;
import com.hustleup.social.repository.PostRepository;
import com.hustleup.social.repository.FollowRepository;
import com.hustleup.common.storage.FileStorageService;
import com.hustleup.common.model.User;
import com.hustleup.common.model.Notification;
import com.hustleup.common.repository.UserRepository;
import com.hustleup.common.repository.NotificationRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.HashSet;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.Map;
import java.util.stream.Collectors;

import com.hustleup.social.event.FeedEventPublisher;
import com.hustleup.social.service.RecommendationEngine;

import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;

// @RestController = @Controller + @ResponseBody; every method return value is serialised
// to JSON automatically — no need to annotate each method with @ResponseBody.
@RestController

// All endpoints in this class are prefixed with /api/v1/feed.
@RequestMapping("/api/v1/feed")
public class FeedController {

    // ── Dependencies (injected via constructor) ────────────────────────────────

    /** JPA repository for Post entities; provides CRUD + custom query methods. */
    private final PostRepository postRepository;

    /** JPA repository for the PostLike join-table; tracks which user liked which post. */
    private final PostLikeRepository postLikeRepository;

    /**
     * Abstracts file uploads to the configured storage backend (local disk or S3).
     * Used to store media attached to posts and to refresh pre-signed URLs before
     * returning them to the client.
     */
    private final FileStorageService storageService;

    /** JPA repository for User entities; used to look up the authenticated user. */
    private final UserRepository userRepository;

    /** JPA repository for Comment entities; supports per-post comment threads. */
    private final CommentRepository commentRepository;

    /**
     * Kafka event publisher.  Fires-and-forgets events to the "feed-events" topic.
     * Failures are silently swallowed, so a Kafka outage never breaks the feed.
     */
    private final FeedEventPublisher feedEventPublisher;

    /** JPA repository for Follow relationships; used when sending follower notifications. */
    private final FollowRepository followRepository;

    /** JPA repository for Notification entities; used to fan out in-app notifications. */
    private final NotificationRepository notificationRepository;

    /**
     * Stateless scoring engine that produces a personalised feed for a given user.
     * It combines recency, engagement, social graph proximity, and author affinity.
     */
    private final RecommendationEngine recommendationEngine;

    /**
     * Constructor injection is preferred over field injection (@Autowired) because:
     * <ul>
     *   <li>It makes dependencies explicit and testable (you can pass mocks in unit tests).</li>
     *   <li>The class is immutable once constructed (all fields are final).</li>
     *   <li>Spring will fail fast at startup if a required bean is missing.</li>
     * </ul>
     */
    public FeedController(
            PostRepository postRepository,
            PostLikeRepository postLikeRepository,
            FileStorageService storageService,
            UserRepository userRepository,
            CommentRepository commentRepository,
            FeedEventPublisher feedEventPublisher,
            FollowRepository followRepository,
            NotificationRepository notificationRepository,
            RecommendationEngine recommendationEngine) {
        this.postRepository = postRepository;
        this.postLikeRepository = postLikeRepository;
        this.storageService = storageService;
        this.userRepository = userRepository;
        this.commentRepository = commentRepository;
        this.feedEventPublisher = feedEventPublisher;
        this.followRepository = followRepository;
        this.notificationRepository = notificationRepository;
        this.recommendationEngine = recommendationEngine;
    }

    // ── Endpoints ─────────────────────────────────────────────────────────────

    /**
     * Retrieves the social feed, optionally sorted.
     *
     * <p><b>GET /api/v1/feed?sort={strategy}</b>
     *
     * <p>Sort strategies:
     * <ul>
     *   <li>{@code latest} (default) – chronological, newest first</li>
     *   <li>{@code trending} – ordered by likes count descending</li>
     *   <li>{@code popular} – ordered by comment count descending</li>
     *   <li>{@code recommended} – personalised scoring via {@link RecommendationEngine};
     *       falls back to trending if the user is anonymous</li>
     * </ul>
     *
     * <p>The three non-personalised sorts are cached in Redis (cache name: {@code "feed"}).
     * The cache key is the sort value so "latest", "trending", and "popular" each get their
     * own entry. The {@code condition} attribute excludes "recommended" from caching
     * altogether since it is user-specific.
     *
     * <p>Each post in the response is converted to a {@link PostDto} which includes:
     * the refreshed media URLs, the author's avatar URL (bulk-loaded in one DB query to
     * avoid N+1 queries), and a flag indicating whether the current user has liked the post.
     *
     * @param sort the sort strategy; defaults to "latest" if omitted
     * @return 200 OK with a JSON array of {@link PostDto} objects
     */
    @GetMapping
    // @Cacheable tells Spring to store the return value in the "feed" Redis cache.
    // key = "#sort ?: 'latest'" means the cache key is the sort param (or "latest" if null).
    // condition prevents caching when sort == "recommended" (personalised, not shareable).
    // unless = "#result == null" prevents caching null responses (shouldn't happen, but defensive).
    @Cacheable(value = "feed", key = "#sort ?: 'latest'", condition = "!#sort.equals('recommended')", unless = "#result == null")
    public ResponseEntity<?> getFeed(@RequestParam(required = false, defaultValue = "latest") String sort) {

        // ── Personalised recommendation ───────────────────────────────────────
        if ("recommended".equals(sort)) {
            // Try to get the logged-in user; if anonymous, show trending fallback.
            return getCurrentUser().map(user -> {
                // Pre-fetch the set of posts this user has already liked so the engine
                // can down-rank posts the user has already engaged with.
                Set<String> liked = new HashSet<>(postLikeRepository.findLikedPostIdsByUserId(user.getId().toString()));
                return ResponseEntity.ok(recommendationEngine.recommend(user.getId(), liked));
            }).orElseGet(() -> ResponseEntity.ok(recommendationEngine.trending()));
        }

        // ── Standard sorts ────────────────────────────────────────────────────
        // Java 14+ switch expression — cleaner than if/else chains.
        List<Post> posts = switch (sort) {
            case "trending" -> postRepository.findAllByOrderByLikesCountDescCreatedAtDesc();
            case "popular"  -> postRepository.findAllByOrderByCommentsCountDescCreatedAtDesc();
            default         -> postRepository.findAllByOrderByCreatedAtDesc(); // "latest"
        };

        // Determine which posts the current user has already liked.
        // We do a single batch query (findByIdUserIdAndIdPostIdIn) rather than one query
        // per post — this is the N+1 query problem avoidance pattern.
        Set<String> likedPostIds = getCurrentUser()
                .map(user -> postLikeRepository.findByIdUserIdAndIdPostIdIn(
                                user.getId().toString(),
                                posts.stream().map(Post::getId).toList())
                        .stream()
                        .map(postLike -> postLike.getId().getPostId())
                        .collect(Collectors.toSet()))
                .orElseGet(HashSet::new); // anonymous user has no likes

        // Bulk-load author avatars so each feed card shows the author's profile picture.
        // Step 1: Collect all unique author IDs as UUIDs (safe parse, skip invalid).
        List<UUID> authorUUIDs = posts.stream()
                .map(Post::getAuthorId)
                .filter(Objects::nonNull)
                .distinct()
                .map(id -> { try { return UUID.fromString(id); } catch (Exception e) { return null; } })
                .filter(Objects::nonNull)
                .toList();
        // Step 2: One findAllById call instead of one findById per post.
        Map<String, String> authorAvatarMap = userRepository.findAllById(authorUUIDs).stream()
                .filter(u -> u.getAvatarUrl() != null && !u.getAvatarUrl().isBlank())
                .collect(Collectors.toMap(u -> u.getId().toString(), User::getAvatarUrl));

        // Convert each Post entity to a PostDto.  The urlRefresher generates a fresh
        // pre-signed URL for each media file (important if using S3 with expiring URLs).
        return ResponseEntity.ok(posts.stream()
                .map(post -> PostDto.from(post, likedPostIds.contains(post.getId()), storageService::refreshUrl, authorAvatarMap.get(post.getAuthorId())))
                .toList());
    }

    /**
     * Creates a new post on behalf of the authenticated user.
     *
     * <p><b>POST /api/v1/feed</b> (multipart/form-data)
     *
     * <p>Request parameters:
     * <ul>
     *   <li>{@code content} – text body of the post (required unless media is provided)</li>
     *   <li>{@code authorName} – optional display name override; defaults to user's full name</li>
     *   <li>{@code media} – optional list of image or video files</li>
     * </ul>
     *
     * <p>After saving, this method:
     * <ol>
     *   <li>Publishes a {@code POST_CREATED} Kafka event for async downstream processing.</li>
     *   <li>Creates in-app notifications for all users who follow the post author.</li>
     * </ol>
     *
     * <p>{@code @CacheEvict(allEntries = true)} nukes the entire "feed" cache so
     * the next feed request re-queries the database and includes the new post.
     *
     * @param content    the text content of the post
     * @param authorName optional display name; falls back to the user's registered full name
     * @param mediaFiles optional attached images or videos
     * @return 200 OK with the created {@link PostDto}, or 400 if neither content nor media provided
     */
    @PostMapping
    // Invalidate ALL feed cache entries because any sort variant might now be stale.
    @CacheEvict(value = "feed", allEntries = true)
    public ResponseEntity<?> createPost(
            // required = false + defaultValue = "" so React Native FormData empty-string values
            // or completely absent "content" fields don't cause a 400 Bad Request.
            @RequestParam(value = "content", required = false, defaultValue = "") String content,
            @RequestParam(value = "authorName", required = false) String authorName,
            @RequestParam(value = "anonymous", required = false, defaultValue = "false") boolean anonymous,
            @RequestParam(value = "media", required = false) List<MultipartFile> mediaFiles) {

        // This throws AccessDeniedException if no authenticated user is found,
        // which Spring Security converts to a 403 response.
        User currentUser = requireCurrentUser();
        String userId = currentUser.getId().toString();

        // Strip out any empty "files" that the HTTP client may have sent as placeholder parts.
        List<MultipartFile> validMediaFiles = mediaFiles == null ? List.of() : mediaFiles.stream()
                .filter(file -> file != null && !file.isEmpty())
                .toList();

        // A post must have at least some content or at least one media file.
        if ((content == null || content.isBlank()) && validMediaFiles.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Post content or media is required"));
        }

        // Build the Post entity manually (no Lombok @Builder here because the class uses
        // plain getters/setters for simplicity).
        Post post = new Post();
        post.setId(UUID.randomUUID().toString()); // generate a UUID string primary key
        post.setAuthorId(userId);
        post.setAuthorName(authorName != null && !authorName.isBlank() ? authorName : currentUser.getFullName());
        post.setContent(content == null ? "" : content.trim());
        post.setAnonymous(anonymous);

        if (!validMediaFiles.isEmpty()) {
            // Upload each file to storage and collect the resulting storage keys/URLs.
            List<String> urls = validMediaFiles.stream()
                    .map(storageService::store)
                    .toList();
            // Determine whether each file is an IMAGE or VIDEO.
            List<String> types = validMediaFiles.stream()
                    .map(this::resolveMediaType)
                    .toList();

            // Store as comma-separated strings in the database (denormalised for simplicity).
            post.setMediaUrls(String.join(",", urls));
            post.setMediaTypes(String.join(",", types));
            // imageUrl is the legacy single-image field kept for backward compatibility.
            post.setImageUrl(resolvePrimaryImageUrl(urls, types));
        }

        // Persist to MySQL.
        Post savedPost = postRepository.save(post);

        // Fire a Kafka event so other services can react (e.g., update a search index).
        feedEventPublisher.postCreated(savedPost.getId(), userId);

        // Notify each follower of this post author via in-app notification.
        // Skip for anonymous posts — notifying followers would reveal the poster's identity.
        // Wrapped in try/catch so a notification failure never rolls back the post itself.
        try {
            if (!anonymous) {
                List<Follow> followers = followRepository.findByFollowingId(currentUser.getId());
                if (!followers.isEmpty()) {
                    // Determine the display name to show in the notification title.
                    String displayName = currentUser.getFullName() != null && !currentUser.getFullName().isBlank()
                            ? currentUser.getFullName() : currentUser.getEmail().split("@")[0];
                    // Truncate post content to 80 chars for the notification snippet.
                    String snippet = post.getContent() != null && !post.getContent().isBlank()
                            ? post.getContent().substring(0, Math.min(post.getContent().length(), 80)) : "Shared new content";
                    // Build one Notification per follower and batch-save for efficiency.
                    List<Notification> notifs = followers.stream().map(f -> Notification.builder()
                            .userId(f.getFollowerId())
                            .title(displayName + " posted")
                            .message(snippet)
                            .notificationType("POST")
                            .referenceId(UUID.fromString(savedPost.getId()))
                            .build()).toList();
                    notificationRepository.saveAll(notifs);
                }
            }
        } catch (Exception ignored) {}

        return ResponseEntity.ok(PostDto.from(savedPost, false, storageService::refreshUrl));
    }

    /**
     * Retrieves the comment thread for a specific post, ordered oldest-first.
     *
     * <p><b>GET /api/v1/feed/{postId}/comments</b>
     *
     * <p>Auth: public (no authentication required).
     *
     * @param postId the string UUID of the post
     * @return 200 OK with a JSON array of {@link Comment} entities
     */
    @GetMapping("/{postId}/comments")
    public ResponseEntity<?> getComments(@PathVariable String postId) {
        // Chronological ordering (oldest first) makes sense for threaded discussions.
        return ResponseEntity.ok(commentRepository.findByPostIdOrderByCreatedAtAsc(postId));
    }

    /**
     * Adds a new comment (or reply) to a post.
     *
     * <p><b>POST /api/v1/feed/{postId}/comments</b>
     *
     * <p>Request body (JSON):
     * <pre>{
     *   "content": "Great post!",
     *   "parentId": "optional-parent-comment-id"  // omit for top-level comment
     * }</pre>
     *
     * <p>Auth: required. The commenter's identity is taken from the security context,
     * not from the request body, to prevent spoofing.
     *
     * <p>Also increments the denormalised {@code comments_count} counter on the Post row
     * so the feed can display comment counts without a COUNT(*) query per post.
     *
     * @param postId  the target post's UUID string
     * @param payload JSON map containing "content" and optional "parentId"
     * @return 200 OK with the saved {@link Comment} entity
     */
    @PostMapping("/{postId}/comments")
    public ResponseEntity<?> addComment(@PathVariable String postId, @RequestBody Map<String, String> payload) {
        String content = payload.get("content");
        if (content == null || content.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Comment content is required"));
        }

        User currentUser = requireCurrentUser();

        // Increment the denormalised counter on the Post entity.
        // This avoids a COUNT(*) query every time the feed is rendered.
        Post post = postRepository.findById(postId).orElseThrow();
        post.setCommentsCount((post.getCommentsCount() == null ? 0 : post.getCommentsCount()) + 1);
        postRepository.save(post);

        // Build the Comment entity.
        Comment comment = new Comment();
        comment.setId(UUID.randomUUID().toString());
        comment.setPostId(postId);
        comment.setAuthorId(currentUser.getId().toString());
        comment.setAuthorName(currentUser.getFullName());
        comment.setContent(content.trim());

        // If parentId is supplied, this is a reply; store the reference for threading.
        String parentId = payload.get("parentId");
        if (parentId != null && !parentId.isBlank()) {
            comment.setParentId(parentId);
        }

        return ResponseEntity.ok(commentRepository.save(comment));
    }

    /**
     * Likes a post on behalf of the authenticated user.
     *
     * <p><b>POST /api/v1/feed/{postId}/likes</b>
     *
     * <p>Auth: required.
     *
     * <p>Idempotent: if the user has already liked the post, the request is ignored
     * and the current state is returned without double-counting.
     *
     * <p>Also evicts the feed cache because the like count has changed.
     *
     * @param postId the UUID string of the post to like
     * @return 200 OK with the updated {@link PostDto} (likedByCurrentUser = true)
     */
    @PostMapping("/{postId}/likes")
    // Bust the cache on like so the updated like count shows next time the feed loads.
    @CacheEvict(value = "feed", allEntries = true)
    public ResponseEntity<?> likePost(@PathVariable String postId) {
        User currentUser = requireCurrentUser();
        Post post = postRepository.findById(postId).orElseThrow();

        // Build the composite primary key for the post_likes join table.
        PostLike.PostLikeId likeId = new PostLike.PostLikeId();
        likeId.setPostId(postId);
        likeId.setUserId(currentUser.getId().toString());

        // Only add a like row if one doesn't already exist (prevents duplicate likes).
        if (!postLikeRepository.existsById(likeId)) {
            PostLike postLike = PostLike.builder()
                    .id(likeId)
                    .build();
            postLikeRepository.save(postLike);
            // Increment the denormalised counter (same pattern as comments count).
            post.setLikesCount((post.getLikesCount() == null ? 0 : post.getLikesCount()) + 1);
            postRepository.save(post);
        }

        return ResponseEntity.ok(PostDto.from(post, true, storageService::refreshUrl));
    }

    /**
     * Removes the current user's like from a post.
     *
     * <p><b>DELETE /api/v1/feed/{postId}/likes</b>
     *
     * <p>Auth: required.
     *
     * <p>Idempotent: if the user hasn't liked the post, the request is a no-op.
     *
     * @param postId the UUID string of the post to unlike
     * @return 200 OK with the updated {@link PostDto} (likedByCurrentUser = false)
     */
    @DeleteMapping("/{postId}/likes")
    // Bust the cache so the reduced like count is visible on the next feed load.
    @CacheEvict(value = "feed", allEntries = true)
    public ResponseEntity<?> unlikePost(@PathVariable String postId) {
        User currentUser = requireCurrentUser();
        Post post = postRepository.findById(postId).orElseThrow();

        PostLike.PostLikeId likeId = new PostLike.PostLikeId();
        likeId.setPostId(postId);
        likeId.setUserId(currentUser.getId().toString());

        if (postLikeRepository.existsById(likeId)) {
            postLikeRepository.deleteById(likeId);
            // Decrement but never go below 0 (Math.max guard in case of data inconsistency).
            post.setLikesCount(Math.max(0, (post.getLikesCount() == null ? 0 : post.getLikesCount()) - 1));
            postRepository.save(post);
        }

        return ResponseEntity.ok(PostDto.from(post, false, storageService::refreshUrl));
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /**
     * Returns the currently authenticated {@link User}, throwing an exception if the
     * request is unauthenticated or the user record cannot be found in the database.
     *
     * <p>Use this for endpoints that <em>require</em> authentication. For optional
     * authentication (e.g. the feed GET), use {@link #getCurrentUser()} instead.
     *
     * @return the authenticated User entity
     * @throws org.springframework.security.access.AccessDeniedException if not authenticated
     * @throws RuntimeException if the authenticated email has no matching User record
     */
    private User requireCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        // AnonymousAuthenticationToken is Spring Security's marker for unauthenticated requests.
        if (authentication == null || !authentication.isAuthenticated()
                || authentication instanceof AnonymousAuthenticationToken) {
            throw new org.springframework.security.access.AccessDeniedException("Not authenticated");
        }
        // The principal name is the email address set by our JWT filter.
        String email = authentication.getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found: " + email));
    }

    /**
     * Returns an {@link java.util.Optional} of the currently authenticated {@link User}.
     *
     * <p>Returns {@code Optional.empty()} for anonymous requests instead of throwing.
     * Used for endpoints that work for both authenticated and unauthenticated users
     * but provide richer data when the user is known.
     *
     * @return Optional containing the User, or empty if anonymous
     */
    private java.util.Optional<User> getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated() || authentication instanceof AnonymousAuthenticationToken) {
            return java.util.Optional.empty();
        }

        String email = authentication.getName();
        return userRepository.findByEmail(email);
    }

    /**
     * Determines whether an uploaded file is an IMAGE or VIDEO based on its MIME type.
     *
     * @param file the uploaded multipart file
     * @return {@code "VIDEO"} if the file's content type starts with "video/", otherwise {@code "IMAGE"}
     */
    private String resolveMediaType(MultipartFile file) {
        String contentType = file.getContentType();
        if (contentType != null && contentType.startsWith("video/")) {
            return "VIDEO";
        }
        return "IMAGE";
    }

    /**
     * Scans parallel URL and type lists and returns the first URL that is typed as IMAGE.
     *
     * <p>This is stored in the legacy {@code image_url} column for clients that only
     * display a single thumbnail and do not yet support the full media array.
     *
     * @param urls  list of storage URLs in upload order
     * @param types parallel list of media types ("IMAGE" or "VIDEO")
     * @return the first image URL, or {@code null} if no image is found
     */
    private String resolvePrimaryImageUrl(List<String> urls, List<String> types) {
        for (int i = 0; i < urls.size(); i++) {
            if (i < types.size() && "IMAGE".equals(types.get(i))) {
                return urls.get(i);
            }
        }
        return null;
    }
}
