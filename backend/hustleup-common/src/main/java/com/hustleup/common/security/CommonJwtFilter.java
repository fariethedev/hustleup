package com.hustleup.common.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;

/**
 * Servlet filter that validates a JWT Bearer token on every incoming HTTP request.
 *
 * <p><b>What this filter does:</b><br>
 * For each HTTP request it:
 * <ol>
 *   <li>Looks for an {@code Authorization: Bearer <token>} header.</li>
 *   <li>If found, validates the token cryptographically via {@link JwtTokenProvider}.</li>
 *   <li>Extracts the user's email and role from the token claims.</li>
 *   <li>Builds a Spring Security {@link UsernamePasswordAuthenticationToken} and stores
 *       it in the {@link SecurityContextHolder}, so that downstream code (controllers,
 *       {@code @PreAuthorize} annotations) knows who is making the request.</li>
 *   <li>Always calls {@code filterChain.doFilter()} regardless of outcome — a missing or
 *       invalid token simply leaves the SecurityContext empty, and the authorization rules
 *       in {@link CommonSecurityConfig} decide whether to reject the request.</li>
 * </ol>
 *
 * <p><b>Why extend {@link OncePerRequestFilter}?</b><br>
 * Spring's filter chain can invoke filters multiple times in certain scenarios (e.g.
 * during request forwarding). {@code OncePerRequestFilter} guarantees our JWT validation
 * logic runs exactly once per HTTP request, preventing duplicate authentication attempts.
 *
 * <p><b>Why not reject inside the filter?</b><br>
 * Rejecting invalid tokens inside the filter would make it harder to have public
 * endpoints. Instead, we let the {@link SecurityContextHolder} remain empty for invalid
 * tokens — the authorization layer in the filter chain then rejects requests to
 * protected endpoints with a 401/403 response. Public endpoints proceed normally.
 *
 * <p><b>Security flow for this filter:</b><br>
 * <pre>
 *  Request arrives
 *      ↓
 *  extractToken() — reads "Authorization" header, strips "Bearer " prefix
 *      ↓ token present?
 *     YES → tokenProvider.validateToken() — cryptographic signature check + expiry
 *          → getEmailFromToken()  — reads "sub" claim
 *          → getRoleFromToken()   — reads "role" claim
 *          → build UsernamePasswordAuthenticationToken with authorities
 *          → SecurityContextHolder.getContext().setAuthentication(auth)
 *     NO  → SecurityContext stays unauthenticated
 *      ↓
 *  filterChain.doFilter() — passes request to the next filter / servlet
 * </pre>
 *
 * <p><b>Logging:</b><br>
 * Uses SLF4J via Lombok's {@code @Slf4j} for structured logging. Successful validations
 * are logged at DEBUG (verbose, only useful during development). Validation failures are
 * WARN (worth alerting on in production). Unexpected exceptions are ERROR.
 */
@Slf4j // Lombok: injects a static 'log' field backed by SLF4J — use log.debug(), log.warn(), etc.
public class CommonJwtFilter extends OncePerRequestFilter {

    /**
     * The JWT token provider used to validate tokens and extract claims.
     *
     * <p>Injected via constructor — constructor injection is preferred over field
     * injection because it makes dependencies explicit and allows the class to be
     * instantiated in unit tests without a Spring context.
     */
    private final JwtTokenProvider tokenProvider;

    /**
     * Constructs the filter with an explicit token provider dependency.
     *
     * <p>This constructor is called by the {@code @Bean} factory method in
     * {@link CommonSecurityConfig#commonJwtFilter(JwtTokenProvider)}, which supplies
     * the Spring-managed {@link JwtTokenProvider} bean. No {@code @Autowired} annotation
     * is needed because Spring automatically uses a single-constructor class for
     * injection.
     *
     * @param tokenProvider the JWT validation and claims-extraction utility
     */
    public CommonJwtFilter(JwtTokenProvider tokenProvider) {
        this.tokenProvider = tokenProvider;
    }

    /**
     * Core filter logic — called once per request by the Spring Security filter chain.
     *
     * <p>This method implements the authentication flow described in the class Javadoc.
     * Key design decisions:
     * <ul>
     *   <li>The {@code try/catch} around token validation prevents a malformed or expired
     *       token from crashing the entire request — the exception is logged and the
     *       request continues unauthenticated.</li>
     *   <li>{@code filterChain.doFilter(request, response)} is called unconditionally in
     *       the {@code finally}-equivalent block so the filter chain always continues,
     *       even when authentication fails. Actual request rejection is left to the
     *       authorization rules configured in {@link CommonSecurityConfig}.</li>
     *   <li>Both {@code ROLE_USER} and the specific role (e.g. {@code ROLE_SELLER}) are
     *       added to the authority list. {@code ROLE_USER} acts as a universal "logged-in"
     *       authority that generic {@code @PreAuthorize("isAuthenticated()")} checks
     *       will accept.</li>
     * </ul>
     *
     * @param request     the incoming HTTP request
     * @param response    the outgoing HTTP response
     * @param filterChain the remaining filter chain to continue processing
     * @throws ServletException if a downstream filter or servlet throws a ServletException
     * @throws IOException      if an I/O error occurs during request/response processing
     */
    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        // Extract the raw JWT string from the Authorization header (strips "Bearer " prefix)
        String token = extractToken(request);

