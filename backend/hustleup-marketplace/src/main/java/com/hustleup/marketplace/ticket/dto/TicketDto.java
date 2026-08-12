/**
 * The shape of a digital ticket as the apps consume it.
 *
 * <p>Deliberately fat compared with {@link com.hustleup.marketplace.ticket.model.EventTicket}:
 * a ticket is shown on its own, away from the listing page, so everything needed to render it —
 * event title, date, venue, artwork, organiser, what was paid — is resolved server-side and
 * inlined here rather than leaving the client to chase three more endpoints.
 *
 * <h3>{@link #qrPayload} is privileged</h3>
 * <p>The QR payload contains the ticket's secret and is only populated when the request comes
 * from the ticket's owner (see
 * {@link com.hustleup.marketplace.ticket.service.TicketService#toDto}). Organisers reading their
 * door list get every other field but a null payload — they have no need to reproduce a
 * scannable copy of an attendee's ticket, and not sending it means it can't leak from that
 * screen.
 */
package com.hustleup.marketplace.ticket.dto;

import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class TicketDto {

    // --- Identity ---
    private UUID id;
    private UUID bookingId;

    /** Human-readable admission code, e.g. {@code HU-4F2A-91BC}. Safe to display. */
    private String ticketCode;

    /**
     * String the QR code should encode: {@code HUTKT:<ticketCode>:<secret>}.
     * Null unless the caller owns this ticket.
     */
    private String qrPayload;

    // --- Position in the order ---
    private Integer ticketNumber;     // 2 …
    private Integer ticketsInBooking; // … of 3

    // --- Event ---
    private UUID listingId;
    private String eventTitle;
    private String eventDescription;
    private String eventImageUrl;      // first media item on the listing, refreshed for S3/CDN
    private String eventCity;          // listing's browse city
    private String eventVenue;         // specific venue/address, if the organiser set one
    private LocalDateTime eventStartsAt;

    // --- Parties ---
    private UUID organiserId;
    private String organiserName;
    private UUID ownerId;
    private String ownerName;          // attendee — the name the organiser sees on the door list

    // --- Money (what this single seat cost, not the whole booking) ---
    private BigDecimal pricePaid;
    private String currency;
    private String paymentStatus;      // mirrors the booking: PENDING / PAID / REFUNDED / …

    // --- Admission ---
    private String status;             // VALID / CHECKED_IN / CANCELLED
    private LocalDateTime checkedInAt;

    private LocalDateTime createdAt;
}
