package com.hustleup.marketplace.shop.dto;

import lombok.*;

/**
 * Incoming shop create/update payload.
 *
 * <p>Every field is nullable so the same shape works for PATCH: the service applies only the
 * fields that are present, leaving the rest untouched. Note what is <em>absent</em> — rating,
 * reviewCount and the counts are derived server-side and deliberately not accepted from the
 * client, so a seller cannot set their own rating.
 */
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class ShopRequest {
    private String name;
    private String category;
    private String tagline;
    private String description;
    private String bannerUrl;
    private String accentColor;
    private String city;
    private Boolean published;
}
