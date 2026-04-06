package com.hustleup.auth.dto;

import jakarta.validation.constraints.*;
import lombok.*;

/**
 * AuthDtos — a container class that groups all Data Transfer Objects (DTOs) used
 * by the authentication endpoints.
 *
 * <h2>What is a DTO?</h2>
 * <p>A DTO is a simple object used to carry data between the client and the server.
 * DTOs are deliberately separate from domain entities ({@link com.hustleup.common.model.User})
 * for several important reasons:</p>
 * <ul>
 *   <li><strong>Security:</strong> DTOs prevent accidentally exposing sensitive entity fields
 *       (e.g., the hashed password) in API responses.</li>
 *   <li><strong>Validation:</strong> Input DTOs carry Bean Validation annotations so invalid
 *       payloads are rejected before the business logic ever runs.</li>
 *   <li><strong>Stability:</strong> The public API contract (DTO shape) can evolve independently
 *       of the internal data model (entity schema).</li>
 * </ul>
 *
 * <h2>Why a single outer class?</h2>
 * <p>Grouping related DTOs as static inner classes of a single outer class keeps the
 * package tidy. There is no need for four separate top-level files when all these DTOs
 * serve the same feature. Import is clean: {@code AuthDtos.LoginRequest}, etc.</p>
 *
 * <h2>Bean Validation (Jakarta Validation / JSR-380)</h2>
 * <p>Annotations like {@code @NotBlank}, {@code @Email}, and {@code @Size} are part of
 * the Jakarta Validation spec. When a controller parameter is annotated with {@code @Valid},
 * Spring automatically runs the validator against the object before the method body
 * executes. If any constraint fails, Spring returns HTTP 400 with a validation error
 * message — no custom validation code needed.</p>
 */
public class AuthDtos {

    // =========================================================================
    // Request DTOs (inbound — from client to server)
    // =========================================================================

    /**
     * RegisterRequest — the payload a client sends to create a new account.
     *
     * <p>Used by: {@code POST /api/v1/auth/register}</p>
     *
     * <p>All fields are validated by Bean Validation before the controller method body
     * runs. If validation fails, Spring returns HTTP 400 with the constraint messages
     * defined on each annotation.</p>
     */
    // @Getter / @Setter: Lombok generates getEmail(), setEmail(), etc. for all fields.
    // Without these, Jackson (the JSON library) cannot deserialise the JSON body because
    // it needs getter/setter access by default.
    @Getter @Setter

    // @NoArgsConstructor: generates a no-argument constructor.
    // Jackson needs this to instantiate the object before setting field values.
    @NoArgsConstructor

    // @AllArgsConstructor: generates a constructor with all fields.
    // Useful in tests: new RegisterRequest("a@b.com", "pass", "Alice", "123", "BUYER").
    @AllArgsConstructor
    public static class RegisterRequest {

        // @NotBlank ensures the string is not null AND not blank (not just whitespace).
        // The message value is returned to the client if the constraint fails.
        // @Email validates the format matches a syntactically valid email address.
        @NotBlank(message = "Email is required")
        @Email(message = "Invalid email format")
        private String email; // the user's email — doubles as their login username

        // @Size(min = 6) enforces a minimum password length.
        // This is a basic security requirement; in production you'd also enforce complexity.
        @NotBlank(message = "Password is required")
        @Size(min = 6, message = "Password must be at least 6 characters")
        private String password; // plain-text password from the client; will be BCrypt-hashed before storage

        @NotBlank(message = "Full name is required")
        private String fullName; // display name shown across the platform

        // Phone is optional (no @NotBlank) — users may not want to provide it.
        private String phone; // optional contact phone number

        // @Pattern restricts the value to a specific regex. This ensures the client
        // cannot create an account with an unsupported role (e.g., "ADMIN").
        @NotBlank(message = "Role is required")
        @Pattern(regexp = "BUYER|SELLER", message = "Role must be BUYER or SELLER")
        private String role; // account type: "BUYER" or "SELLER" — stored as enum in the DB
    }

    /**
     * LoginRequest — the payload for authenticating with email + password.
     *
     * <p>Used by: {@code POST /api/v1/auth/login}</p>
     */
    @Getter @Setter @NoArgsConstructor @AllArgsConstructor
    public static class LoginRequest {

        // Both fields are required. @Email provides a basic format check before we
        // even hit the database, saving a round-trip for obviously malformed inputs.
        @NotBlank(message = "Email is required")
        @Email
        private String email; // the registered email address

        @NotBlank(message = "Password is required")
        private String password; // plain-text password to compare against the stored BCrypt hash
    }

    /**
     * RefreshRequest — the payload sent when the client wants to exchange a
     * refresh token for a new access token.
     *
     * <p>Used by: {@code POST /api/v1/auth/refresh}</p>
     *
     * <p>Keeping this as a dedicated DTO (rather than a raw {@code String} parameter)
     * is a deliberate design choice: it keeps the API contract consistent (all endpoints
     * accept JSON bodies) and makes it easy to add fields later (e.g., a device ID).</p>
     */
    @Getter @Setter @NoArgsConstructor @AllArgsConstructor
    public static class RefreshRequest {

        // The refresh token string previously issued by /register or /login.
        // @NotBlank prevents an empty body from reaching the controller logic.
        @NotBlank
        private String refreshToken; // opaque token string persisted in the refresh_tokens table
    }

    // =========================================================================
    // Response DTOs (outbound — from server to client)
    // =========================================================================

    /**
     * AuthResponse — the payload returned after a successful register, login, or token refresh.
     *
     * <p>The client stores {@code accessToken} in memory and uses it in the
     * {@code Authorization: Bearer <token>} header for every subsequent API request.
     * The {@code refreshToken} is stored in secure persistent storage (HttpOnly cookie or
     * encrypted app storage) and used only to obtain new access tokens.</p>
     */
    // @Builder generates a fluent builder API so callers can write:
    //   AuthResponse.builder().accessToken("...").role("BUYER").build()
    // This is much more readable than a positional constructor call with 7 arguments.
    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    public static class AuthResponse {

        // The short-lived JWT used to authenticate API requests.
        // Typically valid for 15 minutes to 1 hour.
        private String accessToken;

        // The long-lived token used to obtain new access tokens without re-logging in.
        // Valid for 7 days (604_800_000 ms as set in AuthController).
        private String refreshToken;

        // Always "Bearer" — this is the OAuth 2.0 standard token type.
        // The client prepends this to form the Authorization header value: "Bearer <accessToken>".
        private String tokenType;

        // The user's role ("BUYER" or "SELLER") so the client can immediately apply
        // role-based UI routing without an extra /me call.
        private String role;

        // The user's display name — shown immediately after login without a separate profile fetch.
        private String fullName;

        // The user's UUID as a string. Clients need this to construct profile URLs,
        // make user-specific API calls, etc.
        private String userId;

        // The avatar image URL — allows the client to display the user's picture
        // in the navbar immediately after login.
        private String avatarUrl;
    }
}
