/**
 * A single admission to an EVENT listing, issued to a buyer when their booking is confirmed.
 *
 * <p>One row is one seat. Buying three tickets in one transaction creates one
 * {@link com.hustleup.marketplace.booking.model.Booking} and three {@code EventTicket} rows, so
 * a group can be admitted one person at a time and the organiser's door count is accurate even
 * when only two of the three actually show up.
 *
 * <h3>How a ticket is proved at the door</h3>
 * <p>Each ticket carries two credentials:
 * <ul>
 *   <li>{@link #ticketCode} — short and human-readable (e.g. {@code HU-4F2A-91BC}). Printed on
 *       the ticket so an organiser with a flat phone battery can type it in manually.</li>
 *   <li>{@link #qrSecret} — a random string that never appears on screen as text. The QR code
 *       encodes {@code HUTKT:<ticketCode>:<qrSecret>}, so a scan proves the holder has the real
 *       ticket rather than just a code someone read out.</li>
 * </ul>
 * <p>Both are checked by {@link com.hustleup.marketplace.ticket.service.TicketService}. Neither
 * is a bearer token for the API — admission is always performed by the authenticated organiser,
 * so a leaked code can't be used by the holder to check themselves in.
 *
 * <h3>Denormalised ids</h3>
 * <p>{@code listingId}, {@code ownerId} and {@code organiserId} are all reachable by joining
 * through {@code bookingId}, but they are stored here directly: the two hot queries are "every
 * ticket for this event" (organiser's door list) and "every ticket I hold" (attendee's wallet),
 * and both should be a single indexed read rather than a join across the bookings table.
 * As elsewhere in this service, cross-module references are plain UUID columns rather than JPA
 * relationships (see {@link com.hustleup.marketplace.listing.model.Listing}).
 */
package com.hustleup.marketplace.ticket.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(
    name = "event_tickets",
    indexes = {
        // Organiser's door list and check-in stats for one event.
        @Index(name = "idx_event_tickets_listing", columnList = "listing_id"),
        // An attendee opening their ticket wallet.
        @Index(name = "idx_event_tickets_owner", columnList = "owner_id"),
        // Voiding every ticket attached to a cancelled booking.
        @Index(name = "idx_event_tickets_booking", columnList = "booking_id")
    }
)
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class EventTicket {

    @Id
    @org.hibernate.annotations.UuidGenerator
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(columnDefinition = "VARCHAR(36)")
    private UUID id;

    /** The booking this admission was issued against. */
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "booking_id", nullable = false, columnDefinition = "VARCHAR(36)")
    private UUID bookingId;

    /** The EVENT listing being attended. */
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "listing_id", nullable = false, columnDefinition = "VARCHAR(36)")
    private UUID listingId;

    /** The attendee — the buyer on the booking. Only they can see the QR credentials. */
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "owner_id", nullable = false, columnDefinition = "VARCHAR(36)")
    private UUID ownerId;

    /** The event's organiser — the seller on the listing. Only they can scan or list tickets. */
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "organiser_id", nullable = false, columnDefinition = "VARCHAR(36)")
    private UUID organiserId;

    /**
     * Human-readable admission code, unique across the platform (e.g. {@code HU-4F2A-91BC}).
     * The unique constraint is what makes a code safe to look up on its own during a scan.
     */
    @Column(name = "ticket_code", nullable = false, unique = true, length = 32)
    private String ticketCode;

    /**
     * Random secret embedded in the QR payload alongside the code. Not displayed as text, so a
     * photograph of the printed code alone is not enough to forge a scannable ticket.
     */
    @Column(name = "qr_secret", nullable = false, length = 64)
    private String qrSecret;

    /** Position within the booking — ticket 2 of 3. Purely for display on the ticket. */
    @Column(name = "ticket_number")
    @Builder.Default
    private Integer ticketNumber = 1;

    /** How many tickets the booking bought in total, so the ticket can read "2 of 3". */
    @Column(name = "tickets_in_booking")
    @Builder.Default
    private Integer ticketsInBooking = 1;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private TicketStatus status = TicketStatus.VALID;

    /** When the organiser scanned this ticket in. Null until admitted. */
    @Column(name = "checked_in_at")
    private LocalDateTime checkedInAt;

    /**
     * Which account performed the scan. Recorded separately from {@code organiserId} so that
     * door staff scanning on the organiser's behalf are still attributable in the future.
     */
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "checked_in_by", columnDefinition = "VARCHAR(36)")
    private UUID checkedInBy;

    @Column(name = "created_at")
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
