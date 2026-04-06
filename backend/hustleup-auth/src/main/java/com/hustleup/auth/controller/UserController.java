package com.hustleup.auth.controller;

import com.hustleup.common.dto.UserDto;
import com.hustleup.common.model.ProfileView;
import com.hustleup.common.model.User;
import com.hustleup.common.repository.ProfileViewRepository;
import com.hustleup.common.repository.UserRepository;
import com.hustleup.common.storage.FileStorageService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.*;
import java.util.stream.Collectors;

/**
 * UserController — handles HTTP endpoints for user profile management.
 *
 * <p>While {@link AuthController} deals with the identity/token lifecycle,
 * this controller deals with what users <em>do</em> with their accounts once
 * they are authenticated: viewing profiles, updating profile fields, uploading
 * images, and checking who viewed their profile.</p>
 *
 * <p>All endpoints under this controller are prefixed with {@code /api/v1/users}.</p>
 *
 * <h2>Why is this in the auth service?</h2>
 * <p>User profile data (name, avatar, address) is tightly coupled to the {@link User}
 * entity managed by this service. Keeping user CRUD here avoids cross-service database
 * joins. If the application grows, user profile management could be extracted into its
 * own microservice later.</p>
 *
 * <h2>@RequiredArgsConstructor (Lombok)</h2>
 * <p>Lombok generates a constructor for every {@code final} field. Spring's dependency
 * injection picks that constructor automatically — this is equivalent to writing a
 * constructor with {@code @Autowired} by hand, but with far less boilerplate.</p>
 */
// @RestController = @Controller + @ResponseBody: methods return JSON, not view names.
@RestController

// Base path for all endpoints in this class.
@RequestMapping("/api/v1/users")

// Lombok generates: public UserController(UserRepository, ProfileViewRepository, FileStorageService)
// Spring will call this constructor to inject the beans.
@RequiredArgsConstructor
public class UserController {

    // -------------------------------------------------------------------------
    // Dependencies
    // -------------------------------------------------------------------------

    // CRUD access for User entities — backed by Spring Data JPA auto-generated SQL.
    private final UserRepository userRepository;

    // Persists and queries profile-view audit records (who viewed whose profile, when).
    private final ProfileViewRepository profileViewRepository;

    // Handles saving uploaded files to the local filesystem (or cloud storage).
    // Returns a URL string that can be stored on the User entity and served back to clients.
    private final FileStorageService fileStorageService;

    // -------------------------------------------------------------------------
    // Private utility
    // -------------------------------------------------------------------------

    /**
     * Convenience helper that extracts the authenticated user's email from the
     * security context populated by the JWT filter.
     *
     * <p>Every authenticated request passes through the JWT filter in hustleup-common
     * which validates the {@code Authorization: Bearer} header and sets a
     * {@link org.springframework.security.core.Authentication} object in
     * {@link SecurityContextHolder}. The principal name is the user's email address,
     * exactly as it was encoded in the JWT at login time.</p>
     *
     * @return the email address of the currently authenticated user
     */
    private String currentUserEmail() {
        // SecurityContextHolder stores security data per-thread (ThreadLocal).
        // getAuthentication().getName() returns the "principal" — in our case the email.
        return SecurityContextHolder.getContext().getAuthentication().getName();
    }

    // =========================================================================
    // Endpoints
    // =========================================================================

    /**
     * Retrieve all registered users.
     *
     * <p><strong>HTTP:</strong> {@code GET /api/v1/users}</p>
     * <p><strong>Auth required:</strong> yes (JWT)</p>
     * <p><strong>Called by:</strong> admin dashboards or marketplace search pages
     * that need a full user list</p>
     *
     * <p>Each {@link User} entity is converted to a {@link UserDto} before being
     * returned. DTOs (Data Transfer Objects) act as a projection layer — they expose
     * only the fields safe for the client (excluding the hashed password, audit
     * timestamps, etc.).</p>
     *
     * @return {@code 200 OK} with a list of all users as {@link UserDto}
     */
    @GetMapping // maps HTTP GET /api/v1/users to this method
    public ResponseEntity<List<UserDto>> getAllUsers() {
        // findAll() issues a SELECT * FROM users.
        // We stream the result, map each entity to its DTO, and collect into a List.
        // The Java Stream API is used here for clean, declarative transformation.
        return ResponseEntity.ok(userRepository.findAll().stream()
                .map(UserDto::fromEntity)    // method reference: equivalent to u -> UserDto.fromEntity(u)
                .collect(Collectors.toList()));
    }

