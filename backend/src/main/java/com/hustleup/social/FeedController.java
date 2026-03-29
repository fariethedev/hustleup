package com.hustleup.social;

import com.hustleup.storage.FileStorageService;
import com.hustleup.user.UserRepository;
import com.hustleup.user.User;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/feed")
public class FeedController {
    
    private final PostRepository postRepository;
    private final FileStorageService storageService;
    private final UserRepository userRepository;

    public FeedController(PostRepository postRepository, FileStorageService storageService, UserRepository userRepository) {
        this.postRepository = postRepository;
        this.storageService = storageService;
        this.userRepository = userRepository;
    }

    @GetMapping
    public ResponseEntity<?> getFeed() {
        return ResponseEntity.ok(postRepository.findAllByOrderByCreatedAtDesc());
    }

    @PostMapping
    public ResponseEntity<?> createPost(
            @RequestParam("content") String content,
            @RequestParam("authorName") String authorName,
            @RequestParam(value = "image", required = false) MultipartFile image) {
        
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        User currentUser = userRepository.findByEmail(email).orElseThrow();
        String userId = currentUser.getId().toString();

        Post post = new Post();
        post.setId(UUID.randomUUID().toString());
        post.setAuthorId(userId);
        post.setAuthorName(authorName);
        post.setContent(content);

        if (image != null && !image.isEmpty()) {
            String url = storageService.store(image);
            post.setImageUrl(url);
        }

        return ResponseEntity.ok(postRepository.save(post));
    }
}
