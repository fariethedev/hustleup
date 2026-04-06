/**
 * Spring Data JPA repository for {@link Booking} entities.
 *
 * <p>Extending {@link JpaRepository}{@code <Booking, UUID>} gives us all standard CRUD
 * operations for free (save, findById, findAll, deleteById, count, etc.). Spring generates
 * a concrete implementation using Hibernate at startup — we never write SQL or Hibernate
 * queries for these common operations.
 *
 * <p>The three custom methods declared here all use Spring Data's <em>derived query</em>
 * feature: Spring parses the method name and generates the JPQL (and ultimately SQL) query
 * automatically. The {@code OrderByCreatedAtDesc} suffix means results are returned newest
 * first without any extra annotation.
 *
 * <p>Why separate queries for buyer and seller?  A user can play both roles simultaneously
 * (e.g. Sarah is a seller but also buys from others). The service layer queries both
 * perspectives and merges the results.
 */
package com.hustleup.booking.repository;

import com.hustleup.booking.model.Booking;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

// JpaRepository<Booking, UUID>: manages Booking entities, primary key type is UUID.
public interface BookingRepository extends JpaRepository<Booking, UUID> {

    /**
     * Returns all bookings where the given user is the <em>buyer</em>, newest first.
     *
     * <p>Spring derives the query from the method name:
     * {@code findBy} + {@code BuyerId} (field match) + {@code OrderByCreatedAtDesc} (sort).
     * Equivalent JPQL: {@code SELECT b FROM Booking b WHERE b.buyerId = :buyerId ORDER BY b.createdAt DESC}
     *
     * @param buyerId the UUID of the buyer
     * @return list of bookings initiated by this buyer, sorted by creation date descending
     */
    List<Booking> findByBuyerIdOrderByCreatedAtDesc(UUID buyerId);

    /**
     * Returns all bookings where the given user is the <em>seller</em>, newest first.
     *
     * <p>Used for the seller's inbox: they see all incoming booking requests across
     * all of their listings.
     *
     * @param sellerId the UUID of the seller
     * @return list of bookings for this seller's listings, sorted by creation date descending
     */
    List<Booking> findBySellerIdOrderByCreatedAtDesc(UUID sellerId);

    /**
     * Returns all bookings that reference a specific listing.
     *
     * <p>Used to check how many times a listing has been booked, or to display
     * booking history on a listing's detail page.
     *
     * @param listingId the UUID of the listing
     * @return all bookings for the specified listing, in any order
     */
    List<Booking> findByListingId(UUID listingId);
}