        // Keep the request path for contextual logging — helps identify which endpoint triggered an issue
        String requestPath = request.getRequestURI();

        if (StringUtils.hasText(token)) {
            try {
                if (tokenProvider.validateToken(token)) {
                    // Token signature is valid and it has not expired — extract claims
                    String email = tokenProvider.getEmailFromToken(token);
                    String role  = tokenProvider.getRoleFromToken(token);

                    // Build the authority list for Spring Security.
                    // ROLE_USER = generic "logged in" authority used by isAuthenticated() checks.
                    // ROLE_<role> = specific role (ROLE_SELLER, ROLE_BUYER, ROLE_ADMIN) for
                    // fine-grained @PreAuthorize checks on individual endpoints.
                    java.util.List<SimpleGrantedAuthority> authorities = new java.util.ArrayList<>();
                    authorities.add(new SimpleGrantedAuthority("ROLE_USER"));
                    if (role != null && !role.isBlank()) {
                        // Convert "SELLER" → "ROLE_SELLER" to match Spring Security naming convention
                        authorities.add(new SimpleGrantedAuthority("ROLE_" + role.toUpperCase()));
                    }

                    log.debug("JWT validated for user: {} role: {} on path: {}", email, role, requestPath);

                    // Create the authentication token that Spring Security recognises.
                    // Principal = email string (accessible later via SecurityContextHolder.getContext()
                    //             .getAuthentication().getPrincipal() in controllers).
                    // Credentials = null (we do not store the raw password or token in the context).
                    // Authorities = the granted roles computed above.
                    UsernamePasswordAuthenticationToken auth =
                            new UsernamePasswordAuthenticationToken(email, null, authorities);

                    // Attach request metadata (IP address, session ID) to the auth token —
                    // useful for audit logging and security event tracking.
                    auth.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));

                    // Store the authentication in the thread-local SecurityContext.
                    // From this point onward, any code in this request's thread can call
                    // SecurityContextHolder.getContext().getAuthentication() to get the user.
                    SecurityContextHolder.getContext().setAuthentication(auth);
                } else {
                    // Token present but failed validation (expired, wrong signature, etc.)
                    log.warn("JWT validation failed for token on path: {}", requestPath);
                }
            } catch (Exception e) {
                // Unexpected error during token processing — log but do not crash the request
                log.error("JWT Filter error: {} for path: {}", e.getMessage(), requestPath, e);
            }
        } else if (log.isDebugEnabled()) {
            // No Authorization header present — normal for public endpoints, worth logging at debug
            log.debug("No JWT token found in request for path: {}", requestPath);
        }

        // Always continue the filter chain regardless of authentication outcome.
        // The SecurityContext is either populated (authenticated) or empty (anonymous).
        // The authorization rules in CommonSecurityConfig decide what happens next.
        filterChain.doFilter(request, response);
    }

    /**
     * Extracts the raw JWT string from the {@code Authorization} HTTP header.
     *
     * <p>The HTTP standard for bearer token authentication (RFC 6750) requires the header
     * to look like: {@code Authorization: Bearer eyJhbGci...}
     *
     * <p>This method:
     * <ol>
     *   <li>Reads the {@code Authorization} header value.</li>
     *   <li>Checks it is non-blank and starts with {@code "Bearer "} (7 characters).</li>
     *   <li>Returns the substring after {@code "Bearer "} — i.e., the raw JWT.</li>
     * </ol>
     *
     * <p>Returns {@code null} when no bearer token is present (missing header, wrong
     * prefix, or empty string), signalling to {@link #doFilterInternal} that this is an
     * anonymous request.
     *
     * @param request the incoming HTTP request
     * @return the raw JWT string, or {@code null} if no bearer token is present
     */
    private String extractToken(HttpServletRequest request) {
        String bearerToken = request.getHeader("Authorization");
        // Only process the header if it's non-empty and follows the "Bearer " convention
        if (StringUtils.hasText(bearerToken) && bearerToken.startsWith("Bearer ")) {
            // Substring(7) skips the literal "Bearer " prefix (6 chars + 1 space)
            return bearerToken.substring(7);
        }
        return null; // Indicate that no bearer token was found
    }
}
