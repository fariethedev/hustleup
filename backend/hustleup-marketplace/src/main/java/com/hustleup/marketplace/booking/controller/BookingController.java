/**
 * REST controller that exposes the booking API for the HustleUp marketplace.
 *
 * <p>All endpoints are grouped under {@code /api/v1/bookings}. Every endpoint requires the
 * caller to be authenticated (a valid JWT must be present in the {@code Authorization} header)
 * because bookings involve real users on both sides of a transaction.
 *
 * <h3>Design pattern — Map&lt;String, Object&gt; request bodies</h3>
 * <p>Several endpoints accept a {@code Map<String, Object>} as the JSON body rather than a
 * dedicated request DTO class. This is a pragmatic shortcut for small, flexible payloads. The
 * trade-off is that you lose compile-time field validation — a typo in the key name only fails
 * at runtime. For a production API at scale, dedicated {@code @RequestBody} DTO classes with
 * Bean Validation ({@code @NotNull}, {@code @Min}, etc.) would be preferred.
 *
 * <p>The booking lifecycle is: INQUIRED → NEGOTIATING → BOOKED → COMPLETED (or CANCELLED at
 * any point). Each state transition maps to a dedicated endpoint below.
 */
package com.hustleup.marketplace.booking.controller;

import com.hustleup.marketplace.booking.dto.BookingDto;
import com.hustleup.marketplace.shipping.FulfilmentUpdateRequest;
import com.hustleup.marketplace.booking.service.BookingService;
import com.stripe.exception.StripeException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

// @RestController: handles HTTP requests, return values are serialised to JSON automatically.
@RestController
// All endpoints in this controller share the /api/v1/bookings base path.
@RequestMapping("/api/v1/bookings")
public class BookingController {

    // The service layer handles all business logic and state machine transitions.
    private final BookingService bookingService;

    /**
     * Constructor injection: Spring provides the {@link BookingService} bean automatically.
     */
    public BookingController(BookingService bookingService) {
        this.bookingService = bookingService;
    }

    /**
     * Creates a new booking request from the authenticated buyer.
     *
     * <p><b>HTTP:</b> {@code POST /api/v1/bookings}
     * <br><b>Auth:</b> Required — any authenticated user can act as a buyer.
     * <br><b>Request body (JSON):</b>
     * <pre>{@code
     * {
     *   "listingId":    "uuid-of-the-listing",  // required
     *   "offeredPrice": 75.00,                   // optional — defaults to listing's asking price
     *   "scheduledAt":  "2025-09-01T14:00:00",  // optional — ISO-8601 local datetime
     *   "joinRequest":  true                     // optional — see below
     * }
     * }</pre>
     *
     * <p>{@code joinRequest}: for an EVENT listing, booking normally means an instant ticket
     * purchase (see {@link BookingService#create}). Setting {@code joinRequest} to true instead
     * files a plain {@code INQUIRED} request that the event's organiser must explicitly accept
     * or decline (via the existing {@code /accept} and {@code /cancel} endpoints) — used for
     * free "request to join" events rather than paid ticketed ones. It has no effect on
     * non-EVENT listings, which already go through the INQUIRED flow by default.
     *
     * @param body the JSON request body parsed into a map
     * @return 200 OK with the new {@link BookingDto} in INQUIRED state
     */
    @PostMapping // handles POST /api/v1/bookings
    public ResponseEntity<BookingDto> create(
            // @RequestBody Map<String, Object> — Spring deserialises the JSON body into a Map.
            // Keys are the JSON field names; values are Java Objects (String, Integer, Double, etc.)
            @RequestBody Map<String, Object> body) {
        // body.get("listingId") returns an Object; we cast to String then convert to UUID
        UUID listingId = UUID.fromString((String) body.get("listingId"));
        // offeredPrice is optional — only parse it if present in the JSON body
        BigDecimal offeredPrice = body.containsKey("offeredPrice") ?
                new BigDecimal(body.get("offeredPrice").toString()) : null;
        // scheduledAt is optional — parse ISO-8601 datetime string if present
        LocalDateTime scheduledAt = body.containsKey("scheduledAt") ?
                LocalDateTime.parse((String) body.get("scheduledAt")) : null;
        // availabilitySlotId (optional) — booking a specific seller-defined time slot for a
        // service listing (e.g. a hair salon appointment) instead of a freely negotiated time.
        UUID availabilitySlotId = body.containsKey("availabilitySlotId") && body.get("availabilitySlotId") != null ?
                UUID.fromString((String) body.get("availabilitySlotId")) : null;
        // quantity (optional) — number of units for an EVENT ticket purchase; defaults to 1.
        Integer quantity = body.containsKey("quantity") ?
                Integer.valueOf(body.get("quantity").toString()) : null;
        // joinRequest (optional) — forces an EVENT booking through the INQUIRED (request/approve)
        // flow instead of the default instant ticket purchase.
        boolean joinRequest = Boolean.TRUE.equals(body.get("joinRequest"));
        return ResponseEntity.ok(bookingService.create(listingId, offeredPrice, scheduledAt, availabilitySlotId, quantity, joinRequest));
    }

