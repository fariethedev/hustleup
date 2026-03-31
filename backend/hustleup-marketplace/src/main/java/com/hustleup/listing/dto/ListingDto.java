package com.hustleup.listing.dto;

import com.hustleup.listing.model.Listing;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

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
                .mediaUrls(parseMediaUrls(listing.getMediaUrls()))
                .status(listing.getStatus().name())
                .createdAt(listing.getCreatedAt())
                .build();
    }

    private static List<String> parseMediaUrls(String mediaUrls) {
        if (mediaUrls == null || mediaUrls.isBlank()) {
            return List.of();
        }

        return Arrays.stream(mediaUrls.split(","))
                .map(String::trim)
                .map(value -> value.replace("[", "").replace("]", "").replace("\"", ""))
                .filter(value -> !value.isBlank())
                .collect(Collectors.toList());
    }
}
