/**
 * JPA entity for one bookable service on an appointment-based shop's menu — a haircut, a
 * manicure, a massage. The appointment-shop counterpart of {@link ShopProduct}: a product is
 * merchandise on a shelf, this is a slice of the owner's time, priced and timed rather than
 * quantified.
 *
 * <p>Named {@code ShopBookableService} rather than {@code ShopService} because that name was
 * already taken — {@code com.hustleup.marketplace.shop.service.ShopService} is this module's
 * existing business-logic class, and the two living in sibling packages made every unqualified
 * reference to either one ambiguous.
 */
package com.hustleup.marketplace.shop.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "shop_services", indexes = @Index(name = "idx_shop_services_shop", columnList = "shop_id"))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ShopBookableService {

    @Id
    @org.hibernate.annotations.UuidGenerator
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(columnDefinition = "VARCHAR(36)")
    private UUID id;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "shop_id", nullable = false, columnDefinition = "VARCHAR(36)")
    private UUID shopId;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(length = 1000)
    private String description;

    /** How long one booking of this service holds the calendar for. */
    @Column(name = "duration_minutes", nullable = false)
    private int durationMinutes;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal price;

    @Column(nullable = false, length = 3)
    @Builder.Default
    private String currency = "PLN";

    /**
     * Off the menu without deleting it — a service with past appointments against it can't be
     * deleted outright (see the controller's delete guard), so this is how a seller retires
     * one they no longer offer.
     */
    @Column(nullable = false)
    @Builder.Default
    private boolean active = true;

    @Column(name = "sort_order", nullable = false)
    @Builder.Default
    private int sortOrder = 0;

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
