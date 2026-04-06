package com.hustleup.common.dto;

import com.hustleup.common.model.User;
import lombok.*;
import java.util.UUID;

/**
 * Data Transfer Object (DTO) representing a user's public and semi-public profile data.
 *
 * <p><b>What is a DTO and why use one?</b><br>
 * A DTO is a plain object used to carry data between layers (controller → client) without
 * exposing the internal entity model. This is critically important for {@link User} because
 * the entity contains sensitive fields that must never leave the server:
 * <ul>
 *   <li>{@code password} — the BCrypt hash should never be serialised into a response.</li>
 *   <li>{@code idDocumentUrl} — the ID document URL points to sensitive KYC data.</li>
 *   <li>JPA metadata (e.g. {@code @Version} fields, lazy-loaded proxies) that should not
 *       be serialised.</li>
 * </ul>
 * By explicitly mapping only the fields we want to expose into a DTO, we create a safe
 * contract for the API surface.
 *
 * <p><b>Architecture note:</b><br>
 * Defined in {@code hustleup-common} so that any microservice (auth, profile, listings,
 * notifications) can return the same user representation without defining its own copy.
 * This ensures consistent field names and structure across all service responses.
 *
 * <p><b>Lombok annotations:</b><br>
 * {@code @Getter}, {@code @Setter} — generate getters/setters for JSON serialisation.
 * {@code @NoArgsConstructor} — required by Jackson for JSON deserialisation.
 * {@code @AllArgsConstructor} — used internally by {@code @Builder}.
 * {@code @Builder} — enables a fluent builder pattern used in {@link #fromEntity}.
 */
@Getter @Setter         // Lombok: getters for Jackson serialisation, setters for deserialization
@NoArgsConstructor      // Lombok: required for JSON deserialization (Jackson uses zero-arg constructor)
@AllArgsConstructor     // Lombok: used internally by @Builder to construct instances
@Builder                // Lombok: enables UserDto.builder().email(...).build() pattern
public class UserDto {

    /**
     * The user's unique identifier.
     *
     * <p>Exposed so the frontend can reference the user (e.g. to load their profile,
     * link to their listings, or make follow/vouch API calls). UUID is type-safe and
     * non-guessable, making it safe to expose.
     */
    private UUID id;

    /**
     * The user's email address.
     *
     * <p>Included so the authenticated user can see their own email on a settings page.
     * Be cautious about including this in responses visible to other users — consider
     * a separate DTO that omits email for public-facing profile views.
     */
    private String email;

    /**
     * The user's full display name (e.g. "Alice Johnson").
     *
     * <p>Shown on profile pages, listing cards, review sections, and chat headers.
     */
    private String fullName;

    /**
     * The user's unique @handle (e.g. "alice_j").
     *
     * <p>Used in profile URLs (e.g. {@code /u/alice_j}) and mentioned in comments or
     * messages. May be {@code null} for users who haven't completed onboarding.
     */
    private String username;

    /**
     * The user's role as a string (e.g. "BUYER", "SELLER", "ADMIN").
     *
     * <p>Stored as a {@code String} rather than the {@link com.hustleup.common.model.Role}
     * enum to avoid requiring the frontend to understand the enum type, and to keep the
     * DTO serialisation simple. Converted from the entity's enum in {@link #fromEntity}.
     */
    private String role;

    /**
     * URL of the user's profile picture.
     *
     * <p>Either a relative local path ({@code /uploads/uuid.jpg}) or a presigned S3 URL.
     * The caller should pass this through
     * {@link com.hustleup.common.storage.FileStorageService#refreshUrl} before including
     * it in a response if the URL might have expired.
     */
    private String avatarUrl;

    /**
     * URL of the seller's shop banner / cover image.
     *
     * <p>Displayed at the top of a seller's storefront page. Only meaningful for users
     * with {@code role = "SELLER"}; may be {@code null} for buyers.
     */
    private String shopBannerUrl;

    /**
     * Short bio or "about me" text written by the user.
     *
     * <p>Shown on the public profile page to give visitors context about who the user is.
     */
    private String bio;

    /**
     * The city the user is based in — used for local marketplace discovery.
     */
    private String city;

