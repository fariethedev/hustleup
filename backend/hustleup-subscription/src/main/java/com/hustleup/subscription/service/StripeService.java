package com.hustleup.subscription.service;

import com.stripe.Stripe;
import com.stripe.exception.StripeException;
import com.stripe.model.Event;
import com.stripe.model.checkout.Session;
import com.stripe.net.Webhook;
import com.stripe.param.checkout.SessionCreateParams;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.util.HashMap;
import java.util.Map;

/**
 * Service that encapsulates all Stripe payment integration logic.
 *
 * <h2>Why Stripe?</h2>
 * <p>Stripe is a payment processing platform that handles the hard parts of accepting
 * money online: PCI compliance, fraud detection, card tokenisation, recurring billing,
 * and invoicing. Instead of storing card numbers ourselves (which would require
 * extensive security audits), we redirect the seller to a Stripe-hosted checkout page
 * and only store a reference (the Stripe session or customer ID).</p>
 *
 * <h2>Stripe Checkout flow</h2>
 * <ol>
 *   <li>Our backend calls {@link #createCheckoutSession} to ask Stripe to create a
 *       temporary, hosted payment page.</li>
 *   <li>Stripe returns a URL; we send that URL to the frontend.</li>
 *   <li>The seller completes payment on Stripe's servers (we never see the card).</li>
 *   <li>Stripe notifies our backend asynchronously via a <b>webhook</b> event.</li>
 *   <li>Our backend handles the webhook in {@link #handleWebhook} and updates the DB.</li>
 * </ol>
 *
 * <h2>Why webhooks?</h2>
 * <p>After the seller pays, Stripe does NOT redirect back with a token we can trust —
 * a malicious user could craft a fake redirect. Instead, Stripe sends a signed HTTP
 * POST directly to our server (the webhook). Because the payload is signed with a
 * secret only Stripe and we know, we can verify its authenticity and safely update
 * the subscription status. This is the industry-standard pattern for payment events.</p>
 *
 * <h2>Spring @Service</h2>
 * <p>Annotating with {@code @Service} registers this class as a Spring-managed bean.
 * Spring will instantiate it once (singleton scope by default) and inject it wherever
 * it is declared as a constructor or field dependency.</p>
 */
// Registers this class as a Spring service bean. It signals to other developers
// that this class contains business/integration logic (as opposed to @Controller
// for HTTP handling or @Repository for data access).
@Service
public class StripeService {

    // -------------------------------------------------------------------------
    // Configuration values injected from application.properties / environment
    // -------------------------------------------------------------------------

    // @Value reads a property at startup and injects it as a field value.
    // The syntax ${app.stripe.secret-key} means: "look for the key
    // 'app.stripe.secret-key' in application.properties (or env vars)".
    // The secret key authenticates ALL requests from our server to Stripe's API.
    // IMPORTANT: This must never be committed to source control — use environment
    // variables or a secrets manager in production.
    @Value("${app.stripe.secret-key}")
    private String secretKey;

    // The webhook signing secret is used to verify that an incoming webhook POST
    // really originated from Stripe and has not been tampered with in transit.
    // Stripe provides this value in its dashboard when you register a webhook endpoint.
    @Value("${app.stripe.webhook-secret}")
    private String webhookSecret;

    // The base URL of the frontend application (e.g. "https://hustleup.co.za").
    // Used to build the success/cancel redirect URLs passed to Stripe Checkout.
    @Value("${app.frontend.url}")
    private String frontendUrl;

    /**
     * Initialises the Stripe SDK with the application's secret key.
     *
     * <p>{@link PostConstruct} means Spring calls this method automatically once,
     * immediately after the bean is fully constructed and all {@code @Value} fields
     * have been injected. This is the right place to perform one-time setup that
     * depends on injected values.</p>
     *
     * <p>Setting {@code Stripe.apiKey} is a global, static configuration step
     * required by the Stripe Java SDK before any API call can be made. Doing it here
     * (rather than in the constructor) ensures the {@code secretKey} field has
     * already been populated by Spring's dependency injection.</p>
     */
    // Called once after all @Value fields are populated. This is the lifecycle
    // callback equivalent of "run this after construction is fully complete".
    @PostConstruct
    public void init() {
        // Sets the global API key for the Stripe SDK. Every subsequent Stripe API
        // call (Session.create, Customer.retrieve, etc.) will automatically include
        // this key in the Authorization header of its HTTPS request to Stripe.
        Stripe.apiKey = secretKey;
    }

