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
import com.hustleup.social.model.CommentLike;
import com.hustleup.social.dto.CommentDto;
import com.hustleup.social.model.Post;
import com.hustleup.social.model.PostLike;
import com.hustleup.social.model.SavedPost;
import com.hustleup.social.model.Follow;
import com.hustleup.social.repository.CommentRepository;
import com.hustleup.social.repository.CommentLikeRepository;
import com.hustleup.social.repository.PostLikeRepository;
import com.hustleup.social.repository.SavedPostRepository;
import com.hustleup.social.repository.PostRepository;
import com.hustleup.social.repository.FollowRepository;
import com.hustleup.social.model.Community;
import com.hustleup.social.repository.CommunityRepository;
import com.hustleup.social.repository.CommunityMemberRepository;
import com.hustleup.common.storage.FileStorageService;
import com.hustleup.common.model.User;
import com.hustleup.common.model.Notification;
import com.hustleup.common.repository.UserRepository;
import com.hustleup.common.repository.NotificationRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.Map;
import java.util.stream.Collectors;

import com.hustleup.social.event.FeedEventPublisher;
import com.hustleup.social.service.RecommendationEngine;
import com.hustleup.common.subscription.PremiumAccess;

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

    /** JPA repository for the SavedPost join-table; tracks which user bookmarked which post. */
    private final SavedPostRepository savedPostRepository;

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

    /** Likes on comments — same shape and batching as postLikeRepository. */
    private final CommentLikeRepository commentLikeRepository;

    /**
     * Kafka event publisher.  Fires-and-forgets events to the "feed-events" topic.
     * Failures are silently swallowed, so a Kafka outage never breaks the feed.
     */
    private final FeedEventPublisher feedEventPublisher;

    /** JPA repository for Follow relationships; used when sending follower notifications. */
    private final FollowRepository followRepository;

    /** JPA repository for Notification entities; used to fan out in-app notifications. */
    private final NotificationRepository notificationRepository;

    /** Communities a post can belong to, and who is in them — see the feeds above. */
    private final CommunityRepository communityRepository;
    private final CommunityMemberRepository communityMemberRepository;

    /**
     * Stateless scoring engine that produces a personalised feed for a given user.
     * It combines recency, engagement, social graph proximity, and author affinity.
     */
    private final RecommendationEngine recommendationEngine;

    /**
     * Decides whether the caller holds Premium. Anonymous posting is a paid capability, and
     * this is where that is actually enforced — the composer's toggle only controls what the
     * UI offers, not what the API accepts.
     */
    private final PremiumAccess premiumAccess;

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
            SavedPostRepository savedPostRepository,
            FileStorageService storageService,
            UserRepository userRepository,
            CommentRepository commentRepository,
            CommentLikeRepository commentLikeRepository,
            FeedEventPublisher feedEventPublisher,
            FollowRepository followRepository,
            NotificationRepository notificationRepository,
            RecommendationEngine recommendationEngine,
            PremiumAccess premiumAccess,
            CommunityRepository communityRepository,
            CommunityMemberRepository communityMemberRepository) {
        this.postRepository = postRepository;
        this.postLikeRepository = postLikeRepository;
        this.savedPostRepository = savedPostRepository;
        this.storageService = storageService;
        this.userRepository = userRepository;
        this.commentRepository = commentRepository;
        this.commentLikeRepository = commentLikeRepository;
        this.feedEventPublisher = feedEventPublisher;
        this.followRepository = followRepository;
        this.notificationRepository = notificationRepository;
        this.recommendationEngine = recommendationEngine;
        this.premiumAccess = premiumAccess;
        this.communityRepository = communityRepository;
        this.communityMemberRepository = communityMemberRepository;
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

        return ResponseEntity.ok(decorate(posts));
    }

    /**
     * Turns a page of posts into fully-populated DTOs.
     *
     * <p>Extracted so the four feeds that now exist — everything, following, your
     * communities, and one community — return cards identical in every respect except which
     * posts are in them. While this logic lived inline in the main feed, any new feed either
     * duplicated forty lines of batch loading or quietly shipped without saved flags, top
     * comments or avatars.
     *
     * <p>Every lookup is batched: rendering a feed costs a fixed handful of queries whatever
     * its length, rather than one per card per attribute.
     */
    private List<PostDto> decorate(List<Post> posts) {
        if (posts.isEmpty()) return List.of();

        List<String> postIds = posts.stream().map(Post::getId).toList();
        Optional<User> viewer = getCurrentUser();

        // What the viewer has already done to these posts. An anonymous visitor has done
        // none of it, so all three queries are skipped rather than run against a null id.
        Set<String> likedPostIds = viewer
                .map(user -> postLikeRepository.findByIdUserIdAndIdPostIdIn(user.getId().toString(), postIds)
                        .stream().map(like -> like.getId().getPostId()).collect(Collectors.toSet()))
                .orElseGet(HashSet::new);

        Set<String> savedPostIds = viewer
                .map(user -> savedPostRepository.findByIdUserIdAndIdPostIdIn(user.getId().toString(), postIds)
                        .stream().map(saved -> saved.getId().getPostId()).collect(Collectors.toSet()))
                .orElseGet(HashSet::new);

        Set<String> repostedPostIds = viewer
                .map(user -> postRepository.findByAuthorIdAndRepostOfIdIn(user.getId().toString(), postIds)
                        .stream().map(Post::getRepostOfId).collect(Collectors.toSet()))
                .orElseGet(HashSet::new);

        // The originals behind any reposts on this page, as one batch.
        List<String> quotedIds = posts.stream()
                .map(Post::getRepostOfId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        Map<String, Post> quotedPosts = quotedIds.isEmpty() ? Map.of()
                : postRepository.findAllById(quotedIds).stream()
                        .collect(Collectors.toMap(Post::getId, post -> post, (a, b) -> a));

        // Top-comment preview per post (one indexed query per post — acceptable for a feed
        // page's bounded size; see CommentRepository#findFirstByPostIdOrderByCreatedAtDesc).
        Map<String, PostDto.TopCommentDto> topComments = posts.stream()
                .map(post -> Map.entry(post.getId(), commentRepository.findFirstByPostIdOrderByCreatedAtDesc(post.getId())))
                .filter(entry -> entry.getValue().isPresent())
                .collect(Collectors.toMap(Map.Entry::getKey,
                        entry -> new PostDto.TopCommentDto(entry.getValue().get().getAuthorName(), entry.getValue().get().getContent())));

        // Avatars for the authors of both the posts and anything they quote, in one call.
        List<UUID> authorUUIDs = java.util.stream.Stream.concat(
                        posts.stream().map(Post::getAuthorId),
                        quotedPosts.values().stream().map(Post::getAuthorId))
                .filter(Objects::nonNull)
                .distinct()
                .map(id -> { try { return UUID.fromString(id); } catch (Exception e) { return null; } })
                .filter(Objects::nonNull)
                .toList();
        Map<String, String> authorAvatarMap = userRepository.findAllById(authorUUIDs).stream()
                .filter(u -> u.getAvatarUrl() != null && !u.getAvatarUrl().isBlank())
                .collect(Collectors.toMap(u -> u.getId().toString(), User::getAvatarUrl));

        // Community names, so a card can say which group it was posted into without the
        // client having to resolve an id per row.
        List<String> communityIds = posts.stream()
                .map(Post::getCommunityId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        Map<String, Community> communities = communityIds.isEmpty() ? Map.of()
                : communityRepository.findByIdIn(communityIds).stream()
                        .collect(Collectors.toMap(Community::getId, community -> community, (a, b) -> a));

        return posts.stream().map(post -> {
            PostDto dto = PostDto.from(post,
                    likedPostIds.contains(post.getId()),
                    savedPostIds.contains(post.getId()),
                    storageService::refreshUrl,
                    authorAvatarMap.get(post.getAuthorId()),
                    topComments.get(post.getId()));
            dto.setRepostedByCurrentUser(repostedPostIds.contains(post.getId()));

            Post quoted = post.getRepostOfId() == null ? null : quotedPosts.get(post.getRepostOfId());
            // A repost whose original has since been deleted keeps the reposter's own
            // commentary and simply loses the quote frame, rather than vanishing from the
            // timeline and taking their words with it.
            if (quoted != null) {
                dto.setRepostOf(PostDto.quoted(quoted, storageService::refreshUrl,
                        authorAvatarMap.get(quoted.getAuthorId())));
            }

            Community community = post.getCommunityId() == null ? null : communities.get(post.getCommunityId());
            if (community != null) {
                dto.setCommunityName(community.getName());
                dto.setCommunitySlug(community.getSlug());
            }
            return dto;
        }).toList();
    }

    /**
     * Posts from the people the caller follows, newest first.
     *
     * <p><b>GET /api/v1/feed/following</b> — auth required.
     *
     * <p>Not cached, unlike the open feed: the result is different for every caller, so a
     * shared cache entry would serve one person's following list to everybody. Following
     * nobody returns an empty list rather than falling back to the open feed — showing
     * strangers under a tab labelled "Following" would be a lie about where they came from.
     */
    @GetMapping("/following")
    public ResponseEntity<?> followingFeed() {
        User me = requireCurrentUser();
        List<String> followingIds = followRepository.findByFollowerId(me.getId()).stream()
                .map(follow -> follow.getFollowingId().toString())
                .toList();
        if (followingIds.isEmpty()) return ResponseEntity.ok(List.of());
        return ResponseEntity.ok(decorate(postRepository.findByAuthorIdIn(followingIds)));
    }

    /**
     * Posts from every community the caller has joined, newest first.
     *
     * <p><b>GET /api/v1/feed/communities</b> — auth required.
     *
     * <p>This is the point of communities: someone who joined "Cars in Lublin" opens this
     * tab and gets cars, instead of everything everyone posted today. Membership is the
     * filter, so the tab's contents are something the reader chose rather than something
     * a ranking decided for them.
     */
    @GetMapping("/communities")
    public ResponseEntity<?> communitiesFeed() {
        User me = requireCurrentUser();
        List<String> communityIds = communityMemberRepository.findByIdMemberId(me.getId().toString()).stream()
                .map(membership -> membership.getId().getCommunityId())
                .toList();
        if (communityIds.isEmpty()) return ResponseEntity.ok(List.of());
        return ResponseEntity.ok(decorate(postRepository.findByCommunityIdInOrderByCreatedAtDesc(communityIds)));
    }

    /**
     * One community's own feed, newest first.
     *
     * <p><b>GET /api/v1/feed/community/{idOrSlug}</b> — public, so someone deciding whether
     * to join can see what actually gets posted there first.
     */
    @GetMapping("/community/{idOrSlug}")
    public ResponseEntity<?> communityFeed(@PathVariable String idOrSlug) {
        Community community = communityRepository.findById(idOrSlug)
                .or(() -> communityRepository.findBySlug(idOrSlug))
                .orElse(null);
        if (community == null) return ResponseEntity.status(404).body(Map.of("error", "Community not found"));
        return ResponseEntity.ok(decorate(postRepository.findByCommunityIdOrderByCreatedAtDesc(community.getId())));
    }

    /**
     * Reposts a post onto the caller's own timeline.
     *
     * <p><b>POST /api/v1/feed/{postId}/repost</b> — auth required. Body is optional:
     * {@code {"comment": "worth reading"}} adds the reposter's own words above the quote.
     *
     * <p>A repost is a real post rather than a counter on the original. That is what lets it
     * carry commentary, sit in the timeline at the moment it was shared, and be liked and
     * replied to on its own terms — and it means deleting a repost never touches whatever it
     * quoted.
     *
     * <p>Reposting is idempotent per person: a second call returns the repost already made
     * instead of littering the timeline with duplicates.
     */
    @PostMapping("/{postId}/repost")
    @CacheEvict(value = "feed", allEntries = true)
    public ResponseEntity<?> repost(@PathVariable String postId,
                                    @RequestBody(required = false) Map<String, String> payload) {
        User me = requireCurrentUser();
        Post original = postRepository.findById(postId).orElse(null);
        if (original == null) return ResponseEntity.status(404).body(Map.of("error", "Post not found"));

        // Repost the thing that was actually written, not the share of it. Without this a
        // chain of reposts nests quote inside quote, and the original drifts further from
        // every reader who eventually sees it.
        Post target = original.getRepostOfId() != null
                ? postRepository.findById(original.getRepostOfId()).orElse(original)
                : original;

        if (target.getAuthorId().equals(me.getId().toString())) {
            return ResponseEntity.badRequest().body(Map.of("error", "You can't repost your own post"));
        }
        // An anonymous post is anonymous because its author asked for that. A repost names
        // the original's author in the quote frame, so allowing it would undo the promise
        // the platform made when the post was published.
        if (target.isAnonymous()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Anonymous posts can't be reposted"));
        }

        Optional<Post> existing = postRepository.findFirstByAuthorIdAndRepostOfId(
                me.getId().toString(), target.getId());
        if (existing.isPresent()) {
            return ResponseEntity.ok(decorate(List.of(existing.get())).get(0));
        }

        String comment = payload == null ? null : payload.get("comment");

        Post share = new Post();
        share.setId(UUID.randomUUID().toString());
        share.setAuthorId(me.getId().toString());
        share.setAuthorName(me.displayName());
        share.setContent(comment == null ? "" : comment.trim());
        share.setRepostOfId(target.getId());
        // A repost stays where the original lives, so sharing a community post inside that
        // community keeps it in the community rather than leaking it to the open feed.
        share.setCommunityId(target.getCommunityId());
        Post saved = postRepository.save(share);

        // Recount rather than increment: the count is then self-correcting if a repost is
        // ever removed by a path that forgets to decrement it.
        target.setRepostCount((int) postRepository.countByRepostOfId(target.getId()));
        postRepository.save(target);

        notifyRepost(me, target, saved);

        return ResponseEntity.status(HttpStatus.CREATED).body(decorate(List.of(saved)).get(0));
    }

    /**
     * Undoes the caller's repost of a post.
     *
     * <p><b>DELETE /api/v1/feed/{postId}/repost</b> — auth required. Deleting the repost row
     * removes it from every timeline it appeared in; the original is untouched beyond its
     * count being recomputed.
     */
    @DeleteMapping("/{postId}/repost")
    @CacheEvict(value = "feed", allEntries = true)
    public ResponseEntity<?> undoRepost(@PathVariable String postId) {
        User me = requireCurrentUser();
        Post existing = postRepository.findFirstByAuthorIdAndRepostOfId(me.getId().toString(), postId).orElse(null);
        if (existing == null) return ResponseEntity.status(404).body(Map.of("error", "You haven't reposted this"));

        postRepository.delete(existing);
        postRepository.findById(postId).ifPresent(original -> {
            original.setRepostCount((int) postRepository.countByRepostOfId(postId));
            postRepository.save(original);
        });
        return ResponseEntity.ok(Map.of("reposted", false));
    }

    /** Tells the original author someone shared their post. Best-effort, like every other alert here. */
    private void notifyRepost(User sharer, Post original, Post share) {
        try {
            notificationRepository.save(Notification.builder()
                    .userId(UUID.fromString(original.getAuthorId()))
                    .title(sharer.displayName() + " reposted your post")
                    .message(original.getContent() == null || original.getContent().isBlank()
                            ? "Shared your post"
                            : original.getContent().substring(0, Math.min(original.getContent().length(), 80)))
                    .notificationType("REPOST")
                    .referenceId(UUID.fromString(share.getId()))
                    .build());
        } catch (Exception ignored) {
        }
    }

    /**
     * Returns every post linked to a specific marketplace listing, newest first.
     *
     * <p><b>GET /api/v1/feed/listing/{listingId}</b> — public, no auth required.
     *
     * <p>Used by an EVENT listing's detail page to show the seller's posted updates about
     * the event (announcements, photos, schedule changes) below the listing description.
     * Unlike the main feed, this is not Redis-cached — traffic to a single listing's update
     * thread is low and freshness matters more (a seller just posted an update and expects
     * buyers to see it immediately).
     *
     * @param listingId the UUID string of the listing to fetch updates for
     * @return 200 OK with a JSON array of {@link PostDto}, newest first
     */
    @GetMapping("/listing/{listingId}")
    public ResponseEntity<List<PostDto>> getByListing(@PathVariable String listingId) {
        List<Post> posts = postRepository.findByLinkedListingIdOrderByCreatedAtDesc(listingId);
        Set<String> likedPostIds = getCurrentUser()
                .map(user -> postLikeRepository.findByIdUserIdAndIdPostIdIn(
                                user.getId().toString(),
                                posts.stream().map(Post::getId).toList())
                        .stream()
                        .map(postLike -> postLike.getId().getPostId())
                        .collect(Collectors.toSet()))
                .orElseGet(HashSet::new);
        return ResponseEntity.ok(posts.stream()
                .map(post -> PostDto.from(post, likedPostIds.contains(post.getId()), storageService::refreshUrl))
                .toList());
    }

    /**
     * Every post by one author, newest first.
     *
     * <p><b>GET /api/v1/feed/user/{userId}</b> — public, no auth required.
     *
     * <p>The profile page used to fetch the whole feed and filter it in the browser by
     * author id, which meant a profile only ever showed the posts that happened to be in
     * the feed page already loaded — anyone with older posts appeared to have none. This
     * queries by author instead, so a profile shows the author's actual history.
     *
     * <p>Anonymous posts are excluded. They are stripped of author identity in the feed on
     * purpose, so listing them under the author's profile would undo exactly that.
     */
    @GetMapping("/user/{userId}")
    public ResponseEntity<List<PostDto>> getByAuthor(@PathVariable String userId) {
        List<Post> posts = postRepository.findByAuthorIdOrderByCreatedAtDesc(userId).stream()
                .filter(post -> !post.isAnonymous())
                .toList();

        Set<String> likedPostIds = getCurrentUser()
                .map(user -> postLikeRepository.findByIdUserIdAndIdPostIdIn(
                                user.getId().toString(),
                                posts.stream().map(Post::getId).toList())
                        .stream()
                        .map(postLike -> postLike.getId().getPostId())
                        .collect(Collectors.toSet()))
                .orElseGet(HashSet::new);

        return ResponseEntity.ok(posts.stream()
                .map(post -> PostDto.from(post, likedPostIds.contains(post.getId()), storageService::refreshUrl))
                .toList());
    }

    /**
     * Edits the text of a post you wrote.
     *
     * <p><b>PATCH /api/v1/feed/{postId}</b> — body {@code {"content":"..."}}
     *
     * <p>Only the text is editable. Swapping the media of a post that already has likes and
     * comments would let someone bait engagement with one image and then replace it with
     * another, so media is fixed once posted.
     *
     * @return 200 with the updated post, 403 if you are not the author, 404 if it is gone
     */
    @PatchMapping("/{postId}")
    @CacheEvict(value = "feed", allEntries = true)
    public ResponseEntity<?> updatePost(@PathVariable String postId,
                                        @RequestBody Map<String, String> body) {
        Optional<User> current = getCurrentUser();
        if (current.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        Optional<Post> found = postRepository.findById(postId);
        if (found.isEmpty()) return ResponseEntity.notFound().build();
        Post post = found.get();

        // Ownership is checked server-side: hiding the edit button in the browser decides
        // what is offered, not what is permitted.
        if (!current.get().getId().toString().equals(post.getAuthorId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "You can only edit your own posts"));
        }

        String content = body == null ? null : body.get("content");
        if (content == null || content.isBlank()) {
            // A post may legitimately be media-only, but an EDIT that blanks the text is
            // almost certainly a mistake, and there is no undo.
            return ResponseEntity.badRequest().body(Map.of("error", "Content cannot be empty"));
        }

        post.setContent(content.trim());
        post.setEditedAt(LocalDateTime.now());
        Post saved = postRepository.save(post);

        return ResponseEntity.ok(PostDto.from(saved, false, storageService::refreshUrl));
    }

    /**
     * Deletes a post you wrote.
     *
     * <p><b>DELETE /api/v1/feed/{postId}</b>
     *
     * <p>Likes, comments and saves are removed alongside it. Left behind they would be rows
     * pointing at a post that no longer exists, which surfaces as phantom entries in
     * "posts you've liked" and in saved posts.
     *
     * @return 204 on success, 403 if you are not the author, 404 if it is already gone
     */
    @DeleteMapping("/{postId}")
    @CacheEvict(value = "feed", allEntries = true)
    public ResponseEntity<?> deletePost(@PathVariable String postId) {
        Optional<User> current = getCurrentUser();
        if (current.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        Optional<Post> found = postRepository.findById(postId);
        if (found.isEmpty()) return ResponseEntity.notFound().build();
        Post post = found.get();

        if (!current.get().getId().toString().equals(post.getAuthorId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "You can only delete your own posts"));
        }

        // Comment likes first: they hang off the comments, so clearing them after the
        // comments are gone would leave rows keyed to ids that no longer exist.
        List<String> commentIds = commentRepository.findByPostIdOrderByCreatedAtAsc(postId)
                .stream().map(Comment::getId).toList();
        if (!commentIds.isEmpty()) commentLikeRepository.deleteByIdCommentIdIn(commentIds);

        commentRepository.deleteByPostId(postId);
        postLikeRepository.deleteByIdPostId(postId);
        savedPostRepository.deleteByIdPostId(postId);
        postRepository.delete(post);

        return ResponseEntity.noContent().build();
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
            @RequestParam(value = "media", required = false) List<MultipartFile> mediaFiles,
            // Optional link back to a marketplace listing — used by sellers posting an
            // "event update" from their EVENT listing's page (see GET /feed/listing/{id}).
            @RequestParam(value = "linkedListingId", required = false) String linkedListingId,
            // Posting into a community rather than the open feed. Absent for an ordinary post.
            @RequestParam(value = "communityId", required = false) String communityId) {

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

        // Anonymous posting is a Premium capability, enforced here rather than in the client.
        //
        // This REFUSES the request instead of quietly saving the post with the author's name
        // attached. Downgrading silently would publish under someone's real identity content
        // they only agreed to share anonymously — the one outcome this feature must never
        // produce. A rejected post can be rewritten; an exposed one cannot be taken back.
        if (anonymous && !premiumAccess.isPremium(currentUser.getId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                    "error", "Anonymous posting is a Premium feature",
                    "code", "PREMIUM_REQUIRED",
                    "feature", "ANONYMOUS_POST"));
        }

        // Posting into a community you have not joined is refused rather than silently
        // downgraded to an open-feed post. A community is a room with a door: writing into
        // one you are not in is exactly the thing membership is supposed to mean, and a
        // post that quietly lands somewhere else is worse than one that is turned away.
        Community community = null;
        if (communityId != null && !communityId.isBlank()) {
            community = communityRepository.findById(communityId)
                    .or(() -> communityRepository.findBySlug(communityId))
                    .orElse(null);
            if (community == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "That community doesn't exist"));
            }
            boolean member = communityMemberRepository
                    .findByIdMemberIdAndIdCommunityIdIn(userId, List.of(community.getId()))
                    .stream().findAny().isPresent();
            if (!member) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("error", "Join this community before posting in it"));
            }
        }

        // Build the Post entity manually (no Lombok @Builder here because the class uses
        // plain getters/setters for simplicity).
        Post post = new Post();
        post.setId(UUID.randomUUID().toString()); // generate a UUID string primary key
        post.setAuthorId(userId);
        post.setAuthorName(authorName != null && !authorName.isBlank() ? authorName : currentUser.displayName());
        post.setContent(content == null ? "" : content.trim());
        post.setAnonymous(anonymous);
        post.setLinkedListingId(linkedListingId != null && !linkedListingId.isBlank() ? linkedListingId : null);
        post.setCommunityId(community == null ? null : community.getId());

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
                    String displayName = currentUser.displayName();
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

        return ResponseEntity.ok(decorate(List.of(savedPost)).get(0));
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
        List<Comment> all = commentRepository.findByPostIdOrderByCreatedAtAsc(postId);
        if (all.isEmpty()) return ResponseEntity.ok(List.of());

        List<String> ids = all.stream().map(Comment::getId).toList();

        // One query for the viewer's likes across the whole thread, not one per comment.
        Set<String> likedIds = getCurrentUser()
                .map(u -> commentLikeRepository.findByIdUserIdAndIdCommentIdIn(u.getId().toString(), ids)
                        .stream()
                        .map(cl -> cl.getId().getCommentId())
                        .collect(Collectors.toSet()))
                .orElseGet(HashSet::new);

        // Same batching for avatars — the comment row stores a name snapshot but no picture.
        List<UUID> authorUuids = all.stream()
                .map(Comment::getAuthorId)
                .filter(Objects::nonNull)
                .distinct()
                .map(id -> { try { return UUID.fromString(id); } catch (Exception e) { return null; } })
                .filter(Objects::nonNull)
                .toList();
        Map<String, String> avatars = userRepository.findAllById(authorUuids).stream()
                .filter(u -> u.getAvatarUrl() != null && !u.getAvatarUrl().isBlank())
                .collect(Collectors.toMap(u -> u.getId().toString(), User::getAvatarUrl));

        // Assemble two levels. A reply whose parent is missing — deleted, or belonging to a
        // different post — is promoted to top level rather than dropped: losing someone's
        // comment entirely is worse than showing it slightly out of place.
        Map<String, CommentDto> byId = new LinkedHashMap<>();
        for (Comment c : all) {
            byId.put(c.getId(), CommentDto.from(c, likedIds.contains(c.getId()), avatars.get(c.getAuthorId())));
        }

        List<CommentDto> roots = new ArrayList<>();
        for (Comment c : all) {
            CommentDto dto = byId.get(c.getId());
            String parentId = c.getParentId();
            CommentDto parent = (parentId == null || parentId.isBlank()) ? null : byId.get(parentId);
            if (parent == null) {
                roots.add(dto);
            } else if (parent.getParentId() != null && !parent.getParentId().isBlank()) {
                // A reply to a reply: attach to the top-level ancestor rather than nesting
                // deeper, so the thread never becomes a staircase on a narrow screen.
                CommentDto grandparent = byId.get(parent.getParentId());
                (grandparent != null ? grandparent : parent).getReplies().add(dto);
            } else {
                parent.getReplies().add(dto);
            }
        }

        return ResponseEntity.ok(roots);
    }

    /**
     * Likes a comment.
     *
     * <p><b>POST /api/v1/feed/{postId}/comments/{commentId}/likes</b>
     *
     * <p>Idempotent: liking something already liked returns the current state rather than an
     * error, so a double-tap on a slow connection cannot double-count.
     */
    @PostMapping("/{postId}/comments/{commentId}/likes")
    public ResponseEntity<?> likeComment(@PathVariable String postId, @PathVariable String commentId) {
        Optional<User> current = getCurrentUser();
        if (current.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        Optional<Comment> found = commentRepository.findById(commentId);
        if (found.isEmpty()) return ResponseEntity.notFound().build();
        Comment comment = found.get();
        // Guards against liking a comment via some other post's URL, which would otherwise
        // let the count be driven from a path that has nothing to do with it.
        if (!comment.getPostId().equals(postId)) return ResponseEntity.notFound().build();

        var id = new CommentLike.CommentLikeId(commentId, current.get().getId().toString());
        if (!commentLikeRepository.existsById(id)) {
            commentLikeRepository.save(new CommentLike(id));
            comment.setLikesCount(comment.getLikesCount() + 1);
            commentRepository.save(comment);
        }
        return ResponseEntity.ok(Map.of("likesCount", comment.getLikesCount(), "likedByCurrentUser", true));
    }

    /**
     * Removes your like from a comment. Idempotent in the same way as liking.
     *
     * <p><b>DELETE /api/v1/feed/{postId}/comments/{commentId}/likes</b>
     */
    @DeleteMapping("/{postId}/comments/{commentId}/likes")
    public ResponseEntity<?> unlikeComment(@PathVariable String postId, @PathVariable String commentId) {
        Optional<User> current = getCurrentUser();
        if (current.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        Optional<Comment> found = commentRepository.findById(commentId);
        if (found.isEmpty()) return ResponseEntity.notFound().build();
        Comment comment = found.get();
        if (!comment.getPostId().equals(postId)) return ResponseEntity.notFound().build();

        var id = new CommentLike.CommentLikeId(commentId, current.get().getId().toString());
        if (commentLikeRepository.existsById(id)) {
            commentLikeRepository.deleteById(id);
            // Clamped: a counter that has drifted below zero should not be driven further
            // negative by an unlike that is otherwise legitimate.
            comment.setLikesCount(Math.max(0, comment.getLikesCount() - 1));
            commentRepository.save(comment);
        }
        return ResponseEntity.ok(Map.of("likesCount", comment.getLikesCount(), "likedByCurrentUser", false));
    }

    /**
     * Lists exactly who liked a post, newest like first.
     *
     * <p><b>GET /api/v1/feed/{postId}/likes</b> — public.
     *
     * @return 200 OK with a JSON array of {@code {id, name, avatarUrl, verified, likedAt}}
     */
    @GetMapping("/{postId}/likes")
    public ResponseEntity<?> getLikers(@PathVariable String postId) {
        List<PostLike> likes = postLikeRepository.findByIdPostId(postId);
        // Newest like first, matching how Instagram orders its likers sheet.
        likes.sort((a, b) -> {
            if (a.getCreatedAt() == null || b.getCreatedAt() == null) return 0;
            return b.getCreatedAt().compareTo(a.getCreatedAt());
        });

        List<Map<String, Object>> likers = new ArrayList<>();
        for (PostLike like : likes) {
            try {
                userRepository.findById(UUID.fromString(like.getId().getUserId())).ifPresent(u -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("id", u.getId().toString());
                    row.put("name", u.displayName());
                    String avatar = u.getAvatarUrl();
                    row.put("avatarUrl", avatar != null ? storageService.refreshUrl(avatar) : null);
                    row.put("verified", u.isIdVerified());
                    row.put("likedAt", like.getCreatedAt() != null ? like.getCreatedAt().toString() : null);
                    likers.add(row);
                });
            } catch (IllegalArgumentException ignored) {
                // Malformed user id in the like row — skip rather than fail the list.
            }
        }
        return ResponseEntity.ok(likers);
    }

    /**
     * The authenticated user's like activity: every post they have liked,
     * newest post first. Powers the profile "Likes" tab.
     *
     * <p><b>GET /api/v1/feed/liked/me</b> — auth required.
     */
    @GetMapping("/liked/me")
    public ResponseEntity<?> myLikedPosts() {
        User currentUser = requireCurrentUser();
        List<String> likedIds = postLikeRepository.findLikedPostIdsByUserId(currentUser.getId().toString());
        if (likedIds.isEmpty()) return ResponseEntity.ok(List.of());

        List<PostDto> liked = postRepository.findAllById(likedIds).stream()
                .sorted((a, b) -> {
                    if (a.getCreatedAt() == null || b.getCreatedAt() == null) return 0;
                    return b.getCreatedAt().compareTo(a.getCreatedAt());
                })
                .map(p -> PostDto.from(p, true, storageService::refreshUrl))
                .collect(Collectors.toList());
        return ResponseEntity.ok(liked);
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
        comment.setAuthorName(currentUser.displayName());
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

    /**
     * Saves/bookmarks a post for the authenticated user.
     *
     * <p><b>POST /api/v1/feed/{postId}/save</b> — auth required, idempotent (mirrors
     * {@link #likePost}: re-saving an already-saved post is a no-op, not an error).
     *
     * <p>Unlike likes/comments, saves are private — there is no "who saved this" list and
     * no denormalised count on {@link Post}, so this never needs to touch the Post row itself.
     *
     * @param postId the UUID string of the post to save
     * @return 200 OK with the updated {@link PostDto} (savedByCurrentUser = true)
     */
    @PostMapping("/{postId}/save")
    @CacheEvict(value = "feed", allEntries = true)
    public ResponseEntity<?> savePost(@PathVariable String postId) {
        User currentUser = requireCurrentUser();
        Post post = postRepository.findById(postId).orElseThrow();

        SavedPost.SavedPostId saveId = new SavedPost.SavedPostId();
        saveId.setPostId(postId);
        saveId.setUserId(currentUser.getId().toString());

        if (!savedPostRepository.existsById(saveId)) {
            savedPostRepository.save(SavedPost.builder().id(saveId).build());
        }

        return ResponseEntity.ok(PostDto.from(post, false, true, storageService::refreshUrl, null, null));
    }

    /**
     * Removes the current user's save/bookmark from a post.
     *
     * <p><b>DELETE /api/v1/feed/{postId}/save</b> — auth required, idempotent.
     *
     * @param postId the UUID string of the post to unsave
     * @return 200 OK with the updated {@link PostDto} (savedByCurrentUser = false)
     */
    @DeleteMapping("/{postId}/save")
    @CacheEvict(value = "feed", allEntries = true)
    public ResponseEntity<?> unsavePost(@PathVariable String postId) {
        User currentUser = requireCurrentUser();
        Post post = postRepository.findById(postId).orElseThrow();

        SavedPost.SavedPostId saveId = new SavedPost.SavedPostId();
        saveId.setPostId(postId);
        saveId.setUserId(currentUser.getId().toString());

        savedPostRepository.deleteById(saveId);

        return ResponseEntity.ok(PostDto.from(post, false, false, storageService::refreshUrl, null, null));
    }

    /**
     * The authenticated user's saved posts, newest save first. Powers a "Saved" tab,
     * mirroring {@link #myLikedPosts()}.
     *
     * <p><b>GET /api/v1/feed/saved/me</b> — auth required.
     */
    @GetMapping("/saved/me")
    public ResponseEntity<?> mySavedPosts() {
        User currentUser = requireCurrentUser();
        List<String> savedIds = savedPostRepository.findSavedPostIdsByUserId(currentUser.getId().toString());
        if (savedIds.isEmpty()) return ResponseEntity.ok(List.of());

        // Preserve "most recently saved first" order — findAllById does not guarantee
        // input order, so re-sort by the position of each post's id in savedIds.
        Map<String, Integer> order = new java.util.HashMap<>();
        for (int i = 0; i < savedIds.size(); i++) order.put(savedIds.get(i), i);

        List<Post> posts = postRepository.findAllById(savedIds).stream()
                .sorted(Comparator.comparingInt(p -> order.getOrDefault(p.getId(), Integer.MAX_VALUE)))
                .toList();

        // Same liked-state and avatar bulk-loading as the main feed, so a saved post looks
        // identical whether it's rendered from the main feed or from this list.
        Set<String> likedPostIds = new HashSet<>(postLikeRepository.findByIdUserIdAndIdPostIdIn(
                        currentUser.getId().toString(), savedIds)
                .stream().map(pl -> pl.getId().getPostId()).toList());
        List<UUID> authorUUIDs = posts.stream()
                .map(Post::getAuthorId)
                .filter(Objects::nonNull)
                .distinct()
                .map(id -> { try { return UUID.fromString(id); } catch (Exception e) { return null; } })
                .filter(Objects::nonNull)
                .toList();
        Map<String, String> authorAvatarMap = userRepository.findAllById(authorUUIDs).stream()
                .filter(u -> u.getAvatarUrl() != null && !u.getAvatarUrl().isBlank())
                .collect(Collectors.toMap(u -> u.getId().toString(), User::getAvatarUrl));

        List<PostDto> saved = posts.stream()
                .map(p -> PostDto.from(p, likedPostIds.contains(p.getId()), true,
                        storageService::refreshUrl, authorAvatarMap.get(p.getAuthorId()), null))
                .collect(Collectors.toList());
        return ResponseEntity.ok(saved);
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
