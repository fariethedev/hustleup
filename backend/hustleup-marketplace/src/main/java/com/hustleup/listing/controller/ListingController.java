/**
 * REST controller that exposes the listing API for the HustleUp marketplace.
 *
 * <p>All endpoints are grouped under the base path {@code /api/v1/listings}.
 * Public read endpoints (browse, search, single listing) require no authentication.
 * Write endpoints (create, update, delete) are restricted to users with the
 * {@code SELLER} role, enforced via Spring Security's {@code @PreAuthorize}.
 *
 * <h3>Spring MVC overview (for junior developers)</h3>
 * <ul>
 *   <li>{@code @RestController} = {@code @Controller} + {@code @ResponseBody}. Every method
 *       return value is automatically serialised to JSON and written to the HTTP response body.</li>
 *   <li>{@code @RequestMapping("/api/v1/listings")} sets the URL prefix for all methods.</li>
 *   <li>{@link ResponseEntity} is used as the return type so we can control the HTTP status
 *       code (200 OK, 400 Bad Request, etc.) alongside the body.</li>
 * </ul>
 */
package com.hustleup.listing.controller;

import com.hustleup.listing.dto.ListingDto;
import com.hustleup.listing.model.ListingType;
import com.hustleup.listing.service.ListingService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

// @RestController tells Spring this class handles HTTP requests and that return values
// should be serialised to JSON automatically (no need to annotate each method with @ResponseBody).
@RestController
// All endpoints in this controller are prefixed with /api/v1/listings.
// The "v1" version prefix allows us to introduce breaking API changes in a future /v2 without
// disrupting existing clients.
@RequestMapping("/api/v1/listings")
public class ListingController {

    // The service layer handles all business logic. The controller's only job is to:
    // 1. Parse and validate the incoming HTTP request parameters
    // 2. Call the appropriate service method
    // 3. Wrap the result in a ResponseEntity
    private final ListingService listingService;

    /**
     * Constructor injection: Spring injects the {@link ListingService} bean automatically.
     * Prefer constructor injection over @Autowired fields — it makes dependencies visible
     * and allows the class to be instantiated in unit tests without a Spring context.
     */
    public ListingController(ListingService listingService) {
        this.listingService = listingService;
    }

    /**
     * Browses all active listings with optional filtering and sorting.
     *
     * <p><b>HTTP:</b> {@code GET /api/v1/listings}
     * <br><b>Auth:</b> None required — publicly accessible.
     * <br><b>Query params (all optional):</b>
     * <ul>
     *   <li>{@code type} — filter by {@link ListingType} name (e.g. {@code type=SKILL})</li>
     *   <li>{@code city} — partial city name filter (case-insensitive)</li>
     *   <li>{@code maxPrice} — upper price bound (inclusive)</li>
     *   <li>{@code negotiable} — {@code true} / {@code false}</li>
     *   <li>{@code sort} — {@code "price"} for price-ascending, default is newest-first</li>
     * </ul>
     *
     * @param type       optional listing type filter
     * @param city       optional city substring filter
     * @param maxPrice   optional max price filter
     * @param negotiable optional negotiability filter
     * @param sort       optional sort order; {@code "price"} or default {@code "latest"}
     * @return 200 OK with a JSON array of {@link ListingDto}
     */
    @GetMapping // handles GET /api/v1/listings
    public ResponseEntity<List<ListingDto>> browse(
            // @RequestParam binds a query-string parameter to a method argument.
            // required = false means the request is valid even if this param is absent.
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String city,
            @RequestParam(required = false) BigDecimal maxPrice,
            @RequestParam(required = false) Boolean negotiable,
            @RequestParam(required = false, defaultValue = "latest") String sort) {
        // Convert the string type to the enum, or null if no type was provided.
        // ListingType.valueOf() would throw IllegalArgumentException for an unknown type string.
        ListingType listingType = type != null ? ListingType.valueOf(type) : null;
        return ResponseEntity.ok(listingService.getAll(listingType, city, maxPrice, negotiable, sort));
    }

    /**
     * Returns a personalised list of active listings ranked by the recommendation algorithm.
     *
     * <p><b>HTTP:</b> {@code GET /api/v1/listings/recommended}
     * <br><b>Auth:</b> Optional — authenticated users receive personalised results;
     * unauthenticated users receive the generic latest-sorted list.
     *
     * @return 200 OK with a JSON array of {@link ListingDto} in recommendation order
     */
    @GetMapping("/recommended") // handles GET /api/v1/listings/recommended
    public ResponseEntity<List<ListingDto>> recommended() {
        return ResponseEntity.ok(listingService.getRecommended());
    }

    /**
     * Full-text keyword search across listing title, description, and city.
     *
     * <p><b>HTTP:</b> {@code GET /api/v1/listings/search?q=keyword}
     * <br><b>Auth:</b> None required.
     *
     * @param q the search keyword(s)
     * @return 200 OK with a JSON array of matching {@link ListingDto}
     */
    @GetMapping("/search") // handles GET /api/v1/listings/search
    public ResponseEntity<List<ListingDto>> search(@RequestParam String q) {
        // @RequestParam String q — the 'q' parameter is required here (no required = false),
        // so Spring will return a 400 Bad Request automatically if it is missing.
        return ResponseEntity.ok(listingService.search(q));
    }

    /**
     * Fetches a single listing by its UUID.
     *
     * <p><b>HTTP:</b> {@code GET /api/v1/listings/{id}}
     * <br><b>Auth:</b> None required.
     *
     * @param id the UUID of the listing, extracted from the URL path
     * @return 200 OK with the {@link ListingDto}, or 500 if not found
     */
    @GetMapping("/{id}") // handles GET /api/v1/listings/some-uuid
    public ResponseEntity<ListingDto> getById(
            // @PathVariable binds the {id} segment of the URL to this parameter.
            // Spring automatically converts the string to UUID.
            @PathVariable UUID id) {
        return ResponseEntity.ok(listingService.getById(id));
    }

