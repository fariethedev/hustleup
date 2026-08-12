/**
 * REST controller that exposes the listing API for the HustleUp marketplace.
 */
package com.hustleup.marketplace.listing.controller;

import com.hustleup.marketplace.listing.dto.ListingDto;
import com.hustleup.marketplace.listing.model.Listing;
import com.hustleup.marketplace.listing.model.ListingType;
import com.hustleup.marketplace.listing.model.SavedListing;
import com.hustleup.marketplace.listing.repository.ListingRepository;
import com.hustleup.marketplace.listing.repository.SavedListingRepository;
import com.hustleup.marketplace.listing.service.ListingService;
import com.hustleup.common.model.User;
import com.hustleup.common.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/listings")
public class ListingController {

    private final ListingService listingService;
    private final ListingRepository listingRepository;
    private final SavedListingRepository savedListingRepository;
    private final UserRepository userRepository;

    public ListingController(ListingService listingService, ListingRepository listingRepository,
                              SavedListingRepository savedListingRepository, UserRepository userRepository) {
        this.listingService = listingService;
        this.listingRepository = listingRepository;
        this.savedListingRepository = savedListingRepository;
        this.userRepository = userRepository;
    }

    @GetMapping
    public ResponseEntity<List<ListingDto>> browse(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String city,
            @RequestParam(required = false) BigDecimal maxPrice,
            @RequestParam(required = false) Boolean negotiable,
            @RequestParam(required = false, defaultValue = "latest") String sort) {
        ListingType listingType = type != null ? ListingType.valueOf(type) : null;
        return ResponseEntity.ok(withSavedFlag(listingService.getAll(q, listingType, city, maxPrice, negotiable, sort)));
    }

