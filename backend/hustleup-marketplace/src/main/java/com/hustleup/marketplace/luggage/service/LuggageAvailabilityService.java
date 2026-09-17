package com.hustleup.marketplace.luggage.service;

import com.hustleup.marketplace.booking.repository.BookingRepository;
import com.hustleup.marketplace.listing.model.Listing;
import com.hustleup.marketplace.listing.model.ListingType;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;

/**
 * How much of a LUGGAGE listing's carrying weight is still buyable.
 *
 * <h2>Why this mirrors EventAvailabilityService</h2>
 * <p>Same shape, same reason: the listing page has to show "12kg left" and the purchase
 * path has to refuse the 13th kilogram, and answering that question twice in two files is
 * how a listing page advertises space the checkout then refuses. Both read from here.
 *
 * <h2>Kilograms in flight</h2>
 * <p>A kilogram is only truly sold once Stripe confirms the charge, so counting paid
 * bookings alone would leave the gap between "pressed buy" and "payment cleared" invisible
 * — two people could both be told there was room for the last 5kg at the same moment.
 * {@link BookingRepository#sumHeldSeats} already answers exactly this for any listing (the
 * name is EVENT-era, the query is generic), so it is reused rather than duplicated.
 */
@Service
@RequiredArgsConstructor
public class LuggageAvailabilityService {

    private final BookingRepository bookingRepository;

    /** How long an unpaid booking holds its kilograms — same window EVENT holds use. */
    private static final Duration HOLD = Duration.ofMinutes(20);

    /**
     * A read of one trip's remaining space, at this moment.
     *
     * @param capacityKg total kg the traveller offered, or null if uncapped
     * @param soldKg     kg actually paid for
     * @param heldKg     kg inside a checkout that has not yet paid
     * @param remainingKg kg still buyable, or null when uncapped
     */
    public record Availability(Integer capacityKg, int soldKg, int heldKg, Integer remainingKg) {
        /** Whether {@code kg} more can be bought right now. */
        public boolean canTake(int kg) {
            return remainingKg == null || kg <= remainingKg;
        }
    }

    /** Reads the remaining space for one listing. Returns an uncapped, always-buyable answer for anything that isn't LUGGAGE. */
    public Availability read(Listing listing) {
        if (listing == null || listing.getListingType() != ListingType.LUGGAGE) {
            return new Availability(null, 0, 0, null);
        }

        Integer capacity = listing.getLuggageCapacityKg();
        int sold = (int) bookingRepository.sumSoldQuantity(listing.getId());
        Long heldRaw = bookingRepository.sumHeldSeats(listing.getId(), LocalDateTime.now().minus(HOLD));
        int held = heldRaw == null ? 0 : heldRaw.intValue();

        // A capacity of zero is a real, different statement from null (uncapped) — the
        // traveller said no space at all, not "I haven't said". Both clamp at zero rather
        // than going negative if sold+held ever overtakes a capacity lowered after the fact.
        Integer remaining = capacity == null ? null : Math.max(0, capacity - sold - held);
        return new Availability(capacity, sold, held, remaining);
    }

    /**
     * The message to refuse a purchase with, or null when it may go ahead.
     *
     * @param kg kilograms the buyer is trying to book
     */
    public String refuse(Listing listing, int kg) {
        if (kg < 1) return "Choose at least 1kg.";
        Availability availability = read(listing);
        if (availability.remainingKg() != null && kg > availability.remainingKg()) {
            int left = availability.remainingKg();
            return left <= 0
                    ? "No luggage space left on this trip."
                    : "Only " + left + "kg left on this trip.";
        }
        return null;
    }
}
