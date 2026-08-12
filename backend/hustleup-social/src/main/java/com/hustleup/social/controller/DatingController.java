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
 * <h2>Current limitations</h2>
 * The like/pass endpoints currently return a stub response.  Match detection and mutual
 * like notifications are planned for a future iteration.
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
     * Constructor injection: makes dependencies explicit, fields final, and
     * simplifies unit-testing by allowing mock injection.
     */
    public DatingController(DatingProfileRepository datingRepo, UserRepository userRepo,
                            FileStorageService storageService, DatingSwipeRepository swipeRepo,
                            NotificationRepository notificationRepo, MatchRepository matchRepo) {
        this.datingRepo = datingRepo;
        this.userRepo = userRepo;
        this.storageService = storageService;
        this.swipeRepo = swipeRepo;
        this.notificationRepo = notificationRepo;
        this.matchRepo = matchRepo;
    }

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
    public ResponseEntity<List<DatingProfile>> getProfiles() {
        try {
            // Build a lookup map: userId → DatingProfile (for O(1) lookup per user below)
            Map<UUID, DatingProfile> profileMap = datingRepo.findAll().stream()
                    .collect(Collectors.toMap(DatingProfile::getId, p -> p));

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

            // Return all users as discoverable profiles, enriched with dating profile if they have one.
            List<DatingProfile> result = userRepo.findAll().stream()
                    // Filter out the current user and anyone already swiped on.
                    .filter(u -> finalCurrentId == null || !u.getId().equals(finalCurrentId))
                    .filter(u -> !swiped.contains(u.getId()))
                    .map(u -> {
                        DatingProfile dp = profileMap.get(u.getId());
                        if (dp != null) return dp; // user has a rich profile — use it
                        // Synthesise a default profile from the user's main account fields.
                        return DatingProfile.builder()
                                .id(u.getId())
                                .fullName(u.getFullName())
                                .bio(u.getBio() != null ? u.getBio() : "Just a hustler on the grind.")
                                .location(u.getCity() != null ? u.getCity() : "")
                                .imageUrl(u.getAvatarUrl())
                                .lookingFor("Networking") // sensible default
                                .age(0)                   // unknown — profile not filled in
                                .build();
                    })
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
     * @param profileId the UUID of the profile being liked
     * @return 200 OK with {@code {"liked": true, "matched": bool, "profileId": "..."}}
     */
    @PostMapping("/like/{profileId}")
    public ResponseEntity<?> likeProfile(@PathVariable UUID profileId) {
        User user = getCurrentUser();
        if (user == null) return ResponseEntity.status(401).build();

        recordSwipe(user.getId(), profileId, "LIKE");

        // Mutual like check: has the target already liked the current user?
        boolean matched = swipeRepo.existsBySwiperIdAndTargetIdAndAction(profileId, user.getId(), "LIKE");

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
                            .message("You and " + target.getFullName() + " liked each other")
                            .notificationType("DATING_MATCH")
                            .referenceId(profileId)
                            .build());
                    notificationRepo.save(Notification.builder()
                            .userId(profileId)
                            .title("It's a match!")
                            .message("You and " + user.getFullName() + " liked each other")
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
        User user = getCurrentUser();
        if (user == null) return ResponseEntity.status(401).build();
        recordSwipe(user.getId(), profileId, "PASS");
        return ResponseEntity.ok(Map.of("passed", true, "profileId", profileId.toString()));
    }
}
