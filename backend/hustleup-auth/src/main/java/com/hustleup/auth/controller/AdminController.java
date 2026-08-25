package com.hustleup.auth.controller;

import com.hustleup.common.dto.PublisherDto;
import com.hustleup.common.dto.UserDto;
import com.hustleup.common.email.EmailService;
import com.hustleup.common.model.PublisherProfile;
import com.hustleup.common.model.Role;
import com.hustleup.common.model.User;
import com.hustleup.common.repository.PublisherProfileRepository;
import com.hustleup.common.repository.UserRepository;
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
 * Admin back-office: publisher review, user management and support tooling.
 *
 * <h2>Authorisation</h2>
 * <p>Every method carries {@code @PreAuthorize("hasRole('ADMIN')")}, and the whole
 * {@code /api/v1/admin/**} prefix is additionally gated in {@code CommonSecurityConfig}.
 * That doubling is deliberate: the URL rule is the broad net that catches any endpoint
 * added to this package later and forgotten, and the annotation is the one that survives
 * if a future route change accidentally widens the URL matcher.
 *
 * <h2>Why the admin sees full PII here</h2>
 * <p>These endpoints return {@link UserDto#fromEntity}, the self-view including email,
 * phone and address — the opposite of the public projection used everywhere else. That is
 * the entire point of a support console: resolving "my order went to the wrong address"
 * requires seeing the address. It is safe only because of the role gate above.
 */
@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@Slf4j
public class AdminController {

    private final UserRepository userRepository;
    private final PublisherProfileRepository publisherRepository;
    private final EmailService emailService;

    private User currentAdmin() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return auth == null ? null : userRepository.findByEmail(auth.getName()).orElse(null);
    }

    // ---- Dashboard ----------------------------------------------------------

    /**
     * Headline counters for the admin home.
     *
     * <p><b>GET /api/v1/admin/stats</b>
     */
    @GetMapping("/stats")
    public ResponseEntity<?> stats() {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("totalUsers", userRepository.count());
        out.put("pendingPublishers", publisherRepository.countByStatus(PublisherProfile.PublisherStatus.PENDING));
        out.put("approvedPublishers", publisherRepository.countByStatus(PublisherProfile.PublisherStatus.APPROVED));
        out.put("rejectedPublishers", publisherRepository.countByStatus(PublisherProfile.PublisherStatus.REJECTED));
        out.put("suspendedPublishers", publisherRepository.countByStatus(PublisherProfile.PublisherStatus.SUSPENDED));
        return ResponseEntity.ok(out);
    }

    // ---- Publisher review ---------------------------------------------------

    /**
     * The review queue.
     *
     * <p><b>GET /api/v1/admin/publishers?status=PENDING</b> - omit status for everything.
     * Each entry is enriched with the applicant's name and email so the reviewer does not
     * have to cross-reference a UUID against the users table by hand.
     */
    @GetMapping("/publishers")
    public ResponseEntity<?> publishers(@RequestParam(required = false) String status) {
        List<PublisherProfile> rows;
        if (status == null || status.isBlank() || "ALL".equalsIgnoreCase(status)) {
            rows = publisherRepository.findAllByOrderByAppliedAtDesc();
        } else {
            try {
                rows = publisherRepository.findByStatusOrderByAppliedAtAsc(
                        PublisherProfile.PublisherStatus.valueOf(status.toUpperCase()));
            } catch (IllegalArgumentException e) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "Invalid status. Allowed: PENDING, APPROVED, REJECTED, SUSPENDED, ALL"));
            }
        }

        List<Map<String, Object>> out = rows.stream().map(p -> {
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("profile", PublisherDto.ownerView(p));
            userRepository.findById(p.getUserId()).ifPresent(u -> {
                entry.put("applicantName", u.getFullName());
                entry.put("applicantEmail", u.getEmail());
                entry.put("applicantAvatarUrl", u.getAvatarUrl());
                entry.put("applicantIdVerified", u.isIdVerified());
            });
            return entry;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(out);
    }

    /**
     * Approves, rejects, or suspends a publisher application.
     *
     * <p><b>PATCH /api/v1/admin/publishers/{id}/decision</b>
     * Body: {@code {"status":"APPROVED","note":"optional reason"}}
     *
     * <p>The decision is stamped with the deciding admin's id and the time, so a bad
     * approval can always be traced to a person. The applicant is emailed on a decision —
     * best-effort, because a mail outage must not roll back a completed review.
     */
    @PatchMapping("/publishers/{id}/decision")
    public ResponseEntity<?> decide(@PathVariable UUID id, @RequestBody Map<String, String> body) {
        PublisherProfile profile = publisherRepository.findById(id).orElse(null);
        if (profile == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Application not found"));
        }

        PublisherProfile.PublisherStatus next;
        try {
            next = PublisherProfile.PublisherStatus.valueOf(String.valueOf(body.get("status")).toUpperCase());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Invalid status. Allowed: PENDING, APPROVED, REJECTED, SUSPENDED"));
        }

        User admin = currentAdmin();
        profile.setStatus(next);
        profile.setReviewNote(body.get("note"));
        profile.setReviewedAt(LocalDateTime.now());
        profile.setReviewedBy(admin != null ? admin.getId() : null);
        PublisherProfile saved = publisherRepository.save(profile);

        log.info("Publisher {} -> {} by admin={}", id, next, admin != null ? admin.getId() : "unknown");
        notifyApplicant(saved);
        return ResponseEntity.ok(PublisherDto.ownerView(saved));
    }

    // ---- Users / support ----------------------------------------------------

    /**
     * User search for support.
     *
     * <p><b>GET /api/v1/admin/users?q=…</b> - matches name or email, capped at 100.
     * Returns the full self-view including contact details; see the class javadoc.
     */
    @GetMapping("/users")
    public ResponseEntity<?> users(@RequestParam(required = false) String q) {
        String needle = q == null ? "" : q.trim().toLowerCase();
        List<UserDto> out = userRepository.findAll().stream()
                .filter(u -> needle.isEmpty()
                        || (u.getFullName() != null && u.getFullName().toLowerCase().contains(needle))
                        || (u.getEmail() != null && u.getEmail().toLowerCase().contains(needle)))
                .limit(100)
                .map(UserDto::fromEntity)
                .collect(Collectors.toList());
        return ResponseEntity.ok(out);
    }

    /**
     * One user in full, with their publisher applications attached.
     *
     * <p><b>GET /api/v1/admin/users/{id}</b>
     */
    @GetMapping("/users/{id}")
    public ResponseEntity<?> user(@PathVariable UUID id) {
        User u = userRepository.findById(id).orElse(null);
        if (u == null) return ResponseEntity.status(404).body(Map.of("error", "User not found"));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("user", UserDto.fromEntity(u));
        out.put("publishers", publisherRepository.findByUserId(id)
                .stream().map(PublisherDto::ownerView).collect(Collectors.toList()));
        return ResponseEntity.ok(out);
    }

    /**
     * Support fixes on an account: ID verification, and role changes.
     *
     * <p><b>PATCH /api/v1/admin/users/{id}</b>
     * Body may contain {@code idVerified} (bool) and/or {@code role}.
     *
     * <p>An admin cannot demote themselves. Removing your own ADMIN role is a one-way door
     * in a system whose only route back is a manual database edit, and it is an easy
     * misclick when the button sits on your own row in a user list.
     */
    @PatchMapping("/users/{id}")
    public ResponseEntity<?> updateUser(@PathVariable UUID id, @RequestBody Map<String, Object> body) {
        User u = userRepository.findById(id).orElse(null);
        if (u == null) return ResponseEntity.status(404).body(Map.of("error", "User not found"));
        User admin = currentAdmin();

        if (body.containsKey("idVerified")) {
            u.setIdVerified(Boolean.TRUE.equals(body.get("idVerified")));
        }
        if (body.containsKey("role") && body.get("role") != null) {
            if (admin != null && admin.getId().equals(u.getId())) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "You cannot change your own role"));
            }
            try {
                u.setRole(Role.valueOf(String.valueOf(body.get("role")).toUpperCase()));
            } catch (IllegalArgumentException e) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "Invalid role. Allowed: BUYER, SELLER, ADMIN"));
            }
        }
        u.setUpdatedAt(LocalDateTime.now());
        log.info("Admin {} updated user {}", admin != null ? admin.getId() : "unknown", id);
        return ResponseEntity.ok(UserDto.fromEntity(userRepository.save(u)));
    }

    // ---- Helpers ------------------------------------------------------------

    /** Emails the applicant their verdict. Best-effort — never fails the review. */
    private void notifyApplicant(PublisherProfile profile) {
        try {
            User applicant = userRepository.findById(profile.getUserId()).orElse(null);
            if (applicant == null) return;
            String what = profile.getType() == PublisherProfile.PublisherType.HIRING_COMPANY
                    ? "hiring company" : "news outlet";
            String subject;
            String message;
            switch (profile.getStatus()) {
                case APPROVED -> {
                    subject = "You are now a verified " + what + " on HustleSpace";
                    message = "<p>Good news — <strong>" + profile.getCompanyName() + "</strong> has been verified.</p>"
                            + "<p>You can now publish from your dashboard.</p>";
                }
                case REJECTED -> {
                    subject = "Your HustleSpace " + what + " application";
                    message = "<p>We could not verify <strong>" + profile.getCompanyName() + "</strong> this time.</p>"
                            + (profile.getReviewNote() != null && !profile.getReviewNote().isBlank()
                               ? "<p>Reviewer note: " + profile.getReviewNote() + "</p>" : "")
                            + "<p>You are welcome to apply again with updated details.</p>";
                }
                case SUSPENDED -> {
                    subject = "Your HustleSpace publishing access has been suspended";
                    message = "<p>Publishing for <strong>" + profile.getCompanyName() + "</strong> is suspended.</p>"
                            + (profile.getReviewNote() != null && !profile.getReviewNote().isBlank()
                               ? "<p>Reason: " + profile.getReviewNote() + "</p>" : "");
                }
                default -> { return; } // back to PENDING needs no email
            }
            emailService.send(applicant.getEmail(), subject, message);
        } catch (Exception e) {
            log.warn("Could not email publisher decision for {}: {}", profile.getId(), e.getMessage());
        }
    }
}
