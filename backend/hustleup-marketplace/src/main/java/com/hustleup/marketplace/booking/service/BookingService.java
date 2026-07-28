/**
 * Business logic layer for booking management on the HustleUp marketplace.
 *
 * <p>This service orchestrates the full booking lifecycle — from a buyer's first inquiry
 * through price negotiation, confirmation, and eventual completion or cancellation. It is
 * the authoritative source for all state transitions in the booking state machine.
 *
 * <h3>Responsibilities</h3>
 * <ul>
 *   <li>Creating new bookings (with ownership guard: sellers cannot book their own listings)</li>
 *   <li>Processing counter-offers from sellers</li>
 *   <li>Accepting a booking (buyer accepts seller's counter, or seller accepts buyer's offer)</li>
 *   <li>Cancelling a booking with a reason (either party)</li>
 *   <li>Marking a booking as completed (seller only)</li>
 *   <li>Fetching all bookings for the authenticated user (both as buyer and seller)</li>
 * </ul>
 *
 * <h3>Concurrency safety</h3>
 * <p>The {@link Booking} entity uses JPA optimistic locking ({@code @Version}). If two users
 * attempt to modify the same booking simultaneously, the second write will throw
 * {@link org.springframework.orm.ObjectOptimisticLockingFailureException}. This is caught
 * in {@link #accept} and rethrown as a user-friendly error message.
 *
 * <p>{@code @Service} registers this class as a Spring-managed singleton bean.
 */
package com.hustleup.marketplace.booking.service;

import com.hustleup.marketplace.availability.model.Availability;
import com.hustleup.marketplace.availability.repository.AvailabilityRepository;
import com.hustleup.marketplace.booking.dto.BookingDto;
import com.hustleup.marketplace.booking.model.Booking;
import com.hustleup.marketplace.booking.model.BookingStatus;
import com.hustleup.marketplace.booking.repository.BookingRepository;
import com.hustleup.marketplace.listing.model.Listing;
import com.hustleup.marketplace.listing.model.ListingType;
import com.hustleup.marketplace.listing.repository.ListingRepository;
import com.hustleup.marketplace.payments.model.SellerPayoutAccount;
import com.hustleup.marketplace.payments.repository.SellerPayoutAccountRepository;
import com.hustleup.marketplace.payments.service.StripeConnectService;
import com.hustleup.common.model.User;
import com.hustleup.common.repository.UserRepository;
import com.stripe.exception.StripeException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

// @Service marks this as a Spring component containing business logic.
// Spring creates a single instance (singleton scope) and injects it wherever needed.
@Service
public class BookingService {

    // --- Dependencies (injected via constructor) ---

    private final BookingRepository bookingRepository;    // CRUD for bookings table
    private final ListingRepository listingRepository;    // look up listing details at booking time
    private final UserRepository userRepository;          // look up buyer/seller display names
    private final AvailabilityRepository availabilityRepository; // seller-defined slots for service bookings
    private final SellerPayoutAccountRepository payoutAccountRepository; // seller's Stripe Connect account
    private final StripeConnectService stripeConnectService; // payment collection + seller payouts

    /**
     * Constructor injection: Spring automatically resolves and injects these beans.
     * Constructor injection is preferred over @Autowired fields because:
     * - Dependencies are explicit and documented in the signature
     * - The class can be instantiated in unit tests without a Spring context
     * - Fields can be declared {@code final}, guaranteeing immutability
     */
    public BookingService(BookingRepository bookingRepository, ListingRepository listingRepository,
                          UserRepository userRepository, AvailabilityRepository availabilityRepository,
                          SellerPayoutAccountRepository payoutAccountRepository,
                          StripeConnectService stripeConnectService) {
        this.bookingRepository = bookingRepository;
        this.listingRepository = listingRepository;
        this.userRepository = userRepository;
        this.availabilityRepository = availabilityRepository;
        this.payoutAccountRepository = payoutAccountRepository;
        this.stripeConnectService = stripeConnectService;
    }

