/**
 * Data Transfer Object (DTO) for the {@link com.hustleup.social.model.Post} entity.
 *
 * <h2>Why use a DTO instead of returning the raw entity?</h2>
 * <p>JPA entities are tightly coupled to the database schema and Hibernate's lifecycle.
 * Returning them directly from REST controllers is problematic:
 * <ul>
 *   <li><b>Security</b> — entities may contain internal fields that should not be exposed
 *       (e.g. raw storage keys, internal flags).</li>
 *   <li><b>Shape</b> — clients often need computed fields (e.g. {@code likedByCurrentUser},
 *       refreshed media URLs, author avatar) that don't exist on the entity.</li>
 *   <li><b>Lazy loading traps</b> — serialising a JPA entity with Jackson can trigger
 *       lazy Hibernate queries ("N+1 problem") unless extreme care is taken.</li>
 *   <li><b>API stability</b> — the entity schema can change without breaking the API
 *       contract, since the DTO is the stable interface layer.</li>
 * </ul>
 *
 * <h2>Transformation pattern</h2>
 * This DTO uses static factory methods ({@code from(...)}) to convert a {@link Post}
 * entity into a {@code PostDto}.  The factory methods accept additional context
 * (e.g. whether the current user liked the post, a URL refresher function) that the
 * entity itself cannot know about.
 *
 * <h2>Lombok annotations</h2>
 * <ul>
 *   <li>{@code @Data} — generates getters, setters, equals, hashCode, toString</li>
 *   <li>{@code @Builder} — enables the builder pattern used in the static factory methods</li>
 * </ul>
 */
package com.hustleup.social.dto;

import com.hustleup.social.model.Post;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.function.UnaryOperator;

// @Data: generates getters, setters, equals, hashCode, toString for all fields.
@Data
// @Builder: enables PostDto.builder().id(...).content(...).build() construction pattern.
@Builder
public class PostDto {

    /** The post's UUID string primary key — safe to expose to the client. */
    String id;

    /** UUID string of the post's author — used by clients for profile navigation. */
    String authorId;

    /** Display name of the post's author at the time of posting. */
    String authorName;

    /**
     * The author's current profile picture URL.
     *
     * <p>This is NOT stored on the Post entity — it is fetched separately from the
     * User table and injected during DTO conversion.  The DTO layer is the right
     * place to enrich data from multiple sources.
     */
    String authorAvatarUrl;

    /** The text body of the post. */
    String content;

    /**
     * The primary image URL (legacy field for clients that only display one image).
     * Refreshed via the URL refresher function to ensure pre-signed URLs are still valid.
     */
    String imageUrl;

    /**
     * The full ordered list of media items (images and/or videos) attached to this post.
     * Clients that support multiple media items should use this field instead of imageUrl.
     */
    List<PostMediaDto> media;

    /** Optional reference to a marketplace listing associated with this post. */
    String linkedListingId;

    /** Total number of likes on this post (denormalised counter from the Post entity). */
    Integer likesCount;

    /** Total number of comments on this post (denormalised counter from the Post entity). */
    Integer commentsCount;

    /**
     * Whether the currently authenticated user has liked this post.
     *
     * <p>This is a computed field — it cannot come from the Post entity alone.
     * The controller queries the {@code post_likes} table and passes the result to
     * the factory method.  This prevents the client from needing to make an extra
     * API call to determine the like state.
     */
    boolean likedByCurrentUser;

    /** Whether this post was published anonymously. When true, authorId/authorName/authorAvatarUrl are masked. */
    boolean anonymous;

    /** Timestamp of when the post was created. */
    LocalDateTime createdAt;

    // ── Static factory methods (entity → DTO transformation) ─────────────────

    /**
     * Minimal factory: converts a Post with no URL refreshing and no avatar.
     * Used in unit tests and internal contexts where URL freshness is not needed.
     *
     * @param post               the Post entity to convert
     * @param likedByCurrentUser whether the current user has liked this post
     * @return a PostDto representing the post
     */
    public static PostDto from(Post post, boolean likedByCurrentUser) {
        // Delegate to the full factory with a no-op refresher and null avatar.
        return from(post, likedByCurrentUser, url -> url, null);
    }

    /**
     * Factory with URL refreshing but no author avatar.
     *
     * <p>The {@code urlRefresher} is a function that takes a raw storage URL and returns
     * a fresh, valid URL.  For local storage this is a no-op; for S3, it generates a
     * new pre-signed URL with a refreshed expiry time.
     *
     * @param post               the Post entity to convert
     * @param likedByCurrentUser whether the current user has liked this post
     * @param urlRefresher       function to refresh/sign media URLs
     * @return a PostDto with refreshed media URLs
     */
    public static PostDto from(Post post, boolean likedByCurrentUser, UnaryOperator<String> urlRefresher) {
        return from(post, likedByCurrentUser, urlRefresher, null);
    }

