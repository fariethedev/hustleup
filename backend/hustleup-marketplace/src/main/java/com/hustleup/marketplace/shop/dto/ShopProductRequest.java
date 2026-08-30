package com.hustleup.marketplace.shop.dto;

import lombok.*;

import java.math.BigDecimal;

/** Incoming product create/update payload; null fields are left unchanged on update. */
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class ShopProductRequest {
    private String name;
    private String description;
    private BigDecimal price;
    private String currency;
    private String category;
    private String imageUrl;
    private Integer sortOrder;
    /** ShippingMethod name; anything unrecognised is ignored rather than rejected. */
    private String shippingMethod;
    private BigDecimal shippingPrice;
}
