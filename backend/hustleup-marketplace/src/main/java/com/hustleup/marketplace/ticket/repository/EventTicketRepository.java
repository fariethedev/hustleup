/**
 * Spring Data repository for {@link EventTicket}.
 *
 * <p>Spring generates the implementation at runtime from the method names, so there is no SQL
 * to maintain here. Every finder below backs one concrete screen or action:
 * the attendee's ticket wallet, the organiser's door list, a door scan, and voiding the tickets
 * attached to a cancelled booking.
 */
package com.hustleup.marketplace.ticket.repository;

import com.hustleup.marketplace.ticket.model.EventTicket;
import com.hustleup.marketplace.ticket.model.TicketStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface EventTicketRepository extends JpaRepository<EventTicket, UUID> {

    /** Every ticket an attendee holds, newest first — powers the ticket wallet. */
    List<EventTicket> findByOwnerIdOrderByCreatedAtDesc(UUID ownerId);

    /** Every ticket issued for one event, oldest first — the organiser's door list in sale order. */
    List<EventTicket> findByListingIdOrderByCreatedAtAsc(UUID listingId);

    /** Every ticket across all of an organiser's events, newest first. */
    List<EventTicket> findByOrganiserIdOrderByCreatedAtDesc(UUID organiserId);

    /** The tickets issued against one booking — used to void them all when it is cancelled. */
    List<EventTicket> findByBookingId(UUID bookingId);

    /** Resolves a scanned or manually typed admission code. */
    Optional<EventTicket> findByTicketCode(String ticketCode);

    /** Whether a freshly generated code is already taken (see the code generator's retry loop). */
    boolean existsByTicketCode(String ticketCode);

    /** Admitted-so-far count for an event, shown live on the organiser's door screen. */
    long countByListingIdAndStatus(UUID listingId, TicketStatus status);

    /** Total tickets issued for an event, including cancelled ones. */
    long countByListingId(UUID listingId);
}
