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
package com.hustleup.marketplace.booking.repository;

import com.hustleup.marketplace.booking.model.Booking;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

// JpaRepository<Booking, UUID>: manages Booking entities, primary key type is UUID.
public interface BookingRepository extends JpaRepository<Booking, UUID> {

    /**
     * Per-seller completed-sale totals: {@code [sellerId, salesCount, grossEarnings]}.
     *
     * <p>Powers both leaderboards and the hustle score in a single pass, so ranking every
     * user costs one query rather than one per user.
     *
     * <p>Only {@code COMPLETED} counts. A booking that is merely {@code BOOKED} has been
     * agreed but not delivered, and rewarding it would let someone farm the leaderboard by
     * agreeing to sales they never fulfil. {@code COALESCE} keeps the sum at zero rather
     * than null when agreed prices are missing.
     */
    @Query("""
            SELECT b.sellerId, COUNT(b), COALESCE(SUM(b.agreedPrice), 0)
            FROM Booking b
            WHERE b.status = com.hustleup.marketplace.booking.model.BookingStatus.COMPLETED
            GROUP BY b.sellerId
            """)
    List<Object[]> sellerSalesTotals();

    /**
     * Same shape as {@link #sellerSalesTotals()} but limited to bookings completed on or
     * after {@code since} — used for the weekly/monthly leaderboard windows.
     */
    @Query("""
            SELECT b.sellerId, COUNT(b), COALESCE(SUM(b.agreedPrice), 0)
            FROM Booking b
            WHERE b.status = com.hustleup.marketplace.booking.model.BookingStatus.COMPLETED
              AND b.updatedAt >= :since
            GROUP BY b.sellerId
            """)
    List<Object[]> sellerSalesTotalsSince(@Param("since") LocalDateTime since);

    /** Most recent completed sale per seller — drives the hustle score's inactivity decay. */
    @Query("""
            SELECT b.sellerId, MAX(b.updatedAt)
            FROM Booking b
            WHERE b.status = com.hustleup.marketplace.booking.model.BookingStatus.COMPLETED
            GROUP BY b.sellerId
            """)
    List<Object[]> lastCompletedSaleBySeller();

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

    /**
     * Looks up the booking a Stripe PaymentIntent belongs to — used by the payout webhook
     * to mark a booking PAID once the buyer's Checkout Session completes.
     *
     * @param paymentIntentId the Stripe PaymentIntent id stored when the checkout session was created
     * @return the matching booking, if any
     */
    Optional<Booking> findByPaymentIntentId(String paymentIntentId);

    /**
     * Every booking paid for by one Stripe PaymentIntent.
     *
     * <p>A cart checkout creates one booking per line item but a single charge, so one
     * PaymentIntent now maps to many bookings. {@link #findByPaymentIntentId} returns at
     * most one and would silently mark only the first item paid, leaving the rest of the
     * order stuck UNPAID — this is what the webhook uses instead.
     */
    List<Booking> findAllByPaymentIntentId(String paymentIntentId);
}
