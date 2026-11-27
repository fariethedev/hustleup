package com.hustleup.marketplace.payments.service;

import com.hustleup.common.model.User;
import com.hustleup.common.repository.UserRepository;
import com.hustleup.marketplace.booking.model.*;
import com.hustleup.marketplace.booking.repository.BookingRepository;
import com.hustleup.marketplace.shop.model.ShopOrder;
import com.hustleup.marketplace.shop.repository.ShopOrderRepository;
import com.hustleup.marketplace.review.model.Review;
import com.hustleup.marketplace.review.repository.ReviewRepository;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class SellerRiskServiceTest {
    final UserRepository users = mock(UserRepository.class);
    final BookingRepository bookings = mock(BookingRepository.class);
    final ShopOrderRepository orders = mock(ShopOrderRepository.class);
    final ReviewRepository reviews = mock(ReviewRepository.class);
    final com.hustleup.marketplace.protection.repository.ProtectionClaimRepository claims = mock(com.hustleup.marketplace.protection.repository.ProtectionClaimRepository.class);
    final SellerRiskService service = new SellerRiskService(users, mock(com.hustleup.marketplace.safety.SellerSafetyService.class), bookings, orders, reviews, claims);
    final UUID seller = UUID.randomUUID(), buyer = UUID.randomUUID();

    List<Booking> history(int count, String currency, String amount) {
        List<Booking> rows = new ArrayList<>();
        List<Review> ratings = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            var b = Booking.builder().id(UUID.randomUUID()).buyerId(buyer).sellerId(seller)
                    .status(BookingStatus.COMPLETED).paymentStatus("TRANSFERRED").paymentIntentId("pi_" + i)
                    .agreedPrice(new BigDecimal(amount)).currency(currency).build();
            b.getFulfilment().setBuyerConfirmedAt(LocalDateTime.now()); rows.add(b);
            ratings.add(Review.builder().bookingId(b.getId()).reviewedId(seller).reviewerId(buyer).rating(5).build());
        }
        when(bookings.findBySellerIdOrderByCreatedAtDesc(seller)).thenReturn(rows);
        when(reviews.findByReviewedIdOrderByCreatedAtDesc(seller)).thenReturn(ratings);
        return rows;
    }
    @Test void newSellerNeedsReceiptAndHasThreeSlots() {
        var risk = service.status(seller);
        assertEquals("NEW", risk.tier()); assertEquals(3, risk.openOrderLimit());
        assertTrue(risk.buyerConfirmationRequired());
    }
    @Test void fiveConfirmedSalesAndPlnThresholdWithGoodReviewsUnlockTenSlots() {
        history(5, "PLN", "400");
        var risk = service.status(seller);
        assertEquals("ESTABLISHED", risk.tier()); assertEquals(10, risk.openOrderLimit());
        assertFalse(risk.buyerConfirmationRequired());
    }
    @Test void trustedSellerUnlocksTwentyFiveSlots() {
        history(25, "PLN", "400");
        assertEquals("TRUSTED", service.status(seller).tier());
        assertEquals(25, service.status(seller).openOrderLimit());
    }
    @Test void foreignCurrenciesAreNotAddedAsPlnAndOneExpensiveSaleDoesNotGraduate() {
        history(5, "EUR", "2000");
        assertEquals(BigDecimal.ZERO, service.status(seller).confirmedPlnSales());
        assertEquals("NEW", service.status(seller).tier());
        history(1, "PLN", "10000");
        assertEquals("NEW", service.status(seller).tier());
    }
    @Test void sellerReportedCompletionAndRefundsDoNotBuildTrust() {
        var rows = history(5, "PLN", "400");
        rows.get(0).getFulfilment().setBuyerConfirmedAt(null);
        rows.get(1).setPaymentStatus("REFUNDED");
        rows.get(2).setPaymentIntentId(null);
        var risk = service.status(seller);
        assertEquals(2, risk.confirmedSales()); assertEquals("NEW", risk.tier());
    }
    @Test void reviewsAsBuyerAndUnrelatedReviewsCannotPromoteSeller() {
        history(5, "PLN", "400");
        when(reviews.findByReviewedIdOrderByCreatedAtDesc(seller)).thenReturn(List.of(
                Review.builder().bookingId(UUID.randomUUID()).reviewerId(buyer).rating(5).build()));
        assertEquals(0, service.status(seller).buyerReviews());
        assertEquals("NEW", service.status(seller).tier());
    }
    @Test void lowRatingsKeepReceiptRequirement() {
        var rows = history(5, "PLN", "400");
        when(reviews.findByReviewedIdOrderByCreatedAtDesc(seller)).thenReturn(rows.stream().map(b ->
                Review.builder().bookingId(b.getId()).reviewerId(buyer).rating(2).build()).toList());
        assertTrue(service.status(seller).buyerConfirmationRequired());
    }
    @Test void capCombinesBothOrderTypesAndIncludesUnpaidReservations() {
        when(users.findLockedById(seller)).thenReturn(Optional.of(User.builder().id(seller).build()));
        when(bookings.findSellerOrdersForAdmission(seller)).thenReturn(List.of(
                Booking.builder().status(BookingStatus.BOOKED).paymentStatus("PENDING").build()));
        when(orders.findSellerOrdersForAdmission(seller)).thenReturn(List.of(ShopOrder.builder().build()));
        assertEquals(2, service.admit(seller, 1).openOrders());
        assertThrows(ResponseStatusException.class, () -> service.admit(seller, 2));
        var sequence = inOrder(users, bookings, orders);
        sequence.verify(users).findLockedById(seller);
        sequence.verify(bookings).findSellerOrdersForAdmission(seller);
        sequence.verify(orders).findSellerOrdersForAdmission(seller);
    }
    @Test void cancelledOrdersFreeSlots() {
        when(users.findLockedById(seller)).thenReturn(Optional.of(User.builder().id(seller).build()));
        when(orders.findSellerOrdersForAdmission(seller)).thenReturn(List.of(
                ShopOrder.builder().status(ShopOrder.ShopOrderStatus.CANCELLED).build()));
        assertEquals(0, service.admit(seller, 3).openOrders());
    }
    @Test void confirmedShopSalesContributeToSameTier() {
        history(4, "PLN", "400");
        var o = ShopOrder.builder().id(UUID.randomUUID()).sellerId(seller).buyerId(buyer)
                .status(ShopOrder.ShopOrderStatus.FULFILLED).paymentIntentId("pi_shop")
                .totalPrice(new BigDecimal("400")).currency("PLN").build();
        o.getFulfilment().setBuyerConfirmedAt(LocalDateTime.now());
        when(orders.findBySellerIdOrderByCreatedAtDesc(seller)).thenReturn(List.of(o));
        assertEquals("ESTABLISHED", service.status(seller).tier());
        assertEquals(5, service.status(seller).confirmedSales());
    }
    @Test void disputedSalesCannotPromoteSellerAndStillConsumeCapacity() {
        var rows = history(5, "PLN", "400");
        var claim = com.hustleup.marketplace.protection.model.ProtectionClaim.builder()
                .orderId(rows.get(0).getId())
                .orderType(com.hustleup.marketplace.protection.model.ProtectionClaim.ClaimOrderType.BOOKING).build();
        when(claims.findBySellerIdAndStatusIn(eq(seller), any())).thenReturn(List.of(claim));
        var risk = service.status(seller);
        assertEquals("NEW", risk.tier()); assertEquals(4, risk.confirmedSales());
        assertEquals(1, risk.openOrders());
    }
    @Test void failedCancellationRefundDoesNotFreeCapacity() {
        var b = Booking.builder().status(BookingStatus.CANCELLED).paymentStatus("PAID").build();
        when(bookings.findBySellerIdOrderByCreatedAtDesc(seller)).thenReturn(List.of(b));
        assertEquals(1, service.status(seller).openOrders());
    }
}
