/**
 * Business logic layer for listing management on the HustleUp marketplace.
 *
 * <p>This service sits between the HTTP controller ({@link com.hustleup.listing.controller.ListingController})
 * and the database (via repositories). It is responsible for:
 * <ul>
 *   <li>Fetching and filtering listings for public browse and search</li>
 *   <li>Authorising create/update/delete operations (only the owning seller may change a listing)</li>
 *   <li>Uploading media files to object storage and persisting their URLs</li>
 *   <li>Enriching raw entity data with seller profile info and review aggregates</li>
 *   <li>Notifying a seller's followers when a new listing is published</li>
 *   <li>Computing personalised listing recommendations using a multi-factor scoring algorithm</li>
 * </ul>
 *
 * <p>{@code @Service} registers this class as a Spring-managed bean. Spring will create one
 * instance and inject it wherever it is required (e.g. in the controller constructor).
 */
package com.hustleup.listing.service;

import com.hustleup.listing.dto.ListingDto;
import com.hustleup.listing.model.Listing;
import com.hustleup.listing.model.ListingStatus;
import com.hustleup.listing.model.ListingType;
import com.hustleup.listing.repository.ListingRepository;
import com.hustleup.review.repository.ReviewRepository;
import com.hustleup.common.storage.FileStorageService;
import com.hustleup.common.model.User;
import com.hustleup.common.model.Notification;
import com.hustleup.common.repository.UserRepository;
import com.hustleup.common.repository.NotificationRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.*;
import java.util.stream.Collectors;

// @Service marks this as a Spring service component.
// It is semantically the same as @Component but communicates intent: this class contains
// business logic rather than being a controller or repository.
@Service
public class ListingService {

    // --- Dependencies injected via constructor (constructor injection is preferred over
    //     @Autowired field injection because it makes dependencies explicit and allows
    //     unit testing without a Spring context) ---

    private final ListingRepository listingRepository;           // CRUD access to the listings table
    private final UserRepository userRepository;                 // look up seller / buyer user profiles
    private final ReviewRepository reviewRepository;             // fetch rating aggregates per seller
    private final FileStorageService fileStorageService;         // upload images and generate signed URLs
    private final NotificationRepository notificationRepository; // persist in-app notifications
    private final JdbcTemplate jdbcTemplate;                     // run raw SQL for the follows table

    /**
     * Constructor injection: Spring resolves and injects each dependency automatically
     * because they are registered beans. This is the recommended approach in modern
     * Spring Boot — it keeps the class immutable and testable.
     */
    public ListingService(ListingRepository listingRepository, UserRepository userRepository,
                          ReviewRepository reviewRepository, FileStorageService fileStorageService,
                          NotificationRepository notificationRepository, JdbcTemplate jdbcTemplate) {
        this.listingRepository = listingRepository;
        this.userRepository = userRepository;
        this.reviewRepository = reviewRepository;
        this.fileStorageService = fileStorageService;
        this.notificationRepository = notificationRepository;
        this.jdbcTemplate = jdbcTemplate;
    }

    /**
     * Returns all active listings matching optional filters, defaulting to "latest" sort order.
     *
     * <p>This overload exists as a convenience so callers that don't care about sort order
     * don't have to pass a sort argument.
     *
     * @param type       filter by listing type, or {@code null} for all types
     * @param city       partial city name filter, or {@code null}
     * @param maxPrice   upper price bound, or {@code null}
     * @param negotiable negotiability filter, or {@code null}
     * @return enriched DTOs sorted by newest first
     */
    public List<ListingDto> getAll(ListingType type, String city, BigDecimal maxPrice, Boolean negotiable) {
        // Delegate to the sort-aware overload with a default sort value
        return getAll(type, city, maxPrice, negotiable, "latest");
    }

    /**
     * Returns all active listings matching optional filters, with configurable sort order.
     *
     * <p>Sort strategy: if {@code sort} equals {@code "price"}, results are ordered by
     * price ascending (cheapest first). Any other value (including the default {@code "latest"})
     * returns results ordered by creation date descending (newest first).
     *
     * @param type       filter by listing type, or {@code null}
     * @param city       partial city name filter, or {@code null}
     * @param maxPrice   upper price bound, or {@code null}
     * @param negotiable negotiability filter, or {@code null}
     * @param sort       {@code "price"} for price-ascending, anything else for newest-first
     * @return enriched DTOs
     */
    public List<ListingDto> getAll(ListingType type, String city, BigDecimal maxPrice, Boolean negotiable, String sort) {
        // Choose the appropriate repository query based on the requested sort order.
        // We use two separate repository methods rather than a dynamic ORDER BY because
        // JPQL does not support parameterised ORDER BY clauses.
        List<Listing> listings = "price".equals(sort)
                ? listingRepository.findWithFiltersSortByPrice(type, city, maxPrice, negotiable)
                : listingRepository.findWithFilters(type, city, maxPrice, negotiable);
        // Stream over the results and enrich each entity with seller info and review data
        return listings.stream().map(this::enrichDto).collect(Collectors.toList());
    }

