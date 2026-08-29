package com.hustleup.marketplace.shop.service;

import com.hustleup.common.model.User;
import com.hustleup.common.repository.UserRepository;
import com.hustleup.marketplace.listing.model.ListingStatus;
import com.hustleup.marketplace.listing.repository.ListingRepository;
import com.hustleup.marketplace.review.repository.ReviewRepository;
import com.hustleup.marketplace.shop.dto.ShopDto;
import com.hustleup.marketplace.shop.dto.ShopProductDto;
import com.hustleup.marketplace.shop.model.Shop;
import com.hustleup.marketplace.shop.model.ShopProduct;
import com.hustleup.marketplace.shop.repository.ShopProductRepository;
import com.hustleup.marketplace.shop.repository.ShopRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.text.Normalizer;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Read-side assembly for shops: turns {@link Shop} rows into fully-populated {@link ShopDto}s
 * by resolving the owner from the users table and computing the derived stats the storefront
 * card displays.
 *
 * <p>Write operations live in the controller, which is where ownership is enforced.
 */
@Service
@RequiredArgsConstructor
public class ShopService {

    private final ShopRepository shopRepository;
    private final ShopProductRepository productRepository;
    private final ListingRepository listingRepository;
    private final ReviewRepository reviewRepository;
    private final UserRepository userRepository;

    /**
     * Every published shop, each with its product list attached.
     *
     * <p>Products and owners are fetched in bulk rather than per shop — browsing six shops
     * used to be fine, but this is the Explore shelf and it grows with the platform.
     */
    public List<ShopDto> browse() {
        List<Shop> shops = shopRepository.findByPublishedTrue();
        if (shops.isEmpty()) return List.of();

        List<UUID> shopIds = shops.stream().map(Shop::getId).toList();
        Map<UUID, List<ShopProduct>> productsByShop = productRepository.findByShopIdIn(shopIds).stream()
                .collect(Collectors.groupingBy(ShopProduct::getShopId));

        Map<UUID, User> owners = userRepository
                .findAllById(shops.stream().map(Shop::getOwnerId).collect(Collectors.toSet()))
                .stream()
                .collect(Collectors.toMap(User::getId, u -> u));

        return shops.stream()
                .map(s -> toDto(s, productsByShop.getOrDefault(s.getId(), List.of()), owners.get(s.getOwnerId())))
                .sorted(Comparator.comparingDouble(ShopDto::getRating).reversed()
                        .thenComparing(ShopDto::getProductCount, Comparator.reverseOrder()))
                .toList();
    }

    /** One shop with its full catalogue, for the shop detail page. */
    public ShopDto detail(Shop shop) {
        return toDto(
                shop,
                productRepository.findByShopIdOrderBySortOrderAscCreatedAtAsc(shop.getId()),
                userRepository.findById(shop.getOwnerId()).orElse(null));
    }

    /** Builds the DTO, filling in owner identity and the stats the seller cannot set. */
    public ShopDto toDto(Shop shop, List<ShopProduct> products, User owner) {
        ShopDto dto = ShopDto.from(shop);

        dto.setProducts(products.stream().map(ShopProductDto::from).toList());
        dto.setProductCount(products.size());

        // Derived from the owner's real reviews — never accepted from the client.
        Double avg = reviewRepository.averageRatingForUser(shop.getOwnerId());
        dto.setRating(avg == null ? 0.0 : Math.round(avg * 10.0) / 10.0);
        dto.setReviewCount(reviewRepository.countByReviewedId(shop.getOwnerId()));
        dto.setListingCount(listingRepository.countBySellerIdAndStatus(shop.getOwnerId(), ListingStatus.ACTIVE));

        if (owner != null) {
            dto.setOwnerName(owner.displayName());
            dto.setOwnerAvatarUrl(owner.getAvatarUrl());
            dto.setOwnerVerified(owner.isIdVerified());
        }
        return dto;
    }

    /**
     * Turns a shop name into a unique URL slug ("Oja Market" → "oja-market").
     *
     * <p>Diacritics are folded first so Polish shop names produce clean ASCII slugs
     * ("Piękna Moda" → "piekna-moda") rather than percent-encoded mush in the address bar.
     * A numeric suffix is appended if the slug is already taken.
     */
    public String uniqueSlug(String name) {
        String base = Normalizer.normalize(name == null ? "" : name, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")          // strip combining accents
                .replace("ł", "l").replace("Ł", "L") // NFD doesn't decompose the Polish stroked L
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("(^-|-$)", "");

        if (base.isBlank()) base = "shop";
        if (base.length() > 60) base = base.substring(0, 60).replaceAll("-$", "");

        String candidate = base;
        int suffix = 2;
        while (shopRepository.existsBySlug(candidate)) {
            candidate = base + "-" + suffix++;
        }
        return candidate;
    }
}
