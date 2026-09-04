package com.hustleup.auth.controller;

import com.hustleup.auth.dto.AuthDtos;
import com.hustleup.auth.model.AuthToken;
import com.hustleup.auth.model.RefreshToken;
import com.hustleup.auth.repository.AuthTokenRepository;
import com.hustleup.auth.repository.RefreshTokenRepository;
import com.hustleup.auth.service.SocialAuthService;
import com.hustleup.auth.service.TurnstileService;
import com.hustleup.common.email.EmailService;
import com.hustleup.common.security.JwtTokenProvider;
import com.hustleup.common.dto.UserDto;
import com.hustleup.common.model.Role;
import com.hustleup.common.model.User;
import com.hustleup.common.repository.UserRepository;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.*;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.Map;
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
@Slf4j
public class AuthController {

    // Same strength bar as AuthDtos.RegisterRequest.password (@Pattern there can't be
    // reused directly since /reset-password takes a raw Map body, not a validated DTO).
    private static final java.util.regex.Pattern PASSWORD_POLICY =
            java.util.regex.Pattern.compile("^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).{8,}$");
    private static final String PASSWORD_POLICY_MESSAGE =
            "Password must be at least 8 characters and include an uppercase letter, a lowercase letter, and a number";

    /**
     * How long a refresh token stays valid — 7 days.
     *
     * <p>Because {@code /refresh} now rotates the token, this is a window of inactivity
     * rather than a hard cap on a session: every refresh restarts it, so someone using the
     * app stays signed in and only a genuine 7-day absence expires them.
     *
     * <p>Was written out as a bare {@code 604800000} in three places, which is exactly how
     * two of them end up disagreeing later.
     */
    private static final long REFRESH_TOKEN_TTL_MS = 7L * 24 * 60 * 60 * 1000;

    // -------------------------------------------------------------------------
    // Dependencies (injected by Spring at startup)
    // -------------------------------------------------------------------------

    // UserRepository provides CRUD operations for the User entity.
    // Spring Data generates the SQL implementation automatically at runtime.
    /** Verification codes are credentials, so they come from a CSPRNG, not Math.random. */
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    /**
     * How long a verification code stays valid. Short on purpose: the code is short enough
     * to brute-force given unlimited time, so the window is the main thing limiting that.
     * Long enough to survive a slow inbox, short enough that a leaked code goes stale.
     */
    private static final long VERIFY_CODE_TTL_SECONDS = 900; // 15 minutes

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

    // AuthTokenRepository persists single-use email-verification / password-reset tokens.
    private final AuthTokenRepository authTokenRepository;

    // Shared SMTP sender (hustleup-common) — logs instead of sending until MAIL_HOST is set.
    private final EmailService emailService;

    // Used to build links back to the web app inside verification/reset emails.
    private final String frontendUrl;

    // Verifies Cloudflare Turnstile tokens on registration (no-op until configured).
    private final TurnstileService turnstileService;

    // Verifies Google/Facebook OAuth access tokens against each provider directly.
    private final SocialAuthService socialAuthService;

