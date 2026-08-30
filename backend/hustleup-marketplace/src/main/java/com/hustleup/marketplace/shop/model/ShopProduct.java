/**
 * JPA entity for one item in a shop's own catalogue.
 *
 * <p>Shop products are deliberately separate from {@link com.hustleup.marketplace.listing.model.Listing}.
 * A listing is a standalone marketplace post that can be searched, saved, swapped and booked;
 * a shop product is merchandise on a storefront shelf, bought through the shop's own
 * negotiate → checkout flow. A seller's shop page shows both: this catalogue, plus their
 * marketplace listings in a separate section.
 */
package com.hustleup.marketplace.shop.model;

import com.hustleup.marketplace.shipping.ShippingMethod;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "shop_products", indexes = @Index(name = "idx_shop_products_shop", columnList = "shop_id"))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ShopProduct {

    @Id
    @org.hibernate.annotations.UuidGenerator
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(columnDefinition = "VARCHAR(36)")
    private UUID id;

    /** Owning shop. Ownership checks resolve the shop first, then verify its ownerId. */
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "shop_id", nullable = false, columnDefinition = "VARCHAR(36)")
    private UUID shopId;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(length = 1000)
    private String description;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal price;

    /** ISO code; PLN is the platform's base currency. */
    @Column(nullable = false, length = 3)
    @Builder.Default
    private String currency = "PLN";

    /** Seller-defined shelf, e.g. "Fruits" or "Hoodies" — drives the shop page's filter bar. */
    @Column(length = 60)
    private String category;

    @Column(name = "image_url", length = 512)
    private String imageUrl;

    /** Sellers order their own shelf; lower sorts first. */
    @Column(name = "sort_order", nullable = false)
    @Builder.Default
    private int sortOrder = 0;

    /**
     * How the seller sends this item, and what they charge to send it.
     *
     * <p>Set on the shelf rather than negotiated per order, because it decides what the
     * buyer is charged at checkout and which tracking steps the seller is later offered.
     * Both are snapshotted onto every {@link ShopOrder} at purchase time.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "shipping_method", length = 32)
    @Builder.Default
    private ShippingMethod shippingMethod = ShippingMethod.PICKUP;

    /** Postage charged on top of {@link #price}. Zero for free delivery or collection. */
    @Column(name = "shipping_price", precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal shippingPrice = BigDecimal.ZERO;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = createdAt;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
