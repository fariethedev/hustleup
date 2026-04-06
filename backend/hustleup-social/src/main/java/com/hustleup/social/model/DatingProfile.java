/**
 * JPA entity representing an optional dating/networking profile for a HustleUp user.
 *
 * <p>Not every user will fill this in — it is optional enrichment on top of the core
 * {@link com.hustleup.common.model.User} account.  The {@link DatingController} synthesises
 * a default profile from the User record for any user who hasn't set one up.
 *
 * <h2>Table: {@code dating_profiles}</h2>
 *
 * <h2>One-to-one relationship with User</h2>
 * The primary key ({@link #id}) is intentionally the same UUID as the user's account ID.
 * This means:
 * <ul>
 *   <li>There is at most one dating profile per user (enforced by the PK uniqueness).</li>
 *   <li>No foreign key annotation is needed — the application ensures alignment by
 *       always setting {@code profile.id = user.id} in the controller.</li>
 *   <li>Lookups are fast — finding a user's profile is a primary key lookup (O(1)).</li>
 * </ul>
 *
 * <h2>Lombok annotations</h2>
 * <ul>
 *   <li>{@code @Data} — generates getters, setters, equals, hashCode, toString</li>
 *   <li>{@code @Builder} — enables clean object construction in the controller</li>
 *   <li>{@code @NoArgsConstructor} — required by JPA</li>
 *   <li>{@code @AllArgsConstructor} — required by {@code @Builder}</li>
 * </ul>
 */
package com.hustleup.social.model;

import jakarta.persistence.*;
import lombok.*;
import java.util.UUID;

// @Entity: Hibernate will manage this class as a database entity.
@Entity

// Explicit table name matching the existing database schema.
@Table(name = "dating_profiles")

// @Data: Lombok auto-generates all getters, setters, equals, hashCode, and toString.
@Data

// @Builder: enables the builder pattern — DatingProfile.builder().id(uuid).bio("...").build()
@Builder

// JPA requires a no-argument constructor; Lombok's @NoArgsConstructor provides it.
@NoArgsConstructor

// @AllArgsConstructor is needed by @Builder to construct fully-populated objects.
@AllArgsConstructor
public class DatingProfile {

    /**
     * Primary key — the same UUID as the user's account ID.
     *
     * <p>No {@code @GeneratedValue} is needed here because the application explicitly
     * sets {@code profile.id = user.id} before saving.  This makes the dating profile
     * a strict one-to-one extension of the User entity.
     */
    @Id
    private UUID id; // Same as userId — one profile per user

    /**
     * The user's full display name, synced from their main account on every save.
     *
     * <p>Kept in sync with {@link com.hustleup.common.model.User#getFullName()} by the
     * controller, which always calls {@code profile.setFullName(user.getFullName())}
     * before persisting.  This allows the dating profile to display the current name
     * without a JOIN to the users table.
     */
    private String fullName;

    /**
     * The user's age in years (optional).
     * {@code 0} is used as a sentinel value when the user hasn't filled this in.
     */
    private Integer age;

    /**
     * The user's self-identified gender (optional free-text field).
     * Example values: "Male", "Female", "Non-binary", etc.
     */
    private String gender;

    /**
     * What the user is looking for on the platform (optional).
     * Example values: "Networking", "Dating", "Collaborators", "Mentorship".
     * Defaults to "Networking" when synthesised from the User record.
     */
    private String lookingFor;

    /**
     * A short personal description / biography (optional).
     * Defaults to "Just a hustler on the grind." when synthesised from the User record.
     */
    private String bio;

    /**
     * The user's city or region (optional).
     * Synced from {@link com.hustleup.common.model.User#getCity()} when a default profile
     * is synthesised; overridable by the user in the dating profile form.
     */
    private String location;

    /**
     * URL of the dating profile photo (optional).
     *
     * <p>When a new image is uploaded via the dating profile form, this is set to the
     * storage URL returned by {@link com.hustleup.common.storage.FileStorageService#store}.
     * Falls back to {@link com.hustleup.common.model.User#getAvatarUrl()} if no dedicated
     * dating photo has been uploaded.
     */
    private String imageUrl;

    /**
     * Comma-separated list of the user's interests (optional).
     * Example: "Music,Fitness,Entrepreneurship,Travel"
     * The client is responsible for parsing and displaying these as tags.
     */
    private String interests;
}
