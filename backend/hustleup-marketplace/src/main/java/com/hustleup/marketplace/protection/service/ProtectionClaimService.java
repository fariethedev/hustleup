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
 * Paid-out orders must recover their seller transfer before refunding the buyer. If Stripe
 * refuses recovery, resolution fails and the claim stays open for an operator to retry.
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
    /** Strikes on decisions against the seller. Lazy: trust services sit above this one. */
    private final com.hustleup.marketplace.trust.TrustService trust;

    /** How long a seller has to answer a claim, and either side to appeal a decision. */
    static final int RESPOND_DAYS = 3;
    static final int APPEAL_DAYS = 7;

    public ProtectionClaimService(ProtectionClaimRepository claimRepository,
                                  BookingRepository bookingRepository,
                                  ShopOrderRepository shopOrderRepository,
                                  StripeConnectService stripeConnectService,
                                  NotificationRepository notificationRepository,
                                  UserRepository userRepository,
                                  @org.springframework.context.annotation.Lazy com.hustleup.marketplace.trust.TrustService trust) {
        this.trust = trust;
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
        // An appeal re-opens the question, so it holds the money just as the claim did.
        return claimRepository.existsByOrderTypeAndOrderIdAndStatus(orderType, orderId, ClaimStatus.OPEN)
                || claimRepository.existsByOrderTypeAndOrderIdAndStatus(orderType, orderId, ClaimStatus.APPEALED);
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
        if (orderType == null || reason == null || detail == null || detail.trim().length() < 10 || detail.trim().length() > 1000)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a reason and describe the problem in 10–1000 characters");
        detail = detail.trim();

        UUID sellerId;
        if (orderType == ClaimOrderType.BOOKING) {
            Booking booking = bookingRepository.findById(orderId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));
            requireBuyer(booking.getBuyerId(), buyer.getId());
            if (!"PAID".equals(booking.getPaymentStatus()) && !"TRANSFERRED".equals(booking.getPaymentStatus()))
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Only a paid purchase can be reported");
            sellerId = booking.getSellerId();
        } else {
            ShopOrder order = shopOrderRepository.findById(orderId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found"));
            requireBuyer(order.getBuyerId(), buyer.getId());
            if (order.getStatus() != ShopOrder.ShopOrderStatus.PAID && order.getStatus() != ShopOrder.ShopOrderStatus.FULFILLED)
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Only a paid purchase can be reported");
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
                .respondBy(LocalDateTime.now().plusDays(RESPOND_DAYS))
                .build());

        // The seller is told, because a claim freezes money they were expecting and finding
        // that out from a missing payout is the worst way to learn it.
        notify(sellerId, "A buyer opened a claim - respond within " + RESPOND_DAYS + " days",
                "A buyer reported a problem with this order. Your payout is on hold while we review it. "
                + "Open the order and respond with your side (tracking, photos, what was agreed) within "
                + RESPOND_DAYS + " days - after that we decide on the buyer's evidence.");
        notify(buyer.getId(), "Claim received",
                "We will review your report. Any payout not already released is on hold; funds already transferred cannot be frozen retroactively.");

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
        return decide(claimId, refund ? ProtectionClaim.Decision.FULL_REFUND : ProtectionClaim.Decision.RELEASE, null, note);
    }

    /**
     * An operator's decision on an open claim: refund in full, refund part of the price (the
     * seller is then paid the rest), or release the payment to the seller. Any refund counts
     * as a strike against the seller. Both sides are told the reasons and how to appeal.
     */
    @Transactional
    public ProtectionClaim decide(UUID claimId, ProtectionClaim.Decision decision, java.math.BigDecimal amount, String note) {
        User admin = currentUser();
        ProtectionClaim claim = claimRepository.findById(claimId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Claim not found"));
        if (claim.getStatus() != ClaimStatus.OPEN) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This claim has already been decided");
        }
        if (decision == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a decision");

        switch (decision) {
            case FULL_REFUND -> refundOrder(claim);
            case PARTIAL_REFUND -> partialRefund(claim, amount);
            case RELEASE -> { }
        }

        claim.setDecision(decision);
        claim.setRefundAmount(decision == ProtectionClaim.Decision.PARTIAL_REFUND ? amount : null);
        claim.setStatus(switch (decision) {
            case FULL_REFUND -> ClaimStatus.REFUNDED;
            case PARTIAL_REFUND -> ClaimStatus.PARTIALLY_REFUNDED;
            case RELEASE -> ClaimStatus.REJECTED;
        });
        claim.setResolutionNote(note);
        claim.setResolvedBy(admin.getId());
        claim.setResolvedAt(LocalDateTime.now());

        String reasons = note == null || note.isBlank() ? "" : " Reason: " + note.trim();
        String appeal = " You can appeal once within " + APPEAL_DAYS + " days from the order.";
        switch (decision) {
            case FULL_REFUND -> {
                notify(claim.getBuyerId(), "Your claim was refunded", "You will get a full refund to your original payment method." + reasons + appeal);
                notify(claim.getSellerId(), "A claim on your sale was refunded", "The buyer was refunded and this sale will not be paid out." + reasons + appeal);
            }
            case PARTIAL_REFUND -> {
                notify(claim.getBuyerId(), "Your claim was partly refunded", "You will get a partial refund to your original payment method." + reasons + appeal);
                notify(claim.getSellerId(), "A claim on your sale was partly refunded", "Part of the price was refunded to the buyer; the rest will be paid out to you." + reasons + appeal);
            }
            case RELEASE -> {
                notify(claim.getBuyerId(), "Your claim was closed without a refund", "We reviewed the evidence and released the payment to the seller." + reasons + appeal);
                notify(claim.getSellerId(), "A claim on your sale was closed", "The hold has been lifted and your payout will follow." + reasons);
            }
        }
        if (decision != ProtectionClaim.Decision.RELEASE && trust != null) {
            trust.addStrike(claim.getSellerId(), "A buyer claim (" + claim.getReason() + ") was decided against you");
        }

        log.info("Protection claim {} decided {} by {}", claimId, decision, admin.getId());
        return claimRepository.save(claim);
    }

    /** The seller's side of the story, before the deadline and before a decision. */
    @Transactional
    public ProtectionClaim respond(UUID claimId, String text) {
        User seller = currentUser();
        ProtectionClaim claim = claimRepository.findById(claimId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Claim not found"));
        if (!seller.getId().equals(claim.getSellerId()))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the seller can respond to this claim");
        if (claim.getStatus() != ClaimStatus.OPEN)
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This claim has already been decided");
        if (text == null || text.trim().length() < 10 || text.trim().length() > 2000)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Write 10-2000 characters: what you sent, when, tracking and anything the buyer agreed to");
        claim.setSellerResponse(text.trim());
        claim.setSellerRespondedAt(LocalDateTime.now());
        notify(claim.getBuyerId(), "The seller responded to your claim", "Our team now has both sides and will decide shortly.");
        return claimRepository.save(claim);
    }

    /** One appeal per claim, within {@value #APPEAL_DAYS} days of the decision. */
    @Transactional
    public ProtectionClaim appeal(UUID claimId, String text) {
        User me = currentUser();
        ProtectionClaim claim = claimRepository.findById(claimId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Claim not found"));
        String side = me.getId().equals(claim.getBuyerId()) ? "BUYER" : me.getId().equals(claim.getSellerId()) ? "SELLER" : null;
        if (side == null) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the buyer or seller can appeal");
        if (claim.getStatus() == ClaimStatus.OPEN || claim.getStatus() == ClaimStatus.APPEALED)
            throw new ResponseStatusException(HttpStatus.CONFLICT, claim.getStatus() == ClaimStatus.OPEN ? "This claim has not been decided yet" : "An appeal is already being reviewed");
        if (claim.getAppealedAt() != null)
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This decision has already been appealed - the appeal decision is final");
        if (claim.getResolvedAt() != null && claim.getResolvedAt().plusDays(APPEAL_DAYS).isBefore(LocalDateTime.now()))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "The " + APPEAL_DAYS + "-day appeal window has passed");
        if (text == null || text.trim().length() < 10 || text.trim().length() > 2000)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Explain in 10-2000 characters what the decision got wrong, with any new information");
        claim.setAppealBy(side);
        claim.setAppealText(text.trim());
        claim.setAppealedAt(LocalDateTime.now());
        claim.setStatus(ClaimStatus.APPEALED);
        UUID other = "BUYER".equals(side) ? claim.getSellerId() : claim.getBuyerId();
        notify(me.getId(), "Appeal received", "A different member of our team will review the decision. Any payout not yet released stays on hold.");
        notify(other, "The other side appealed a claim decision", "A different member of our team will review it. Any payout not yet released stays on hold.");
        return claimRepository.save(claim);
    }

    /**
     * Final decision on an appeal. Upholding restores the original outcome. Overturning a
     * release refunds the buyer in full; overturning a refund cannot take money back from the
     * buyer, so it removes the seller's strike and is recorded.
     */
    @Transactional
    public ProtectionClaim resolveAppeal(UUID claimId, boolean uphold, String note) {
        User admin = currentUser();
        ProtectionClaim claim = claimRepository.findById(claimId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Claim not found"));
        if (claim.getStatus() != ClaimStatus.APPEALED)
            throw new ResponseStatusException(HttpStatus.CONFLICT, "There is no appeal waiting on this claim");
        if (note == null || note.isBlank())
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Give the reasons for the appeal decision");
        ProtectionClaim.Decision original = claim.getDecision() == null ? ProtectionClaim.Decision.RELEASE : claim.getDecision();
        ClaimStatus finalStatus = switch (original) {
            case FULL_REFUND -> ClaimStatus.REFUNDED;
            case PARTIAL_REFUND -> ClaimStatus.PARTIALLY_REFUNDED;
            case RELEASE -> ClaimStatus.REJECTED;
        };
        if (!uphold) {
            if (original == ProtectionClaim.Decision.RELEASE) {
                refundOrder(claim);
                claim.setDecision(ProtectionClaim.Decision.FULL_REFUND);
                finalStatus = ClaimStatus.REFUNDED;
                if (trust != null) trust.addStrike(claim.getSellerId(), "A claim was decided against you on appeal");
            } else if (trust != null) {
                trust.removeStrike(claim.getSellerId());
            }
        }
        claim.setStatus(finalStatus);
        claim.setAppealNote(note.trim());
        claim.setAppealResolvedAt(LocalDateTime.now());
        String outcome = uphold ? "The original decision stands." : "The original decision was changed.";
        notify(claim.getBuyerId(), "Appeal decided", outcome + " " + note.trim() + " This decision is final within HustleSpace.");
        notify(claim.getSellerId(), "Appeal decided", outcome + " " + note.trim() + " This decision is final within HustleSpace.");
        log.info("Appeal on claim {} {} by {}", claimId, uphold ? "upheld" : "overturned", admin.getId());
        return claimRepository.save(claim);
    }

    /**
     * Refunds part of the price before the seller is paid: the buyer gets {@code amount}
     * back and the order's price drops by the same, so the eventual payout is the remainder.
     * After a payout only a full refund is possible (the whole transfer is recovered).
     */
    private void partialRefund(ProtectionClaim claim, java.math.BigDecimal amount) {
        if (amount == null || amount.signum() <= 0)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Enter the amount to refund");
        if (claim.getOrderType() == ClaimOrderType.BOOKING) {
            Booking booking = bookingRepository.findById(claim.getOrderId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));
            if ("TRANSFERRED".equals(booking.getPaymentStatus()))
                throw new ResponseStatusException(HttpStatus.CONFLICT, "The seller has been paid - only a full refund (with recovery) is possible now");
            if (booking.getAgreedPrice() == null || amount.compareTo(booking.getAgreedPrice()) >= 0)
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A partial refund must be less than the price - use a full refund instead");
            attemptRefund(booking.getPaymentIntentId(), claim.getId(), amount);
            booking.setAgreedPrice(booking.getAgreedPrice().subtract(amount));
            booking.setUpdatedAt(LocalDateTime.now());
            bookingRepository.save(booking);
        } else {
            ShopOrder order = shopOrderRepository.findById(claim.getOrderId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found"));
            if ("RELEASED".equals(order.getPayoutStatus()))
                throw new ResponseStatusException(HttpStatus.CONFLICT, "The seller has been paid - only a full refund (with recovery) is possible now");
            if (order.getTotalPrice() == null || amount.compareTo(order.getTotalPrice()) >= 0)
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A partial refund must be less than the price - use a full refund instead");
            attemptRefund(order.getPaymentIntentId(), claim.getId(), amount);
            order.setTotalPrice(order.getTotalPrice().subtract(amount));
            order.setUpdatedAt(LocalDateTime.now());
            shopOrderRepository.save(order);
        }
    }

    private void refundOrder(ProtectionClaim claim) {
        if (claim.getOrderType() == ClaimOrderType.BOOKING) {
            Booking booking = bookingRepository.findById(claim.getOrderId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));
            if ("TRANSFERRED".equals(booking.getPaymentStatus()))
                recoverTransfer(booking.getTransferId());
            attemptRefund(booking.getPaymentIntentId(), claim.getOrderId(),
                    booking.getAgreedPrice() == null ? null : booking.getAgreedPrice().add(booking.getFulfilment().shippingPriceOrZero()));
            booking.setPaymentStatus("REFUNDED");
            booking.setStatus(com.hustleup.marketplace.booking.model.BookingStatus.CANCELLED);
            booking.setCancelReason("Refunded after a buyer protection claim");
            booking.setUpdatedAt(LocalDateTime.now());
            bookingRepository.save(booking);
        } else {
            ShopOrder order = shopOrderRepository.findById(claim.getOrderId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found"));
            if ("RELEASED".equals(order.getPayoutStatus()))
                recoverTransfer(order.getTransferId());
            attemptRefund(order.getPaymentIntentId(), claim.getOrderId(), order.grandTotal());
            order.setStatus(ShopOrder.ShopOrderStatus.REFUNDED);
            // Takes it out of findReleasable for good, so no later sweep can pay a seller for
            // an order the platform has already given back.
            order.setPayoutStatus("REFUNDED");
            order.setUpdatedAt(LocalDateTime.now());
            shopOrderRepository.save(order);
        }
    }

    private void recoverTransfer(String transferId) {
        if (transferId == null || transferId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Paid-out order has no transfer reference; manual reconciliation required");
        }
        try {
            stripeConnectService.recoverTransfer(transferId);
        } catch (StripeException e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Seller funds could not be recovered; the claim remains open for retry", e);
        }
    }

    private void attemptRefund(String paymentIntentId, UUID orderId, java.math.BigDecimal amount) {
        if (paymentIntentId == null || paymentIntentId.isBlank()) {
            log.info("Claim refund on {} had no captured payment — marking refunded without Stripe", orderId);
            return;
        }
        try {
            stripeConnectService.refundPayment(paymentIntentId, amount, orderId);
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
        UUID userId = currentUser().getId();
        return claimRepository.findByBuyerIdOrSellerIdOrderByCreatedAtDesc(userId, userId);
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
