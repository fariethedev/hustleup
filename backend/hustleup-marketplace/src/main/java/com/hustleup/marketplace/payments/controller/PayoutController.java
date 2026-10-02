/**
 * REST controller for seller payout accounts and Stripe Connect webhook handling.
 *
 * <p>Base path: {@code /api/v1/payouts}
 */
package com.hustleup.marketplace.payments.controller;

import com.hustleup.marketplace.booking.model.Booking;
import com.hustleup.marketplace.booking.repository.BookingRepository;
import com.hustleup.marketplace.payments.model.SellerPayoutAccount;
import com.hustleup.marketplace.payments.repository.SellerPayoutAccountRepository;
import com.hustleup.marketplace.payments.service.StripeConnectService;
import com.hustleup.common.model.User;
import com.hustleup.common.repository.UserRepository;
import com.hustleup.common.security.EmailVerificationGuard;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.exception.StripeException;
import com.stripe.model.Event;
import com.stripe.model.StripeObject;
import com.stripe.model.checkout.Session;
import com.stripe.net.Webhook;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/v1/payouts")
@Slf4j
public class PayoutController {

    private final StripeConnectService stripeConnectService;
    private final SellerPayoutAccountRepository payoutAccountRepository;
    private final UserRepository userRepository;
    private final BookingRepository bookingRepository;
    private final com.hustleup.marketplace.shop.repository.ShopOrderRepository shopOrderRepository;
    private final com.hustleup.marketplace.listing.repository.ListingRepository listingRepository;
    /** Opens the delivery track and tells buyer and seller once a charge actually clears. */
    private final com.hustleup.marketplace.shipping.ShipmentService shipmentService;
    private final com.hustleup.marketplace.booking.service.BookingService bookingService;
    private final EmailVerificationGuard emailVerificationGuard;
    private final com.hustleup.marketplace.shop.service.ShopInventoryService inventoryService;

    @Value("${app.stripe.connect-webhook-secret}")
    private String webhookSecret;

    public PayoutController(StripeConnectService stripeConnectService,
                             SellerPayoutAccountRepository payoutAccountRepository,
                             UserRepository userRepository,
                             BookingRepository bookingRepository,
                             com.hustleup.marketplace.shop.repository.ShopOrderRepository shopOrderRepository,
                             com.hustleup.marketplace.listing.repository.ListingRepository listingRepository,
                             com.hustleup.marketplace.shipping.ShipmentService shipmentService,
                             com.hustleup.marketplace.booking.service.BookingService bookingService,
                             EmailVerificationGuard emailVerificationGuard,
                             com.hustleup.marketplace.shop.service.ShopInventoryService inventoryService) {
        this.stripeConnectService = stripeConnectService;
        this.payoutAccountRepository = payoutAccountRepository;
        this.userRepository = userRepository;
        this.bookingRepository = bookingRepository;
        this.shopOrderRepository = shopOrderRepository;
        this.listingRepository = listingRepository;
        this.shipmentService = shipmentService;
        this.bookingService = bookingService;
        this.emailVerificationGuard = emailVerificationGuard;
        this.inventoryService = inventoryService;
    }

