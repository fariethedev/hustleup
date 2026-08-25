package com.hustleup.common.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * An application by a user to become a <em>verified publisher</em> — either a hiring
 * company allowed to post jobs, or a news outlet allowed to publish articles.
 *
 * <h2>Why publishing is gated at all</h2>
 * <p>Jobs and News are the two surfaces where a bad actor does the most damage: fake job
 * adverts are the standard vehicle for advance-fee and identity-harvesting scams, and an
 * unverified "news outlet" is a megaphone. Every other surface in HustleUp is
 * self-service, but these two only carry weight because the poster was checked first. So
 * posting to them requires an <b>approved</b> row in this table, not merely an account.
 *
 * <h2>Why this lives in hustleup-common</h2>
 * <p>Three services need it and they need it for different reasons: {@code hustleup-auth}
 * owns applying and the admin review queue, {@code hustleup-marketplace} must check it
 * before accepting a job post, and {@code hustleup-social} must check it before accepting
 * an article. Putting the entity here lets all three query the same
 * {@code publisher_profiles} table directly via JPA — the same reason {@link User},
 * {@link Notification} and {@link Match} live here rather than in one service.
 *
 * <h2>One row per user per type</h2>
 * <p>The unique constraint on {@code (user_id, type)} means a user can hold at most one
 * application of each kind. That deliberately allows a single account to be both a hiring
 * company and a news outlet (a media group that also recruits), while preventing someone
 * from stacking duplicate applications of the same type to get more shots at approval.
 */
@Entity
@Table(name = "publisher_profiles", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"user_id", "type"})
})
@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PublisherProfile {

    /** What this account is applying to be allowed to publish. */
    public enum PublisherType {
        /** May post to Jobs & Gigs. */
        HIRING_COMPANY,
        /** May publish to News. */
        NEWS_OUTLET
    }

    /**
     * Where the application currently sits.
     *
     * <p>Only {@link #APPROVED} grants posting rights. {@link #SUSPENDED} exists separately
     * from {@link #REJECTED} so an admin can revoke a publisher who turned bad without
     * destroying the record of them having once been approved — and without it looking to
     * the user like their original application was refused.
     */
    public enum PublisherStatus {
        PENDING, APPROVED, REJECTED, SUSPENDED
    }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** The applying account. Not a JPA relation — see the class javadoc on cross-service use. */
    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PublisherType type;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private PublisherStatus status = PublisherStatus.PENDING;

    // ── What the applicant told us ───────────────────────────────────────────

    /** Trading name shown on every job/article they publish. */
    @Column(name = "company_name", nullable = false)
    private String companyName;

    /** Company / press registration number, for the reviewer to check against a registry. */
    @Column(name = "registration_number")
    private String registrationNumber;

    @Column(name = "website")
    private String website;

    /** Public-facing logo, shown on their job cards and article bylines. */
    @Column(name = "logo_url")
    private String logoUrl;

    /**
     * Supporting document (incorporation certificate, press credential).
     *
     * <p>Admin-only: this is the applicant's paperwork and must never appear in a public
     * publisher response — see {@code PublisherDto.publicView}.
     */
    @Column(name = "document_url")
    private String documentUrl;

    /** Free-text pitch from the applicant — what they intend to post. */
    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "contact_email")
    private String contactEmail;

    @Column(name = "contact_phone")
    private String contactPhone;

    // ── Review trail ─────────────────────────────────────────────────────────

    @Column(name = "applied_at", nullable = false)
    @Builder.Default
    private LocalDateTime appliedAt = LocalDateTime.now();

    @Column(name = "reviewed_at")
    private LocalDateTime reviewedAt;

    /** UUID of the admin who decided, so a bad approval can be traced back to a person. */
    @Column(name = "reviewed_by")
    private UUID reviewedBy;

    /** Shown to the applicant on rejection so they know what to fix before reapplying. */
    @Column(name = "review_note", columnDefinition = "TEXT")
    private String reviewNote;

    /** Convenience: the only status that grants posting rights. */
    public boolean isActive() {
        return status == PublisherStatus.APPROVED;
    }
}