    /**
     * Retrieve a specific user's public profile and record a profile view.
     *
     * <p><strong>HTTP:</strong> {@code GET /api/v1/users/{id}/profile}</p>
     * <p><strong>Auth required:</strong> no (anonymous users can view profiles,
     * but views are only recorded for authenticated users)</p>
     * <p><strong>Called by:</strong> any page that displays another user's profile
     * card (e.g., a seller's shop page)</p>
     *
     * <p>Recording profile views works as an upsert: we delete any existing view
     * record by the same viewer before inserting a fresh one. This prevents the
     * same viewer from inflating the view count by refreshing the page.</p>
     *
     * @param id the UUID of the profile owner, taken from the URL path segment
     * @return {@code 200 OK} with the user's public profile as {@link UserDto},
     *         {@code 404 Not Found} (thrown as RuntimeException) if the user doesn't exist
     */
    // {id} in the path is a path variable, bound to the method parameter via @PathVariable.
    @GetMapping("/{id}/profile")
    public ResponseEntity<UserDto> getProfile(
            // @PathVariable extracts the {id} segment from the URL and injects it as a String.
            @PathVariable String id) {

        // Look up the target user. UUID.fromString parses the string segment into a UUID.
        User user = userRepository.findById(UUID.fromString(id))
                .orElseThrow(() -> new RuntimeException("User not found"));

        // Record profile view (ignore self-views and unauthenticated access).
        // We wrap in try/catch so a failure here never breaks the main profile response.
        try {
            String viewerEmail = currentUserEmail();

            // "anonymousUser" is the name Spring Security gives unauthenticated requests.
            if (viewerEmail != null && !viewerEmail.equals("anonymousUser")) {
                userRepository.findByEmail(viewerEmail).ifPresent(viewer -> {
                    // Don't record a self-view (looking at your own profile).
                    if (!viewer.getId().equals(UUID.fromString(id))) {
                        // Delete any previous view by this viewer for this profile (upsert pattern).
                        profileViewRepository.deleteByProfileIdAndViewerId(id, viewer.getId().toString());

                        // Insert a fresh view record with the current timestamp.
                        ProfileView pv = new ProfileView();
                        pv.setProfileId(id);
                        pv.setViewerId(viewer.getId().toString());
                        profileViewRepository.save(pv); // timestamp is set automatically by the entity
                    }
                });
            }
        } catch (Exception ignored) {
            // Intentionally swallowed: view tracking is best-effort and must not
            // prevent the profile response from being returned to the caller.
        }

        return ResponseEntity.ok(UserDto.fromEntity(user));
    }

    /**
     * Return the list of users who most recently viewed the authenticated user's profile.
     *
     * <p><strong>HTTP:</strong> {@code GET /api/v1/users/me/viewers}</p>
     * <p><strong>Auth required:</strong> yes (JWT) — you can only see your own viewers</p>
     * <p><strong>Called by:</strong> the "Who viewed my profile" section in the dashboard</p>
     *
     * <p>Results are capped at 50 and ordered most-recent first. Each entry is a
     * lightweight map containing the viewer's id, name, username, avatar, and the
     * timestamp of the view. We use a raw {@code Map<String, Object>} here rather
     * than a dedicated DTO to keep the code concise for this one-off use-case.</p>
     *
     * @return {@code 200 OK} with a list of viewer summaries (up to 50)
     */
    @GetMapping("/me/viewers")
    public ResponseEntity<?> getMyViewers() {
        String email = currentUserEmail();

        // Load the authenticated user so we have their UUID to query views.
        User me = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        // Fetch profile view records, ordered by viewedAt DESC (most recent first).
        // The repository method name convention ("findByProfileIdOrderByViewedAtDesc")
        // tells Spring Data exactly what SQL to generate — no manual query needed.
        List<ProfileView> views = profileViewRepository.findByProfileIdOrderByViewedAtDesc(me.getId().toString());

        // Transform each ProfileView record into a summary map.
        List<Map<String, Object>> result = views.stream()
                .limit(50) // cap at 50 to avoid overly large responses
                .map(pv -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("viewedAt", pv.getViewedAt()); // when the profile was viewed

                    // Look up the viewer's details from the users table.
                    // ifPresent avoids a NullPointerException if the viewer account was deleted.
                    userRepository.findById(UUID.fromString(pv.getViewerId())).ifPresent(u -> {
                        m.put("id", u.getId());
                        m.put("fullName", u.getFullName());
                        // Derive a simple display username from the email local part (before @).
                        m.put("username", u.getEmail().split("@")[0]);
                        m.put("avatarUrl", u.getAvatarUrl());
                        // Default to "BUYER" if role is somehow null (defensive coding).
                        m.put("role", u.getRole() != null ? u.getRole().name() : "BUYER");
                    });
                    return m;
                })
                // Filter out entries where the viewer's account was deleted (no "id" key added).
                .filter(m -> m.containsKey("id"))
                .collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    /**
     * Upload and set a new avatar image for the authenticated user.
     *
     * <p><strong>HTTP:</strong> {@code PATCH /api/v1/users/me/avatar}</p>
     * <p><strong>Content-Type:</strong> {@code multipart/form-data}</p>
     * <p><strong>Form field:</strong> {@code file} — the image binary</p>
     * <p><strong>Auth required:</strong> yes (JWT)</p>
     * <p><strong>Called by:</strong> the avatar upload widget in profile settings</p>
     *
     * <p>We use {@code PATCH} (not {@code PUT}) because we are updating a single field
     * of the user resource, not replacing the entire resource.</p>
     *
     * @param file the uploaded image file
     * @return {@code 200 OK} with the updated {@link UserDto} including the new avatar URL
     */
    // consumes = "multipart/form-data" restricts this endpoint to multipart requests only.
    // This is required for file uploads; a plain JSON body would not work here.
    @PatchMapping(value = "/me/avatar", consumes = "multipart/form-data")
    public ResponseEntity<UserDto> updateAvatar(
            // @RequestParam("file") binds the multipart file upload field named "file".
            // MultipartFile provides the file bytes, original filename, content type, etc.
            @RequestParam("file") MultipartFile file) {

        // Load the authenticated user from the DB.
        User user = userRepository.findByEmail(currentUserEmail()).orElseThrow();

        // Store the file on disk (or cloud) and get back a publicly accessible URL.
        // FileStorageService abstracts away whether storage is local, S3, etc.
        user.setAvatarUrl(fileStorageService.store(file));

        // Persist the updated avatar URL and return the refreshed DTO.
        return ResponseEntity.ok(UserDto.fromEntity(userRepository.save(user)));
    }

