package com.hustleup.marketplace.payments.service;

import com.hustleup.marketplace.protection.repository.ProtectionClaimRepository;
import com.hustleup.marketplace.protection.model.ProtectionClaim.ClaimStatus;
import com.hustleup.marketplace.protection.model.ProtectionClaim.ClaimOrderType;


import com.hustleup.common.repository.UserRepository;
import com.hustleup.marketplace.booking.model.Booking;
import com.hustleup.marketplace.booking.model.BookingStatus;
import com.hustleup.marketplace.booking.repository.BookingRepository;
import com.hustleup.marketplace.shop.model.ShopOrder;
import com.hustleup.marketplace.shop.repository.ShopOrderRepository;
import com.hustleup.marketplace.review.repository.ReviewRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.math.BigDecimal;
import java.util.*;

/** Shared seller limits. Only paid, buyer-confirmed sales and their buyer reviews build trust. */
@Service
@RequiredArgsConstructor
public class SellerRiskService {
    private final UserRepository users;
    private final com.hustleup.marketplace.safety.SellerSafetyService sellerSafety;
    private final BookingRepository bookings;
    private final ShopOrderRepository orders;
    private final ReviewRepository reviews;
    private final ProtectionClaimRepository claims;

    public record Risk(String tier, int openOrderLimit, long openOrders, long confirmedSales,
                       BigDecimal confirmedPlnSales, int buyerReviews, double averageBuyerRating,
                       boolean buyerConfirmationRequired) {}

    /** Caller must keep this transaction open through insertion of all requested order rows. */
    @Transactional(propagation = Propagation.MANDATORY)
    public Risk admit(UUID sellerId, int requestedOrders) {
        if (requestedOrders < 1) throw new IllegalArgumentException("At least one order is required");
        users.findLockedById(sellerId).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Seller not found"));
        sellerSafety.lockAndRequireActive(sellerId);
        Risk risk = assess(sellerId, bookings.findSellerOrdersForAdmission(sellerId),
                orders.findSellerOrdersForAdmission(sellerId));
        if (requestedOrders > risk.openOrderLimit() - risk.openOrders()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "This seller has reached their open-order limit (" + risk.openOrderLimit()
                            + "). Please try again after an existing order is completed or cancelled.");
        }
        return risk;
    }

    @Transactional(readOnly = true)
    public Risk status(UUID sellerId) {
        return assess(sellerId, bookings.findBySellerIdOrderByCreatedAtDesc(sellerId),
                orders.findBySellerIdOrderByCreatedAtDesc(sellerId));
    }

    private Risk assess(UUID sellerId, List<Booking> bookingRows, List<ShopOrder> orderRows) {
        Set<UUID> disputedBookings = new HashSet<>(), disputedOrders = new HashSet<>();
        for (var claim : claims.findBySellerIdAndStatusIn(sellerId, List.of(
                ClaimStatus.OPEN,
                ClaimStatus.REFUNDED))) {
            if (claim.getOrderType() == ClaimOrderType.BOOKING)
                disputedBookings.add(claim.getOrderId());
            else disputedOrders.add(claim.getOrderId());
        }
        long open = 0;
        BigDecimal pln = BigDecimal.ZERO;
        Map<UUID, UUID> confirmedBookings = new HashMap<>();
        Map<UUID, UUID> confirmedOrders = new HashMap<>();
        for (Booking b : bookingRows) {
            if ("REFUNDED".equals(b.getPaymentStatus())
                    || "FAILED".equals(b.getPaymentStatus())) continue;
            if (b.getStatus() == BookingStatus.CANCELLED) {
                // A failed cancellation refund still leaves an exposure; do not free its slot.
                if ("PAID".equals(b.getPaymentStatus())) open++;
                continue;
            }
            if (disputedBookings.contains(b.getId())) { open++; continue; }
            boolean paid = "PAID".equals(b.getPaymentStatus()) || "TRANSFERRED".equals(b.getPaymentStatus());
            if (!paid || b.getFulfilment().getBuyerConfirmedAt() == null) { open++; continue; }
            if (b.getBuyerId().equals(sellerId) || b.getPaymentIntentId() == null || b.getPaymentIntentId().isBlank()
                    || b.getAgreedPrice() == null || b.getAgreedPrice().signum() <= 0) continue;
            confirmedBookings.put(b.getId(), b.getBuyerId());
            if ("PLN".equalsIgnoreCase(b.getCurrency())) pln = pln.add(b.getAgreedPrice());
        }
        for (ShopOrder o : orderRows) {
            if (o.getStatus() == ShopOrder.ShopOrderStatus.CANCELLED || o.getStatus() == ShopOrder.ShopOrderStatus.REFUNDED
                    || "REFUNDED".equals(o.getPayoutStatus())) continue;
            if (disputedOrders.contains(o.getId())) { open++; continue; }
            boolean paid = o.getStatus() == ShopOrder.ShopOrderStatus.PAID || o.getStatus() == ShopOrder.ShopOrderStatus.FULFILLED;
            if (!paid || o.getFulfilment().getBuyerConfirmedAt() == null) { open++; continue; }
            if (o.getBuyerId().equals(sellerId) || o.getPaymentIntentId() == null || o.getPaymentIntentId().isBlank()
                    || o.getTotalPrice() == null || o.getTotalPrice().signum() <= 0) continue;
            confirmedOrders.put(o.getId(), o.getBuyerId());
            if ("PLN".equalsIgnoreCase(o.getCurrency())) pln = pln.add(o.getTotalPrice());
        }
        int reviewCount = 0, ratingSum = 0;
        for (var review : reviews.findByReviewedIdOrderByCreatedAtDesc(sellerId)) {
            UUID buyer = review.getBookingId() != null ? confirmedBookings.get(review.getBookingId())
                    : confirmedOrders.get(review.getShopOrderId());
            if (buyer != null && buyer.equals(review.getReviewerId()) && !buyer.equals(sellerId)) {
                reviewCount++; ratingSum += review.getRating();
            }
        }
        long sales = confirmedBookings.size() + confirmedOrders.size();
        double rating = reviewCount == 0 ? 0 : (double) ratingSum / reviewCount;
        boolean established = sales >= 5 && pln.compareTo(new BigDecimal("2000")) >= 0 && reviewCount >= 3 && rating >= 4;
        boolean trusted = established && sales >= 25 && pln.compareTo(new BigDecimal("10000")) >= 0 && reviewCount >= 10;
        return new Risk(trusted ? "TRUSTED" : established ? "ESTABLISHED" : "NEW",
                trusted ? 25 : established ? 10 : 3, open, sales, pln, reviewCount, rating, !established);
    }
}
