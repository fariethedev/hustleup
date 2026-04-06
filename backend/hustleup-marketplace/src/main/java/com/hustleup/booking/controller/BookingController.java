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
package com.hustleup.booking.controller;

import com.hustleup.booking.dto.BookingDto;
import com.hustleup.booking.service.BookingService;
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
     *   "scheduledAt":  "2025-09-01T14:00:00"   // optional — ISO-8601 local datetime
     * }
     * }</pre>
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
        return ResponseEntity.ok(bookingService.create(listingId, offeredPrice, scheduledAt));
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
    @GetMapping("/my") // handles GET /api/v1/bookings/my
    public ResponseEntity<List<BookingDto>> myBookings() {
        return ResponseEntity.ok(bookingService.getMyBookings());
    }
}
