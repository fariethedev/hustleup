/**
 * REST controller for person-to-person direct messaging (DMs).
 *
 * <p><strong>What are Direct Messages?</strong><br>
 * Unlike the booking-scoped {@link ChatController} (which handles messages
 * within a specific booking thread via WebSocket), Direct Messages are
 * free-form, persistent conversations between any two users of the platform.
 * They are stored in the {@code direct_messages} table and served over
 * regular HTTP REST endpoints.
 *
 * <p><strong>Why HTTP instead of WebSocket for DMs?</strong><br>
 * Direct messages in this implementation are sent and retrieved via standard
 * HTTP requests.  This keeps the architecture simpler for the MVP: the client
 * POSTs a message and polls (or re-fetches) the conversation history as needed.
 * A future enhancement would push new DMs over a WebSocket or SSE stream so
 * the recipient sees them instantly without polling.
 *
 * <p><strong>Authentication:</strong><br>
 * All endpoints require a valid JWT.  The helper {@link #getCurrentUserId()}
 * resolves the caller's UUID from the JWT-derived email stored in the Spring
 * Security context.
 *
 * <p><strong>Base path:</strong> {@code /api/v1/direct-messages}
 */
package com.hustleup.messaging.controller;

import com.hustleup.messaging.model.DirectMessage;
import com.hustleup.messaging.repository.DirectMessageRepository;
import com.hustleup.common.model.Notification;
import com.hustleup.common.repository.NotificationRepository;
import com.hustleup.common.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.*;

/** {@code @RestController} makes every return value automatically serialised to JSON. */
@RestController

/** All endpoints in this controller share the {@code /api/v1/direct-messages} prefix. */
@RequestMapping("/api/v1/direct-messages")
public class DirectMessageController {

    /**
     * Repository for {@link DirectMessage} entities.
     * Provides custom JPQL/native queries for fetching conversations and partners.
     */
    private final DirectMessageRepository dmRepo;

    /**
     * Repository for {@link com.hustleup.common.model.User} entities.
     * Used to resolve the caller's email → UUID and to fetch partner profile data.
     */
    private final UserRepository userRepo;

    /**
     * Repository for persisting in-app {@link Notification} entities.
     * When a DM is sent, a notification is created for the recipient so they
     * see the "New message" badge even if they are not currently in the chat.
     */
    private final NotificationRepository notificationRepo;

    /**
     * Constructor injection – preferred over field injection for testability
     * and immutability (all three fields are {@code final} at the call site).
     *
     * @param dmRepo           repository for direct messages.
     * @param userRepository   repository for user records.
     * @param notificationRepo repository for in-app notifications.
     */
    public DirectMessageController(DirectMessageRepository dmRepo, UserRepository userRepository,
                                   NotificationRepository notificationRepo) {
        this.dmRepo = dmRepo;
        this.userRepo = userRepository;
        this.notificationRepo = notificationRepo;
    }

    /**
     * Resolves the UUID (as a String) of the currently authenticated user.
     *
     * <p>The JWT filter stores the user's email as the principal name in the
     * Spring Security context.  We look that email up in the {@code users} table
     * and return the corresponding UUID string.
     *
     * @return the current user's UUID string, or {@code null} if unauthenticated
     *         or the email cannot be found in the database.
     */
    private String getCurrentUserId() {
        // Retrieve the Authentication object from the thread-local security context.
        org.springframework.security.core.Authentication auth =
                SecurityContextHolder.getContext().getAuthentication();

        // auth can be null if no security filter has run (e.g. in unit tests without mocks).
        if (auth == null) return null;

        String email = auth.getName(); // The email set during JWT validation

        // findByEmail returns Optional<User>; map to UUID string, or null if absent.
        return userRepo.findByEmail(email)
                .map(u -> u.getId().toString())
                .orElse(null);
    }

