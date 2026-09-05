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
import com.hustleup.marketplace.review.model.Review;
import com.hustleup.marketplace.review.repository.ReviewRepository;
import com.hustleup.marketplace.payments.model.SellerPayoutAccount;
import com.hustleup.marketplace.payments.repository.SellerPayoutAccountRepository;
import com.hustleup.marketplace.payments.service.StripeConnectService;
import com.hustleup.marketplace.shipping.Fulfilment;
import com.hustleup.marketplace.shipping.FulfilmentStatus;
import com.hustleup.marketplace.shipping.FulfilmentUpdateRequest;
import com.hustleup.marketplace.shipping.ShipmentService;
import com.hustleup.marketplace.shipping.ShippingMethod;
import com.hustleup.marketplace.ticket.service.TicketService;
import com.hustleup.common.email.EmailService;
import com.hustleup.common.push.ExpoPushService;
import com.hustleup.common.model.Notification;
import com.hustleup.common.model.User;
import com.hustleup.common.repository.NotificationRepository;
import com.hustleup.common.repository.UserRepository;
import com.stripe.exception.StripeException;
import org.springframework.http.HttpStatus;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

// @Service marks this as a Spring component containing business logic.
// Spring creates a single instance (singleton scope) and injects it wherever needed.
@Service
public class BookingService {

    /**
     * Listing types bought outright rather than negotiated.
     *
     * <p>These confirm to BOOKED the moment the buyer commits, so checkout can go straight
     * to payment. Services are deliberately absent: a haircut or a freelance job needs the
     * seller to agree scope and timing first, so those keep the INQUIRED → accept → pay
     * flow. EVENT and appointment slots are already handled by their own earlier branches.
     */
    private static final java.util.Set<ListingType> INSTANT_PURCHASE_TYPES =
            java.util.Set.of(ListingType.GOODS, ListingType.FASHION, ListingType.FOOD);

    // --- Dependencies (injected via constructor) ---

