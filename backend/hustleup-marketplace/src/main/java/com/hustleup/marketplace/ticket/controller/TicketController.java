/**
 * REST API for digital event tickets.
 *
 * <p>Base path: {@code /api/v1/tickets}. Every endpoint requires authentication — a ticket is
 * personal, and the door endpoints act on an organiser's own event.
 *
 * <p>There is deliberately no "create ticket" endpoint. Tickets are issued by
 * {@link com.hustleup.marketplace.ticket.service.TicketService#issueForBooking} when an EVENT
 * booking is confirmed, so the only way to hold a ticket is to actually have a booking.
 *
 * <h3>Errors</h3>
 * <p>The service layer throws {@link RuntimeException} with user-facing messages for
 * authorisation and lookup failures (the pattern used across this module). They are translated
 * to a 403/404-shaped JSON body here rather than surfacing as a 500, because these are ordinary
 * outcomes — opening a stale ticket link, or scanning at the wrong event.
 */
package com.hustleup.marketplace.ticket.controller;

import com.hustleup.marketplace.ticket.dto.ScanResultDto;
import com.hustleup.marketplace.ticket.dto.TicketDto;
import com.hustleup.marketplace.ticket.service.TicketService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/tickets")
public class TicketController {

    private final TicketService ticketService;

    public TicketController(TicketService ticketService) {
        this.ticketService = ticketService;
    }

    /**
     * The authenticated user's ticket wallet.
     *
     * <p><b>GET /api/v1/tickets/my</b> — every ticket they hold, newest first, each with the QR
     * payload needed to get in.
     */
    @GetMapping("/my")
    public ResponseEntity<List<TicketDto>> myTickets() {
        return ResponseEntity.ok(ticketService.myTickets());
    }

    /**
     * A single ticket, for the ticket detail screen.
     *
     * <p><b>GET /api/v1/tickets/{id}</b> — readable by the holder (with QR payload) or by the
     * event's organiser (without).
     */
    @GetMapping("/{id}")
    public ResponseEntity<?> getTicket(@PathVariable UUID id) {
        try {
            return ResponseEntity.ok(ticketService.getTicket(id));
        } catch (RuntimeException e) {
            return ResponseEntity.status(404).body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * The authenticated user's tickets for one event.
     *
     * <p><b>GET /api/v1/tickets/event/{listingId}/mine</b> — lets the listing page show
     * "you're going" with a link straight to the ticket instead of offering to sell again.
     */
    @GetMapping("/event/{listingId}/mine")
    public ResponseEntity<List<TicketDto>> myTicketsForEvent(@PathVariable UUID listingId) {
        return ResponseEntity.ok(ticketService.myTicketsForEvent(listingId));
    }

    /**
     * The organiser's door list for one of their events.
     *
     * <p><b>GET /api/v1/tickets/event/{listingId}</b> — every ticket issued, in sale order,
     * with attendee names and check-in state. QR payloads are omitted.
     */
    @GetMapping("/event/{listingId}")
    public ResponseEntity<?> ticketsForEvent(@PathVariable UUID listingId) {
        try {
            return ResponseEntity.ok(ticketService.ticketsForEvent(listingId));
        } catch (RuntimeException e) {
            return ResponseEntity.status(403).body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Live head count for one of the organiser's events.
     *
     * <p><b>GET /api/v1/tickets/event/{listingId}/summary</b> — returns
     * {@code { issued, checkedIn, expected, cancelled }}.
     */
    @GetMapping("/event/{listingId}/summary")
    public ResponseEntity<?> doorSummary(@PathVariable UUID listingId) {
        try {
            return ResponseEntity.ok(ticketService.doorSummary(listingId));
        } catch (RuntimeException e) {
            return ResponseEntity.status(403).body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Admits a ticket holder at the door.
     *
     * <p><b>POST /api/v1/tickets/event/{listingId}/scan</b> — body {@code { "code": "…" }} where
     * the value is either a scanned QR payload ({@code HUTKT:HU-4F2A-91BC:…}) or an admission
     * code typed in by hand ({@code HU-4F2A-91BC}).
     *
     * <p>Returns 200 for every ordinary answer, including rejections — see
     * {@link ScanResultDto}. A 403 means the caller doesn't run this event.
     */
    @PostMapping("/event/{listingId}/scan")
    public ResponseEntity<?> scan(@PathVariable UUID listingId, @RequestBody Map<String, String> body) {
        try {
            ScanResultDto result = ticketService.scan(body.get("code"), listingId);
            return ResponseEntity.ok(result);
        } catch (RuntimeException e) {
            return ResponseEntity.status(403).body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Lets a holder check themselves in, for events with no one working a door.
     *
     * <p><b>POST /api/v1/tickets/{id}/check-in</b> — only the ticket's own holder may call it.
     */
    @PostMapping("/{id}/check-in")
    public ResponseEntity<?> selfCheckIn(@PathVariable UUID id) {
        try {
            return ResponseEntity.ok(ticketService.selfCheckIn(id));
        } catch (RuntimeException e) {
            return ResponseEntity.status(400).body(Map.of("error", e.getMessage()));
        }
    }
}
