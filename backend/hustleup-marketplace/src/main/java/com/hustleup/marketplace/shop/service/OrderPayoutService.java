/**
 * Releases storefront money to sellers.
 *
 * <h2>Why money is held rather than paid at checkout</h2>
 * The buyer's card is charged when they check out, and that charge lands on the platform's
 * Stripe balance. It is not the seller's yet. Paying out at that moment would mean the
 * platform has no way to make a buyer whole if the parcel never arrives — the money would
 * already be gone, and a refund would have to come out of the platform's own pocket or be
 * clawed back from a seller who may have spent it.
 *
 * <h2>What releases it</h2>
 * Two things, and the second exists because of what the first alone would do to sellers:
 *
 * <ul>
 *   <li><b>The buyer confirms receipt.</b> The normal path, and immediate — a buyer who has
 *       their goods has no reason to wait for their money to reach the seller.</li>
 *   <li><b>The hold period expires.</b> Buyers forget. A seller whose payout depended solely
 *       on a buyer remembering to press a button would be financing the platform indefinitely
 *       through no fault of their own, so an order the seller marked delivered waits at least 30 days and a further
 *       48 hours after a persisted buyer reminder.</li>
 * </ul>
 *
 * The timer starts at reported delivery, not at payment: a seller who has not sent anything should not
 * be accruing a claim on the buyer's money, and the buyer's window to object should begin when
 * there is something to object about.
 *
 * <h2>Failure is visible, never silent</h2>
 * A seller who has not finished Stripe Connect onboarding has nowhere to receive a transfer.
 * That is not an error — it is a normal state for a new seller — so the order stays HELD and
 * is picked up by a later sweep once they onboard. A Stripe failure likewise leaves the order
 * HELD rather than marking it paid, because money the platform still owes must not be able to
 * disappear from the ledger by being recorded as sent.
 */
package com.hustleup.marketplace.shop.service;

