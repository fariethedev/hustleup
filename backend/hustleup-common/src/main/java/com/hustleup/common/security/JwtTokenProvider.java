package com.hustleup.common.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

/**
 * Utility class responsible for creating, signing, and validating JSON Web Tokens (JWTs).
 *
 * <p><b>What is a JWT?</b><br>
 * A JSON Web Token is a compact, URL-safe string made up of three Base64-encoded parts
 * separated by dots: {@code header.payload.signature}
 * <ul>
 *   <li><b>Header</b> — algorithm metadata (e.g. {@code {"alg": "HS256"}})</li>
 *   <li><b>Payload</b> — claims: {@code sub} (subject/email), {@code iat} (issued-at),
 *       {@code exp} (expiry), and custom claims like {@code role}.</li>
 *   <li><b>Signature</b> — HMAC-SHA256 of (header + "." + payload) using the secret key.
 *       This prevents tampering — changing any claim invalidates the signature.</li>
 * </ul>
 *
 * <p><b>Why stateless auth with JWTs?</b><br>
 * In a microservices architecture, storing session state on each service would require a
 * shared session store (e.g. Redis) or sticky routing, both of which add operational
 * complexity. With JWTs, the token itself carries all the identity information needed —
 * each service independently validates the token with the shared secret. No inter-service
 * calls are required to authenticate a request.
 *
 * <p><b>Token lifetime strategy:</b><br>
 * <ul>
 *   <li><b>Access token</b> — short-lived (e.g. 15 minutes). Sent on every API request.
 *       If stolen, the attacker has only a brief window to misuse it.</li>
 *   <li><b>Refresh token</b> — long-lived (e.g. 7 days). Sent only to the
 *       {@code /auth/refresh} endpoint to obtain a new access token. Storing it in an
 *       HttpOnly cookie limits XSS exposure.</li>
 * </ul>
 *
 * <p><b>Library used:</b><br>
 * This class uses the {@code io.jsonwebtoken} (JJWT) library, which provides a fluent
 * builder API for constructing and parsing JWTs in Java. The {@code Keys.hmacShaKeyFor}
 * helper ensures the key meets the minimum size requirement for the chosen algorithm.
 *
 * <p><b>Why not {@code @Component}?</b><br>
 * This class is instantiated explicitly in {@link CommonSecurityConfig#jwtTokenProvider()}
 * so the secret and expiry values can be injected from configuration before the bean is
 * registered. The {@code @Component} stereotype is omitted to avoid Spring creating a
 * second, unconfigured instance.
 */
public class JwtTokenProvider {

    /**
     * The cryptographic key used to sign and verify JWT signatures.
     *
     * <p>Derived from the {@code app.jwt.secret} configuration property at construction
     * time using {@code Keys.hmacShaKeyFor()}. The key is stored as a {@link SecretKey}
     * object (rather than the raw string) to prevent accidental logging and to ensure the
     * JJWT library can enforce minimum key-length requirements for the HS256 algorithm.
     */
    private final SecretKey key;

    /**
     * How many milliseconds an access token remains valid after issuance.
     *
     * <p>Injected from {@code app.jwt.access-token-expiration-ms}. A typical value is
     * 900,000 (15 minutes). Short-lived access tokens limit the damage if one is stolen.
     */
    private final long accessTokenExpirationMs;

    /**
     * How many milliseconds a refresh token remains valid after issuance.
     *
     * <p>Injected from {@code app.jwt.refresh-token-expiration-ms}. A typical value is
     * 604,800,000 (7 days). Refresh tokens must be stored securely by the client (e.g.
     * in an HttpOnly cookie) because they last much longer than access tokens.
     */
    private final long refreshTokenExpirationMs;

