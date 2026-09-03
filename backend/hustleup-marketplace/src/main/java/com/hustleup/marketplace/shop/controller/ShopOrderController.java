package com.hustleup.marketplace.shop.controller;

import com.hustleup.common.model.Role;
import com.hustleup.common.model.User;
import com.hustleup.common.repository.UserRepository;
import com.hustleup.marketplace.payments.service.StripeConnectService;
import com.hustleup.marketplace.shipping.Fulfilment;
import com.hustleup.marketplace.shipping.FulfilmentStatus;
import com.hustleup.marketplace.shipping.FulfilmentUpdateRequest;
import com.hustleup.marketplace.shipping.ShipmentService;
import com.hustleup.marketplace.shipping.ShippingMethod;
import com.hustleup.marketplace.shop.model.Shop;
import com.hustleup.marketplace.shop.model.ShopOrder;
import com.hustleup.marketplace.shop.service.OrderPayoutService;
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
    private final ShipmentService shipmentService;
    private final OrderPayoutService orderPayoutService;

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

            // Delivery terms are snapshotted from the shelf for the same reason the name and
            // price are: repricing postage tomorrow must not rewrite what was agreed today.
            Fulfilment delivery = new Fulfilment();
            delivery.setShippingMethod(product.getShippingMethod() != null
                    ? product.getShippingMethod() : ShippingMethod.PICKUP);
            // Charged once per line, not per unit — three of an item is still one parcel.
            delivery.setShippingPrice(product.getShippingPrice() != null
                    ? product.getShippingPrice() : BigDecimal.ZERO);
            delivery.setFulfilmentStatus(FulfilmentStatus.AWAITING_PAYMENT);

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
                    .fulfilment(delivery)
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

    /**
     * Records how the seller is sending a storefront order, and how far along it is.
     *
     * <p><b>PATCH /api/v1/shops/orders/{id}/fulfilment</b> — the shop owner, or an admin.
     * Same contract as the marketplace equivalent on {@code /api/v1/bookings}: only
     * {@code status} is required, absent keys are left alone, and which statuses are legal
     * depends on the shipping method the product was sold under.
     *
     * <p>Deliberately separate from the status PATCH above. That one is commercial — paid,
     * cancelled, refunded — and is the seller telling us about the money. This one is
     * physical, and is the seller telling the buyer where their parcel is.
     */
    @PatchMapping("/orders/{id}/fulfilment")
    @Transactional
    public ResponseEntity<?> updateFulfilment(@PathVariable UUID id,
                                              @RequestBody FulfilmentUpdateRequest body) {
        User me = currentUser();
        if (me == null) return ResponseEntity.status(401).build();
        ShopOrder order = orderRepository.findById(id).orElse(null);
        if (order == null) return ResponseEntity.status(404).body(Map.of("error", "Order not found"));
        if (!order.getSellerId().equals(me.getId()) && me.getRole() != Role.ADMIN) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "Only the shop owner can update delivery on this order"));
        }

        String rejection = shipmentService.applyUpdate(order.getFulfilment(), body,
                order.getProductName(), order.getId(), order.getBuyerId());
        if (rejection != null) return ResponseEntity.badRequest().body(Map.of("error", rejection));

        // The commercial status deliberately does NOT follow the seller here any more.
        //
        // This used to flip the order to FULFILLED as soon as the seller ticked DELIVERED, so
        // an order was complete on the say-so of the person being paid for it. FULFILLED is
        // what releases payout and what makes the sale reviewable, which meant a seller could
        // mark a parcel delivered that never left the house and then review it themselves.
        // Closing the order is now the buyer's to do — see confirmReceipt below.
        order.setUpdatedAt(java.time.LocalDateTime.now());
        return ResponseEntity.ok(orderRepository.save(order));
    }

    /**
     * The buyer confirming the order actually arrived.
     *
     * <p><b>PATCH /api/v1/shops/orders/{id}/received</b> — the buyer on the order, or an admin.
     *
     * <p>This is the only thing that moves a paid order to FULFILLED, and FULFILLED is what
     * releases the seller's payout and makes the sale reviewable. Both of those are claims
     * about the buyer's experience, so both wait on the buyer.
     *
     * <p>Not gated on the seller having marked it delivered first. A seller who never updates
     * tracking is common, and refusing to let a buyer confirm a parcel they are holding —
     * because the sender never filled in a form — would be an obstacle with nothing behind it.
     */
    @PatchMapping("/orders/{id}/received")
    @Transactional
    public ResponseEntity<?> confirmReceipt(@PathVariable UUID id) {
        User me = currentUser();
        if (me == null) return ResponseEntity.status(401).build();
        ShopOrder order = orderRepository.findById(id).orElse(null);
        if (order == null) return ResponseEntity.status(404).body(Map.of("error", "Order not found"));

        if (!order.getBuyerId().equals(me.getId()) && me.getRole() != Role.ADMIN) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "Only the buyer can confirm they received this order"));
        }

        // Nothing to confirm on an order that was never paid for, and confirming a cancelled
        // or refunded one would quietly resurrect it as a completed sale.
        if (order.getStatus() != ShopOrder.ShopOrderStatus.PAID
                && order.getStatus() != ShopOrder.ShopOrderStatus.FULFILLED) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "Only a paid order can be confirmed as received"));
        }

        if (order.getFulfilment() != null && order.getFulfilment().getBuyerConfirmedAt() == null) {
            order.getFulfilment().setBuyerConfirmedAt(java.time.LocalDateTime.now());
        }
        order.setStatus(ShopOrder.ShopOrderStatus.FULFILLED);
        order.setUpdatedAt(java.time.LocalDateTime.now());
        ShopOrder saved = orderRepository.save(order);

        // Release the seller's money now. A buyer holding their goods has no reason to wait
        // for the seller to be paid, and that is the whole point of having held it until now.
        // A failure here is not fatal to the confirmation — the order is still received, and
        // the hourly sweep retries anything left held.
        orderPayoutService.release(saved);

        return ResponseEntity.ok(saved);
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
