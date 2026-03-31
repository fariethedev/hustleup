package com.hustleup.listing.repository;

import com.hustleup.listing.model.Listing;
import com.hustleup.listing.model.ListingStatus;
import com.hustleup.listing.model.ListingType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public interface ListingRepository extends JpaRepository<Listing, UUID> {

    List<Listing> findBySellerIdAndStatusNot(UUID sellerId, ListingStatus status);

    List<Listing> findBySellerId(UUID sellerId);

    int countBySellerIdAndStatus(UUID sellerId, ListingStatus status);

    @Query("SELECT l FROM Listing l WHERE l.status = 'ACTIVE' " +
           "AND (:type IS NULL OR l.listingType = :type) " +
           "AND (:city IS NULL OR LOWER(l.locationCity) LIKE LOWER(CONCAT('%', :city, '%'))) " +
           "AND (:maxPrice IS NULL OR l.price <= :maxPrice) " +
           "AND (:negotiable IS NULL OR l.negotiable = :negotiable) " +
           "ORDER BY l.createdAt DESC")
    List<Listing> findWithFilters(@Param("type") ListingType type,
                                  @Param("city") String city,
                                  @Param("maxPrice") BigDecimal maxPrice,
                                  @Param("negotiable") Boolean negotiable);

    @Query("SELECT l FROM Listing l WHERE l.status = 'ACTIVE' " +
           "AND (LOWER(l.title) LIKE LOWER(CONCAT('%', :q, '%')) " +
           "OR LOWER(l.description) LIKE LOWER(CONCAT('%', :q, '%')) " +
           "OR LOWER(l.locationCity) LIKE LOWER(CONCAT('%', :q, '%'))) " +
           "ORDER BY l.createdAt DESC")
    List<Listing> search(@Param("q") String query);
}
