package com.hustleup.marketplace.shop.model;

import com.hustleup.marketplace.shipping.Fulfilment;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * A purchase of a {@link ShopProduct} from a seller's storefront.
 *
 * <h2>Why shop orders are not Bookings</h2>
 * <p>A {@code Booking} is tied to a {@code Listing} by a non-null {@code listingId} and
 * carries a negotiation lifecycle — offer, counter-offer, acceptance. Storefront products
 * are a different entity entirely ({@link ShopProduct}), have no listing row, and are
 * bought outright at the shelf price. Forcing them through Booking would mean a
 * {@code listingId} pointing at nothing and a state machine none of them ever use.
 *
 * <h2>Snapshot fields</h2>
 * <p>{@code productName}, {@code productImageUrl} and {@code unitPrice} are copied at
 * purchase time rather than read back through {@code productId}. An order is a record of
 * what someone actually bought for what they actually paid: a seller renaming a product,
 * swapping its photo, or repricing it must not rewrite orders already placed.
 */
@Entity
@Table(name = "shop_orders")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor @Builder
public class ShopOrder {

    /**
     * Fulfilment state.
     *
     * <p>Starts at {@code AWAITING_PAYMENT} rather than a "placed" state: until Stripe
     * confirms the charge, nothing has really been bought. The webhook moves it to
     * {@code PAID}, which is the point the seller owes the buyer something.
     */
    public enum ShopOrderStatus { AWAITING_PAYMENT, PAID, FULFILLED, CANCELLED, REFUNDED }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "buyer_id", nullable = false)
    private UUID buyerId;

    @Column(name = "shop_id", nullable = false)
    private UUID shopId;

    /** The shop's owner — who fulfils the order and is eventually paid for it. */
    @Column(name = "seller_id", nullable = false)
    private UUID sellerId;

    @Column(name = "product_id", nullable = false)
    private UUID productId;

    // ---- Snapshot at purchase time (see class javadoc) ----------------------

    @Column(name = "product_name", nullable = false)
    private String productName;

    @Column(name = "product_image_url", length = 1024)
    private String productImageUrl;

    @Column(name = "unit_price", precision = 12, scale = 2, nullable = false)
    private BigDecimal unitPrice;

    @Column(nullable = false)
    @Builder.Default
    private int quantity = 1;

    @Column(name = "total_price", precision = 12, scale = 2, nullable = false)
    private BigDecimal totalPrice;

    /**
     * Currency for this order.
     *
     * <p>{@link ShopProduct} carries a bare price with no currency, so the value is fixed
     * at the platform default here rather than guessed per-shop. Storing it on the order
     * anyway means adding per-shop currencies later cannot silently reinterpret the amount
     * on orders already placed.
     */
    @Column(nullable = false)
    @Builder.Default
    private String currency = "PLN";

    // ---- Delivery / contact -------------------------------------------------

    @Column(name = "customer_name")
    private String customerName;

    @Column(name = "customer_email")
    private String customerEmail;

    @Column(name = "customer_phone")
    private String customerPhone;

    @Column(columnDefinition = "TEXT")
    private String notes;

    // ---- Payment ------------------------------------------------------------

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private ShopOrderStatus status = ShopOrderStatus.AWAITING_PAYMENT;

    /** Set by the webhook once a PaymentIntent exists; null until the buyer pays. */
    @Column(name = "payment_intent_id")
    private String paymentIntentId;

    // ---- Delivery -----------------------------------------------------------

    /**
     * How this order reaches the buyer and where it has got to.
     *
     * <p>The shipping method and price are snapshotted from {@link ShopProduct} at purchase
     * time for the same reason the name and unit price above are: a seller who switches
     * from courier to collection next month must not rewrite what someone already paid
     * postage for. Everything else here is written by the seller's tracking updates.
     *
     * <p>Note {@code totalPrice} above stays the goods total — postage is deliberately kept
     * out of it so a seller's sales figures are not inflated by carrier charges.
     */
    @Embedded
    @Builder.Default
    private Fulfilment fulfilment = new Fulfilment();

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    /**
     * The delivery state, never null.
     *
     * <p>Hibernate materialises an embeddable as {@code null} when every one of its columns
     * is null, which is what every order placed before this feature looks like.
     */
    public Fulfilment getFulfilment() {
        if (fulfilment == null) fulfilment = new Fulfilment();
        return fulfilment;
    }

    /** Goods plus postage — what the buyer actually pays. */
    public BigDecimal grandTotal() {
        return (totalPrice != null ? totalPrice : BigDecimal.ZERO)
                .add(getFulfilment().shippingPriceOrZero());
    }
}
