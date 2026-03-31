package com.hustleup.social.controller;

import com.hustleup.social.dto.PostDto;
import com.hustleup.social.model.Comment;
import com.hustleup.social.model.Post;
import com.hustleup.social.model.PostLike;
import com.hustleup.social.repository.CommentRepository;
import com.hustleup.social.repository.PostLikeRepository;
import com.hustleup.social.repository.PostRepository;
import com.hustleup.common.storage.FileStorageService;
import com.hustleup.common.model.User;
import com.hustleup.common.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/feed")
public class FeedController {
    
    private final PostRepository postRepository;
    private final PostLikeRepository postLikeRepository;
    private final FileStorageService storageService;
    private final UserRepository userRepository;
    private final CommentRepository commentRepository;

    public FeedController(
            PostRepository postRepository,
            PostLikeRepository postLikeRepository,
            FileStorageService storageService,
            UserRepository userRepository,
            CommentRepository commentRepository) {
        this.postRepository = postRepository;
        this.postLikeRepository = postLikeRepository;
        this.storageService = storageService;
        this.userRepository = userRepository;
        this.commentRepository = commentRepository;
    }

    @GetMapping
    public ResponseEntity<?> getFeed() {
        List<Post> posts = postRepository.findAllByOrderByCreatedAtDesc();
        Set<String> likedPostIds = getCurrentUser()
                .map(user -> postLikeRepository.findByIdUserIdAndIdPostIdIn(
                                user.getId().toString(),
                                posts.stream().map(Post::getId).toList())
                        .stream()
                        .map(postLike -> postLike.getId().getPostId())
                        .collect(Collectors.toSet()))
                .orElseGet(HashSet::new);

        return ResponseEntity.ok(posts.stream()
                .map(post -> PostDto.from(post, likedPostIds.contains(post.getId())))
                .toList());
    }

    @PostMapping
    public ResponseEntity<?> createPost(
            @RequestParam("content") String content,
            @RequestParam(value = "authorName", required = false) String authorName,
            @RequestParam(value = "media", required = false) List<MultipartFile> mediaFiles) {

        User currentUser = requireCurrentUser();
        String userId = currentUser.getId().toString();

        List<MultipartFile> validMediaFiles = mediaFiles == null ? List.of() : mediaFiles.stream()
                .filter(file -> file != null && !file.isEmpty())
                .toList();

        if ((content == null || content.isBlank()) && validMediaFiles.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Post content or media is required"));
        }

        Post post = new Post();
        post.setId(UUID.randomUUID().toString());
        post.setAuthorId(userId);
        post.setAuthorName(authorName != null && !authorName.isBlank() ? authorName : currentUser.getFullName());
        post.setContent(content == null ? "" : content.trim());

        if (!validMediaFiles.isEmpty()) {
            List<String> urls = validMediaFiles.stream()
                    .map(storageService::store)
                    .toList();
            List<String> types = validMediaFiles.stream()
                    .map(this::resolveMediaType)
                    .toList();

            post.setMediaUrls(String.join(",", urls));
            post.setMediaTypes(String.join(",", types));
            post.setImageUrl(resolvePrimaryImageUrl(urls, types));
        }

        Post savedPost = postRepository.save(post);
        return ResponseEntity.ok(PostDto.from(savedPost, false));
    }

    @GetMapping("/{postId}/comments")
    public ResponseEntity<?> getComments(@PathVariable String postId) {
        return ResponseEntity.ok(commentRepository.findByPostIdOrderByCreatedAtAsc(postId));
    }

    @PostMapping("/{postId}/comments")
    public ResponseEntity<?> addComment(@PathVariable String postId, @RequestBody Map<String, String> payload) {
        String content = payload.get("content");
        if (content == null || content.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Comment content is required"));
        }

        User currentUser = requireCurrentUser();
        
        Post post = postRepository.findById(postId).orElseThrow();
        post.setCommentsCount((post.getCommentsCount() == null ? 0 : post.getCommentsCount()) + 1);
        postRepository.save(post);

        Comment comment = new Comment();
        comment.setId(UUID.randomUUID().toString());
        comment.setPostId(postId);
        comment.setAuthorId(currentUser.getId().toString());
        comment.setAuthorName(currentUser.getFullName());
        comment.setContent(content.trim());

        return ResponseEntity.ok(commentRepository.save(comment));
    }

    @PostMapping("/{postId}/likes")
    public ResponseEntity<?> likePost(@PathVariable String postId) {
        User currentUser = requireCurrentUser();
        Post post = postRepository.findById(postId).orElseThrow();

        PostLike.PostLikeId likeId = new PostLike.PostLikeId();
        likeId.setPostId(postId);
        likeId.setUserId(currentUser.getId().toString());

        if (!postLikeRepository.existsById(likeId)) {
            PostLike postLike = new PostLike();
            postLike.setId(likeId);
            postLikeRepository.save(postLike);
            post.setLikesCount((post.getLikesCount() == null ? 0 : post.getLikesCount()) + 1);
            postRepository.save(post);
        }

        return ResponseEntity.ok(PostDto.from(post, true));
    }

    @DeleteMapping("/{postId}/likes")
    public ResponseEntity<?> unlikePost(@PathVariable String postId) {
        User currentUser = requireCurrentUser();
        Post post = postRepository.findById(postId).orElseThrow();

        PostLike.PostLikeId likeId = new PostLike.PostLikeId();
        likeId.setPostId(postId);
        likeId.setUserId(currentUser.getId().toString());

        if (postLikeRepository.existsById(likeId)) {
            postLikeRepository.deleteById(likeId);
            post.setLikesCount(Math.max(0, (post.getLikesCount() == null ? 0 : post.getLikesCount()) - 1));
            postRepository.save(post);
        }

        return ResponseEntity.ok(PostDto.from(post, false));
    }

    private User requireCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        String email = authentication.getName();
        return userRepository.findByEmail(email).orElseThrow();
    }

    private java.util.Optional<User> getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated() || authentication instanceof AnonymousAuthenticationToken) {
            return java.util.Optional.empty();
        }

        String email = authentication.getName();
        return userRepository.findByEmail(email);
    }

    private String resolveMediaType(MultipartFile file) {
        String contentType = file.getContentType();
        if (contentType != null && contentType.startsWith("video/")) {
            return "VIDEO";
        }
        return "IMAGE";
    }

    private String resolvePrimaryImageUrl(List<String> urls, List<String> types) {
        for (int i = 0; i < urls.size(); i++) {
            if (i < types.size() && "IMAGE".equals(types.get(i))) {
                return urls.get(i);
            }
        }
        return null;
    }
}
