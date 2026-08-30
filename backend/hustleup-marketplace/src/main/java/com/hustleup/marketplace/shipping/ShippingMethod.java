package com.hustleup.marketplace.shipping;

import java.util.List;

import static com.hustleup.marketplace.shipping.FulfilmentStatus.*;

/**
 * How a seller sends the thing they sold.
 *
 * <p>Chosen by the seller when they post a listing or add a shop product, snapshotted onto
 * every order made against it, and from then on it decides two things:
 *
 * <ol>
 *   <li><b>What the seller is asked for.</b> {@link #steps()} is the ordered set of
 *       fulfilment states this method actually passes through, so the update control offers
 *       "Ready for pickup" to someone using a parcel locker and "Out for delivery" to
 *       someone using a courier, rather than one menu of every state that exists.</li>
 *   <li><b>Whether a tracking number means anything.</b> {@link #tracked()} is false for
 *       collection and for anything the seller hands over themselves — asking for a
 *       consignment number that cannot exist is how you get sellers typing "n/a" into a
 *       field the buyer is then shown.</li>
 * </ol>
 *
 * <p>The frontend mirrors this list for its own labels and timeline copy in
 * {@code frontend/src/utils/shipping.js}; this enum stays the authority on which
 * transitions are legal, since that is enforced server-side.
 */
public enum ShippingMethod {

    /** Buyer comes to the seller. No carrier, so no tracking number. */
    PICKUP("Collection in person", false,
            List.of(CONFIRMED, PREPARING, READY_FOR_PICKUP, COLLECTED)),

    /**
     * InPost/DHL-style locker drop — dominant in this market, and the only method with
     * both a carrier leg and a collection leg, hence the longest step list.
     */
    PARCEL_LOCKER("Parcel locker", true,
            List.of(CONFIRMED, PREPARING, SHIPPED, READY_FOR_PICKUP, COLLECTED)),

    /** Tracked courier to the buyer's door. */
    COURIER("Courier", true,
            List.of(CONFIRMED, PREPARING, SHIPPED, OUT_FOR_DELIVERY, DELIVERED)),

    /**
     * Standard post. Tracked in the sense that a seller can record a reference, but with
     * no "out for delivery" scan to report, so that step is absent.
     */
    POST("Post", true,
            List.of(CONFIRMED, PREPARING, SHIPPED, DELIVERED)),

    /** The seller drives it over themselves. No carrier, but there is a delivery run. */
    SELLER_DELIVERY("Delivered by the seller", false,
            List.of(CONFIRMED, PREPARING, OUT_FOR_DELIVERY, DELIVERED)),

    /** Files, codes, links. Nothing moves, so it goes straight from paid to sent. */
    DIGITAL("Digital delivery", false,
            List.of(CONFIRMED, DELIVERED)),

    /**
     * Nothing is shipped at all — a haircut, a lesson, a gig. Kept as an explicit choice
     * rather than a null so a service listing reads as "no shipping" on purpose, instead
     * of looking like a seller who forgot to answer.
     */
    NONE("No shipping needed", false,
            List.of(CONFIRMED, DELIVERED));

    private final String label;
    private final boolean tracked;
    private final List<FulfilmentStatus> steps;

    ShippingMethod(String label, boolean tracked, List<FulfilmentStatus> steps) {
        this.label = label;
        this.tracked = tracked;
        this.steps = steps;
    }

    public String label() {
        return label;
    }

    /** Whether a carrier and consignment number are meaningful for this method. */
    public boolean tracked() {
        return tracked;
    }

    /** The states this method passes through, in order. Never includes CANCELLED. */
    public List<FulfilmentStatus> steps() {
        return steps;
    }

    /** The state an order of this kind ends in once the buyer has it. */
    public FulfilmentStatus finalStep() {
        return steps.get(steps.size() - 1);
    }

    /**
     * Whether a seller may move an order of this kind to {@code target}.
     *
     * <p>Any step on this method's own track is allowed, in either direction, plus
     * {@link FulfilmentStatus#CANCELLED}. Backwards moves are deliberately permitted: a
     * seller who taps "Shipped" on the wrong order has no other way to take it back, and a
     * buyer is better served by a corrected timeline than a permanently wrong one.
     */
    public boolean allows(FulfilmentStatus target) {
        return target == CANCELLED || steps.contains(target);
    }

    /** Parses a client-supplied name, falling back to {@code null} rather than throwing. */
    public static ShippingMethod parse(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try {
            return valueOf(raw.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
