package com.hustleup.booking.repository;

import com.hustleup.booking.model.Booking;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface BookingRepository extends JpaRepository<Booking, UUID> {
    List<Booking> findByBuyerIdOrderByCreatedAtDesc(UUID buyerId);
    List<Booking> findBySellerIdOrderByCreatedAtDesc(UUID sellerId);
    List<Booking> findByListingId(UUID listingId);
}
