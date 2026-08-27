package com.hustleup.marketplace.shop.controller;

import com.hustleup.common.model.Role;
import com.hustleup.common.model.User;
import com.hustleup.common.repository.UserRepository;
import com.hustleup.marketplace.payments.service.StripeConnectService;
import com.hustleup.marketplace.shop.model.Shop;
import com.hustleup.marketplace.shop.model.ShopOrder;
import com.hustleup.marketplace.shop.model.ShopProduct;
import com.hustleup.marketplace.shop.repository.ShopOrderRepository;
import com.hustleup.marketplace.shop.repository.ShopProductRepository;
import com.hustleup.marketplace.shop.repository.ShopRepository;
import com.stripe.exception.StripeException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Buying from a seller's storefront.
 *
 * <p>Replaces the previous front-end behaviour, where "Place order" wrote the basket to
 * {@code sessionStorage} and navigated to a confirmation page. Nothing reached the server:
 * no order existed, no money moved, and the seller never heard about it. The buyer saw a
 * completed purchase that had not happened.
 */
@RestController
@RequestMapping("/api/v1/shops")
@RequiredArgsConstructor
@Slf4j
public class ShopOrderController {

    private final ShopRepository shopRepository;
    private final ShopProductRepository productRepository;
    private final ShopOrderRepository orderRepository;
    private final UserRepository userRepository;
    private final StripeConnectService stripeConnectService;

    /** Platform default — {@link ShopProduct} carries a price with no currency of its own. */
    private static final String CURRENCY = "PLN";

