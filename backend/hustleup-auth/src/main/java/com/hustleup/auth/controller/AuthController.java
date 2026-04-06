package com.hustleup.auth.controller;

import com.hustleup.auth.dto.AuthDtos;
import com.hustleup.auth.model.RefreshToken;
import com.hustleup.auth.repository.RefreshTokenRepository;
import com.hustleup.common.security.JwtTokenProvider;
import com.hustleup.common.dto.UserDto;
import com.hustleup.common.model.Role;
import com.hustleup.common.model.User;
import com.hustleup.common.repository.UserRepository;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.*;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.UUID;

/**
 * AuthController — handles all HTTP endpoints related to user authentication.
 *
 * <p>This controller owns four public auth endpoints:</p>
 * <ul>
 *   <li>{@code POST /api/v1/auth/register} — create a new account</li>
 *   <li>{@code POST /api/v1/auth/login}    — authenticate and receive tokens</li>
 *   <li>{@code POST /api/v1/auth/refresh}  — exchange a refresh token for a new access token</li>
 *   <li>{@code GET  /api/v1/auth/me}       — return the currently authenticated user's profile</li>
 * </ul>
 *
 * <h2>JWT authentication overview (stateless security)</h2>
 * <p>Traditional session-based auth keeps login state on the server (in memory or a DB).
 * With JWT (JSON Web Token) the server is <em>stateless</em>: after login the server
 * signs a compact token and hands it to the client. Every subsequent request carries
 * that token in the {@code Authorization: Bearer <token>} header. The server only needs
 * to verify the signature — no database lookup for session state required. This makes
 * horizontal scaling trivial and eliminates sticky-session requirements.</p>
 *
 * <h2>Two-token strategy: access + refresh</h2>
 * <p>Access tokens are short-lived (typically 15 min – 1 h) to limit the damage if
 * they are stolen. Refresh tokens are long-lived (7 days here) and stored in the
 * database so they can be revoked. When the access token expires the client sends the
 * refresh token to {@code /refresh} and receives a new access token without requiring
 * the user to log in again.</p>
 *
 * <h2>Why constructor injection?</h2>
 * <p>All dependencies are injected through the constructor rather than field injection
 * ({@code @Autowired} on fields). Constructor injection makes dependencies explicit,
 * simplifies unit testing (you can just {@code new AuthController(mockRepo, ...)}),
 * and prevents Spring from creating a partially-initialised object.</p>
 */
// @RestController combines @Controller and @ResponseBody.
// @Controller marks this as a Spring MVC handler; @ResponseBody tells Spring to
// serialise every return value directly to JSON (via Jackson) instead of rendering
// a view template. Without @ResponseBody Spring would try to find an HTML template.
@RestController

// All endpoints in this class are prefixed with /api/v1/auth.
// Versioning in the path (/v1/) is a best-practice: it lets us introduce /v2/ without
// breaking existing clients.
@RequestMapping("/api/v1/auth")
public class AuthController {

    // -------------------------------------------------------------------------
    // Dependencies (injected by Spring at startup)
    // -------------------------------------------------------------------------

    // UserRepository provides CRUD operations for the User entity.
    // Spring Data generates the SQL implementation automatically at runtime.
    private final UserRepository userRepository;

    // PasswordEncoder is responsible for hashing passwords before storing them
    // and for verifying a plain-text password against a stored hash.
    // BCrypt (the default implementation) is used because it's slow by design
    // (adaptive cost factor), making brute-force attacks impractical.
    private final PasswordEncoder passwordEncoder;

    // AuthenticationManager is the central Spring Security entry point for
    // authenticating a username/password pair. It delegates to the configured
    // AuthenticationProvider (which in turn uses CustomUserDetailsService).
    private final AuthenticationManager authenticationManager;

    // JwtTokenProvider (from hustleup-common) handles signing and parsing JWTs.
    // Centralising this logic in the shared library means every service uses
    // exactly the same algorithm and secret key.
    private final JwtTokenProvider tokenProvider;

    // RefreshTokenRepository persists refresh tokens in the database so they
    // can be validated, rotated, or revoked (e.g., on logout or password change).
    private final RefreshTokenRepository refreshTokenRepository;