import com.hustleup.common.model.Notification;
import com.hustleup.common.repository.NotificationRepository;
import com.hustleup.marketplace.payments.model.SellerPayoutAccount;
import com.hustleup.marketplace.payments.repository.SellerPayoutAccountRepository;
import com.hustleup.marketplace.payments.service.StripeConnectService;
import com.hustleup.marketplace.protection.model.ProtectionClaim.ClaimOrderType;
import com.hustleup.marketplace.protection.service.ProtectionClaimService;
import com.hustleup.marketplace.shop.model.ShopOrder;
import com.hustleup.marketplace.shop.repository.ShopOrderRepository;
import com.stripe.exception.StripeException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class OrderPayoutService {

    private static final Logger log = LoggerFactory.getLogger(OrderPayoutService.class);

    private final ShopOrderRepository orderRepository;
    private final com.hustleup.marketplace.safety.SellerSafetyService sellerSafety;
    private final org.springframework.transaction.PlatformTransactionManager transactions;
    private final SellerPayoutAccountRepository payoutAccountRepository;
    private final StripeConnectService stripeConnectService;
    private final NotificationRepository notificationRepository;
    /** Consulted before every release: an open buyer claim freezes the money where it sits. */
    private final ProtectionClaimService protectionClaimService;

    /**
     * How long a seller-reported delivery waits before releasing without the buyer saying anything.
     *
     * <p>Configurable because it is a policy judgement, not a technical constant: it trades a
     * buyer's window to raise a problem against how long a seller waits to be paid.
     */
    @Value("#{T(java.lang.Math).max(30, ${app.payouts.hold-days:30})}")
    private int holdDays;

    public OrderPayoutService(ShopOrderRepository orderRepository,
                              SellerPayoutAccountRepository payoutAccountRepository,
                              StripeConnectService stripeConnectService,
                              NotificationRepository notificationRepository,
                              ProtectionClaimService protectionClaimService,
                              com.hustleup.marketplace.safety.SellerSafetyService sellerSafety,
                              org.springframework.transaction.PlatformTransactionManager transactions) {
        this.sellerSafety = sellerSafety;
        this.transactions = transactions;
        this.orderRepository = orderRepository;
        this.payoutAccountRepository = payoutAccountRepository;
        this.stripeConnectService = stripeConnectService;
        this.notificationRepository = notificationRepository;
        this.protectionClaimService = protectionClaimService;
    }

    /**
     * Attempts to pay one order out. Safe to call repeatedly and from either trigger.
     *
     * @return true if money moved on this call
     */
    @Transactional
    public boolean release(ShopOrder order) {
        if (sellerSafety.suspended(order.getSellerId())) return false;
        sellerSafety.lockAndRequireActive(order.getSellerId());
        // Already released, refunded, or never paid for. Re-releasing would pay a seller twice
        // out of a single charge, so this guard is the one that must not be removed.
        if (!"HELD".equals(order.getPayoutStatus())) return false;
        if (order.getStatus() == ShopOrder.ShopOrderStatus.AWAITING_PAYMENT
                || order.getStatus() == ShopOrder.ShopOrderStatus.CANCELLED
                || order.getStatus() == ShopOrder.ShopOrderStatus.REFUNDED) {
            return false;
        }

        var fulfilment = order.getFulfilment();
        if (fulfilment.getBuyerConfirmedAt() == null) {
            if (fulfilment.isBuyerConfirmationRequired()) return false;
            LocalDateTime now = LocalDateTime.now();
            if (fulfilment.automaticReleaseEligibleAt(holdDays) == null
                    || fulfilment.automaticReleaseEligibleAt(holdDays).isAfter(now)) return false;
            if (fulfilment.getReleaseReminderAt() == null) {
                // Do not stamp a failed notification: the next sweep must retry it.
                notificationRepository.save(Notification.builder()
                        .userId(order.getBuyerId()).referenceId(order.getId())
                        .notificationType("PAYOUT")
                        .title("Got it? Confirm or report")
                        .message("Your seller's payment is due for release in 48 hours. Confirm receipt or open a protection claim from your order if there is a problem.")
                        .build());
                fulfilment.setReleaseReminderAt(now);
                orderRepository.save(order);
                return false;
            }
            if (!fulfilment.automaticReleaseReady(now, holdDays)) return false;
        }

        // An open buyer claim freezes the money. The hold period protects a buyer who never
        // presses anything, but it is also a deadline — this is what stops a buyer whose parcel
        // never arrived from having to beat it.
        if (protectionClaimService.isFrozen(ClaimOrderType.SHOP_ORDER, order.getId())) {
            log.info("Order {} has an open protection claim — payout stays held", order.getId());
            return false;
        }

        var stored = payoutAccountRepository.findBySellerId(order.getSellerId()).orElse(null);
        // The stored payoutsEnabled is a cache of Stripe's answer, kept current by the
        // account.updated webhook and by the seller opening the payouts page. A test-mode
        // platform often has no webhook at all, so a false flag is re-checked at source
        // before it is allowed to hold real money back.
        if (stored != null && !stored.isPayoutsEnabled()) {
            try {
                stored = stripeConnectService.refreshAccountStatus(stored);
            } catch (StripeException e) {
                log.warn("Could not refresh payout account for seller {}: {}",
                        order.getSellerId(), e.getMessage());
            }
        }
        var account = java.util.Optional.ofNullable(stored)
                .filter(SellerPayoutAccount::isPayoutsEnabled);
        if (account.isEmpty()) {
            // Not a failure: a seller who has not finished onboarding has nowhere to receive
            // this. Left HELD so a later sweep pays them the moment they do.
            //
            // Said out loud, though. This used to be a log line on the server, so the seller
            // saw an order they had completed, no money, and no reason — which is exactly how
            // "there are no payouts even though sellers are completing orders" looks from the
            // inside. Sent once per order, because the hourly sweep revisits the same ones.
            log.info("Order {} is due but seller {} has no payouts-enabled account — holding",
                    order.getId(), order.getSellerId());
            if (order.getPayoutBlockedNotifiedAt() == null) {
                notify(order.getSellerId(), "Connect payouts to get paid",
                        "Your sale of " + order.getProductName() + " is ready to pay out, but "
                        + "your payout account isn't set up yet. Finish it in your dashboard and "
                        + "we'll send the money automatically.");
                order.setPayoutBlockedNotifiedAt(LocalDateTime.now());
                orderRepository.save(order);
            }
            return false;
        }

        try {
            String transferId = stripeConnectService.transferToSeller(order, account.get().getStripeAccountId());
            order.setTransferId(transferId);
            order.setPayoutStatus("RELEASED");
            order.setReleasedAt(LocalDateTime.now());
            orderRepository.save(order);

            notify(order.getSellerId(), "Funds released to Stripe",
                    "Your earnings for " + order.getProductName() + " were transferred to your Stripe balance. Open Payments to check bank arrival dates.");
            log.info("Released order {} to seller {} (transfer {})",
                    order.getId(), order.getSellerId(), transferId);
            return true;
        } catch (StripeException e) {
            // Stays HELD on purpose. Marking it released would erase, from the platform's own
            // records, money it still owes this seller.
            log.error("Payout failed for order {} — left held: {}", order.getId(), e.getMessage());
            return false;
        }
    }

    /**
     * Releases everything that has come due.
     *
     * <p>Hourly rather than on a timer per order: the hold period is measured in days, so an
     * hour of latency is immaterial, and one query beats thousands of scheduled tasks that
     * would not survive a restart.
     *
     * <p>This sweep is also what eventually pays a seller who completed Connect onboarding
     * after their first sale — their orders sat HELD with nowhere to go, and are picked up
     * here once an account exists.
     */
    @Scheduled(fixedDelayString = "${app.payouts.sweep-ms:3600000}")
    public void releaseDueOrders() {
        LocalDateTime cutoff = LocalDateTime.now().minusDays(holdDays);
        List<ShopOrder> due = orderRepository.findReleasable(cutoff,
                // Carrier-confirmed delivery still waits 48 hours, so the buyer can open the parcel
                // and report a fake or broken item before the money leaves.
                LocalDateTime.now().minusHours(48));
        if (due.isEmpty()) return;

        int released = 0;
        for (ShopOrder order : due) {
            try {
                Boolean paid = new org.springframework.transaction.support.TransactionTemplate(transactions).execute(status -> {
                    sellerSafety.lockAndRequireActive(order.getSellerId());
                    return orderRepository.findLockedById(order.getId()).map(this::release).orElse(false);
                });
                if (Boolean.TRUE.equals(paid)) released++;
            } catch (RuntimeException e) { log.warn("Order {} remains held", order.getId()); }
        }
        log.info("Payout sweep: {} of {} due order(s) released", released, due.size());
    }


    private void notify(java.util.UUID userId, String title, String message) {
        try {
            notificationRepository.save(Notification.builder()
                    .userId(userId)
                    .title(title)
                    .message(message)
                    .notificationType("PAYOUT")
                    .build());
        } catch (Exception e) {
            // A notification that fails to save must never roll back a transfer that succeeded.
            log.warn("Could not notify {} about payout: {}", userId, e.getMessage());
        }
    }
}