    /**
     * Creates a new booking request from the authenticated buyer for a specific listing.
     *
     * <p><b>Validation rules:</b>
     * <ul>
     *   <li>The listing must exist.</li>
     *   <li>The buyer cannot book their own listing (a seller cannot be their own customer).</li>
     * </ul>
     *
     * <p>If the buyer does not provide a custom {@code offeredPrice}, the listing's current
     * asking price is used as the default offer. The booking starts in {@link BookingStatus#INQUIRED}
     * state, meaning the seller can see it in their inbox.
     *
     * <p>{@code @Transactional} ensures that the {@code listingRepository.findById} read and the
     * {@code bookingRepository.save} write happen inside the same database transaction. If the
     * save fails (e.g. constraint violation), the read is also rolled back.
     *
     * @param listingId          UUID of the listing to book
     * @param offeredPrice       the buyer's custom price offer, or {@code null} to use the listing price
     * @param scheduledAt        requested delivery date/time, or {@code null} if flexible
     * @param availabilitySlotId a specific seller-defined open slot to reserve (service listings), or {@code null}
     * @param quantity           number of units to purchase (EVENT ticket purchases), or {@code null} for 1
     * @return the newly created booking as an enriched DTO
     */
    @Transactional // wraps the entire method in a database transaction
    public BookingDto create(UUID listingId, BigDecimal offeredPrice, LocalDateTime scheduledAt,
                              UUID availabilitySlotId, Integer quantity) {
        User buyer = getCurrentUser(); // resolve authenticated buyer from Spring Security context
        Listing listing = listingRepository.findById(listingId)
                .orElseThrow(() -> new RuntimeException("Listing not found"));

        // Business rule: you cannot book your own listing.
        // This prevents sellers from gaming their own booking/review counts.
        if (listing.getSellerId().equals(buyer.getId())) {
            throw new RuntimeException("Cannot book your own listing");
        }

        int qty = quantity != null && quantity > 0 ? quantity : 1;

        // ── Slot-based booking (e.g. a hair salon appointment) ──────────────────────────
        // Reserving a specific seller-defined time slot doesn't fit the negotiate/counter/
        // accept dance — the buyer is claiming an exact appointment time, so the booking is
        // confirmed immediately rather than sitting in INQUIRED waiting on the seller.
        if (availabilitySlotId != null) {
            Availability slot = availabilityRepository.findById(availabilitySlotId)
                    .orElseThrow(() -> new RuntimeException("Slot not found"));
            if (!slot.getListingId().equals(listingId)) {
                throw new RuntimeException("Slot does not belong to this listing");
            }
            if (slot.isBooked()) {
                throw new RuntimeException("This slot has already been booked");
            }
            slot.setBooked(true);
            availabilityRepository.save(slot);

            Booking booking = Booking.builder()
                    .buyerId(buyer.getId())
                    .sellerId(listing.getSellerId())
                    .listingId(listingId)
                    .offeredPrice(listing.getPrice())
                    .agreedPrice(listing.getPrice())
                    .currency(listing.getCurrency())
                    .scheduledAt(slot.getStartTime())
                    .availabilitySlotId(slot.getId())
                    .quantity(1)
                    .status(BookingStatus.BOOKED)
                    .build();
            return enrichDto(bookingRepository.save(booking));
        }

        // ── Event ticket purchase ────────────────────────────────────────────────────────
        // Buying a ticket is an instant purchase, not a negotiation — confirm immediately
        // with the total price for the requested quantity.
        if (listing.getListingType() == ListingType.EVENT) {
            Booking booking = Booking.builder()
                    .buyerId(buyer.getId())
                    .sellerId(listing.getSellerId())
                    .listingId(listingId)
                    .offeredPrice(listing.getPrice())
                    .agreedPrice(listing.getPrice().multiply(BigDecimal.valueOf(qty)))
                    .currency(listing.getCurrency())
                    .scheduledAt(scheduledAt)
                    .quantity(qty)
                    .status(BookingStatus.BOOKED)
                    .build();
            return enrichDto(bookingRepository.save(booking));
        }

        // ── Standard negotiated booking (unchanged) ─────────────────────────────────────
        // Construct the booking entity. @Builder.Default on the entity sets the initial status
        // to POSTED, but we explicitly override it to INQUIRED here to indicate a real request.
        Booking booking = Booking.builder()
                .buyerId(buyer.getId())
                .sellerId(listing.getSellerId())
                .listingId(listingId)
                // Use the buyer's custom offer if provided; otherwise default to the listing price
                .offeredPrice(offeredPrice != null ? offeredPrice : listing.getPrice())
                .currency(listing.getCurrency()) // lock in the currency from the listing
                .scheduledAt(scheduledAt)
                .quantity(qty)
                .status(BookingStatus.INQUIRED) // explicitly start at INQUIRED (formal request sent)
                .build();

        return enrichDto(bookingRepository.save(booking));
    }

