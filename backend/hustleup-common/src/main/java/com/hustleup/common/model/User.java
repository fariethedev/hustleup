package com.hustleup.common.model;

import jakarta.persistence.*;
import lombok.*;
import com.hustleup.common.model.Role;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * JPA entity representing a registered user of the HustleUp platform.
 *
 * <p><b>Why JPA/Hibernate?</b><br>
 * JPA (Java Persistence API) lets us map this plain Java class directly to a relational
 * database table without writing raw SQL for CRUD operations. Hibernate is the JPA
 * implementation under the hood — it translates field names, types, and annotations into
 * the appropriate SQL dialect automatically.
 *
 * <p><b>Table mapping:</b><br>
 * This class maps to the {@code users} table. Every non-transient field corresponds to a
 * column. Column names that differ from the Java field name are made explicit via
 * {@code @Column(name = "...")}.
 *
 * <p><b>Relationships to other entities:</b><br>
 * <ul>
 *   <li>{@link Notification} — a user can have many notifications; the {@code userId} FK
 *       in the {@code notifications} table points back here.</li>
 *   <li>{@link ProfileView} — both {@code profileId} (the viewed user) and
 *       {@code viewerId} (the viewing user) reference user IDs stored in this table.</li>
 * </ul>
 *
 * <p><b>Lombok annotations explained:</b><br>
 * {@code @Getter}/@code{@Setter} — generates all getters and setters so we don't write
 * boilerplate. {@code @NoArgsConstructor} is required by JPA (it needs to instantiate
 * objects via reflection). {@code @AllArgsConstructor} and {@code @Builder} make it easy
 * to create fully-populated instances in service/test code.
 *
 * <p><b>Architecture note:</b><br>
 * This class lives in {@code hustleup-common} so it can be shared across every
 * microservice (auth, profile, listings, notifications, etc.) without duplication. Each
 * service imports the common module and references the same entity definition.
 */
@Entity                          // Marks this class as a JPA-managed database entity
@Table(name = "users")           // Maps to the "users" table in the database
@Getter @Setter                  // Lombok: generates getXxx()/setXxx() for every field
@NoArgsConstructor               // Lombok: required zero-arg constructor for JPA proxy creation
@AllArgsConstructor              // Lombok: all-fields constructor used by @Builder internally
@Builder                         // Lombok: enables the builder pattern — User.builder().email(...).build()
public class User {

    /**
     * Primary key — a universally unique identifier (UUID v4).
     *
     * <p>Using UUID instead of a numeric auto-increment ID has two main benefits:
     * <ol>
     *   <li>IDs are globally unique, which is important in a microservices architecture
     *       where multiple services generate records independently.</li>
     *   <li>IDs cannot be guessed sequentially, which reduces enumeration attacks.</li>
     * </ol>
     *
     * <p>{@code @GeneratedValue(strategy = GenerationType.UUID)} tells Hibernate to ask
     * the database (or generate internally) a UUID when a new row is inserted.
     * {@code @JdbcTypeCode(SqlTypes.VARCHAR)} and {@code columnDefinition = "VARCHAR(36)"}
     * ensure the UUID is stored as a 36-character string (e.g. "550e8400-e29b-41d4-a716-446655440000")
     * rather than as a binary blob, making it human-readable in the database.
     */
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(columnDefinition = "VARCHAR(36)")
    private UUID id;

    /**
     * The user's email address — used as the login credential and for sending notifications.
     *
     * <p>{@code nullable = false} enforces a NOT NULL constraint at the database level.
     * {@code unique = true} creates a UNIQUE index, preventing two accounts sharing the
     * same email. Spring Security also uses this as the "username" principal during
     * authentication (see {@link com.hustleup.common.security.JwtTokenProvider}).
     */
    @Column(nullable = false, unique = true)
    private String email;

    /**
     * BCrypt-hashed password — NEVER stored in plain text.
     *
     * <p>Passwords are hashed by {@code BCryptPasswordEncoder} in the auth service before
     * being persisted here. Bcrypt is intentionally slow (tunable work factor), making
     * brute-force attacks computationally expensive even if the database is leaked.
     */
    @Column(nullable = false)
    private String password;

    /**
     * The user's display name shown across the platform (e.g. on listings, reviews).
     *
     * <p>Stored in a column named {@code full_name} (snake_case DB convention vs.
     * camelCase Java convention). Must always be present — hence {@code nullable = false}.
     */
    @Column(name = "full_name", nullable = false)
    private String fullName;

    /**
     * Optional phone number for contact or SMS verification.
     *
     * <p>No column annotation needed here because the default column name derived from
     * the field name ("phone") is exactly what we want.
     */
    private String phone;

    /**
     * The platform role assigned to this user — controls what actions they can perform.
     *
     * <p>{@code @Enumerated(EnumType.STRING)} stores the role as a readable string
     * ("BUYER", "SELLER", "ADMIN") rather than an ordinal integer. This is safer because
     * adding a new enum value won't corrupt existing rows the way integer ordinals can.
     *
     * <p>{@code @Builder.Default} is required when using Lombok's {@code @Builder}
     * alongside a field initialiser — without it, the builder would ignore the default
     * value and set the field to {@code null}.
     *
     * @see Role
     */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private Role role = Role.BUYER; // New accounts start as BUYER; upgraded to SELLER during onboarding