    /**
     * First line of the user's delivery address.
     *
     * <p>Used for physical goods checkout. Consider whether this should be included in
     * public-facing responses — it may be more appropriate to include only in
     * authenticated self-profile views.
     */
    private String addressLine1;

    /**
     * Second (optional) line of the user's delivery address.
     */
    private String addressLine2;

    /**
     * Postal / ZIP code of the user's address.
     */
    private String postcode;

    /**
     * Country of the user's address.
     */
    private String country;

    /**
     * The user's personal or business website URL.
     *
     * <p>Displayed as a clickable link on the public profile.
     */
    private String website;

    /**
     * The user's phone number — optional, used for contact or 2FA.
     */
    private String phone;

    /**
     * Whether the user's government-issued ID has been verified by the platform.
     *
     * <p>Shown as a trust badge on the profile. Exposed as a boolean flag so the frontend
     * can display a verified tick without knowing the underlying document URL.
     */
    private boolean idVerified;

    /**
     * Whether the user has completed the post-registration onboarding flow.
     *
     * <p>The frontend checks this on login to decide whether to redirect the user to the
     * onboarding wizard. Using {@code Boolean} (boxed) allows {@code null} for legacy
     * accounts where onboarding state is unknown.
     */
    private Boolean onboardingCompleted;

    /**
     * Number of community vouches this user has received.
     *
     * <p>Displayed as a social trust signal on the profile (e.g. "✓ 12 vouches"). A
     * higher count indicates the user is well-regarded within the HustleUp community.
     */
    private int vouchCount;

    /**
     * Factory method that converts a {@link User} entity into a {@link UserDto}.
     *
     * <p><b>Why a static factory method instead of a constructor?</b><br>
     * The static factory pattern ({@code fromEntity(user)}) is more readable than
     * calling a multi-argument constructor, especially with many fields. It also
     * centralises the entity-to-DTO mapping in one place — if a field is added or
     * renamed, only this method needs updating.
     *
     * <p><b>Null safety:</b><br>
     * Returns an empty {@code UserDto} (all fields {@code null}/default) if the input
     * {@code user} is {@code null}. This defensive check prevents a
     * {@code NullPointerException} when the caller does not check for null first.
     *
     * <p><b>Role conversion:</b><br>
     * {@code user.getRole().name()} converts the {@link com.hustleup.common.model.Role}
     * enum constant to its string name (e.g. {@code Role.SELLER} → {@code "SELLER"}).
     * The null check handles legacy or partially-constructed users.
     *
     * <p><b>Fields deliberately excluded:</b><br>
     * <ul>
     *   <li>{@code password} — BCrypt hash must never leave the server.</li>
     *   <li>{@code idDocumentUrl} — sensitive KYC document URL; only for admin access.</li>
     *   <li>{@code emailVerified}, {@code phoneVerified} — verification status flags not
     *       currently needed by the consuming frontend views (can be added if needed).</li>
     *   <li>{@code createdAt}, {@code updatedAt}, {@code lastActive} — temporal metadata
     *       not currently required by the API consumers.</li>
     * </ul>
     *
     * @param user the {@link User} entity to convert; may be {@code null}
     * @return a populated {@link UserDto}, or an empty DTO if {@code user} is {@code null}
     */
    public static UserDto fromEntity(User user) {
        if (user == null) return new UserDto(); // Defensive null guard — return empty DTO rather than throwing
        return UserDto.builder()
                .id(user.getId())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .username(user.getUsername())
                .role(user.getRole() != null ? user.getRole().name() : null) // Enum → String conversion
                .avatarUrl(user.getAvatarUrl())
                .shopBannerUrl(user.getShopBannerUrl())
                .bio(user.getBio())
                .city(user.getCity())
                .addressLine1(user.getAddressLine1())
                .addressLine2(user.getAddressLine2())
                .postcode(user.getPostcode())
                .country(user.getCountry())
                .website(user.getWebsite())
                .phone(user.getPhone())
                .idVerified(user.isIdVerified())         // boolean primitive — false if not verified
                .onboardingCompleted(user.getOnboardingCompleted()) // Boolean — may be null for legacy accounts
                .vouchCount(user.getVouchCount())
                .build();
    }
}
