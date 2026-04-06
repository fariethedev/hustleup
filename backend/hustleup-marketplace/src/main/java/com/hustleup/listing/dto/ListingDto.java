/**
 * Data Transfer Object (DTO) for a {@link Listing} entity.
 *
 * <p>A DTO is a plain Java object used to carry data between the service layer and
 * the HTTP layer (controller → JSON response). It exists for two reasons:
 * <ol>
 *   <li><b>Shape control</b> — we can include fields that don't live on the entity
 *       (e.g. {@code sellerName}, {@code avgRating}) and exclude fields we don't want
 *       to expose (e.g. {@code version}).</li>
 *   <li><b>Decoupling</b> — the API contract is separate from the database schema, so
 *       we can change one without breaking the other.</li>
 * </ol>
 *
 * <p>{@code ListingDto} is intentionally kept as a pure data holder (no business logic).
 * The static factory method {@link #fromEntity} and the URL-refreshing overload are the
 * only conversion helpers allowed here.
 */
package com.hustleup.listing.dto;

import com.hustleup.listing.model.Listing;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

import java.util.function.UnaryOperator;

// Lombok annotations generate all the boilerplate for a typical Java bean:
//   @Getter / @Setter   → getters and setters for every field
//   @NoArgsConstructor  → public no-arg constructor (needed by Jackson for JSON deserialization)
//   @AllArgsConstructor → constructor that takes every field (used by @Builder internally)
//   @Builder            → fluent builder: ListingDto.builder().title("...").build()
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ListingDto {

    // --- Identity ---
    private UUID id;         // unique identifier of the listing, mirrored from the entity
    private UUID sellerId;   // UUID of the seller who owns this listing

    // --- Seller enrichment (not on the entity — added by ListingService.enrichDto) ---
    private String sellerName;      // seller's display name, looked up from the User table
    private String sellerAvatarUrl; // pre-signed or refreshed URL to the seller's profile photo
    private boolean sellerVerified; // true if the seller has completed identity verification

    // --- Listing content ---
    private String title;       // headline of the listing
    private String description; // full description of the service/product
    private String listingType; // enum name serialised to String (e.g. "SKILL") for JSON clarity

    // --- Pricing ---
    private BigDecimal price;    // asking price
    private String currency;     // ISO 4217 code (e.g. "GBP")
    private boolean negotiable;  // whether the seller is open to a lower offer

    // --- Location ---
    private String locationCity; // city where the service is based, or "Remote"

    // Whether a letting-agent fee applies (RENTAL listings only)
    private boolean agentFee;

    // --- Extra metadata ---
    private String meta;              // optional JSON blob for category-specific fields
    private List<String> mediaUrls;   // parsed image/video URLs (entity stores as CSV, DTO exposes as List)

    // --- Status ---
    private String status; // enum name serialised to String (e.g. "ACTIVE")

    // --- Review aggregates (not on the entity — added by ListingService.enrichDto) ---
    private double avgRating;  // average star rating across all reviews for this seller (0.0–5.0)
    private int reviewCount;   // total number of reviews for this seller

    // --- Timestamps ---
    private LocalDateTime createdAt; // when the listing was first published

    /**
     * Converts a {@link Listing} entity to a {@code ListingDto} using the identity function
     * for media URLs (i.e. URLs are returned unchanged). Convenient when no URL signing is needed.
     *
     * @param listing the entity read from the database
     * @return a DTO with all entity fields copied across
     */
    public static ListingDto fromEntity(Listing listing) {
        // Delegate to the overload with a no-op URL transformer
        return fromEntity(listing, url -> url);
    }

    /**
     * Converts a {@link Listing} entity to a {@code ListingDto}, applying a URL-refresh
     * function to every media URL. This is used when media files are stored in an object
     * store (e.g. S3/MinIO) that issues short-lived pre-signed URLs — the
     * {@code urlRefresher} generates a fresh signed URL for each stored path.
     *
     * @param listing      the entity read from the database
     * @param urlRefresher a function that takes a stored URL/path and returns a fresh,
     *                     potentially signed URL suitable for the client to fetch
     * @return a DTO with all entity fields copied and media URLs refreshed
     */
    public static ListingDto fromEntity(Listing listing, UnaryOperator<String> urlRefresher) {
        return ListingDto.builder()
                .id(listing.getId())
                .sellerId(listing.getSellerId())
                .title(listing.getTitle())
                .description(listing.getDescription())
                // .name() converts the enum constant to its string representation, e.g. SKILL → "SKILL"
                .listingType(listing.getListingType().name())
                .price(listing.getPrice())
                .currency(listing.getCurrency())
                .negotiable(listing.isNegotiable())
                .locationCity(listing.getLocationCity())
                .agentFee(listing.isAgentFee())
                .meta(listing.getMeta())
                // Parse the CSV string into a proper List<String>, applying the URL refresher to each
                .mediaUrls(parseMediaUrls(listing.getMediaUrls(), urlRefresher))
                .status(listing.getStatus().name())
                .createdAt(listing.getCreatedAt())
                .build();
    }

    /**
     * Splits the raw {@code mediaUrls} CSV string stored on the entity into a
     * {@code List<String>} of individual URLs, then passes each through the provided
     * {@code urlRefresher} function.
     *
     * <p>The entity stores media URLs as a comma-separated string to avoid a separate
     * join table (a pragmatic trade-off for simplicity). This method handles edge cases:
     * <ul>
     *   <li>Null or blank input → returns an empty list</li>
     *   <li>JSON-array artefacts ({@code [}, {@code ]}, {@code "}) are stripped in case a
     *       client accidentally persisted a JSON array string instead of bare CSV</li>
     * </ul>
     *
     * @param mediaUrls    the raw CSV string from the entity (may be null or blank)
     * @param urlRefresher applied to each trimmed, non-blank URL token
     * @return an immutable list of refreshed URL strings; never null
     */
    private static List<String> parseMediaUrls(String mediaUrls, UnaryOperator<String> urlRefresher) {
        // Return an empty list immediately if there is nothing to parse
        if (mediaUrls == null || mediaUrls.isBlank()) return List.of();
        return Arrays.stream(mediaUrls.split(","))  // split on comma delimiter
                .map(String::trim)                  // remove surrounding whitespace from each token
                // Strip any accidental JSON array characters that may have crept in
                .map(value -> value.replace("[", "").replace("]", "").replace("\"", ""))
                .filter(value -> !value.isBlank())  // discard any now-empty tokens
                .map(urlRefresher)                  // apply URL signing/refreshing
                .collect(Collectors.toList());
    }
}
