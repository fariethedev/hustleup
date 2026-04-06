package com.hustleup.common.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.config.annotation.web.configuration.WebSecurityCustomizer;
import org.springframework.security.web.util.matcher.AntPathRequestMatcher;

/**
 * Central Spring Security configuration shared across all HustleUp microservices.
 *
 * <p><b>Why this class exists:</b><br>
 * Each microservice needs to protect its HTTP endpoints consistently — the same JWT
 * secret, the same public paths, and the same filter chain. By placing this config in
 * {@code hustleup-common}, every service that depends on the common module automatically
 * inherits a battle-tested, coherent security setup without copy-pasting.
 *
 * <p><b>Spring Security concepts at play:</b><br>
 * <ol>
 *   <li><b>Filter Chain</b> — Spring Security works as a chain of Servlet filters. Each
 *       incoming HTTP request passes through the chain in order. Our custom
 *       {@link CommonJwtFilter} is inserted near the front of this chain.</li>
 *   <li><b>Stateless sessions</b> — We use JWTs, so the server never stores session data.
 *       {@code SessionCreationPolicy.STATELESS} tells Spring not to create or use HTTP
 *       sessions, keeping the backend horizontally scalable.</li>
 *   <li><b>CSRF disabled</b> — CSRF protection is designed for cookie-based sessions.
 *       With JWT in the Authorization header there is no cross-site request forgery risk,
 *       so disabling CSRF simplifies the API.</li>
 *   <li><b>Method security</b> — {@code @EnableMethodSecurity} activates
 *       {@code @PreAuthorize} / {@code @Secured} annotations on controller or service
 *       methods, allowing fine-grained role checks beyond the URL-level rules below.</li>
 * </ol>
 *
 * <p><b>Security flow end-to-end:</b><br>
 * <pre>
 *  Client request
 *      │
 *      ▼
 *  CommonJwtFilter.doFilterInternal()
 *      │  ① Extract "Bearer <token>" from Authorization header
 *      │  ② Call JwtTokenProvider.validateToken()
 *      │  ③ Extract email + role claims
 *      │  ④ Build UsernamePasswordAuthenticationToken and set in SecurityContext
 *      ▼
 *  SecurityFilterChain.authorizeHttpRequests()
 *      │  ⑤ Check whether the requested path is permitted or requires authentication
 *      ▼
 *  Controller method
 *      │  ⑥ (Optional) @PreAuthorize("hasRole('SELLER')") further restricts access
 *      ▼
 *  Response
 * </pre>
 *
 * <p><b>{@code @Order(1)}:</b><br>
 * If multiple {@code SecurityFilterChain} beans exist (e.g. per-service configs), the
 * {@code @Order(1)} annotation ensures this common chain is evaluated first, establishing
 * baseline rules before any service-specific overrides.
 */
@Configuration          // Tells Spring this class provides @Bean definitions
@EnableWebSecurity      // Activates Spring Security's web support and disables the default auto-config
@EnableMethodSecurity   // Enables @PreAuthorize / @PostAuthorize / @Secured on methods
@org.springframework.core.annotation.Order(1) // Highest priority if multiple SecurityFilterChain beans exist
public class CommonSecurityConfig {

    /**
     * The HMAC-SHA secret used to sign and verify JWT tokens.
     *
     * <p>Injected from the {@code app.jwt.secret} property in
     * {@code application.properties} / environment variables. Must be at least 256 bits
     * (32 bytes) for HS256. Never hard-code this value — it must be kept secret and
     * rotated if compromised.
     */
    @Value("${app.jwt.secret}")
    private String jwtSecret;

    /**
     * How long (in milliseconds) an access token remains valid after issuance.
     *
     * <p>Access tokens should be short-lived (e.g. 15 minutes = 900,000 ms) to minimise
     * the damage window if one is stolen. The client refreshes them using a long-lived
     * refresh token before they expire.
     */
    @Value("${app.jwt.access-token-expiration-ms}")
    private long accessTokenExpirationMs;

    /**
     * How long (in milliseconds) a refresh token remains valid.
     *
     * <p>Refresh tokens are long-lived (e.g. 7 days = 604,800,000 ms). They are only
     * sent to the {@code /api/v1/auth/refresh} endpoint, reducing their exposure surface
     * compared to access tokens which accompany every request.
     */
    @Value("${app.jwt.refresh-token-expiration-ms}")
    private long refreshTokenExpirationMs;

    /**
     * Registers a {@link JwtTokenProvider} bean with the application context.
     *
     * <p>The provider is constructed with the JWT secret and expiration times read from
     * configuration. It is used both here (to create {@link CommonJwtFilter}) and can be
     * injected anywhere in the service to generate or validate tokens.
     *
     * @return a configured {@link JwtTokenProvider} instance
     */
    @Bean
    public JwtTokenProvider jwtTokenProvider() {
        return new JwtTokenProvider(jwtSecret, accessTokenExpirationMs, refreshTokenExpirationMs);
    }

    /**
     * Excludes the static file-serving path from the security filter chain entirely.
     *
     * <p>{@code web.ignoring()} bypasses ALL Spring Security processing (including the
     * JWT filter) for the matched paths. This is appropriate for truly public static
     * assets like uploaded images that should be accessible without a login. It is more
     * efficient than {@code .permitAll()} because it skips filter execution completely.
     *
     * <p><b>Why {@code /uploads/**}?</b><br>
     * When running locally without S3, uploaded files (avatars, listing images) are
     * served from a local directory mapped to {@code /uploads/**}. These URLs are
     * embedded in public listing pages, so they must be accessible without authentication.
     *
     * @return a {@link WebSecurityCustomizer} that bypasses security for static uploads
     */
    @Bean
    public WebSecurityCustomizer webSecurityCustomizer() {
        return (web) -> web.ignoring().requestMatchers(
            new AntPathRequestMatcher("/uploads/**")
        );
    }

