/**
 * REST API for seller storefronts.
 *
 * <p>Reads are public so guests can browse Explore. Every write is gated on ownership:
 * {@link #requireOwned} resolves the shop and throws {@link AccessDeniedException} unless the
 * authenticated caller is the shop's owner. Relying on the client to only show edit controls
 * to the owner would not be a control at all — these checks are the control.
 */
package com.hustleup.marketplace.shop.controller;

import com.hustleup.common.model.User;
import com.hustleup.common.repository.UserRepository;
import com.hustleup.common.storage.FileStorageService;
import com.hustleup.marketplace.shipping.ShippingMethod;
import com.hustleup.marketplace.shop.dto.*;
import com.hustleup.marketplace.shop.model.Shop;
import com.hustleup.marketplace.shop.model.ShopProduct;
import com.hustleup.marketplace.shop.repository.ShopProductRepository;
import com.hustleup.marketplace.shop.repository.ShopRepository;
import com.hustleup.marketplace.shop.service.ShopService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/shops")
@RequiredArgsConstructor
public class ShopController {

    private final ShopRepository shopRepository;
    private final ShopProductRepository productRepository;
    private final ShopService shopService;
    private final UserRepository userRepository;
    private final FileStorageService fileStorageService;

    // -------------------------------------------------------------------------
    // Identity / ownership helpers
    // -------------------------------------------------------------------------

