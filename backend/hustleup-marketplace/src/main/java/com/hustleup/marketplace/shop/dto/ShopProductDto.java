package com.hustleup.marketplace.shop.dto;

import com.hustleup.marketplace.shop.model.ShopProduct;
import lombok.*;

import java.math.BigDecimal;
import java.util.UUID;

/** One item on a shop's shelf, as sent to the client. */
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ShopProductDto {

    private UUID id;
    private UUID shopId;
    private String name;
    private String description;
    private BigDecimal price;
    private String currency;
    private String category;
    private String imageUrl;
    private int sortOrder;

    public static ShopProductDto from(ShopProduct p) {
        if (p == null) return new ShopProductDto();
        return ShopProductDto.builder()
                .id(p.getId())
                .shopId(p.getShopId())
                .name(p.getName())
                .description(p.getDescription())
                .price(p.getPrice())
                .currency(p.getCurrency())
                .category(p.getCategory())
                .imageUrl(p.getImageUrl())
                .sortOrder(p.getSortOrder())
                .build();
    }
}
