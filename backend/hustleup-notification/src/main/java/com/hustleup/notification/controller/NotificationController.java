/**
 * REST controller that exposes CRUD-like endpoints for in-app notifications.
 *
 * <p><strong>What is a "notification" in HustleUp?</strong><br>
 * A {@link com.hustleup.common.model.Notification} is a lightweight alert
 * stored in the database and shown to the user inside the application (e.g.
 * a bell-icon badge).  Examples: "Your booking was confirmed", "You received
 * a new message from Alice".  These are <em>not</em> push notifications to a
 * mobile device; they are purely in-app.
 *
 * <p><strong>Authentication model:</strong><br>
 * All endpoints require a valid JWT to be present in the {@code Authorization}
 * header.  Spring Security's filter chain validates the token before the
 * request reaches this controller and stores the authenticated principal (the
 * user's email) in {@link org.springframework.security.core.context.SecurityContextHolder}.
 * The private helper {@link #getCurrentUser()} retrieves the full {@code User}
 * entity from that email so we can look up their UUID.
 *
 * <p><strong>Base path:</strong> {@code /api/v1/notifications}
 */
package com.hustleup.notification.controller;

import com.hustleup.common.model.Notification;
import com.hustleup.common.repository.NotificationRepository;
import com.hustleup.common.model.User;
import com.hustleup.common.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * {@code @RestController} is a shortcut for {@code @Controller + @ResponseBody}.
 * Every method's return value is automatically serialised to JSON and written
 * into the HTTP response body – no need to annotate each method individually.
 */
@RestController

/**
 * {@code @RequestMapping} sets a common URL prefix for every endpoint in this
 * class.  All notification endpoints live under {@code /api/v1/notifications}.
 * Using a versioned path ({@code v1}) makes it easier to introduce breaking
 * changes later without affecting existing clients.
 */
@RequestMapping("/api/v1/notifications")
public class NotificationController {

    /**
     * Repository for reading and persisting {@link Notification} entities.
     * Declared {@code final} so it cannot be accidentally reassigned after
     * construction; this also satisfies the immutability requirement for
     * constructor injection.
     */
    private final NotificationRepository notificationRepository;

    /**
     * Repository for looking up {@link User} entities.
     * Used to resolve the currently authenticated user's email to their UUID,
     * since the JWT principal only contains the email address.
     */
    private final UserRepository userRepository;

    /**
     * Constructor injection – the preferred way to inject dependencies in
     * Spring.  Compared to {@code @Autowired} field injection, constructor
     * injection makes dependencies explicit, allows the class to be tested
     * without a Spring context (just call {@code new NotificationController(mock, mock)}),
     * and works naturally with {@code final} fields.
     *
     * @param notificationRepository JPA repository for Notification entities.
     * @param userRepository         JPA repository for User entities.
     */
    public NotificationController(NotificationRepository notificationRepository, UserRepository userRepository) {
        this.notificationRepository = notificationRepository;
        this.userRepository = userRepository;
    }

    /**
     * Returns all notifications for the currently authenticated user, ordered
     * newest first.
     *
     * <pre>
     * HTTP Method : GET
     * Path        : /api/v1/notifications
     * Auth        : Required (JWT)
     * Response    : 200 OK – JSON array of Notification objects
     *               200 OK – empty array [] if not authenticated
     *               (graceful degradation; the front-end should show no notifications)
     * </pre>
     *
     * <p>The wildcard {@code ResponseEntity<?>} return type is used because when
     * the user is present we return a {@code List<Notification>}, but when absent
     * we return an empty list.  Both need to be serialisable to JSON.
     *
     * @return a {@link ResponseEntity} wrapping the notification list.
     */
    @GetMapping
    public ResponseEntity<?> getMyNotifications() {
        // getCurrentUser() returns Optional<User>. If present, query the DB.
        // If absent (unauthenticated), return an empty list rather than a 401
        // so the front-end can render a blank notification panel without errors.
        return getCurrentUser()
                .map(user -> ResponseEntity.ok((Object) notificationRepository.findByUserIdOrderByCreatedAtDesc(user.getId())))
                .orElse(ResponseEntity.ok(List.of()));
    }

    /**
     * Returns the count of unread notifications for the current user.
     *
     * <pre>
     * HTTP Method : GET
     * Path        : /api/v1/notifications/unread-count
     * Auth        : Required (JWT)
     * Response    : 200 OK – JSON object, e.g. {"count": 3}
     *               200 OK – {"count": 0} if not authenticated
     * </pre>
     *
     * <p>The front-end typically polls this endpoint (or reads it on page load)
     * to display the red badge number on the notification bell icon.
     *
     * @return a {@link ResponseEntity} containing a single-entry map
     *         {@code {count: <long>}}.
     */
    @GetMapping("/unread-count")
    public ResponseEntity<Map<String, Long>> getUnreadCount() {
        return getCurrentUser()
                // countByUserIdAndReadFalse is a derived query method; Spring Data
                // generates the SQL "SELECT COUNT(*) FROM notifications WHERE user_id = ? AND read = false"
                .map(user -> ResponseEntity.ok(Map.of("count", notificationRepository.countByUserIdAndReadFalse(user.getId()))))
                .orElse(ResponseEntity.ok(Map.of("count", 0L)));
    }

