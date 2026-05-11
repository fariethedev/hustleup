package com.hustleup.listing.repository;

import com.hustleup.listing.model.SavedListing;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;
import java.util.List;

public interface SavedListingRepository extends JpaRepository<SavedListing, UUID> {
    Page<SavedListing> findByUserIdOrderByCreatedAtDesc(UUID userId, Pageable pageable);
    List<SavedListing> findByUserId(UUID userId);
    Optional<SavedListing> findByUserIdAndListingId(UUID userId, UUID listingId);
    boolean existsByUserIdAndListingId(UUID userId, UUID listingId);
}