    private User currentUser() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null || "anonymousUser".equals(auth.getName())) return null;
        return userRepository.findByEmail(auth.getName()).orElse(null);
    }

    /**
     * Buys one or more products from a storefront and returns a Stripe Checkout URL.
     *
     * <p><b>POST /api/v1/shops/{idOrSlug}/checkout</b>
     * <br>Body: {@code {"items":[{"productId":"…","quantity":2}], "customer":{...}, "notes":"…"}}
     *
     * <p>Orders are created {@code AWAITING_PAYMENT} and only become {@code PAID} when the
     * webhook confirms the charge — so an abandoned checkout leaves a clearly unpaid order
     * rather than a phantom sale the seller might try to fulfil.
     */
    @PostMapping("/{idOrSlug}/checkout")
    @Transactional
    public ResponseEntity<?> checkout(@PathVariable String idOrSlug, @RequestBody Map<String, Object> body) {
        User buyer = currentUser();
        if (buyer == null) return ResponseEntity.status(401).body(Map.of("error", "Sign in to place an order"));

        Shop shop = resolveShop(idOrSlug);
        if (shop == null) return ResponseEntity.status(404).body(Map.of("error", "Shop not found"));

        if (shop.getOwnerId().equals(buyer.getId())) {
            return ResponseEntity.badRequest().body(Map.of("error", "You cannot buy from your own shop"));
        }

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> items = (List<Map<String, Object>>) body.get("items");
        if (items == null || items.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Your basket is empty"));
        }

        @SuppressWarnings("unchecked")
        Map<String, Object> customer = (Map<String, Object>) body.getOrDefault("customer", Map.of());
        String notes = body.get("notes") != null ? String.valueOf(body.get("notes")) : null;

        List<ShopOrder> created = new ArrayList<>();
        for (Map<String, Object> item : items) {
            UUID productId;
            try {
                productId = UUID.fromString(String.valueOf(item.get("productId")));
            } catch (IllegalArgumentException e) {
                return ResponseEntity.badRequest().body(Map.of("error", "Invalid product id"));
            }

            ShopProduct product = productRepository.findById(productId).orElse(null);
            if (product == null) {
                return ResponseEntity.status(404).body(Map.of("error", "Product not found"));
            }
            // Guards against a basket assembled from one shop being posted at another.
            if (!product.getShopId().equals(shop.getId())) {
                return ResponseEntity.badRequest().body(Map.of("error", "That product is not sold by this shop"));
            }

            int qty = 1;
            if (item.get("quantity") != null) {
                try { qty = Math.max(1, Integer.parseInt(String.valueOf(item.get("quantity")))); }
                catch (NumberFormatException ignored) { /* keep 1 */ }
            }

            // Price comes from the product row, never from the request — otherwise a client
            // could name its own price for someone else's goods.
            BigDecimal unit = product.getPrice() != null ? product.getPrice() : BigDecimal.ZERO;

            created.add(orderRepository.save(ShopOrder.builder()
                    .buyerId(buyer.getId())
                    .shopId(shop.getId())
                    .sellerId(shop.getOwnerId())
                    .productId(product.getId())
                    .productName(product.getName())
                    .productImageUrl(product.getImageUrl())
                    .unitPrice(unit)
                    .quantity(qty)
                    .totalPrice(unit.multiply(BigDecimal.valueOf(qty)))
                    .currency(CURRENCY)
                    .customerName(str(customer.get("fullName")))
                    .customerEmail(str(customer.get("email")) != null ? str(customer.get("email")) : buyer.getEmail())
                    .customerPhone(str(customer.get("phone")))
                    .notes(notes)
                    .build()));
        }

        try {
            var result = stripeConnectService.createShopCheckoutSession(
                    created, shop.getSlug() != null ? shop.getSlug() : shop.getId().toString());
            log.info("Shop checkout: shop={} buyer={} items={}", shop.getId(), buyer.getId(), created.size());
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("url", result.checkoutUrl());
            out.put("orderIds", created.stream().map(ShopOrder::getId).collect(Collectors.toList()));
            return ResponseEntity.ok(out);
        } catch (StripeException e) {
            return ResponseEntity.status(502).body(Map.of("error", "Could not reach Stripe: " + e.getMessage()));
        }
    }

    /** The caller's storefront purchases. <b>GET /api/v1/shops/orders/mine</b> */
    @GetMapping("/orders/mine")
    public ResponseEntity<?> myOrders() {
        User me = currentUser();
        if (me == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(orderRepository.findByBuyerIdOrderByCreatedAtDesc(me.getId()));
    }

    /** Orders placed with the caller's shop — their fulfilment queue. <b>GET /api/v1/shops/orders/received</b> */
    @GetMapping("/orders/received")
    public ResponseEntity<?> receivedOrders() {
        User me = currentUser();
        if (me == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(orderRepository.findBySellerIdOrderByCreatedAtDesc(me.getId()));
    }

    /**
     * Moves a storefront order along.
     *
     * <p><b>PATCH /api/v1/shops/orders/{id}</b> — the shop owner, or an admin.
     */
    @PatchMapping("/orders/{id}")
    public ResponseEntity<?> updateOrder(@PathVariable UUID id, @RequestBody Map<String, String> body) {
        User me = currentUser();
        if (me == null) return ResponseEntity.status(401).build();
        ShopOrder order = orderRepository.findById(id).orElse(null);
        if (order == null) return ResponseEntity.status(404).body(Map.of("error", "Order not found"));
        if (!order.getSellerId().equals(me.getId()) && me.getRole() != Role.ADMIN) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "Only the shop owner can update this order"));
        }
        try {
            order.setStatus(ShopOrder.ShopOrderStatus.valueOf(String.valueOf(body.get("status")).toUpperCase()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error",
                    "Invalid status. Allowed: AWAITING_PAYMENT, PAID, FULFILLED, CANCELLED, REFUNDED"));
        }
        order.setUpdatedAt(java.time.LocalDateTime.now());
        return ResponseEntity.ok(orderRepository.save(order));
    }

    // ---- Helpers ------------------------------------------------------------

    /** Shops are addressable by slug or id, matching how the storefront routes are built. */
    private Shop resolveShop(String idOrSlug) {
        try {
            var byId = shopRepository.findById(UUID.fromString(idOrSlug));
            if (byId.isPresent()) return byId.get();
        } catch (IllegalArgumentException ignored) {
            // Not a UUID — fall through to the slug lookup.
        }
        return shopRepository.findBySlug(idOrSlug).orElse(null);
    }

    private String str(Object v) {
        return v != null && !String.valueOf(v).isBlank() ? String.valueOf(v) : null;
    }
}
