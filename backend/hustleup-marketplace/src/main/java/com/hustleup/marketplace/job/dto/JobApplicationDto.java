package com.hustleup.marketplace.job.dto;

import com.hustleup.marketplace.job.model.JobApplication;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * API shape of a job application.
 *
 * <p>{@code applicantName}/{@code applicantAvatarUrl} are joined in by the controller so
 * the hiring company sees a person rather than a UUID. {@code attachmentUrl} is only
 * populated for the job's owner — see {@link JobApplication#getAttachmentUrl()}.
 */
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class JobApplicationDto {

    private UUID id;
    private UUID jobId;
    private String jobTitle;
    private UUID applicantId;
    private String applicantName;
    private String applicantAvatarUrl;
    private String message;
    private String attachmentUrl;
    private String status;
    private LocalDateTime createdAt;

    public static JobApplicationDto from(JobApplication a) {
        if (a == null) return null;
        return JobApplicationDto.builder()
                .id(a.getId())
                .jobId(a.getJobId())
                .applicantId(a.getApplicantId())
                .message(a.getMessage())
                .attachmentUrl(a.getAttachmentUrl())
                .status(a.getStatus() != null ? a.getStatus().name() : null)
                .createdAt(a.getCreatedAt())
                .build();
    }
}
