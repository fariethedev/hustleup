package com.hustleup.marketplace.shop.dto;

import com.hustleup.marketplace.shop.model.ShopServiceSlot;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

/** One bookable time slot, as sent to the client. */
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ShopServiceSlotDto {

    private UUID id;
    private UUID shopServiceId;
    private UUID shopId;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private boolean booked;
    /** Filled in only where the caller already has it to hand — see ShopServiceController. */
    private String serviceName;

    public static ShopServiceSlotDto from(ShopServiceSlot s) {
        if (s == null) return new ShopServiceSlotDto();
        return ShopServiceSlotDto.builder()
                .id(s.getId())
                .shopServiceId(s.getShopServiceId())
                .shopId(s.getShopId())
                .startTime(s.getStartTime())
                .endTime(s.getEndTime())
                .booked(s.isBooked())
                .build();
    }
}
