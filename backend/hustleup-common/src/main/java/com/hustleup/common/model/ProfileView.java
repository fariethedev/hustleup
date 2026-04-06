package com.hustleup.common.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import java.time.LocalDateTime;

/**
 * JPA entity recording the fact that one user viewed another user's profile.
 *
 * <p><b>What does this track?</b><br>
 * Every time a logged-in user navigates to someone else's profile page, one row is
 * upserted into the {@code profile_views} table. This powers:
 * <ul>
 *   <li>The "Who viewed my profile" feature on seller dashboards.</li>
 *   <li>View count analytics shown to profile owners.</li>
 * </ul>
 *
 * <p><b>Why JPA/Hibernate?</b><br>
 * JPA manages the mapping, and the {@code @UniqueConstraint} annotation keeps the table
 * clean — each (viewer, profile) pair can appear at most once, preventing duplicate
 * records when a user visits the same profile multiple times (the service layer is
 * expected to delete and re-insert, or use upsert semantics via
 * {@link com.hustleup.common.repository.ProfileViewRepository#deleteByProfileIdAndViewerId}).
 *
 * <p><b>Table mapping:</b><br>
 * Maps to the {@code profile_views} table. The composite unique constraint on
 * {@code (profile_id, viewer_id)} is declared at the table level rather than with two
 * separate {@code @Column(unique = true)} annotations because uniqueness is only
 * meaningful for the combination, not each column individually.
 *
 * <p><b>Relationships to other entities:</b><br>
 * Both {@code profileId} and {@code viewerId} are soft foreign keys into the
 * {@code users} table ({@link User}). We use {@code String} here (rather than {@link java.util.UUID})
 * because this entity predates the UUID-typed primary key on User and stores the
 * serialised UUID string directly — a common pragmatic trade-off when migrating schemas.
 *
 * <p><b>Note on Lombok:</b><br>
 * This entity does not use Lombok — getters and setters are written manually. This is
 * equivalent to the Lombok-annotated entities but shows the underlying boilerplate.
 */
@Entity                          // Marks this class as a JPA entity backed by a database table
@Table(
    name = "profile_views",
    // Composite unique constraint: a given viewer can only appear once per profile.
    // The database enforces this at the row level, preventing duplicate view records.
    uniqueConstraints = {
        @UniqueConstraint(columnNames = {"profile_id", "viewer_id"})
    }
)
public class ProfileView {

    /**
     * Primary key — a UUID stored as a {@code String} (VARCHAR) in the database.
     *
     * <p>Using {@code String} instead of {@code UUID} is intentional here: it sidesteps
     * any JDBC type-mapping differences between databases and keeps the entity simple.
     * {@code GenerationType.UUID} still instructs Hibernate/the DB to auto-generate
     * a UUID value on insert.
     */
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    /**
     * The ID of the user whose profile was viewed (the "subject" of the view).
     *
     * <p>This is a soft foreign key into {@code users.id}. We query by this column to
     * retrieve "who viewed me" lists (see
     * {@link com.hustleup.common.repository.ProfileViewRepository#findByProfileIdOrderByViewedAtDesc}).
     * {@code nullable = false} because a view record always has a subject.
     */
    @Column(name = "profile_id", nullable = false)
    private String profileId;

    /**
     * The ID of the user who performed the view (the "observer").
     *
     * <p>Combined with {@code profileId} in the unique constraint and in
     * {@link com.hustleup.common.repository.ProfileViewRepository#existsByProfileIdAndViewerId}
     * to detect duplicate views. {@code nullable = false} because anonymous views are not
     * tracked (only logged-in users generate view records).
     */
    @Column(name = "viewer_id", nullable = false)
    private String viewerId;

    /**
     * The exact date and time the view was recorded.
     *
     * <p>{@code @CreationTimestamp} is a Hibernate-specific annotation that
     * automatically populates this field with the current database/JVM timestamp when
     * the row is first inserted — we never need to set it manually in application code.
     * {@code updatable = false} prevents Hibernate from accidentally overwriting it
     * during subsequent UPDATE operations on this row.
     */
    @CreationTimestamp
    @Column(name = "viewed_at", updatable = false)
    private LocalDateTime viewedAt;

    /**
     * Returns the auto-generated primary key for this view record.
     *
     * @return the UUID string ID
     */
    public String getId() { return id; }

    /**
     * Returns the ID of the user whose profile was viewed.
     *
     * @return the profile owner's user ID
     */
    public String getProfileId() { return profileId; }

    /**
     * Sets the ID of the user whose profile was viewed.
     *
     * @param profileId the profile owner's user ID
     */
    public void setProfileId(String profileId) { this.profileId = profileId; }

    /**
     * Returns the ID of the user who viewed the profile.
     *
     * @return the viewer's user ID
     */
    public String getViewerId() { return viewerId; }

    /**
     * Sets the ID of the user who viewed the profile.
     *
     * @param viewerId the viewer's user ID
     */
    public void setViewerId(String viewerId) { this.viewerId = viewerId; }

    /**
     * Returns the timestamp at which the view was recorded.
     *
     * <p>This value is set automatically by Hibernate on insert and is immutable
     * thereafter (see the {@code updatable = false} constraint on the column).
     *
     * @return the view timestamp, never {@code null} for persisted records
     */
    public LocalDateTime getViewedAt() { return viewedAt; }
}
