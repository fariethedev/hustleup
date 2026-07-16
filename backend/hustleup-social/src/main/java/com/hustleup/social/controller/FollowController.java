/**
 * REST controller for managing follow relationships between HustleUp users.
 *
 * <p>A "follow" is a directed relationship: user A can follow user B without B
 * following A back (similar to Twitter/Instagram, not Facebook friends).
 * This asymmetry is modelled by two separate UUID columns in the {@code follows} table:
 * {@code follower_id} (the person who clicked "follow") and {@code following_id}
 * (the person being followed).
 *
 * <h2>Base path</h2>
 * {@code /api/v1/follows}
 *
 * <h2>Authentication</h2>
 * All endpoints require an authenticated user. The current user's identity is derived
 * from the Spring Security context (set by the JWT filter in the common library).
 *
 * <h2>Notifications</h2>
 * When a user follows someone, an in-app notification is persisted for the followed
 * user so they see "X started following you" in their notification centre.
 */
package com.hustleup.social.controller;

import com.hustleup.common.model.User;
import com.hustleup.common.model.Notification;
import com.hustleup.common.repository.UserRepository;
import com.hustleup.common.repository.NotificationRepository;
import com.hustleup.social.model.Follow;
import com.hustleup.social.model.UserBlock;
import com.hustleup.social.model.UserReport;
import com.hustleup.social.repository.FollowRepository;
import com.hustleup.social.repository.UserBlockRepository;
import com.hustleup.social.repository.UserReportRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

// @RestController: combines @Controller + @ResponseBody — all return values are JSON.
@RestController

// All endpoints share the /api/v1/follows prefix.
@RequestMapping("/api/v1/follows")
public class FollowController {

    // ── Dependencies ──────────────────────────────────────────────────────────

    /** JPA repository for Follow entities; provides follow/unfollow CRUD and count queries. */
    private final FollowRepository followRepository;

    /** Used to look up User records by email (from JWT) or by UUID (for profile enrichment). */
    private final UserRepository userRepository;

    /** Used to persist in-app notifications when a user is followed. */
    private final NotificationRepository notificationRepository;

    /**
     * Constructor injection: Spring will automatically provide all three beans.
     * Constructor injection is preferred because it makes the required dependencies
     * explicit and allows the class fields to be {@code final}.
     */
    /** Repositories backing the block/report safety features. */
    private final UserBlockRepository userBlockRepository;
    private final UserReportRepository userReportRepository;

    public FollowController(FollowRepository followRepository, UserRepository userRepository,
                            NotificationRepository notificationRepository,
                            UserBlockRepository userBlockRepository,
                            UserReportRepository userReportRepository) {
        this.followRepository = followRepository;
        this.userRepository = userRepository;
        this.notificationRepository = notificationRepository;
        this.userBlockRepository = userBlockRepository;
        this.userReportRepository = userReportRepository;
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /**
     * Resolves the UUID of the currently authenticated user from the Spring Security context.
     *
     * <p>The security context is populated by a JWT authentication filter (in the common
     * library) which sets the principal name to the user's email address.  We then look
     * up the User entity to get the UUID primary key.
     *
     * @return the UUID of the authenticated user
     * @throws NoSuchElementException if the email is not found in the database
     */
    private UUID currentUserId() {
        // getName() returns the email address stored as the JWT subject.
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email).map(User::getId).orElseThrow();
    }