    /**
     * Marks ALL unread notifications for the current user as read in one go.
     * This is invoked when the user clicks "Mark all as read" in the UI.
     *
     * <pre>
     * HTTP Method : PATCH
     * Path        : /api/v1/notifications/read-all
     * Auth        : Required (JWT)
     * Response    : 200 OK – {"marked": <number of notifications updated>}
     *               401 Unauthorized – if the user is not authenticated
     * </pre>
     *
     * <p>PATCH is the correct HTTP verb here (rather than PUT) because we are
     * making a partial update to a collection of resources (flipping the
     * {@code read} flag) rather than replacing them entirely.
     *
     * @return a {@link ResponseEntity} indicating how many notifications were
     *         updated, or 401 if unauthenticated.
     */
    @PatchMapping("/read-all")
    public ResponseEntity<?> markAllRead() {
        return getCurrentUser()
                .map(user -> {
                    // Fetch all notifications for this user, then stream-filter
                    // down to only the unread ones to avoid unnecessary DB writes.
                    List<Notification> unread = notificationRepository
                            .findByUserIdOrderByCreatedAtDesc(user.getId())
                            .stream()
                            .filter(n -> !n.isRead()) // keep only those where read == false
                            .toList();                // Java 16+ collector shorthand

                    // Set read = true on every unread notification in memory.
                    unread.forEach(n -> n.setRead(true));

                    // saveAll() issues a batch UPDATE for every entity whose state
                    // changed.  More efficient than calling save() in a loop because
                    // it can be wrapped in a single transaction.
                    notificationRepository.saveAll(unread);

                    // Return the count so the front-end can update its badge immediately
                    // without making another /unread-count request.
                    return ResponseEntity.ok(Map.of("marked", unread.size()));
                })
                .orElse(ResponseEntity.status(401).build()); // 401 Unauthorized if not logged in
    }

    /**
     * Marks a single notification as read by its UUID.
     *
     * <pre>
     * HTTP Method : PATCH
     * Path        : /api/v1/notifications/{id}/read
     * Auth        : Required (JWT); the notification must belong to the caller
     * Path Param  : id – UUID of the notification to mark as read
     * Response    : 200 OK – {"success": true}
     *               401 Unauthorized – if not authenticated
     *               500 – if notification not found or does not belong to the user
     *                     (RuntimeException; should be refined to 404/403 in future)
     * </pre>
     *
     * <p>The ownership check ({@code notification.getUserId().equals(user.getId())})
     * is a critical security gate – without it any authenticated user could mark
     * any other user's notification as read by guessing the UUID.
     *
     * @param id the UUID of the notification, extracted from the URL path by
     *           {@code @PathVariable}.
     * @return a {@link ResponseEntity} with {@code {"success": true}} on success.
     */
    @PatchMapping("/{id}/read")
    public ResponseEntity<?> markRead(
            // @PathVariable binds the {id} segment from the URL to this parameter.
            // Spring automatically converts the String to UUID.
            @PathVariable UUID id) {
        return getCurrentUser()
                .map(user -> {
                    // Look up the notification; throw if it doesn't exist.
                    Notification notification = notificationRepository.findById(id)
                            .orElseThrow(() -> new RuntimeException("Notification not found"));

                    // Authorization check: ensure the notification belongs to the caller.
                    // Without this, any authenticated user could mark someone else's notification.
                    if (!notification.getUserId().equals(user.getId())) {
                        throw new RuntimeException("Not authorized to update this notification");
                    }

                    // Flip the read flag and persist.
                    notification.setRead(true);
                    notificationRepository.save(notification);

                    return ResponseEntity.ok(Map.of("success", true));
                })
                .orElse(ResponseEntity.status(401).build());
    }

    /**
     * Helper that resolves the currently authenticated user from the Spring
     * Security context.
     *
     * <p>Spring Security stores the principal (the logged-in user's identity)
     * in a thread-local {@link SecurityContextHolder}.  After JWT validation,
     * the principal name is set to the user's email address.  We then use that
     * email to fetch the full {@link User} entity from the database.
     *
     * <p>Returns {@link java.util.Optional#empty()} in two cases:
     * <ul>
     *   <li>No authentication token was provided at all ({@code auth.getName()}
     *       returns {@code "anonymousUser"}, Spring's placeholder for unauthenticated
     *       requests).</li>
     *   <li>The email in the token does not correspond to any user in the DB
     *       (token was issued for a deleted account, etc.).</li>
     * </ul>
     *
     * @return an {@link java.util.Optional} containing the {@link User} if
     *         authenticated, or empty otherwise.
     */
    private java.util.Optional<User> getCurrentUser() {
        // getAuthentication().getName() returns the principal name as a String.
        // For a valid JWT it is the email; for unauthenticated requests it is
        // the literal string "anonymousUser".
        String email = SecurityContextHolder.getContext().getAuthentication().getName();

        // Guard against the two "not authenticated" states.
        if (email == null || email.equals("anonymousUser")) {
            return java.util.Optional.empty();
        }

        // findByEmail is a Spring Data derived query: "SELECT * FROM users WHERE email = ?"
        return userRepository.findByEmail(email);
    }
}
