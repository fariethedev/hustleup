package com.hustleup.marketplace.job.dto;

import com.hustleup.marketplace.job.model.Job;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/** API shape of a job advert. */
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class JobDto {

    private UUID id;
    private UUID publisherUserId;
    private String companyName;
    private String companyLogoUrl;

    private String title;
    private String description;
    private String category;
    private String location;
    private boolean remote;
    private String jobType;

    private BigDecimal salaryMin;
    private BigDecimal salaryMax;
    private String salaryCurrency;
    private String salaryPeriod;

    private List<String> mediaUrls;
    private List<String> tags;

    private String status;
    private int applicationsCount;
    private int viewsCount;
    private LocalDateTime createdAt;
    private LocalDateTime expiresAt;

    /**
     * Whether the signed-in caller has already applied.
     *
     * <p>Computed per-request rather than stored, so the board can render "Applied" on the
     * right cards without the client having to fetch its own applications and diff them.
     * Null for anonymous callers.
     */
    private Boolean appliedByCurrentUser;

    /** True only for the advert's owner — gates the edit/close controls in the UI. */
    private Boolean ownedByCurrentUser;

    /**
     * Set on adverts aggregated from an outside board; null on native ones.
     *
     * <p>The client needs both: {@code sourceName} to credit the board and to know there is
     * no employer here to apply to, and {@code sourceUrl} to send the candidate to where
     * applying actually happens. Showing an Apply button on an imported advert would
     * collect a CV nobody would ever read.
     */
    private String sourceName;
    private String sourceUrl;

    public static JobDto from(Job j, Boolean applied, Boolean owned) {
        if (j == null) return null;
        return JobDto.builder()
                .id(j.getId())
                .publisherUserId(j.getPublisherUserId())
                .companyName(j.getCompanyName())
                .companyLogoUrl(j.getCompanyLogoUrl())
                .title(j.getTitle())
                .description(j.getDescription())
                .category(j.getCategory())
                .location(j.getLocation())
                .remote(j.isRemote())
                .jobType(j.getJobType() != null ? j.getJobType().name() : null)
                .salaryMin(j.getSalaryMin())
                .salaryMax(j.getSalaryMax())
                .salaryCurrency(j.getSalaryCurrency())
                .salaryPeriod(j.getSalaryPeriod())
                // Defensive copies: these are lazy Hibernate collections, and handing the
                // live proxy to Jackson outside the session is how you get a
                // LazyInitializationException at serialisation time.
                .mediaUrls(j.getMediaUrls() != null ? new ArrayList<>(j.getMediaUrls()) : List.of())
                .tags(j.getTags() != null ? new ArrayList<>(j.getTags()) : List.of())
                .status(j.getStatus() != null ? j.getStatus().name() : null)
                .applicationsCount(j.getApplicationsCount())
                .viewsCount(j.getViewsCount())
                .createdAt(j.getCreatedAt())
                .expiresAt(j.getExpiresAt())
                .appliedByCurrentUser(applied)
                .ownedByCurrentUser(owned)
                .sourceName(j.getSourceName())
                .sourceUrl(j.getSourceUrl())
                .build();
    }
}
