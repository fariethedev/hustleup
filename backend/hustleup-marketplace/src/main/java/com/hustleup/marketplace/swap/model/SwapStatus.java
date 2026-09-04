/**
 * Lifecycle states of a {@link SwapOffer}.
 *
 * <p>Deliberately smaller than {@link com.hustleup.marketplace.booking.model.BookingStatus}:
 * the proposer offers, the owner answers, and that is the whole negotiation.
 *
 * <p>This stays true now that offers can carry a cash top-up. The money is a <em>term</em>
 * of the agreement rather than a transaction the platform runs: like the handover of the
 * items themselves, it is settled directly between the two people. Nothing here moves
 * funds, and no state below means "paid" — adding one without a real payment leg behind it
 * would be a status that claims something the platform cannot actually know.
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