    /**
     * Constructs the provider, derives the signing key, and stores expiration settings.
     *
     * <p>Called by {@link CommonSecurityConfig#jwtTokenProvider()} with values read from
     * {@code application.properties} / environment variables at application startup.
     *
     * <p>{@code Keys.hmacShaKeyFor(secret.getBytes(UTF_8))} converts the raw secret
     * string into a {@link SecretKey} suitable for HMAC-SHA algorithms. The secret must
     * be at least 32 characters (256 bits) for HS256; shorter secrets will cause JJWT to
     * throw a {@code WeakKeyException} at startup, failing fast rather than silently
     * running insecurely.
     *
     * @param secret                   the raw JWT signing secret from configuration
     * @param accessTokenExpirationMs  access token lifetime in milliseconds
     * @param refreshTokenExpirationMs refresh token lifetime in milliseconds
     */
    public JwtTokenProvider(
            @Value("${app.jwt.secret}") String secret,
            @Value("${app.jwt.access-token-expiration-ms}") long accessTokenExpirationMs,
            @Value("${app.jwt.refresh-token-expiration-ms}") long refreshTokenExpirationMs) {
        // Convert the human-readable secret string to a cryptographic key object
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.accessTokenExpirationMs = accessTokenExpirationMs;
        this.refreshTokenExpirationMs = refreshTokenExpirationMs;
    }

    /**
     * Generates a short-lived access token from a Spring Security {@link Authentication}.
     *
     * <p>This overload is typically called immediately after a successful login. The
     * {@link Authentication} object (produced by Spring's {@code AuthenticationManager})
     * carries the authenticated principal and their granted authorities.
     *
     * <p>The first authority in the list (e.g. {@code ROLE_SELLER}) is used as the role
     * claim after stripping the {@code ROLE_} prefix so the token stores "SELLER" rather
     * than "ROLE_SELLER". This keeps the JWT compact and consistent with how the role is
     * read back in {@link CommonJwtFilter}.
     *
     * @param authentication the authenticated principal from Spring Security
     * @return a signed JWT access token string
     */
    public String generateAccessToken(Authentication authentication) {
        UserDetails userDetails = (UserDetails) authentication.getPrincipal();
        // Extract role from granted authorities — strip ROLE_ prefix to store clean role name
        String role = authentication.getAuthorities().stream()
                .findFirst()
                .map(a -> a.getAuthority().replace("ROLE_", ""))
                .orElse("BUYER"); // Default to BUYER if no role authority is present
        return buildToken(userDetails.getUsername(), role, accessTokenExpirationMs);
    }

    /**
     * Generates a short-lived access token for the given email, without a role claim.
     *
     * <p>Used in contexts where we know the email (e.g. token refresh flow) but do not
     * have the full Spring Security authority list available. The role claim is omitted
     * from this token variant.
     *
     * @param email the user's email address to embed as the token subject
     * @return a signed JWT access token string
     */
    public String generateAccessToken(String email) {
        return buildToken(email, null, accessTokenExpirationMs);
    }

    /**
     * Generates a short-lived access token for the given email and explicit role.
     *
     * <p>Used when the caller already knows the user's role (e.g. fetched from the
     * database) and wants to embed it in the token without going through the full Spring
     * Security authentication flow.
     *
     * @param email the user's email address (JWT subject claim)
     * @param role  the user's role string (e.g. "SELLER") — stored as the {@code role} claim
     * @return a signed JWT access token string
     */
    public String generateAccessToken(String email, String role) {
        return buildToken(email, role, accessTokenExpirationMs);
    }

    /**
     * Generates a long-lived refresh token for the given email.
     *
     * <p>Refresh tokens intentionally contain only the minimum necessary claims (subject
     * and expiry) — no role is embedded. They are used solely to prove the user is still
     * legitimately authenticated and to receive a fresh access token; they must NOT be
     * accepted by regular API endpoints.
     *
     * @param email the user's email address to embed as the token subject
     * @return a signed JWT refresh token string with a longer expiry than an access token
     */
    public String generateRefreshToken(String email) {
        return buildToken(email, null, refreshTokenExpirationMs);
    }

