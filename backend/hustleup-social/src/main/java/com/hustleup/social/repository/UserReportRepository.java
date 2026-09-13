package com.hustleup.social.repository;

import com.hustleup.social.model.UserReport;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface UserReportRepository extends JpaRepository<UserReport, UUID> {

    /** The moderation queue, newest first. */
    List<UserReport> findAllByOrderByCreatedAtDesc();

    /** One status of the queue — in practice OPEN, which is what the console opens on. */
    List<UserReport> findByStatusOrderByCreatedAtDesc(UserReport.ReportStatus status);

    /** Badge count for the console's Reports tab. */
    long countByStatus(UserReport.ReportStatus status);

    /**
     * How many times each of these accounts has been reported.
     *
     * <p>Answers "has this person come up before?" for a whole page of reports in one query.
     * Asked per row otherwise, and it is asked on every row: a single complaint and a fourth
     * complaint about the same account are not the same thing to read, and the difference is
     * invisible without this.
     */
    List<UserReport> findByReportedIdIn(Collection<UUID> reportedIds);
}
