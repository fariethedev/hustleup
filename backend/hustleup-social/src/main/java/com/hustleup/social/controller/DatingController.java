/**
 * REST controller for the HustleUp Dating / Networking feature.
 *
 * <p>This controller surfaces a Tinder-style "swipe" UI where users can discover
 * other HustleUp members for networking or dating, view profiles, and express
 * interest (like) or disinterest (pass).
 *
 * <h2>Design decision: profiles backed by the Users table</h2>
 * Rather than requiring every user to create a separate dating profile, this controller
 * synthesises a discoverable card for every registered user by combining their main
 * {@link com.hustleup.common.model.User} record with an optional {@link DatingProfile}
 * record.  Users who have filled in the dating profile form get a richer card; everyone
 * else gets sensible defaults derived from their main account.
 *
 * <h2>Base path</h2>
 * {@code /api/v1/dating}
 *
 * <h2>Authentication</h2>
 * Profile browsing is available anonymously (degrades gracefully if no auth token is sent).
 * Profile creation/update and like/pass actions require authentication.
 *
 * <h2>Swipes</h2>
 * Every swipe is persisted, which is what lets discovery skip people you have already seen,
 * detect a mutual like as a match, and undo the last one via {@code /rewind}.  A right swipe
 * comes in two strengths: an ordinary like, which stays private until it turns out to be
 * mutual, and a super like, which notifies the recipient immediately.
 */
package com.hustleup.social.controller;

import com.hustleup.common.model.Match;
import com.hustleup.common.model.Notification;
import com.hustleup.common.model.User;
import com.hustleup.common.repository.MatchRepository;
import com.hustleup.common.repository.NotificationRepository;
import com.hustleup.common.repository.UserRepository;
import com.hustleup.social.model.DatingProfile;
import com.hustleup.social.model.DatingSwipe;
import com.hustleup.social.repository.DatingProfileRepository;
import com.hustleup.social.repository.DatingSwipeRepository;
import com.hustleup.common.storage.FileStorageService;
import com.hustleup.common.subscription.PremiumAccess;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.*;
import java.util.stream.Collectors;

// @RestController: Spring will serialise every return value to JSON automatically.
@RestController

// All endpoints share the /api/v1/dating prefix.
@RequestMapping("/api/v1/dating")
public class DatingController {

    // ── Dependencies ──────────────────────────────────────────────────────────

    /** JPA repository for DatingProfile entities; one row per user (optional). */
    private final DatingProfileRepository datingRepo;

    /** Used to enumerate all users as potential discovery candidates and to load the
     *  current user from the JWT principal. */
    private final UserRepository userRepo;

    /** Handles profile image uploads to the configured storage backend. */
    private final FileStorageService storageService;

    /** Persists like/pass swipes so discovery never re-shows an already-swiped profile. */
    private final DatingSwipeRepository swipeRepo;

    /** Used to notify both users when a swipe results in a mutual like ("match"). */
    private final NotificationRepository notificationRepo;

    /**
     * Persists mutual matches so other services (direct messaging) can tag a conversation
     * as having started from a Bond match — see {@link com.hustleup.common.model.Match}.
     */
    private final MatchRepository matchRepo;

    /**
     * Decides whether the caller holds Premium. Bond is a paid feature, and until now that
     * was decided only in {@code Dating.jsx} — the endpoints below were open to any
     * authenticated account, so the entire feature was available by calling the API
     * directly. See {@link #requirePremium()}.
     */
    private final PremiumAccess premiumAccess;

    public DatingController(DatingProfileRepository datingRepo, UserRepository userRepo,
                            FileStorageService storageService, DatingSwipeRepository swipeRepo,
                            NotificationRepository notificationRepo, MatchRepository matchRepo,
                            PremiumAccess premiumAccess) {
        this.datingRepo = datingRepo;
        this.userRepo = userRepo;
        this.storageService = storageService;
        this.swipeRepo = swipeRepo;
        this.notificationRepo = notificationRepo;
        this.matchRepo = matchRepo;
        this.premiumAccess = premiumAccess;
    }

