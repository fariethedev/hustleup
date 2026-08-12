package com.hustleup.common.storage;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;

import java.io.IOException;
import java.nio.file.*;
import java.time.Duration;
import java.util.UUID;

/**
 * Service that abstracts file storage behind a unified interface supporting both local
 * disk storage (for development) and AWS S3 (for production).
 *
 * <p><b>Why this service exists:</b><br>
 * User-uploaded files (avatars, shop banners, ID documents, listing images) need to be
 * stored somewhere durable and served back via a URL. In production, AWS S3 provides
 * managed, scalable, highly-available object storage. During local development, spinning
 * up S3 or a compatible mock adds friction — this service falls back to a local directory
 * when AWS credentials are not configured, so developers can work without any cloud setup.
 *
 * <p><b>Architecture note:</b><br>
 * Defined in {@code hustleup-common} so every microservice that handles file uploads
 * (profile, listings, KYC) can inject the same storage abstraction. The switch between
 * S3 and local is fully transparent to callers — they just call {@link #store} and get
 * back a URL string.
 *
 * <p><b>S3 presigned URLs:</b><br>
 * When S3 is configured, the bucket is treated as private (no public ACLs). Instead of
 * exposing objects publicly, this service generates time-limited <em>presigned URLs</em>
 * that anyone with the URL can use to download the file for up to 7 days. After that,
 * callers must call {@link #refreshUrl} to obtain a new presigned URL. This pattern
 * keeps the bucket private while still allowing the frontend to display images directly.
 *
 * <p><b>Local fallback:</b><br>
 * When AWS credentials or bucket name are absent, files are written to a local directory
 * (default: {@code ./uploads}) and served via Spring's static resource handler under
 * {@code /uploads/**} (bypassed by {@link com.hustleup.common.security.CommonSecurityConfig}).
 */
@Service // Marks this as a Spring-managed service bean — can be @Autowired / constructor-injected
public class FileStorageService {

    /**
     * File extensions accepted by {@link #store}. Everything else is rejected outright.
     *
     * <p><b>Why an allowlist (security):</b> the stored filename previously kept whatever
     * extension the client's filename ended in. Locally-stored uploads are served straight
     * back from {@code /uploads/**} — a path deliberately excluded from the security filter
     * chain — so the browser renders them on the application's own origin. Uploading
     * {@code payload.html} therefore produced a same-origin HTML page under our domain, and
     * {@code payload.svg} an image that browsers execute inline {@code <script>} inside.
     * Either one is stored cross-site scripting, and since the SPA keeps its JWT in
     * {@code localStorage}, that is a straightforward session-theft primitive.
     *
     * <p>Note {@code svg} is deliberately absent even though it is an image format: SVG is
     * an XML document that can carry script, and it is the single most common stored-XSS
     * vector in "images are safe" upload handlers.
     */
    private static final java.util.Set<String> ALLOWED_EXTENSIONS = java.util.Set.of(
            // Raster images
            "jpg", "jpeg", "png", "gif", "webp", "avif", "heic", "heif", "bmp",
            // Video (stories and listing clips)
            "mp4", "mov", "webm", "m4v"
    );

    /**
     * MIME type prefixes accepted by {@link #store} — a second, independent check alongside
     * {@link #ALLOWED_EXTENSIONS} so a mismatched pair (e.g. {@code text/html} bytes named
     * {@code .png}) is refused rather than stored and later sniffed by a browser.
     */
    private static final java.util.Set<String> ALLOWED_CONTENT_TYPE_PREFIXES =
            java.util.Set.of("image/", "video/");

    /**
     * Hard ceiling on a single upload, independent of the per-service
     * {@code spring.servlet.multipart.max-file-size}. Keeps a misconfigured service from
     * accepting an unbounded write to disk.
     */
    private static final long MAX_FILE_BYTES = 500L * 1024 * 1024; // 500 MB

