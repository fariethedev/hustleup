package com.hustleup.subscription.service;

import com.hustleup.common.model.Subscription;
import com.hustleup.common.model.User;
import com.hustleup.common.repository.SubscriptionRepository;
import com.hustleup.subscription.model.SubscriptionPlan;
import com.stripe.Stripe;
import com.stripe.exception.StripeException;
import com.stripe.model.Event;
import com.stripe.model.checkout.Session;
import com.stripe.net.Webhook;
import com.stripe.param.checkout.SessionCreateParams;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

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

    private static final Logger log = LoggerFactory.getLogger(StripeService.class);

    /**
     * Activating a plan writes to the same table {@code SubscriptionController} reads and
     * {@code PremiumAccess} authorises from — the webhook is the only thing that may grant
     * Premium, so it needs direct access rather than going back through the API.
     */
    private final SubscriptionRepository subscriptionRepository;

    public StripeService(SubscriptionRepository subscriptionRepository) {
        this.subscriptionRepository = subscriptionRepository;
    }

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
    public String createCheckoutSession(User user, SubscriptionPlan plan) throws StripeException {
        SessionCreateParams params = SessionCreateParams.builder()
                // PAYMENT, not SUBSCRIPTION: each plan buys a fixed term up front rather
                // than renewing itself. Auto-renewal would need invoice.paid, cancellation
                // and dunning handling, all of which are currently unimplemented stubs —
                // half-built recurring billing fails in ways prepaid terms cannot.
                .setMode(SessionCreateParams.Mode.PAYMENT)

                .setSuccessUrl(frontendUrl + "/payment/success?session_id={CHECKOUT_SESSION_ID}")
                .setCancelUrl(frontendUrl + "/payment/cancel")
                .setCustomerEmail(user.getEmail())

                // How the webhook knows whose account to upgrade. Identifying the payer by
                // email would break for anyone who pays with a different address than they
                // registered with; the user id is stable and unambiguous.
                .setClientReferenceId(user.getId().toString())
                .putMetadata("userId", user.getId().toString())
                .putMetadata("plan", plan.name())

                .addLineItem(SessionCreateParams.LineItem.builder()
                        .setQuantity(1L)
                        // Inline price_data rather than a dashboard Price ID: the amount is
                        // fixed by the server-side enum, so the client cannot substitute a
                        // cheaper plan, and there is no dashboard state to keep in sync.
                        .setPriceData(SessionCreateParams.LineItem.PriceData.builder()
                                .setCurrency(SubscriptionPlan.CURRENCY.toLowerCase())
                                .setUnitAmount(plan.getAmountMinorUnits())
                                .setProductData(SessionCreateParams.LineItem.PriceData.ProductData.builder()
                                        .setName("HustleUp Premium — " + plan.getLabel())
                                        .setDescription("Premium access for " + plan.getMonths()
                                                + (plan.getMonths() == 1 ? " month" : " months"))
                                        .build())
                                .build())
                        .build())
                .build();

        Session session = Session.create(params);
        log.info("Created checkout session {} for user {} on plan {}",
                session.getId(), user.getId(), plan);
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
                // The only path that grants Premium. Reached only after Stripe has taken
                // the money AND the signature above verified, so a forged request cannot
                // upgrade an account.
                activateFromSession(event);
                break;

            case "invoice.paid":
            case "invoice.payment_failed":
                // Renewal events. Plans are one-time prepaid terms today, so Stripe never
                // raises invoices for them and these cannot fire. Named explicitly so they
                // are not mistaken for unhandled events in the logs if recurring billing is
                // added later.
                log.info("Ignoring {} — plans are prepaid terms, not recurring", event.getType());
                break;

            default:
                // Log unhandled event types so we can monitor what Stripe is sending
                // and add handlers later if needed. We still return 200 to Stripe to
                // acknowledge receipt — returning 4xx would cause Stripe to retry.
                log.debug("Unhandled Stripe event type: {}", event.getType());
        }
    }

    /**
     * Grants Premium off the back of a paid checkout session.
     *
     * <p>Reads who and which plan from the session's own metadata rather than trusting
     * anything the browser reported: the browser is redirected to the success page whether
     * or not the charge cleared, so a client-side "payment done" call would be trivially
     * forgeable. Stripe's signed webhook is the only trustworthy signal that money moved.
     *
     * <p><strong>Extends rather than overwrites.</strong> Buying a second term while one is
     * still running adds to the remaining time instead of discarding it — otherwise renewing
     * early would silently cost the buyer whatever they had left.
     *
     * <p>Deliberately does not throw. The caller returns 200 to Stripe on any handled event,
     * and an exception here would make Stripe retry an event that will fail identically every
     * time. A payment that cannot be matched to a user is logged loudly instead, because it
     * means someone has been charged and not upgraded.
     */
    private void activateFromSession(Event event) {
        Optional<Session> session = event.getDataObjectDeserializer()
                .getObject()
                .filter(Session.class::isInstance)
                .map(Session.class::cast);

        if (session.isEmpty()) {
            log.error("checkout.session.completed could not be deserialised — "
                    + "a payment may have succeeded without granting Premium. Event {}", event.getId());
            return;
        }
        Session s = session.get();

        // Only "paid" means the money actually cleared. A session can complete with an
        // async or delayed payment method still pending, and upgrading on that would give
        // away Premium for a charge that may yet fail.
        if (!"paid".equals(s.getPaymentStatus())) {
            log.info("Session {} completed with payment_status={} — not granting Premium yet",
                    s.getId(), s.getPaymentStatus());
            return;
        }

        Map<String, String> metadata = s.getMetadata() == null ? Map.of() : s.getMetadata();

        // Bookings, storefront orders and subscriptions all finish as the same event type,
        // and both webhook endpoints subscribe to it. The `plan` key is what marks a session
        // as a subscription purchase: without it this is somebody buying a listing, which is
        // the marketplace service's business. Ignored quietly — treating it as a failed
        // upgrade would log an error on every ordinary sale.
        String planName = metadata.get("plan");
        if (planName == null || planName.isBlank()) {
            log.debug("Session {} carries no plan metadata — not a subscription purchase", s.getId());
            return;
        }

        // Past this point the session IS a subscription purchase, so anything unusable is a
        // real failure: money has been taken and somebody is owed Premium.
        Optional<SubscriptionPlan> plan = SubscriptionPlan.from(planName);
        if (plan.isEmpty()) {
            log.error("Session {} names unknown plan '{}'. Payment taken but nobody upgraded.",
                    s.getId(), planName);
            return;
        }
        SubscriptionPlan p = plan.get();

        String rawUserId = s.getClientReferenceId() != null
                ? s.getClientReferenceId()
                : metadata.get("userId");

        UUID userId;
        try {
            userId = UUID.fromString(rawUserId);
        } catch (IllegalArgumentException | NullPointerException e) {
            log.error("Session {} has no usable user id (client_reference_id={}, metadata={}). "
                    + "Payment taken but nobody upgraded.", s.getId(), s.getClientReferenceId(), metadata);
            return;
        }

        grantPremium(userId, p, s.getId());
    }

    /**
     * Grants a paid term, idempotently per checkout session.
     *
     * <p>Shared by the webhook and by the confirm-on-return endpoint, which both observe the
     * same completed payment and would otherwise each stack a term onto the account. The
     * session id is recorded on the subscription and re-checked here, so whichever path
     * arrives second is a no-op rather than a free extra month.
     *
     * <p>Synchronized because the two paths genuinely race: Stripe fires the webhook at
     * roughly the moment it redirects the buyer, so both can be inside this method at once,
     * and a check-then-write across two threads would let both pass the guard.
     *
     * @return true if this call granted the term, false if the session had already been honoured
     */
    public synchronized boolean grantPremium(UUID userId, SubscriptionPlan p, String sessionId) {
        Subscription sub = subscriptionRepository.findBySellerId(userId)
                .orElseGet(() -> Subscription.builder().sellerId(userId).build());

        if (sessionId != null && sessionId.equals(sub.getLastCheckoutSessionId())) {
            log.info("Session {} already granted for user {} — skipping duplicate", sessionId, userId);
            return false;
        }

        LocalDateTime now = LocalDateTime.now();
        LocalDateTime base = (sub.getExpiresAt() != null && sub.getExpiresAt().isAfter(now))
                ? sub.getExpiresAt()   // still active — stack the new term on the end
                : now;                 // new, lapsed or cancelled — start from today

        sub.setPlan(com.hustleup.common.subscription.PremiumAccess.PREMIUM_PLAN);
        sub.setStatus("ACTIVE");
        sub.setCurrency(SubscriptionPlan.CURRENCY);
        sub.setPricePerMonth(p.getPricePerMonth());
        if (sub.getStartedAt() == null) sub.setStartedAt(now);
        sub.setExpiresAt(base.plusMonths(p.getMonths()));
        sub.setLastCheckoutSessionId(sessionId);

        subscriptionRepository.save(sub);
        log.info("Premium activated for user {} on plan {} until {} (session {})",
                userId, p, sub.getExpiresAt(), sessionId);
        return true;
    }

    /**
     * Honours a completed checkout the buyer has just been redirected back from.
     *
     * <p>The webhook is the authority when it arrives, but it is not guaranteed to: it has to
     * be registered in the Stripe dashboard and able to reach this server, and when it is not,
     * payment succeeds and the buyer is left with nothing. This path is driven by the buyer's
     * own browser, so it works in any environment Stripe can redirect to.
     *
     * <p>The session is fetched from Stripe rather than trusted from the query string — the id
     * arrives via the URL, so treating it as proof of anything without asking Stripe would let
     * anyone grant themselves Premium by inventing one. The caller must also own the session,
     * or a real session id observed once could be replayed by somebody else.
     *
     * @param sessionId the Stripe Checkout Session id from the success URL
     * @param userId    the authenticated caller, who must be the session's payer
     * @throws StripeException if Stripe cannot be reached
     */
    public ConfirmResult confirmCheckout(String sessionId, UUID userId) throws StripeException {
        Session s = Session.retrieve(sessionId);

        // "paid" is the only status that means money moved. A session can be complete with
        // payment_status "unpaid" (an async method still clearing), and granting on that would
        // hand out Premium for a payment that may yet fail.
        if (!"paid".equals(s.getPaymentStatus())) {
            return new ConfirmResult(false, "Payment is not complete yet");
        }

        Map<String, String> metadata = s.getMetadata() == null ? Map.of() : s.getMetadata();
        String rawUserId = s.getClientReferenceId() != null ? s.getClientReferenceId() : metadata.get("userId");
        if (rawUserId == null || !rawUserId.equals(userId.toString())) {
            return new ConfirmResult(false, "That payment belongs to a different account");
        }

        Optional<SubscriptionPlan> plan = SubscriptionPlan.from(metadata.get("plan"));
        if (plan.isEmpty()) {
            // Not a subscription purchase — a storefront order or booking uses the same event
            // shape. Nothing to grant, and nothing wrong.
            return new ConfirmResult(false, "That payment was not a Premium purchase");
        }

        grantPremium(userId, plan.get(), sessionId);
        return new ConfirmResult(true, "Premium is active");
    }

    /** Outcome of {@link #confirmCheckout}: whether Premium is now active, and why not if it is not. */
    public record ConfirmResult(boolean premiumActive, String message) {}
}
