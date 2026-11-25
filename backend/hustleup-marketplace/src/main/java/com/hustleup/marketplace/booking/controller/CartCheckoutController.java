package com.hustleup.marketplace.booking.controller;

import com.hustleup.common.model.User;
import com.hustleup.common.repository.UserRepository;
import com.hustleup.marketplace.booking.model.Booking;
import com.hustleup.marketplace.booking.service.BookingService;
import com.hustleup.marketplace.payments.service.StripeConnectService;
import com.hustleup.marketplace.shop.model.ShopOrder;
import com.hustleup.marketplace.shop.service.ShopCheckoutService;
import com.stripe.exception.StripeException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;

/**
 * Pays for a whole cart — marketplace listings and products from any number of shops — in
 * one Stripe payment.
 *
 * <p><b>POST /api/v1/bookings/checkout/cart</b>
 * <br>Body: {@code {"listings":[{listingId, quantity, ticketTier?, bookingId?}],
 * "shops":[{"shopId":"…","items":[{productId, quantity}]}], "customer":{…}, "notes":"…"}}
 *
 * <p>Every booking and shop order is created first, inside one transaction, and only then is
 * a single Checkout Session opened for all of them. If any line is rejected (sold out, own
 * listing, mixed currencies) or Stripe is unreachable, nothing is kept: no half-paid cart,
 * no stock held for an order that was never offered for payment.
 *
 * @return {@code {url, bookingIds, shopOrderIds, awaitingApproval}}; {@code url} is null when
 *         every line needs the seller's approval first
 */
@RestController
@RequestMapping("/api/v1/bookings/checkout")
@RequiredArgsConstructor
@Slf4j
public class CartCheckoutController {

    private final BookingService bookingService;
    private final ShopCheckoutService shopCheckoutService;
    private final StripeConnectService stripeConnectService;
    private final UserRepository userRepository;

    @PostMapping("/cart")
    @Transactional
    @SuppressWarnings("unchecked")
    public ResponseEntity<?> checkoutCart(@RequestBody Map<String, Object> body) {
        User buyer = currentUser();
        if (buyer == null) return ResponseEntity.status(401).body(Map.of("error", "Sign in to check out"));

        List<Map<String, Object>> listings = body.get("listings") instanceof List<?> l ? (List<Map<String, Object>>) l : List.of();
        List<?> shops = body.get("shops") instanceof List<?> s ? s : List.of();
        if (listings.isEmpty() && shops.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Your cart is empty"));
        }
        Map<String, Object> customer = body.get("customer") instanceof Map<?, ?> c ? (Map<String, Object>) c : Map.of();
        String notes = body.get("notes") != null ? String.valueOf(body.get("notes")) : null;

        BookingService.PreparedCart cart = listings.isEmpty()
                ? new BookingService.PreparedCart(List.of(), List.of(), List.of())
                : bookingService.prepareCart(listings, customer);

        List<ShopOrder> orders = new ArrayList<>();
        for (Object raw : shops) {
            if (!(raw instanceof Map<?, ?> shop) || shop.get("shopId") == null || !(shop.get("items") instanceof List<?> items)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Each shop needs a shopId and items");
            }
            orders.addAll(shopCheckoutService.createOrders(buyer, String.valueOf(shop.get("shopId")), items, customer, notes).orders());
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("awaitingApproval", cart.awaitingApproval());
        if (cart.payable().isEmpty() && orders.isEmpty()) {
            // Everything needs seller approval — nothing to charge for yet.
            out.put("url", null);
            out.put("bookingIds", List.of());
            out.put("shopOrderIds", List.of());
            return ResponseEntity.ok(out);
        }

        try {
            var result = stripeConnectService.createUnifiedCheckoutSession(cart.payable(), cart.titles(), orders);
            bookingService.markAwaitingPayment(cart.payable(), result.paymentIntentId());
            log.info("Cart checkout: buyer={} bookings={} shopOrders={}", buyer.getId(), cart.payable().size(), orders.size());
            out.put("url", result.checkoutUrl());
            out.put("bookingIds", cart.payable().stream().map(Booking::getId).toList());
            out.put("shopOrderIds", orders.stream().map(ShopOrder::getId).toList());
            return ResponseEntity.ok(out);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        } catch (StripeException e) {
            // Throw so every booking, order row and stock reservation rolls back together.
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Could not start payment. Please try again.", e);
        }
    }

    private User currentUser() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null || "anonymousUser".equals(auth.getName())) return null;
        return userRepository.findByEmail(auth.getName()).orElse(null);
    }
}
