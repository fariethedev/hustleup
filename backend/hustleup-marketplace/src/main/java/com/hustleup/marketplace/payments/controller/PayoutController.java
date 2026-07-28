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
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/v1/payouts")
public class PayoutController {

    private final StripeConnectService stripeConnectService;
    private final SellerPayoutAccountRepository payoutAccountRepository;
    private final UserRepository userRepository;
    private final BookingRepository bookingRepository;

    @Value("${app.stripe.connect-webhook-secret}")
    private String webhookSecret;

    public PayoutController(StripeConnectService stripeConnectService,
                             SellerPayoutAccountRepository payoutAccountRepository,
                             UserRepository userRepository,
                             BookingRepository bookingRepository) {
        this.stripeConnectService = stripeConnectService;
        this.payoutAccountRepository = payoutAccountRepository;
        this.userRepository = userRepository;
        this.bookingRepository = bookingRepository;
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
            StripeObject stripeObject = event.getDataObjectDeserializer().getObject().orElse(null);

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
                    // The booking is looked up by the PaymentIntent id we stored when the
                    // Checkout Session was created (see StripeConnectService.createPaymentCheckoutSession).
                    if (stripeObject instanceof Session session && session.getPaymentIntent() != null) {
                        bookingRepository.findByPaymentIntentId(session.getPaymentIntent()).ifPresent(booking -> {
                            booking.setPaymentStatus("PAID");
                            bookingRepository.save(booking);
                        });
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
