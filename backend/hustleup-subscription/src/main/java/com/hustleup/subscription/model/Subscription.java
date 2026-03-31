package com.hustleup.subscription.model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "subscriptions")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Subscription {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "seller_id", nullable = false, unique = true)
    private UUID sellerId;

    @Builder.Default
    private String plan = "FREE";

    @Builder.Default
    private String status = "ACTIVE";

    @Column(name = "price_per_month", precision = 12, scale = 4)
    @Builder.Default
    private BigDecimal pricePerMonth = new BigDecimal("20.00");

    @Builder.Default
    private String currency = "ZAR";

    @Column(name = "started_at")
    @Builder.Default
    private LocalDateTime startedAt = LocalDateTime.now();

    @Column(name = "expires_at")
    private LocalDateTime expiresAt;
}
