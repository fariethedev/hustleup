package com.hustleup.marketplace.viewing;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.UUID;

/** A would-be tenant's appointment to view a RENTAL listing. */
@Entity
@Table(name = "rental_viewings")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class RentalViewing {
    public enum Status { BOOKED, CANCELLED }

    @Id @org.hibernate.annotations.UuidGenerator
    @JdbcTypeCode(SqlTypes.VARCHAR) @Column(columnDefinition = "VARCHAR(36)")
    private UUID id;

    @JdbcTypeCode(SqlTypes.VARCHAR) @Column(name = "listing_id", nullable = false, columnDefinition = "VARCHAR(36)")
    private UUID listingId;

    @JdbcTypeCode(SqlTypes.VARCHAR) @Column(name = "seller_id", nullable = false, columnDefinition = "VARCHAR(36)")
    private UUID sellerId;

    @JdbcTypeCode(SqlTypes.VARCHAR) @Column(name = "viewer_id", nullable = false, columnDefinition = "VARCHAR(36)")
    private UUID viewerId;

    @Column(name = "scheduled_at", nullable = false)
    private LocalDateTime scheduledAt;

    @Column(length = 500)
    private String note;

    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20)
    @Builder.Default
    private Status status = Status.BOOKED;

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at", nullable = false)
    @Builder.Default
    private LocalDateTime updatedAt = LocalDateTime.now();
}
