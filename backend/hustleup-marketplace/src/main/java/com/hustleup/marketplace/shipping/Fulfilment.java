package com.hustleup.marketplace.shipping;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * The delivery half of an order: how it is being sent, what the buyer paid to have it
 * sent, and where it has got to.
 *
 * <p><b>Why an {@code @Embeddable} rather than fields on each entity.</b> The platform has
 * two unrelated order entities — {@link com.hustleup.marketplace.booking.model.Booking} for
 * marketplace listings and {@link com.hustleup.marketplace.shop.model.ShopOrder} for
 * storefront products. A buyer does not care which one they happened to buy through, so
 * both have to answer "where is my order?" identically. Embedding one value object gives
 * both tables the same columns, both APIs the same JSON shape, and
 * {@link ShipmentService} one thing to update — instead of two parallel sets of fields
 * that drift the first time one of them gains a column.
 *
 * <p><b>Snapshot, not a reference.</b> {@code shippingMethod} and {@code shippingPrice}
 * are copied from the listing or product at purchase time, for the same reason
 * {@code ShopOrder} snapshots the product name and price: a seller switching from courier
 * to collection next week must not rewrite what someone already bought and paid postage on.
 */
@Embeddable
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class Fulfilment {

    /** How the seller said they would send it, as it stood when the order was placed. */
    @Enumerated(EnumType.STRING)
    @Column(name = "shipping_method", length = 32)
    private ShippingMethod shippingMethod;

    /** What the buyer was charged for postage, on top of the goods. Null means free. */
    @Column(name = "shipping_price", precision = 12, scale = 2)
    private BigDecimal shippingPrice;

    /**
     * Where the order has got to.
     *
     * <p>Starts {@link FulfilmentStatus#AWAITING_PAYMENT} and is moved to
     * {@link FulfilmentStatus#CONFIRMED} by the Stripe webhook, never by the seller — the
     * tracking timeline should only ever start once money has actually arrived.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "fulfilment_status", length = 32)
    private FulfilmentStatus fulfilmentStatus;

    /** Carrier name as the seller typed it, e.g. "InPost", "DPD". */
    @Column(name = "tracking_carrier", length = 80)
    private String carrier;

    /** Consignment/parcel number the buyer can quote to the carrier. */
    @Column(name = "tracking_number", length = 120)
    private String trackingNumber;

    /** Direct link to the carrier's tracking page, if the seller pasted one. */
    @Column(name = "tracking_url", length = 512)
    private String trackingUrl;

    /**
     * Where the buyer collects: a locker's code and address, or the seller's pickup point.
     * Only meaningful for methods whose track passes through
     * {@link FulfilmentStatus#READY_FOR_PICKUP}.
     */
    @Column(name = "dropoff_point", length = 255)
    private String dropoffPoint;

    /** The seller's own words on the latest update — shown to the buyer verbatim. */
    @Column(name = "shipping_note", columnDefinition = "TEXT")
    private String note;

    /** Seller's estimate, so the buyer has something to expect rather than silence. */
    @Column(name = "estimated_delivery")
    private LocalDate estimatedDelivery;

    /** Stamped the first time the order reaches SHIPPED or OUT_FOR_DELIVERY. */
    @Column(name = "shipped_at")
    private LocalDateTime shippedAt;

    /** Stamped when it reaches DELIVERED or COLLECTED. */
    @Column(name = "delivered_at")
    private LocalDateTime deliveredAt;

    /** Last time anything here changed — drives "updated 2h ago" on the tracker. */
    @Column(name = "fulfilment_updated_at")
    private LocalDateTime updatedAt;

    /** Method with a usable default, for orders predating the shipping fields. */
    public ShippingMethod methodOrDefault() {
        return shippingMethod != null ? shippingMethod : ShippingMethod.NONE;
    }

    /** Postage as a number, so callers can add it to a total without null-checking. */
    public BigDecimal shippingPriceOrZero() {
        return shippingPrice != null ? shippingPrice : BigDecimal.ZERO;
    }
}
