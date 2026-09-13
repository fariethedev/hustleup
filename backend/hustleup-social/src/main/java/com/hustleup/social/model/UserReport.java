package com.hustleup.social.model;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * A user-safety report: {@code reporterId} flagged {@code reportedId} with a
 * free-text reason.
 *
 * <p>Filing one still has no automatic effect on the reported account — nothing here
 * suspends, hides or limits anybody. What changed is that a report is now something a
 * moderator can act on and close, rather than a row nobody could read: the table was
 * write-only, with no endpoint reading it back, so every report ever filed went nowhere.
 *
 * <p>The moderation fields mirror {@code ProtectionClaim}'s deliberately — both are "a
 * person raised something, somebody has to decide" queues, and a moderator moving between
 * the two should not have to learn a second shape.
 */
@Entity
@Table(name = "user_reports")
@Data
public class UserReport {

    /**
     * Where a report has got to.
     *
     * <p>ACTIONED and DISMISSED are both closed states, kept apart because the difference
     * matters when the same account is reported again: "we looked and acted" and "we looked
     * and there was nothing in it" are very different things to read three reports deep.
     */
    public enum ReportStatus { OPEN, ACTIONED, DISMISSED }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "reporter_id", nullable = false)
    private UUID reporterId;

    @Column(name = "reported_id", nullable = false)
    private UUID reportedId;

    @Column(columnDefinition = "TEXT")
    private String reason;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    /** Never null: every report starts in the queue, and the column defaults to OPEN. */
    @Enumerated(EnumType.STRING)
    @Column(length = 20, nullable = false)
    private ReportStatus status = ReportStatus.OPEN;

    /**
     * Why the moderator closed it the way they did.
     *
     * <p>Free text, not a reason code — the useful part of a moderation decision is the
     * sentence explaining it to whoever reads the row next.
     */
    @Column(name = "moderator_note", columnDefinition = "TEXT")
    private String moderatorNote;

    /** The admin who closed it. Soft reference, so the audit trail outlives their account. */
    @Column(name = "resolved_by")
    private UUID resolvedBy;

    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;
}
