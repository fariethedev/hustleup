package com.hustleup.social.controller;

import com.hustleup.common.model.User;
import com.hustleup.common.repository.UserRepository;
import com.hustleup.social.model.Story;
import com.hustleup.social.repository.*;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.server.ResponseStatusException;
import java.time.LocalDateTime;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class StoryCommentControllerTest {
    JdbcTemplate jdbc = mock(JdbcTemplate.class);
    StoryRepository stories = mock(StoryRepository.class);
    UserRepository users = mock(UserRepository.class);
    FollowRepository follows = mock(FollowRepository.class);
    UserBlockRepository blocks = mock(UserBlockRepository.class);
    User me = mock(User.class), owner = mock(User.class);
    UUID meId = UUID.randomUUID(), ownerId = UUID.randomUUID();
    Story story = new Story();
    StoryCommentController controller = new StoryCommentController(jdbc, stories, users, follows, blocks);
    @BeforeEach void setup() {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("viewer", "unused"));
        when(users.findByEmail("viewer")).thenReturn(Optional.of(me));
        when(me.getId()).thenReturn(meId); when(me.displayName()).thenReturn("Viewer");
        when(users.findById(ownerId)).thenReturn(Optional.of(owner));
        story.setId("story"); story.setAuthorId(ownerId.toString()); story.setExpiresAt(LocalDateTime.now().plusHours(1));
        when(stories.findById("story")).thenReturn(Optional.of(story));
    }
    @AfterEach void clear() { SecurityContextHolder.clearContext(); }
    @Test void anonymousCannotComment() {
        SecurityContextHolder.clearContext();
        assertEquals(401, assertThrows(ResponseStatusException.class, () -> controller.create("story", Map.of("content", "Hi"))).getStatusCode().value());
        verifyNoInteractions(jdbc);
    }
    @Test void privateAccountRequiresAcceptedFollow() {
        when(owner.isPrivateAccount()).thenReturn(true);
        assertEquals(403, assertThrows(ResponseStatusException.class, () -> controller.list("story")).getStatusCode().value());
        verifyNoInteractions(jdbc);
    }
    @Test void blockPreventsWriting() {
        when(blocks.existsByBlockerIdAndBlockedId(ownerId, meId)).thenReturn(true);
        assertEquals(403, assertThrows(ResponseStatusException.class, () -> controller.create("story", Map.of("content", "Hi"))).getStatusCode().value());
        verifyNoInteractions(jdbc);
    }
    @Test void expiredStoryCannotBeRead() {
        story.setExpiresAt(LocalDateTime.now().minusSeconds(1));
        assertEquals(404, assertThrows(ResponseStatusException.class, () -> controller.list("story")).getStatusCode().value());
        verifyNoInteractions(jdbc);
    }
    @Test void validatesLengthBeforeWriting() {
        assertThrows(ResponseStatusException.class, () -> controller.create("story", Map.of("content", " ")));
        assertThrows(ResponseStatusException.class, () -> controller.create("story", Map.of("content", "a".repeat(301))));
        verifyNoInteractions(jdbc);
    }
    @Test void ordinaryViewerCanOnlyDeleteOwnComment() {
        controller.delete("story", "comment");
        verify(jdbc).update("DELETE FROM story_comments WHERE id=? AND story_id=? AND author_id=?", "comment", "story", meId.toString());
    }
    @Test void acceptedFollowerCanPost() {
        when(owner.isPrivateAccount()).thenReturn(true);
        when(follows.existsByFollowerIdAndFollowingId(meId, ownerId)).thenReturn(true);
        Map<String, Object> result = controller.create("story", Map.of("content", " Hello "));
        assertEquals("Hello", result.get("content")); assertEquals(meId.toString(), result.get("authorId"));
    }
}