    /**
     * Constructor injection — Spring calls this constructor and supplies all
     * dependencies from the IoC container automatically.
     *
     * @param userRepository         data access for {@link User}
     * @param passwordEncoder        BCrypt encoder/verifier
     * @param authenticationManager  Spring Security authentication entry point
     * @param tokenProvider          JWT creation and validation utility
     * @param refreshTokenRepository data access for {@link RefreshToken}
     * @param authTokenRepository    data access for {@link AuthToken}
     * @param emailService           shared transactional email sender
     * @param frontendUrl            base URL of the web app, for building email links
     */
    public AuthController(UserRepository userRepository, PasswordEncoder passwordEncoder,
                          AuthenticationManager authenticationManager, JwtTokenProvider tokenProvider,
                          RefreshTokenRepository refreshTokenRepository,
                          AuthTokenRepository authTokenRepository,
                          EmailService emailService,
                          @Value("${app.frontend.url:http://localhost:5173}") String frontendUrl,
                          TurnstileService turnstileService,
                          SocialAuthService socialAuthService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.authenticationManager = authenticationManager;
        this.tokenProvider = tokenProvider;
        this.refreshTokenRepository = refreshTokenRepository;
        this.authTokenRepository = authTokenRepository;
        this.emailService = emailService;
        this.frontendUrl = frontendUrl;
        this.turnstileService = turnstileService;
        this.socialAuthService = socialAuthService;
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

        // Bot protection: no-op (always passes) until TURNSTILE_SECRET_KEY is configured.
        if (!turnstileService.verify(request.getCaptchaToken())) {
            return ResponseEntity.badRequest().body(java.util.Map.of("error", "Captcha verification failed — please try again"));
        }

        if (!request.isTermsAccepted()) {
            return ResponseEntity.badRequest().body(java.util.Map.of("error", "You must accept the Terms & Conditions to sign up"));
        }

        // Guard: prevent duplicate accounts. existsByEmail is a Spring Data derived
        // query — Spring generates "SELECT COUNT(*) FROM users WHERE email = ?" for us.
        if (userRepository.existsByEmail(request.getEmail())) {
            // ResponseEntity.badRequest() sets HTTP 400. We wrap the message in a Map
            // so the client receives a consistent JSON structure: {"error": "..."}.
            return ResponseEntity.badRequest().body(java.util.Map.of("error", "Email already registered"));
        }

        // Checked case-insensitively: the column's UNIQUE constraint is case-sensitive under
        // MySQL's default collation, so without this "Sarah" and "sarah" would both be
        // accepted as separate handles — the exact impersonation the check exists to stop.
        String username = request.getUsername() == null ? "" : request.getUsername().trim();
        if (username.isEmpty()) {
            // Older clients don't send one. Derive a handle rather than reject the signup —
            // the account is still usable and the person can change it later.
            username = deriveUsername(request.getEmail());
        } else if (userRepository.existsByUsernameIgnoreCase(username)) {
            return ResponseEntity.badRequest().body(java.util.Map.of("error", "That username is already taken"));
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
                .username(username)
                .phone(request.getPhone())
                // Blank normalises to null so "no city" is one value in the database rather
                // than two — displayCity() on the client treats them alike, but a report
                // grouping by city would otherwise split the same absence into two buckets.
                .city(request.getCity() == null || request.getCity().isBlank()
                        ? null : request.getCity().trim())
                .role(Role.valueOf(request.getRole())) // convert "BUYER"/"SELLER" string to enum
                .termsAcceptedAt(Instant.now().atZone(java.time.ZoneOffset.UTC).toLocalDateTime())
                .build();

        // Persist the new user. JPA/Hibernate generates an INSERT statement.
        userRepository.save(user);

        // Best-effort verification email — never let a broken email provider block
        // registration itself (EmailService.send() already swallows its own failures,
        // but token creation could theoretically fail too, so this whole block is guarded).
        try {
            sendVerificationEmail(user);
        } catch (Exception e) {
            log.warn("Could not send verification email to {}: {}", user.getEmail(), e.getMessage());
        }

        // No session yet. Registration used to sign the account straight in, which made the
        // verification code decorative — you could close the email and carry on using the
        // platform, and emailVerified was written but never read. Tokens are issued by
        // verify-code instead, so confirming the address is the step that creates the session.
        //
        // Only when the email can actually arrive, though. With no transport configured — or
        // SES still in the sandbox, where mail to unverified recipients is silently dropped —
        // withholding the session would not be a security control, it would be a lockout: a
        // code nobody can receive, gating an account nobody can reach.
        if (emailService.isDeliverable()) {
            return ResponseEntity.ok(Map.of(
                    "verificationRequired", true,
                    "email", user.getEmail(),
                    "message", "Check your email for a 6-digit code to finish signing up."));
        }

        log.warn("No mail transport configured — signing {} in without email verification",
                user.getEmail());
        Authentication auth = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword()));
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

        // Checked after the password, deliberately: answering "verify your email" to an
        // unauthenticated guess would confirm the address has an account here.
        //
        // The response names the address and sets a flag rather than just refusing, so the
        // client can send the person to the code screen instead of leaving them at a login
        // form that will keep rejecting a password they know is right. Accounts that predate
        // verification, and OAuth accounts (verified by the provider), are unaffected.
        if (!user.isEmailVerified() && emailService.isDeliverable()) {
            try {
                issueVerificationCode(user);
            } catch (Exception e) {
                log.warn("Could not re-issue a verification code for {}: {}", user.getEmail(), e.getMessage());
            }
            return ResponseEntity.status(org.springframework.http.HttpStatus.FORBIDDEN).body(Map.of(
                    "error", "Confirm your email address to finish signing up. We've sent you a new code.",
                    "verificationRequired", true,
                    "email", user.getEmail()));
        }

