/**
 * REST controller exposing seller-managed booking availability for service-type listings
 * (e.g. a hair salon slot calendar). Sellers create open time slots; buyers pick one when
 * booking (see {@code BookingController.create}, which accepts an optional
 * {@code availabilitySlotId}).
 *
 * <p>Base path: {@code /api/v1/availability}
 */
package com.hustleup.marketplace.availability.controller;

import com.hustleup.marketplace.availability.dto.AvailabilityDto;
import com.hustleup.marketplace.availability.model.Availability;
import com.hustleup.marketplace.availability.repository.AvailabilityRepository;
import com.hustleup.marketplace.listing.model.Listing;
import com.hustleup.marketplace.listing.repository.ListingRepository;
import com.hustleup.common.model.User;
import com.hustleup.common.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/availability")
public class AvailabilityController {

    private final AvailabilityRepository availabilityRepository;
    private final ListingRepository listingRepository;
    private final UserRepository userRepository;

    public AvailabilityController(AvailabilityRepository availabilityRepository,
                                   ListingRepository listingRepository,
                                   UserRepository userRepository) {
        this.availabilityRepository = availabilityRepository;
        this.listingRepository = listingRepository;
        this.userRepository = userRepository;
    }

    private User currentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email).orElseThrow(() -> new RuntimeException("User not found"));
    }

    /**
     * Creates a new open slot for one of the seller's own listings.
     *
     * <p><b>POST /api/v1/availability</b> — body {@code { listingId, startTime, endTime }}
     * (both times ISO-8601 local datetime). Seller must own the listing.
     */
    @PostMapping
    @PreAuthorize("hasRole('SELLER')")
    public ResponseEntity<AvailabilityDto> create(@RequestBody Map<String, String> body) {
        User seller = currentUser();
        UUID listingId = UUID.fromString(body.get("listingId"));
        Listing listing = listingRepository.findById(listingId)
                .orElseThrow(() -> new RuntimeException("Listing not found"));
        if (!listing.getSellerId().equals(seller.getId())) {
            throw new RuntimeException("You don't own this listing");
        }

        Availability slot = Availability.builder()
                .listingId(listingId)
                .sellerId(seller.getId())
                .startTime(LocalDateTime.parse(body.get("startTime")))
                .endTime(LocalDateTime.parse(body.get("endTime")))
                .build();

        return ResponseEntity.ok(AvailabilityDto.fromEntity(availabilityRepository.save(slot)));
    }

    /**
     * Public listing of every slot (open and booked) for a given listing, so a buyer's
     * slot picker can show taken slots as unavailable rather than just omitting them.
     *
     * <p><b>GET /api/v1/availability/listing/{listingId}</b>
     */
    @GetMapping("/listing/{listingId}")
    public ResponseEntity<List<AvailabilityDto>> byListing(@PathVariable UUID listingId) {
        return ResponseEntity.ok(availabilityRepository.findByListingIdOrderByStartTimeAsc(listingId)
                .stream().map(AvailabilityDto::fromEntity).collect(Collectors.toList()));
    }

    /**
     * All slots the authenticated seller has created across every listing they manage —
     * powers the Dashboard's Availability tab.
     *
     * <p><b>GET /api/v1/availability/my</b>
     */
    @GetMapping("/my")
    @PreAuthorize("hasRole('SELLER')")
    public ResponseEntity<List<AvailabilityDto>> my() {
        User seller = currentUser();
        List<Availability> slots = availabilityRepository.findBySellerIdOrderByStartTimeAsc(seller.getId());

        // Resolve listing titles in one batch query to avoid N+1 lookups.
        List<UUID> listingIds = slots.stream().map(Availability::getListingId).distinct().toList();
        Map<UUID, String> titles = listingRepository.findAllById(listingIds).stream()
                .collect(Collectors.toMap(Listing::getId, Listing::getTitle));

        return ResponseEntity.ok(slots.stream().map(s -> {
            AvailabilityDto dto = AvailabilityDto.fromEntity(s);
            dto.setListingTitle(titles.get(s.getListingId()));
            return dto;
        }).collect(Collectors.toList()));
    }

    /**
     * Deletes an unbooked slot. Booked slots must be freed by cancelling the booking that
     * references them first (see {@code BookingService.cancel}), so a booked customer's
     * appointment can never silently disappear.
     *
     * <p><b>DELETE /api/v1/availability/{id}</b>
     */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('SELLER')")
    public ResponseEntity<?> delete(@PathVariable UUID id) {
        User seller = currentUser();
        Availability slot = availabilityRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Slot not found"));
        if (!slot.getSellerId().equals(seller.getId())) {
            throw new RuntimeException("You don't own this slot");
        }
        if (slot.isBooked()) {
            throw new RuntimeException("Cannot delete a booked slot — cancel the booking first");
        }
        availabilityRepository.deleteById(id);
        return ResponseEntity.ok().build();
    }
}
