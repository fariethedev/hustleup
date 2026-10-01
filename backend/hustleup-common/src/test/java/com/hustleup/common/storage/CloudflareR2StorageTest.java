package com.hustleup.common.storage;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.net.URI;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class CloudflareR2StorageTest {
    private static final String ENDPOINT = "https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com";
    private static final String KEY = "uploads/12345678-1234-1234-1234-123456789abc.png";
    @TempDir Path directory;

    @Test void disabledStorageNeedsNoCredentials() {
        var disabled = new CloudflareR2Storage(false, "", "", "", "", "");
        assertFalse(disabled.isEnabled());
        disabled.close();
    }

    @Test void incompleteEnabledConfigurationFailsClosed() {
        assertThrows(IllegalArgumentException.class, () -> new CloudflareR2Storage(true, ENDPOINT, "images", "", "", "https://images.example.test"));
        assertThrows(IllegalArgumentException.class, () -> CloudflareR2Storage.validateEndpoint("http://localhost:9000"));
        assertThrows(IllegalArgumentException.class, () -> CloudflareR2Storage.validateEndpoint(ENDPOINT + "/images"));
        assertThrows(IllegalArgumentException.class, () -> CloudflareR2Storage.validateEndpoint(ENDPOINT + ".evil.test"));
        assertEquals(URI.create(ENDPOINT.replace(".r2.", ".eu.r2.")),
                CloudflareR2Storage.validateEndpoint(ENDPOINT.replace(".r2.", ".eu.r2.")));
    }

    @Test void uploadsPublicImageAndReturnsShortPermanentDeliveryUrl() throws Exception {
        try (var fixture = new Fixture()) {
            String result = fixture.storage.storeImage(new MockMultipartFile("file", "image.png", "image/png", new byte[]{1, 2}), KEY.substring(8));
            assertEquals("https://images.example.test/" + KEY, result);
            assertTrue(result.length() < 255);
            verify(fixture.client).putObject(argThat((PutObjectRequest request) ->
                    request.bucket().equals("images") && request.key().equals(KEY)
                    && request.contentType().equals("image/png") && request.acl() == null), any(RequestBody.class));
        }
    }

    @Test void requiresProductionHttpsDeliveryOrigin() {
        assertEquals("https://images.example.test", CloudflareR2Storage.validatePublicBaseUrl("https://images.example.test/"));
        assertThrows(IllegalArgumentException.class, () -> CloudflareR2Storage.validatePublicBaseUrl(ENDPOINT));
        assertThrows(IllegalArgumentException.class, () -> CloudflareR2Storage.validatePublicBaseUrl("https://pub-test.r2.dev"));
        assertThrows(IllegalArgumentException.class, () -> CloudflareR2Storage.validatePublicBaseUrl("http://images.example.test"));
        assertThrows(IllegalArgumentException.class, () -> CloudflareR2Storage.validatePublicBaseUrl("https://images.example.test/?token=x"));
    }

    @Test void imageRoutingKeepsVideosLocalAndValidatesBeforeWriting() throws Exception {
        var r2 = mock(CloudflareR2Storage.class);
        when(r2.isEnabled()).thenReturn(true);
        var files = new FileStorageService(directory.toString(), "", "", "us-east-1", "", "", r2);
        String video = files.storePublicMedia(new MockMultipartFile("file", "clip.mp4", "video/mp4", new byte[]{1}));
        assertTrue(video.startsWith("/uploads/"));
        assertTrue(files.store(new MockMultipartFile("file", "private.png", "image/png", new byte[]{1})).startsWith("/uploads/"));
        assertThrows(IllegalArgumentException.class, () -> files.storePublicMedia(new MockMultipartFile("file", "attack.svg", "image/svg+xml", new byte[]{1})));
        assertEquals("https://external.test/image.png?signature=keep", files.refreshUrl("https://external.test/image.png?signature=keep"));
        verify(r2, never()).storeImage(any(), anyString());
        when(r2.storeImage(any(), anyString())).thenReturn("https://r2.example/signed");
        assertEquals("https://r2.example/signed", files.storePublicMedia(new MockMultipartFile("file", "image.png", "image/png", new byte[]{1})));
    }

    private class Fixture implements AutoCloseable {
        final S3Client client = mock(S3Client.class);
        final CloudflareR2Storage storage = new CloudflareR2Storage(client, "https://images.example.test", "images");
        public void close() { storage.close(); }
    }
}