    /**
     * Searches active listings by keyword across title, description, and city.
     *
     * <p>Delegates to a LIKE-based JPQL query — suitable for an MVP. At higher scale this
     * would be replaced by a dedicated search engine (e.g. Elasticsearch).
     *
     * @param query the keyword to search for
     * @return enriched DTOs whose title, description, or city contains the keyword
     */
    public List<ListingDto> search(String query) {
        return listingRepository.search(query).stream()
                .map(this::enrichDto).collect(Collectors.toList());
    }

    /**
     * Fetches a single listing by its UUID.
     *
     * @param id the UUID of the listing
     * @return an enriched DTO
     * @throws RuntimeException if no listing exists with the given ID
     */
    public ListingDto getById(UUID id) {
        Listing listing = listingRepository.findById(id)
                // orElseThrow lazily evaluates: if the Optional is empty, it calls the supplier
                // and throws the resulting exception. The lambda () -> new RuntimeException(...)
                // is only executed when the listing is not found.
                .orElseThrow(() -> new RuntimeException("Listing not found"));
        return enrichDto(listing);
    }

    /**
     * Returns all non-deleted listings for a given seller, used to power their public shop page.
     *
     * <p>Unlike {@link #getMyListings()} (which uses the authenticated user's context),
     * this method takes an explicit {@code sellerId} so any visitor can view any seller's shop.
     *
     * @param sellerId the UUID of the seller whose public shop to load
     * @return enriched DTOs for all non-deleted listings belonging to that seller
     */
    public List<ListingDto> getByUser(UUID sellerId) {
        // findBySellerIdAndStatusNot excludes DELETED listings so removed items don't appear
        // on the public shop — active, paused, and sold-out listings are all still visible.
        return listingRepository.findBySellerIdAndStatusNot(sellerId, ListingStatus.DELETED)
                .stream()
                .map(this::enrichDto)
                .collect(Collectors.toList());
    }

    /**
     * Creates a new listing for the currently authenticated seller.
     *
     * <p>Authentication: the seller's identity is read from the Spring Security context
     * rather than accepting a {@code sellerId} parameter. This prevents a buyer from
     * forging a listing on someone else's behalf.
     *
     * <p>Image upload: each {@link MultipartFile} is passed to {@link FileStorageService#store},
     * which persists it to object storage and returns a URL/path. The URLs are joined with
     * commas and stored on the entity's {@code mediaUrls} field.
     *
     * <p>After saving, followers of the seller are notified via the notification system.
     *
     * @param title       headline for the listing (required)
     * @param description detailed description (optional)
     * @param listingType the {@link ListingType} name as a string (e.g. "SKILL")
     * @param price       asking price
     * @param currency    ISO 4217 currency code; defaults to "GBP" if null
     * @param negotiable  whether the price is negotiable
     * @param city        city or "Remote"
     * @param meta        optional JSON metadata blob
     * @param images      optional uploaded images; may be null or empty
     * @return the created listing as an enriched DTO
     */
    public ListingDto create(String title, String description, String listingType, BigDecimal price,
                              String currency, boolean negotiable, String city, boolean agentFee,
                              String meta, List<MultipartFile> images) {
        // Resolve the authenticated user's email from the Spring Security context.
        // The email is the "principal name" set during JWT authentication.
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        User seller = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        // Upload images to object storage (e.g. MinIO/S3) and collect the resulting URLs
        String mediaUrlsCsv = "";
        if (images != null && !images.isEmpty()) {
            mediaUrlsCsv = images.stream()
                    .map(fileStorageService::store) // uploads each file and returns its stored URL
                    .collect(Collectors.joining(",")); // join multiple URLs with a comma delimiter
        }

        // Build the entity using Lombok's fluent builder. ListingStatus defaults to ACTIVE
        // (set in the entity class), so new listings are immediately visible.
        Listing listing = Listing.builder()
                .sellerId(seller.getId())
                .title(title)
                .description(description)
                // ListingType.valueOf converts the string (e.g. "SKILL") to the enum constant.
                // This will throw IllegalArgumentException if an invalid type is passed.
                .listingType(ListingType.valueOf(listingType))
                .price(price)
                .currency(currency != null ? currency : "GBP") // fall back to GBP if not specified
                .negotiable(negotiable)
                .locationCity(city)
                .agentFee(agentFee)
                .meta(meta)
                .mediaUrls(mediaUrlsCsv)
                .build();

        Listing saved = listingRepository.save(listing);
        // Notify followers after the listing is saved so the ID is available for the notification
        notifyFollowersOfNewListing(seller, saved);
        return enrichDto(saved);
    }