    /**
     * Creates a Stripe Checkout Session so the buyer can actually pay for a confirmed
     * booking. Only valid once the booking is {@code BOOKED} (a price has been agreed) and
     * no payment has been started yet. The charge lands on HustleUp's own Stripe balance —
     * the seller is only paid out later, once they mark the booking {@code COMPLETED}
     * (see {@link #complete}).
     *
     * @param bookingId the booking to pay for
     * @return the Stripe-hosted checkout URL to redirect the buyer to
     */
    @Transactional
    public String createPaymentCheckoutSession(UUID bookingId) throws StripeException {
        User buyer = getCurrentUser();
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new RuntimeException("Booking not found"));

        if (!booking.getBuyerId().equals(buyer.getId())) {
            throw new RuntimeException("Only the buyer can pay for this booking");
        }
        if (booking.getStatus() != BookingStatus.BOOKED) {
            throw new RuntimeException("This booking isn't confirmed yet — nothing to pay for");
        }
        // Allow retrying if a previous checkout session was started but never completed
        // (e.g. the buyer closed the tab) — only a genuinely finished payment blocks a new one.
        if (List.of("PAID", "TRANSFERRED", "REFUNDED").contains(booking.getPaymentStatus())) {
            throw new RuntimeException("This booking has already been paid for");
        }

        String listingTitle = listingRepository.findById(booking.getListingId())
                .map(Listing::getTitle).orElse("HustleUp booking");

        StripeConnectService.CheckoutResult result =
                stripeConnectService.createPaymentCheckoutSession(booking, listingTitle);

        booking.setPaymentIntentId(result.paymentIntentId());
        booking.setPaymentStatus("AWAITING_PAYMENT");
        bookingRepository.save(booking);

