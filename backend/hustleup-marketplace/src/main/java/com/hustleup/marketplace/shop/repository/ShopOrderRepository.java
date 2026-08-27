package com.hustleup.marketplace.shop.repository;

import com.hustleup.marketplace.shop.model.ShopOrder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

/** Data access for storefront orders. */
@Repository
public interface ShopOrderRepository extends JpaRepository<ShopOrder, UUID> {

    /** A buyer's purchase history, newest first. */
    List<ShopOrder> findByBuyerIdOrderByCreatedAtDesc(UUID buyerId);

    /** A seller's storefront orders — their fulfilment queue. */
    List<ShopOrder> findBySellerIdOrderByCreatedAtDesc(UUID sellerId);

    /**
     * Every order paid for by one Stripe PaymentIntent.
     *
     * <p>A single checkout can span several products, so one charge maps to many orders.
     * Returning a list rather than an Optional is what stops the webhook marking only the
     * first line of a multi-item order paid.
     */
    List<ShopOrder> findAllByPaymentIntentId(String paymentIntentId);

    long countBySellerIdAndStatus(UUID sellerId, ShopOrder.ShopOrderStatus status);
}
