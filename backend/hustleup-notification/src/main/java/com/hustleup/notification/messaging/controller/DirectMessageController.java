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
package com.hustleup.notification.messaging.controller;

import com.hustleup.notification.messaging.model.ChatStreak;
import com.hustleup.notification.messaging.model.DirectMessage;
import com.hustleup.notification.messaging.repository.ChatStreakRepository;
import com.hustleup.notification.messaging.repository.DirectMessageRepository;
import com.hustleup.common.model.Match;
import com.hustleup.common.model.Notification;
import com.hustleup.common.push.ExpoPushService;
import com.hustleup.common.repository.MatchRepository;
import com.hustleup.common.repository.NotificationRepository;
import com.hustleup.common.repository.UserRepository;
import com.hustleup.common.storage.FileStorageService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.time.LocalDate;
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
     * Shared storage abstraction (local ./uploads or S3) used to persist images
     * attached to direct messages.
     */
    private final FileStorageService fileStorageService;

    /** Repository for {@link ChatStreak} rows — one per conversation pair. */
    private final ChatStreakRepository streakRepo;

    /** Mirrors each new-message in-app notification as a mobile push, if the recipient has one registered. */
    private final ExpoPushService expoPushService;

    /**
     * Read-only lookup for whether a conversation partner is a mutual Bond match — powers the
     * heart badge that distinguishes a Bond-originated chat from a cold DM or a marketplace
     * negotiation thread. See {@link Match}'s javadoc for why this cross-feature entity lives
     * in {@code hustleup-common} rather than the dating feature's own service.
     */
    private final MatchRepository matchRepo;

    /**
     * Constructor injection – preferred over field injection for testability
     * and immutability (all fields are {@code final} at the call site).
     *
     * @param dmRepo             repository for direct messages.
     * @param userRepository     repository for user records.
     * @param notificationRepo   repository for in-app notifications.
     * @param fileStorageService storage backend for DM image attachments.
     * @param streakRepo         repository for per-conversation messaging streaks.
     * @param expoPushService    delivers the accompanying mobile push notification.
     * @param matchRepo          repository for Bond matches, used to tag conversations.
     */
    public DirectMessageController(DirectMessageRepository dmRepo, UserRepository userRepository,
                                   NotificationRepository notificationRepo,
                                   FileStorageService fileStorageService,
                                   ChatStreakRepository streakRepo,
                                   ExpoPushService expoPushService,
                                   MatchRepository matchRepo) {
        this.dmRepo = dmRepo;
        this.userRepo = userRepository;
        this.notificationRepo = notificationRepo;
        this.fileStorageService = fileStorageService;
        this.streakRepo = streakRepo;
        this.expoPushService = expoPushService;
        this.matchRepo = matchRepo;
    }

    /** Whether the two given users are a mutual Bond match — see {@link Match}. */
    private boolean isBondMatch(UUID userA, UUID userB) {
        Match.Pair pair = Match.Pair.of(userA, userB);
        return matchRepo.existsByUserIdAAndUserIdB(pair.smaller(), pair.larger());
    }

    /** When two users matched on Bond, or {@code null} if they never did. */
    private LocalDateTime bondMatchedAt(UUID userA, UUID userB) {
        Match.Pair pair = Match.Pair.of(userA, userB);
        return matchRepo.findAllForUser(userA).stream()
                .filter(m -> m.getUserIdA().equals(pair.smaller()) && m.getUserIdB().equals(pair.larger()))
                .findFirst()
                .map(Match::getMatchedAt)
                .orElse(null);
    }

    /**
     * Records that {@code userId1} and {@code userId2} exchanged a message today, updating
     * their shared streak (see {@link ChatStreak}). Same-day repeats are a no-op; a gap of
     * one day increments the streak; a gap of more than one day resets it to 1.
     *
     * @return the streak's new current-day count, for convenience (not currently returned
     *         from the send endpoints, but available if a future response wants it).
     */
    private int updateStreak(String userId1, String userId2) {
        String a = userId1.compareTo(userId2) <= 0 ? userId1 : userId2;
        String b = userId1.compareTo(userId2) <= 0 ? userId2 : userId1;
        LocalDate today = LocalDate.now();

        ChatStreak streak = streakRepo.findByUserAIdAndUserBId(a, b).orElse(null);
        if (streak == null) {
            streak = ChatStreak.builder().userAId(a).userBId(b).currentStreak(1).lastMessageDate(today).build();
        } else if (streak.getLastMessageDate().equals(today)) {
            // Already counted a message today for this pair — no change.
            return streak.getCurrentStreak();
        } else if (streak.getLastMessageDate().equals(today.minusDays(1))) {
            streak.setCurrentStreak(streak.getCurrentStreak() + 1);
            streak.setLastMessageDate(today);
        } else {
            // More than a day of silence — the streak is broken, start over at 1.
            streak.setCurrentStreak(1);
            streak.setLastMessageDate(today);
        }
        return streakRepo.save(streak).getCurrentStreak();
    }

    /**
     * Read-only view of a pair's current streak for display purposes. Unlike the stored
     * {@link ChatStreak#getCurrentStreak()}, this returns 0 once more than a day has passed
     * since the last message — the stored value only actually resets on the *next* message,
     * so without this check the UI would keep showing a stale streak as "alive" during the
     * gap instead of showing it as broken.
     */
    private int displayStreak(String userId1, String userId2) {
        String a = userId1.compareTo(userId2) <= 0 ? userId1 : userId2;
        String b = userId1.compareTo(userId2) <= 0 ? userId2 : userId1;
        return streakRepo.findByUserAIdAndUserBId(a, b)
                .filter(s -> !s.getLastMessageDate().isBefore(LocalDate.now().minusDays(1)))
                .map(ChatStreak::getCurrentStreak)
                .orElse(0);
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

        UUID currentUuid;
        try {
            currentUuid = UUID.fromString(currentUserId);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(401).build();
        }

        // When each Bond match happened, keyed by the person on the other side of it.
        // Loaded up front rather than asked per-partner: it replaces one existsBy query per
        // row with a single fetch, and it carries the match date the client needs to label
        // the conversation.
        Map<UUID, LocalDateTime> matchedAt = new HashMap<>();
        for (Match match : matchRepo.findAllForUser(currentUuid)) {
            UUID other = match.getUserIdA().equals(currentUuid) ? match.getUserIdB() : match.getUserIdA();
            matchedAt.put(other, match.getMatchedAt());
        }

        // findDistinctChatPartners returns a flat list of UUIDs (as Strings) of
        // every user who has sent or received a message with the current user.
        //
        // Bond matches are unioned in on top. A match IS a conversation from the moment it
        // happens — before this, a match with nothing said in it yet appeared nowhere in
        // Messages, so the two people had to find each other again through the swipe deck.
        // LinkedHashSet keeps the messaged partners first and de-duplicates any match that
        // has already been messaged.
        Set<String> partnerIds = new LinkedHashSet<>(dmRepo.findDistinctChatPartners(currentUserId));
        matchedAt.keySet().forEach(id -> partnerIds.add(id.toString()));

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
                    partner.put("name", user.displayName());
                    partner.put("avatarUrl", user.getAvatarUrl());
                    partner.put("verified", user.isIdVerified());   // ID-verified badge
                    partner.put("online", isOnline);
                    // Messages this partner sent that the caller has not opened yet.
                    // Drives both the bold "unread" row styling and the count badge.
                    partner.put("unreadCount",
                            dmRepo.countBySenderIdAndReceiverIdAndReadAtIsNull(pid, currentUserId));
                    partner.put("streak", displayStreak(currentUserId, pid)); // 0 if never messaged or broken

                    LocalDateTime matched = matchedAt.get(user.getId());
                    partner.put("isBondMatch", matched != null);
                    if (matched != null) partner.put("matchedAt", matched.toString());
                    // A match where neither side has said anything yet. The client pulls these
                    // out into their own "new matches" row instead of burying them in a list
                    // sorted by a message that doesn't exist.
                    partner.put("isNewMatch", matched != null && last == null);
                    // Lights the row lime: money is being agreed in this thread.
                    partner.put("negotiating", dmRepo.hasNegotiation(currentUserId, pid));

                    if (last != null) {
                        // Human-friendly preview: photos, stickers, and shared listings
                        // shouldn't show raw (possibly empty) content.
                        String previewText;
                        if ("IMAGE".equals(last.getMessageType())) {
                            previewText = last.getContent() != null && !last.getContent().isBlank()
                                    ? "📷 " + last.getContent() : "📷 Photo";
                        } else if ("STICKER".equals(last.getMessageType())) {
                            previewText = last.getContent() + " Sticker";
                        } else if ("LISTING".equals(last.getMessageType())) {
                            previewText = "🛍️ Shared a listing" + (last.getSharedListingTitle() != null ? ": " + last.getSharedListingTitle() : "");
                        } else if ("POST".equals(last.getMessageType())) {
                            previewText = "📤 Shared a post";
                        } else if ("STORY".equals(last.getMessageType())) {
                            previewText = "✨ Shared a story";
                        } else if ("OFFER".equals(last.getMessageType())) {
                            // An offer card carries its price live from the booking, so there is
                            // no amount snapshotted here to preview. Name the thing instead of
                            // falling through to content, which is usually an empty caption.
                            previewText = last.getContent() != null && !last.getContent().isBlank()
                                    ? "🤝 " + last.getContent() : "🤝 Price offer";
                        } else {
                            previewText = last.getContent();
                        }
                        partner.put("lastMessage", previewText);
                        // Who sent it, and whether it has been read. The sidebar tick used to be
                        // drawn from the CALLER's unread state, which says nothing about whether
                        // the other person has seen anything -- it showed a "read" tick on rows
                        // where the last message was one they had sent to you.
                        partner.put("lastMessageMine", currentUserId.equals(last.getSenderId()));
                        partner.put("lastMessageRead", last.getReadAt() != null);
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
            // ISO-8601 strings are lexicographically sortable, so String.compareTo works.
            if (ta != null && tb != null) return tb.compareTo(ta); // descending: newer first
            if (ta != null) return -1;  // b has no message → a comes first
            if (tb != null) return 1;   // a has no message → goes after b
            // Neither has been messaged, so they are both unopened Bond matches: order them
            // by when they matched, freshest first.
            String ma = (String) a.get("matchedAt");
            String mb = (String) b.get("matchedAt");
            if (ma == null && mb == null) return 0;
            if (ma == null) return 1;
            if (mb == null) return -1;
            return mb.compareTo(ma);
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
    @org.springframework.transaction.annotation.Transactional
    public ResponseEntity<?> getConversation(
            // @PathVariable extracts the {partnerId} segment from the URL.
            @PathVariable String partnerId) {
        String currentUserId = getCurrentUserId();
        if (currentUserId == null) return ResponseEntity.status(401).build();

        // Fetching a conversation IS the "I opened this chat" signal, so clear the
        // caller's unread messages from this partner here. The bulk UPDATE only
        // touches rows where readAt is still null, so the 5s client poll that re-hits
        // this endpoint costs nothing once the backlog is cleared.
        //
        // @Transactional is required: @Modifying queries must run inside a transaction,
        // and it also makes the mark-read and the read-back below atomic.
        dmRepo.markConversationRead(partnerId, currentUserId, LocalDateTime.now());

        // findConversation returns messages for BOTH directions (sent and received)
        // ordered by createdAt ASC so the UI can render them top-to-bottom.
        // Read after the update so the returned rows carry their new readAt.
        List<DirectMessage> messages = dmRepo.findConversation(currentUserId, partnerId);
        return ResponseEntity.ok(messages);
    }

    /**
     * Total messages the caller has received but not opened, across every conversation.
     *
     * <p><b>GET /api/v1/direct-messages/unread-count</b>
     *
     * <p>Powers the badge on the DMs nav tab and the pill beside the "Chats" heading.
     * It is a single {@code COUNT(*)} rather than a sum over {@code /partners}, so the
     * navbar can poll it cheaply from anywhere in the app without building the whole
     * partner list.
     *
     * <p>Mapped above {@code /{partnerId}} in this file, but that ordering is cosmetic —
     * Spring matches the literal path segment ahead of the {@code {partnerId}} template
     * regardless of declaration order, so "unread-count" is never mistaken for a user id.
     *
     * @return 200 OK with {@code {"count": n}}; 401 if not authenticated
     */
    @GetMapping("/unread-count")
    public ResponseEntity<?> unreadCount() {
        String currentUserId = getCurrentUserId();
        if (currentUserId == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(Map.of("count", dmRepo.countByReceiverIdAndReadAtIsNull(currentUserId)));
    }

    /**
     * Whether the current user and {@code partnerId} are a mutual Bond match.
     *
     * <p><b>GET /api/v1/direct-messages/{partnerId}/bond-match</b>
     *
     * <p>{@code GET /partners} already includes this flag per-partner, but only for partners
     * you've exchanged at least one message with. A brand-new match navigated to straight
     * from the swipe screen (see {@code Dating.jsx}) has zero messages yet, so wouldn't show
     * up there — this endpoint lets the DM view check a single partner directly, regardless
     * of message history.
     *
     * <p>{@code matchedAt} accompanies a true result so the conversation can be labelled with
     * the date it started, without waiting for the next {@code /partners} poll to carry it.
     *
     * @return 200 OK with {@code {"isBondMatch": bool, "matchedAt": "…"}}; 401 if not authenticated
     */
    @GetMapping("/{partnerId}/bond-match")
    public ResponseEntity<?> checkBondMatch(@PathVariable String partnerId) {
        String currentUserId = getCurrentUserId();
        if (currentUserId == null) return ResponseEntity.status(401).build();
        try {
            UUID me = UUID.fromString(currentUserId);
            UUID them = UUID.fromString(partnerId);
            if (!isBondMatch(me, them)) return ResponseEntity.ok(Map.of("isBondMatch", false));

            LocalDateTime matched = bondMatchedAt(me, them);
            // Map.of rejects null values, so the date is only included when there is one.
            return matched == null
                    ? ResponseEntity.ok(Map.of("isBondMatch", true))
                    : ResponseEntity.ok(Map.of("isBondMatch", true, "matchedAt", matched.toString()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.ok(Map.of("isBondMatch", false));
        }
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

        // Optional "type" field: TEXT (default), STICKER, or LISTING (in-app share of a
        // marketplace listing). Anything else is coerced to TEXT so a malformed client
        // can't invent new message kinds.
        String rawType = payload.get("type");
        String type = "STICKER".equalsIgnoreCase(rawType) ? "STICKER"
                : "LISTING".equalsIgnoreCase(rawType) ? "LISTING"
                : "POST".equalsIgnoreCase(rawType) ? "POST"
                : "STORY".equalsIgnoreCase(rawType) ? "STORY"
                : "OFFER".equalsIgnoreCase(rawType) ? "OFFER" : "TEXT";
        boolean isListingShare = "LISTING".equals(type);
        boolean isPostShare = "POST".equals(type);
        boolean isStoryShare = "STORY".equals(type);
        boolean isOffer = "OFFER".equals(type);

        String content = payload.get("content");
        String listingId = payload.get("listingId");
        String postId = payload.get("postId");
        String storyId = payload.get("storyId");
        String offerBookingId = payload.get("bookingId");
        if (isListingShare) {
            // A shared listing IS the content — the card renders from the snapshot fields
            // below, so a text caption is optional. Only the listing reference is required.
            if (listingId == null || listingId.isBlank()) return ResponseEntity.badRequest().build();
            if (content == null) content = "";
        } else if (isPostShare) {
            if (postId == null || postId.isBlank()) return ResponseEntity.badRequest().build();
            if (content == null) content = "";
        } else if (isStoryShare) {
            if (storyId == null || storyId.isBlank()) return ResponseEntity.badRequest().build();
            if (content == null) content = "";
        } else if (isOffer) {
            // The card fetches live price/status by booking id — see the entity Javadoc
            // on offerBookingId for why nothing else is snapshotted here.
            if (offerBookingId == null || offerBookingId.isBlank()) return ResponseEntity.badRequest().build();
            if (content == null) content = "";
        } else if (content == null || content.trim().isEmpty()) {
            // TEXT/STICKER still require real content.
            return ResponseEntity.badRequest().build();
        }

        String currentUserId = getCurrentUserId();
        if (currentUserId == null) return ResponseEntity.status(401).build();

        // Use the Lombok @Builder pattern to construct the entity.
        // createdAt is set automatically by @CreationTimestamp on the entity.
        DirectMessage.DirectMessageBuilder builder = DirectMessage.builder()
                .senderId(currentUserId)
                .receiverId(partnerId)
                .content(content)
                .messageType(type);

        if (isListingShare) {
            builder.sharedListingId(listingId)
                    .sharedListingTitle(payload.get("listingTitle"))
                    .sharedListingCurrency(payload.getOrDefault("listingCurrency", "PLN"))
                    .sharedListingImage(payload.get("listingImage"));
            String priceStr = payload.get("listingPrice");
            if (priceStr != null && !priceStr.isBlank()) {
                try { builder.sharedListingPrice(new BigDecimal(priceStr)); } catch (NumberFormatException ignored) {}
            }
        } else if (isPostShare) {
            builder.sharedPostId(postId)
                    .sharedPostContent(payload.get("postContent"))
                    .sharedPostImage(payload.get("postImage"))
                    .sharedPostAuthorName(payload.get("postAuthorName"))
                    .sharedPostAuthorAvatar(payload.get("postAuthorAvatar"))
                    .sharedPostAuthorId(payload.get("postAuthorId"));
        } else if (isStoryShare) {
            builder.sharedStoryId(storyId)
                    .sharedStoryImage(payload.get("storyImage"))
                    .sharedStoryType(payload.get("storyType"))
                    .sharedStoryAuthorName(payload.get("storyAuthorName"))
                    .sharedStoryAuthorId(payload.get("storyAuthorId"));
        } else if (isOffer) {
            builder.offerBookingId(offerBookingId);
        }

        // Persist the message. save() issues an INSERT and returns the managed
        // entity (with the generated id and createdAt populated).
        DirectMessage saved = dmRepo.save(builder.build());

        // Every message — text, sticker, or a shared listing — counts toward the pair's
        // daily streak (see updateStreak's Javadoc for the exact rule).
        try {
            updateStreak(currentUserId, partnerId);
        } catch (Exception ignored) {
            // Never let a streak bug block message delivery.
        }

        // Create an in-app notification for the recipient so they see a badge
        // even if they are not currently viewing the DM screen.
        try {
            // Resolve the sender's display name for the notification title.
            String senderName = userRepo.findById(UUID.fromString(currentUserId))
                    .map(u -> u.displayName())
                    .orElse("Someone"); // fallback if the user record is missing

            String preview;
            if (isListingShare) {
                preview = "🛍️ Shared a listing" + (saved.getSharedListingTitle() != null ? ": " + saved.getSharedListingTitle() : "");
            } else if (isPostShare) {
                preview = "📤 Shared a post";
            } else if (isStoryShare) {
                preview = "✨ Shared a story";
            } else if (isOffer) {
                preview = "💰 Sent a price offer";
            } else {
                // Truncate the message preview to 60 characters to avoid long
                // notification text in the UI.
                preview = content.length() > 60 ? content.substring(0, 60) + "…" : content;
            }

            notificationRepo.save(Notification.builder()
                    .userId(UUID.fromString(partnerId))          // recipient's UUID
                    .title("New message from " + senderName)
                    .message(preview)
                    .notificationType("DIRECT_MESSAGE")          // type discriminator for the UI
                    .referenceId(UUID.fromString(currentUserId)) // sender's UUID for deep-linking
                    .build());

            userRepo.findById(UUID.fromString(partnerId))
                    .ifPresent(u -> expoPushService.send(u.getPushToken(), "New message from " + senderName, preview));
        } catch (Exception ignored) {
            // Notification creation is best-effort.  If partnerId is not a valid
            // UUID, or the notification repo throws, we still return the saved
            // message successfully.  Logging this exception would be advisable
            // in a production system.
        }

        return ResponseEntity.ok(saved);
    }

    /**
     * Sends an image message. Accepts multipart form data with the photo under
     * {@code image} and an optional text {@code caption}. The file is persisted via
     * {@link FileStorageService} (local ./uploads or S3) and the message is stored
     * with {@code messageType = IMAGE} and {@code mediaUrl} pointing at it.
     *
     * <pre>
     * HTTP Method : POST (multipart/form-data)
     * Path        : /api/v1/direct-messages/{partnerId}/media
     * Parts       : image  – required, must have an image/* content type
     *               caption – optional text shown under the photo
     * Response    : 200 OK – the persisted {@link DirectMessage}
     *               400 Bad Request – missing file or non-image content type
     *               401 Unauthorized – if not authenticated
     * </pre>
     */
    @PostMapping("/{partnerId}/media")
    public ResponseEntity<?> sendImageMessage(
            @PathVariable String partnerId,
            @RequestParam("image") MultipartFile image,
            @RequestParam(value = "caption", required = false) String caption) {

        if (image == null || image.isEmpty()) return ResponseEntity.badRequest().body(Map.of("error", "No image provided"));
        String contentType = image.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            return ResponseEntity.badRequest().body(Map.of("error", "Only image uploads are allowed"));
        }

        String currentUserId = getCurrentUserId();
        if (currentUserId == null) return ResponseEntity.status(401).build();

        String mediaUrl = fileStorageService.store(image);

        DirectMessage saved = dmRepo.save(DirectMessage.builder()
                .senderId(currentUserId)
                .receiverId(partnerId)
                .content(caption != null ? caption.trim() : "")
                .messageType("IMAGE")
                .mediaUrl(mediaUrl)
                .build());

        try {
            updateStreak(currentUserId, partnerId);
        } catch (Exception ignored) {
        }

        // Best-effort notification, mirroring the text-message flow.
        try {
            String senderName = userRepo.findById(UUID.fromString(currentUserId))
                    .map(u -> u.displayName())
                    .orElse("Someone");
            notificationRepo.save(Notification.builder()
                    .userId(UUID.fromString(partnerId))
                    .title("New message from " + senderName)
                    .message("📷 Photo")
                    .notificationType("DIRECT_MESSAGE")
                    .referenceId(UUID.fromString(currentUserId))
                    .build());

            userRepo.findById(UUID.fromString(partnerId))
                    .ifPresent(u -> expoPushService.send(u.getPushToken(), "New message from " + senderName, "📷 Photo"));
        } catch (Exception ignored) {
        }

        return ResponseEntity.ok(saved);
    }
}
