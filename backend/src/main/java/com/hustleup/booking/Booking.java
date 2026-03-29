package com.hustleup.booking;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "bookings")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Booking {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "buyer_id", nullable = false)
    private UUID buyerId;

    @Column(name = "seller_id", nullable = false)
    private UUID sellerId;

    @Column(name = "listing_id", nullable = false)
    private UUID listingId;

    @Column(name = "offered_price", precision = 12, scale = 4)
    private BigDecimal offeredPrice;

    @Column(name = "counter_price", precision = 12, scale = 4)
    private BigDecimal counterPrice;

    @Column(name = "agreed_price", precision = 12, scale = 4)
    private BigDecimal agreedPrice;

    @Builder.Default
    private String currency = "GBP";

    @Column(name = "scheduled_at")
    private LocalDateTime scheduledAt;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private BookingStatus status = BookingStatus.POSTED;

    @Column(name = "cancel_reason")
    private String cancelReason;

    @Version
    @Builder.Default
    private Long version = 0L;

    @Column(name = "created_at")
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at")
    @Builder.Default
    private LocalDateTime updatedAt = LocalDateTime.now();
}