    /**
     * Returns the list of users with whom the current user has exchanged at
     * least one direct message, enriched with profile data and the last message
     * preview.  Results are sorted by most-recent message first.
     *
     * <pre>
     * HTTP Method : GET
     * Path        : /api/v1/direct-messages/partners
     * Auth        : Required (JWT)
     * Response    : 200 OK – JSON array of partner objects, each containing:
     *                 id, name, avatarUrl, verified, online, unreadCount,
     *                 lastMessage (optional), lastMessageAt (optional ISO-8601 string)
     *               401 Unauthorized – if not authenticated
     * </pre>
     *
     * <p>The "online" flag uses a simple heuristic: if the user's
     * {@code lastActive} timestamp is within the last 5 minutes, they are
     * considered online.  This is updated by activity-tracking middleware
     * elsewhere in the system.
     *
     * @return a {@link ResponseEntity} containing the enriched partner list.
     */
    @GetMapping("/partners")
    public ResponseEntity<?> getChatPartners() {
        String currentUserId = getCurrentUserId();
        // Short-circuit with 401 if the caller is not authenticated.
        if (currentUserId == null) return ResponseEntity.status(401).build();

        // findDistinctChatPartners returns a flat list of UUIDs (as Strings) of
        // every user who has sent or received a message with the current user.
        List<String> partnerIds = dmRepo.findDistinctChatPartners(currentUserId);

        // We will build a list of rich partner objects to return as JSON.
        List<Map<String, Object>> partners = new ArrayList<>();

        for (String pid : partnerIds) {
            try {
                // Look up the partner's User record. ifPresent ensures we only
                // proceed if the UUID maps to a real user.
                userRepo.findById(UUID.fromString(pid)).ifPresent(user -> {
                    // Heuristic online check: "active within last 5 minutes" = online.
                    boolean isOnline = user.getLastActive() != null &&
                            user.getLastActive().isAfter(LocalDateTime.now().minusMinutes(5));

                    // Fetch the single most recent message between these two users
                    // to populate the "last message" preview in the chat list UI.
                    DirectMessage last = dmRepo.findLastMessage(currentUserId, pid).orElse(null);

                    // LinkedHashMap preserves insertion order, which results in
                    // a predictable JSON field order for the front-end.
                    Map<String, Object> partner = new LinkedHashMap<>();
                    partner.put("id", user.getId().toString());
                    partner.put("name", user.getFullName());
                    partner.put("avatarUrl", user.getAvatarUrl());
                    partner.put("verified", user.isIdVerified());   // ID-verified badge
                    partner.put("online", isOnline);
                    partner.put("unreadCount", 0);  // TODO: implement per-conversation unread counts
                    if (last != null) {
                        partner.put("lastMessage", last.getContent());
                        // Convert LocalDateTime to ISO-8601 string so JSON serialisation
                        // is consistent regardless of the Jackson date format config.
                        partner.put("lastMessageAt",
                                last.getCreatedAt() != null ? last.getCreatedAt().toString() : null);
                    }
                    partners.add(partner);
                });
            } catch (IllegalArgumentException e) {
                // The partnerId stored in the DB is not a valid UUID string.
                // Skip it silently rather than aborting the whole request.
            }
        }

        // Sort conversations by the most recent message timestamp, descending,
        // so the chat list shows the freshest conversation at the top.
        partners.sort((a, b) -> {
            String ta = (String) a.get("lastMessageAt");
            String tb = (String) b.get("lastMessageAt");
            // Handle nulls: treat a null timestamp as "oldest" (sorted to the end).
            if (ta == null && tb == null) return 0;
            if (ta == null) return 1;   // a has no message → goes after b
            if (tb == null) return -1;  // b has no message → a comes first
            // ISO-8601 strings are lexicographically sortable, so String.compareTo works.
            return tb.compareTo(ta);    // descending: newer first
        });

        return ResponseEntity.ok(partners);
    }