    /**
     * Creates a new listing for the authenticated seller.
     *
     * <p><b>HTTP:</b> {@code POST /api/v1/listings} (multipart/form-data)
     * <br><b>Auth:</b> Required — must have the {@code SELLER} role.
     * <br><b>Request body (form fields):</b>
     * <ul>
     *   <li>{@code title} (required) — listing headline</li>
     *   <li>{@code listingType} (required) — e.g. {@code "SKILL"}</li>
     *   <li>{@code price} (required) — numeric price</li>
     *   <li>{@code description} (optional)</li>
     *   <li>{@code currency} (optional, default GBP)</li>
     *   <li>{@code negotiable} (optional, default false)</li>
     *   <li>{@code city} (optional)</li>
     *   <li>{@code meta} (optional JSON string)</li>
     *   <li>{@code images} (optional) — one or more image files</li>
     * </ul>
     *
     * @return 200 OK with the newly created {@link ListingDto}
     */
    @PostMapping // handles POST /api/v1/listings
    // Any authenticated user can create a listing — HustleUp allows everyone to hustle.
    // The seller's identity is read from the JWT token in the service layer, so no spoofing is possible.
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ListingDto> create(
            @RequestParam String title,
            @RequestParam(required = false) String description,
            @RequestParam String listingType,
            @RequestParam BigDecimal price,
            @RequestParam(required = false) String currency,
            @RequestParam(defaultValue = "false") boolean negotiable,
            @RequestParam(required = false) String city,
            @RequestParam(required = false) String meta,
            // MultipartFile is Spring's abstraction for an uploaded file from a multipart form.
            // List<MultipartFile> allows the client to send multiple images in a single request.
            @RequestParam(required = false) List<MultipartFile> images) {
        return ResponseEntity.ok(listingService.create(title, description, listingType,
                price, currency, negotiable, city, meta, images));
    }

    /**
     * Partially updates a listing owned by the authenticated seller.
     *
     * <p><b>HTTP:</b> {@code PATCH /api/v1/listings/{id}}
     * <br><b>Auth:</b> Required — must have the {@code SELLER} role and own the listing.
     * <br>Only the fields provided are updated; omitted fields remain unchanged.
     * The exception is {@code negotiable} which always defaults to {@code false}.
     *
     * @param id          the UUID of the listing to update
     * @param title       new title (optional)
     * @param description new description (optional)
     * @param price       new price (optional)
     * @param negotiable  new negotiability (defaults to false if omitted)
     * @param city        new city (optional)
     * @param meta        new meta JSON (optional)
     * @param status      new status string e.g. {@code "PAUSED"} (optional)
     * @return 200 OK with the updated {@link ListingDto}
     */
    @PatchMapping("/{id}") // handles PATCH /api/v1/listings/some-uuid
    @PreAuthorize("hasRole('SELLER')")
    public ResponseEntity<ListingDto> update(
            @PathVariable UUID id,
            @RequestParam(required = false) String title,
            @RequestParam(required = false) String description,
            @RequestParam(required = false) BigDecimal price,
            @RequestParam(defaultValue = "false") boolean negotiable,
            @RequestParam(required = false) String city,
            @RequestParam(required = false) String meta,
            @RequestParam(required = false) String status) {
        return ResponseEntity.ok(listingService.update(id, title, description, price, negotiable, city, meta, status));
    }

    /**
     * Returns all active (non-deleted) listings belonging to a specific user/seller.
     *
     * <p>This is used to power the public shop page: any visitor can see what a user is selling.
     *
     * <p><b>HTTP:</b> {@code GET /api/v1/listings/user/{userId}}
     * <br><b>Auth:</b> None required — publicly visible shop pages.
     *
     * @param userId the UUID of the user whose listings to fetch
     * @return 200 OK with a JSON array of that user's non-deleted {@link ListingDto}
     */
    @GetMapping("/user/{userId}") // handles GET /api/v1/listings/user/some-uuid
    public ResponseEntity<List<ListingDto>> getByUser(@PathVariable UUID userId) {
        return ResponseEntity.ok(listingService.getByUser(userId));
    }

    /**
     * Returns all listings belonging to the currently authenticated seller (including
     * non-active ones like PAUSED and SOLD_OUT).
     *
     * <p><b>HTTP:</b> {@code GET /api/v1/listings/my}
     * <br><b>Auth:</b> Required — must have the {@code SELLER} role.
     *
     * @return 200 OK with a JSON array of the seller's {@link ListingDto}
     */
    @GetMapping("/my") // handles GET /api/v1/listings/my
    @PreAuthorize("hasRole('SELLER')")
    public ResponseEntity<List<ListingDto>> myListings() {
        return ResponseEntity.ok(listingService.getMyListings());
    }

    /**
     * Permanently deletes a listing owned by the authenticated seller.
     *
     * <p><b>HTTP:</b> {@code DELETE /api/v1/listings/{id}}
     * <br><b>Auth:</b> Required — must have the {@code SELLER} role and own the listing.
     *
     * @param id the UUID of the listing to delete
     * @return 200 OK with an empty body on success
     */
    @DeleteMapping("/{id}") // handles DELETE /api/v1/listings/some-uuid
    @PreAuthorize("hasRole('SELLER')")
    public ResponseEntity<?> delete(@PathVariable UUID id) {
        listingService.delete(id);
        // ResponseEntity.ok().build() returns HTTP 200 with no response body.
        // Alternatively, ResponseEntity.noContent().build() would return HTTP 204.
        return ResponseEntity.ok().build();
    }
}
