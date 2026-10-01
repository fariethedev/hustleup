package com.hustleup.social.controller;

import com.hustleup.common.exception.GlobalExceptionHandler;
import com.hustleup.common.model.User;
import com.hustleup.common.repository.NotificationRepository;
import com.hustleup.common.repository.UserRepository;
import com.hustleup.common.storage.FileStorageService;
import com.hustleup.common.subscription.PremiumAccess;
import com.hustleup.social.event.FeedEventPublisher;
import com.hustleup.social.model.*;
import com.hustleup.social.repository.*;
import com.hustleup.social.service.PostMediaService;
import com.hustleup.social.service.RecommendationEngine;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(MockitoExtension.class)
class FeedPhotoControllerTest {
    @Mock PostRepository posts;
    @Mock PostLikeRepository likes;
    @Mock SavedPostRepository saves;
    @Mock FileStorageService storage;
    @Mock UserRepository users;
    @Mock CommentRepository comments;
    @Mock CommentLikeRepository commentLikes;
    @Mock FeedEventPublisher events;
    @Mock FollowRepository follows;
    @Mock NotificationRepository notifications;
    @Mock RecommendationEngine recommendations;
    @Mock PremiumAccess premium;
    @Mock CommunityRepository communities;
    @Mock CommunityMemberRepository members;
    @Mock PostMediaService mediaService;
    @InjectMocks FeedController controller;
    private MockMvc mvc;

    @BeforeEach
    void setup() {
        mvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler()).build();
    }

    @AfterEach
    void clearAuthentication() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void multipartPutReturnsDecoratedPostWithViewerState() throws Exception {
        User user = authenticate();
        Post post = new Post();
        post.setId("post");
        post.setAuthorId(user.getId().toString());
        post.setAuthorName("Owner");
        post.setContent("Original caption");
        post.setMediaUrls("/cropped.png,/other.jpg");
        post.setMediaTypes("IMAGE,IMAGE");
        post.setImageUrl("/cropped.png");
        post.setEditedAt(LocalDateTime.of(2026, 9, 30, 12, 0));
        post.setCommunityId("community");
        post.setLikesCount(7);
        post.setCommentsCount(3);
        when(mediaService.replaceImage(eq("post"), eq(user.getId().toString()), eq(0), anyList())).thenReturn(post);
        when(storage.refreshUrl(anyString())).thenAnswer(invocation -> invocation.getArgument(0));
        when(users.findAllById(any())).thenReturn(List.of(user));
        when(likes.findByIdUserIdAndIdPostIdIn(anyString(), anyList())).thenReturn(List.of(
                PostLike.builder().id(new PostLike.PostLikeId("post", user.getId().toString())).build()));
        when(saves.findByIdUserIdAndIdPostIdIn(anyString(), anyList())).thenReturn(List.of(
                SavedPost.builder().id(new SavedPost.SavedPostId("post", user.getId().toString())).build()));
        Community community = Community.builder().id("community").name("Cars").slug("cars").build();
        when(communities.findByIdIn(List.of("community"))).thenReturn(List.of(community));

        mvc.perform(multipart(HttpMethod.PUT, "/api/v1/feed/post/media/0").file(image()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.media[0].url").value("/cropped.png"))
                .andExpect(jsonPath("$.media[1].url").value("/other.jpg"))
                .andExpect(jsonPath("$.imageUrl").value("/cropped.png"))
                .andExpect(jsonPath("$.content").value("Original caption"))
                .andExpect(jsonPath("$.authorAvatarUrl").value("/avatar.png"))
                .andExpect(jsonPath("$.likesCount").value(7))
                .andExpect(jsonPath("$.commentsCount").value(3))
                .andExpect(jsonPath("$.likedByCurrentUser").value(true))
                .andExpect(jsonPath("$.savedByCurrentUser").value(true))
                .andExpect(jsonPath("$.communityName").value("Cars"))
                .andExpect(jsonPath("$.editedAt").exists());
    }

    @Test
    void rejectsMissingAuthentication() throws Exception {
        mvc.perform(multipart(HttpMethod.PUT, "/api/v1/feed/post/media/0").file(image()))
                .andExpect(status().isUnauthorized());
        verifyNoInteractions(mediaService, users);
    }

    @Test
    void rejectsAnonymousPrincipal() throws Exception {
        SecurityContextHolder.getContext().setAuthentication(new AnonymousAuthenticationToken("key", "anonymousUser",
                List.of(new SimpleGrantedAuthority("ROLE_ANONYMOUS"))));
        mvc.perform(multipart(HttpMethod.PUT, "/api/v1/feed/post/media/0").file(image()))
                .andExpect(status().isUnauthorized());
        verifyNoInteractions(mediaService, users);
    }

    @ParameterizedTest
    @ValueSource(strings = {"not-an-index", "2147483648"})
    void rejectsMalformedIndexAsBadRequest(String index) throws Exception {
        authenticate();
        mvc.perform(multipart(HttpMethod.PUT, "/api/v1/feed/post/media/" + index).file(image()))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(mediaService);
    }

    @ParameterizedTest
    @ValueSource(ints = {400, 403, 404, 409, 413})
    void preservesServiceErrorStatusAndMessage(int status) throws Exception {
        authenticate();
        when(mediaService.replaceImage(anyString(), anyString(), eq(0), anyList()))
                .thenThrow(new ResponseStatusException(HttpStatus.valueOf(status), "Photo could not be replaced"));
        mvc.perform(multipart(HttpMethod.PUT, "/api/v1/feed/post/media/0").file(image()))
                .andExpect(status().is(status))
                .andExpect(jsonPath("$.error").value("Photo could not be replaced"));
    }

    @Test
    void missingFileIsValidatedByService() throws Exception {
        authenticate();
        when(mediaService.replaceImage(anyString(), anyString(), eq(0), isNull()))
                .thenThrow(new ResponseStatusException(HttpStatus.BAD_REQUEST, "Upload exactly one non-empty media image"));
        mvc.perform(multipart(HttpMethod.PUT, "/api/v1/feed/post/media/0"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void multipleFilesReachValidationWithoutDroppingExtras() throws Exception {
        authenticate();
        when(mediaService.replaceImage(anyString(), anyString(), eq(0), argThat(files -> files.size() == 2)))
                .thenThrow(new ResponseStatusException(HttpStatus.BAD_REQUEST, "Upload exactly one non-empty media image"));
        mvc.perform(multipart(HttpMethod.PUT, "/api/v1/feed/post/media/0").file(image()).file(image()))
                .andExpect(status().isBadRequest());
    }

    private User authenticate() {
        User user = new User();
        user.setId(UUID.randomUUID());
        user.setEmail("owner@example.com");
        user.setAvatarUrl("/avatar.png");
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(user.getEmail(), null, List.of()));
        when(users.findByEmail(user.getEmail())).thenReturn(Optional.of(user));
        return user;
    }

    private MockMultipartFile image() {
        return new MockMultipartFile("media", "crop.png", "image/png", new byte[]{1, 2, 3});
    }
}
