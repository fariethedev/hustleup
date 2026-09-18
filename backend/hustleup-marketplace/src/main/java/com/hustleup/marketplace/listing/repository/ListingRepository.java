/**
 * Spring Data JPA repository for {@link Listing} entities.
 */
package com.hustleup.marketplace.listing.repository;

import com.hustleup.marketplace.listing.model.Listing;
import com.hustleup.marketplace.listing.model.ListingStatus;
import com.hustleup.marketplace.listing.model.ListingType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public interface ListingRepository extends JpaRepository<Listing, UUID> {

    List<Listing> findBySellerIdAndStatusNot(UUID sellerId, ListingStatus status);

    List<Listing> findBySellerId(UUID sellerId);

    /**
     * Everything posted inside a window, for the nightly new-listing digest.
     *
     * <p>Filtered on status as well as time: a listing put up and taken down again the same
     * day should not arrive in an email at midnight pointing at something nobody can open.
     * Ordered oldest-first so the digest reads in the order the day actually happened.
     */
    List<Listing> findByCreatedAtBetweenAndStatusOrderByCreatedAtAsc(
            java.time.LocalDateTime from, java.time.LocalDateTime to, ListingStatus status);

    int countBySellerIdAndStatus(UUID sellerId, ListingStatus status);

    @Query("SELECT l FROM Listing l WHERE l.status = 'ACTIVE' " +
           "AND (:q IS NULL OR LOWER(l.title) LIKE LOWER(CONCAT('%', :q, '%')) OR LOWER(l.description) LIKE LOWER(CONCAT('%', :q, '%')) OR LOWER(l.locationCity) LIKE LOWER(CONCAT('%', :q, '%'))) " +
           "AND (:type IS NULL OR l.listingType = :type) " +
           "AND (:city IS NULL OR LOWER(l.locationCity) LIKE LOWER(CONCAT('%', :city, '%'))) " +
           "AND (:maxPrice IS NULL OR l.price <= :maxPrice) " +
           "AND (:negotiable IS NULL OR l.negotiable = :negotiable) " +
           "ORDER BY l.createdAt DESC")
    List<Listing> findWithFilters(@Param("q") String q,
                                  @Param("type") ListingType type,
                                  @Param("city") String city,
                                  @Param("maxPrice") BigDecimal maxPrice,
                                  @Param("negotiable") Boolean negotiable);
}
