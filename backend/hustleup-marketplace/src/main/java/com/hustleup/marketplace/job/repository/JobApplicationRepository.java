package com.hustleup.marketplace.job.repository;

import com.hustleup.marketplace.job.model.JobApplication;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Data access for job applications. */
@Repository
public interface JobApplicationRepository extends JpaRepository<JobApplication, UUID> {

    /** The company's inbox for one advert, newest applicant first. */
    List<JobApplication> findByJobIdOrderByCreatedAtDesc(UUID jobId);

    /** Everything this user has applied to — their "my applications" view. */
    List<JobApplication> findByApplicantIdOrderByCreatedAtDesc(UUID applicantId);

    /** Backs the idempotent apply: if this exists, the user already applied. */
    Optional<JobApplication> findByJobIdAndApplicantId(UUID jobId, UUID applicantId);

    /** Lets the board mark which adverts the current user has already applied to. */
    List<JobApplication> findByApplicantIdAndJobIdIn(UUID applicantId, List<UUID> jobIds);

    long countByJobId(UUID jobId);
}
