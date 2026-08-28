package com.hustleup.common.exception;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.HashMap;
import java.util.Map;

/**
 * Global exception handler that translates uncaught exceptions into structured JSON
 * HTTP error responses.
 *
 * <p><b>Why this class exists:</b><br>
 * Without a global handler, any exception that bubbles up from a controller would be
 * caught by Spring's default error mechanism and returned as an HTML error page or a
 * Spring Boot default JSON structure (with fields like {@code timestamp}, {@code path},
 * {@code trace}, etc.) that can inadvertently leak internal details. This class intercepts
 * specific exception types and returns clean, predictable JSON error bodies like:
 * <pre>{"error": "Invalid email or password"}</pre>
 *
 * <p><b>How {@code @RestControllerAdvice} works:</b><br>
 * {@code @RestControllerAdvice} is a specialised form of {@code @ControllerAdvice} that
 * applies to all {@code @RestController} beans in the application context. It combines
 * {@code @ControllerAdvice} (intercepts exceptions from all controllers) with
 * {@code @ResponseBody} (auto-serialises return values to JSON). Each {@code @ExceptionHandler}
 * method declares which exception type(s) it handles.
 *
 * <p><b>Handler priority:</b><br>
 * Spring picks the most specific handler for a thrown exception. If a
 * {@code BadCredentialsException} is thrown, the {@code handleBadCredentials} handler is
 * preferred over the more general {@code handleAuthenticationException} handler (because
 * {@code BadCredentialsException} extends {@code AuthenticationException}).
 *
 * <p><b>Architecture note:</b><br>
 * Defined in {@code hustleup-common} so that every microservice using this module gets
 * consistent error response formats without duplicating handler code. Individual services
 * can still define their own additional handlers for domain-specific exceptions.
 */
@RestControllerAdvice // Applies to all @RestController beans; auto-serialises responses to JSON
public class GlobalExceptionHandler {

