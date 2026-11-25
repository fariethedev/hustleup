package com.hustleup.marketplace.shop.service;

import com.hustleup.common.model.User;
import com.hustleup.common.security.EmailVerificationGuard;
import com.hustleup.marketplace.shipping.Fulfilment;
import com.hustleup.marketplace.shipping.FulfilmentStatus;
import com.hustleup.marketplace.shipping.ShipmentService;
import com.hustleup.marketplace.shipping.ShippingMethod;
import com.hustleup.marketplace.shop.model.Shop;
import com.hustleup.marketplace.shop.model.ShopOrder;
import com.hustleup.marketplace.shop.model.ShopProduct;
import com.hustleup.marketplace.shop.repository.ShopOrderRepository;
import com.hustleup.marketplace.shop.repository.ShopProductRepository;
import com.hustleup.marketplace.shop.repository.ShopRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.*;

/**
 * Turns a storefront basket into unpaid {@link ShopOrder} rows, and marks them paid once
 * Stripe confirms the charge.
 *
 * <p>Shared by the single-shop checkout ({@code POST /shops/{id}/checkout}) and the
 * whole-cart checkout ({@code POST /bookings/checkout/cart}), so pricing, stock reservation
 * and the "not your own shop" rules live in exactly one place.
 */
@Service
@RequiredArgsConstructor
public class ShopCheckoutService {

    /** Platform default — {@link ShopProduct} carries a price with no currency of its own. */
    private static final String CURRENCY = "PLN";

    private final ShopRepository shopRepository;
    private final ShopProductRepository productRepository;
    private final ShopOrderRepository orderRepository;
    private final ShopInventoryService inventoryService;
    private final ShipmentService shipmentService;
    private final EmailVerificationGuard emailVerificationGuard;

    /** A shop's basket turned into orders, plus the shop for building return URLs. */
    public record CreatedOrders(Shop shop, List<ShopOrder> orders) {}

    /**
     * Creates AWAITING_PAYMENT orders for one shop's basket. Must run inside the caller's
     * transaction so a failed payment session rolls the rows and stock reservations back.
     *
     * @param items {@code [{productId, quantity}]}
     */
    @Transactional
    public CreatedOrders createOrders(User buyer, String idOrSlug, List<?> items, Map<?, ?> customer, String notes) {
        // A storefront order is a real charge, so this is the point buying needs a reachable address.
        emailVerificationGuard.require(buyer, "buy");

        Shop shop = resolveShop(idOrSlug);
        if (shop == null || !shop.isPublished()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Shop not found");
        if (shop.getOwnerId().equals(buyer.getId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "You cannot buy from your own shop");
        }
        if (items == null || items.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Your basket is empty");
        if (items.size() > 100) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Too many basket items");

        // Merge duplicate lines and acquire locks in a stable order across concurrent carts.
        Map<UUID, Integer> quantities = new TreeMap<>();
        for (Object raw : items) {
            if (!(raw instanceof Map<?, ?> item)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid basket item");
            try {
                UUID productId = UUID.fromString(String.valueOf(item.get("productId")));
                int quantity = item.get("quantity") == null ? 1 : Integer.parseInt(String.valueOf(item.get("quantity")));
                if (quantity < 1) throw new IllegalArgumentException();
                quantities.merge(productId, quantity, Math::addExact);
            } catch (IllegalArgumentException | ArithmeticException e) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Each item needs a valid product and positive whole quantity");
            }
        }
        Map<?, ?> details = customer == null ? Map.of() : customer;
        String name = str(details.get("fullName")) != null ? str(details.get("fullName")) : str(details.get("name"));

        List<ShopOrder> created = new ArrayList<>();
        String checkoutCurrency = null;
        for (var item : quantities.entrySet()) {
            ShopProduct product = productRepository.findLockedById(item.getKey())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Product not found"));
            // Guards against a basket assembled from one shop being posted at another.
            if (!product.getShopId().equals(shop.getId())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "That product is not sold by this shop");
            }

            int qty = item.getValue();
            String productCurrency = product.getCurrency() == null ? CURRENCY : product.getCurrency().toUpperCase(Locale.ROOT);
            if (checkoutCurrency != null && !checkoutCurrency.equals(productCurrency)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Check out products in different currencies separately");
            }
            checkoutCurrency = productCurrency;
            boolean stockReserved = inventoryService.reserve(product, qty);

            // Price comes from the product row, never from the request — otherwise a client
            // could name its own price for someone else's goods.
            BigDecimal unit = product.getPrice() != null ? product.getPrice() : BigDecimal.ZERO;

            // Delivery terms are snapshotted from the shelf for the same reason the name and
            // price are: repricing postage tomorrow must not rewrite what was agreed today.
            Fulfilment delivery = new Fulfilment();
            delivery.setShippingMethod(product.getShippingMethod() != null ? product.getShippingMethod() : ShippingMethod.PICKUP);
            // Charged once per line, not per unit — three of an item is still one parcel.
            delivery.setShippingPrice(product.getShippingPrice() != null ? product.getShippingPrice() : BigDecimal.ZERO);
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
                    .stockReserved(stockReserved)
                    .totalPrice(unit.multiply(BigDecimal.valueOf(qty)))
                    .currency(productCurrency)
                    .customerName(name)
                    .customerEmail(str(details.get("email")) != null ? str(details.get("email")) : buyer.getEmail())
                    .customerPhone(str(details.get("phone")))
                    .notes(notes)
                    .fulfilment(delivery)
                    .build()));
        }
        return new CreatedOrders(shop, created);
    }

    /**
     * Marks every shop order named in a paid Checkout Session as PAID and starts its
     * delivery track. Idempotent: orders already past AWAITING_PAYMENT are left alone, so
     * the webhook and the buyer's return can both call this in either order.
     *
     * @return the orders this call moved to PAID
     */
    @Transactional
    public List<ShopOrder> applyPaidSession(com.stripe.model.checkout.Session session) {
        String csv = session.getMetadata() == null ? null : session.getMetadata().get("shopOrderIds");
        List<ShopOrder> paid = new ArrayList<>();
        if (csv == null || csv.isBlank()) return paid;
        for (String raw : csv.split(",")) {
            try {
                orderRepository.findLockedById(UUID.fromString(raw.trim())).ifPresent(o -> {
                    if (o.getStatus() != ShopOrder.ShopOrderStatus.AWAITING_PAYMENT) return;
                    o.setStatus(ShopOrder.ShopOrderStatus.PAID);
                    if (session.getPaymentIntent() != null) o.setPaymentIntentId(session.getPaymentIntent());
                    // Money has actually arrived, so the buyer now has something to follow and
                    // the seller owes them goods. Both are told here, and only here.
                    shipmentService.confirmPaid(o.getFulfilment(), o.getProductName(), o.getId(), o.getBuyerId(), o.getSellerId());
                    o.setUpdatedAt(java.time.LocalDateTime.now());
                    paid.add(orderRepository.save(o));
                });
            } catch (IllegalArgumentException ignored) {
                // Not a UUID — skip rather than failing the whole reconciliation.
            }
        }
        return paid;
    }

    public Shop resolveShop(String idOrSlug) {
        try {
            var byId = shopRepository.findById(UUID.fromString(idOrSlug));
            if (byId.isPresent()) return byId.get();
        } catch (IllegalArgumentException ignored) {
            // Not a UUID — fall through to the slug lookup.
        }
        return shopRepository.findBySlug(idOrSlug).orElse(null);
    }

    private static String str(Object v) {
        return v != null && !String.valueOf(v).isBlank() ? String.valueOf(v) : null;
    }
}