        return result.checkoutUrl();
    }

    /**
     * Allows the seller to respond to a buyer's inquiry with a counter-offer price.
     *
     * <p>This transitions the booking from {@code INQUIRED} to {@code NEGOTIATING}.
     * The {@code counterPrice} field is set; the buyer must then accept or cancel.
     *
     * <p><b>Auth guard:</b> only the seller of the booking may call this method.
     * Any other user (including the buyer) will receive a RuntimeException.
     *
     * @param bookingId    UUID of the booking to counter-offer on
     * @param counterPrice the seller's proposed price
     * @return the updated booking DTO with counterPrice and NEGOTIATING status
     */
    @Transactional
    public BookingDto counterOffer(UUID bookingId, BigDecimal counterPrice) {
        User seller = getCurrentUser();
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new RuntimeException("Booking not found"));

        // Only the seller who owns this booking may counter-offer
        if (!booking.getSellerId().equals(seller.getId())) {
            throw new RuntimeException("Only the seller can counter-offer");
        }

        // Set the counter price and move to NEGOTIATING state
        booking.setCounterPrice(counterPrice);
        booking.setStatus(BookingStatus.NEGOTIATING);
        booking.setUpdatedAt(LocalDateTime.now()); // record when this change was made
        return enrichDto(bookingRepository.save(booking));
    }

    /**
     * Accepts the current booking offer, confirming the booking.
     *
     * <p>Either party (buyer or seller) can accept:
     * <ul>
     *   <li>Buyer accepts → they accept the seller's counter-offer (or the original price)</li>
     *   <li>Seller accepts → they accept the buyer's offered price without counter-offering</li>
     * </ul>
     *
     * <p>The {@code agreedPrice} is locked in as either the {@code counterPrice} (if one exists)
     * or the original {@code offeredPrice}. The booking moves to {@link BookingStatus#BOOKED}.
     *
     * <p>Optimistic locking: if another thread modified the booking between the read and
     * this save, Hibernate throws {@link ObjectOptimisticLockingFailureException}. We catch it
     * and return a user-friendly error so the client can refresh and retry.
     *
     * @param bookingId UUID of the booking to accept
     * @return the confirmed booking DTO with agreedPrice and BOOKED status
     */
    @Transactional
    public BookingDto accept(UUID bookingId) {
        User user = getCurrentUser();
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new RuntimeException("Booking not found"));

        // Either the buyer or the seller can accept — both are valid actors here
        if (!booking.getBuyerId().equals(user.getId()) && !booking.getSellerId().equals(user.getId())) {
            throw new RuntimeException("Not authorized");
        }

        try {
            // If a counter-price exists (i.e. the seller made a counter-offer), use that;
            // otherwise the original offered price is the agreed price.
            BigDecimal agreed = booking.getCounterPrice() != null ?
                    booking.getCounterPrice() : booking.getOfferedPrice();
            booking.setAgreedPrice(agreed);   // lock in the agreed price
            booking.setStatus(BookingStatus.BOOKED);
            booking.setUpdatedAt(LocalDateTime.now());
            return enrichDto(bookingRepository.save(booking));
        } catch (ObjectOptimisticLockingFailureException e) {
            // The @Version check failed: another request updated this booking between our read
            // and our save. Return a friendly error rather than a cryptic 500.
            throw new RuntimeException("This booking was just updated — please refresh and try again");
        }
    }

    /**
     * Cancels a booking, recording the reason provided by the cancelling party.
     *
     * <p>Either the buyer or the seller may cancel. The booking moves to
     * {@link BookingStatus#CANCELLED} which is a terminal state — it cannot be undone.
     *
     * @param bookingId UUID of the booking to cancel
     * @param reason    human-readable reason for cancellation (may be null)
     * @return the updated booking DTO with CANCELLED status
     */
    @Transactional
    public BookingDto cancel(UUID bookingId, String reason) {
        User user = getCurrentUser();
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new RuntimeException("Booking not found"));

        // Authorisation check: only buyer or seller may cancel
        if (!booking.getBuyerId().equals(user.getId()) && !booking.getSellerId().equals(user.getId())) {
            throw new RuntimeException("Not authorized");
        }

        booking.setStatus(BookingStatus.CANCELLED);
        booking.setCancelReason(reason); // record why it was cancelled (useful for dispute resolution)
        booking.setUpdatedAt(LocalDateTime.now());

        // If this booking held a specific seller-defined slot, free it back up so another
        // buyer can book that time — otherwise a cancelled appointment would stay "taken" forever.
        if (booking.getAvailabilitySlotId() != null) {
            availabilityRepository.findById(booking.getAvailabilitySlotId()).ifPresent(slot -> {
                slot.setBooked(false);
                availabilityRepository.save(slot);
            });
        }

        // If the buyer had actually paid (not just started a checkout session), refund them
        // in full — the seller was never transferred anything for a cancelled booking, since
        // that only happens on completion, so a straight refund is always correct here.
        if ("PAID".equals(booking.getPaymentStatus()) && booking.getPaymentIntentId() != null) {
            try {
                stripeConnectService.refundPayment(booking.getPaymentIntentId());
                booking.setPaymentStatus("REFUNDED");
            } catch (StripeException e) {
                // Don't block the cancellation on a refund failure — surface it via the
                // payment status staying PAID so it's visible as needing manual attention.
                System.err.println("Refund failed for booking " + booking.getId() + ": " + e.getMessage());
            }
        }

        return enrichDto(bookingRepository.save(booking));
    }

    /**
     * Marks a booking as completed, indicating the service was delivered.
     *
     * <p>Only the <em>seller</em> can complete a booking — they confirm delivery.
     * This is a deliberate design: the seller is accountable for the service, so they
     * are the authoritative party to say it was done. After completion, the buyer can
     * leave a review ({@link com.hustleup.marketplace.review.controller.ReviewController}).
     *
     * @param bookingId UUID of the booking to complete
     * @return the updated booking DTO with COMPLETED status
     */
    @Transactional
    public BookingDto complete(UUID bookingId) {
        User user = getCurrentUser();
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new RuntimeException("Booking not found"));

        // Only the seller can declare the work done
        if (!booking.getSellerId().equals(user.getId())) {
            throw new RuntimeException("Only seller can mark as completed");
        }

        booking.setStatus(BookingStatus.COMPLETED);
        booking.setUpdatedAt(LocalDateTime.now());

        // Pay the seller out now that the work is confirmed done — but only if the buyer
        // actually paid (older bookings, or ones created before this system existed, simply
        // have no payment to transfer) and the seller has finished Stripe Connect onboarding.
        // Both checks fail closed: if either is missing, completion still succeeds, it just
        // doesn't trigger a transfer — a seller who hasn't connected payouts yet shouldn't be
        // blocked from marking work done, they just won't be paid out until they do.
        if ("PAID".equals(booking.getPaymentStatus())) {
            payoutAccountRepository.findBySellerId(booking.getSellerId())
                    .filter(SellerPayoutAccount::isPayoutsEnabled)
                    .ifPresent(payoutAccount -> {
                        try {
                            String transferId = stripeConnectService.transferToSeller(booking, payoutAccount.getStripeAccountId());
                            booking.setTransferId(transferId);
                            booking.setPaymentStatus("TRANSFERRED");
                        } catch (StripeException e) {
                            // Leave paymentStatus as PAID so this is visible as still owed —
                            // don't block marking the booking complete on a payout hiccup.
                            System.err.println("Payout failed for booking " + booking.getId() + ": " + e.getMessage());
                        }
                    });
        }

        return enrichDto(bookingRepository.save(booking));
    }

    /**
     * Returns all bookings involving the currently authenticated user — both as a buyer and
     * as a seller — deduplicated and sorted newest first.
     *
     * <p>A user can be on both sides of the marketplace simultaneously (e.g. a photographer
     * who also books catering services). This method queries both sides and merges the results.
     * {@code .distinct()} removes any duplicates that could arise if the same booking appears
     * in both result sets (e.g. a user who somehow was both buyer and seller on one booking).
     *
     * @return deduplicated enriched DTOs for all bookings the user is party to
     */
    public List<BookingDto> getMyBookings() {
        User user = getCurrentUser();
        List<Booking> bookings;
        // Primary query depends on the user's primary role
        if (user.getRole() == com.hustleup.common.model.Role.SELLER) {
            // For sellers, their inbox is the main view: show bookings where they are the seller
            bookings = bookingRepository.findBySellerIdOrderByCreatedAtDesc(user.getId());
        } else {
            // For buyers, show bookings they initiated
            bookings = bookingRepository.findByBuyerIdOrderByCreatedAtDesc(user.getId());
        }
        // Also include bookings where user is on the other side
        // (a seller who also makes purchases, or a buyer who also sells)
        List<Booking> otherSide = user.getRole() == com.hustleup.common.model.Role.SELLER ?
                bookingRepository.findByBuyerIdOrderByCreatedAtDesc(user.getId()) :
                bookingRepository.findBySellerIdOrderByCreatedAtDesc(user.getId());
        bookings.addAll(otherSide);
        // .distinct() uses Booking.equals() (default identity equality since there is no @EqualsAndHashCode)
        // which compares by object reference — distinct() here removes duplicate entity references
        // from the merged list when the same Booking object appeared in both queries.
        return bookings.stream().distinct().map(b -> enrichDto(b, user.getId())).collect(Collectors.toList());
    }

    /**
     * Converts a {@link Booking} entity to an enriched {@link BookingDto} by resolving
     * display names and the listing title via additional repository lookups.
     *
     * <p>{@code ifPresent} is used safely — if a user or listing is not found (e.g. deleted
     * account), the name field is simply left null rather than throwing an exception.
     *
     * @param booking the raw entity from the database
     * @return a fully populated DTO ready to serialise to JSON
     */
    private BookingDto enrichDto(Booking booking) {
        BookingDto dto = BookingDto.fromEntity(booking); // copy all scalar fields
        // Resolve buyer display name for the response (not stored on the booking entity)
        userRepository.findById(booking.getBuyerId()).ifPresent(u -> dto.setBuyerName(u.getFullName()));
        // Resolve seller display name
        userRepository.findById(booking.getSellerId()).ifPresent(u -> dto.setSellerName(u.getFullName()));
        // Resolve the listing title so clients don't need a second API call
        listingRepository.findById(booking.getListingId()).ifPresent(l -> dto.setListingTitle(l.getTitle()));
        return dto;
    }

    private BookingDto enrichDto(Booking booking, UUID currentUserId) {
        BookingDto dto = enrichDto(booking);
        dto.setRole(booking.getBuyerId().equals(currentUserId) ? "buyer" : "seller");
        return dto;
    }

    /**
     * Helper that resolves the currently authenticated user's email from the Spring Security
     * context and looks up the full {@link User} record from the database.
     *
     * <p>The "principal name" in a JWT-authenticated request is the user's email address,
     * as set during token creation in the auth service.
     *
     * @return the authenticated {@link User}
     * @throws RuntimeException if no user record exists for the authenticated email
     */
    private User getCurrentUser() {
        // SecurityContextHolder.getContext() returns the security context for the current thread.
        // .getAuthentication().getName() returns the principal name — the user's email in our JWT setup.
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }
}