    /**
     * Registers a {@link CommonJwtFilter} bean, injecting the token provider.
     *
     * <p>Declaring this as a {@code @Bean} (rather than using {@code @Component} on the
     * filter class) gives us explicit control over construction and avoids the filter
     * being registered twice in some servlet container setups (Spring Boot auto-registers
     * {@code @Component} filters AND the security config adds them via
     * {@code addFilterBefore}, which would execute the filter twice per request).
     *
     * @param tokenProvider the JWT token provider used inside the filter for validation
     * @return a configured {@link CommonJwtFilter}
     */
    @Bean
    public CommonJwtFilter commonJwtFilter(JwtTokenProvider tokenProvider) {
        return new CommonJwtFilter(tokenProvider);
    }

    /**
     * Defines the HTTP security filter chain — the core of Spring Security configuration.
     *
     * <p><b>What each line does:</b>
     * <ul>
     *   <li>{@code cors().disable()} — CORS is handled by a separate
     *       {@code CorsConfigurationSource} bean (or disabled in development). Adjust
     *       for production by providing an explicit CORS config.</li>
     *   <li>{@code csrf().disable()} — safe because we use JWT in the Authorization header
     *       instead of cookies; CSRF attacks require cookie-based state.</li>
     *   <li>{@code sessionManagement(STATELESS)} — prevents Spring from creating
     *       {@code HttpSession} objects, ensuring the server stays stateless and
     *       horizontally scalable.</li>
     *   <li>{@code authorizeHttpRequests} — URL-level access rules evaluated in order:
     *     <ul>
     *       <li>{@code /uploads/**} → allowed (belt-and-suspenders alongside webSecurityCustomizer)</li>
     *       <li>{@code /api/v1/auth/**} and {@code /api/v1/public/**} → registration, login,
     *           token refresh — must be accessible without a token.</li>
     *       <li>GET on listings, reviews, users, feed, stories, dating, notifications,
     *           messages → public read access so guests can browse the marketplace.</li>
     *       <li>Everything else → requires a valid JWT (authenticated).</li>
     *     </ul>
     *   </li>
     *   <li>{@code addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)}
     *       — inserts our JWT filter before the built-in username/password filter so the
     *       {@code SecurityContext} is populated before any access decisions are made.</li>
     * </ul>
     *
     * @param http      the {@link HttpSecurity} builder provided by Spring
     * @param jwtFilter the JWT filter to insert into the chain
     * @return the built {@link SecurityFilterChain}
     * @throws Exception if the HttpSecurity configuration fails
     */
    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http, CommonJwtFilter jwtFilter) throws Exception {
        http
            // Disable CORS at the Spring Security level (handled elsewhere or in dev mode)
            .cors(cors -> cors.disable())
            // Disable CSRF — JWT in Authorization header makes CSRF attacks impossible
            .csrf(csrf -> csrf.disable())
            // Do not create or use server-side HTTP sessions — every request must carry its own JWT
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                // Uploaded static files are always public (images, etc.)
                .requestMatchers("/uploads/**").permitAll()
                // Auth endpoints (login, register, token refresh) must be publicly accessible
                .requestMatchers("/api/v1/auth/**", "/api/v1/public/**").permitAll()
                // Public read-only access to marketplace content — guests can browse without logging in
                .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/v1/listings/**", "/api/v1/reviews/**", "/api/v1/users/**", "/api/v1/users").permitAll()
                // Social features (feed, stories, dating) can be read by guests
                .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/v1/feed/**", "/api/v1/stories/**", "/api/v1/dating/**").permitAll()
                // Notifications and messages can be read without auth (auth check happens at data layer)
                .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/v1/notifications/**", "/api/v1/direct-messages/**", "/api/v1/messages/**").permitAll()
                // All other requests (POST, PUT, DELETE, authenticated GETs) require a valid JWT
                .anyRequest().authenticated()
            );

        // Insert our JWT filter before Spring's built-in username/password filter.
        // This ensures the SecurityContext is populated with the JWT identity before
        // any authorization checks run.
        http.addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);
        
        return http.build();
    }

    /**
     * Registers a {@link PasswordEncoder} bean using the BCrypt hashing algorithm.
     *
     * <p>BCrypt is the industry-standard algorithm for storing passwords because:
     * <ul>
     *   <li>It incorporates a random salt automatically, so identical passwords produce
     *       different hashes (prevents rainbow table attacks).</li>
     *   <li>Its work factor is configurable and intentionally slow, making brute-force
     *       attacks computationally expensive.</li>
     * </ul>
     *
     * <p>This bean is used by the auth service's registration endpoint to hash incoming
     * plain-text passwords before saving them, and during login to verify them.
     *
     * @return a {@code BCryptPasswordEncoder} with the default work factor (10 rounds)
     */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    /**
     * Exposes the {@link AuthenticationManager} as a Spring bean.
     *
     * <p>The {@code AuthenticationManager} is the entry point for programmatic
     * authentication — it is called by the auth service's login endpoint with a
     * {@code UsernamePasswordAuthenticationToken} to verify credentials. Spring's
     * {@link AuthenticationConfiguration} provides the default manager wired with the
     * configured {@code UserDetailsService} and {@code PasswordEncoder}.
     *
     * <p>Without this {@code @Bean} declaration, the manager would not be accessible for
     * injection into service classes that need to trigger authentication manually.
     *
     * @param config Spring's auto-configured {@link AuthenticationConfiguration}
     * @return the application's {@link AuthenticationManager}
     * @throws Exception if the manager cannot be built
     */
    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }
}