    /**
     * The user's unique handle (e.g. "@johndoe") — optional but unique when set.
     *
     * <p>The {@code unique = true} constraint prevents two sellers from claiming the same
     * storefront URL. A {@code null} value is allowed (before the user completes profile
     * setup), and multiple nulls are permitted by SQL's UNIQUE semantics.
     */
    @Column(unique = true)
    private String username;

    /**
     * URL pointing to the user's profile picture.
     *
     * <p>This is either a relative local path (e.g. {@code /uploads/uuid.jpg}) when
     * running without AWS, or a full S3 URL / presigned URL when cloud storage is
     * configured. See {@link com.hustleup.common.storage.FileStorageService} for how
     * files are stored and URLs are generated.
     */
    @Column(name = "avatar_url")
    private String avatarUrl;

    /**
     * URL for the seller's shop banner / cover image shown at the top of their storefront.
     *
     * <p>Only relevant for users with {@code role = SELLER}. Stored the same way as
     * {@link #avatarUrl} — either a local path or an S3 URL.
     */
    @Column(name = "shop_banner_url")
    private String shopBannerUrl;

    /**
     * Short biography or description the user writes about themselves.
     *
     * <p>Displayed on their public profile page. No explicit column annotation — the
     * default column name "bio" matches the field name.
     */
    private String bio;

    /**
     * City or town the user is based in — used for local discovery / search filtering.
     */
    private String city;

    /**
     * First line of the user's postal address (e.g. "123 High Street").
     *
     * <p>Used for physical delivery of goods purchased through the marketplace.
     * Mapped to {@code address_line1} following snake_case DB conventions.
     */
    @Column(name = "address_line1")
    private String addressLine1;

    /**
     * Second (optional) address line (e.g. apartment number, building name).
     */
    @Column(name = "address_line2")
    private String addressLine2;

    /**
     * Postal / ZIP code — used alongside city/country for address lookup and delivery.
     */
    private String postcode;

    /**
     * Country of residence — stored as a free-text string (e.g. "United Kingdom").
     */
    private String country;

    /**
     * Optional personal or business website URL displayed on the public profile.
     */
    private String website;

    /**
     * Whether the user has verified ownership of their email address.
     *
     * <p>Set to {@code true} after the user clicks a confirmation link sent to their inbox.
     * Some platform features may be gated behind email verification to reduce spam.
     */
    @Column(name = "is_email_verified")
    @Builder.Default
    private boolean emailVerified = false; // Default false — must be explicitly confirmed

    /**
     * Whether the user has verified their phone number (e.g. via SMS OTP).
     *
     * <p>Phone verification provides an additional trust signal shown on profiles,
     * helping buyers feel confident when transacting with sellers.
     */
    @Column(name = "is_phone_verified")
    @Builder.Default
    private boolean phoneVerified = false; // Default false — must be explicitly confirmed

    /**
     * Whether the user's government-issued ID has been verified.
     *
     * <p>ID verification is a higher-level trust signal, typically used to unlock
     * high-value selling categories or dispute resolution. Set by an admin or
     * automated KYC (Know Your Customer) process.
     */
    @Column(name = "is_id_verified")
    @Builder.Default
    private boolean idVerified = false; // Default false — requires manual or KYC review

    /**
     * URL of the uploaded government ID document image, stored securely (S3 or local).
     *
     * <p>This is sensitive data — in production it should live in a private S3 bucket
     * accessible only by admins or the KYC review process, not publicly presigned.
     */
    @Column(name = "id_document_url")
    private String idDocumentUrl;

    /**
     * Running count of how many other users have "vouched" for this user.
     *
     * <p>A vouch is a trust endorsement from one user to another. A higher vouch count
     * signals credibility within the community. Stored as a denormalised counter here
     * for fast reads (avoids a COUNT query against a separate vouches table on every
     * profile load).
     */
    @Column(name = "vouch_count")
    @Builder.Default
    private int vouchCount = 0; // Starts at zero; incremented when another user vouches

    /**
     * Timestamp of when this user account was first created.
     *
     * <p>Defaults to "now" at object construction time. In production you might prefer
     * {@code @CreationTimestamp} (Hibernate) so the database clock is authoritative, but
     * the application-clock default works fine for most use cases.
     */
    @Column(name = "created_at")
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    /**
     * Timestamp of the last time any field on this record was modified.
     *
     * <p>Should ideally be updated via a JPA lifecycle callback ({@code @PreUpdate}) so
     * it is always accurate. Currently relies on calling code remembering to set it.
     */
    @Column(name = "updated_at")
    @Builder.Default
    private LocalDateTime updatedAt = LocalDateTime.now();

    /**
     * Timestamp of the user's most recent activity on the platform.
     *
     * <p>Updated by the auth or gateway service on each authenticated request (or at
     * session start). Used to show "active X minutes ago" on profiles and to expire
     * dormant accounts.
     */
    @Column(name = "last_active")
    @Builder.Default
    private LocalDateTime lastActive = LocalDateTime.now();

    /**
     * Whether the user has completed the post-registration onboarding flow.
     *
     * <p>Onboarding typically involves choosing a role, uploading an avatar, and filling
     * in basic profile info. The frontend redirects incomplete users back to the
     * onboarding wizard until this flag is {@code true}. Using {@code Boolean} (boxed)
     * instead of {@code boolean} (primitive) allows a {@code null} state representing
     * "onboarding state unknown" for legacy accounts created before this field existed.
     */
    @Column(name = "onboarding_completed")
    @Builder.Default
    private Boolean onboardingCompleted = true; // True by default so existing accounts aren't forced through onboarding
}
