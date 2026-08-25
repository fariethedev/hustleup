package com.hustleup.marketplace.shop.dto;

import com.hustleup.marketplace.shop.model.Shop;
import lombok.*;

import java.util.List;
import java.util.UUID;

/**
 * A storefront as the client renders it — every field on the shop card and the shop page.
 *
 * <p>Split into three groups: what the owner typed (name → city), what the platform derives
 * and the owner cannot edit (rating, reviewCount, counts), and who owns it. Keeping the
 * derived values read-only here is what stops a seller from writing their own 5.0 rating.
 */
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ShopDto {

    private UUID id;
    private String slug;

    // ── Owner-editable ──
    private String name;
    private String category;
    private String tagline;
    private String description;
    private String bannerUrl;
    private String accentColor;
    private String city;
    private boolean published;

    // ── Platform-derived (read-only to the owner) ──
    /** Average of the reviews the owner has received, 0 when they have none yet. */
    private double rating;
    private int reviewCount;
    private long productCount;
    /** How many marketplace listings the owner has, shown alongside the shop's own catalogue. */
    private long listingCount;

    // ── Owner identity, resolved at the service layer ──
    private UUID ownerId;
    private String ownerName;
    private String ownerAvatarUrl;
    private boolean ownerVerified;

    /** Populated on the single-shop endpoint; null on the browse list to keep it light. */
    private List<ShopProductDto> products;

    /**
     * Maps the persistent fields only. Owner details and derived counts are filled in by
     * {@code ShopService}, which has the repositories needed to resolve them.
     */
    public static ShopDto from(Shop shop) {
        if (shop == null) return new ShopDto();
        return ShopDto.builder()
                .id(shop.getId())
                .slug(shop.getSlug())
                .name(shop.getName())
                .category(shop.getCategory())
                .tagline(shop.getTagline())
                .description(shop.getDescription())
                .bannerUrl(shop.getBannerUrl())
                .accentColor(shop.getAccentColor())
                .city(shop.getCity())
                .published(shop.isPublished())
                .ownerId(shop.getOwnerId())
                .build();
    }
}
