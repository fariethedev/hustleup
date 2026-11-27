package com.hustleup.marketplace.safety;
import com.hustleup.common.repository.UserRepository;
import com.hustleup.marketplace.booking.repository.BookingRepository;
import com.hustleup.marketplace.booking.model.BookingStatus;
import com.hustleup.marketplace.shop.repository.ShopOrderRepository;
import com.hustleup.marketplace.shop.model.ShopOrder;
import com.hustleup.marketplace.payments.repository.SellerPayoutAccountRepository;
import com.hustleup.marketplace.payments.service.StripeConnectService;
import com.hustleup.marketplace.ticket.service.TicketService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.util.*;
@Service @RequiredArgsConstructor @Slf4j
public class SuspensionRecoveryService {
    private final SellerSafetyRepository states;
    private final SellerSafetyService safety;
    private final UserRepository users;
    private final BookingRepository bookings;
    private final ShopOrderRepository orders;
    private final SellerPayoutAccountRepository accounts;
    private final StripeConnectService stripe;
    private final PaymentDisputeRepository disputes;
    private final TicketService tickets;
    private final PlatformTransactionManager transactions;
    @Scheduled(fixedDelayString="${app.safety.retry-ms:300000}")
    public void retry() {
        for (var state : states.findBySuspendedTrue()) {
            try { recover(state.getSellerId()); }
            catch (Exception e) { log.warn("Suspension recovery pending for {}", state.getSellerId()); }
        }
    }
    public SellerSafety recover(UUID seller) {
        List<String> errors = new ArrayList<>();
        TransactionTemplate tx = new TransactionTemplate(transactions);
        tx.setPropagationBehavior(org.springframework.transaction.TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        tx.executeWithoutResult(status -> {
            users.findLockedById(seller).orElseThrow();
            var state = states.findLocked(seller).orElseThrow();
            safety.hide(seller); // retries search removal as well as DB visibility
            accounts.findBySellerId(seller).ifPresent(account -> {
                if (!state.isBankPayoutsPaused()) try {
                    stripe.pauseBankPayouts(account.getStripeAccountId()); state.setBankPayoutsPaused(true);
                } catch (Exception e) { errors.add("Stripe bank payout pause pending"); }
            });
            states.save(state);
        });
        if (states.findById(seller).orElseThrow().isRefundOpenOrders()) {
            for (var row : bookings.findBySellerIdOrderByCreatedAtDesc(seller)) {
                try { tx.executeWithoutResult(status -> {
                    users.findLockedById(seller).orElseThrow();
                    var b = bookings.findLockedById(row.getId()).orElseThrow();
                    if (!("PAID".equals(b.getPaymentStatus()) || "TRANSFERRED".equals(b.getPaymentStatus()))) return;
                    if (b.getFulfilment().getBuyerConfirmedAt() != null) return;
                    if (disputes.existsByPaymentIntentId(b.getPaymentIntentId())) return;
                    try {
                        if ("TRANSFERRED".equals(b.getPaymentStatus()) && b.getTransferId() == null)
                            throw new IllegalStateException("Payout transfer reference missing");
                        if (b.getTransferId() != null) stripe.recoverTransfer(b.getTransferId());
                        requirePayment(b.getPaymentIntentId(), b.getAgreedPrice());
                        stripe.refundPayment(b.getPaymentIntentId(), b.getAgreedPrice().add(b.getFulfilment().shippingPriceOrZero()), b.getId());
                    } catch (Exception e) { throw new IllegalStateException("Refund pending", e); }
                    b.setPaymentStatus("REFUNDED"); b.setStatus(BookingStatus.CANCELLED);
                    b.setCancelReason("Seller suspended: order refunded"); tickets.voidForBooking(b.getId());
                    bookings.save(b);
                }); } catch (Exception e) { errors.add("Booking " + row.getId() + " refund pending"); }
            }
            for (var row : orders.findBySellerIdOrderByCreatedAtDesc(seller)) {
                try { tx.executeWithoutResult(status -> {
                    users.findLockedById(seller).orElseThrow();
                    var o = orders.findLockedById(row.getId()).orElseThrow();
                    if (o.getStatus() != ShopOrder.ShopOrderStatus.PAID && o.getStatus() != ShopOrder.ShopOrderStatus.FULFILLED) return;
                    if (o.getFulfilment().getBuyerConfirmedAt() != null) return;
                    if (disputes.existsByPaymentIntentId(o.getPaymentIntentId())) return;
                    try {
                        if ("RELEASED".equals(o.getPayoutStatus()) && o.getTransferId() == null)
                            throw new IllegalStateException("Payout transfer reference missing");
                        if (o.getTransferId() != null) stripe.recoverTransfer(o.getTransferId());
                        requirePayment(o.getPaymentIntentId(), o.grandTotal());
                        stripe.refundPayment(o.getPaymentIntentId(), o.grandTotal(), o.getId());
                    } catch (Exception e) { throw new IllegalStateException("Refund pending", e); }
                    o.setPayoutStatus("REFUNDED"); o.setStatus(ShopOrder.ShopOrderStatus.REFUNDED); orders.save(o);
                }); } catch (Exception e) { errors.add("Shop order " + row.getId() + " refund pending"); }
            }
        }
        return tx.execute(status -> {
            var state = states.findLocked(seller).orElseThrow();
            String error = String.join("; ", errors);
            state.setLastError(error.isEmpty() ? null : error.substring(0, Math.min(2000, error.length())));
            return states.save(state);
        });
    }
    private void requirePayment(String id, java.math.BigDecimal amount) {
        if (id == null || id.isBlank() || amount == null || amount.signum() <= 0)
            throw new IllegalStateException("Payment needs manual reconciliation");
    }
}
