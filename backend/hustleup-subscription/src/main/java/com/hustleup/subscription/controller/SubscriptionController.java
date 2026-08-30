package com.hustleup.subscription.controller;

import com.hustleup.common.model.Subscription;
import com.hustleup.common.repository.SubscriptionRepository;
import com.hustleup.common.model.User;
import com.hustleup.common.repository.UserRepository;
import com.hustleup.subscription.model.SubscriptionPlan;
import com.hustleup.subscription.service.StripeService;
import com.stripe.exception.StripeException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.Map;
import java.util.Optional;

/**
 * REST controller that exposes HTTP endpoints for managing seller subscriptions.
 *
 * <h2>What is a REST Controller?</h2>
 * <p>A controller is the "front door" of a Spring web application. When an HTTP
 * request arrives, Spring's DispatcherServlet inspects the URL and HTTP method,
 * finds the matching controller method, calls it, and serialises the return value
 * to JSON (because of {@code @RestController}).</p>
 *
 * <h2>Why @RestController and not @Controller?</h2>
 * <p>{@code @RestController} is shorthand for {@code @Controller} + {@code @ResponseBody}.
 * The {@code @ResponseBody} part tells Spring to write the method's return value
 * directly into the HTTP response body as JSON, rather than treating it as a view
 * name (like a Thymeleaf template). Since HustleUp has a separate frontend (React/
 * mobile app), all our controllers return JSON.</p>
 *
 * <h2>Security model</h2>
 * <p>Both endpoints only require the caller to be authenticated — Premium is a
 * platform-wide plan available to every account (buyers included, e.g. for
 * premium-gated features like Hustle Bond), not just sellers. This is enforced
 * by {@code @PreAuthorize} method-level security annotations, which run before
 * the method body executes. If the check fails, Spring Security throws an
 * {@code AccessDeniedException} and returns HTTP 403 Forbidden — the method
 * body is never reached.</p>
 *
 * <h2>Base path</h2>
 * <p>All endpoints in this controller are prefixed with {@code /api/v1/subscriptions}.
 * The {@code /api} prefix distinguishes REST endpoints from static files, {@code /v1}
 * allows future API versions without breaking existing clients.</p>
 */
// Combines @Controller + @ResponseBody. All return values are auto-serialised to JSON.
@RestController

// All methods in this class share the "/api/v1/subscriptions" URL prefix.
@RequestMapping("/api/v1/subscriptions")
public class SubscriptionController {

    // -------------------------------------------------------------------------
    // Dependencies (injected via constructor)
    // -------------------------------------------------------------------------

    // Used to read and write Subscription records in the database.
    // Declared final so it cannot be accidentally reassigned after construction.
    private final SubscriptionRepository subscriptionRepository;

    // Used to look up the currently authenticated user by their email address.
    // The User entity lives in the shared 'common' module so it can be referenced
    // by multiple services without code duplication.
    private final UserRepository userRepository;

    /**
     * Constructor-based dependency injection.
     *
     * <p>Spring Boot recommends constructor injection over field injection
     * ({@code @Autowired} on a field) for several reasons:</p>
     * <ul>
     *   <li>Dependencies are explicit — a reader immediately sees what this class needs.</li>
     *   <li>Fields can be {@code final}, preventing accidental re-assignment.</li>
     *   <li>Easier to write unit tests — you can pass mock objects directly.</li>
     * </ul>
     * <p>Spring automatically detects single-constructor classes and injects the
     * appropriate beans without needing an {@code @Autowired} annotation here.</p>
     *
     * @param subscriptionRepository Spring Data repository for Subscription entities
     * @param userRepository         Spring Data repository for User entities (shared module)
     */
    private static final Logger log = LoggerFactory.getLogger(SubscriptionController.class);

    private final StripeService stripeService;

    public SubscriptionController(SubscriptionRepository subscriptionRepository,
                                  UserRepository userRepository,
                                  StripeService stripeService) {
        this.subscriptionRepository = subscriptionRepository;
        this.userRepository = userRepository;
        this.stripeService = stripeService;
    }

    // -------------------------------------------------------------------------
    // Endpoints
    // -------------------------------------------------------------------------

    /**
     * Returns the authenticated seller's current subscription details.
     *
     * <ul>
     *   <li><b>HTTP method:</b> GET (read-only, idempotent, cacheable)</li>
     *   <li><b>Path:</b> {@code GET /api/v1/subscriptions/my}</li>
     *   <li><b>Auth:</b> Bearer JWT required — any authenticated user</li>
     *   <li><b>Response 200:</b> JSON representation of the {@link Subscription} entity,
     *       or {@code {"plan":"FREE"}} if no subscription record exists yet.</li>
     * </ul>
     *
     * <p>New sellers are implicitly on the FREE plan — they may not have a row in the
     * {@code subscriptions} table yet. Rather than throwing a 404, we return a minimal
     * response describing the default state so the frontend can render correctly.</p>
     *
     * @return 200 OK with the Subscription JSON, or a synthetic FREE plan object
     */
    // Maps HTTP GET requests to /api/v1/subscriptions/my to this method.
    @GetMapping("/my")

    // Spring Security method-level guard. Any authenticated user may check their
    // own subscription — Premium is not restricted to sellers.
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> getMySubscription() {
        // Resolve the currently authenticated user from the security context.
        User user = getCurrentUser();

        // Attempt to find their subscription in the DB.
        // Optional.map transforms the found Subscription into a 200 ResponseEntity.
        // orElse provides a fallback for sellers who have no subscription row yet.
        return subscriptionRepository.findBySellerId(user.getId())
                // If a Subscription exists, wrap it in a 200 OK response.
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                // If no Subscription row exists, return a default FREE plan payload.
                // Map.of creates an immutable single-entry map; Jackson serialises it to JSON.
                .orElse(ResponseEntity.ok(Map.of("plan", "FREE")));
    }

