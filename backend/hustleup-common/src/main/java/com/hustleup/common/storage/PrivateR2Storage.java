package com.hustleup.common.storage;

import jakarta.annotation.PreDestroy;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import java.io.IOException;
import java.time.Duration;
import java.util.Map;
import java.util.UUID;

/** Durable chat attachments. This bucket must have no public domain or r2.dev access. */
@Service
public class PrivateR2Storage {
    private static final String PREFIX = "r2-private:";
    private static final Map<String, String> TYPES = Map.of(
        "image/jpeg", "jpg", "image/png", "png", "image/webp", "webp",
        "image/gif", "gif", "image/heic", "heic", "image/heif", "heif");
    private final S3Client client;
    private final S3Presigner presigner;
    private final String bucket;

    public PrivateR2Storage(
            @Value("${R2_PRIVATE_BUCKET:}") String bucket,
            @Value("${R2_BUCKET:}") String publicBucket,
            @Value("${R2_ENDPOINT:}") String endpoint,
            @Value("${R2_ACCESS_KEY_ID:}") String accessKey,
            @Value("${R2_SECRET_ACCESS_KEY:}") String secretKey) {
        this.bucket = bucket;
        if (bucket.isBlank()) { client = null; presigner = null; return; }
        if (bucket.equals(publicBucket) || accessKey.isBlank() || secretKey.isBlank())
            throw new IllegalArgumentException("Private media requires a separate private R2 bucket and credentials");
        var uri = CloudflareR2Storage.validateEndpoint(endpoint);
        var credentials = StaticCredentialsProvider.create(AwsBasicCredentials.create(accessKey, secretKey));
        var config = S3Configuration.builder().pathStyleAccessEnabled(true).chunkedEncodingEnabled(false).build();
        client = S3Client.builder().endpointOverride(uri).region(Region.of("auto"))
            .credentialsProvider(credentials).serviceConfiguration(config).build();
        presigner = S3Presigner.builder().endpointOverride(uri).region(Region.of("auto"))
            .credentialsProvider(credentials).serviceConfiguration(config).build();
    }

    public boolean isEnabled() { return client != null; }

    public String storeImage(MultipartFile file) {
        if (!isEnabled()) throw new IllegalStateException("Private photo storage is not configured");
        if (file == null || file.isEmpty()) throw new IllegalArgumentException("Choose a photo to send");
        if (file.getSize() > 20L * 1024 * 1024) throw new IllegalArgumentException("Photos must be 20MB or smaller");
        String extension = TYPES.get(file.getContentType());
        if (extension == null) throw new IllegalArgumentException("Use a JPG, PNG, WebP, GIF or HEIC photo");
        String key = "messages/" + UUID.randomUUID() + "." + extension;
        try (var stream = file.getInputStream()) {
            client.putObject(PutObjectRequest.builder().bucket(bucket).key(key)
                .contentType(file.getContentType()).cacheControl("private, no-store").build(),
                RequestBody.fromInputStream(stream, file.getSize()));
        } catch (IOException e) { throw new IllegalStateException("Could not upload this photo. Please retry.", e); }
        return PREFIX + key;
    }

    /** Only call after checking that the viewer is a conversation participant. */
    public String downloadUrl(String reference) {
        if (reference == null || !reference.startsWith(PREFIX)) return reference;
        if (!isEnabled()) throw new IllegalStateException("Private photo storage is not configured");
        String key = reference.substring(PREFIX.length());
        if (!key.matches("messages/[a-f0-9-]{36}\\.(jpg|png|webp|gif|heic|heif)"))
            throw new IllegalArgumentException("Invalid private photo reference");
        return presigner.presignGetObject(GetObjectPresignRequest.builder()
            .signatureDuration(Duration.ofMinutes(15))
            .getObjectRequest(r -> r.bucket(bucket).key(key)).build()).url().toString();
    }

    @PreDestroy public void close() {
        if (client != null) client.close();
        if (presigner != null) presigner.close();
    }
}
