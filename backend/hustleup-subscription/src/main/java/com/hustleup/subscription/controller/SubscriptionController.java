package com.hustleup.subscription.controller;

import com.hustleup.subscription.model.Subscription;
import com.hustleup.subscription.repository.SubscriptionRepository;
import com.hustleup.common.model.User;
import com.hustleup.common.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.Map;

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
 * <p>Both endpoints require the caller to be authenticated and to hold the
 * {@code SELLER} role. This is enforced by {@code @PreAuthorize} method-level
 * security annotations, which run before the method body executes. If the check
 * fails, Spring Security throws an {@code AccessDeniedException} and returns
 * HTTP 403 Forbidden — the method body is never reached.</p>
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
    public SubscriptionController(SubscriptionRepository subscriptionRepository, UserRepository userRepository) {
        this.subscriptionRepository = subscriptionRepository;
        this.userRepository = userRepository;
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
     *   <li><b>Auth:</b> Bearer JWT required; caller must have role {@code SELLER}</li>
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

    // Spring Security method-level guard. The SpEL expression 'hasRole('SELLER')'
    // is evaluated before the method runs. If the JWT does not contain ROLE_SELLER,
    // the request is rejected with 403 Forbidden before any DB query is made.
    @PreAuthorize("hasRole('SELLER')")
    public ResponseEntity<?> getMySubscription() {
        // Resolve the currently authenticated seller from the security context.
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
     * Upgrades the authenticated seller's plan to VERIFIED for one month.
     *
     * <ul>
     *   <li><b>HTTP method:</b> POST (mutating operation; not idempotent)</li>
     *   <li><b>Path:</b> {@code POST /api/v1/subscriptions/upgrade}</li>
     *   <li><b>Auth:</b> Bearer JWT required; caller must have role {@code SELLER}</li>
     *   <li><b>Request body:</b> none required</li>
     *   <li><b>Response 200:</b> {@code {"success":true,"plan":"VERIFIED","expiresAt":"..."}}</li>
     * </ul>
     *
     * <p>If the seller already has a subscription record, it is updated in place.
     * If they do not (first upgrade from FREE), a new record is created using the
     * Lombok builder with only {@code sellerId} set; all other fields adopt their
     * {@code @Builder.Default} values before the overrides below are applied.</p>
     *
     * <p><b>Note:</b> In a production flow, this endpoint would typically be called
     * <em>after</em> the Stripe webhook confirms payment, not directly by the client.
     * Calling it directly without verifying payment is suitable for development/testing.</p>
     *
     * @return 200 OK with a JSON summary of the new subscription state
     */
    // Maps HTTP POST requests to /api/v1/subscriptions/upgrade to this method.
    @PostMapping("/upgrade")

    // Same role guard as above — only authenticated SELLER users may upgrade.
    @PreAuthorize("hasRole('SELLER')")
    public ResponseEntity<?> upgrade() {
        // Resolve the currently authenticated seller.
        User user = getCurrentUser();

        // Find an existing subscription or create a new one.
        // Subscription.builder().sellerId(...).build() creates a transient (unsaved)
        // entity; hibernate will INSERT it on save() because it has no id yet.
        Subscription sub = subscriptionRepository.findBySellerId(user.getId())
                .orElse(Subscription.builder().sellerId(user.getId()).build());

        // Apply the VERIFIED plan attributes to the entity.
        sub.setPlan("VERIFIED");      // Upgrade from FREE to VERIFIED.
        sub.setStatus("ACTIVE");      // Ensure the status is active (in case it was EXPIRED).
        sub.setStartedAt(LocalDateTime.now());                  // Record when this period started.
        sub.setExpiresAt(LocalDateTime.now().plusMonths(1));    // Grant exactly 30 days.

        // Persist the entity. JPA's save() performs an INSERT if id is null,
        // or an UPDATE if the entity already has an id (merge semantics).
        subscriptionRepository.save(sub);

        // Return a summary so the frontend can update the UI immediately without
        // needing to make a follow-up GET request.
        return ResponseEntity.ok(Map.of("success", true, "plan", "VERIFIED", "expiresAt", sub.getExpiresAt()));
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