    private User currentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email).orElseThrow(() -> new RuntimeException("User not found"));
    }

    /**
     * Returns a Stripe-hosted onboarding URL for the seller to add their bank account and
     * complete identity verification. Creates their Connect Express account on first call.
     *
     * <p><b>POST /api/v1/payouts/connect</b>
     */
    @PostMapping("/connect")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> connect() {
        try {
            User seller = currentUser();
            // Starting onboarding is the point selling needs a reachable address — Stripe
            // will email this seller about their own payout account, and status() below
            // stays ungated so an unverified seller can still check where onboarding left off.
            emailVerificationGuard.require(seller, "set up payouts");
            String url = stripeConnectService.createOnboardingLink(seller.getId());
            return ResponseEntity.ok().header("Cache-Control", "no-store").body(Map.of("url", url));
        } catch (StripeException e) {
            log.error("Stripe Connect onboarding failed for seller", e);
            // This platform setting is not a temporary outage and cannot be resolved by
            // sellers entering their bank details again. Do not leak Stripe's raw response.
            String message = e.getMessage();
            if (message != null && message.contains("feat_accounts_v1_support")) {
                log.error("Payout setup requires Accounts v1 compatibility support in the platform's Stripe Dashboard. Stripe request: {}", e.getRequestId());
                return ResponseEntity.status(503).header("Cache-Control", "no-store").body(Map.of(
                        "code", "PAYOUT_SETUP_CONFIGURATION_REQUIRED",
                        "error", "Bank setup is blocked by HustleSpace's Stripe configuration. "
                                + "The platform administrator must enable Accounts v1 support in Stripe. "
                                + "Your bank details are not the problem; please contact support."));
            }
            return ResponseEntity.status(502).body(Map.of(
                    "error", "Payout setup is temporarily unavailable. Please try again shortly — "
                            + "if it keeps happening, contact support."));
        }
    }

    /**
     * Returns the authenticated seller's payout account status — whether they've started
     * onboarding, and whether Stripe has enabled payouts yet.
     *
     * <p><b>GET /api/v1/payouts/status</b>
     */
    @GetMapping("/status")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> status() {
        User seller = currentUser();
        Optional<SellerPayoutAccount> account = payoutAccountRepository.findBySellerId(seller.getId());
        if (account.isEmpty()) {
            return ResponseEntity.ok().header("Cache-Control", "no-store").body(Map.of(
                    "platformFeePercent", stripeConnectService.getPlatformFeePercent(),
                    "connected", false, "payoutsEnabled", false,
                    "chargesEnabled", false, "detailsSubmitted", false));
        }
        try {
            return ResponseEntity.ok().header("Cache-Control", "no-store")
                    .body(stripeConnectService.accountStatus(account.get()));
        } catch (StripeException e) {
            // Cached flags are not evidence of current payout eligibility.
            log.warn("Could not refresh Stripe payout status for seller {}", seller.getId(), e);
            return ResponseEntity.status(502).header("Cache-Control", "no-store").body(Map.of(
                    "error", "Could not verify your bank connection with Stripe. Please retry.",
                    "statusUnavailable", true));
        }
    }

    /**
     * Stripe webhook endpoint for Connect + payment events. Registered as its own endpoint
     * in the Stripe dashboard (separate from the subscription service's webhook), since it
     * reacts to a different event set: account capability changes and booking payments.
     *
     * <p><b>POST /api/v1/payouts/webhook</b> — no JWT auth; authenticity is verified via the
     * {@code Stripe-Signature} header instead (see {@code CommonSecurityConfig} permitAll).
     */
    @PostMapping("/dashboard")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> dashboard() {
        var account = payoutAccountRepository.findBySellerId(currentUser().getId());
        if (account.isEmpty()) return ResponseEntity.status(409).body(Map.of("error", "Connect a payout account first."));
        try {
            return ResponseEntity.ok().header("Cache-Control", "no-store")
                    .body(Map.of("url", stripeConnectService.createDashboardLink(account.get())));
        } catch (StripeException e) {
            log.warn("Could not create seller dashboard link", e);
            return ResponseEntity.status(502).body(Map.of("error", "Could not open Stripe. Please try again."));
        }
    }

    @PostMapping("/webhook")
    @org.springframework.transaction.annotation.Transactional
    public ResponseEntity<Void> webhook(@RequestBody String payload,
                                         @RequestHeader("Stripe-Signature") String sigHeader) {
        try {
            Event event = Webhook.constructEvent(payload, sigHeader, webhookSecret);
            // Deserialising the event object is version-sensitive: getObject() returns empty
            // whenever the API version that produced the event differs from the one this
            // stripe-java build expects. That is not an edge case — a Stripe account's
            // default version drifts ahead of the pinned SDK over time (this account is on
            // 2026-07-29.dahlia against stripe-java 28.3.0), and the old code turned that
            // into a SILENT no-op that still answered 200. Stripe saw success, the payment
            // was taken, and the order sat UNPAID forever.
            //
            // deserializeUnsafe() ignores the version check and maps whatever fields are
            // present. "Unsafe" only means Stripe will not guarantee every field across
            // versions — the ids and metadata this handler reads are stable, and a
            // best-effort read is strictly better than dropping a real payment.
            var deserializer = event.getDataObjectDeserializer();
            StripeObject stripeObject = deserializer.getObject().orElseGet(() -> {
                try {
                    log.warn("Stripe event {} ({}) needed unsafe deserialization — event API version {} "
                             + "does not match this SDK build", event.getId(), event.getType(), event.getApiVersion());
                    return deserializer.deserializeUnsafe();
                } catch (Exception e) {
                    log.error("Could not deserialize Stripe event {} ({}): {}",
                            event.getId(), event.getType(), e.getMessage());
                    return null;
                }
            });

            switch (event.getType()) {
                case "account.updated" -> {
                    if (stripeObject instanceof com.stripe.model.Account account) {
                        payoutAccountRepository.findByStripeAccountId(account.getId()).ifPresent(pa -> {
                            pa.setChargesEnabled(Boolean.TRUE.equals(account.getChargesEnabled()));
                            pa.setPayoutsEnabled(Boolean.TRUE.equals(account.getPayoutsEnabled()));
                            pa.setDetailsSubmitted(Boolean.TRUE.equals(account.getDetailsSubmitted()));
                            payoutAccountRepository.save(pa);
                        });
                    }
                }
                case "checkout.session.expired", "checkout.session.async_payment_failed" -> {
                    if (stripeObject instanceof Session session && session.getMetadata() != null) {
                        String ids = session.getMetadata().get("shopOrderIds");
                        if (ids != null) for (String raw : ids.split(",")) {
                            inventoryService.releaseUnpaid(java.util.UUID.fromString(raw.trim()));
                        }
                    }
                }
                case "checkout.session.completed", "checkout.session.async_payment_succeeded" -> {
                    if (stripeObject instanceof Session session) {
                        if (!"paid".equals(session.getPaymentStatus()) && !"no_payment_required".equals(session.getPaymentStatus())) {
                            return ResponseEntity.ok().build();
                        }
                        // Resolve which bookings this payment covers from the session's own
                        // metadata rather than from a stored PaymentIntent id. Stripe does not
                        // create the PaymentIntent until the customer starts paying, so at
                        // session-creation time there was nothing to store on the booking rows —
                        // matching on it would find nothing and silently leave a fully paid
                        // order sitting UNPAID.
                        //
                        // One session can cover several bookings: a cart checkout is one charge
                        // across many line items, so this marks every id in the list.
                        var meta = session.getMetadata();

                        // Storefront purchases are their own entity and carry their own key.
                        // Handled first and returned from, so a shop session never falls
                        // through into the booking lookup below.
                        String shopCsv = meta != null ? meta.get("shopOrderIds") : null;
                        if (shopCsv != null && !shopCsv.isBlank()) {
                            for (String raw : shopCsv.split(",")) {
                                try {
                                    shopOrderRepository.findLockedById(java.util.UUID.fromString(raw.trim()))
                                            .ifPresent(o -> {
                                                if (o.getStatus() != com.hustleup.marketplace.shop.model.ShopOrder.ShopOrderStatus.AWAITING_PAYMENT) return;
                                                o.setStatus(com.hustleup.marketplace.shop.model.ShopOrder
                                                        .ShopOrderStatus.PAID);
                                                if (session.getPaymentIntent() != null) {
                                                    o.setPaymentIntentId(session.getPaymentIntent());
                                                }
                                                // This is the moment the delivery track starts:
                                                // money has actually arrived, so the buyer now has
                                                // something to follow and the seller owes them goods.
                                                // Both are told here, and only here — the seller
                                                // marking their own order paid would not be evidence
                                                // of anything.
                                                shipmentService.confirmPaid(o.getFulfilment(),
                                                        o.getProductName(), o.getId(),
                                                        o.getBuyerId(), o.getSellerId());
                                                o.setUpdatedAt(java.time.LocalDateTime.now());
                                                shopOrderRepository.save(o);
                                            });
                                } catch (IllegalArgumentException ignored) {
                                    // Not a UUID — skip rather than failing the whole webhook.
                                }
                            }
                            return ResponseEntity.ok().build();
                        }

                        String csv = meta != null ? meta.get("bookingIds") : null;

                        // Shared with POST /bookings/confirm-payment, which the buyer's
                        // browser calls on its return from Stripe. One implementation means
                        // the two paths cannot drift, and either order of arrival is safe.
                        bookingService.applyPaidSession(session);
                    }
                }
                default -> { /* no-op: unhandled event types are safely ignored */ }
            }
            return ResponseEntity.ok().build();
        } catch (SignatureVerificationException e) {
            return ResponseEntity.status(400).build();
        }
    }
}