    /**
     * Full factory: converts a Post entity to a PostDto with all computed fields.
     *
     * <p>This is the primary factory method used by the feed controller.  It:
     * <ol>
     *   <li>Parses the comma-separated media URLs and types from the Post entity.</li>
     *   <li>Applies the URL refresher to each media URL.</li>
     *   <li>Injects the author avatar URL from the pre-loaded avatar map.</li>
     *   <li>Sets the {@code likedByCurrentUser} flag.</li>
     * </ol>
     *
     * @param post               the Post entity to convert
     * @param likedByCurrentUser whether the current user has liked this post
     * @param urlRefresher       function to refresh/sign media URLs (e.g. S3 pre-signing)
     * @param authorAvatarUrl    the post author's current profile picture URL (may be null)
     * @return a fully populated PostDto ready to be serialised to JSON
     */
    public static PostDto from(Post post, boolean likedByCurrentUser, UnaryOperator<String> urlRefresher, String authorAvatarUrl) {
        // Parse the CSV media columns into a structured list of PostMediaDto objects.
        List<PostMediaDto> media = parseMedia(post, urlRefresher);
        // Refresh the legacy single-image URL if present.
        String imageUrl = post.getImageUrl() != null ? urlRefresher.apply(post.getImageUrl()) : null;

        return PostDto.builder()
                .id(post.getId())
                .authorId(post.isAnonymous() ? null : post.getAuthorId())
                .authorName(post.isAnonymous() ? "Anonymous" : post.getAuthorName())
                // Refresh the avatar URL too (it might be stored in S3 with a pre-signed URL)
                .authorAvatarUrl(post.isAnonymous() ? null : (authorAvatarUrl != null ? urlRefresher.apply(authorAvatarUrl) : null))
                .content(post.getContent())
                // Use the refreshed imageUrl; fall back to the first image in the media list
                .imageUrl(imageUrl != null ? imageUrl : resolvePrimaryImageUrl(media))
                .media(media)
                .linkedListingId(post.getLinkedListingId())
                // Null-safe counter reads — default to 0 if the DB has a null
                .likesCount(post.getLikesCount() == null ? 0 : post.getLikesCount())
                .commentsCount(post.getCommentsCount() == null ? 0 : post.getCommentsCount())
                .likedByCurrentUser(likedByCurrentUser)
                .anonymous(post.isAnonymous())
                .createdAt(post.getCreatedAt())
                .build();
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /**
     * Parses the Post's CSV media columns into a structured list of {@link PostMediaDto}.
     *
     * <p>The Post entity stores media as comma-separated strings for simplicity
     * (see {@link Post#getMediaUrls()}).  This method reconstitutes the structured
     * representation for the DTO.
     *
     * @param post         the Post entity with CSV media data
     * @param urlRefresher function to generate fresh URLs
     * @return list of PostMediaDto, or a single-item list if only imageUrl is set
     */
    private static List<PostMediaDto> parseMedia(Post post, UnaryOperator<String> urlRefresher) {
        List<String> urls = splitCsv(post.getMediaUrls());
        List<String> types = splitCsv(post.getMediaTypes());
        List<PostMediaDto> media = new ArrayList<>();

        for (int i = 0; i < urls.size(); i++) {
            String rawUrl = urls.get(i);
            // Use the parallel types list if available; otherwise infer type from URL extension.
            String type = i < types.size() ? types.get(i) : inferMediaType(rawUrl);
            media.add(new PostMediaDto(urlRefresher.apply(rawUrl), type));
        }

        // Backward compatibility: if no media_urls are set but image_url is, wrap it.
        if (media.isEmpty() && post.getImageUrl() != null && !post.getImageUrl().isBlank()) {
            media.add(new PostMediaDto(urlRefresher.apply(post.getImageUrl()), "IMAGE"));
        }

        return media;
    }

    /**
     * Finds the URL of the first IMAGE item in a media list.
     *
     * <p>Used to populate the legacy {@link #imageUrl} field when a post has no explicit
     * single image URL set, but has media items that include at least one image.
     *
     * @param media the list of media items to search
     * @return the first image URL, or null if no images exist
     */
    private static String resolvePrimaryImageUrl(List<PostMediaDto> media) {
        return media.stream()
                .filter(item -> "IMAGE".equals(item.getType()))
                .map(PostMediaDto::getUrl)
                .findFirst()
                .orElse(null);
    }

    /**
     * Splits a comma-separated string into a list, trimming whitespace and ignoring blanks.
     *
     * @param value the CSV string (e.g. "url1,url2,url3"), may be null or blank
     * @return a list of non-blank trimmed values, or an empty list
     */
    private static List<String> splitCsv(String value) {
        if (value == null || value.isBlank()) {
            return List.of();
        }

        return Arrays.stream(value.split(","))
                .map(String::trim)
                .filter(entry -> !entry.isBlank())
                .toList();
    }

    /**
     * Infers whether a URL points to a video or image based on the file extension.
     *
     * <p>Used as a fallback when the media_types column is missing or malformed.
     * The regex checks for common video extensions, with optional query string ({@code \?.*})
     * to handle URLs like {@code https://cdn.../video.mp4?token=xyz}.
     *
     * @param url the media URL to inspect (may be null)
     * @return {@code "VIDEO"} if the URL has a recognised video extension, otherwise {@code "IMAGE"}
     */
    private static String inferMediaType(String url) {
        String lower = url == null ? "" : url.toLowerCase();
        return lower.matches(".*\\.(mp4|mov|webm|ogg|m4v)(\\?.*)?$") ? "VIDEO" : "IMAGE";
    }

    /**
     * Nested DTO representing a single media item (one image or video) within a post.
     *
     * <p>Kept as a nested class because it only makes sense in the context of a PostDto.
     * Clients use {@code type} to know whether to render an {@code <img>} or {@code <video>} tag.
     */
    @Data
    @Builder
    @lombok.AllArgsConstructor
    @lombok.NoArgsConstructor
    public static class PostMediaDto {

        /** The fully qualified, freshly signed URL of the media file. */
        String url;

        /** The media type: either {@code "IMAGE"} or {@code "VIDEO"}. */
        String type;
    }
}
