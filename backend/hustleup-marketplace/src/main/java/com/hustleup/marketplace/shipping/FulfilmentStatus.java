package com.hustleup.marketplace.shipping;

/**
 * Where an order physically is, from the moment it is paid for to the moment the buyer
 * has it.
 *
 * <p><b>Why this is separate from the order's own status.</b> {@code BookingStatus} and
 * {@link com.hustleup.marketplace.shop.model.ShopOrder.ShopOrderStatus} answer a
 * commercial question — has this deal been agreed, paid for, cancelled, refunded. Neither
 * answers the question a buyer actually asks after paying: <em>where is my stuff?</em>
 * Overloading them to carry both would mean a single field that a refund and a courier
 * hand-off both compete to write.
 *
 * <p>Not every status applies to every order. The legal sequence is defined per shipping
 * method by {@link ShippingMethod#steps()} — a parcel-locker order passes through
 * {@link #READY_FOR_PICKUP} and ends {@link #COLLECTED}, a courier order passes through
 * {@link #OUT_FOR_DELIVERY} and ends {@link #DELIVERED}. That is what lets the seller's
 * update control offer only the steps that make sense for how they are actually sending it.
 */
public enum FulfilmentStatus {

    /** The order exists but no money has arrived. Nothing is owed to the buyer yet. */
    AWAITING_PAYMENT,

    /** Payment cleared. The seller now owes the buyer the goods; the clock starts here. */
    CONFIRMED,

    /** Seller is packing/making it. Set by the seller, not by the payment webhook. */
    PREPARING,

    /** Handed to a carrier. This is the step that carries a tracking number. */
    SHIPPED,

    /** With the courier for the final leg, or the seller is on their way with it. */
    OUT_FOR_DELIVERY,

    /** Waiting for the buyer — in a parcel locker, or at the seller's collection point. */
    READY_FOR_PICKUP,

    /** In the buyer's hands via a carrier or the seller. Terminal. */
    DELIVERED,

    /** In the buyer's hands because they went and got it. Terminal. */
    COLLECTED,

    /** Fulfilment stopped. Reachable from any step, and never offered as a "next" step. */
    CANCELLED;

    /** True once the buyer has the goods, by either route — nothing more is owed. */
    public boolean isComplete() {
        return this == DELIVERED || this == COLLECTED;
    }
}