    /**
     * Upload and set a new banner image for the authenticated user's shop.
     *
     * <p><strong>HTTP:</strong> {@code PATCH /api/v1/users/me/banner}</p>
     * <p><strong>Content-Type:</strong> {@code multipart/form-data}</p>
     * <p><strong>Form field:</strong> {@code file} — the banner image binary</p>
     * <p><strong>Auth required:</strong> yes (JWT)</p>
     * <p><strong>Called by:</strong> the shop banner upload widget in seller profile settings</p>
     *
     * @param file the uploaded banner image file
     * @return {@code 200 OK} with the updated {@link UserDto} including the new banner URL
     */
    @PatchMapping(value = "/me/banner", consumes = "multipart/form-data")
    public ResponseEntity<UserDto> updateBanner(@RequestParam("file") MultipartFile file) {
        User user = userRepository.findByEmail(currentUserEmail()).orElseThrow();

        // Store the file and save the resulting URL to the shopBannerUrl field.
        user.setShopBannerUrl(fileStorageService.store(file));

        return ResponseEntity.ok(UserDto.fromEntity(userRepository.save(user)));
    }

    /**
     * Partially update the authenticated user's profile fields.
     *
     * <p><strong>HTTP:</strong> {@code PATCH /api/v1/users/me}</p>
     * <p><strong>Body:</strong> partial {@link UserDto} JSON — only include fields you want to change</p>
     * <p><strong>Auth required:</strong> yes (JWT)</p>
     * <p><strong>Called by:</strong> the profile edit form on the frontend</p>
     *
     * <p>This is a <em>partial update</em> (PATCH semantics): fields that are {@code null}
     * in the incoming DTO are skipped, so the client can send only the fields it wants
     * to change without accidentally overwriting other fields with nulls.</p>
     *
     * <p>A {@code PUT} would typically replace the entire resource, requiring all fields.
     * Using {@code PATCH} with null-checks is the idiomatic approach for partial updates.</p>
     *
     * @param profileData partial user profile data; any non-null field is applied
     * @return {@code 200 OK} with the fully updated {@link UserDto}
     */
    @PatchMapping("/me")
    public ResponseEntity<UserDto> updateProfile(
            // @RequestBody deserialises the JSON request body into a UserDto.
            // Fields absent from the JSON will be null in the object.
            @RequestBody UserDto profileData) {

        String email = currentUserEmail();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        // Apply only non-null fields — this is the "partial update" pattern.
        // If a client sends {"bio": "Hello!"}, only bio is updated; all other
        // fields remain exactly as they were in the database.
        if (profileData.getFullName() != null)      user.setFullName(profileData.getFullName());
        if (profileData.getUsername() != null)      user.setUsername(profileData.getUsername());
        if (profileData.getBio() != null)           user.setBio(profileData.getBio());
        if (profileData.getPhone() != null)         user.setPhone(profileData.getPhone());
        if (profileData.getCity() != null)          user.setCity(profileData.getCity());
        if (profileData.getAddressLine1() != null)  user.setAddressLine1(profileData.getAddressLine1());
        if (profileData.getAddressLine2() != null)  user.setAddressLine2(profileData.getAddressLine2());
        if (profileData.getPostcode() != null)      user.setPostcode(profileData.getPostcode());
        if (profileData.getCountry() != null)       user.setCountry(profileData.getCountry());
        if (profileData.getWebsite() != null)       user.setWebsite(profileData.getWebsite());
        if (profileData.getAvatarUrl() != null)     user.setAvatarUrl(profileData.getAvatarUrl());
        if (profileData.getShopBannerUrl() != null) user.setShopBannerUrl(profileData.getShopBannerUrl());

        // Manually stamp the last-updated time. In a more elaborate setup this would
        // be handled by @LastModifiedDate + Spring Data Auditing, but an explicit set
        // is perfectly correct and transparent.
        user.setUpdatedAt(java.time.LocalDateTime.now());

        // save() on an entity that already has an ID issues an UPDATE (not an INSERT).
        // JPA/Hibernate tracks whether an entity is "managed" (loaded from DB) or "new".
        return ResponseEntity.ok(UserDto.fromEntity(userRepository.save(user)));
    }
}