    /**
     * SLF4J logger for recording unexpected errors.
     *
     * <p>We use SLF4J (Simple Logging Facade for Java) so the actual logging
     * implementation (Logback, Log4j2, etc.) can be swapped without changing code.
     * The {@code getLogger(GlobalExceptionHandler.class)} call ties log messages to
     * this class for easy filtering in log aggregation tools.
     */
    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    /**
     * Handles {@link AccessDeniedException} — thrown when an authenticated user attempts
     * an action their role does not permit.
     *
     * <p><b>Typical cause:</b><br>
     * A BUYER tries to access a SELLER-only endpoint, or a regular user tries to hit an
     * admin endpoint protected by {@code @PreAuthorize("hasRole('ADMIN')")}. Spring
     * Security throws {@code AccessDeniedException} after the authentication filter has
     * already confirmed the user's identity but the authorization check fails.
     *
     * <p><b>HTTP status 403 Forbidden:</b><br>
     * 403 means "I know who you are, but you are not allowed to do this" — distinct from
     * 401 Unauthorized ("I don't know who you are").
     *
     * @param ex the access denied exception (message often contains "Access is denied")
     * @return a 403 response with a generic user-friendly message (avoids leaking role info)
     */
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, String>> handleAccessDenied(AccessDeniedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Map.of("error", "Access denied: insufficient permissions"));
    }

    /**
     * Handles {@link BadCredentialsException} — thrown when a login attempt fails due to
     * a wrong password.
     *
     * <p><b>Typical cause:</b><br>
     * The auth service calls {@code AuthenticationManager.authenticate()} with the
     * submitted credentials; if the password does not match the stored BCrypt hash,
     * Spring Security throws {@code BadCredentialsException}.
     *
     * <p><b>HTTP status 401 Unauthorized:</b><br>
     * The generic message "Invalid email or password" is intentional — revealing whether
     * the email exists (vs. just the password being wrong) would assist account
     * enumeration attacks.
     *
     * @param ex the bad credentials exception
     * @return a 401 response with a generic credential-failure message
     */
    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<Map<String, String>> handleBadCredentials(BadCredentialsException ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("error", "Invalid email or password"));
    }

    /**
     * Handles {@link UsernameNotFoundException} — thrown when a login is attempted with
     * an email that does not exist in the database.
     *
     * <p><b>Typical cause:</b><br>
     * Spring Security's {@code UserDetailsService.loadUserByUsername()} throws this when
     * {@link com.hustleup.common.repository.UserRepository#findByEmail} returns empty.
     *
     * <p><b>Why 401 instead of 404?</b><br>
     * Returning 404 Not Found for a missing user would confirm to an attacker that the
     * email address is not registered, enabling account enumeration. Using 401 Unauthorized
     * obscures this information.
     *
     * @param ex the username not found exception
     * @return a 401 response with a vague "User not found" message
     */
    @ExceptionHandler(UsernameNotFoundException.class)
    public ResponseEntity<Map<String, String>> handleUsernameNotFound(UsernameNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("error", "User not found"));
    }

    /**
     * Catch-all handler for any other {@link AuthenticationException} subclass.
     *
     * <p><b>Why it's needed:</b><br>
     * {@code AuthenticationException} is the base class for many Spring Security
     * auth failures (e.g. {@code AccountExpiredException}, {@code LockedException},
     * {@code DisabledException}). This handler provides a fallback so those cases also
     * return a clean 401 rather than a generic 500.
     *
     * <p><b>Handler resolution order:</b><br>
     * Spring will prefer the more specific handlers ({@code handleBadCredentials},
     * {@code handleUsernameNotFound}) when those exception types are thrown. This handler
     * only fires for {@code AuthenticationException} subclasses not covered by those.
     *
     * @param ex the authentication exception (may have a more specific cause message)
     * @return a 401 response including the exception's message for debugging context
     */
    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<Map<String, String>> handleAuthenticationException(AuthenticationException ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("error", "Authentication failed: " + ex.getMessage()));
    }

    /**
     * Handles {@link MethodArgumentNotValidException} — thrown when a request body fails
     * Bean Validation (JSR-380) constraints.
     *
     * <p><b>Typical cause:</b><br>
     * A controller method parameter annotated with {@code @Valid} or {@code @Validated}
     * receives a request body that violates constraints such as {@code @NotBlank},
     * {@code @Email}, {@code @Size}, etc. Spring automatically triggers validation and
     * throws this exception if any field constraint is violated.
     *
     * <p><b>Response format:</b><br>
     * Returns a 400 Bad Request with a nested {@code "validationErrors"} object mapping
     * each invalid field name to its constraint violation message, for example:
     * <pre>
     * {
     *   "validationErrors": {
     *     "email": "must be a well-formed email address",
     *     "password": "size must be between 8 and 100"
     *   }
     * }
     * </pre>
     * This lets the frontend highlight exactly which fields the user needs to fix.
     *
     * @param ex the validation exception containing all field-level errors
     * @return a 400 response with a map of field names to error messages
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Map<String, String>>> handleValidationExceptions(MethodArgumentNotValidException ex) {
        Map<String, String> errors = new HashMap<>();
        // getBindingResult() contains all validation errors collected during request binding
        ex.getBindingResult().getAllErrors().forEach((error) -> {
            // Cast to FieldError to get the specific field name that failed validation
            String fieldName = ((FieldError) error).getField();
            // getDefaultMessage() returns the constraint annotation's message attribute
            String errorMessage = error.getDefaultMessage();
            errors.put(fieldName, errorMessage);
        });
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Map.of("validationErrors", errors));
    }

    /**
     * Handles {@link IllegalArgumentException} — input the caller got wrong.
     *
     * <p><b>Typical cause:</b><br>
     * Rejected input validated in the service layer rather than by a Bean Validation
     * annotation — most notably
     * {@link com.hustleup.common.storage.FileStorageService#store}, which refuses uploads
     * whose type is not on its allowlist.
     *
     * <p><b>Why a dedicated handler?</b><br>
     * {@code IllegalArgumentException} extends {@code RuntimeException}, so without this it
     * would fall through to the handler below and surface as a 500. That is both wrong
     * (the server is fine; the request was not) and unhelpful — clients cannot distinguish
     * "your file type is not supported" from a genuine outage, and retrying makes it worse.
     * Logged at WARN, not ERROR: a rejected upload is expected traffic, not an incident.
     *
     * @param ex the rejected-input exception — its message is safe to return to the caller
     * @return a 400 response carrying the validation message
     */
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleIllegalArgument(IllegalArgumentException ex) {
        log.warn("Rejected invalid input: {}", ex.getMessage());
        String msg = ex.getMessage();
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Map.of("error", msg != null ? msg : "Invalid request"));
    }

    /**
     * Handles {@link org.springframework.web.server.ResponseStatusException} — the exception
     * a service throws when it already knows the exact HTTP status the caller deserves.
     *
     * <p><b>Why a dedicated handler?</b><br>
     * {@code ResponseStatusException} extends {@code RuntimeException}, so without this it
     * falls through to the broad handler below and every deliberate 400/403/404/409 is
     * flattened into a 500. That silently destroys the API contract: a client cannot tell
     * "you already made this offer" (retrying is pointless) from "the server broke"
     * (retrying is correct), and the message never reaches the user's screen.
     *
     * <p>Logged at WARN rather than ERROR — a rejected request is expected traffic, not an
     * incident, and paging on it would bury real failures.
     *
     * @param ex the exception carrying both the intended status and a caller-safe reason
     * @return a response using the status the thrower asked for
     */
    @ExceptionHandler(org.springframework.web.server.ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> handleResponseStatus(
            org.springframework.web.server.ResponseStatusException ex) {
        log.warn("Rejected request ({}): {}", ex.getStatusCode(), ex.getReason());
        String msg = ex.getReason() != null ? ex.getReason() : "Request rejected";
        // Both keys: "error" matches the other handlers here, "message" is what the
        // frontend's axios interceptor reads when surfacing a toast.
        return ResponseEntity.status(ex.getStatusCode())
                .body(Map.of("error", msg, "message", msg));
    }

    /**
     * Handles anything thrown by the persistence layer.
     *
     * <p><b>Why this is separate from {@link #handleRuntimeException}:</b><br>
     * {@code DataAccessException} is a {@code RuntimeException}, so without this handler a
     * database failure fell into the generic one below and its message was copied
     * verbatim into the response body. Spring wraps the driver error, so that message is
     * the raw JDBC/Hibernate text — a real one served to the browser on registration read:
     *
     * <pre>{@code
     * could not execute statement [Data truncation: Data too long for column 'token' at
     * row 1] [insert into refresh_tokens (expiry_date,token,user_id,id) values (?,?,?,?)]
     * }</pre>
     *
     * <p>That is two problems at once. It is unreadable to the person who just wanted to
     * sign in, and it hands an anonymous caller the table name, every column name and the
     * exact statement — a free schema dump from a failed request.
     *
     * <p><b>Why a fixed message rather than a tidied-up one:</b><br>
     * There is no safe way to summarise a driver error for a user: the useful part is
     * always an implementation detail. The detail belongs in the log, where it is already
     * written in full with a stack trace, and the response says only what the caller can
     * act on.
     *
     * @param ex the persistence failure — logged in full, never echoed to the client
     * @return a 500 carrying a generic message
     */
    @ExceptionHandler(DataAccessException.class)
    public ResponseEntity<Map<String, String>> handleDataAccess(DataAccessException ex) {
        log.error("Database error: {}", ex.getMessage(), ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "Something went wrong on our end. Please try again in a moment."));
    }

    /**
     * Handles {@link RuntimeException} — a broad catch for unchecked application errors.
     *
     * <p><b>Typical cause:</b><br>
     * Service-layer errors such as "email already registered", "listing not found",
     * "insufficient balance", etc. that are thrown as {@code RuntimeException} (or a
     * subclass) when a business rule is violated.
     *
     * <p><b>Why log at ERROR?</b><br>
     * {@code RuntimeException} at this level likely indicates either a programming bug
     * or an unexpected data state. Logging at ERROR (with the full stack trace via the
     * third argument) ensures it appears prominently in error monitoring dashboards.
     *
     * <p><b>Note on {@code AccessDeniedException}:</b><br>
     * {@code AccessDeniedException} extends {@code RuntimeException}. Spring's
     * exception handler resolution picks the most-specific matching handler, so
     * {@link #handleAccessDenied} takes precedence for that type — this handler is
     * only reached for non-security {@code RuntimeException}s.
     *
     * @param ex the runtime exception — its message is included in the response
     * @return a 500 response with the exception message, or a generic fallback if null
     */
    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<Map<String, String>> handleRuntimeException(RuntimeException ex) {
        log.error("RuntimeException: {}", ex.getMessage(), ex); // Log full stack trace
        String msg = ex.getMessage();
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", msg != null ? msg : "Internal error"));
    }

    /**
     * Last-resort handler for any {@link Exception} not matched by more specific handlers.
     *
     * <p><b>Why it's needed:</b><br>
     * Checked exceptions (e.g. {@code IOException}) thrown from controllers would
     * otherwise bypass all the handlers above and fall through to Spring's default error
     * handler. This method ensures they also produce a clean JSON 500 response.
     *
     * <p><b>Why the message is not echoed:</b><br>
     * This used to return {@code ex.getMessage()} and carried a note suggesting that be
     * changed before production. Nothing reaching this handler is a business rule the
     * caller can act on — those are thrown as {@link RuntimeException},
     * {@link IllegalArgumentException} or {@code ResponseStatusException} and are answered
     * above with their real text. What lands here is a checked exception from the plumbing,
     * whose message is a file path, a host name, or a stack of driver internals. So it goes
     * to the log, in full, and the caller gets a sentence instead.
     *
     * @param ex the unhandled exception — logged in full, never echoed to the client
     * @return a 500 response with a generic message
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> handleGeneralException(Exception ex) {
        log.error("Unhandled exception: {}", ex.getMessage(), ex); // Log full stack trace for debugging
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "Something went wrong on our end. Please try again in a moment."));
    }
}