    /**
     * Internal helper that constructs, signs, and serialises a JWT.
     *
     * <p>All public {@code generate*} methods delegate here. The builder pattern from
     * JJWT is used:
     * <ol>
     *   <li>{@code .subject(subject)} — the "sub" claim; identifies the token owner
     *       (email address in our case).</li>
     *   <li>{@code .issuedAt(now)} — the "iat" claim; records when the token was created.
     *       Useful for auditing.</li>
     *   <li>{@code .expiration(now + expirationMs)} — the "exp" claim; the token is
     *       invalid after this timestamp. JJWT automatically rejects expired tokens
     *       during {@link #validateToken}.</li>
     *   <li>{@code .claim("role", role)} — custom claim storing the user's role string.
     *       Only added when a role is provided; omitting it for refresh tokens keeps them
     *       minimally scoped.</li>
     *   <li>{@code .signWith(key)} — HMAC-SHA256 signs the header+payload using the
     *       secret key. The signature is appended as the third segment of the JWT.</li>
     *   <li>{@code .compact()} — serialises the JWT to its dot-separated string form.</li>
     * </ol>
     *
     * @param subject      the JWT subject claim (user email)
     * @param role         optional role to embed as a custom claim; {@code null} omits it
     * @param expirationMs token lifetime in milliseconds from now
     * @return the serialised, signed JWT string
     */
    private String buildToken(String subject, String role, long expirationMs) {
        Date now = new Date();
        var builder = Jwts.builder()
                .subject(subject)                                    // "sub" claim — who the token belongs to
                .issuedAt(now)                                       // "iat" claim — when it was issued
                .expiration(new Date(now.getTime() + expirationMs)); // "exp" claim — when it expires
        if (role != null && !role.isBlank()) {
            builder.claim("role", role); // Custom claim — the user's platform role
        }
        return builder.signWith(key).compact(); // Sign with HMAC-SHA256 and serialise to string
    }

    /**
     * Extracts the user's email address from a validated JWT.
     *
     * <p>The email is stored in the JWT's {@code sub} (subject) standard claim.
     * {@code parseSignedClaims(token)} both validates the signature and parses the
     * payload — if the token is invalid, an exception is thrown (callers should ensure
     * the token has been validated first, or catch exceptions).
     *
     * @param token the raw JWT string
     * @return the email address embedded in the token's subject claim
     */
    public String getEmailFromToken(String token) {
        return Jwts.parser()
                .verifyWith(key)  // Use our signing key to verify the signature
                .build()
                .parseSignedClaims(token)
                .getPayload()
                .getSubject();    // Returns the "sub" claim — the user's email
    }

    /**
     * Extracts the role claim from a JWT, or returns {@code null} if absent.
     *
     * <p>The {@code role} claim is a custom (non-standard) claim added by
     * {@link #buildToken} when a role is available. Refresh tokens deliberately omit it,
     * so this method can return {@code null} for them — callers must handle that case.
     *
     * <p>The {@code try/catch} here is defensive: if something goes wrong parsing the
     * claim (e.g. unexpected type), we return {@code null} rather than crashing.
     *
     * @param token the raw JWT string
     * @return the role string (e.g. "SELLER"), or {@code null} if the claim is absent
     */
    public String getRoleFromToken(String token) {
        try {
            Object role = Jwts.parser()
                    .verifyWith(key)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload()
                    .get("role"); // Retrieve our custom "role" claim from the payload
            return role != null ? role.toString() : null;
        } catch (Exception e) {
            return null; // If anything goes wrong, treat the role as absent
        }
    }

    /**
     * Validates a JWT token — checks signature integrity and expiry.
     *
     * <p>JJWT's {@code parseSignedClaims()} performs the following checks automatically:
     * <ol>
     *   <li><b>Signature</b> — recomputes the HMAC-SHA256 and compares to the token's
     *       signature segment. A mismatch means the token was tampered with.</li>
     *   <li><b>Expiry</b> — compares the {@code exp} claim to the current time. An
     *       expired token causes a {@link ExpiredJwtException}.</li>
     *   <li><b>Format</b> — rejects malformed or empty strings with
     *       {@link MalformedJwtException} or {@link IllegalArgumentException}.</li>
     * </ol>
     *
     * <p>All of these failure modes are caught and mapped to {@code false} so the caller
     * receives a simple boolean answer rather than needing to handle multiple exception
     * types.
     *
     * @param token the raw JWT string to validate
     * @return {@code true} if the token is well-formed, correctly signed, and not expired;
     *         {@code false} otherwise
     */
    public boolean validateToken(String token) {
        try {
            // parseSignedClaims() throws an exception for any validation failure —
            // if it returns without throwing, the token is valid.
            Jwts.parser().verifyWith(key).build().parseSignedClaims(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            // Covers: ExpiredJwtException, UnsupportedJwtException, MalformedJwtException,
            // SignatureException, and blank/null token strings.
            return false;
        }
    }
}
