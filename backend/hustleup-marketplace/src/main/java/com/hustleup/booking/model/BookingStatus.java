/**
 * Represents the lifecycle state of a {@link Booking} in the HustleUp marketplace.
 *
 * <p>Bookings progress through a state machine. Transitions are enforced by
 * {@link com.hustleup.booking.service.BookingService}. Not all transitions are valid —
 * for example, a COMPLETED booking cannot move back to BOOKED.
 *
 * <p>The allowed transition graph is:
 * <pre>
 *   POSTED → INQUIRED → NEGOTIATING → BOOKED → COMPLETED
 *                  ↘              ↘         ↘
 *                CANCELLED     CANCELLED  CANCELLED
 * </pre>
 *
 * <p>In the database this enum is stored as its string name (e.g. {@code "BOOKED"}) via
 * {@link jakarta.persistence.EnumType#STRING} so the values are self-documenting in SQL queries.
 */
package com.hustleup.booking.model;

public enum BookingStatus {

    /**
     * The listing was viewed or a booking row was created, but no explicit request has been
     * submitted yet. This is the technical default state of a newly created {@link Booking}
     * entity before the buyer formally submits their inquiry.
     */
    POSTED,

    /**
     * The buyer has formally submitted a booking request to the seller.
     * The seller has not yet responded. The listing's asking price (or the buyer's custom
     * offered price) is recorded on the booking at this point.
     */
    INQUIRED,

    /**
     * The seller responded to the buyer's inquiry with a counter-offer price.
     * The booking's {@code counterPrice} field is set. The buyer must now either
     * accept (→ BOOKED) or cancel (→ CANCELLED).
     */
    NEGOTIATING,

    /**
     * Both parties have agreed on a price and the booking is confirmed.
     * The {@code agreedPrice} field is locked in. The buyer and seller should
     * arrange delivery of the service according to {@code scheduledAt}.
     * Payment processing (when integrated) would be triggered from this state.
     */
    BOOKED,

    /**
     * The seller has marked the service as fully delivered. The booking is now
     * closed. The buyer is eligible to leave a review — {@link com.hustleup.review.model.Review}
     * records are only valid when the parent booking is in this state.
     */
    COMPLETED,

    /**
     * Either the buyer or the seller cancelled before the service was delivered.
     * The {@code cancelReason} field on the booking entity records the stated reason.
     * Cancelled bookings are terminal — they cannot be resumed.
     */
    CANCELLED
}
