package com.hustleup.social.controller;

import com.hustleup.common.model.User;
import com.hustleup.common.repository.UserRepository;
import com.hustleup.social.model.UserReport;
import com.hustleup.social.repository.UserReportRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * The moderation queue for user safety reports.
 *
 * <h2>Why this exists</h2>
 * <p>{@code user_reports} has been write-only since it was added. {@code FollowController}
 * inserts a row, the reporter is told their report was submitted, and nothing ever read the
 * table back — there was no endpoint, in any service, that could. Every report anyone has
 * ever filed went straight into a table nobody could open, and the reporter was thanked for
 * it. This is the read side that was missing.
 *
 * <h2>Where it lives</h2>
 * <p>In {@code hustleup-social}, because the reports are this service's data, following the
 * same split as {@code AdminOrderController} over in marketplace: the admin API is assembled
 * at the gateway from whichever service owns each piece, so the console sees one
 * {@code /api/v1/admin/**} surface. The gateway needs a route for this prefix pointing here,
 * declared before the catch-all that sends {@code /api/v1/admin/**} to auth.
 *
 * <p>Every method is {@code hasRole('ADMIN')}, doubled by the URL rule in
 * {@code CommonSecurityConfig}.
 */
@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@Slf4j
public class AdminReportController {

    private final UserReportRepository userReportRepository;
    private final UserRepository userRepository;

    /**
     * The queue.
     *
     * <p><b>GET /api/v1/admin/reports?status=OPEN|ACTIONED|DISMISSED|ALL</b> — defaults to
     * OPEN, which is what a moderator opening the console actually wants to see.
     *
     * <p>Rows carry both accounts inline. The moderation question is always "what did this
     * person do to that person", and neither is answerable from a pair of UUIDs — an admin
     * should not have to run two lookups per row before they can read it.
     */
    @GetMapping("/reports")
    public ResponseEntity<?> reports(@RequestParam(required = false, defaultValue = "OPEN") String status) {
        List<UserReport> rows;
        if ("ALL".equalsIgnoreCase(status)) {
            rows = userReportRepository.findAllByOrderByCreatedAtDesc();
        } else {
            UserReport.ReportStatus wanted;
            try {
                wanted = UserReport.ReportStatus.valueOf(status.toUpperCase());
            } catch (IllegalArgumentException e) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "Unknown status. Allowed: OPEN, ACTIONED, DISMISSED, ALL"));
            }
            rows = userReportRepository.findByStatusOrderByCreatedAtDesc(wanted);
        }

        // Every account named anywhere on this page, fetched once. Resolving names row by row
        // would be two queries per report, and this page exists to be scanned quickly.
        Set<UUID> people = new HashSet<>();
        rows.forEach(r -> { people.add(r.getReporterId()); people.add(r.getReportedId()); });
        Map<UUID, User> byId = userRepository.findAllById(people).stream()
                .collect(Collectors.toMap(User::getId, u -> u, (a, b) -> a));

        // How many times each reported account has come up, across every status. A first
        // complaint and a fourth complaint about the same person are not the same thing to
        // read, and without this they look identical.
        Map<UUID, Long> priorReports = rows.isEmpty() ? Map.of()
                : userReportRepository.findByReportedIdIn(
                        rows.stream().map(UserReport::getReportedId).collect(Collectors.toSet()))
                    .stream()
                    .collect(Collectors.groupingBy(UserReport::getReportedId, Collectors.counting()));

        List<Map<String, Object>> out = rows.stream()
                .map(r -> describe(r, byId, priorReports))
                .collect(Collectors.toList());

        return ResponseEntity.ok(Map.of(
                "reports", out,
                "openCount", userReportRepository.countByStatus(UserReport.ReportStatus.OPEN)));
    }

    /**
     * Closes a report, or puts it back in the queue.
     *
     * <p><b>PATCH /api/v1/admin/reports/{id}</b> — body {@code {"status": "ACTIONED",
     * "note": "why"}}.
     *
     * <p>Deliberately does nothing to the reported account. Suspending, verifying and role
     * changes already live behind {@code /admin/users/{id}}, and a moderator deciding a
     * report should be able to record that decision without it silently carrying a
     * punishment — the two are separate calls because they are separate judgements.
     */
    @PatchMapping("/reports/{id}")
    public ResponseEntity<?> resolve(@PathVariable UUID id, @RequestBody Map<String, String> body) {
        UserReport report = userReportRepository.findById(id).orElse(null);
        if (report == null) return ResponseEntity.notFound().build();

        String requested = body.get("status");
        if (requested != null && !requested.isBlank()) {
            try {
                report.setStatus(UserReport.ReportStatus.valueOf(requested.toUpperCase()));
            } catch (IllegalArgumentException e) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "Unknown status. Allowed: OPEN, ACTIONED, DISMISSED"));
            }
        }

        String note = body.get("note");
        if (note != null) report.setModeratorNote(note.isBlank() ? null : note.trim());

        if (report.getStatus() == UserReport.ReportStatus.OPEN) {
            // Reopening clears the decision rather than leaving a stale "closed by" on a row
            // that is open again — that trail would read as though someone had closed it and
            // it had bounced back on its own.
            report.setResolvedBy(null);
            report.setResolvedAt(null);
        } else {
            report.setResolvedBy(currentUserId());
            report.setResolvedAt(LocalDateTime.now());
        }

        userReportRepository.save(report);
        log.info("Report {} set to {} by admin", id, report.getStatus());

        Map<UUID, User> byId = userRepository
                .findAllById(List.of(report.getReporterId(), report.getReportedId())).stream()
                .collect(Collectors.toMap(User::getId, u -> u, (a, b) -> a));
        return ResponseEntity.ok(describe(report, byId, Map.of()));
    }

    // ---- Helpers ------------------------------------------------------------

    /** Flattens a report plus both accounts into one row a moderator can read without lookups. */
    private Map<String, Object> describe(UserReport r, Map<UUID, User> byId, Map<UUID, Long> priorReports) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", r.getId());
        m.put("reason", r.getReason());
        m.put("status", r.getStatus());
        m.put("moderatorNote", r.getModeratorNote());
        m.put("resolvedAt", r.getResolvedAt());
        m.put("createdAt", r.getCreatedAt());

        m.put("reporterId", r.getReporterId());
        m.put("reportedId", r.getReportedId());
        put(m, byId.get(r.getReporterId()), "reporter");
        put(m, byId.get(r.getReportedId()), "reported");

        // Includes this report, so it reads as "3rd report about this account", not "3 others".
        m.put("reportsAgainstReported", priorReports.getOrDefault(r.getReportedId(), 1L));
        return m;
    }

    /**
     * Copies the identifying fields of one account onto the row under a prefix.
     *
     * <p>A missing user is left out rather than written as nulls: the account may since have
     * been deleted, and a row that simply has no reporter name is easier to read than one
     * claiming a reporter called null.
     */
    private void put(Map<String, Object> m, User u, String prefix) {
        if (u == null) return;
        m.put(prefix + "Name", u.getFullName());
        m.put(prefix + "Email", u.getEmail());
        m.put(prefix + "Username", u.getUsername());
        m.put(prefix + "AvatarUrl", u.getAvatarUrl());
    }

    private UUID currentUserId() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email).map(User::getId).orElseThrow();
    }
}
