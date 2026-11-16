package com.hustleup.social.controller;

import com.hustleup.common.model.User;
import com.hustleup.common.repository.UserRepository;
import com.hustleup.social.model.Story;
import com.hustleup.social.repository.StoryRepository;
import com.hustleup.social.repository.FollowRepository;
import com.hustleup.social.repository.UserBlockRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.scheduling.annotation.Scheduled;
import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/v1/stories/{storyId}/comments")
@RequiredArgsConstructor
public class StoryCommentController {
    private final JdbcTemplate jdbc;
    private final StoryRepository stories;
    private final UserRepository users;
    private final FollowRepository follows;
    private final UserBlockRepository blocks;

    private User viewer() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        return users.findByEmail(auth.getName()).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
    }
    private Story accessible(String id, User viewer) {
        Story story = stories.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (story.getExpiresAt() == null || !story.getExpiresAt().isAfter(LocalDateTime.now())) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        UUID ownerId = UUID.fromString(story.getAuthorId());
        User owner = users.findById(ownerId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (!ownerId.equals(viewer.getId()) && (blocks.existsByBlockerIdAndBlockedId(viewer.getId(), ownerId)
                || blocks.existsByBlockerIdAndBlockedId(ownerId, viewer.getId())
                || (owner.isPrivateAccount() && !follows.existsByFollowerIdAndFollowingId(viewer.getId(), ownerId))))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        return story;
    }
    @GetMapping
    public List<Map<String, Object>> list(@PathVariable String storyId) {
        User me = viewer(); accessible(storyId, me);
        return jdbc.query("SELECT id,author_id,content,created_at FROM story_comments WHERE story_id=? ORDER BY created_at DESC LIMIT 50", (rs, row) -> {
            UUID authorId = UUID.fromString(rs.getString("author_id"));
            if (blocks.existsByBlockerIdAndBlockedId(me.getId(), authorId) || blocks.existsByBlockerIdAndBlockedId(authorId, me.getId())) return null;
            User author = users.findById(authorId).orElse(null);
            Map<String, Object> comment = new LinkedHashMap<>();
            comment.put("id", rs.getString("id")); comment.put("authorId", authorId.toString());
            comment.put("authorName", author == null ? "User" : author.displayName());
            comment.put("content", rs.getString("content")); comment.put("createdAt", rs.getTimestamp("created_at").toLocalDateTime().toString());
            return comment;
        }, storyId).stream().filter(Objects::nonNull).toList();
    }
    @PostMapping
    public Map<String, Object> create(@PathVariable String storyId, @RequestBody Map<String, String> body) {
        User me = viewer(); accessible(storyId, me);
        String content = Objects.toString(body.get("content"), "").trim();
        if (content.isEmpty() || content.length() > 300) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Comments must contain 1–300 characters");
        Integer recent = jdbc.queryForObject("SELECT COUNT(*) FROM story_comments WHERE author_id=? AND created_at>?", Integer.class, me.getId().toString(), LocalDateTime.now().minusMinutes(1));
        if (recent != null && recent >= 10) throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Please wait before commenting again");
        String id = UUID.randomUUID().toString(); LocalDateTime now = LocalDateTime.now();
        jdbc.update("INSERT INTO story_comments(id,story_id,author_id,content,created_at) VALUES(?,?,?,?,?)", id, storyId, me.getId().toString(), content, now);
        return Map.of("id", id, "authorId", me.getId().toString(), "authorName", me.displayName(), "content", content, "createdAt", now.toString());
    }
    @DeleteMapping("/{commentId}")
    public void delete(@PathVariable String storyId, @PathVariable String commentId) {
        User me = viewer(); Story story = accessible(storyId, me);
        if (story.getAuthorId().equals(me.getId().toString())) jdbc.update("DELETE FROM story_comments WHERE id=? AND story_id=?", commentId, storyId);
        else jdbc.update("DELETE FROM story_comments WHERE id=? AND story_id=? AND author_id=?", commentId, storyId, me.getId().toString());
    }
    @Scheduled(fixedDelay = 3600000)
    public void cleanup() {
        jdbc.update("DELETE FROM story_comments WHERE story_id NOT IN (SELECT id FROM stories WHERE expires_at>NOW())");
    }
}
