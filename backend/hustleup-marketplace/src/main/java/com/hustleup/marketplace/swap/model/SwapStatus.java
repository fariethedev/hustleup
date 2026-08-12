/**
 * Lifecycle states of a {@link SwapOffer}.
 *
 * <p>Deliberately smaller than {@link com.hustleup.marketplace.booking.model.BookingStatus}:
 * a swap has no payment leg, so there is nothing between "proposed" and "settled". The
 * proposer offers, the owner answers, and that is the whole negotiation.
 */
package com.hustleup.marketplace.swap.model;

public enum SwapStatus {

    /** Proposed and awaiting the target listing owner's answer. */
    PENDING,

    /** The owner said yes — this edge counts toward the public swap chain. */
    ACCEPTED,

    /** The owner said no. Kept (not deleted) so proposers can see the outcome. */
    DECLINED,

    /** The proposer pulled the offer before it was answered. */
    WITHDRAWN
}
