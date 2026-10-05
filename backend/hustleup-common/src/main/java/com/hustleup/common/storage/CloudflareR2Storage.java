package com.hustleup.common.storage;

import jakarta.annotation.PreDestroy;
import org.springframework.beans.factory.annotation.Autowired;
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

import java.io.IOException;
import java.net.URI;

/** Opt-in R2 storage for public photos and videos. The legacy R2_IMAGES_ENABLED flag enables both. */
@Service
public class CloudflareR2Storage {
    private final S3Client client;
    private final String bucket;
    private final String publicBaseUrl;

    @Autowired
    public CloudflareR2Storage(
            @Value("${R2_IMAGES_ENABLED:false}") boolean enabled,
            @Value("${R2_ENDPOINT:}") String endpoint,
            @Value("${R2_BUCKET:}") String bucket,
            @Value("${R2_ACCESS_KEY_ID:}") String accessKey,
            @Value("${R2_SECRET_ACCESS_KEY:}") String secretKey,
            @Value("${R2_PUBLIC_BASE_URL:}") String publicBaseUrl) {
        this.bucket = bucket;
        if (!enabled) {
            client = null;
            this.publicBaseUrl = null;
            return;
        }
        URI uri = validateEndpoint(endpoint);
        if (!bucket.matches("[a-z0-9][a-z0-9-]{1,61}[a-z0-9]") || accessKey.isBlank() || secretKey.isBlank()) {
            throw new IllegalArgumentException("R2 images require a valid bucket and dedicated R2 access credentials");
        }
        this.publicBaseUrl = validatePublicBaseUrl(publicBaseUrl);
        var credentials = StaticCredentialsProvider.create(AwsBasicCredentials.create(accessKey, secretKey));
        // R2 requires path-style addressing, region auto and non-chunked signed uploads.
        var configuration = S3Configuration.builder().pathStyleAccessEnabled(true)
                .chunkedEncodingEnabled(false).build();
        client = S3Client.builder().endpointOverride(uri).region(Region.of("auto"))
                .credentialsProvider(credentials).serviceConfiguration(configuration).build();
    }

    // Inject isolated clients in unit tests; never sends a request during construction.
    CloudflareR2Storage(S3Client client, String publicBaseUrl, String bucket) {
        this.client = client;
        this.bucket = bucket;
        this.publicBaseUrl = validatePublicBaseUrl(publicBaseUrl);
    }

    static String validatePublicBaseUrl(String value) {
        URI uri = URI.create(value);
        if (!"https".equals(uri.getScheme()) || uri.getHost() == null || !uri.getHost().contains(".")
                || uri.getPort() != -1 || uri.getUserInfo() != null || uri.getQuery() != null
                || uri.getFragment() != null || !(uri.getPath().isEmpty() || uri.getPath().equals("/"))
                || uri.getHost().endsWith(".r2.cloudflarestorage.com") || uri.getHost().endsWith(".r2.dev")
                || value.length() > 180) {
            throw new IllegalArgumentException("R2_PUBLIC_BASE_URL must be a verified HTTPS custom-domain origin, not the S3 or development endpoint");
        }
        return "https://" + uri.getHost();
    }

    static URI validateEndpoint(String endpoint) {
        URI uri;
        try { uri = URI.create(endpoint); }
        catch (IllegalArgumentException ex) { throw new IllegalArgumentException("Invalid R2 endpoint"); }
        if (!"https".equals(uri.getScheme()) || uri.getHost() == null
                || !uri.getHost().matches("[a-f0-9]{32}(\\.(eu|us|fedramp))?\\.r2\\.cloudflarestorage\\.com")
                || uri.getPort() != -1 || uri.getUserInfo() != null || uri.getQuery() != null
                || uri.getFragment() != null || !uri.getPath().isEmpty()) {
            throw new IllegalArgumentException("R2_ENDPOINT must be the HTTPS account S3 endpoint, without a bucket or trailing slash");
        }
        return uri;
    }

    public boolean isEnabled() { return client != null; }

    /** Called only after FileStorageService validates size, extension and media type. */
    public String storeImage(MultipartFile file, String filename) throws IOException {
        return storeMedia(file, filename);
    }

    public String storeMedia(MultipartFile file, String filename) throws IOException {
        if (!isEnabled()) throw new IllegalStateException("R2 image storage is disabled");
        String key = "uploads/" + filename;
        var request = PutObjectRequest.builder().bucket(bucket).key(key)
                .contentType(file.getContentType()).cacheControl("public, max-age=86400").build();
        try (var stream = file.getInputStream()) {
            client.putObject(request, RequestBody.fromInputStream(stream, file.getSize()));
        }
        // Persist a short, stable delivery URL, not a long expiring S3 signature.
        return publicBaseUrl + "/" + key;
    }

    @PreDestroy
    public void close() {
        if (client != null) client.close();
    }
}