    @GetMapping("/recommended")
    public ResponseEntity<List<ListingDto>> recommended() {
        return ResponseEntity.ok(withSavedFlag(listingService.getRecommended()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ListingDto> getById(@PathVariable UUID id) {
        List<ListingDto> enriched = withSavedFlag(new java.util.ArrayList<>(List.of(listingService.getById(id))));
        return ResponseEntity.ok(enriched.get(0));
    }

    @PostMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ListingDto> create(
            @RequestParam String title,
            @RequestParam(required = false) String description,
            @RequestParam String listingType,
            @RequestParam BigDecimal price,
            @RequestParam(required = false) String currency,
            @RequestParam(defaultValue = "false") boolean negotiable,
            @RequestParam(required = false) String city,
            @RequestParam(defaultValue = "false") boolean agentFee,
            @RequestParam(defaultValue = "false") boolean swapEnabled,
            // EVENT listings only. ISO-8601 local datetime (e.g. 2026-09-14T19:30). Sent blank
            // by the create form for every other category, so it is parsed leniently in the
            // service rather than bound as a LocalDateTime here — a stray empty string from a
            // form field should not turn into a 400.
            @RequestParam(required = false) String eventStartsAt,
            @RequestParam(required = false) String eventVenue,
            @RequestParam(required = false) String meta,
            @RequestParam(required = false) List<MultipartFile> images) {
        return ResponseEntity.ok(listingService.create(title, description, listingType,
                price, currency, negotiable, city, agentFee, swapEnabled,
                eventStartsAt, eventVenue, meta, images));
    }

    // JSON body (not @RequestParam/form fields) — matches how the dashboard's price/negotiable
    // edit and every other partial-update endpoint in this app (bookings, availability, etc.)
    // actually send data. Only include the keys you want to change; "negotiable" always applies
    // since it's a primitive on the entity (mirrors ListingService.update's existing contract).
    @PatchMapping("/{id}")
    @PreAuthorize("hasRole('SELLER')")
    public ResponseEntity<ListingDto> update(@PathVariable UUID id, @RequestBody Map<String, Object> body) {
        String title = (String) body.get("title");
        String description = (String) body.get("description");
        BigDecimal price = body.get("price") != null ? new BigDecimal(body.get("price").toString()) : null;
        boolean negotiable = Boolean.TRUE.equals(body.get("negotiable"));
        String city = (String) body.get("city");
        String meta = (String) body.get("meta");
        String status = (String) body.get("status");
        // Tri-state on purpose: absent means "leave as-is", so toggling swap mode doesn't
        // require the caller to resend every other field.
        Boolean swapEnabled = body.get("swapEnabled") != null
                ? Boolean.valueOf(Boolean.TRUE.equals(body.get("swapEnabled")))
                : null;
        return ResponseEntity.ok(listingService.update(id, title, description, price, negotiable, city, meta, status, swapEnabled));
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<List<ListingDto>> getByUser(@PathVariable UUID userId) {
        return ResponseEntity.ok(listingService.getByUser(userId));
    }

    @GetMapping("/my")
    @PreAuthorize("hasRole('SELLER')")
    public ResponseEntity<List<ListingDto>> myListings() {
        return ResponseEntity.ok(listingService.getMyListings());
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('SELLER')")
    public ResponseEntity<?> delete(@PathVariable UUID id) {
        listingService.delete(id);
        return ResponseEntity.ok().build();
    }

    /**
     * Saves/bookmarks a listing for the authenticated user. Idempotent — saving an
     * already-saved listing is a no-op, matching the post-save endpoint's contract.
     */
    @PostMapping("/{id}/save")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> saveListing(@PathVariable UUID id) {
        User currentUser = requireCurrentUser();
        if (!savedListingRepository.existsByUserIdAndListingId(currentUser.getId(), id)) {
            Listing listing = listingRepository.findById(id)
                    .orElseThrow(() -> new RuntimeException("Listing not found"));
            SavedListing saved = new SavedListing();
            saved.setUserId(currentUser.getId());
            saved.setListing(listing);
            savedListingRepository.save(saved);
        }
        return ResponseEntity.ok(Map.of("saved", true));
    }

    /** Removes the current user's save/bookmark from a listing. Idempotent. */
    @DeleteMapping("/{id}/save")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> unsaveListing(@PathVariable UUID id) {
        User currentUser = requireCurrentUser();
        savedListingRepository.findByUserIdAndListingId(currentUser.getId(), id)
                .ifPresent(savedListingRepository::delete);
        return ResponseEntity.ok(Map.of("saved", false));
    }

    /** Every listing the current user has saved, most recently saved first. */
    @GetMapping("/saved/me")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<ListingDto>> mySavedListings() {
        User currentUser = requireCurrentUser();
        List<Listing> listings = savedListingRepository.findByUserId(currentUser.getId()).stream()
                .sorted(Comparator.comparing(SavedListing::getCreatedAt).reversed())
                .map(SavedListing::getListing)
                .toList();
        List<ListingDto> dtos = listings.stream().map(ListingDto::fromEntity).collect(Collectors.toList());
        dtos.forEach(dto -> dto.setSavedByCurrentUser(true));
        return ResponseEntity.ok(dtos);
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /**
     * Sets {@code savedByCurrentUser} on every DTO in the list via a single batch query
     * (avoids one query per card when browsing a grid of listings). No-op (leaves the
     * default {@code false}) for anonymous viewers.
     */
    private List<ListingDto> withSavedFlag(List<ListingDto> dtos) {
        Optional<User> currentUser = getCurrentUser();
        if (currentUser.isEmpty() || dtos.isEmpty()) return dtos;

        List<UUID> ids = dtos.stream().map(ListingDto::getId).toList();
        Map<UUID, Boolean> savedMap = new HashMap<>();
        savedListingRepository.findByUserIdAndListingIdIn(currentUser.get().getId(), ids)
                .forEach(sl -> savedMap.put(sl.getListing().getId(), true));

        dtos.forEach(dto -> dto.setSavedByCurrentUser(savedMap.getOrDefault(dto.getId(), false)));
        return dtos;
    }

    private User requireCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()
                || authentication instanceof AnonymousAuthenticationToken) {
            throw new AccessDeniedException("Not authenticated");
        }
        return userRepository.findByEmail(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found: " + authentication.getName()));
    }

    private Optional<User> getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()
                || authentication instanceof AnonymousAuthenticationToken) {
            return Optional.empty();
        }
        return userRepository.findByEmail(authentication.getName());
    }
}
