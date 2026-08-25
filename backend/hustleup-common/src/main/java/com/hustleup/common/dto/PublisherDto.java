package com.hustleup.common.dto;

import com.hustleup.common.model.PublisherProfile;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * API representation of a {@link PublisherProfile}.
 *
 * <p><b>Two projections, deliberately:</b> {@link #ownerView} is what the applicant and the
 * admin see — it includes the review note and the supporting document. {@link #publicView}
 * is what everyone else sees attached to a job card or article byline, and drops the
 * document URL, the registration number and the contact details.
 *
 * <p>That split matters: {@code documentUrl} points at somebody's incorporation
 * certificate or press credential. Those are uploaded for a reviewer, not for the public,
 * and {@code /uploads/**} is served without authentication — so a leaked URL is the
 * document itself, not just a reference to it.
 */
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class PublisherDto {

    private UUID id;
    private UUID userId;
    private String type;
    private String status;
    private String companyName;
    private String website;
    private String logoUrl;
    private String description;

    // Owner/admin only — null on publicView()
    private String registrationNumber;
    private String documentUrl;
    private String contactEmail;
    private String contactPhone;
    private String reviewNote;
    private LocalDateTime appliedAt;
    private LocalDateTime reviewedAt;

    /** Full view: for the applicant looking at their own application, and for admins. */
    public static PublisherDto ownerView(PublisherProfile p) {
        if (p == null) return null;
        return PublisherDto.builder()
                .id(p.getId())
                .userId(p.getUserId())
                .type(p.getType() != null ? p.getType().name() : null)
                .status(p.getStatus() != null ? p.getStatus().name() : null)
                .companyName(p.getCompanyName())
                .website(p.getWebsite())
                .logoUrl(p.getLogoUrl())
                .description(p.getDescription())
                .registrationNumber(p.getRegistrationNumber())
                .documentUrl(p.getDocumentUrl())
                .contactEmail(p.getContactEmail())
                .contactPhone(p.getContactPhone())
                .reviewNote(p.getReviewNote())
                .appliedAt(p.getAppliedAt())
                .reviewedAt(p.getReviewedAt())
                .build();
    }

    /** Safe view: the branding shown next to a published job or article, nothing more. */
    public static PublisherDto publicView(PublisherProfile p) {
        if (p == null) return null;
        return PublisherDto.builder()
                .id(p.getId())
                .userId(p.getUserId())
                .type(p.getType() != null ? p.getType().name() : null)
                .status(p.getStatus() != null ? p.getStatus().name() : null)
                .companyName(p.getCompanyName())
                .website(p.getWebsite())
                .logoUrl(p.getLogoUrl())
                .description(p.getDescription())
                .build();
    }
}