    /**
     * Converts a {@link User} entity into a plain {@link Map} safe for JSON serialisation.
     *
     * <p>We avoid returning the raw User entity to the client because:
     * <ul>
     *   <li>The User entity may contain sensitive fields (hashed password, tokens).</li>
     *   <li>We want to attach computed fields (e.g. {@code isFollowing}) that do not
     *       belong on the entity itself.</li>
     * </ul>
     *
     * @param u           the User entity to convert
     * @param isFollowing whether the current viewer follows this user
     * @return a map suitable for serialisation as JSON
     */
    private Map<String, Object> userToMap(User u, boolean isFollowing) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", u.getId());                             // UUID primary key
        m.put("fullName", u.getFullName());                 // display name
        m.put("username", u.getEmail().split("@")[0]);      // derive username from email prefix
        m.put("avatarUrl", u.getAvatarUrl());               // profile picture URL
        m.put("bio", u.getBio());                           // short biography
        m.put("city", u.getCity());                         // location
        m.put("role", u.getRole() != null ? u.getRole().name() : "BUYER"); // BUYER / SELLER / ADMIN
        m.put("isFollowing", isFollowing);                  // computed field: does current user follow this person?
        return m;
    }

    // ── Endpoints ─────────────────────────────────────────────────────────────

    /**
     * Returns the list of users who follow the currently authenticated user ("my followers").
     *
     * <p><b>GET /api/v1/follows/followers</b>
     *
     * <p>Each result entry includes an {@code isFollowing} flag indicating whether the
     * current user also follows that person back (mutual follow detection).
     *
     * @return 200 OK with a JSON array of user maps, each with an {@code isFollowing} flag
     */
    // Existing Javadoc comment preserved — annotation below routes GET requests here
    @GetMapping("/followers")
    public ResponseEntity<?> getMyFollowers() {
        UUID me = currentUserId();
        // Find all Follow records where following_id == me (i.e., people following me).
        List<Follow> follows = followRepository.findByFollowingId(me);
        // Build the set of UUIDs that I follow — used to set the isFollowing flag.
        Set<UUID> iFollow = followRepository.findByFollowerId(me)
                .stream().map(Follow::getFollowingId).collect(Collectors.toSet());
        List<Map<String, Object>> result = follows.stream().map(f -> {
            // Enrich each Follow record with the full User profile.
            return userRepository.findById(f.getFollowerId())
                    .map(u -> userToMap(u, iFollow.contains(f.getFollowerId())))
                    .orElse(null); // skip if user was deleted
        }).filter(Objects::nonNull).collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    /**
     * Returns the list of users that the currently authenticated user follows ("my following").
     *
     * <p><b>GET /api/v1/follows/following</b>
     *
     * <p>Every user in this list is by definition followed by the current user,
     * so {@code isFollowing} is always {@code true}.
     *
     * @return 200 OK with a JSON array of user maps
     */
    @GetMapping("/following")
    public ResponseEntity<?> getMyFollowing() {
        UUID me = currentUserId();
        // Find all Follow records where follower_id == me (people I follow).
        List<Follow> follows = followRepository.findByFollowerId(me);
        List<Map<String, Object>> result = follows.stream().map(f -> {
            return userRepository.findById(f.getFollowingId())
                    .map(u -> userToMap(u, true)) // always true — we are following them
                    .orElse(null);
        }).filter(Objects::nonNull).collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    /**
     * Follows a target user.
     *
     * <p><b>POST /api/v1/follows/{targetId}</b>
     *
     * <p>Guards:
     * <ul>
     *   <li>Cannot follow yourself — returns 400.</li>
     *   <li>Idempotent — if already following, returns {@code "already_following"} without
     *       creating a duplicate row.</li>
     * </ul>
     *
     * <p>Side effect: creates an in-app notification for the followed user.
     * Notification failure is silently ignored so it cannot break the follow action.
     *
     * @param targetId the UUID string of the user to follow
     * @return 200 OK with {@code {"status": "following"}} or {@code {"status": "already_following"}}
     */
    @PostMapping("/{targetId}")
    public ResponseEntity<?> follow(@PathVariable String targetId) {
        UUID me = currentUserId();
        UUID target = UUID.fromString(targetId);
        // Prevent self-follow — meaningless and would pollute the social graph.
        if (me.equals(target)) return ResponseEntity.badRequest().body("Cannot follow yourself");
        // Idempotency check — don't create a duplicate row.
        if (followRepository.existsByFollowerIdAndFollowingId(me, target)) {
            return ResponseEntity.ok(Map.of("status", "already_following"));
        }
        // Create the Follow record.
        Follow f = new Follow();
        f.setFollowerId(me);
        f.setFollowingId(target);
        followRepository.save(f);

        // Send in-app notification to the person just followed.
        try {
            User meUser = userRepository.findById(me).orElse(null);
            if (meUser != null) {
                // Use full name if available; otherwise derive a display name from the email.
                String followerName = meUser.getFullName() != null && !meUser.getFullName().isBlank()
                        ? meUser.getFullName() : meUser.getEmail().split("@")[0];
                notificationRepository.save(Notification.builder()
                        .userId(target)                         // recipient is the person being followed
                        .title("New follower")
                        .message(followerName + " started following you")
                        .notificationType("FOLLOW")
                        .referenceId(me)                        // link back to the follower's profile
                        .build());
            }
        } catch (Exception ignored) {} // notification failure must not break the follow

        return ResponseEntity.ok(Map.of("status", "following"));
    }

    /**
     * Unfollows a target user.
     *
     * <p><b>DELETE /api/v1/follows/{targetId}</b>
     *
     * <p>Idempotent: if the current user is not following the target, this is a no-op.
     *
     * @param targetId the UUID string of the user to unfollow
     * @return 200 OK with {@code {"status": "unfollowed"}}
     */
    @DeleteMapping("/{targetId}")
    public ResponseEntity<?> unfollow(@PathVariable String targetId) {
        UUID me = currentUserId();
        UUID target = UUID.fromString(targetId);
        // findByFollowerIdAndFollowingId returns Optional<Follow> — delete only if present.
        followRepository.findByFollowerIdAndFollowingId(me, target)
                .ifPresent(followRepository::delete);
        return ResponseEntity.ok(Map.of("status", "unfollowed"));
    }

    /**
     * Returns the follower and following counts for any user (not just the current user).
     *
     * <p><b>GET /api/v1/follows/{userId}/counts</b>
     *
     * <p>Useful for populating profile headers that display "X followers · Y following".
     *
     * @param userId the UUID string of the user whose counts to retrieve
     * @return 200 OK with {@code {"followers": N, "following": M}}
     */
    @GetMapping("/{userId}/counts")
    public ResponseEntity<?> counts(@PathVariable String userId) {
        UUID uid = UUID.fromString(userId);
        return ResponseEntity.ok(Map.of(
            "followers", followRepository.countByFollowingId(uid), // how many people follow uid
            "following", followRepository.countByFollowerId(uid)   // how many people uid follows
        ));
    }

    /**
     * Checks whether the currently authenticated user follows a specific user.
     *
     * <p><b>GET /api/v1/follows/{userId}/is-following</b>
     *
     * <p>Used by profile pages to toggle the Follow/Unfollow button state.
     *
     * @param userId the UUID string of the user to check
     * @return 200 OK with {@code {"isFollowing": true|false}}
     */
    @GetMapping("/{userId}/is-following")
    public ResponseEntity<?> isFollowing(@PathVariable String userId) {
        UUID me = currentUserId();
        UUID target = UUID.fromString(userId);
        boolean following = followRepository.existsByFollowerIdAndFollowingId(me, target);
        return ResponseEntity.ok(Map.of("isFollowing", following));
    }

    /**
     * One-shot profile relationship summary: everything the profile header needs
     * to render its social state in a single request.
     *
     * <p><b>GET /api/v1/follows/{userId}/relationship</b>
     *
     * <p>Works for anonymous viewers too — the viewer-specific flags simply come
     * back {@code false} when there is no authenticated user.
     *
     * @return 200 OK with {@code {followers, following, isFollowing, blocked, blockedBy}}
     */
    @GetMapping("/{userId}/relationship")
    public ResponseEntity<?> relationship(@PathVariable String userId) {
        UUID target = UUID.fromString(userId);

        boolean isFollowing = false;
        boolean blocked = false;   // viewer has blocked the target
        boolean blockedBy = false; // target has blocked the viewer
        try {
            UUID me = currentUserId();
            isFollowing = followRepository.existsByFollowerIdAndFollowingId(me, target);
            blocked = userBlockRepository.existsByBlockerIdAndBlockedId(me, target);
            blockedBy = userBlockRepository.existsByBlockerIdAndBlockedId(target, me);
        } catch (Exception ignored) {
            // Anonymous viewer — viewer-specific flags stay false.
        }

        Map<String, Object> out = new HashMap<>();
        out.put("followers", followRepository.countByFollowingId(target));
        out.put("following", followRepository.countByFollowerId(target));
        out.put("isFollowing", isFollowing);
        out.put("blocked", blocked);
        out.put("blockedBy", blockedBy);
        return ResponseEntity.ok(out);
    }

    /**
     * Blocks a user. Also severs any follow relationship in both directions so
     * neither party remains in the other's follower lists.
     *
     * <p><b>POST /api/v1/follows/{targetId}/block</b> — auth required.
     */
    @PostMapping("/{targetId}/block")
    public ResponseEntity<?> block(@PathVariable String targetId) {
        UUID me = currentUserId();
        UUID target = UUID.fromString(targetId);
        if (me.equals(target)) {
            return ResponseEntity.badRequest().body(Map.of("error", "You cannot block yourself"));
        }

        if (!userBlockRepository.existsByBlockerIdAndBlockedId(me, target)) {
            UserBlock blockRecord = new UserBlock();
            blockRecord.setBlockerId(me);
            blockRecord.setBlockedId(target);
            userBlockRepository.save(blockRecord);
        }

        // Remove follow edges in both directions.
        followRepository.findByFollowerIdAndFollowingId(me, target).ifPresent(followRepository::delete);
        followRepository.findByFollowerIdAndFollowingId(target, me).ifPresent(followRepository::delete);

        return ResponseEntity.ok(Map.of("status", "blocked"));
    }

    /**
     * Removes a previously placed block.
     *
     * <p><b>DELETE /api/v1/follows/{targetId}/block</b> — auth required. Idempotent.
     */
    @DeleteMapping("/{targetId}/block")
    public ResponseEntity<?> unblock(@PathVariable String targetId) {
        UUID me = currentUserId();
        UUID target = UUID.fromString(targetId);
        userBlockRepository.findByBlockerIdAndBlockedId(me, target).ifPresent(userBlockRepository::delete);
        return ResponseEntity.ok(Map.of("status", "unblocked"));
    }

    /**
     * Files a safety report against a user for moderation review.
     *
     * <p><b>POST /api/v1/follows/{targetId}/report</b> — auth required.
     * Body: {@code {"reason": "free text"}}
     */
    @PostMapping("/{targetId}/report")
    public ResponseEntity<?> report(@PathVariable String targetId, @RequestBody(required = false) Map<String, String> payload) {
        UUID me = currentUserId();
        UUID target = UUID.fromString(targetId);
        if (me.equals(target)) {
            return ResponseEntity.badRequest().body(Map.of("error", "You cannot report yourself"));
        }

        UserReport reportRecord = new UserReport();
        reportRecord.setReporterId(me);
        reportRecord.setReportedId(target);
        reportRecord.setReason(payload != null ? payload.getOrDefault("reason", "") : "");
        userReportRepository.save(reportRecord);

        return ResponseEntity.ok(Map.of("status", "reported"));
    }
}