    private final BookingRepository bookingRepository;    // CRUD for bookings table
    private final ListingRepository listingRepository;    // look up listing details at booking time
    private final UserRepository userRepository;          // look up buyer/seller display names
    private final AvailabilityRepository availabilityRepository; // seller-defined slots for service bookings
    private final SellerPayoutAccountRepository payoutAccountRepository; // seller's Stripe Connect account
    private final StripeConnectService stripeConnectService; // payment collection + seller payouts
    private final EmailService emailService; // booking confirmed/cancelled/completed notifications
    private final ExpoPushService expoPushService; // same lifecycle events, as a mobile push
    private final TicketService ticketService; // issues/voids digital tickets for EVENT bookings
    private final NotificationRepository notificationRepository; // in-app alerts — powers the real-time negotiation popup
    private final ShipmentService shipmentService; // delivery-track updates and the alerts they generate
    private final ReviewRepository reviewRepository; // completing a booking records the completer's review in the same step

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
                          StripeConnectService stripeConnectService,
                          EmailService emailService, ExpoPushService expoPushService,
                          TicketService ticketService, NotificationRepository notificationRepository,
                          ReviewRepository reviewRepository, ShipmentService shipmentService) {
        this.bookingRepository = bookingRepository;
        this.listingRepository = listingRepository;
        this.userRepository = userRepository;
        this.availabilityRepository = availabilityRepository;
        this.payoutAccountRepository = payoutAccountRepository;
        this.stripeConnectService = stripeConnectService;
        this.emailService = emailService;
        this.expoPushService = expoPushService;
        this.ticketService = ticketService;
        this.reviewRepository = reviewRepository;
        this.notificationRepository = notificationRepository;
        this.shipmentService = shipmentService;
    }

    /**
     * Issues digital tickets for a confirmed EVENT booking and tells the buyer they're in.
     *
     * <p>Called from every path that can confirm an event booking: an instant ticket purchase,
     * and an organiser accepting a request to join. {@code issueForBooking} is idempotent, so a
     * booking that passes through here twice does not double an event's head count.
     *
     * <p>Ticket issuing is best-effort with respect to notification only — a failure to send the
     * confirmation email must not roll back the tickets, which is why the notify calls are
     * separately guarded inside {@link #notifyByEmail}.
     *
     * @param booking the booking that has just been confirmed
     * @param listing its listing; ignored unless this is an EVENT
     */
    private void issueTicketsIfEvent(Booking booking, Listing listing) {
        if (listing == null || listing.getListingType() != ListingType.EVENT) return;

        int issued = ticketService.issueForBooking(booking, listing).size();

        String plural = issued == 1 ? "ticket is" : "tickets are";
        notifyByEmail(booking.getBuyerId(), "Your ticket for " + listing.getTitle(),
                "<p>Your " + plural + " ready. Open HustleSpace to view the QR code and show it at the door.</p>");
        notifyByPush(booking.getBuyerId(), "Ticket ready",
                issued + " " + plural + " ready for " + listing.getTitle() + ".");
    }

    /** Best-effort booking-lifecycle email — never lets a mail failure affect the booking flow. */
    private void notifyByEmail(UUID userId, String subject, String htmlBody) {
        try {
            userRepository.findById(userId).ifPresent(u -> emailService.send(u.getEmail(), subject, htmlBody));
        } catch (Exception ignored) {
        }
    }

    /** Same booking-lifecycle events as {@link #notifyByEmail}, delivered as a mobile push. */
    private void notifyByPush(UUID userId, String title, String body) {
        try {
            userRepository.findById(userId).ifPresent(u -> expoPushService.send(u.getPushToken(), title, body));
        } catch (Exception ignored) {
        }
    }

    /**
     * Persists an in-app {@link Notification} for a booking-negotiation event (new request,
     * counter-offer, or acceptance). Unlike email/push, this is what the frontend's real-time
     * negotiation popup polls for — {@code type} drives which action buttons it renders
     * (accept/decline/counter for a request or counter-offer; a plain heads-up for an
     * acceptance), and {@code referenceId} is the booking ID those actions operate on.
     */
    private void notifyInApp(UUID userId, String title, String message, String type, UUID referenceId) {
        try {
            notificationRepository.save(Notification.builder()
                    .userId(userId)
                    .title(title)
                    .message(message)
                    .notificationType(type)
                    .referenceId(referenceId)
                    .build());
        } catch (Exception ignored) {
        }
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
     * @param joinRequest        for EVENT listings only: true routes through the standard INQUIRED
     *                           request/approve flow instead of an instant ticket purchase — used
     *                           for free events where the organiser vets attendees before confirming
     * @return the newly created booking as an enriched DTO
     */
    @Transactional // wraps the entire method in a database transaction
    public BookingDto create(UUID listingId, BigDecimal offeredPrice, LocalDateTime scheduledAt,
                              UUID availabilitySlotId, Integer quantity, boolean joinRequest) {
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
                    .fulfilment(deliveryFor(listing))
                    .scheduledAt(slot.getStartTime())
                    .availabilitySlotId(slot.getId())
                    .quantity(1)
                    .status(BookingStatus.BOOKED)
                    .build();
            return enrichDto(bookingRepository.save(booking));
        }

        // ── Event ticket purchase ────────────────────────────────────────────────────────
        // Buying a ticket is an instant purchase, not a negotiation — confirm immediately
        // with the total price for the requested quantity. Skipped when the buyer instead
        // sent a "request to join" — that falls through to the standard INQUIRED flow below
        // so the event's organiser can explicitly accept or decline it.
        if (listing.getListingType() == ListingType.EVENT && !joinRequest) {
            Booking booking = Booking.builder()
                    .buyerId(buyer.getId())
                    .sellerId(listing.getSellerId())
                    .listingId(listingId)
                    .offeredPrice(listing.getPrice())
                    .agreedPrice(listing.getPrice().multiply(BigDecimal.valueOf(qty)))
                    .currency(listing.getCurrency())
                    .fulfilment(deliveryFor(listing))
                    .scheduledAt(scheduledAt)
                    .quantity(qty)
                    .status(BookingStatus.BOOKED)
                    .build();
            Booking saved = bookingRepository.save(booking);
            // No ticket yet. This used to mint one here, with paymentStatus still PENDING —
            // a scannable ticket that would admit someone at the door who had paid nothing,
            // and an attendee list made of people who had clicked rather than people who had
            // paid. Tickets are issued when the money lands; see confirmPayment below.
            return enrichDto(saved);
        }

        // ── Physical goods: instant purchase ─────────────────────────────────────────────
        // Buying a product is shopping, not negotiating. A shopper expects to pay and be
        // done, so these confirm immediately (BOOKED) and go straight to payment, exactly
        // like the event-ticket path above. Services (HAIR_BEAUTY, SKILL) fall through to
        // the INQUIRED flow below, because those genuinely need the seller to agree scope
        // and timing before any money changes hands.
        //
        // Unless the buyer named a price. A buyer who came through "Negotiate via DM" and
        // typed an offer is not shopping, and this shortcut used to swallow that: it ignored
        // offeredPrice entirely and returned a BOOKED order at the seller's full asking
        // price. Someone who believed they had offered 5.50 for a 19.82 item was committed
        // to 19.82, with no offer for the seller to accept or refuse and nothing on screen
        // saying so. Naming a price is what distinguishes the two intents, so it is what
        // decides the branch.
        if (INSTANT_PURCHASE_TYPES.contains(listing.getListingType()) && offeredPrice == null) {
            Booking booking = Booking.builder()
                    .buyerId(buyer.getId())
                    .sellerId(listing.getSellerId())
                    .listingId(listingId)
                    .offeredPrice(listing.getPrice())
                    .agreedPrice(listing.getPrice().multiply(BigDecimal.valueOf(qty)))
                    .currency(listing.getCurrency())
                    .fulfilment(deliveryFor(listing))
                    .scheduledAt(scheduledAt)
                    .quantity(qty)
                    .status(BookingStatus.BOOKED)
                    .build();
            Booking saved = bookingRepository.save(booking);
            notifyInApp(listing.getSellerId(),
                    "New order: " + listing.getTitle(),
                    "You have a new order to fulfil — payment is being taken now.",
                    "BOOKING_REQUEST", saved.getId());
            return enrichDto(saved);
        }

        // ── Standard negotiated booking ──────────────────────────────────────────────────
        // Construct the booking entity. @Builder.Default on the entity sets the initial status
        // to POSTED, but we explicitly override it to INQUIRED here to indicate a real request.
        BigDecimal offer = offeredPrice != null ? offeredPrice : listing.getPrice();
        Booking booking = Booking.builder()
                .buyerId(buyer.getId())
                .sellerId(listing.getSellerId())
                .listingId(listingId)
                // Use the buyer's custom offer if provided; otherwise default to the listing price
                .offeredPrice(offer)
                .currency(listing.getCurrency()) // lock in the currency from the listing
                .fulfilment(deliveryFor(listing))
                .scheduledAt(scheduledAt)
                .quantity(qty)
                .status(BookingStatus.INQUIRED) // explicitly start at INQUIRED (formal request sent)
                .build();

        Booking saved = bookingRepository.save(booking);

        // This is the moment the seller needs to hear about immediately — everything downstream
        // (accept/decline/counter) hinges on them seeing it, so it's the one booking event that
        // gets a dedicated notification type the frontend's real-time popup polls for.
        String buyerName = buyer.displayName();
        notifyInApp(listing.getSellerId(),
                buyerName + " wants to book " + listing.getTitle(),
                buyerName + " offered " + offer + " " + listing.getCurrency() + " for \"" + listing.getTitle() + "\".",
                "BOOKING_REQUEST", saved.getId());

        return enrichDto(saved);
    }

    /**
     * Checks out a whole cart: creates a booking per line, then returns ONE Stripe
     * Checkout Session covering all of them.
     *
     * <p>Replaces the old front-end behaviour where "Place order" either wrote to
     * {@code sessionStorage} or created bookings that nobody ever charged for — in both
     * cases the buyer saw a confirmation screen for a purchase that had not happened.
     *
     * <p>Only items that confirm instantly can be paid for here. If the cart contains a
     * service that still needs the seller to accept, its booking is still created (the
     * request reaches the seller) but it is left out of the payment and reported back, so
     * the buyer is told rather than silently charged for part of their basket.
     *
     * @param items each entry: listingId, optional quantity, optional scheduledAt
     * @return checkout URL, the ids paid for, and any items deferred for seller approval
     */
    @Transactional
    public CartCheckout createCartCheckout(List<Map<String, Object>> items) throws StripeException {
        if (items == null || items.isEmpty()) {
            throw new RuntimeException("Your cart is empty");
        }

        List<Booking> payable = new java.util.ArrayList<>();
        List<String> titles = new java.util.ArrayList<>();
        List<UUID> awaitingApproval = new java.util.ArrayList<>();

        for (Map<String, Object> item : items) {
            UUID listingId = UUID.fromString(String.valueOf(item.get("listingId")));
            Integer qty = item.get("quantity") != null
                    ? Integer.valueOf(String.valueOf(item.get("quantity"))) : null;
            LocalDateTime when = item.get("scheduledAt") != null
                    ? LocalDateTime.parse(String.valueOf(item.get("scheduledAt"))) : null;

            // Reuse create() rather than duplicating its rules — it owns "cannot book your
            // own listing", slot reservation, ticket issuing and the instant-vs-negotiated
            // decision. Duplicating any of that here is how the two paths drift apart.
            BookingDto dto = create(listingId, null, when, null, qty, false);
            Booking booking = bookingRepository.findById(dto.getId())
                    .orElseThrow(() -> new RuntimeException("Booking vanished mid-checkout"));

            if (booking.getStatus() == BookingStatus.BOOKED) {
                payable.add(booking);
                titles.add(listingRepository.findById(booking.getListingId())
                        .map(Listing::getTitle).orElse("Item"));
            } else {
                awaitingApproval.add(booking.getId());
            }
        }

        if (payable.isEmpty()) {
            // Everything needs seller approval — nothing to charge for yet.
            return new CartCheckout(null, List.of(), awaitingApproval);
        }

        var result = stripeConnectService.createCartCheckoutSession(payable, titles);

        // Stamp the PaymentIntent on every booking in the order so the webhook can mark
        // the whole thing paid from one event.
        for (Booking b : payable) {
            b.setPaymentIntentId(result.paymentIntentId());
            b.setPaymentStatus("PENDING");
            bookingRepository.save(b);
        }

        return new CartCheckout(result.checkoutUrl(),
                payable.stream().map(Booking::getId).toList(),
                awaitingApproval);
    }

    /**
     * Outcome of a cart checkout.
     *
     * @param checkoutUrl      Stripe-hosted page to redirect to, or null if nothing was payable
     * @param paidBookingIds   bookings included in this payment
     * @param awaitingApproval bookings created but not charged, pending seller acceptance
     */
    public record CartCheckout(String checkoutUrl, List<UUID> paidBookingIds, List<UUID> awaitingApproval) {}

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
                .map(Listing::getTitle).orElse("HustleSpace booking");

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
        Booking saved = bookingRepository.save(booking);

        String listingTitle = listingRepository.findById(booking.getListingId())
                .map(Listing::getTitle).orElse("your booking");
        String sellerName = seller.displayName();
        notifyInApp(booking.getBuyerId(),
                sellerName + " countered on " + listingTitle,
                sellerName + " proposed " + counterPrice + " " + booking.getCurrency() + " for \"" + listingTitle + "\".",
                "BOOKING_COUNTER", saved.getId());

        return enrichDto(saved);
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
            Booking saved = bookingRepository.save(booking);

            // The other route into an event. A ticket is still only for someone who has
            // paid: a free event has nothing to charge, so the booking arrives PAID and is
            // ticketed here, while a paid one waits for the charge to clear like any other.
            Listing bookedListing = listingRepository.findById(booking.getListingId()).orElse(null);
            if ("PAID".equals(saved.getPaymentStatus())) {
                issueTicketsIfEvent(saved, bookedListing);
            }

            String listingTitle = bookedListing != null ? bookedListing.getTitle() : "your booking";
            notifyByEmail(booking.getBuyerId(), "Booking confirmed: " + listingTitle,
                    "<p>Your booking for <b>" + listingTitle + "</b> is confirmed at "
                            + agreed + " " + booking.getCurrency() + ".</p>");
            notifyByPush(booking.getBuyerId(), "Booking confirmed",
                    listingTitle + " is confirmed at " + agreed + " " + booking.getCurrency() + ".");

            // Let whichever party didn't just click "accept" know their offer/counter went
            // through — closes the loop on the negotiation popup for both sides.
            UUID otherParty = user.getId().equals(booking.getBuyerId()) ? booking.getSellerId() : booking.getBuyerId();
            notifyInApp(otherParty, "Booking confirmed: " + listingTitle,
                    listingTitle + " is confirmed at " + agreed + " " + booking.getCurrency() + ".",
                    "BOOKING_ACCEPTED", saved.getId());

            return enrichDto(saved);
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

        // Void any event tickets this booking issued so a cancelled attendee can't walk in on
        // an old QR code. No-op for non-event bookings, which never had tickets.
        ticketService.voidForBooking(booking.getId());

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

        Booking saved = bookingRepository.save(booking);

        // Notify whichever party didn't initiate the cancellation.
        UUID notifyUserId = user.getId().equals(booking.getBuyerId()) ? booking.getSellerId() : booking.getBuyerId();
        String listingTitle = listingRepository.findById(booking.getListingId())
                .map(Listing::getTitle).orElse("a booking");
        notifyByEmail(notifyUserId, "Booking cancelled: " + listingTitle,
                "<p>The booking for <b>" + listingTitle + "</b> was cancelled"
                        + (reason != null && !reason.isBlank() ? ": " + reason : ".") + "</p>");
        notifyByPush(notifyUserId, "Booking cancelled",
                listingTitle + " was cancelled"
                        + (reason != null && !reason.isBlank() ? ": " + reason : "."));

        return enrichDto(saved);
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
    /**
     * Applies a completed Stripe checkout session to the bookings it paid for.
     *
     * <p>Shared by two callers on purpose. The webhook is the authority, but it only ever
     * arrives when Stripe can reach this server — in local development it never does, and in
     * production it can lag the buyer's redirect by seconds. Without a second path the buyer
     * lands back in the app having genuinely paid and sees an unpaid order with a "Pay now"
     * button, which is alarming and invites a double payment.
     *
     * <p>Both paths run this same code so they cannot drift, and it is safe to run twice:
     * the payment status is only written when it is not already terminal, and
     * {@link ShipmentService#confirmPaid} returns early once a fulfilment has moved past
     * AWAITING_PAYMENT.
     *
     * @param session a Stripe checkout session that has already been verified as paid
     * @return the bookings that were updated, as DTOs for the caller who is waiting on them
     */
    @Transactional
    public List<BookingDto> applyPaidSession(com.stripe.model.checkout.Session session) {
        List<Booking> paid = new ArrayList<>();

        // Bookings are identified by an id list in metadata, falling back to the payment
        // intent for sessions created before that metadata existed.
        String csv = session.getMetadata() == null ? null : session.getMetadata().get("bookingIds");
        if (csv != null && !csv.isBlank()) {
            for (String raw : csv.split(",")) {
                try {
                    bookingRepository.findById(UUID.fromString(raw.trim())).ifPresent(paid::add);
                } catch (IllegalArgumentException ignored) {
                    // A malformed id in metadata should not sink the whole reconciliation.
                }
            }
        } else if (session.getPaymentIntent() != null) {
            paid = bookingRepository.findAllByPaymentIntentId(session.getPaymentIntent());
        }

        List<BookingDto> updated = new ArrayList<>();
        for (Booking booking : paid) {
            // Never walk a refund or a completed payout backwards.
            if (!List.of("PAID", "TRANSFERRED", "REFUNDED").contains(booking.getPaymentStatus())) {
                booking.setPaymentStatus("PAID");
            }
            if (session.getPaymentIntent() != null) {
                booking.setPaymentIntentId(session.getPaymentIntent());
            }
            String title = listingRepository.findById(booking.getListingId())
                    .map(Listing::getTitle).orElse("your order");
            shipmentService.confirmPaid(booking.getFulfilment(), title,
                    booking.getId(), booking.getBuyerId(), booking.getSellerId());

            // Payment is what earns a ticket, so this is where one is minted. issueForBooking
            // is idempotent, which matters here: Stripe can deliver the same session more than
            // once, and a buyer returning to the success page re-runs this path — neither may
            // hand out a second ticket for one purchase.
            if ("PAID".equals(booking.getPaymentStatus())) {
                listingRepository.findById(booking.getListingId())
                        .ifPresent(listing -> issueTicketsIfEvent(booking, listing));
            }

            updated.add(enrichDto(bookingRepository.save(booking), booking.getBuyerId()));
        }
        return updated;
    }

    @Transactional
    public BookingDto complete(UUID bookingId) {
        User user = getCurrentUser();
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new RuntimeException("Booking not found"));

        // Completing no longer demands anything from the seller.
        //
        // It used to require them to rate the buyer, on the reasoning that a rating nobody is
        // forced to give is a rating nobody gives. That produced the wrong rating: the stars
        // on a shop card, the leaderboard and the storefront average all come from the
        // BUYER's review of the SELLER, which the buyer leaves separately. What the gate
        // actually collected was a seller's opinion of a buyer, which is surfaced almost
        // nowhere -- and it collected it by holding the seller's own payout behind an opinion
        // they had no particular reason to hold, on the one action that releases their money.
        //
        // The seller is still asked something at this moment, because finishing a sale is a
        // good moment to ask: how HustleSpace is working for them, and what to fix. That goes
        // to PlatformFeedback, is private to admins, and gates nothing.

        // Only the seller can declare the work done
        if (!booking.getSellerId().equals(user.getId())) {
            throw new RuntimeException("Only seller can mark as completed");
        }

        booking.setStatus(BookingStatus.COMPLETED);
        booking.setUpdatedAt(LocalDateTime.now());

        // Close the delivery track too. A seller declaring the job done is saying the buyer
        // has it, so leaving the tracker frozen at "Order confirmed" on a finished booking
        // would show the buyer a parcel that never arrived. Only ever moved forward — a
        // seller who already marked it delivered keeps the timestamp they set then.
        Fulfilment delivery = booking.getFulfilment();
        FulfilmentStatus reached = delivery.getFulfilmentStatus();
        if (reached != null && reached != FulfilmentStatus.CANCELLED && !reached.isComplete()) {
            delivery.setFulfilmentStatus(delivery.methodOrDefault().finalStep());
            delivery.setDeliveredAt(LocalDateTime.now());
            delivery.setUpdatedAt(LocalDateTime.now());
        }

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

        Booking saved = bookingRepository.save(booking);

        String listingTitle = listingRepository.findById(booking.getListingId())
                .map(Listing::getTitle).orElse("your booking");
        notifyByEmail(booking.getBuyerId(), "Completed: " + listingTitle,
                "<p><b>" + listingTitle + "</b> is marked complete. Leave a review to help other buyers!</p>");
        notifyByPush(booking.getBuyerId(), "Booking completed",
                listingTitle + " is marked complete. Leave a review to help other buyers!");
        if ("TRANSFERRED".equals(saved.getPaymentStatus())) {
            notifyByEmail(booking.getSellerId(), "Payout sent: " + listingTitle,
                    "<p>You've been paid out for <b>" + listingTitle + "</b>.</p>");
            notifyByPush(booking.getSellerId(), "Payout sent", "You've been paid out for " + listingTitle + ".");
        }

        return enrichDto(saved, user.getId());
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
    /**
     * The seller's outstanding sales — everything sold but not yet delivered or cancelled.
     *
     * <p>"Pending" here means work the seller still owes somebody: an inquiry to answer, a
     * negotiation in progress, or a confirmed order to fulfil. COMPLETED and CANCELLED are
     * excluded because neither needs anything more from them.
     *
     * <p>Strictly the seller side. A seller who also buys has their own purchases in
     * {@link #getMyBookings}, and mixing the two here would make the pending-count badge
     * meaningless — it is meant to answer "how much do I owe my customers?".
     *
     * @return outstanding sales, newest first
     */
    public List<BookingDto> getPendingSales() {
        User user = getCurrentUser();
        java.util.Set<BookingStatus> outstanding = java.util.EnumSet.of(
                BookingStatus.INQUIRED, BookingStatus.NEGOTIATING, BookingStatus.BOOKED);
        return bookingRepository.findBySellerIdOrderByCreatedAtDesc(user.getId()).stream()
                .filter(b -> outstanding.contains(b.getStatus()))
                .map(b -> enrichDto(b, user.getId()))
                .collect(Collectors.toList());
    }

    /**
     * Snapshots a listing's delivery terms onto a booking being created.
     *
     * <p>Copied rather than read back through {@code listingId} for the same reason the
     * agreed price is: a seller who switches from courier to collection next week must not
     * silently rewrite the terms of an order somebody already paid postage on.
     *
     * <p>Starts at {@code AWAITING_PAYMENT} regardless of how the booking was created.
     * Even the instant-purchase paths that open BOOKED have not been paid yet — the
     * delivery track only starts when the Stripe webhook says money arrived.
     */
    private Fulfilment deliveryFor(Listing listing) {
        Fulfilment fulfilment = new Fulfilment();
        fulfilment.setShippingMethod(listing.getShippingMethod() != null
                ? listing.getShippingMethod() : ShippingMethod.NONE);
        // Postage is charged once per order, not per unit — a buyer taking three of
        // something is not posted three separate parcels.
        fulfilment.setShippingPrice(listing.getShippingPrice() != null
                ? listing.getShippingPrice() : BigDecimal.ZERO);
        fulfilment.setFulfilmentStatus(FulfilmentStatus.AWAITING_PAYMENT);
        return fulfilment;
    }

    /**
     * Records a seller's tracking update against one of their bookings.
     *
     * <p>Seller-only by design: the buyer is the one being informed, and letting them mark
     * their own order delivered would make the record worthless as evidence of what the
     * seller actually did. Admins are allowed through to fix a stuck order.
     *
     * @throws ResponseStatusException 404 if no such booking, 403 if the caller is not its
     *                                 seller, 400 if the update is not legal for how this
     *                                 order is being sent
     */
    public BookingDto updateFulfilment(UUID bookingId, FulfilmentUpdateRequest request) {
        User me = getCurrentUser();
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));

        if (!booking.getSellerId().equals(me.getId()) && me.getRole() != com.hustleup.common.model.Role.ADMIN) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Only the seller can update delivery on this order");
        }

        String title = listingRepository.findById(booking.getListingId())
                .map(Listing::getTitle).orElse("your order");

        String rejection = shipmentService.applyUpdate(booking.getFulfilment(), request,
                title, booking.getId(), booking.getBuyerId());
        if (rejection != null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, rejection);

        booking.setUpdatedAt(LocalDateTime.now());
        return enrichDto(bookingRepository.save(booking), me.getId());
    }

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
     * A single booking by id, for the live-updating offer card in a DM thread.
     *
     * <p>Ownership-checked the same way {@link #accept} is: only the buyer or seller on this
     * booking may read it, since {@code offeredPrice}/{@code counterPrice} are only meant for
     * the two negotiating parties.
     *
     * @param bookingId UUID of the booking to fetch
     * @return the booking DTO, role-tagged for the caller
     * @throws RuntimeException if the booking doesn't exist or the caller is neither party
     */
    public BookingDto getById(UUID bookingId) {
        User user = getCurrentUser();
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new RuntimeException("Booking not found"));
        if (!booking.getBuyerId().equals(user.getId()) && !booking.getSellerId().equals(user.getId())) {
            throw new RuntimeException("Not authorized");
        }
        return enrichDto(booking, user.getId());
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
        userRepository.findById(booking.getBuyerId()).ifPresent(u -> dto.setBuyerName(u.displayName()));
        // Resolve seller display name
        userRepository.findById(booking.getSellerId()).ifPresent(u -> dto.setSellerName(u.displayName()));
        // Resolve the listing title so clients don't need a second API call
        listingRepository.findById(booking.getListingId()).ifPresent(l -> dto.setListingTitle(l.getTitle()));
        return dto;
    }

    private BookingDto enrichDto(Booking booking, UUID currentUserId) {
        BookingDto dto = enrichDto(booking);
        dto.setRole(booking.getBuyerId().equals(currentUserId) ? "buyer" : "seller");
        dto.setReviewedByMe(reviewRepository.existsByBookingIdAndReviewerId(booking.getId(), currentUserId));
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
