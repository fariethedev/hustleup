package com.hustleup.listing;

import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ListingDto {
    private UUID id;
    private UUID sellerId;
    private String sellerName;
    private String sellerAvatarUrl;
    private boolean sellerVerified;
    private String title;
    private String description;
    private String listingType;
    private BigDecimal price;
    private String currency;
    private boolean negotiable;
    private String locationCity;
    private String meta;
    private List<String> mediaUrls;
    private String status;
    private double avgRating;
    private int reviewCount;
    private LocalDateTime createdAt;

    public static ListingDto fromEntity(Listing listing) {
        return ListingDto.builder()
                .id(listing.getId())
                .sellerId(listing.getSellerId())
                .title(listing.getTitle())
                .description(listing.getDescription())
                .listingType(listing.getListingType().name())
                .price(listing.getPrice())
                .currency(listing.getCurrency())
                .negotiable(listing.isNegotiable())
                .locationCity(listing.getLocationCity())
                .meta(listing.getMeta())
                .mediaUrls(listing.getMediaUrls() != null ?
                        Arrays.asList(listing.getMediaUrls().split(",")) :
                        List.of())
                .status(listing.getStatus().name())
                .createdAt(listing.getCreatedAt())
                .build();
    }
}