    /**
     * Absolute path to the local upload directory — used only when S3 is not configured.
     *
     * <p>Created automatically during construction if it does not already exist. The
     * default value ({@code ./uploads}) is relative to the process working directory but
     * is resolved to an absolute path via {@code Paths.get(...).toAbsolutePath()} to
     * avoid ambiguity.
     */
    private final Path uploadDir;

    /**
     * AWS S3 client for uploading objects to the configured bucket.
     *
     * <p>Set to {@code null} when AWS credentials are not provided, indicating that local
     * storage should be used instead. All methods that would use S3 check for {@code null}
     * before calling S3 APIs.
     */
    private final S3Client s3Client;

    /**
     * AWS S3 presigner for generating time-limited download URLs.
     *
     * <p>Presigned URLs are generated from this instance when serving file URLs back to
     * clients. Like {@link #s3Client}, this is {@code null} in local-storage mode.
     */
    private final S3Presigner s3Presigner;

    /**
     * Name of the S3 bucket where uploaded files are stored.
     *
     * <p>Injected from {@code app.aws.s3.bucket}. Empty string when not configured,
     * which triggers local storage mode.
     */
    private final String bucketName;

    /**
     * AWS region where the S3 bucket resides (e.g. "us-east-1", "eu-west-2").
     *
     * <p>Used when constructing the S3 client and when building the base S3 URL for
     * stripping in {@link #refreshUrl}. Defaults to "us-east-1" if not configured.
     */
    private final String awsRegion;

    /**
     * CDN domain fronting the S3 bucket (e.g. a CloudFront distribution domain, or a custom
     * subdomain like {@code cdn.yourdomain.com}). Empty string when not configured.
     *
     * <p>When set, {@link #presign} and {@link #uploadToS3} return stable CDN URLs instead
     * of expiring presigned S3 URLs — this assumes the bucket is configured with Origin
     * Access Control so it is only reachable through the CDN (see INTEGRATIONS.md), so
     * objects no longer need per-request signing.
     */
    private final String cdnDomain;

    /**
     * Constructs the service and initialises the correct storage backend.
     *
     * <p><b>Dual-mode initialisation logic:</b><br>
     * If all three AWS parameters ({@code accessKey}, {@code secretKey}, {@code bucket})
     * are non-blank, an {@link S3Client} and {@link S3Presigner} are created using
     * {@link StaticCredentialsProvider} (explicit credential injection — avoids relying
     * on the default credential chain which might pick up the wrong IAM role in complex
     * environments).
     *
     * <p>If any AWS parameter is blank (the default for properties without a value), the
     * service falls back to local disk. The upload directory is created eagerly at startup
     * so that the first file upload does not fail due to a missing directory.
     *
     * @param uploadDir  local directory path for files when S3 is unavailable
     * @param accessKey  AWS access key ID; empty string to use local storage
     * @param secretKey  AWS secret access key; empty string to use local storage
     * @param region     AWS region for the S3 bucket (defaults to "us-east-1")
     * @param bucket     S3 bucket name; empty string to use local storage
     * @param cdnDomain  CDN domain fronting the bucket; empty string to serve straight from S3
     */
    public FileStorageService(
            @Value("${app.upload.dir:./uploads}") String uploadDir,
            @Value("${app.aws.access-key:}") String accessKey,
            @Value("${app.aws.secret-key:}") String secretKey,
            @Value("${app.aws.region:us-east-1}") String region,
            @Value("${app.aws.s3.bucket:}") String bucket,
            @Value("${app.cdn.domain:}") String cdnDomain) {

        // Resolve to absolute path and normalise (remove ".." segments) for safety
        this.uploadDir = Paths.get(uploadDir).toAbsolutePath().normalize();
        this.bucketName = bucket;
        this.awsRegion = region;
        this.cdnDomain = cdnDomain;

        if (!accessKey.isBlank() && !secretKey.isBlank() && !bucket.isBlank()) {
            // All AWS config present — build an S3 client and presigner for cloud storage
            StaticCredentialsProvider creds = StaticCredentialsProvider.create(
                    AwsBasicCredentials.create(accessKey, secretKey));
            this.s3Client = S3Client.builder()
                    .region(Region.of(region))
                    .credentialsProvider(creds)
                    .build();
            this.s3Presigner = S3Presigner.builder()
                    .region(Region.of(region))
                    .credentialsProvider(creds)
                    .build();
        } else {
            // No AWS config — use local disk; s3Client and s3Presigner stay null
            this.s3Client = null;
            this.s3Presigner = null;
            try {
                // Create the local upload directory if it doesn't exist yet
                Files.createDirectories(this.uploadDir);
            } catch (IOException e) {
                throw new RuntimeException("Could not create upload directory", e);
            }
        }
    }