    /**
     * Constructor injection — Spring calls this constructor and supplies all
     * dependencies from the IoC container automatically.
     *
     * @param userRepository         data access for {@link User}
     * @param passwordEncoder        BCrypt encoder/verifier
     * @param authenticationManager  Spring Security authentication entry point
     * @param tokenProvider          JWT creation and validation utility
     * @param refreshTokenRepository data access for {@link RefreshToken}
     */
    public AuthController(UserRepository userRepository, PasswordEncoder passwordEncoder,
                          AuthenticationManager authenticationManager, JwtTokenProvider tokenProvider,
                          RefreshTokenRepository refreshTokenRepository) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.authenticationManager = authenticationManager;
        this.tokenProvider = tokenProvider;
        this.refreshTokenRepository = refreshTokenRepository;
    }

    // =========================================================================
    // Endpoints
    // =========================================================================

    /**
     * Register a new user account.
     *
     * <p><strong>HTTP:</strong> {@code POST /api/v1/auth/register}</p>
     * <p><strong>Body:</strong> {@link AuthDtos.RegisterRequest} JSON</p>
     * <p><strong>Called by:</strong> the React/mobile registration form</p>
     *
     * <p>Flow:</p>
     * <ol>
     *   <li>Validate the request body (handled by {@code @Valid} + Bean Validation).</li>
     *   <li>Reject duplicate emails immediately — email is the unique identity key.</li>
     *   <li>Hash the password with BCrypt before persisting.</li>
     *   <li>Persist the new {@link User} row.</li>
     *   <li>Immediately authenticate the user so they receive tokens right away
     *       (no separate login step after registration).</li>
     * </ol>
     *
     * @param request validated registration payload from the request body
     * @return {@code 200 OK} with {@link AuthDtos.AuthResponse} on success,
     *         {@code 400 Bad Request} with an error map if email already exists
     */
    // @PostMapping("/register") maps HTTP POST requests at /api/v1/auth/register to this method.
    @PostMapping("/register")
    public ResponseEntity<?> register(
            // @Valid triggers Bean Validation on the incoming object.
            // If any @NotBlank / @Email / @Size constraint fails, Spring returns 400
            // automatically — we never even enter this method body.
            // @RequestBody tells Spring to deserialise the HTTP request body (JSON) into
            // a RegisterRequest object using Jackson.
            @Valid @RequestBody AuthDtos.RegisterRequest request) {

        // Guard: prevent duplicate accounts. existsByEmail is a Spring Data derived
        // query — Spring generates "SELECT COUNT(*) FROM users WHERE email = ?" for us.
        if (userRepository.existsByEmail(request.getEmail())) {
            // ResponseEntity.badRequest() sets HTTP 400. We wrap the message in a Map
            // so the client receives a consistent JSON structure: {"error": "..."}.
            return ResponseEntity.badRequest().body(java.util.Map.of("error", "Email already registered"));
        }

        // Build a new User using the Lombok @Builder pattern.
        // The builder pattern is a readable, null-safe alternative to a long constructor call.
        // IMPORTANT: passwordEncoder.encode() hashes the plain-text password. We must
        // NEVER store plain-text passwords. BCrypt produces a different hash each call
        // (thanks to a random salt), so the same password has different hashes across rows.
        User user = User.builder()
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword())) // hash, never store plain text
                .fullName(request.getFullName())
                .phone(request.getPhone())
                .role(Role.valueOf(request.getRole())) // convert "BUYER"/"SELLER" string to enum
                .build();

        // Persist the new user. JPA/Hibernate generates an INSERT statement.
        userRepository.save(user);

        // Authenticate the freshly-registered user immediately.
        // UsernamePasswordAuthenticationToken wraps credentials. AuthenticationManager
        // verifies them against the DB via CustomUserDetailsService.
        // Note: we use the PLAIN-TEXT password here because authenticationManager
        // internally calls passwordEncoder.matches() — it expects the raw password.
        Authentication auth = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword()));

        // Issue tokens and return the auth response (shared helper below).
        return buildAuthResponse(auth, user);
    }

    /**
     * Authenticate an existing user and issue tokens.
     *
     * <p><strong>HTTP:</strong> {@code POST /api/v1/auth/login}</p>
     * <p><strong>Body:</strong> {@link AuthDtos.LoginRequest} JSON</p>
     * <p><strong>Called by:</strong> the login form on web and mobile clients</p>
     *
     * <p>Flow:</p>
     * <ol>
     *   <li>Delegate credential verification to {@link AuthenticationManager}.
     *       It calls {@link com.hustleup.auth.service.CustomUserDetailsService} to load
     *       the user, then compares the BCrypt hash. If it fails it throws
     *       {@link BadCredentialsException} which Spring Security maps to 401.</li>
     *   <li>Reload the full {@link User} entity (the Authentication object only
     *       carries the email).</li>
     *   <li>Issue access + refresh tokens.</li>
     * </ol>
     *
     * @param request validated login payload
     * @return {@code 200 OK} with {@link AuthDtos.AuthResponse},
     *         {@code 401 Unauthorized} on bad credentials
     */
    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody AuthDtos.LoginRequest request) {
        // This single call: loads the user by email, verifies the BCrypt hash,
        // and returns a populated Authentication object on success.
        // If credentials are wrong it throws BadCredentialsException → HTTP 401.
        Authentication auth = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword()));

        // Reload our full User entity; the Authentication object only exposes the principal
        // name (email) and authorities — we need role, fullName, avatarUrl for the response.
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new RuntimeException("User not found"));

        return buildAuthResponse(auth, user);
    }

    /**
     * Exchange a valid refresh token for a new access token.
     *
     * <p><strong>HTTP:</strong> {@code POST /api/v1/auth/refresh}</p>
     * <p><strong>Body:</strong> {@link AuthDtos.RefreshRequest} JSON</p>
     * <p><strong>Called by:</strong> the client's HTTP interceptor when an API call
     * returns 401 (access token expired)</p>
     *
     * <p>Why we need this: Access tokens are intentionally short-lived. Instead of
     * forcing the user to log in again every 15–60 minutes we issue a long-lived
     * refresh token at login time. The client stores this securely (e.g., in an
     * HttpOnly cookie or secure storage) and exchanges it here for a fresh access token.
     * Because refresh tokens are persisted in the DB they can be revoked server-side
     * (e.g., on password change or logout), unlike stateless access tokens.</p>
     *
     * @param request the refresh token string
     * @return {@code 200 OK} with a new access token (refresh token reused),
     *         {@code 400 Bad Request} if the token is unknown or expired
     */
    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(@Valid @RequestBody AuthDtos.RefreshRequest request) {
        // Look up the token record in the DB. If it doesn't exist it was never issued
        // or was already deleted (e.g., via logout), so we reject the request.
        RefreshToken refreshToken = refreshTokenRepository.findByToken(request.getRefreshToken())
                .orElseThrow(() -> new RuntimeException("Invalid refresh token"));

        // Check expiry. Instant.now() is compared to the stored expiryDate.
        // If expired, we proactively delete the record to keep the table clean,
        // then reject the request. The client must log in again.
        if (refreshToken.getExpiryDate().isBefore(Instant.now())) {
            refreshTokenRepository.delete(refreshToken); // clean up stale token
            return ResponseEntity.badRequest().body(java.util.Map.of("error", "Refresh token expired"));
        }

        // Reload the user to get their current role (it could have changed since the
        // refresh token was issued, e.g., a buyer was promoted to seller).
        User user = userRepository.findById(refreshToken.getUserId())
                .orElseThrow(() -> new RuntimeException("User not found"));

        // Generate a brand-new access token with the user's current role.
        // The refresh token itself is reused (no rotation here) — a simpler approach
        // that is still secure as long as refresh tokens are stored server-side and
        // can be revoked.
        String newAccessToken = tokenProvider.generateAccessToken(user.getEmail(), user.getRole().name());

        // Return the new access token alongside the same refresh token.
        return ResponseEntity.ok(AuthDtos.AuthResponse.builder()
                .accessToken(newAccessToken)
                .refreshToken(request.getRefreshToken()) // reuse existing refresh token
                .tokenType("Bearer")                     // OAuth 2.0 standard token type prefix
                .role(user.getRole().name())
                .fullName(user.getFullName())
                .userId(user.getId().toString())
                .build());
    }

    /**
     * Return the profile of the currently authenticated user.
     *
     * <p><strong>HTTP:</strong> {@code GET /api/v1/auth/me}</p>
     * <p><strong>Auth required:</strong> yes — {@code Authorization: Bearer <accessToken>}</p>
     * <p><strong>Called by:</strong> the client on startup to hydrate the user session
     * (e.g., display name, avatar, role-based routing)</p>
     *
     * <p>The JWT filter (in hustleup-common) runs before this method, validates the
     * token, and populates {@link SecurityContextHolder} with the authenticated user's
     * details. This method simply reads from that context — it never re-validates the
     * token itself.</p>
     *
     * @return {@code 200 OK} with {@link UserDto},
     *         {@code 401 Unauthorized} if not authenticated
     */
    @GetMapping("/me")
    public ResponseEntity<?> currentUser() {
        // SecurityContextHolder is a thread-local store that holds the security context
        // for the current request. The JWT filter populates it before the request reaches
        // any controller. Here we simply read the already-authenticated principal.
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

        // Guard against unauthenticated requests. Spring Security sets the name to
        // "anonymousUser" for requests without a valid token instead of null.
        if (authentication == null || !authentication.isAuthenticated()
                || "anonymousUser".equals(authentication.getName())) {
            return ResponseEntity.status(401).build();
        }

        // authentication.getName() returns the email (the "username" we encoded in the JWT).
        String email = authentication.getName();

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        // UserDto.fromEntity() converts the JPA entity into a safe DTO that excludes
        // sensitive fields (password hash, internal audit fields, etc.).
        return ResponseEntity.ok(UserDto.fromEntity(user));
    }

    // =========================================================================
    // Private helpers
    // =========================================================================

    /**
     * Shared helper that creates tokens, persists the refresh token, and builds
     * the {@link AuthDtos.AuthResponse} returned to the client.
     *
     * <p>Both {@code register} and {@code login} end with the same set of steps, so
     * extracting them here avoids duplication (DRY principle).</p>
     *
     * @param auth the authenticated principal (provides email via {@code getName()})
     * @param user the full {@link User} entity (provides role, name, avatar)
     * @return a {@code 200 OK} response containing the access token, refresh token,
     *         and key profile fields
     */
    private ResponseEntity<?> buildAuthResponse(Authentication auth, User user) {
        // Generate a short-lived JWT access token signed with HMAC-SHA256.
        // It embeds the user's email and role as claims so downstream services
        // can authorise requests without a DB lookup.
        String accessToken = tokenProvider.generateAccessToken(auth.getName(), user.getRole().name());

        // Generate the refresh token string (also a JWT, but with a longer expiry
        // and stored in the DB so it can be revoked).
        String refreshTokenStr = tokenProvider.generateRefreshToken(user.getEmail());

        // Persist the refresh token so we can validate and revoke it later.
        // 604_800_000 ms = 7 days. Using Instant for UTC-based, timezone-safe time arithmetic.
        RefreshToken refreshToken = RefreshToken.builder()
                .userId(user.getId())
                .token(refreshTokenStr)
                .expiryDate(Instant.now().plusMillis(604800000)) // 7 days from now
                .build();
        refreshTokenRepository.save(refreshToken);

        // Build and return the response DTO. The client stores accessToken in memory
        // and refreshToken in secure storage (HttpOnly cookie or encrypted local store).
        return ResponseEntity.ok(AuthDtos.AuthResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshTokenStr)
                .tokenType("Bearer")             // standard prefix used in Authorization header
                .role(user.getRole().name())      // lets the client enforce role-based UI routing
                .fullName(user.getFullName())
                .userId(user.getId().toString())  // UUID as string for JSON compatibility
                .avatarUrl(user.getAvatarUrl())
                .build());
    }
}