    /**
     * Allows the seller to respond to a buyer's inquiry with a counter-offer price.
     *
     * <p><b>HTTP:</b> {@code PATCH /api/v1/bookings/{id}/counter}
     * <br><b>Auth:</b> Required — the authenticated user must be the <em>seller</em> on this booking.
     * <br><b>Request body (JSON):</b>
     * <pre>{@code { "counterPrice": 90.00 }}</pre>
     * <p>Transitions the booking to {@code NEGOTIATING} state.
     *
     * @param id   the UUID of the booking to counter-offer on
     * @param body JSON body containing {@code "counterPrice"}
     * @return 200 OK with the updated {@link BookingDto} in NEGOTIATING state
     */
    @PatchMapping("/{id}/counter") // handles PATCH /api/v1/bookings/uuid/counter
    public ResponseEntity<BookingDto> counterOffer(
            @PathVariable UUID id, // {id} extracted from URL
            @RequestBody Map<String, Object> body) {
        // counterPrice is required for a counter-offer; if missing this will throw NullPointerException
        BigDecimal counterPrice = new BigDecimal(body.get("counterPrice").toString());
        return ResponseEntity.ok(bookingService.counterOffer(id, counterPrice));
    }

    /**
     * Accepts the current booking offer (either the buyer's or the seller's), confirming the booking.
     *
     * <p><b>HTTP:</b> {@code PATCH /api/v1/bookings/{id}/accept}
     * <br><b>Auth:</b> Required — either the buyer or the seller may accept.
     * <br><b>Request body:</b> none required.
     * <p>Transitions the booking to {@code BOOKED} state and locks in the {@code agreedPrice}.
     *
     * @param id the UUID of the booking to accept
     * @return 200 OK with the updated {@link BookingDto} in BOOKED state
     */
    @PatchMapping("/{id}/accept") // handles PATCH /api/v1/bookings/uuid/accept
    public ResponseEntity<BookingDto> accept(@PathVariable UUID id) {
        return ResponseEntity.ok(bookingService.accept(id));
    }

    /**
     * Cancels an active booking with an optional reason.
     *
     * <p><b>HTTP:</b> {@code PATCH /api/v1/bookings/{id}/cancel}
     * <br><b>Auth:</b> Required — either the buyer or the seller may cancel.
     * <br><b>Request body (JSON, optional):</b>
     * <pre>{@code { "reason": "Schedule conflict" }}</pre>
     * <p>Transitions the booking to {@code CANCELLED} state (terminal — cannot be undone).
     *
     * @param id   the UUID of the booking to cancel
     * @param body optional JSON body; may be null if the client sends no body
     * @return 200 OK with the updated {@link BookingDto} in CANCELLED state
     */
    @PatchMapping("/{id}/cancel") // handles PATCH /api/v1/bookings/uuid/cancel
    public ResponseEntity<BookingDto> cancel(
            @PathVariable UUID id,
            // required = false: the client may send an empty body or no body at all
            @RequestBody(required = false) Map<String, String> body) {
        String reason = body != null ? body.get("reason") : null; // reason is optional
        return ResponseEntity.ok(bookingService.cancel(id, reason));
    }

