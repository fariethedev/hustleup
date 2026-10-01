package com.hustleup.social.service;

import com.hustleup.common.storage.FileStorageService;
import com.hustleup.social.model.Post;
import com.hustleup.social.repository.PostRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PostMediaServiceTest {
    @Mock PostRepository posts;
    @Mock FileStorageService storage;
    @InjectMocks PostMediaService service;

    @Test
    void replacesOneSlotAndKeepsRawSignedUrlsAndOtherMedia() {
        Post post = post("/uploads/first.jpg,https://bucket/clip.mp4?token=old,/uploads/last.png",
                "IMAGE,VIDEO,IMAGE", "/uploads/first.jpg");
        when(posts.findById("post")).thenReturn(Optional.of(post));
        MultipartFile file = image();
        when(storage.storePublicMedia(file)).thenReturn("/uploads/cropped.png");
        when(posts.replaceMediaIfUnchanged(eq("post"), eq("owner"), eq(post.getMediaUrls()),
                eq("IMAGE,VIDEO,IMAGE"), eq("/uploads/first.jpg"),
                eq("/uploads/first.jpg,https://bucket/clip.mp4?token=old,/uploads/cropped.png"),
                eq("IMAGE,VIDEO,IMAGE"), eq("/uploads/first.jpg"), any())).thenReturn(1);

        assertSame(post, service.replaceImage("post", "owner", 2, List.of(file)));
        // The loaded entity is never dirtied: the database update owns only media fields.
        assertEquals("/uploads/first.jpg,https://bucket/clip.mp4?token=old,/uploads/last.png", post.getMediaUrls());
        verify(posts, never()).save(any());
        verify(storage, never()).refreshUrl(any());
    }

    @Test
    void replacesLegacyImageAndPopulatesMediaColumns() {
        Post post = post(null, null, "/uploads/old.jpg");
        post.setAnonymous(true);
        when(posts.findById("post")).thenReturn(Optional.of(post));
        when(storage.storePublicMedia(any())).thenReturn("/uploads/cropped.png");
        when(posts.replaceMediaIfUnchanged(eq("post"), eq("owner"), isNull(), isNull(),
                eq("/uploads/old.jpg"), eq("/uploads/cropped.png"), eq("IMAGE"),
                eq("/uploads/cropped.png"), any())).thenReturn(1);

        service.replaceImage("post", "owner", 0, List.of(image()));

        assertTrue(post.isAnonymous());
        verify(storage).storePublicMedia(any());
    }

    @Test
    void infersMissingTypesAndUpdatesFirstImageAfterVideo() {
        Post post = post("/clip.mp4?signature=old,/photo.jpg,/other.jpg", null, "/photo.jpg");
        when(posts.findById("post")).thenReturn(Optional.of(post));
        when(storage.storePublicMedia(any())).thenReturn("/cropped.png");
        when(posts.replaceMediaIfUnchanged(eq("post"), eq("owner"), eq(post.getMediaUrls()), isNull(),
                eq("/photo.jpg"), eq("/clip.mp4?signature=old,/cropped.png,/other.jpg"),
                eq("VIDEO,IMAGE,IMAGE"), eq("/cropped.png"), any())).thenReturn(1);

        service.replaceImage("post", "owner", 1, List.of(image()));
    }

    @Test
    void rejectsAnotherOwnerBeforeUploading() {
        when(posts.findById("post")).thenReturn(Optional.of(post("/photo.jpg", "IMAGE", "/photo.jpg")));
        assertStatus(HttpStatus.FORBIDDEN, () -> service.replaceImage("post", "stranger", 0, List.of(image())));
        verifyNoInteractions(storage);
    }

    @Test
    void missingPostDoesNotUpload() {
        assertStatus(HttpStatus.NOT_FOUND, () -> service.replaceImage("missing", "owner", 0, List.of(image())));
        verifyNoInteractions(storage);
    }

    @ParameterizedTest
    @ValueSource(ints = {-1, 1, Integer.MAX_VALUE})
    void rejectsOutOfRangeIndex(int index) {
        loadImagePost();
        assertStatus(HttpStatus.BAD_REQUEST, () -> service.replaceImage("post", "owner", index, List.of(image())));
        verifyNoInteractions(storage);
    }

    @ParameterizedTest
    @ValueSource(strings = {"VIDEO", ""})
    void rejectsVideoIncludingInferredType(String types) {
        when(posts.findById("post")).thenReturn(Optional.of(post("/video.mp4?signature=x", types, null)));
        assertStatus(HttpStatus.BAD_REQUEST, () -> service.replaceImage("post", "owner", 0, List.of(image())));
        verifyNoInteractions(storage);
    }

    @Test
    void cannotAttachAnImageToTextOnlyPostOrRepost() {
        Post post = post(null, null, null);
        post.setRepostOfId("someone-elses-post");
        when(posts.findById("post")).thenReturn(Optional.of(post));
        assertStatus(HttpStatus.BAD_REQUEST, () -> service.replaceImage("post", "owner", 0, List.of(image())));
        verifyNoInteractions(storage);
    }

    @Test
    void requiresExactlyOneNonemptyFile() {
        loadImagePost();
        assertStatus(HttpStatus.BAD_REQUEST, () -> service.replaceImage("post", "owner", 0, null));
        assertStatus(HttpStatus.BAD_REQUEST, () -> service.replaceImage("post", "owner", 0, List.of()));
        assertStatus(HttpStatus.BAD_REQUEST, () -> service.replaceImage("post", "owner", 0, List.of(image(), image())));
        assertStatus(HttpStatus.BAD_REQUEST, () -> service.replaceImage("post", "owner", 0,
                List.of(new MockMultipartFile("media", "photo.png", "image/png", new byte[0]))));
        verifyNoInteractions(storage);
    }

    @ParameterizedTest
    @CsvSource({"photo.svg,image/svg+xml", "photo.mp4,video/mp4", "photo.mp4,image/png",
            "photo.png,text/html", "photo.html,image/png", "photo.png,image/jpeg", "photo,image/png"})
    void rejectsUnsupportedOrMismatchedType(String name, String type) {
        loadImagePost();
        MultipartFile file = new MockMultipartFile("media", name, type, new byte[]{1});
        assertStatus(HttpStatus.BAD_REQUEST, () -> service.replaceImage("post", "owner", 0, List.of(file)));
        verifyNoInteractions(storage);
    }

    @Test
    void rejectsMissingMimeType() {
        loadImagePost();
        MultipartFile file = new MockMultipartFile("media", "photo.png", null, new byte[]{1});
        assertStatus(HttpStatus.BAD_REQUEST, () -> service.replaceImage("post", "owner", 0, List.of(file)));
        verifyNoInteractions(storage);
    }

    @Test
    void rejectsOversizeWithoutReadingOrStoringFile() {
        loadImagePost();
        MultipartFile file = mock(MultipartFile.class);
        when(file.getSize()).thenReturn(500L * 1024 * 1024 + 1);
        assertStatus(HttpStatus.PAYLOAD_TOO_LARGE, () -> service.replaceImage("post", "owner", 0, List.of(file)));
        verifyNoInteractions(storage);
    }

    @Test
    void storageFailureLeavesPostUntouched() {
        Post post = loadImagePost();
        when(storage.storePublicMedia(any())).thenThrow(new IllegalStateException("storage unavailable"));
        assertThrows(IllegalStateException.class, () -> service.replaceImage("post", "owner", 0, List.of(image())));
        assertEquals("/photo.jpg", post.getMediaUrls());
        assertNull(post.getEditedAt());
        verify(posts, never()).replaceMediaIfUnchanged(any(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void refusesToOverwriteConcurrentReplacement() {
        loadImagePost();
        when(storage.storePublicMedia(any())).thenReturn("/cropped.png");
        assertStatus(HttpStatus.CONFLICT, () -> service.replaceImage("post", "owner", 0, List.of(image())));
        verify(posts, times(1)).findById("post");
    }

    private Post loadImagePost() {
        Post post = post("/photo.jpg", "IMAGE", "/photo.jpg");
        when(posts.findById("post")).thenReturn(Optional.of(post));
        return post;
    }

    private Post post(String urls, String types, String primary) {
        Post post = new Post();
        post.setId("post");
        post.setAuthorId("owner");
        post.setMediaUrls(urls);
        post.setMediaTypes(types);
        post.setImageUrl(primary);
        return post;
    }

    private MockMultipartFile image() {
        return new MockMultipartFile("media", "crop.png", "image/png", new byte[]{1, 2, 3});
    }

    private void assertStatus(HttpStatus status, org.junit.jupiter.api.function.Executable call) {
        assertEquals(status, assertThrows(ResponseStatusException.class, call).getStatusCode());
    }
}
