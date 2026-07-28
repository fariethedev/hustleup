package com.hustleup.marketplace.availability.repository;

import com.hustleup.marketplace.availability.model.Availability;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface AvailabilityRepository extends JpaRepository<Availability, UUID> {

    // All slots for a listing (booked and open) — the buyer-facing picker greys out booked ones.
    List<Availability> findByListingIdOrderByStartTimeAsc(UUID listingId);

    // All slots across every listing a seller manages, for the dashboard's Availability tab.
    List<Availability> findBySellerIdOrderByStartTimeAsc(UUID sellerId);
}