    /**
     * Sends in-app notifications to everyone who follows the seller, alerting them that a
     * new listing has been published.
     *
     * <p>The {@code follows} table is managed by the social service and accessed here via
     * raw JDBC ({@link JdbcTemplate}) since there is no JPA entity for it in this module.
     * Errors are silently swallowed ({@code catch (Exception ignored)}) so that a notification
     * failure never prevents the listing from being created successfully.
     *
     * @param seller the user who created the listing
     * @param saved  the newly persisted listing entity
     */
    private void notifyFollowersOfNewListing(User seller, Listing saved) {
        try {
            String sellerId = seller.getId().toString();
            // Query the follows table for all followers of this seller.
            // JdbcTemplate.queryForList returns a plain List<String> for single-column queries.
            List<String> followerIds = jdbcTemplate.queryForList(
                    "SELECT follower_id FROM follows WHERE following_id = ?", String.class, sellerId);
            if (!followerIds.isEmpty()) {
                // Prefer the full name; fall back to the part of the email before "@"
                String sellerName = seller.getFullName() != null && !seller.getFullName().isBlank()
                        ? seller.getFullName() : seller.getEmail().split("@")[0];
                // Build one Notification per follower
                List<Notification> notifs = followerIds.stream().map(fid -> {
                    try {
                        return Notification.builder()
                                .userId(UUID.fromString(fid))        // who receives the notification
                                .title(sellerName + " listed something new") // notification headline
                                .message(saved.getTitle())           // listing title as the body
                                .notificationType("LISTING")         // type tag for client-side routing
                                .referenceId(saved.getId())          // deep-link target
                                .build();
                    } catch (Exception e) { return null; } // skip malformed follower IDs
                }).filter(Objects::nonNull).collect(Collectors.toList());
                // Batch-insert all notifications in one query
                notificationRepository.saveAll(notifs);
            }
        } catch (Exception ignored) {
            // Notification failure must never cause the listing creation to fail.
            // Silently ignore any database or parsing errors here.
        }
    }

    /**
     * Partially updates a listing owned by the currently authenticated seller.
     *
     * <p>Only the fields passed as non-null are updated; null arguments are treated as
     * "no change". The exception is {@code negotiable} which is a primitive boolean —
     * it is always written. The caller (controller) sets it to {@code false} by default
     * if not provided.
     *
     * <p>Ownership check: the method verifies that the authenticated user's ID matches
     * the listing's {@code sellerId}. Any other user (including admins) is rejected with
     * a {@code RuntimeException}.
     *
     * @param id          UUID of the listing to update
     * @param title       new title, or {@code null} to keep current
     * @param description new description, or {@code null} to keep current
     * @param price       new price, or {@code null} to keep current
     * @param negotiable  new negotiability flag (always applied)
     * @param city        new city, or {@code null} to keep current
     * @param meta        new metadata, or {@code null} to keep current
     * @param status      new status string (e.g. "PAUSED"), or {@code null} to keep current
     * @return the updated listing as an enriched DTO
     */
    public ListingDto update(UUID id, String title, String description, BigDecimal price,
                              boolean negotiable, String city, String meta, String status) {
        // Resolve authenticated seller identity
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        User seller = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        Listing listing = listingRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Listing not found"));

        // Ownership guard: ensure the logged-in user actually owns this listing.
        // equals() on UUID is safe because UUID implements equals() by value comparison.
        if (!listing.getSellerId().equals(seller.getId())) {
            throw new RuntimeException("You don't own this listing");
        }

        // Apply only the non-null updates (partial update / PATCH semantics)
        if (title != null) listing.setTitle(title);
        if (description != null) listing.setDescription(description);
        if (price != null) listing.setPrice(price);
        listing.setNegotiable(negotiable); // primitive — always overwritten
        if (city != null) listing.setLocationCity(city);
        if (meta != null) listing.setMeta(meta);
        if (status != null) listing.setStatus(ListingStatus.valueOf(status)); // convert string to enum

        return enrichDto(listingRepository.save(listing));
    }

