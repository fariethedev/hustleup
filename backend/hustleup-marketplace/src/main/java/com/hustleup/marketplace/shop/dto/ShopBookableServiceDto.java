package com.hustleup.marketplace.shop.dto;

import com.hustleup.marketplace.shop.model.ShopBookableService;
import lombok.*;

import java.math.BigDecimal;
import java.util.UUID;

/** One entry on an appointment-based shop's menu, as sent to the client. */
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ShopBookableServiceDto {

    private UUID id;
    private UUID shopId;
    private String name;
    private String description;
    private int durationMinutes;
    private BigDecimal price;
    private String currency;
    private boolean active;
    private int sortOrder;

    public static ShopBookableServiceDto from(ShopBookableService s) {
        if (s == null) return new ShopBookableServiceDto();
        return ShopBookableServiceDto.builder()
                .id(s.getId())
                .shopId(s.getShopId())
                .name(s.getName())
                .description(s.getDescription())
                .durationMinutes(s.getDurationMinutes())
                .price(s.getPrice())
                .currency(s.getCurrency())
                .active(s.isActive())
                .sortOrder(s.getSortOrder())
                .build();
    }
}
