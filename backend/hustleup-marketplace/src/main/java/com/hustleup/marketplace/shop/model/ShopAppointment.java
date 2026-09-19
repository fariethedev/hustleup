/**
 * JPA entity for a customer's booking of one {@link ShopServiceSlot}.
 *
 * <h3>Why this carries no payment status</h3>
 * <p>Unlike a {@code Booking} or a {@code ShopOrder}, an appointment is a reservation of the
 * owner's time, not a charge on the platform's Stripe balance — a salon overwhelmingly still
 * takes payment in person or on its own card reader when the customer arrives, and forcing an
 * upfront platform charge onto every haircut would refuse the common case rather than serve
 * it. What the platform is actually offering here is the calendar: a slot that cannot be
 * double-booked, and a notification the owner doesn't have to be watching a phone to catch.
 * Payment, if any, stays between the two of them.
 *
 * <p>Customer contact fields are a snapshot at booking time, same reasoning as
 * {@code Booking.customerName}/{@code customerEmail}/{@code customerPhone}: they are what the
 * owner actually needs (reach this person if the slot moves), and they survive the customer
 * later changing their profile.
 */
package com.hustleup.marketplace.shop.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "shop_appointments", indexes = {
        @Index(name = "idx_shop_appts_shop", columnList = "shop_id"),
        @Index(name = "idx_shop_appts_buyer", columnList = "buyer_id"),
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ShopAppointment {

    public enum Status { CONFIRMED, COMPLETED, CANCELLED, NO_SHOW }

    @Id
    @org.hibernate.annotations.UuidGenerator
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(columnDefinition = "VARCHAR(36)")
    private UUID id;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "shop_service_id", nullable = false, columnDefinition = "VARCHAR(36)")
    private UUID shopServiceId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "shop_id", nullable = false, columnDefinition = "VARCHAR(36)")
    private UUID shopId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "slot_id", nullable = false, columnDefinition = "VARCHAR(36)")
    private UUID slotId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "buyer_id", nullable = false, columnDefinition = "VARCHAR(36)")
    private UUID buyerId;

    @Column(name = "customer_name", length = 120)
    private String customerName;

    @Column(name = "customer_email", length = 255)
    private String customerEmail;

    @Column(name = "customer_phone", length = 40)
    private String customerPhone;

    @Column(length = 1000)
    private String notes;

    // Snapshotted from the service at booking time, same reasoning as everywhere else this
    // pattern appears: a seller changing a price or duration tomorrow must not rewrite what
    // a customer already booked at today's terms.
    @Column(name = "service_name", length = 120)
    private String serviceName;

    @Column(name = "price", precision = 12, scale = 2)
    private java.math.BigDecimal price;

    @Column(name = "currency", length = 3)
    private String currency;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private Status status = Status.CONFIRMED;

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