    /**
     * Returns all listings belonging to the currently authenticated seller, regardless of status.
     *
     * <p>This is the seller's private dashboard view — it includes PAUSED, SOLD_OUT, and
     * DELETED listings that are hidden from public browse.
     *
     * @return enriched DTOs for every listing owned by the authenticated seller
     */
    public List<ListingDto> getMyListings() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        User seller = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
        return listingRepository.findBySellerId(seller.getId()).stream()
                .map(this::enrichDto).collect(Collectors.toList());
    }

    /**
     * Permanently deletes a listing owned by the currently authenticated seller.
     *
     * <p>Note: this is a hard delete — the row is physically removed from the database.
     * If preserving booking history is important, consider switching to a soft delete
     * (set status to {@link ListingStatus#DELETED}) instead.
     *
     * @param id UUID of the listing to delete
     * @throws RuntimeException if the listing is not found or the caller does not own it
     */
    public void delete(UUID id) {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        User seller = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
        
        Listing listing = listingRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Listing not found"));

        // Ownership guard — same pattern as update()
        if (!listing.getSellerId().equals(seller.getId())) {
            throw new RuntimeException("You don't own this listing");
        }

        // Hard delete: the row is gone. Any bookings referencing this listingId will still
        // have the UUID, but listing lookups for those bookings will return empty.
        listingRepository.deleteById(id);
    }

    /**
     * Converts a {@link Listing} entity into an enriched {@link ListingDto} by adding seller
     * profile data and review aggregates.
     *
     * <p>This is called after every read operation so API consumers always get a complete picture.
     * Errors in enrichment (e.g. seller not found due to cross-service data inconsistency) are
     * caught silently and the DTO is returned with zeroed rating fields rather than throwing.
     *
     * @param listing the raw entity from the database
     * @return a fully populated DTO ready to serialise to JSON
     */
    private ListingDto enrichDto(Listing listing) {
        // Start with entity fields (including URL-refreshed media URLs from object storage)
        ListingDto dto = ListingDto.fromEntity(listing, fileStorageService::refreshUrl);
        try {
            // Look up the seller's profile to attach display name, avatar, and verification badge
            userRepository.findById(listing.getSellerId()).ifPresent(seller -> {
                dto.setSellerName(seller.getFullName());
                String avatarUrl = seller.getAvatarUrl();
                // Refresh the avatar URL so it is a valid signed URL if stored in object storage
                dto.setSellerAvatarUrl(avatarUrl != null ? fileStorageService.refreshUrl(avatarUrl) : null);
                dto.setSellerVerified(seller.isIdVerified());
            });
            // Attach aggregate review stats for the seller (displayed as a star rating on the listing card)
            Double avg = reviewRepository.averageRatingForUser(listing.getSellerId());
            dto.setAvgRating(avg != null ? avg : 0.0); // default to 0 if no reviews yet
            dto.setReviewCount(reviewRepository.countByReviewedId(listing.getSellerId()));
        } catch (Exception e) {
            // If enrichment fails (e.g. user service down, DB hiccup), return safe defaults
            // rather than propagating a 500 error for a cosmetic enrichment step.
            dto.setAvgRating(0.0);
            dto.setReviewCount(0);
        }
        return dto;
    }

    /**
     * Returns a personalised ordered list of active listings for the authenticated viewer.
     *
     * <p>Each listing is scored using four additive signals (higher score = ranked higher):
     * <ul>
     *   <li><b>Recency (0–80)</b> — exponential decay with ~8-day half-life. Very new listings
     *       score close to 80; listings older than ~30 days score near 0. Formula:
     *       {@code 80 * e^(-0.09 * ageDays)}.</li>
     *   <li><b>Quality (0–45)</b> — based on the seller's average rating weighted by review
     *       count: {@code min(avgRating * reviewCount * 1.5, 45)}. A seller with many
     *       high ratings scores much higher than one with just one 5-star review.</li>
     *   <li><b>Follow (+60)</b> — a flat bonus applied if the viewer follows the seller,
     *       ensuring content from followed sellers appears near the top.</li>
     *   <li><b>Location (+25)</b> — a flat bonus if the listing's city exactly matches the
     *       viewer's registered city, promoting local discovery.</li>
     * </ul>
     *
     * <p>Falls back to a plain latest-sorted list when the caller is not authenticated or the
     * user record cannot be found.
     *
     * @return enriched DTOs in recommendation order (highest score first)
     */
    public List<ListingDto> getRecommended() {
        String email;
        try {
            // Read the authenticated user's email from Spring Security context
            email = SecurityContextHolder.getContext().getAuthentication().getName();
        } catch (Exception e) {
            // No authentication context — return generic latest listings
            return getAll(null, null, null, null, "latest");
        }

        User viewer = userRepository.findByEmail(email).orElse(null);
        if (viewer == null) return getAll(null, null, null, null, "latest");

        String viewerId = viewer.getId().toString();
        // Normalise city to lowercase for case-insensitive comparison below
        String viewerCity = viewer.getCity() != null ? viewer.getCity().trim().toLowerCase() : "";

        // Fetch all seller IDs that the viewer follows via raw JDBC (follows table is in social service)
        Set<String> following;
        try {
            following = new HashSet<>(jdbcTemplate.queryForList(
                    "SELECT following_id FROM follows WHERE follower_id = ?",
                    String.class, viewerId));
        } catch (Exception e) {
            // If the follows table is unreachable, proceed without the follow signal
            following = Collections.emptySet();
        }

        // Capture as effectively-final variables for use inside the lambda below
        final Set<String> followingIds = following;
        final String city = viewerCity;

        // Fetch all active listings (no filters — we score them all)
        List<Listing> active = listingRepository.findWithFilters(null, null, null, null);
        long nowMs = System.currentTimeMillis(); // snapshot once to avoid drift during scoring

        // Java 16+ record: a concise immutable data class used as a local value holder.
        // Pairs each listing with its computed relevance score.
        record Scored(Listing listing, double score) {}

        List<ListingDto> result = active.stream()
                .map(l -> {
                    // Compute each scoring signal independently
                    double rec  = listingRecency(l, nowMs);                                // time decay
                    double qual = listingQuality(l);                                        // rating quality
                    double fol  = followingIds.contains(l.getSellerId().toString()) ? 60.0 : 0.0; // follow bonus
                    double loc  = (!city.isEmpty() && city.equals(
                            l.getLocationCity() != null ? l.getLocationCity().trim().toLowerCase() : ""))
                            ? 25.0 : 0.0; // location bonus
                    return new Scored(l, rec + qual + fol + loc); // additive score
                })
                // Sort descending: highest score first
                .sorted(Comparator.comparingDouble(Scored::score).reversed())
                // Enrich to DTOs (adds seller info and review aggregates)
                .map(s -> enrichDto(s.listing()))
                .collect(Collectors.toList());

        return result;
    }

    /**
     * Computes the recency score for a listing using exponential decay.
     *
     * <p>Formula: {@code 80 * e^(-0.09 * ageDays)}
     * <ul>
     *   <li>Day 0 → score ≈ 80</li>
     *   <li>Day 5 → score ≈ 51</li>
     *   <li>Day 13 → score ≈ 25</li>
     *   <li>Day 30+ → score ≈ 0</li>
     * </ul>
     *
     * @param l     the listing
     * @param nowMs current time in milliseconds (pass once for the whole batch to avoid drift)
     * @return recency score in the range [0, 80]
     */
    /** 80 at day=0, ~50 at 5 d, ~20 at 13 d, effectively 0 after ~30 d. */
    private double listingRecency(Listing l, long nowMs) {
        if (l.getCreatedAt() == null) return 0.0;
        // Convert the listing's creation time to milliseconds since epoch (UTC) and compute age in days
        double ageDays = (nowMs - l.getCreatedAt().toInstant(ZoneOffset.UTC).toEpochMilli()) / 86_400_000.0;
        return 80.0 * Math.exp(-0.09 * ageDays); // exponential decay formula
    }

    /**
     * Computes the quality score for a listing based on its seller's review data.
     *
     * <p>Formula: {@code min(avgRating * reviewCount * 1.5, 45)}
     *
     * <p>Weighting by review count ensures that a single 5-star review does not score
     * as highly as ten 4-star reviews. The cap of 45 prevents review-stuffing from
     * dominating the score.
     *
     * @param l the listing whose seller's reviews are examined
     * @return quality score in the range [0, 45]
     */
    private double listingQuality(Listing l) {
        try {
            Double avg = reviewRepository.averageRatingForUser(l.getSellerId());
            long cnt   = reviewRepository.countByReviewedId(l.getSellerId());
            if (avg == null || cnt == 0) return 0.0; // no reviews yet → no quality signal
            // Math.min caps the score at 45 to prevent any single factor from dominating
            return Math.min(avg * cnt * 1.5, 45.0);
        } catch (Exception e) {
            return 0.0; // treat any DB error as a zero quality score
        }
    }
}
