/**
 * JPA entity for one bookable time slot against a {@link ShopBookableService}.
 *
 * <p>The shop counterpart of {@link com.hustleup.marketplace.availability.model.Availability},
 * kept as its own table rather than reused: {@code Availability} is keyed to a marketplace
 * {@code Listing}, and a shop service is not a listing — retrofitting one shared table to
 * mean either would mean every read of it has to branch on which kind of id it is holding.
 * The shape is otherwise deliberately identical.
 */
package com.hustleup.marketplace.shop.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "shop_service_slots", indexes = {
        @Index(name = "idx_shop_slots_service", columnList = "shop_service_id"),
        @Index(name = "idx_shop_slots_shop", columnList = "shop_id"),
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ShopServiceSlot {

    @Id
    @org.hibernate.annotations.UuidGenerator
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(columnDefinition = "VARCHAR(36)")
    private UUID id;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "shop_service_id", nullable = false, columnDefinition = "VARCHAR(36)")
    private UUID shopServiceId;

    // Denormalised for "every slot across all my services" queries without a join, and so
    // ownership can be checked from the slot alone.
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "shop_id", nullable = false, columnDefinition = "VARCHAR(36)")
    private UUID shopId;

    @Column(name = "start_time", nullable = false)
    private LocalDateTime startTime;

    @Column(name = "end_time", nullable = false)
    private LocalDateTime endTime;

    // True once a customer has booked this slot — hidden from other customers, and cannot
    // be deleted by the owner until the appointment referencing it is cancelled.
    @Column(nullable = false)
    @Builder.Default
    private boolean booked = false;

    @Column(name = "created_at")
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