    /**
     * Generates a fresh presigned GET URL for an object already stored in S3.
     *
     * <p>S3 presigned URLs embed a cryptographic signature that grants temporary read
     * access to a private object. The URL expires after {@code Duration.ofDays(7)} — the
     * client must request a new one (via {@link #refreshUrl}) before expiry.
     *
     * <p>If a CDN domain is configured, a stable (non-expiring) CDN URL is returned instead
     * of a presigned S3 URL — see {@link #cdnDomain}. If S3 is not configured at all
     * ({@code s3Presigner == null}), the key is returned as a local path prefixed with
     * {@code /} to be served as a static resource.
     *
     * @param s3Key the S3 object key (e.g. {@code "uploads/uuid.jpg"})
     * @return a CDN URL, a time-limited presigned URL, or a local path, depending on config
     */
    public String presign(String s3Key) {
        if (!cdnDomain.isBlank()) return "https://" + cdnDomain + "/" + s3Key;
        if (s3Presigner == null) return "/" + s3Key; // Local mode — return as a static resource URL
        GetObjectPresignRequest presignReq = GetObjectPresignRequest.builder()
                .signatureDuration(Duration.ofDays(7)) // URL is valid for 7 days
                .getObjectRequest(GetObjectRequest.builder().bucket(bucketName).key(s3Key).build())
                .build();
        return s3Presigner.presignGetObject(presignReq).url().toString();
    }

    /**
     * Refreshes a media URL that may contain stale or expired presigned parameters.
     *
     * <p>This method handles three URL formats:
     * <ol>
     *   <li><b>Local path</b> (starts with {@code /}) — returned unchanged, as local
     *       files do not expire.</li>
     *   <li><b>S3 full URL</b> (e.g. {@code https://bucket.s3.region.amazonaws.com/key?...})
     *       — the key is extracted by stripping the bucket/region prefix and query
     *       parameters, then a new 7-day presigned URL is generated.</li>
     *   <li><b>S3 key without scheme</b> (no {@code https://} prefix) — presigned
     *       directly after stripping any stale query parameters.</li>
     * </ol>
     *
     * <p>Why is this needed? AWS presigned URLs expire. When a service stores a presigned
     * URL in the database and then retrieves it weeks later, the URL is no longer valid.
     * Callers should run stored URLs through this method before returning them to the
     * frontend to ensure the URL is always fresh.
     *
     * @param storedUrl the URL as it was stored in the database (may be expired)
     * @return a fresh, valid URL; {@code null} if the input is {@code null}
     */
    public String refreshUrl(String storedUrl) {
        if (storedUrl == null) return null;
        if (storedUrl.startsWith("/")) return storedUrl; // Local file — no expiry
        if (!cdnDomain.isBlank() && storedUrl.startsWith("https://" + cdnDomain + "/")) {
            return storedUrl; // Already a stable CDN URL — nothing to refresh
        }
        if (s3Presigner == null && cdnDomain.isBlank()) return storedUrl; // S3 not configured — return as-is

        String key = storedUrl;
        // Build the expected URL prefix for this bucket/region to detect full S3 URLs
        String prefix = "https://" + bucketName + ".s3." + awsRegion + ".amazonaws.com/";
        if (storedUrl.startsWith(prefix)) {
            // Strip the bucket/region prefix to get the raw S3 key
            key = storedUrl.substring(prefix.length());
        } else if (storedUrl.startsWith("https://")) {
            // Some other HTTPS URL (different S3 URL format, CDN, etc.) — strip query params only
            int q = storedUrl.indexOf('?');
            return q > 0 ? storedUrl.substring(0, q) : storedUrl;
        }
        // Remove any stale query parameters (presign signature, expiry, etc.) from the key
        int q = key.indexOf('?');
        if (q > 0) key = key.substring(0, q);
        return presign(key); // Generate a fresh presigned URL for the clean key
    }

