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

@RestController
@RequestMapping("/api/v1/listings")
public class ListingController {

    private final ListingService listingService;

    public ListingController(ListingService listingService) {
        this.listingService = listingService;
    }

    @GetMapping
    public ResponseEntity<List<ListingDto>> browse(
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String city,
            @RequestParam(required = false) BigDecimal maxPrice,
            @RequestParam(required = false) Boolean negotiable) {
        ListingType listingType = type != null ? ListingType.valueOf(type) : null;
        return ResponseEntity.ok(listingService.getAll(listingType, city, maxPrice, negotiable));
    }

    @GetMapping("/search")
    public ResponseEntity<List<ListingDto>> search(@RequestParam String q) {
        return ResponseEntity.ok(listingService.search(q));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ListingDto> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(listingService.getById(id));
    }

    @PostMapping
    @PreAuthorize("hasRole('SELLER')")
    public ResponseEntity<ListingDto> create(
            @RequestParam String title,
            @RequestParam(required = false) String description,
            @RequestParam String listingType,
            @RequestParam BigDecimal price,
            @RequestParam(required = false) String currency,
            @RequestParam(defaultValue = "false") boolean negotiable,
            @RequestParam(required = false) String city,
            @RequestParam(required = false) String meta,
            @RequestParam(required = false) List<MultipartFile> images) {
        return ResponseEntity.ok(listingService.create(title, description, listingType,
                price, currency, negotiable, city, meta, images));
    }

    @PatchMapping("/{id}")
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
}
