package com.hustleup.marketplace.ticket.service;

import com.hustleup.marketplace.booking.repository.BookingRepository;
import com.hustleup.marketplace.listing.model.Listing;
import com.hustleup.marketplace.listing.model.ListingType;
import com.hustleup.marketplace.ticket.repository.EventTicketRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;

/**
 * Whether an event can be bought into right now, and for how many seats.
 *
 * <h2>Why this is one class and not two checks</h2>
 * <p>The same question is asked in two places: the listing page, to decide whether to draw
 * "12 left" or a dead SOLD OUT button, and the checkout, to decide whether to actually take
 * the money. Answering it twice in two files is how a listing page cheerfully advertises
 * seats that the purchase path then refuses — or worse, the other way round. Both callers
 * go through here, so they cannot disagree.
 *
 * <h2>Seats in flight</h2>
 * <p>A ticket only exists once Stripe confirms the charge, so counting issued tickets alone
 * would make the gap between "pressed buy" and "payment cleared" invisible. Two people
 * taking the last four seats at the same moment would both be told there was room, and one
 * would discover otherwise at the door. Unpaid bookings therefore hold their seats — but
 * only for {@link #HOLD} minutes, after which an abandoned checkout releases them rather
 * than keeping a live event sold out forever.
 */
@Service
@RequiredArgsConstructor
public class EventAvailabilityService {

    private final EventTicketRepository ticketRepository;
    private final BookingRepository bookingRepository;

    /**
     * How long an unpaid booking keeps its seats.
     *
     * <p>Long enough to finish a Stripe Checkout without being timed out mid-card-entry,
     * short enough that a browser closed on the payment page does not strand seats for the
     * rest of the sale.
     */
    private static final Duration HOLD = Duration.ofMinutes(20);

    /** Why an event is or is not buyable. The client renders one of these per state. */
    public enum SalesState {
        /** Buyable now. */
        ON_SALE,
        /** Capacity reached, counting seats held by checkouts in flight. */
        SOLD_OUT,
        /** Has a capacity, and the organiser set it to zero. */
        NOT_ON_SALE,
        /** {@code salesOpenAt} is in the future. */
        NOT_YET_ON_SALE,
        /** {@code salesCloseAt} has passed. */
        SALES_CLOSED,
        /** The event itself has already started. */
        EVENT_PASSED
    }

    /**
     * A read of an event's door, at this moment.
     *
     * @param capacity  seats the organiser set, or null for an uncapped event
     * @param sold      tickets actually issued — i.e. paid for
     * @param held      seats inside a checkout that has not yet paid
     * @param remaining seats still buyable, or null when the event is uncapped
     */
    public record Availability(Integer capacity, int sold, int held, Integer remaining,
                               SalesState state, String reason) {

        public boolean isBuyable() {
            return state == SalesState.ON_SALE;
        }

        /** Whether {@code seats} more can be bought right now. */
        public boolean canTake(int seats) {
            return isBuyable() && (remaining == null || seats <= remaining);
        }
    }

    /**
     * Reads the door for one event.
     *
     * <p>Order matters. A sold-out event whose sales have also closed is reported as closed,
     * because that is the thing the organiser did — and "sold out" would be a claim about
     * demand that may not be true.
     */
    public Availability read(Listing listing) {
        if (listing == null || listing.getListingType() != ListingType.EVENT) {
            return new Availability(null, 0, 0, null, SalesState.ON_SALE, null);
        }

        LocalDateTime now = LocalDateTime.now();
        Integer capacity = listing.getEventCapacity();

        int sold = (int) ticketRepository.countByListingId(listing.getId());
        Long heldRaw = bookingRepository.sumHeldSeats(listing.getId(), now.minus(HOLD));
        int held = heldRaw == null ? 0 : heldRaw.intValue();

        Integer remaining = capacity == null ? null : Math.max(0, capacity - sold - held);

        // Timing first: an organiser closing sales, or the night simply having happened, is a
        // more accurate answer than anything about seat counts.
        if (listing.getEventStartsAt() != null && listing.getEventStartsAt().isBefore(now)) {
            return new Availability(capacity, sold, held, remaining, SalesState.EVENT_PASSED,
                    "This event has already taken place.");
        }
        if (listing.getSalesCloseAt() != null && listing.getSalesCloseAt().isBefore(now)) {
            return new Availability(capacity, sold, held, remaining, SalesState.SALES_CLOSED,
                    "Ticket sales for this event have closed.");
        }
        if (listing.getSalesOpenAt() != null && listing.getSalesOpenAt().isAfter(now)) {
            return new Availability(capacity, sold, held, remaining, SalesState.NOT_YET_ON_SALE,
                    "Tickets go on sale " + listing.getSalesOpenAt() + ".");
        }

        // A capacity of zero is not "uncapped" — null is. Zero is an organiser saying nobody
        // may come, and is reported as its own state so the page does not read "sold out" for
        // an event that never had a seat to sell.
        if (capacity != null && capacity <= 0) {
            return new Availability(capacity, sold, held, 0, SalesState.NOT_ON_SALE,
                    "This event is not selling tickets.");
        }
        if (remaining != null && remaining <= 0) {
            return new Availability(capacity, sold, held, 0, SalesState.SOLD_OUT,
                    "This event is sold out.");
        }

        return new Availability(capacity, sold, held, remaining, SalesState.ON_SALE, null);
    }

    /**
     * The message to refuse a purchase with, or null when it may go ahead.
     *
     * <p>Returns prose rather than a boolean because every caller needs to tell the buyer
     * why — "sold out", "sales closed" and "only 2 left" are three different things to do
     * next, and collapsing them into false loses the only useful part.
     */
    public String refuse(Listing listing, int seats) {
        Availability availability = read(listing);
        if (!availability.isBuyable()) return availability.reason();
        if (seats < 1) return "Choose at least one ticket.";
        if (availability.remaining() != null && seats > availability.remaining()) {
            int left = availability.remaining();
            return left == 1
                    ? "Only 1 ticket left for this event."
                    : "Only " + left + " tickets left for this event.";
        }
        return null;
    }
}