    /**
     * Stores an uploaded file and returns a URL pointing to it.
     *
     * <p>This is the primary entry point for file uploads. It:
     * <ol>
     *   <li>Generates a random UUID-based filename to prevent collisions and avoid
     *       exposing the original filename (which could contain sensitive info).</li>
     *   <li>Preserves the original file extension for content-type hinting.</li>
     *   <li>Delegates to either {@link #uploadToS3} or {@link #storeLocally} depending
     *       on whether S3 is configured.</li>
     * </ol>
     *
     * @param file the uploaded file received from a multipart HTTP request
     * @return a URL string pointing to the stored file — either an S3 URL or a local path
     * @throws RuntimeException wrapping {@link IOException} if the file cannot be written
     */
    public String store(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("No file was uploaded");
        }
        if (file.getSize() > MAX_FILE_BYTES) {
            throw new IllegalArgumentException("That file is too large — the maximum upload size is 500MB");
        }

        // Both checks must pass: the declared MIME type AND the extension. Validating only
        // one lets an attacker satisfy it while the other carries the dangerous value.
        String contentType = file.getContentType();
        if (contentType == null || ALLOWED_CONTENT_TYPE_PREFIXES.stream().noneMatch(contentType::startsWith)) {
            throw new IllegalArgumentException("Only image and video files can be uploaded");
        }

        String extension = safeExtension(file.getOriginalFilename());

