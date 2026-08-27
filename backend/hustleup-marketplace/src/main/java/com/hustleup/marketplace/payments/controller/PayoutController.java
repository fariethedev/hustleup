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

    @Value("${app.stripe.connect-webhook-secret}")
    private String webhookSecret;

    public PayoutController(StripeConnectService stripeConnectService,
                             SellerPayoutAccountRepository payoutAccountRepository,
                             UserRepository userRepository,
                             BookingRepository bookingRepository,
                             com.hustleup.marketplace.shop.repository.ShopOrderRepository shopOrderRepository) {
        this.stripeConnectService = stripeConnectService;
        this.payoutAccountRepository = payoutAccountRepository;
        this.userRepository = userRepository;
        this.bookingRepository = bookingRepository;
        this.shopOrderRepository = shopOrderRepository;
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
    @PreAuthorize("hasRole('SELLER')")
    public ResponseEntity<?> connect() {
        try {
            User seller = currentUser();
            String url = stripeConnectService.createOnboardingLink(seller.getId());
            return ResponseEntity.ok(Map.of("url", url));
        } catch (StripeException e) {
            return ResponseEntity.status(502).body(Map.of("error", "Could not reach Stripe: " + e.getMessage()));
        }
    }

    /**
     * Returns the authenticated seller's payout account status — whether they've started
     * onboarding, and whether Stripe has enabled payouts yet.
     *
     * <p><b>GET /api/v1/payouts/status</b>
     */
    @GetMapping("/status")
    @PreAuthorize("hasRole('SELLER')")
    public ResponseEntity<?> status() {
        User seller = currentUser();
        Optional<SellerPayoutAccount> account = payoutAccountRepository.findBySellerId(seller.getId());
        if (account.isEmpty()) {
            return ResponseEntity.ok(Map.of("connected", false));
        }
        try {
            SellerPayoutAccount refreshed = stripeConnectService.refreshAccountStatus(account.get());
            return ResponseEntity.ok(Map.of(
                    "connected", true,
                    "payoutsEnabled", refreshed.isPayoutsEnabled(),
                    "chargesEnabled", refreshed.isChargesEnabled(),
                    "detailsSubmitted", refreshed.isDetailsSubmitted()
            ));
        } catch (StripeException e) {
            // Fall back to our last-known local state if Stripe is unreachable right now.
            SellerPayoutAccount a = account.get();
            return ResponseEntity.ok(Map.of(
                    "connected", true,
                    "payoutsEnabled", a.isPayoutsEnabled(),
                    "chargesEnabled", a.isChargesEnabled(),
                    "detailsSubmitted", a.isDetailsSubmitted()
            ));
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
    @PostMapping("/webhook")
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
                case "checkout.session.completed" -> {
                    if (stripeObject instanceof Session session) {
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
                                    shopOrderRepository.findById(java.util.UUID.fromString(raw.trim()))
                                            .ifPresent(o -> {
                                                o.setStatus(com.hustleup.marketplace.shop.model.ShopOrder
                                                        .ShopOrderStatus.PAID);
                                                if (session.getPaymentIntent() != null) {
                                                    o.setPaymentIntentId(session.getPaymentIntent());
                                                }
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

                        java.util.List<com.hustleup.marketplace.booking.model.Booking> paid =
                                new java.util.ArrayList<>();

                        if (csv != null && !csv.isBlank()) {
                            for (String raw : csv.split(",")) {
                                try {
                                    bookingRepository.findById(java.util.UUID.fromString(raw.trim()))
                                            .ifPresent(paid::add);
                                } catch (IllegalArgumentException ignored) {
                                    // Not a UUID — skip rather than failing the whole webhook.
                                }
                            }
                        } else if (session.getPaymentIntent() != null) {
                            // Fallback for any session created before the metadata was added.
                            paid = bookingRepository.findAllByPaymentIntentId(session.getPaymentIntent());
                        }

                        for (var booking : paid) {
                            booking.setPaymentStatus("PAID");
                            // Record the PaymentIntent now that one exists — the seller payout
                            // on completion reconciles against it.
                            if (session.getPaymentIntent() != null) {
                                booking.setPaymentIntentId(session.getPaymentIntent());
                            }
                            bookingRepository.save(booking);
                        }
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
