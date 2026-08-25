package com.hustleup.marketplace.job.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Somebody applying to a {@link Job}.
 *
 * <p>Replaces the old Jobs page behaviour, where "Apply" fired a toast and kept the state
 * in a {@code Set} in component memory — so the application reached nobody and vanished on
 * refresh. Each row here is a real application the hiring company can read and act on.
 *
 * <p>The unique constraint on {@code (job_id, applicant_id)} makes applying idempotent: a
 * double-click, or a user returning to a job they already applied to, cannot produce two
 * applications or double-count {@code applicationsCount}.
 */
@Entity
@Table(name = "job_applications", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"job_id", "applicant_id"})
})
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor @Builder
public class JobApplication {

    /** Where the applicant stands. The company drives these; the applicant only sees them. */
    public enum ApplicationStatus { SUBMITTED, REVIEWING, SHORTLISTED, REJECTED, HIRED, WITHDRAWN }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "job_id", nullable = false)
    private UUID jobId;

    @Column(name = "applicant_id", nullable = false)
    private UUID applicantId;

    /** Cover note. Optional — a gig application is often just "I'm available". */
    @Column(name = "message", columnDefinition = "TEXT")
    private String message;

    /**
     * Optional CV/portfolio the applicant attached.
     *
     * <p>Visible only to the job's owner and to admins: it carries the applicant's contact
     * details and history, and {@code /uploads/**} is served without authentication, so
     * this URL must never appear in a public response.
     */
    @Column(name = "attachment_url")
    private String attachmentUrl;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private ApplicationStatus status = ApplicationStatus.SUBMITTED;

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