        try {
            // The stored name is a server-generated UUID plus the validated extension. The
            // client's filename never reaches the filesystem: it is only ever inspected to
            // pick an extension out of the allowlist above.
            String filename = UUID.randomUUID() + "." + extension;

            if (s3Client != null) {
                return uploadToS3(file, filename);
            } else {
                return storeLocally(file, filename);
            }
        } catch (IOException e) {
            throw new RuntimeException("Failed to store file", e);
        }
    }

    /**
     * Extracts a safe, allowlisted extension from a client-supplied filename.
     *
     * <p><b>Why this is not just {@code substring(lastIndexOf('.'))} (security):</b> that
     * expression copies an arbitrary attacker-controlled tail into the name we hand to
     * {@code Path.resolve()}. A filename such as {@code a.} + {@code ./../../../evil.jsp}
     * yields an "extension" containing path separators, and resolving it escapes the upload
     * directory entirely — an arbitrary file write anywhere the service user can reach.
     * Matching against a fixed allowlist removes the whole class of problem: the returned
     * value is always one of a handful of known-good literals, never client input.
     *
     * @param originalFilename the client-supplied name; may be {@code null}
     * @return a lowercase extension from {@link #ALLOWED_EXTENSIONS}, without the leading dot
     * @throws IllegalArgumentException if the name has no extension, or one that is not allowed
     */
    private String safeExtension(String originalFilename) {
        if (originalFilename == null || originalFilename.isBlank()) {
            throw new IllegalArgumentException("Uploaded file has no filename");
        }
        int dot = originalFilename.lastIndexOf('.');
        if (dot < 0 || dot == originalFilename.length() - 1) {
            throw new IllegalArgumentException("Uploaded file has no extension");
        }

        String candidate = originalFilename.substring(dot + 1)
                .toLowerCase(java.util.Locale.ROOT)
                .trim();

        if (!ALLOWED_EXTENSIONS.contains(candidate)) {
            throw new IllegalArgumentException(
                    "Unsupported file type — allowed types are images (jpg, png, gif, webp, avif, heic, bmp) "
                            + "and video (mp4, mov, webm, m4v)");
        }
        return candidate;
    }

    /**
     * Uploads a file to the configured S3 bucket and returns its permanent S3 URL.
     *
     * <p>The object is stored under the {@code uploads/} prefix in the bucket (e.g.
     * {@code uploads/550e8400-uuid.jpg}). The {@code contentType} is set so that
     * browsers can determine how to render the file without relying on the extension.
     *
     * <p>If a CDN domain is configured, the stable CDN URL is returned directly (no signing
     * needed — see {@link #cdnDomain}). Otherwise the permanent S3 base URL is returned; it
     * will only be directly accessible if the bucket is public, so in a private-bucket setup
     * callers should pass this URL through {@link #refreshUrl} before serving it.
     *
     * @param file     the multipart file to upload
     * @param filename the UUID-based target filename (without path prefix)
     * @return the CDN URL if configured, otherwise the permanent S3 URL of the uploaded object
     * @throws IOException if reading the file's input stream fails
     */
    private String uploadToS3(MultipartFile file, String filename) throws IOException {
        String key = "uploads/" + filename; // S3 object key — prefix organises uploads in the bucket
        // Fall back to octet-stream if the browser didn't send a content-type header
        String contentType = file.getContentType() != null ? file.getContentType() : "application/octet-stream";

        PutObjectRequest req = PutObjectRequest.builder()
                .bucket(bucketName)
                .key(key)
                .contentType(contentType) // Stored as S3 object metadata — used when downloading
                .build();

        // Stream the file bytes to S3 — avoids loading the entire file into memory
        s3Client.putObject(req, RequestBody.fromInputStream(file.getInputStream(), file.getSize()));

        if (!cdnDomain.isBlank()) return "https://" + cdnDomain + "/" + key;

        // Return the standard S3 URL format — callers can presign this later via refreshUrl()
        return String.format("https://%s.s3.%s.amazonaws.com/%s", bucketName, awsRegion, key);
    }

    /**
     * Writes a file to the local upload directory and returns its web-accessible path.
     *
     * <p>The file is written to {@code <uploadDir>/<filename>}. The returned path
     * ({@code /uploads/<filename>}) is the URL path under which Spring serves the file
     * via its static resource handler. The {@code /uploads/**} path is bypassed by Spring
     * Security (see {@link com.hustleup.common.security.CommonSecurityConfig}) so no
     * authentication is required to download the file.
     *
     * <p>{@code StandardCopyOption.REPLACE_EXISTING} silently overwrites any file with
     * the same name — practically impossible to hit since filenames are UUIDs, but
     * prevents a crash if it somehow does happen.
     *
     * @param file     the multipart file to store
     * @param filename the UUID-based target filename
     * @return the web path to the stored file (e.g. {@code /uploads/uuid.jpg})
     * @throws IOException if writing to disk fails (e.g. disk full, permission denied)
     */
    private String storeLocally(MultipartFile file, String filename) throws IOException {
        Path targetPath = uploadDir.resolve(filename).normalize(); // Full absolute path on disk

        // Defence in depth: filename is already a server-generated UUID plus an allowlisted
        // extension, so it cannot contain path separators. This asserts that invariant at the
        // point it actually matters, so any future change to how names are built cannot
        // silently reintroduce a write outside the upload directory.
        if (!targetPath.startsWith(uploadDir)) {
            throw new IllegalArgumentException("Invalid upload path");
        }

        Files.copy(file.getInputStream(), targetPath, StandardCopyOption.REPLACE_EXISTING);
        return "/uploads/" + filename; // Return web-accessible relative URL
    }
}