    /**
     * Creates a Stripe Checkout Session and returns the hosted payment page URL.
     *
     * <p>Stripe Checkout is a pre-built, Stripe-hosted payment form. We create a
     * "session" object server-side that describes what the customer is paying for,
     * and Stripe gives us back a URL. The frontend redirects the seller to that URL.
     * After payment, Stripe redirects back to our success/cancel URL.</p>
     *
     * <p>Using {@code Mode.SUBSCRIPTION} tells Stripe this is a recurring payment
     * (monthly), not a one-time charge. Stripe handles all renewal invoicing
     * automatically after the initial checkout.</p>
     *
     * @param userEmail the seller's email address, pre-filled in the Stripe checkout form
     * @param priceId   the Stripe Price object ID (e.g. "price_1OxABC...") that defines
     *                  the amount and billing interval for the subscription
     * @return the URL of the Stripe-hosted checkout page to redirect the seller to
     * @throws StripeException if the Stripe API call fails (network error, invalid key, etc.)
     */
    public String createCheckoutSession(String userEmail, String priceId) throws StripeException {
        // Build the parameters for the checkout session using Stripe's fluent builder API.
        // Each method call on the builder sets one configuration option for the session.
        SessionCreateParams params = SessionCreateParams.builder()
                // Mode.SUBSCRIPTION creates a recurring billing subscription rather than
                // a single one-time payment. Stripe will automatically generate invoices
                // and charge the card every billing cycle.
                .setMode(SessionCreateParams.Mode.SUBSCRIPTION)

                // Where Stripe redirects the seller after a successful payment.
                // The {CHECKOUT_SESSION_ID} placeholder is replaced by Stripe with the
                // actual session ID, allowing our frontend to verify the completed payment.
                .setSuccessUrl(frontendUrl + "/payment/success?session_id={CHECKOUT_SESSION_ID}")

                // Where Stripe redirects if the seller clicks "Back" or closes the tab.
                // We do NOT treat a cancel as a failure — we just show them a friendly page.
                .setCancelUrl(frontendUrl + "/payment/cancel")

                // Pre-fill the email field on the Stripe checkout form for convenience.
                .setCustomerEmail(userEmail)

                // addLineItem defines what is being purchased. A subscription checkout
                // must have exactly one line item describing the plan.
                .addLineItem(SessionCreateParams.LineItem.builder()
                        // The Stripe Price ID links to a price configured in the Stripe
                        // dashboard (amount + currency + billing interval). This decouples
                        // our code from the price amount — if we want to change pricing,
                        // we update the Stripe dashboard, not the code.
                        .setPrice(priceId)
                        // Quantity is always 1 for a per-seller subscription.
                        .setQuantity(1L)
                        .build())
                .build();

        // Make the API call to Stripe to create the session. This is a synchronous
        // HTTPS request to api.stripe.com. If it fails, a StripeException is thrown.
        Session session = Session.create(params);

        // Return only the URL — the controller will wrap it in a JSON response body.
        // The URL is time-limited (typically 24 hours) and single-use.
        return session.getUrl();
    }

    /**
     * Processes an incoming Stripe webhook event.
     *
     * <h2>Security: Signature Verification</h2>
     * <p>Before doing anything, {@link Webhook#constructEvent} cryptographically
     * verifies that the request came from Stripe by checking the {@code Stripe-Signature}
     * header against the raw payload using the shared {@code webhookSecret}. If the
     * signature is invalid (e.g. the request was forged or the payload was modified),
     * a {@link com.stripe.exception.SignatureVerificationException} is thrown and we
     * return HTTP 400, rejecting the request.</p>
     *
     * <h2>Event types handled</h2>
     * <ul>
     *   <li>{@code checkout.session.completed} — The seller finished payment; activate
     *       the subscription in our database.</li>
     *   <li>{@code invoice.paid} — A recurring renewal succeeded; extend the
     *       subscription's {@code expiresAt} date.</li>
     *   <li>{@code invoice.payment_failed} — A renewal failed; mark the subscription
     *       as SUSPENDED or notify the seller to update their card.</li>
     * </ul>
     *
     * @param payload   the raw JSON body of the webhook POST (must be the original bytes,
     *                  not parsed, for signature verification to work)
     * @param sigHeader the value of the {@code Stripe-Signature} HTTP header sent by Stripe
     * @throws StripeException if signature verification fails or the payload is malformed
     */
    public void handleWebhook(String payload, String sigHeader) throws StripeException {
        // Verify the webhook signature and deserialise the event object.
        // This single call does two things:
        //   1. Checks the HMAC-SHA256 signature in sigHeader against the payload
        //      using webhookSecret. Throws SignatureVerificationException on mismatch.
        //   2. Parses the JSON payload into a strongly-typed Stripe Event object.
        Event event = Webhook.constructEvent(payload, sigHeader, webhookSecret);

        // Route the event to the appropriate handler based on its type.
        // Stripe sends many event types; we only act on the ones relevant to
        // subscription lifecycle. All others are safely ignored.
        switch (event.getType()) {
            case "checkout.session.completed":
                // The seller completed the Stripe-hosted checkout form and their card
                // was successfully charged for the first billing period.
                // TODO: Extract the customer/subscription ID from the event data,
                // look up the seller, and update their Subscription record to VERIFIED.
                break;

            case "invoice.paid":
                // Stripe automatically charges the seller on each renewal date and
                // fires this event when the charge succeeds. Use this to extend the
                // subscription's expiresAt by one billing period, keeping the seller
                // active without any manual intervention.
                break;

            case "invoice.payment_failed":
                // The renewal charge failed (expired card, insufficient funds, etc.).
                // Best practice: mark the subscription as PAST_DUE, send the seller an
                // email, and give them a grace period before suspending their account.
                break;

            default:
                // Log unhandled event types so we can monitor what Stripe is sending
                // and add handlers later if needed. We still return 200 to Stripe to
                // acknowledge receipt — returning 4xx would cause Stripe to retry.
                System.out.println("Unhandled event type: " + event.getType());
        }
    }
}
