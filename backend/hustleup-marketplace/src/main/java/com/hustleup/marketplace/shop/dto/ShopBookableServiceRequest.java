package com.hustleup.marketplace.shop.dto;

import lombok.*;

import java.math.BigDecimal;

/** Incoming service create/update payload; null fields are left unchanged on update. */
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class ShopBookableServiceRequest {
    private String name;
    private String description;
    private Integer durationMinutes;
    private BigDecimal price;
    private String currency;
    private Boolean active;
    private Integer sortOrder;
}