    /**
     * Marks a booking as completed, confirming the service was delivered.
     *
     * <p><b>HTTP:</b> {@code PATCH /api/v1/bookings/{id}/complete}
     * <br><b>Auth:</b> Required — only the <em>seller</em> on this booking may complete it.
     * <br><b>Request body:</b> none required.
     * <p>Transitions the booking to {@code COMPLETED} state. After this, the buyer may
     * submit a review for the seller.
     *
     * @param id the UUID of the booking to complete
     * @return 200 OK with the updated {@link BookingDto} in COMPLETED state
     */
    @PatchMapping("/{id}/complete") // handles PATCH /api/v1/bookings/uuid/complete
    public ResponseEntity<BookingDto> complete(@PathVariable UUID id) {
        return ResponseEntity.ok(bookingService.complete(id));
    }

    /**
     * Returns all bookings involving the authenticated user — as both buyer and seller.
     *
     * <p><b>HTTP:</b> {@code GET /api/v1/bookings/my}
     * <br><b>Auth:</b> Required — results are scoped to the authenticated user.
     * <p>The response includes bookings in all states (INQUIRED, BOOKED, CANCELLED, etc.)
     * so the client can display a complete transaction history.
     *
     * @return 200 OK with a JSON array of {@link BookingDto}, ordered newest first
     */
    /**
     * Records how the seller is sending a paid order, and how far along it is.
     *
     * <p><b>PATCH /api/v1/bookings/{id}/fulfilment</b> — the seller of this booking, or an
     * admin. Body: {@code {"status":"SHIPPED","carrier":"InPost","trackingNumber":"…",
     * "trackingUrl":"…","dropoffPoint":"…","estimatedDelivery":"2026-09-04","note":"…"}}
     *
     * <p>Only {@code status} is required, and only the keys sent are written — a seller
     * adding the courier reference the morning after shipping does not have to retype the
     * note they left the night before. Which statuses are legal depends on the shipping
     * method the listing was posted with: see {@link com.hustleup.marketplace.shipping.ShippingMethod}.
     *
     * <p>Every accepted status change notifies the buyer in-app, by email and by push.
     */
    @PatchMapping("/{id}/fulfilment")
    public ResponseEntity<BookingDto> updateFulfilment(
            @PathVariable UUID id, @RequestBody FulfilmentUpdateRequest body) {
        return ResponseEntity.ok(bookingService.updateFulfilment(id, body));
    }

    /**
     * The seller's outstanding sales — the pending-orders badge and panel.
     *
     * <p><b>GET /api/v1/bookings/pending-sales</b> — auth required, seller side only.
     * Returns bookings still awaiting action: INQUIRED, NEGOTIATING or BOOKED.
     */
    @GetMapping("/pending-sales")
    public ResponseEntity<List<BookingDto>> pendingSales() {
        return ResponseEntity.ok(bookingService.getPendingSales());
    }

