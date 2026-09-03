package com.hustleup.marketplace.shop.repository;

import com.hustleup.marketplace.shop.model.ShopOrder;
import java.time.LocalDateTime;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.Query;
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

    /**
     * Orders whose money is due to be released to the seller.
     *
     * <p>Two ways an order becomes due, matching the two release triggers: the buyer confirmed
     * receipt, or the seller dispatched it and the hold period has since elapsed. The dispatch
     * timestamp is what the cutoff is measured against, not the payment — a seller who has not
     * sent anything should not accrue a claim on the buyer's money just by waiting.
     *
     * <p>REFUNDED and CANCELLED orders are excluded by the status filter; AWAITING_PAYMENT has
     * no captured charge to release.
     */
    @Query("""
            SELECT o FROM ShopOrder o
             WHERE o.payoutStatus = 'HELD'
               AND o.status IN (com.hustleup.marketplace.shop.model.ShopOrder$ShopOrderStatus.PAID,
                                com.hustleup.marketplace.shop.model.ShopOrder$ShopOrderStatus.FULFILLED)
               AND (o.fulfilment.buyerConfirmedAt IS NOT NULL
                    OR (o.fulfilment.shippedAt IS NOT NULL AND o.fulfilment.shippedAt < :cutoff))
            """)
    List<ShopOrder> findReleasable(@Param("cutoff") LocalDateTime cutoff);
}
