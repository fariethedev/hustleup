package com.hustleup.marketplace.protection.service;

import com.hustleup.common.model.Notification;
import com.hustleup.common.model.User;
import com.hustleup.common.repository.NotificationRepository;
import com.hustleup.common.repository.UserRepository;
import com.hustleup.marketplace.booking.model.Booking;
import com.hustleup.marketplace.booking.repository.BookingRepository;
import com.hustleup.marketplace.payments.service.StripeConnectService;
import com.hustleup.marketplace.protection.model.ProtectionClaim;
import com.hustleup.marketplace.protection.model.ProtectionClaim.ClaimOrderType;
import com.hustleup.marketplace.protection.model.ProtectionClaim.ClaimReason;
import com.hustleup.marketplace.protection.model.ProtectionClaim.ClaimStatus;
import com.hustleup.marketplace.protection.repository.ProtectionClaimRepository;
import com.hustleup.marketplace.shop.model.ShopOrder;
import com.hustleup.marketplace.shop.repository.ShopOrderRepository;
import com.stripe.exception.StripeException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Buyer protection: raising a claim, and what an admin does about it.
 *
 * <h2>The whole mechanism is the freeze</h2>
 * Money for both order kinds is already escrowed on the platform's Stripe balance until the
 * buyer confirms receipt or a hold period expires. That covers the buyer who never presses
 * anything, but the hold is a deadline, and a buyer whose parcel never came should not be
 * racing it. An OPEN claim stops the clock for that order, so the funds stay where they are
 * until a person decides — which is why {@link #isFrozen} is consulted by every release path
 * rather than only by the sweep.
 *
 * <h2>No reimbursement from the platform's own money</h2>
 * Deliberately not the Allegro model of paying the buyer immediately and then chasing the
 * seller for it. Because the funds are still held here, there is nothing to chase in the
 * ordinary case: the refund comes out of the buyer's own captured charge. The one case that
 * model exists for — money already gone to the seller — is exactly what the freeze prevents.
 */
@Service
@Slf4j
public class ProtectionClaimService {

    private final ProtectionClaimRepository claimRepository;
    private final BookingRepository bookingRepository;
    private final ShopOrderRepository shopOrderRepository;
    private final StripeConnectService stripeConnectService;
    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;

    public ProtectionClaimService(ProtectionClaimRepository claimRepository,
                                  BookingRepository bookingRepository,
                                  ShopOrderRepository shopOrderRepository,
                                  StripeConnectService stripeConnectService,
                                  NotificationRepository notificationRepository,
                                  UserRepository userRepository) {
        this.claimRepository = claimRepository;
        this.bookingRepository = bookingRepository;
        this.shopOrderRepository = shopOrderRepository;
        this.stripeConnectService = stripeConnectService;
        this.notificationRepository = notificationRepository;
        this.userRepository = userRepository;
    }

    /**
     * Whether this order's money is frozen by an open claim.
     *
     * <p>Called from the release paths on both sides. Kept as a plain existence check so it
     * costs one indexed lookup on the hourly sweep rather than loading rows nobody reads.
     */
    public boolean isFrozen(ClaimOrderType orderType, UUID orderId) {
        return claimRepository.existsByOrderTypeAndOrderIdAndStatus(orderType, orderId, ClaimStatus.OPEN);
    }

    /**
     * A buyer reporting that an order went wrong.
     *
     * <p>Only the buyer on the order may file, and only once at a time — a second claim while
     * the first is open would split one dispute across two queue entries that could be decided
     * differently. Filing is allowed even after the buyer confirmed receipt: things turn out to
     * be broken after they are opened, and the confirmation may itself have been the mistake.
     */
    @Transactional
    public ProtectionClaim raise(ClaimOrderType orderType, UUID orderId, ClaimReason reason, String detail) {
        User buyer = currentUser();

        UUID sellerId;
        if (orderType == ClaimOrderType.BOOKING) {
            Booking booking = bookingRepository.findById(orderId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));
            requireBuyer(booking.getBuyerId(), buyer.getId());
            sellerId = booking.getSellerId();
        } else {
            ShopOrder order = shopOrderRepository.findById(orderId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found"));
            requireBuyer(order.getBuyerId(), buyer.getId());
            sellerId = order.getSellerId();
        }

        claimRepository.findFirstByOrderTypeAndOrderIdAndStatus(orderType, orderId, ClaimStatus.OPEN)
                .ifPresent(existing -> {
                    throw new ResponseStatusException(HttpStatus.CONFLICT,
                            "You already have an open claim on this order");
                });

        ProtectionClaim claim = claimRepository.save(ProtectionClaim.builder()
                .orderType(orderType)
                .orderId(orderId)
                .buyerId(buyer.getId())
                .sellerId(sellerId)
                .reason(reason)
                .detail(detail)
                .status(ClaimStatus.OPEN)
                .build());

        // The seller is told, because a claim freezes money they were expecting and finding
        // that out from a missing payout is the worst way to learn it.
        notify(sellerId, "A buyer opened a claim",
                "Payment for this order is on hold while we review it. You'll be told the outcome.");
        notify(buyer.getId(), "Claim received",
                "We've put the payment on hold and will review it. Nothing is released to the seller meanwhile.");

        log.info("Protection claim {} opened on {} {} by buyer {}", claim.getId(), orderType, orderId, buyer.getId());
        return claim;
    }

    /**
     * An admin deciding a claim.
     *
     * <p>{@code refund} true returns the buyer's charge and closes the order; false unfreezes
     * it and lets the money continue to the seller on the next sweep. Either way the claim
     * becomes terminal, which is what lifts the freeze — an unresolved claim holds funds
     * indefinitely by design, so the decision is the only thing that releases them.
     */
    @Transactional
    public ProtectionClaim resolve(UUID claimId, boolean refund, String note) {
        User admin = currentUser();
        ProtectionClaim claim = claimRepository.findById(claimId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Claim not found"));
        if (claim.getStatus() != ClaimStatus.OPEN) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This claim has already been decided");
        }

        if (refund) {
            refundOrder(claim);
        }

        claim.setStatus(refund ? ClaimStatus.REFUNDED : ClaimStatus.REJECTED);
        claim.setResolutionNote(note);
        claim.setResolvedBy(admin.getId());
        claim.setResolvedAt(LocalDateTime.now());

        String outcome = refund ? "refunded" : "closed without a refund";
        notify(claim.getBuyerId(), "Your claim was " + outcome,
                note == null || note.isBlank() ? "The review is complete." : note);
        notify(claim.getSellerId(), "A claim on your sale was " + outcome,
                refund ? "The buyer has been refunded and the payment will not be released."
                       : "The hold has been lifted and your payout will follow.");

        log.info("Protection claim {} resolved as {} by {}", claimId, claim.getStatus(), admin.getId());
        return claimRepository.save(claim);
    }

    /**
     * Returns the buyer's money and takes the order out of the payout path for good.
     *
     * <p>The refund is against the captured PaymentIntent, so it comes out of the charge the
     * buyer actually made rather than the platform's own balance — possible only because the
     * money never left. An order with nothing captured is marked refunded without calling
     * Stripe: there is no charge to reverse, and failing here would block a decision that is
     * otherwise correct.
     */
    private void refundOrder(ProtectionClaim claim) {
        if (claim.getOrderType() == ClaimOrderType.BOOKING) {
            Booking booking = bookingRepository.findById(claim.getOrderId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));
            attemptRefund(booking.getPaymentIntentId(), claim.getOrderId());
            booking.setPaymentStatus("REFUNDED");
            booking.setStatus(com.hustleup.marketplace.booking.model.BookingStatus.CANCELLED);
            booking.setCancelReason("Refunded after a buyer protection claim");
            booking.setUpdatedAt(LocalDateTime.now());
            bookingRepository.save(booking);
        } else {
            ShopOrder order = shopOrderRepository.findById(claim.getOrderId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found"));
            attemptRefund(order.getPaymentIntentId(), claim.getOrderId());
            order.setStatus(ShopOrder.ShopOrderStatus.REFUNDED);
            // Takes it out of findReleasable for good, so no later sweep can pay a seller for
            // an order the platform has already given back.
            order.setPayoutStatus("REFUNDED");
            order.setUpdatedAt(LocalDateTime.now());
            shopOrderRepository.save(order);
        }
    }

    private void attemptRefund(String paymentIntentId, UUID orderId) {
        if (paymentIntentId == null || paymentIntentId.isBlank()) {
            log.info("Claim refund on {} had no captured payment — marking refunded without Stripe", orderId);
            return;
        }
        try {
            stripeConnectService.refundPayment(paymentIntentId);
        } catch (StripeException e) {
            // Loud, and it aborts the resolution: recording a refund Stripe did not make would
            // tell a buyer their money is coming back when it is not.
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Stripe refused the refund: " + e.getMessage());
        }
    }

    public List<ProtectionClaim> open() {
        return claimRepository.findByStatusOrderByCreatedAtAsc(ClaimStatus.OPEN);
    }

    public List<ProtectionClaim> all() {
        return claimRepository.findAllByOrderByCreatedAtDesc();
    }

    public List<ProtectionClaim> mine() {
        return claimRepository.findByBuyerIdOrderByCreatedAtDesc(currentUser().getId());
    }

    private void requireBuyer(UUID orderBuyerId, UUID callerId) {
        if (!orderBuyerId.equals(callerId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the buyer can raise a claim on this order");
        }
    }

    private User currentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Not signed in"));
    }

    private void notify(UUID userId, String title, String message) {
        try {
            notificationRepository.save(Notification.builder()
                    .userId(userId)
                    .title(title)
                    .message(message)
                    .notificationType("PROTECTION_CLAIM")
                    .build());
        } catch (Exception e) {
            // A notification that fails to save must never roll back the decision it describes.
            log.warn("Could not notify {} about a claim: {}", userId, e.getMessage());
        }
    }
}
