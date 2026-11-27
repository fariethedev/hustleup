package com.hustleup.marketplace.payments.service;

import com.hustleup.marketplace.booking.repository.BookingRepository;
import com.hustleup.marketplace.booking.service.BookingService;
import com.hustleup.marketplace.shop.model.ShopOrder;
import com.hustleup.marketplace.shop.repository.ShopOrderRepository;
import com.hustleup.marketplace.shop.service.ShopCheckoutService;
import com.stripe.Stripe;
import com.stripe.model.checkout.Session;
import com.stripe.param.checkout.SessionListParams;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Safety net that makes "the buyer paid" true in our database whenever it is true in Stripe.
 *
 * <p>A payment is applied by the {@code checkout.session.completed} webhook or by the buyer's
 * app calling {@code /bookings/confirm-payment} on return. Both can fail silently: a webhook
 * endpoint left pointing at an old host, a local server Stripe cannot reach, an app closed
 * before it returned. Each of those left a paid order looking unpaid — and an unpaid order is
 * never shipped, never tracked and never paid out to the seller.
 *
 * <p>So every couple of minutes this asks Stripe for recently completed, paid checkout
 * sessions (the last week by default) and applies any whose bookings or shop orders are still unpaid, through exactly the
 * same idempotent code the webhook uses. Sessions that are already applied are skipped
 * without a write.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class CheckoutReconciler {

    private static final List<String> SETTLED = List.of("PAID", "TRANSFERRED", "REFUNDED");

    private final BookingRepository bookingRepository;
    private final ShopOrderRepository shopOrderRepository;
    private final BookingService bookingService;
    private final ShopCheckoutService shopCheckoutService;

    /** How far back to look. A week covers a webhook outage that went unnoticed for days. */
    @Value("${app.payments.reconcile-lookback-hours:168}")
    private long lookbackHours = 168;

    @Scheduled(initialDelayString = "${app.payments.reconcile-initial-ms:60000}",
               fixedDelayString = "${app.payments.reconcile-ms:120000}")
    public void reconcile() {
        if (Stripe.apiKey == null || Stripe.apiKey.isBlank()) return;
        long since = Instant.now().minus(Duration.ofHours(lookbackHours)).getEpochSecond();
        SessionListParams params = SessionListParams.builder()
                .setStatus(SessionListParams.Status.COMPLETE)
                .setCreated(SessionListParams.Created.builder().setGte(since).build())
                .setLimit(100L)
                .build();
        int applied = 0;
        try {
            for (Session session : Session.list(params).autoPagingIterable()) {
                if (!"paid".equals(session.getPaymentStatus())) continue;
                Map<String, String> meta = session.getMetadata();
                if (meta == null) continue; // subscription sessions and others we did not create
                try {
                    if (hasUnpaidBooking(meta.get("bookingIds"))) {
                        bookingService.applyPaidSession(session);
                        applied++;
                    }
                    if (hasUnpaidShopOrder(meta.get("shopOrderIds"))) {
                        shopCheckoutService.applyPaidSession(session);
                        applied++;
                    }
                } catch (Exception e) {
                    // One bad session must not stop the rest from being reconciled.
                    log.warn("Could not reconcile checkout session {}: {}", session.getId(), e.getMessage());
                }
            }
        } catch (Exception e) {
            log.warn("Checkout reconciliation skipped: {}", e.getMessage());
            return;
        }
        if (applied > 0) log.info("Checkout reconciliation applied {} paid session(s) a webhook had missed", applied);
    }

    private boolean hasUnpaidBooking(String csv) {
        if (csv == null || csv.isBlank()) return false;
        for (String raw : csv.split(",")) {
            UUID id = parse(raw);
            if (id != null && bookingRepository.findById(id)
                    .map(b -> !SETTLED.contains(b.getPaymentStatus()) && b.getStatus() != null
                            && !"CANCELLED".equals(b.getStatus().name()))
                    .orElse(false)) return true;
        }
        return false;
    }

    private boolean hasUnpaidShopOrder(String csv) {
        if (csv == null || csv.isBlank()) return false;
        for (String raw : csv.split(",")) {
            UUID id = parse(raw);
            if (id != null && shopOrderRepository.findById(id)
                    .map(o -> o.getStatus() == ShopOrder.ShopOrderStatus.AWAITING_PAYMENT)
                    .orElse(false)) return true;
        }
        return false;
    }

    private static UUID parse(String raw) {
        try { return UUID.fromString(raw.trim()); } catch (Exception e) { return null; }
    }
}
