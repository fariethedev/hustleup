package com.hustleup.subscription.controller;

import com.hustleup.subscription.service.StripeService;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.exception.StripeException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * REST controller that exposes HTTP endpoints for Stripe payment operations.
 *
 * <h2>Responsibility split from SubscriptionController</h2>
 * <p>This controller handles raw Stripe communication (checkout initiation and
 * webhook delivery), while {@link SubscriptionController} manages our internal
 * subscription data model. Keeping them separate makes each class easier to
 * understand and test in isolation.</p>
 *
 * <h2>Endpoints</h2>
 * <ul>
 *   <li>{@code POST /api/payments/create-checkout-session} — Called by the frontend
 *       to get a Stripe-hosted payment URL.</li>
 *   <li>{@code POST /api/payments/webhook} — Called by Stripe's servers to notify us
 *       of payment events (this URL is registered in the Stripe dashboard).</li>
 * </ul>
 *
 * <h2>Security note on the webhook endpoint</h2>
 * <p>The {@code /webhook} endpoint must <em>not</em> be protected by JWT authentication
 * because the caller is Stripe, not a logged-in user. Instead, authenticity is
 * verified by checking the {@code Stripe-Signature} header inside {@link StripeService}.
 * Ensure this endpoint is excluded from any global JWT security filter.</p>
 */
// Marks this class as a REST controller — all methods return JSON response bodies.
@RestController

// All endpoints in this class share the "/api/payments" base path.
@RequestMapping("/api/payments")
public class StripeController {

    // The service layer that handles all Stripe SDK calls. Keeping SDK calls out
    // of the controller keeps the controller thin and easier to unit-test.
    private final StripeService stripeService;

    /**
     * Constructor injection of the StripeService dependency.
     *
     * <p>Spring automatically detects this single-constructor class and injects the
     * {@link StripeService} bean without requiring an explicit {@code @Autowired}
     * annotation.</p>
     *
     * @param stripeService the service bean that wraps Stripe SDK interactions
     */
    public StripeController(StripeService stripeService) {
        this.stripeService = stripeService;
    }

    // The former POST /create-checkout-session was removed. It took both the customer email
    // and the Stripe priceId straight from the request body, so a caller could start a
    // checkout against someone else's address, or name a cheaper Price than the plan they
    // were buying. Checkout now lives at POST /api/v1/subscriptions/checkout, which derives
    // the user from the JWT and the amount from the server-side SubscriptionPlan enum.
    // This controller keeps only the webhook below, which is the sole grantor of Premium.
    /**
     * Receives and processes Stripe webhook event notifications.
     *
     * <ul>
     *   <li><b>HTTP method:</b> POST — Stripe always POSTs webhook events.</li>
     *   <li><b>Path:</b> {@code POST /api/payments/webhook}</li>
     *   <li><b>Auth:</b> NO JWT auth — caller is Stripe, not a user. Authenticity is
     *       verified via the {@code Stripe-Signature} header inside the service.</li>
     *   <li><b>Request body:</b> raw JSON event payload sent by Stripe.</li>
     *   <li><b>Request header:</b> {@code Stripe-Signature} — HMAC signature from Stripe.</li>
     *   <li><b>Response 200:</b> empty body — signals to Stripe that we received the event.</li>
     *   <li><b>Response 400:</b> empty body — signals to Stripe that the signature was
     *       invalid. Stripe will retry delivery for up to 72 hours on non-2xx responses.</li>
     * </ul>
     *
     * <h2>Why raw String payload?</h2>
     * <p>Stripe's signature verification requires the <em>exact raw bytes</em> of the
     * request body. If Spring were to parse the JSON first (e.g., into a {@code Map}),
     * the byte representation might differ slightly from what Stripe signed, causing
     * verification to fail. Declaring the parameter as {@code String} tells Spring to
     * give us the raw body unchanged.</p>
     *
     * <h2>Retry behaviour</h2>
     * <p>If we return anything other than 2xx, Stripe will retry the webhook several
     * times with exponential back-off. Returning 400 for invalid signatures is correct
     * because it tells Stripe we cannot process the event (it was likely forged).</p>
     *
     * @param payload   the raw JSON body of the webhook POST from Stripe
     * @param sigHeader the value of the {@code Stripe-Signature} HTTP request header
     * @return 200 OK (empty body) on success, 400 Bad Request on signature failure
     */
    // Maps HTTP POST to /api/payments/webhook.
    @PostMapping("/webhook")
    public ResponseEntity<Void> handleWebhook(
            // The raw request body as a String. MUST NOT be pre-parsed; see Javadoc above.
            @RequestBody String payload,
            // Extracts the 'Stripe-Signature' header from the HTTP request.
            // This header contains a timestamp and HMAC hash used for verification.
            @RequestHeader("Stripe-Signature") String sigHeader) {
        try {
            // Delegate to the service, which verifies the signature and processes the event.
            stripeService.handleWebhook(payload, sigHeader);

            // Return 200 with no body. Stripe requires a 2xx response to consider the
            // webhook delivered. No body is needed — Stripe ignores the response body.
            return ResponseEntity.ok().build();
        } catch (StripeException e) {
            // SignatureVerificationException (a subtype of StripeException) is thrown
            // when the signature check fails — meaning the request may be forged.
            // Return 400 so Stripe knows we rejected it. Do NOT return 200 for invalid
            // signatures, as that would silently accept potentially malicious requests.
            return ResponseEntity.status(400).build();
        }
    }
}
