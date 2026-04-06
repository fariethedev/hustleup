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

    /**
     * Creates a Stripe Checkout Session and returns its URL to the frontend.
     *
     * <ul>
     *   <li><b>HTTP method:</b> POST — we use POST (not GET) because we are creating
     *       a resource on Stripe's side (the checkout session) and passing a request body.</li>
     *   <li><b>Path:</b> {@code POST /api/payments/create-checkout-session}</li>
     *   <li><b>Auth:</b> typically requires a valid JWT (authenticated seller), though
     *       the exact security configuration depends on the security filter chain.</li>
     *   <li><b>Request body:</b> JSON with fields:
     *     <ul>
     *       <li>{@code email} — the seller's email address to pre-fill in Stripe's form</li>
     *       <li>{@code priceId} — the Stripe Price ID representing the chosen plan</li>
     *     </ul>
     *   </li>
     *   <li><b>Response 200:</b> {@code {"url": "https://checkout.stripe.com/..."}}</li>
     *   <li><b>Response 500:</b> {@code {"error": "..."}} if the Stripe API call fails</li>
     * </ul>
     *
     * <h2>Frontend usage</h2>
     * <p>The frontend calls this endpoint, receives the URL, and then does
     * {@code window.location.href = url} to redirect the seller to Stripe's
     * hosted checkout page. The seller enters their card details on Stripe's domain —
     * our frontend never handles card numbers.</p>
     *
     * @param data JSON map containing {@code email} and {@code priceId}
     * @return 200 with a {@code url} key on success, 500 with an {@code error} key on failure
     */
    // Maps HTTP POST to /api/payments/create-checkout-session.
    @PostMapping("/create-checkout-session")
    public ResponseEntity<Map<String, String>> createCheckoutSession(
            // @RequestBody tells Spring to deserialise the incoming JSON body into a Map.
            // Jackson (the default JSON library) handles the conversion automatically.
            @RequestBody Map<String, String> data) {
        try {
            // Extract the fields the frontend sent in the JSON body.
            String userEmail = data.get("email");
            String priceId = data.get("priceId");

            // Delegate to the service layer to call the Stripe API.
            String sessionUrl = stripeService.createCheckoutSession(userEmail, priceId);

            // Return the Stripe-hosted checkout URL. Map.of creates an immutable map;
            // Spring serialises it to {"url":"https://checkout.stripe.com/..."}.
            return ResponseEntity.ok(Map.of("url", sessionUrl));
        } catch (StripeException e) {
            // A StripeException can occur if: the secret key is wrong, the priceId
            // does not exist in Stripe, or there is a network error reaching Stripe.
            // We return 500 Internal Server Error because the failure is on our/Stripe's
            // side, not the client's fault. Include the message for debugging.
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

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