    /**
     * Returns the full chronological message history between the current user
     * and a specified partner.
     *
     * <pre>
     * HTTP Method : GET
     * Path        : /api/v1/direct-messages/{partnerId}
     * Auth        : Required (JWT)
     * Path Param  : partnerId – UUID string of the other participant
     * Response    : 200 OK – JSON array of {@link DirectMessage} objects, oldest first
     *               401 Unauthorized – if not authenticated
     * </pre>
     *
     * <p>The underlying JPQL query ({@code findConversation}) retrieves messages
     * where the current user is either the sender OR the receiver, so both
     * sides of the conversation appear in a single list.
     *
     * @param partnerId UUID string of the chat partner, bound from the URL path.
     * @return a {@link ResponseEntity} containing the message list.
     */
    @GetMapping("/{partnerId}")
    public ResponseEntity<?> getConversation(
            // @PathVariable extracts the {partnerId} segment from the URL.
            @PathVariable String partnerId) {
        String currentUserId = getCurrentUserId();
        if (currentUserId == null) return ResponseEntity.status(401).build();

        // findConversation returns messages for BOTH directions (sent and received)
        // ordered by createdAt ASC so the UI can render them top-to-bottom.
        List<DirectMessage> messages = dmRepo.findConversation(currentUserId, partnerId);
        return ResponseEntity.ok(messages);
    }

    /**
     * Sends a new direct message from the current user to a partner, and
     * creates a notification for the recipient.
     *
     * <pre>
     * HTTP Method : POST
     * Path        : /api/v1/direct-messages/{partnerId}
     * Auth        : Required (JWT)
     * Path Param  : partnerId – UUID string of the intended recipient
     * Request Body: JSON object with field "content" (the message text)
     *               Example: {"content": "Hey, are you available Tuesday?"}
     * Response    : 200 OK – the persisted {@link DirectMessage} as JSON
     *               400 Bad Request – if "content" is absent or blank
     *               401 Unauthorized – if not authenticated
     * </pre>
     *
     * <p>After saving the message, the method attempts to create an in-app
     * notification for the recipient.  Any failure during notification creation
     * is silently swallowed ({@code catch (Exception ignored)}) so that a
     * notification bug never prevents the message from being delivered.
     *
     * @param partnerId UUID string of the recipient, from the URL path.
     * @param payload   request body parsed into a {@code Map<String, String>};
     *                  must contain the key {@code "content"}.
     * @return a {@link ResponseEntity} containing the saved message.
     */
    @PostMapping("/{partnerId}")
    public ResponseEntity<?> sendMessage(
            @PathVariable String partnerId,
            // @RequestBody tells Spring to deserialise the JSON request body.
            // Using a Map<String, String> is a lightweight alternative to a
            // dedicated DTO when the request shape is trivially simple.
            @RequestBody Map<String, String> payload) {

        String content = payload.get("content");
        // Validate: reject empty or whitespace-only messages.
        if (content == null || content.trim().isEmpty()) return ResponseEntity.badRequest().build();

        String currentUserId = getCurrentUserId();
        if (currentUserId == null) return ResponseEntity.status(401).build();

        // Use the Lombok @Builder pattern to construct the entity.
        // createdAt is set automatically by @CreationTimestamp on the entity.
        DirectMessage msg = DirectMessage.builder()
                .senderId(currentUserId)
                .receiverId(partnerId)
                .content(content)
                .build();

        // Persist the message. save() issues an INSERT and returns the managed
        // entity (with the generated id and createdAt populated).
        DirectMessage saved = dmRepo.save(msg);

        // Create an in-app notification for the recipient so they see a badge
        // even if they are not currently viewing the DM screen.
        try {
            // Resolve the sender's display name for the notification title.
            String senderName = userRepo.findById(UUID.fromString(currentUserId))
                    .map(u -> u.getFullName())
                    .orElse("Someone"); // fallback if the user record is missing

            // Truncate the message preview to 60 characters to avoid long
            // notification text in the UI.
            String preview = content.length() > 60 ? content.substring(0, 60) + "…" : content;

            notificationRepo.save(Notification.builder()
                    .userId(UUID.fromString(partnerId))          // recipient's UUID
                    .title("New message from " + senderName)
                    .message(preview)
                    .notificationType("DIRECT_MESSAGE")          // type discriminator for the UI
                    .referenceId(UUID.fromString(currentUserId)) // sender's UUID for deep-linking
                    .build());
        } catch (Exception ignored) {
            // Notification creation is best-effort.  If partnerId is not a valid
            // UUID, or the notification repo throws, we still return the saved
            // message successfully.  Logging this exception would be advisable
            // in a production system.
        }

        return ResponseEntity.ok(saved);
    }
}

