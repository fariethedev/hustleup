package com.hustleup.marketplace.viewing;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RentalViewingRepository extends JpaRepository<RentalViewing, UUID> {
    List<RentalViewing> findByListingIdAndStatusAndScheduledAtAfterOrderByScheduledAtAsc(
            UUID listingId, RentalViewing.Status status, LocalDateTime after);

    Optional<RentalViewing> findFirstByListingIdAndViewerIdAndStatus(UUID listingId, UUID viewerId, RentalViewing.Status status);

    long countByListingIdAndStatusAndScheduledAt(UUID listingId, RentalViewing.Status status, LocalDateTime scheduledAt);
}