    /**
     * The Premium price list.
     *
     * <p><b>Path:</b> {@code GET /api/v1/subscriptions/plans} — the UI renders whatever this
     * returns, so prices are never hardcoded in two places and cannot drift apart from what
     * checkout actually charges.
     */
    @GetMapping("/plans")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> plans() {
        return ResponseEntity.ok(Map.of(
                "currency", SubscriptionPlan.CURRENCY,
                "plans", Arrays.stream(SubscriptionPlan.values())
                        .map(p -> Map.of(
                                "id", p.name(),
                                "label", p.getLabel(),
                                "months", p.getMonths(),
                                "price", p.getAmount(),
                                "pricePerMonth", p.getPricePerMonth()))
                        .toList()));
    }

    /**
     * Starts a paid upgrade: returns a Stripe Checkout URL for the chosen plan.
     *
     * <ul>
     *   <li><b>Path:</b> {@code POST /api/v1/subscriptions/checkout}</li>
     *   <li><b>Body:</b> {@code {"plan":"MONTHLY"|"QUARTERLY"|"ANNUAL"}}</li>
     *   <li><b>Response 200:</b> {@code {"checkoutUrl":"https://checkout.stripe.com/..."}}</li>
     * </ul>
     *
     * <p><b>This does not grant Premium.</b> It only creates the payment page. The account is
     * upgraded solely by {@code checkout.session.completed} arriving on the signed Stripe
     * webhook, once the money has actually cleared.
     *
     * <p>This replaces a {@code POST /upgrade} endpoint that set the plan to VERIFIED for a
     * month with no payment of any kind — any authenticated caller could grant themselves
     * Premium indefinitely by calling it directly, and the browser "upgrade" button did
     * exactly that. Only the amount named by {@link SubscriptionPlan} can be charged; the
     * client chooses a plan, never a price.
     */
    @PostMapping("/checkout")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> checkout(@RequestBody(required = false) Map<String, String> body) {
        String requested = body == null ? null : body.get("plan");
        Optional<SubscriptionPlan> plan = SubscriptionPlan.from(requested);
        if (plan.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "Unknown plan",
                    "validPlans", Arrays.stream(SubscriptionPlan.values()).map(Enum::name).toList()));
        }

        try {
            String url = stripeService.createCheckoutSession(getCurrentUser(), plan.get());
            return ResponseEntity.ok(Map.of("checkoutUrl", url));
        } catch (StripeException e) {
            // Typically a bad or unconfigured STRIPE_SECRET_KEY. Surfaced as 502 rather than
            // 500: the failure is in the upstream payment provider, not in this request.
            log.error("Stripe checkout session failed for plan {}", plan.get(), e);
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .body(Map.of("error", "Could not start checkout. Please try again."));
        }
    }

    /**
     * Confirms a checkout the buyer has just been redirected back from, and grants Premium.
     *
     * <p><b>POST /api/v1/subscriptions/confirm</b> — body {@code {"sessionId": "cs_..."}}
     *
     * <p>The webhook remains the authority when it arrives, but it is not guaranteed to. It
     * has to be registered in the Stripe dashboard and able to reach this server, and where it
     * is not, the payment succeeded and the buyer got nothing — which is exactly the failure
     * this endpoint exists to close. Driven by the buyer's own browser, it works in any
     * environment Stripe can redirect to, including local development with no tunnel.
     *
     * <p>Safe to call repeatedly. The grant is keyed on the session id, so this and the
     * webhook cannot both add a term for the same payment.
     *
     * @return 200 with {@code {premiumActive, message}} — {@code premiumActive} false is a
     *         normal answer (payment still clearing, or not a Premium purchase), not an error
     */
    @PostMapping("/confirm")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> confirm(@RequestBody(required = false) Map<String, String> body) {
        String sessionId = body == null ? null : body.get("sessionId");
        if (sessionId == null || sessionId.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "sessionId is required"));
        }

        try {
            StripeService.ConfirmResult result = stripeService.confirmCheckout(sessionId, getCurrentUser().getId());
            return ResponseEntity.ok(Map.of(
                    "premiumActive", result.premiumActive(),
                    "message", result.message()));
        } catch (StripeException e) {
            log.error("Could not confirm checkout session {}", sessionId, e);
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .body(Map.of("error", "Could not confirm that payment. Please try again."));
        }
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /**
     * Resolves the currently authenticated user from the Spring Security context.
     *
     * <p>When a request arrives with a valid JWT, the security filter chain parses
     * the token and stores an {@link org.springframework.security.core.Authentication}
     * object in {@link SecurityContextHolder}. The authentication's "name" is the
     * email address encoded in the JWT subject claim.</p>
     *
     * <p>We then load the full {@link User} entity from the database so we have
     * access to the user's UUID (needed to query the subscription table).</p>
     *
     * @return the authenticated {@link User} entity
     * @throws RuntimeException if no user exists for the authenticated email (should
     *                          not happen in normal operation — the JWT was issued for
     *                          a user that existed at login time)
     */
    private User getCurrentUser() {
        // SecurityContextHolder is a thread-local store. Each HTTP request is
        // handled by a dedicated thread, so this is safe in a concurrent environment.
        // getAuthentication().getName() returns the JWT subject (the user's email).
        String email = SecurityContextHolder.getContext().getAuthentication().getName();

        // Look up the full user record by email. orElseThrow converts an empty
        // Optional to an exception, which Spring will translate to a 500 response.
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }
}