    /** The authenticated caller, or empty for an anonymous request. */
    private User currentUserOrNull() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || auth instanceof AnonymousAuthenticationToken) return null;
        return userRepository.findByEmail(auth.getName()).orElse(null);
    }

    private User requireUser() {
        User user = currentUserOrNull();
        if (user == null) throw new AccessDeniedException("Authentication required");
        return user;
    }

    private Shop requireShop(String idOrSlug) {
        return resolve(idOrSlug).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Shop not found"));
    }

    /**
     * Loads a shop and asserts the caller owns it.
     *
     * <p>Every mutating endpoint funnels through here, so there is exactly one place where
     * "can this person change this shop?" is decided.
     */
    private Shop requireOwned(String idOrSlug) {
        User me = requireUser();
        Shop shop = requireShop(idOrSlug);
        if (!shop.getOwnerId().equals(me.getId())) {
            throw new AccessDeniedException("You can only edit your own shop");
        }
        return shop;
    }

    /** Shops are addressable by UUID or by their readable slug. */
    private java.util.Optional<Shop> resolve(String idOrSlug) {
        try {
            return shopRepository.findById(UUID.fromString(idOrSlug));
        } catch (IllegalArgumentException notAUuid) {
            return shopRepository.findBySlug(idOrSlug);
        }
    }

    // -------------------------------------------------------------------------
    // Public reads
    // -------------------------------------------------------------------------

    /** Every published storefront, for the Explore shelf and the shops browse page. */
    @GetMapping
    public ResponseEntity<List<ShopDto>> browse() {
        return ResponseEntity.ok(shopService.browse());
    }

    /**
     * The caller's own shop, published or not.
     *
     * <p>Declared before {@code /{idOrSlug}} so "me" is never mistaken for a slug, and
     * returns 204 rather than 404 when the seller simply hasn't created one yet — "you have
     * no shop" is a normal state for the dashboard, not an error.
     */
    @GetMapping("/me")
    public ResponseEntity<ShopDto> myShop() {
        User me = requireUser();
        return shopRepository.findByOwnerId(me.getId())
                .map(shop -> ResponseEntity.ok(shopService.detail(shop)))
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    /** One storefront with its full catalogue. */
    @GetMapping("/{idOrSlug}")
    public ResponseEntity<ShopDto> getOne(@PathVariable String idOrSlug) {
        Shop shop = requireShop(idOrSlug);
        // An unpublished shop is visible to its owner only — otherwise "hidden" would mean
        // nothing more than "not linked from the browse page".
        User me = currentUserOrNull();
        if (!shop.isPublished() && (me == null || !shop.getOwnerId().equals(me.getId()))) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Shop not found");
        }
        return ResponseEntity.ok(shopService.detail(shop));
    }

    // -------------------------------------------------------------------------
    // Shop writes (owner only)
    // -------------------------------------------------------------------------

    /** Creates the caller's storefront. One per seller — a second attempt is a 409. */
    @PostMapping
    public ResponseEntity<ShopDto> create(@RequestBody ShopRequest body) {
        User me = requireUser();
        if (shopRepository.findByOwnerId(me.getId()).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "You already have a shop");
        }
        String name = trimToNull(body.getName());
        if (name == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Shop name is required");
        }

        Shop shop = Shop.builder()
                .ownerId(me.getId())
                .slug(shopService.uniqueSlug(name))
                .name(name)
                .category(trimToNull(body.getCategory()))
                .tagline(trimToNull(body.getTagline()))
                .description(trimToNull(body.getDescription()))
                .bannerUrl(trimToNull(body.getBannerUrl()))
                .accentColor(trimToNull(body.getAccentColor()) == null ? "#CDFF00" : body.getAccentColor().trim())
                // Falls back to the seller's own city so a new shop is on the map immediately.
                .city(trimToNull(body.getCity()) == null ? me.getCity() : body.getCity().trim())
                .published(body.getPublished() == null || body.getPublished())
                .build();

        Shop saved = shopRepository.save(shop);
        return ResponseEntity.status(HttpStatus.CREATED).body(shopService.detail(saved));
    }

    /** Partial update — only the fields present in the body are applied. */
    @PatchMapping("/{idOrSlug}")
    public ResponseEntity<ShopDto> update(@PathVariable String idOrSlug, @RequestBody ShopRequest body) {
        Shop shop = requireOwned(idOrSlug);

        if (body.getName() != null) {
            String name = trimToNull(body.getName());
            if (name == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Shop name cannot be empty");
            shop.setName(name);
        }
        // Blank strings are meaningful here: they clear an optional field. Only `null`
        // (field absent from the JSON) means "leave this alone".
        if (body.getCategory() != null)    shop.setCategory(trimToNull(body.getCategory()));
        if (body.getTagline() != null)     shop.setTagline(trimToNull(body.getTagline()));
        if (body.getDescription() != null) shop.setDescription(trimToNull(body.getDescription()));
        if (body.getBannerUrl() != null)   shop.setBannerUrl(trimToNull(body.getBannerUrl()));
        if (body.getAccentColor() != null) shop.setAccentColor(trimToNull(body.getAccentColor()));
        if (body.getCity() != null)        shop.setCity(trimToNull(body.getCity()));
        if (body.getPublished() != null)   shop.setPublished(body.getPublished());

        return ResponseEntity.ok(shopService.detail(shopRepository.save(shop)));
    }

    /** Deletes the storefront and its whole catalogue. */
    @DeleteMapping("/{idOrSlug}")
    @Transactional
    public ResponseEntity<Void> delete(@PathVariable String idOrSlug) {
        Shop shop = requireOwned(idOrSlug);
        productRepository.deleteByShopId(shop.getId());
        shopRepository.delete(shop);
        return ResponseEntity.noContent().build();
    }

    /**
     * Stores an image for this shop and returns its URL, for the banner or a product photo.
     *
     * <p>Ownership-gated rather than a generic upload endpoint: an open "authenticated users
     * may store files" route is an invitation to fill the disk.
     */
    @PostMapping(value = "/{idOrSlug}/media", consumes = "multipart/form-data")
    public ResponseEntity<Map<String, String>> uploadMedia(
            @PathVariable String idOrSlug,
            @RequestParam("file") MultipartFile file) {
        requireOwned(idOrSlug);
        return ResponseEntity.ok(Map.of("url", fileStorageService.store(file)));
    }

    // -------------------------------------------------------------------------
    // Product writes (owner only)
    // -------------------------------------------------------------------------

    @PostMapping("/{idOrSlug}/products")
    public ResponseEntity<ShopProductDto> addProduct(
            @PathVariable String idOrSlug, @RequestBody ShopProductRequest body) {
        Shop shop = requireOwned(idOrSlug);

        String name = trimToNull(body.getName());
        if (name == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Product name is required");
        if (body.getPrice() == null || body.getPrice().compareTo(BigDecimal.ZERO) < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Product price must be zero or more");
        }

        ShopProduct product = ShopProduct.builder()
                .shopId(shop.getId())
                .name(name)
                .description(trimToNull(body.getDescription()))
                .price(body.getPrice())
                .currency(trimToNull(body.getCurrency()) == null ? "PLN" : body.getCurrency().trim())
                .category(trimToNull(body.getCategory()))
                .imageUrl(trimToNull(body.getImageUrl()))
                // An unrecognised method falls back to PICKUP rather than failing the save:
                // collection is always possible and promises the buyer nothing the seller
                // has not offered, unlike defaulting to a courier that may not exist.
                .shippingMethod(shippingOrPickup(body.getShippingMethod()))
                .shippingPrice(nonNegative(body.getShippingPrice()))
                // New items land at the end of the shelf unless the seller says otherwise.
                .sortOrder(body.getSortOrder() != null
                        ? body.getSortOrder()
                        : (int) productRepository.countByShopId(shop.getId()))
                .build();

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ShopProductDto.from(productRepository.save(product)));
    }

    @PatchMapping("/{idOrSlug}/products/{productId}")
    public ResponseEntity<ShopProductDto> updateProduct(
            @PathVariable String idOrSlug,
            @PathVariable UUID productId,
            @RequestBody ShopProductRequest body) {
        Shop shop = requireOwned(idOrSlug);
        ShopProduct product = requireProductOf(shop, productId);

        if (body.getName() != null) {
            String name = trimToNull(body.getName());
            if (name == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Product name cannot be empty");
            product.setName(name);
        }
        if (body.getPrice() != null) {
            if (body.getPrice().compareTo(BigDecimal.ZERO) < 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Product price must be zero or more");
            }
            product.setPrice(body.getPrice());
        }
        if (body.getDescription() != null) product.setDescription(trimToNull(body.getDescription()));
        if (body.getCurrency() != null)    product.setCurrency(trimToNull(body.getCurrency()));
        if (body.getCategory() != null)    product.setCategory(trimToNull(body.getCategory()));
        if (body.getImageUrl() != null)    product.setImageUrl(trimToNull(body.getImageUrl()));
        if (body.getSortOrder() != null)   product.setSortOrder(body.getSortOrder());
        // Absent keys leave the delivery terms alone — editing a price must not silently
        // reset how the seller ships. A typo'd method name is ignored for the same reason.
        ShippingMethod method = ShippingMethod.parse(body.getShippingMethod());
        if (method != null) product.setShippingMethod(method);
        if (body.getShippingPrice() != null) product.setShippingPrice(nonNegative(body.getShippingPrice()));

        return ResponseEntity.ok(ShopProductDto.from(productRepository.save(product)));
    }

    @DeleteMapping("/{idOrSlug}/products/{productId}")
    public ResponseEntity<Void> deleteProduct(@PathVariable String idOrSlug, @PathVariable UUID productId) {
        Shop shop = requireOwned(idOrSlug);
        productRepository.delete(requireProductOf(shop, productId));
        return ResponseEntity.noContent().build();
    }

    /** Seller's chosen method, or collection when they did not give a usable one. */
    private ShippingMethod shippingOrPickup(String raw) {
        ShippingMethod method = ShippingMethod.parse(raw);
        return method != null ? method : ShippingMethod.PICKUP;
    }

    /** Postage floors at zero — a negative charge would pay the buyer to order. */
    private BigDecimal nonNegative(BigDecimal value) {
        return value != null && value.compareTo(BigDecimal.ZERO) > 0 ? value : BigDecimal.ZERO;
    }

    /**
     * Loads a product and confirms it belongs to this shop.
     *
     * <p>Without the shop-id check, an owner could pass any product UUID in the system to
     * their own shop's URL and edit somebody else's merchandise.
     */
    private ShopProduct requireProductOf(Shop shop, UUID productId) {
        ShopProduct product = productRepository.findById(productId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Product not found"));
        if (!product.getShopId().equals(shop.getId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Product not found");
        }
        return product;
    }

    private static String trimToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