        return buildAuthResponse(auth, user);
    }

    /**
     * Signs in (or silently creates an account for) a user via a Google OAuth access token.
     *
     * <p><strong>HTTP:</strong> {@code POST /api/v1/auth/oauth/google}</p>
     * <p><strong>Body:</strong> {@code {"accessToken": "..."}} — from the frontend's
     * {@code useGoogleLogin} implicit-flow hook.</p>
     * <p>Publicly accessible (covered by the existing {@code /api/v1/auth/**} permitAll rule).</p>
     */
    @PostMapping("/oauth/google")
    public ResponseEntity<?> googleLogin(@RequestBody Map<String, String> body) {
        try {
            SocialAuthService.SocialProfile profile = socialAuthService.verifyGoogle(body.get("accessToken"));
            return oauthAuthResponse(profile, "google");
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Signs in (or silently creates an account for) a user via a Facebook OAuth access token.
     *
     * <p><strong>HTTP:</strong> {@code POST /api/v1/auth/oauth/facebook}</p>
     * <p><strong>Body:</strong> {@code {"accessToken": "..."}} — from the Facebook JS SDK
     * via {@code @greatsumini/react-facebook-login}.</p>
     */
    @PostMapping("/oauth/facebook")
    public ResponseEntity<?> facebookLogin(@RequestBody Map<String, String> body) {
        try {
            SocialAuthService.SocialProfile profile = socialAuthService.verifyFacebook(body.get("accessToken"));
            return oauthAuthResponse(profile, "facebook");
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Shared find-or-create logic for both OAuth providers: reuse the existing account if
     * this email is already registered (however it was originally created), otherwise make
     * a new one with a random unusable password and {@code emailVerified = true} — the
     * provider already verified the address.
     */
    private ResponseEntity<?> oauthAuthResponse(SocialAuthService.SocialProfile profile, String provider) {
        User user = userRepository.findByEmail(profile.email()).orElseGet(() -> {
            User created = User.builder()
                    .email(profile.email())
                    .fullName(profile.name())
                    .password(passwordEncoder.encode(UUID.randomUUID().toString())) // unusable — OAuth-only account
                    .role(Role.BUYER) // default; can switch to SELLER via Onboarding
                    .emailVerified(true) // the provider already verified this address
                    .build();
            return userRepository.save(created);
        });

        String accessToken = tokenProvider.generateAccessToken(user.getEmail(), user.getRole().name());
        String refreshTokenStr = tokenProvider.generateRefreshToken(user.getEmail());
        refreshTokenRepository.save(RefreshToken.builder()
                .userId(user.getId())
                .token(refreshTokenStr)
                .expiryDate(Instant.now().plusMillis(REFRESH_TOKEN_TTL_MS))
                .build());

        log.info("OAuth sign-in via {}: userId={}", provider, user.getId());
        return ResponseEntity.ok(AuthDtos.AuthResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshTokenStr)
                .tokenType("Bearer")
                .role(user.getRole().name())
                .fullName(user.getFullName())
                .userId(user.getId().toString())
                .avatarUrl(user.getAvatarUrl())
                .build());
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
        String newAccessToken = tokenProvider.generateAccessToken(user.getEmail(), user.getRole().name());

        // Rotate the refresh token, giving the session a SLIDING window.
        //
        // This used to hand the same refresh token back untouched, which meant the 7-day
        // expiry ran from the moment of login and nothing could extend it. Someone using
        // the app every single day was still signed out on day seven, mid-session, for no
        // reason they could see. Issuing a fresh token here restarts the clock on every
        // refresh, so continued use keeps you signed in and only genuine absence expires
        // the session.
        //
        // Rotation is also strictly safer than reuse: the old token is deleted, so a
        // refresh token captured earlier stops working the moment the real client refreshes
        // — a stolen one is useful only until then, rather than for the rest of the week.
        String rotatedRefreshToken = tokenProvider.generateRefreshToken(user.getEmail());
        refreshTokenRepository.save(RefreshToken.builder()
                .userId(user.getId())
                .token(rotatedRefreshToken)
                .expiryDate(Instant.now().plusMillis(REFRESH_TOKEN_TTL_MS))
                .build());
        // Delete the old row only after the replacement is stored. The other order would
        // leave a window where a crash between the two writes logs the user out.
        refreshTokenRepository.delete(refreshToken);

        return ResponseEntity.ok(AuthDtos.AuthResponse.builder()
                .accessToken(newAccessToken)
                .refreshToken(rotatedRefreshToken)
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

    /**
     * Confirms an email address via the link sent by {@link #sendVerificationEmail}.
     *
     * <p><strong>HTTP:</strong> {@code GET /api/v1/auth/verify?token=...}</p>
     * <p>Publicly accessible (already covered by the {@code /api/v1/auth/**} permitAll
     * rule in CommonSecurityConfig) since the user clicks this link before they're
     * necessarily able to log in on this device.</p>
     */
    @GetMapping("/verify")
    public ResponseEntity<?> verifyEmail(@RequestParam String token) {
        AuthToken authToken = authTokenRepository.findByTokenAndPurpose(token, AuthToken.Purpose.VERIFY_EMAIL)
                .orElse(null);
        if (authToken == null || authToken.getExpiryDate().isBefore(Instant.now())) {
            return ResponseEntity.badRequest().body(Map.of("error", "This verification link is invalid or has expired"));
        }

        User user = userRepository.findById(authToken.getUserId())
                .orElseThrow(() -> new RuntimeException("User not found"));
        user.setEmailVerified(true);
        userRepository.save(user);
        authTokenRepository.delete(authToken); // single-use

        return ResponseEntity.ok(Map.of("message", "Email verified"));
    }

    /**
     * Confirms an email address from the six-digit code sent at sign-up.
     *
     * <p><strong>HTTP:</strong> {@code POST /api/v1/auth/verify-code}</p>
     * <p><strong>Body:</strong> {@code {"email": "...", "code": "123456"}}</p>
     *
     * <p>The code is matched against that specific user, never on its own — see
     * {@link AuthTokenRepository#findByUserIdAndTokenAndPurpose}. An already-verified
     * account returns 200 rather than an error, so a double submit (or a second tab)
     * reads as success instead of a confusing failure.
     */
    @PostMapping("/verify-code")
    public ResponseEntity<?> verifyCode(@RequestBody Map<String, String> body) {
        String email = body.getOrDefault("email", "").trim();
        String code = body.getOrDefault("code", "").trim();
        if (email.isEmpty() || code.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Email and code are required"));
        }

        User user = userRepository.findByEmail(email).orElse(null);
        if (user == null) {
            // Same wording as a wrong code: distinguishing them would turn this endpoint
            // into a way to test which addresses have accounts.
            return ResponseEntity.badRequest().body(Map.of("error", "That code is invalid or has expired"));
        }
        if (user.isEmailVerified()) {
            return ResponseEntity.ok(Map.of("message", "Email already verified", "alreadyVerified", true));
        }

        AuthToken authToken = authTokenRepository
                .findByUserIdAndTokenAndPurpose(user.getId(), code, AuthToken.Purpose.VERIFY_EMAIL)
                .orElse(null);
        if (authToken == null || authToken.getExpiryDate().isBefore(Instant.now())) {
            return ResponseEntity.badRequest().body(Map.of("error", "That code is invalid or has expired"));
        }

        user.setEmailVerified(true);
        userRepository.save(user);
        authTokenRepository.delete(authToken); // single-use

        // Signing in here is what makes verification the first step rather than an errand.
        // The alternative — verify, then be returned to a login form — asks for the password
        // again immediately after proving control of the address it belongs to.
        //
        // Not authenticated through the AuthenticationManager: there is no password in this
        // request to authenticate with. Possession of a single-use code sent to the address on
        // the account is what has just been proven, and that is the credential being honoured.
        Authentication auth = new UsernamePasswordAuthenticationToken(
                user.getEmail(), null, java.util.List.of());
        return buildAuthResponse(auth, user);
    }

    /**
     * Issues a fresh verification code, invalidating any previous one.
     *
     * <p><strong>HTTP:</strong> {@code POST /api/v1/auth/resend-code}</p>
     * <p><strong>Body:</strong> {@code {"email": "..."}}</p>
     *
     * <p>Always returns 200, whether or not the address has an account — for the same
     * reason {@code /forgot-password} does: the response must not reveal who is registered.
     */
    @PostMapping("/resend-code")
    public ResponseEntity<?> resendCode(@RequestBody Map<String, String> body) {
        String email = body.getOrDefault("email", "").trim();
        Map<String, Object> ok = Map.of(
                "message", "If that address needs verifying, a new code is on its way",
                "expiresInMinutes", VERIFY_CODE_TTL_SECONDS / 60);

        if (email.isEmpty()) return ResponseEntity.ok(ok);

        userRepository.findByEmail(email).ifPresent(user -> {
            if (user.isEmailVerified()) return; // nothing to confirm
            try {
                sendVerificationEmail(user);
            } catch (Exception e) {
                log.warn("Could not resend verification code to {}: {}", email, e.getMessage());
            }
        });
        return ResponseEntity.ok(ok);
    }

    /**
     * Checks whether a username is free, for live feedback on the sign-up form.
     *
     * <p><strong>HTTP:</strong> {@code GET /api/v1/auth/username-available?username=...}</p>
     *
     * <p>Returns {@code available:false} for anything that fails the format rules too, so the
     * form has one signal to drive off rather than having to duplicate the regex. Registration
     * re-checks both — this endpoint is a convenience, not the enforcement point.
     */
    @GetMapping("/username-available")
    public ResponseEntity<?> usernameAvailable(@RequestParam String username) {
        String candidate = username == null ? "" : username.trim();
        boolean wellFormed = candidate.matches("^(?![._])[A-Za-z0-9._]{3,20}(?<![._])$");
        boolean available = wellFormed && !userRepository.existsByUsernameIgnoreCase(candidate);
        return ResponseEntity.ok(Map.of(
                "username", candidate,
                "available", available,
                "wellFormed", wellFormed));
    }

    /**
     * Starts a password-reset flow. Always returns 200 regardless of whether the email
     * is registered — this deliberately avoids leaking which addresses have accounts.
     *
     * <p><strong>HTTP:</strong> {@code POST /api/v1/auth/forgot-password}</p>
     * <p><strong>Body:</strong> {@code {"email": "..."}}</p>
     */
    @PostMapping("/forgot-password")
    public ResponseEntity<?> forgotPassword(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        if (email != null) {
            userRepository.findByEmail(email).ifPresent(user -> {
                try {
                    authTokenRepository.deleteByUserIdAndPurpose(user.getId(), AuthToken.Purpose.RESET_PASSWORD);
                    String token = UUID.randomUUID().toString();
                    authTokenRepository.save(AuthToken.builder()
                            .userId(user.getId())
                            .token(token)
                            .purpose(AuthToken.Purpose.RESET_PASSWORD)
                            .expiryDate(Instant.now().plusSeconds(3600)) // 1 hour — shorter-lived than email verification
                            .build());
                    String resetLink = frontendUrl + "/reset-password?token=" + token;
                    emailService.send(user.getEmail(), "Reset your HustleSpace password",
                            "<p>Someone requested a password reset for your HustleSpace account.</p>"
                                    + "<p><a href=\"" + resetLink + "\">Reset your password</a> (expires in 1 hour).</p>"
                                    + "<p>If this wasn't you, you can safely ignore this email.</p>");
                } catch (Exception e) {
                    log.warn("Could not start password reset for {}: {}", email, e.getMessage());
                }
            });
        }
        return ResponseEntity.ok(Map.of("message", "If that email is registered, a reset link has been sent"));
    }

    /**
     * Completes a password reset started by {@link #forgotPassword}.
     *
     * <p><strong>HTTP:</strong> {@code POST /api/v1/auth/reset-password}</p>
     * <p><strong>Body:</strong> {@code {"token": "...", "newPassword": "..."}}</p>
     */
    @PostMapping("/reset-password")
    public ResponseEntity<?> resetPassword(@RequestBody Map<String, String> body) {
        String token = body.get("token");
        String newPassword = body.get("newPassword");
        if (token == null || newPassword == null || newPassword.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "token and newPassword are required"));
        }
        if (!PASSWORD_POLICY.matcher(newPassword).matches()) {
            return ResponseEntity.badRequest().body(Map.of("error", PASSWORD_POLICY_MESSAGE));
        }

        AuthToken authToken = authTokenRepository.findByTokenAndPurpose(token, AuthToken.Purpose.RESET_PASSWORD)
                .orElse(null);
        if (authToken == null || authToken.getExpiryDate().isBefore(Instant.now())) {
            return ResponseEntity.badRequest().body(Map.of("error", "This reset link is invalid or has expired"));
        }

        User user = userRepository.findById(authToken.getUserId())
                .orElseThrow(() -> new RuntimeException("User not found"));
        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);
        authTokenRepository.delete(authToken); // single-use

        // A password reset should also kill any existing sessions — force re-login everywhere.
        refreshTokenRepository.deleteByUserId(user.getId());

        return ResponseEntity.ok(Map.of("message", "Password updated — please log in again"));
    }

    // =========================================================================
    // Private helpers
    // =========================================================================

    /**
     * Creates a single-use verification token and emails the confirmation link.
     * Called from {@link #register}; failures are caught by the caller so a broken
     * email provider never blocks account creation.
     */
    /**
     * Builds a free handle from an email local-part, for clients that don't collect one.
     *
     * <p>Strips anything outside the allowed character set, pads a too-short result, and
     * appends a counter until it is unique — so two people called "jo@..." get jo and jo2
     * rather than the second signup failing on a constraint they never saw.
     */
    private String deriveUsername(String email) {
        String base = email.split("@")[0].replaceAll("[^A-Za-z0-9._]", "").replaceAll("^[._]+|[._]+$", "");
        if (base.length() < 3) base = "user" + base;
        if (base.length() > 16) base = base.substring(0, 16);

        String candidate = base;
        for (int n = 2; userRepository.existsByUsernameIgnoreCase(candidate); n++) {
            candidate = base + n;
            if (n > 9999) { // pathological; fall back to something guaranteed unique
                candidate = base + UUID.randomUUID().toString().substring(0, 6);
                break;
            }
        }
        return candidate;
    }

    private void sendVerificationEmail(User user) {
        String code = issueVerificationCode(user);
        emailService.send(user.getEmail(), "Your HustleSpace verification code",
                "<p>Welcome to HustleSpace! Enter this code to confirm your email:</p>"
                        + "<p style=\"font-size:28px;font-weight:bold;letter-spacing:6px;margin:16px 0\">"
                        + code + "</p>"
                        + "<p>The code expires in " + (VERIFY_CODE_TTL_SECONDS / 60) + " minutes. "
                        + "If you didn't create a HustleSpace account, you can ignore this email.</p>");
    }

    /**
     * Replaces any outstanding verification code for this user with a fresh one.
     *
     * <p>Codes are six digits so they can be read off a phone and typed, which means the
     * space is small enough that two users can hold the same code at once — and the token
     * column is UNIQUE. Rather than let that surface as a 500 during registration, a
     * collision is retried with a new code. {@link SecureRandom} rather than
     * {@code Math.random}: this is a credential, and a predictable one would let an attacker
     * confirm somebody else's address.
     *
     * <p>Only one code is live per user, so requesting a new one silently invalidates the old.
     *
     * @return the plain code, for embedding in the email
     */
    private String issueVerificationCode(User user) {
        authTokenRepository.deleteByUserIdAndPurpose(user.getId(), AuthToken.Purpose.VERIFY_EMAIL);

        for (int attempt = 0; attempt < 5; attempt++) {
            String code = String.format("%06d", SECURE_RANDOM.nextInt(1_000_000));
            try {
                authTokenRepository.saveAndFlush(AuthToken.builder()
                        .userId(user.getId())
                        .token(code)
                        .purpose(AuthToken.Purpose.VERIFY_EMAIL)
                        .expiryDate(Instant.now().plusSeconds(VERIFY_CODE_TTL_SECONDS))
                        .build());
                return code;
            } catch (org.springframework.dao.DataIntegrityViolationException e) {
                // Another user currently holds this code — draw again.
                log.debug("Verification code collision, retrying (attempt {})", attempt + 1);
            }
        }
        throw new IllegalStateException("Could not allocate a verification code");
    }

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
                .expiryDate(Instant.now().plusMillis(REFRESH_TOKEN_TTL_MS))
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