    /**
     * A single booking by id — powers the live offer card embedded in a DM thread.
     *
     * <p><b>GET /api/v1/bookings/{id}</b> — auth required, and only the buyer or seller on
     * this booking may read it (see {@link BookingService#getById}).
     */
    @GetMapping("/{id}")
    public ResponseEntity<BookingDto> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(bookingService.getById(id));
    }

    /**
     * Reconciles a Stripe checkout session the buyer has just returned from.
     *
     * <p><b>POST /api/v1/bookings/confirm-payment</b> — body {@code {"sessionId": "cs_..."}}
     *
     * <p>The webhook remains the authority on payment, but it is not something the buyer's
     * browser can wait for: locally it never arrives at all, and in production it can land
     * after the redirect. Until it does, a buyer who has genuinely paid sees an unpaid order
     * with a "Pay now" button — so this asks Stripe directly, on the buyer's return, and
     * applies exactly the same transition the webhook would.
     *
     * <p>Stripe is the source of truth here, not the caller: the session is fetched from the
     * API and only a {@code payment_status} of {@code paid} counts. Passing someone else's
     * session id therefore grants nothing that Stripe has not already been paid for.
     *
     * @return the updated bookings, or 202 with an empty list when the session is not paid yet
     */
    @PostMapping("/confirm-payment")
    public ResponseEntity<?> confirmPayment(@RequestBody Map<String, String> body) {
        String sessionId = body == null ? null : body.get("sessionId");
        if (sessionId == null || sessionId.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "sessionId is required"));
        }
        try {
            com.stripe.model.checkout.Session session = com.stripe.model.checkout.Session.retrieve(sessionId);
            if (!"paid".equals(session.getPaymentStatus())) {
                // Not an error: card authorisations and bank redirects can settle late. The
                // client keeps whatever status it already has rather than showing a failure.
                return ResponseEntity.accepted().body(List.of());
            }
            return ResponseEntity.ok(bookingService.applyPaidSession(session));
        } catch (com.stripe.exception.StripeException e) {
            return ResponseEntity.status(502).body(Map.of("error", "Could not verify the payment with Stripe"));
        }
    }

    @GetMapping("/my") // handles GET /api/v1/bookings/my
    public ResponseEntity<List<BookingDto>> myBookings() {
        return ResponseEntity.ok(bookingService.getMyBookings());
    }

    /**
     * Creates a Stripe Checkout Session so the buyer can pay for a confirmed booking.
     *
     * <p><b>HTTP:</b> {@code POST /api/v1/bookings/{id}/checkout-session}
     * <br><b>Auth:</b> Required — must be the buyer on this booking.
     * <p>The booking must already be {@code BOOKED}. Returns a Stripe-hosted payment page
     * URL; the frontend should redirect the buyer there. The charge lands on HustleUp's own
     * Stripe balance — the seller is only paid out once the booking is marked
     * {@code COMPLETED} (see {@code /complete}).
     *
     * @param id the UUID of the booking to pay for
     * @return 200 OK with {@code {"url": "https://checkout.stripe.com/..."}}, or 502 if Stripe is unreachable
     */
    /**
     * Checks out a whole cart in one payment.
     *
     * <p><b>POST /api/v1/bookings/checkout</b>
     * <br>Body: {@code {"items":[{"listingId":"…","quantity":2}, …]}}
     *
     * <p>Creates a booking per line and returns a single Stripe Checkout URL covering all
     * the instantly-purchasable ones. The client redirects to {@code url}; items that still
     * need seller approval come back in {@code awaitingApproval} so the buyer can be told
     * rather than left wondering why their basket shrank.
     *
     * @return 200 with {@code {url, paidBookingIds, awaitingApproval}}, or 502 if Stripe is unreachable
     */
    @PostMapping("/checkout")
    public ResponseEntity<?> cartCheckout(@RequestBody Map<String, Object> body) {
        try {
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> items = (List<Map<String, Object>>) body.get("items");
            var result = bookingService.createCartCheckout(items);
            Map<String, Object> out = new java.util.LinkedHashMap<>();
            out.put("url", result.checkoutUrl());
            out.put("paidBookingIds", result.paidBookingIds());
            out.put("awaitingApproval", result.awaitingApproval());
            return ResponseEntity.ok(out);
        } catch (StripeException e) {
            return ResponseEntity.status(502).body(Map.of("error", "Could not reach Stripe: " + e.getMessage()));
        }
    }

    @PostMapping("/{id}/checkout-session")
    public ResponseEntity<?> checkoutSession(@PathVariable UUID id) {
        try {
            String url = bookingService.createPaymentCheckoutSession(id);
            return ResponseEntity.ok(Map.of("url", url));
        } catch (StripeException e) {
            return ResponseEntity.status(502).body(Map.of("error", "Could not reach Stripe: " + e.getMessage()));
        }
    }
}
