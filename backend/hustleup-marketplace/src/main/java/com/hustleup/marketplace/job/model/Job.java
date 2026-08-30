package com.hustleup.marketplace.job.model;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * A job or gig advertised by a verified hiring company.
 *
 * <h2>Why this is not a {@code Listing}</h2>
 * <p>A listing is a thing you buy: it has a price the buyer pays, a booking, and a payout
 * to the seller. A job is the inverse — the poster pays the applicant — and its lifecycle
 * is applications and hiring, not checkout and fulfilment. Forcing both through one entity
 * would mean every listing query carrying "...and not a job" and every payment path
 * carrying a branch that must never fire. They are separate tables for that reason.
 *
 * <h2>Publisher snapshot</h2>
 * <p>{@code companyName} and {@code companyLogoUrl} are copied from the poster's
 * {@link com.hustleup.common.model.PublisherProfile} at post time rather than joined on
 * read. A job advert is a record of what was advertised, by whom, on that day — if a
 * company later rebrands or is suspended, historical adverts should still show what the
 * applicant actually saw and applied to.
 */
@Entity
@Table(name = "jobs")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor @Builder
public class Job {

    /** Employment shape, shown as a chip on the card and used as a filter. */
    public enum JobType { FULL_TIME, PART_TIME, CONTRACT, TEMPORARY, INTERNSHIP, GIG }

    /**
     * Publication state.
     *
     * <p>{@code CLOSED} is the poster saying "we've hired"; {@code EXPIRED} is the clock
     * running out. Both hide the advert from the board, but they are kept distinct because
     * only one of them reflects a decision the company made, and applicants are told which.
     */
    public enum JobStatus { OPEN, CLOSED, EXPIRED, REMOVED }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    // ── Who posted it ────────────────────────────────────────────────────────

    /** The posting user (the publisher's owning account). */
    /**
     * The HustleSpace account that posted this, or null for an imported advert.
     *
     * <p>Nullable because aggregated adverts belong to an outside board, not to a verified
     * hiring company here. Inventing a synthetic publisher for them would put a fake
     * employer on a real job and break "adverts by this company".
     */
    @Column(name = "publisher_user_id")
    private UUID publisherUserId;

    /** The PublisherProfile row that authorised this post — kept for audit. */
    @Column(name = "publisher_profile_id")
    private UUID publisherProfileId;

    /** Snapshot — see class javadoc. */
    @Column(name = "company_name", nullable = false)
    private String companyName;

    @Column(name = "company_logo_url")
    private String companyLogoUrl;

    // ── The advert ───────────────────────────────────────────────────────────

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String description;

    /** Free-form category slug, matching the board's filter chips (e.g. "factory"). */
    @Column(name = "category")
    private String category;

    @Column(name = "location")
    private String location;

    /** True for fully-remote roles, so the board can filter without parsing {@code location}. */
    @Column(name = "remote")
    @Builder.Default
    private boolean remote = false;

    @Enumerated(EnumType.STRING)
    @Column(name = "job_type", nullable = false)
    @Builder.Default
    private JobType jobType = JobType.FULL_TIME;

    // ── Pay ──────────────────────────────────────────────────────────────────
    // Stored as a numeric range plus a period rather than a display string, so the board
    // can filter and sort by pay. The UI formats these; it never parses them back.

    @Column(name = "salary_min", precision = 12, scale = 2)
    private BigDecimal salaryMin;

    @Column(name = "salary_max", precision = 12, scale = 2)
    private BigDecimal salaryMax;

    @Column(name = "salary_currency")
    @Builder.Default
    private String salaryCurrency = "PLN";

    /** "HOUR", "DAY", "MONTH", "YEAR", or "PROJECT" for fixed-fee gigs. */
    @Column(name = "salary_period")
    @Builder.Default
    private String salaryPeriod = "MONTH";

    // ── Media ────────────────────────────────────────────────────────────────

    /**
     * Photos or clips attached to the advert — the workplace, the team, the kit.
     *
     * <p>An {@code @ElementCollection} rather than a delimited string so a job can be
     * queried by media presence and so adding one doesn't mean rewriting the row's text.
     * {@code LAZY} because the board lists dozens of jobs at a time and only the detail
     * view needs the full set.
     */
    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "job_media", joinColumns = @JoinColumn(name = "job_id"))
    @Column(name = "media_url", length = 1024)
    @Builder.Default
    private List<String> mediaUrls = new ArrayList<>();

    /** Short highlight chips ("Night shift", "Sign-on bonus"). */
    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "job_tags", joinColumns = @JoinColumn(name = "job_id"))
    @Column(name = "tag")
    @Builder.Default
    private List<String> tags = new ArrayList<>();

    // ── Lifecycle ────────────────────────────────────────────────────────────

    // ---- Aggregation --------------------------------------------------------
    // Set only on adverts pulled from an outside board; all null for native ones.

    /**
     * The board this was fetched from, e.g. "Adzuna".
     *
     * <p>Doubles as the "not ours" flag. An imported advert cannot be applied to through
     * HustleSpace — there is nobody here to receive the application — so the client sends
     * the candidate to {@link #sourceUrl} instead of showing an Apply button that would
     * drop their CV into a void.
     */
    @Column(name = "source_name")
    private String sourceName;

    /** The advert on the board it came from — where applying actually happens. */
    @Column(name = "source_url", length = 1024)
    private String sourceUrl;

    /** The board's own id for this advert. The dedupe key across repeated imports. */
    @Column(name = "external_id", length = 512)
    private String externalId;

    /** True when this came from an outside board rather than a HustleSpace employer. */
    public boolean isImported() {
        return sourceName != null && !sourceName.isBlank();
    }

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private JobStatus status = JobStatus.OPEN;

    @Column(name = "applications_count", nullable = false)
    @Builder.Default
    private int applicationsCount = 0;

    @Column(name = "views_count", nullable = false)
    @Builder.Default
    private int viewsCount = 0;

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    /** When the advert stops showing. Null means it runs until the poster closes it. */
    @Column(name = "expires_at")
    private LocalDateTime expiresAt;

    /** Whether this advert should currently appear on the board. */
    public boolean isLive() {
        if (status != JobStatus.OPEN) return false;
        return expiresAt == null || expiresAt.isAfter(LocalDateTime.now());
    }
}