    /**
     * Refuses the request unless the caller holds an active Premium plan.
     *
     * <p>Returns the same {@code 403 / code: PREMIUM_REQUIRED} shape the feed uses for
     * anonymous posting, so {@code isPremiumRequiredError} in the frontend already
     * recognises it and can show the upgrade prompt rather than a generic failure.
     *
     * @return the refusal to return, or {@code null} when the caller may proceed
     */
    private ResponseEntity<?> requirePremium() {
        User current = getCurrentUser();
        if (current != null && premiumAccess.isPremium(current.getId())) return null;
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                "error", "Bond is a Premium feature",
                "code", "PREMIUM_REQUIRED",
                "feature", "DATING"));
    }

    // ── Constants ─────────────────────────────────────────────────────────────

    /**
     * The swipe actions that count as interest. A super like is stored under its own action
     * so it can be presented differently, but everywhere the app asks "did they like me?"
     * both actions must answer yes.
     */
    private static final List<String> LIKE_ACTIONS = List.of("LIKE", "SUPER_LIKE");

    // ── Private helpers ───────────────────────────────────────────────────────

    /**
     * Returns the currently authenticated {@link User}, or {@code null} if the request
     * is anonymous or if authentication cannot be resolved.
     *
     * <p>Unlike {@code requireCurrentUser()} in FeedController, this method returns
     * {@code null} instead of throwing, because several dating endpoints gracefully
     * degrade when the user is not logged in.
     *
     * @return the authenticated User entity, or {@code null}
     */
    private User getCurrentUser() {
        org.springframework.security.core.Authentication auth =
                SecurityContextHolder.getContext().getAuthentication();
        // AnonymousAuthenticationToken marks unauthenticated requests in Spring Security.
        if (auth == null || !auth.isAuthenticated()
                || auth instanceof org.springframework.security.authentication.AnonymousAuthenticationToken) {
            return null;
        }
        // getName() returns the email stored as the JWT subject.
        return userRepo.findByEmail(auth.getName()).orElse(null);
    }

    /**
     * Builds the discovery card for a user: their {@link DatingProfile} when they have filled
     * one in, otherwise a card synthesised from their main account so that members who never
     * opened the Bond form are still discoverable.
     *
     * @param u  the account being turned into a card
     * @param dp that account's dating profile, or {@code null} if they have none
     */
    private static DatingProfile toProfile(User u, DatingProfile dp) {
        if (dp != null) return dp; // user has a rich profile — use it
        return DatingProfile.builder()
                .id(u.getId())
                .fullName(u.getFullName())
                .bio(u.getBio() != null ? u.getBio() : "Just a hustler on the grind.")
                .location(u.getCity() != null ? u.getCity() : "")
                .imageUrl(u.getAvatarUrl())
                .lookingFor("Networking") // sensible default
                .age(0)                   // unknown — profile not filled in
                .build();
    }

    /**
     * Whether a candidate belongs in the viewer's deck, given the viewer's "Show me" preference.
     *
     * <p>An explicit {@code "Men"}/{@code "Women"} preference is taken literally: only profiles
     * with that gender are shown, and profiles with no stated gender are held back rather than
     * guessed at. With no preference saved the deck falls back to the opposite of the viewer's
     * own gender — but still includes members who never stated one, because most accounts have
     * no Bond profile at all and excluding them would leave the deck empty.
     *
     * @param showMe          the viewer's preference: "Everyone", "Men", "Women", or null
     * @param viewerGender    the viewer's own gender, used only for the no-preference fallback
     * @param candidateGender the gender on the card being considered; may be null
     */
    private static boolean isDiscoverable(String showMe, String viewerGender, String candidateGender) {
        if ("Men".equalsIgnoreCase(showMe))   return "Male".equalsIgnoreCase(candidateGender);
        if ("Women".equalsIgnoreCase(showMe)) return "Female".equalsIgnoreCase(candidateGender);
        if (showMe != null && !showMe.isBlank()) return true; // "Everyone" — no filtering at all

        if (candidateGender == null || candidateGender.isBlank()) return true;
        if ("Male".equalsIgnoreCase(viewerGender))   return "Female".equalsIgnoreCase(candidateGender);
        if ("Female".equalsIgnoreCase(viewerGender)) return "Male".equalsIgnoreCase(candidateGender);
        return true; // viewer's gender is unset or non-binary — show them everyone
    }

    // ── Endpoints ─────────────────────────────────────────────────────────────

    /**
     * Returns the full list of discoverable user profiles, excluding the current user.
     *
     * <p><b>GET /api/v1/dating/profiles</b>
     *
     * <p>Algorithm:
     * <ol>
     *   <li>Load all {@link DatingProfile} rows into a map keyed by user UUID.</li>
     *   <li>Iterate over every registered User.</li>
     *   <li>If a DatingProfile exists for that user, return it as-is.</li>
     *   <li>Otherwise, synthesise a minimal profile from the User's main account data.</li>
     *   <li>The current user is filtered out of the list (you shouldn't swipe on yourself).</li>
     * </ol>
     *
     * <p>On error, returns an empty list rather than a 500, to avoid breaking the UI.
     *
     * @return 200 OK with a JSON array of {@link DatingProfile} objects
     */
    @GetMapping("/profiles")
    public ResponseEntity<?> getProfiles() {
        // Bond is Premium-only. Enforced here, not just in the browser.
        ResponseEntity<?> denied = requirePremium();
        if (denied != null) return denied;
        try {
            // Build a lookup map: userId → DatingProfile (for O(1) lookup per user below)
            Map<UUID, DatingProfile> profileMap = datingRepo.findAll().stream()
                    .collect(Collectors.toMap(DatingProfile::getId, p -> p));

            // Who is allowed to appear in the deck at all.
            //
            // The deck is built from userRepo.findAll(), so before this every registered
            // account was a candidate — including people who never opened Bond and, more to
            // the point, free accounts that filled in a profile and then sat in every paying
            // member's stack collecting likes without subscribing. Being discovered is the
            // part that is paid for.
            //
            // One read of the (small) subscriptions table, rather than a premium lookup per
            // candidate or every user id sent back as an IN clause.
            Set<UUID> paying = premiumAccess.allPremiumUserIds();

            // Try to get the current user's ID so we can exclude them from results.
            UUID currentId = null;
            try {
                User current = getCurrentUser();
                if (current != null) currentId = current.getId();
            } catch (Exception ignored) {}

            final UUID finalCurrentId = currentId; // must be effectively-final for lambda

            // Profiles already liked or passed on should never reappear in discovery —
            // previously nothing was persisted here, so every reload reset the whole stack.
            final Set<UUID> swiped = finalCurrentId == null
                    ? Set.of()
                    : swipeRepo.findBySwiperId(finalCurrentId).stream()
                        .map(DatingSwipe::getTargetId)
                        .collect(Collectors.toSet());

            // Everyone who already liked the viewer. Their cards get badged "likes you", which
            // is the whole reason to keep swiping — a right swipe on one is an instant match.
            final Set<UUID> admirers = finalCurrentId == null
                    ? Set.of()
                    : swipeRepo.findByTargetIdAndActionIn(finalCurrentId, LIKE_ACTIONS).stream()
                        .map(DatingSwipe::getSwiperId)
                        .collect(Collectors.toSet());

            // The viewer's own profile drives who they see — see isDiscoverable().
            DatingProfile viewer = finalCurrentId == null ? null : profileMap.get(finalCurrentId);
            final String showMe = viewer == null ? null : viewer.getShowMe();
            final String viewerGender = viewer == null ? null : viewer.getGender();

            // Return all users as discoverable profiles, enriched with dating profile if they have one.
            List<DatingProfile> result = userRepo.findAll().stream()
                    // Paying members only — see `paying` above.
                    .filter(u -> paying.contains(u.getId()))
                    // Filter out the current user and anyone already swiped on.
                    .filter(u -> finalCurrentId == null || !u.getId().equals(finalCurrentId))
                    .filter(u -> !swiped.contains(u.getId()))
                    .map(u -> toProfile(u, profileMap.get(u.getId())))
                    .filter(p -> isDiscoverable(showMe, viewerGender, p.getGender()))
                    .map(p -> { p.setLikedYou(admirers.contains(p.getId())); return p; })
                    // People who already liked the viewer go to the top of the deck: the first
                    // swipe of a session is then the one most likely to produce a match.
                    .sorted(Comparator.comparing((DatingProfile p) -> !Boolean.TRUE.equals(p.getLikedYou())))
                    .collect(Collectors.toList());

            return ResponseEntity.ok(result);
        } catch (Exception e) {
            // Return empty list on error so the UI renders a "no profiles" state.
            return ResponseEntity.ok(List.of());
        }
    }

    /**
     * Returns the dating profile for the currently authenticated user.
     *
     * <p><b>GET /api/v1/dating/profile/me</b>
     *
     * <p>Auth: required (returns 401 if not authenticated).
     *
     * <p>If the user has not yet created a profile, returns {@code null} in the response
     * body, allowing the client to detect the "first-time setup" state.
     *
     * @return 200 OK with the user's {@link DatingProfile}, or {@code null} if not set up yet;
     *         401 if not authenticated
     */
    @GetMapping("/profile/me")
    public ResponseEntity<?> getMyProfile() {
        User user = getCurrentUser();
        if (user == null) return ResponseEntity.status(401).build(); // explicit 401 for unauthenticated
        // findById returns Optional — orElse(null) gives the client a null body when absent.
        Optional<DatingProfile> profile = datingRepo.findById(user.getId());
        return ResponseEntity.ok(profile.orElse(null));
    }

    /**
     * Creates or updates the dating profile for the currently authenticated user.
     *
     * <p><b>POST /api/v1/dating/profile</b> (multipart/form-data)
     *
     * <p>All parameters are optional — only fields that are provided will be updated.
     * This allows the client to send partial updates without overwriting existing data.
     *
     * <p>The profile's {@code id} is always the same as the user's account UUID (one-to-one
     * relationship), so this endpoint upserts (create if not exists, update if exists).
     *
     * <p>Auth: required.
     *
     * @param bio        short personal description
     * @param age        the user's age
     * @param location   city or region
     * @param lookingFor what the user is looking for (e.g. "Networking", "Dating")
     * @param interests  comma-separated list of interests
     * @param gender     self-identified gender
     * @param showMe     who to surface in this user's deck: "Everyone", "Men", or "Women"
     * @param image      optional profile photo; if omitted, falls back to the main account avatar
     * @return 200 OK with the saved {@link DatingProfile};
     *         401 if not authenticated
     */
    @PostMapping("/profile")
    public ResponseEntity<?> saveProfile(
            @RequestParam(value = "bio", required = false) String bio,
            @RequestParam(value = "age", required = false) Integer age,
            @RequestParam(value = "location", required = false) String location,
            @RequestParam(value = "lookingFor", required = false) String lookingFor,
            @RequestParam(value = "interests", required = false) String interests,
            @RequestParam(value = "gender", required = false) String gender,
            @RequestParam(value = "showMe", required = false) String showMe,
            @RequestParam(value = "image", required = false) MultipartFile image) {

        User user = getCurrentUser();
        if (user == null) return ResponseEntity.status(401).build();

        // Load existing profile or create a new one with the user's UUID as primary key.
        DatingProfile profile = datingRepo.findById(user.getId())
                .orElse(DatingProfile.builder().id(user.getId()).build());

        // Always sync the display name from the main account (source of truth).
        profile.setFullName(user.getFullName());

        // Only update fields that were explicitly provided in the request.
        if (bio != null) profile.setBio(bio);
        if (age != null) profile.setAge(age);
        if (location != null) profile.setLocation(location);
        if (lookingFor != null) profile.setLookingFor(lookingFor);
        if (interests != null) profile.setInterests(interests);
        if (gender != null) profile.setGender(gender);
        if (showMe != null) profile.setShowMe(showMe);

        if (image != null && !image.isEmpty()) {
            // New photo uploaded — store it and save the resulting URL.
            profile.setImageUrl(storageService.store(image));
        } else if (profile.getImageUrl() == null) {
            // No photo yet — fall back to the main account avatar.
            profile.setImageUrl(user.getAvatarUrl());
        }

        DatingProfile saved = datingRepo.save(profile);
        return ResponseEntity.ok(saved);
    }

    /**
     * Upserts a swipe row for (current user → target), setting its action.
     * Re-swiping the same person updates the existing row instead of creating a duplicate.
     */
    private DatingSwipe recordSwipe(UUID swiperId, UUID targetId, String action) {
        DatingSwipe swipe = swipeRepo.findBySwiperIdAndTargetId(swiperId, targetId)
                .orElse(DatingSwipe.builder().swiperId(swiperId).targetId(targetId).build());
        swipe.setAction(action);
        return swipeRepo.save(swipe);
    }

    /**
     * Records a "like" swipe on a profile, and detects a mutual match.
     *
     * <p><b>POST /api/v1/dating/like/{profileId}</b>
     *
     * <p>Auth: required. The swipe is persisted so the profile never resurfaces in
     * discovery again. If the target has already liked the current user back, this is
     * a match — both users get an in-app notification.
     *
     * <p>A super like is the same swipe with more weight behind it: it is recorded under its
     * own action, and — unlike a plain like, which stays silent until it turns out to be
     * mutual — it notifies the recipient straight away, so they can see the interest before
     * deciding. That immediate signal is the entire point of the gesture.
     *
     * @param profileId the UUID of the profile being liked
     * @param superLike true when the swipe was a super like rather than an ordinary like
     * @return 200 OK with {@code {"liked": true, "matched": bool, "profileId": "..."}}
     */
    @PostMapping("/like/{profileId}")
    public ResponseEntity<?> likeProfile(@PathVariable UUID profileId,
                                         @RequestParam(value = "superLike", defaultValue = "false") boolean superLike) {
        // Bond is Premium-only. Enforced here, not just in the browser.
        ResponseEntity<?> denied = requirePremium();
        if (denied != null) return denied;
        User user = getCurrentUser();
        if (user == null) return ResponseEntity.status(401).build();

        recordSwipe(user.getId(), profileId, superLike ? "SUPER_LIKE" : "LIKE");

        // Mutual like check: has the target already liked the current user? A super like from
        // their side counts too, hence the …ActionIn variant.
        boolean matched = swipeRepo.existsBySwiperIdAndTargetIdAndActionIn(profileId, user.getId(), LIKE_ACTIONS);

        if (!matched && superLike) {
            // Tell them now rather than waiting for a match that may never come.
            try {
                notificationRepo.save(Notification.builder()
                        .userId(profileId)
                        .title("Someone super liked you")
                        .message(user.displayName() + " super liked you on Bond")
                        .notificationType("DATING_SUPER_LIKE")
                        .referenceId(user.getId())
                        .build());
            } catch (Exception ignored) {}
        }

        if (matched) {
            // Notification failure must never break the like action itself.
            try {
                User target = userRepo.findById(profileId).orElse(null);
                if (target != null) {
                    // Persist the match itself (idempotent — existsById guards against a
                    // duplicate row if this ever ran twice for the same pair).
                    Match.Pair pair = Match.Pair.of(user.getId(), profileId);
                    if (!matchRepo.existsByUserIdAAndUserIdB(pair.smaller(), pair.larger())) {
                        matchRepo.save(Match.builder().userIdA(pair.smaller()).userIdB(pair.larger()).build());
                    }

                    notificationRepo.save(Notification.builder()
                            .userId(user.getId())
                            .title("It's a match!")
                            .message("You and " + target.displayName() + " liked each other")
                            .notificationType("DATING_MATCH")
                            .referenceId(profileId)
                            .build());
                    notificationRepo.save(Notification.builder()
                            .userId(profileId)
                            .title("It's a match!")
                            .message("You and " + user.displayName() + " liked each other")
                            .notificationType("DATING_MATCH")
                            .referenceId(user.getId())
                            .build());
                }
            } catch (Exception ignored) {}
        }

        return ResponseEntity.ok(Map.of("liked", true, "matched", matched, "profileId", profileId.toString()));
    }

    /**
     * Records a "pass" swipe on a profile.
     *
     * <p><b>POST /api/v1/dating/pass/{profileId}</b>
     *
     * <p>Auth: required. The swipe is persisted so the profile never resurfaces in
     * this user's discovery feed again.
     *
     * @param profileId the UUID of the profile being passed on
     * @return 200 OK with {@code {"passed": true, "profileId": "..."}}
     */
    @PostMapping("/pass/{profileId}")
    public ResponseEntity<?> passProfile(@PathVariable UUID profileId) {
        // Bond is Premium-only. Enforced here, not just in the browser.
        ResponseEntity<?> denied = requirePremium();
        if (denied != null) return denied;
        User user = getCurrentUser();
        if (user == null) return ResponseEntity.status(401).build();
        recordSwipe(user.getId(), profileId, "PASS");
        return ResponseEntity.ok(Map.of("passed", true, "profileId", profileId.toString()));
    }

    /**
     * Undoes the current user's most recent swipe and hands the profile back so the client
     * can push it onto the front of the deck again.
     *
     * <p><b>POST /api/v1/dating/rewind</b>
     *
     * <p>Auth: required. Deleting the swipe row — rather than flipping its action — is what
     * makes the profile discoverable again, since {@link #getProfiles()} excludes anyone with
     * a row of either kind. It also means a re-swipe gets a fresh {@code createdAt}, keeping
     * "most recent swipe" honest for the next rewind.
     *
     * <p>A swipe that produced a match cannot be rewound. The match is already persisted and
     * both people have been notified, so quietly retracting it would leave the other side
     * looking at a conversation whose other half no longer exists.
     *
     * @return 200 OK with {@code {"rewound": true, "profile": {…}}} on success, or
     *         {@code {"rewound": false, "reason": "empty"|"matched"}} when there is nothing
     *         to undo; 401 if not authenticated
     */
    @PostMapping("/rewind")
    public ResponseEntity<?> rewind() {
        // Bond is Premium-only. Enforced here, not just in the browser.
        ResponseEntity<?> denied = requirePremium();
        if (denied != null) return denied;
        User user = getCurrentUser();
        if (user == null) return ResponseEntity.status(401).build();

        Optional<DatingSwipe> lastSwipe = swipeRepo.findFirstBySwiperIdOrderByCreatedAtDesc(user.getId());
        if (lastSwipe.isEmpty()) {
            return ResponseEntity.ok(Map.of("rewound", false, "reason", "empty"));
        }

        DatingSwipe swipe = lastSwipe.get();
        UUID targetId = swipe.getTargetId();

        Match.Pair pair = Match.Pair.of(user.getId(), targetId);
        if (matchRepo.existsByUserIdAAndUserIdB(pair.smaller(), pair.larger())) {
            return ResponseEntity.ok(Map.of("rewound", false, "reason", "matched"));
        }

        swipeRepo.delete(swipe);

        // Hand the card back fully formed so the client can restore it without a full reload.
        User target = userRepo.findById(targetId).orElse(null);
        if (target == null) return ResponseEntity.ok(Map.of("rewound", true));

        DatingProfile profile = toProfile(target, datingRepo.findById(targetId).orElse(null));
        profile.setLikedYou(swipeRepo.existsBySwiperIdAndTargetIdAndActionIn(targetId, user.getId(), LIKE_ACTIONS));
        return ResponseEntity.ok(Map.of("rewound", true, "profile", profile));
    }
}
