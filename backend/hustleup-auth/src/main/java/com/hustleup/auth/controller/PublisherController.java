package com.hustleup.auth.controller;

import com.hustleup.common.dto.PublisherDto;
import com.hustleup.common.model.PublisherProfile;
import com.hustleup.common.model.User;
import com.hustleup.common.repository.PublisherProfileRepository;
import com.hustleup.common.repository.UserRepository;
import com.hustleup.common.storage.FileStorageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Applying to become a verified publisher, and checking where that application stands.
 *
 * <p>This is the user-facing half of the publisher system. The reviewing half lives in
 * {@link AdminController}. A seller applies here as a hiring company or a news outlet, the
 * application sits {@code PENDING}, and an admin approves it — only then does
 * {@code PublisherGuard} let them post.
 */
@RestController
@RequestMapping("/api/v1/publishers")
@RequiredArgsConstructor
@Slf4j
public class PublisherController {

    private final PublisherProfileRepository publisherRepository;
    private final UserRepository userRepository;
    private final FileStorageService fileStorageService;

    private User currentUser() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null || "anonymousUser".equals(auth.getName())) return null;
        return userRepository.findByEmail(auth.getName()).orElse(null);
    }

    /**
     * Applies to become a verified hiring company or news outlet.
     *
     * <p><b>POST /api/v1/publishers/apply</b> - multipart, so the logo and supporting
     * document upload with the form.
     *
     * <p>Re-applying after a rejection reuses the same row and resets it to PENDING, which
     * is why the unique constraint on (user_id, type) does not block a second attempt.
     * Re-applying while already APPROVED is refused — that would silently strip a live
     * publisher of their posting rights until someone re-approved them.
     */
    @PostMapping(value = "/apply", consumes = "multipart/form-data")
    public ResponseEntity<?> apply(@RequestParam String type,
                                   @RequestParam String companyName,
                                   @RequestParam(required = false) String registrationNumber,
                                   @RequestParam(required = false) String website,
                                   @RequestParam(required = false) String description,
                                   @RequestParam(required = false) String contactEmail,
                                   @RequestParam(required = false) String contactPhone,
                                   @RequestParam(required = false) MultipartFile logo,
                                   @RequestParam(required = false) MultipartFile document) {
        User me = currentUser();
        if (me == null) return ResponseEntity.status(401).body(Map.of("error", "Sign in first"));

        PublisherProfile.PublisherType parsedType;
        try {
            parsedType = PublisherProfile.PublisherType.valueOf(type.toUpperCase());
        } catch (IllegalArgumentException e) {
            return badRequest("Invalid type. Allowed: HIRING_COMPANY, NEWS_OUTLET");
        }
        if (companyName == null || companyName.isBlank()) {
            return badRequest("Company or outlet name is required");
        }

        PublisherProfile profile = publisherRepository
                .findByUserIdAndType(me.getId(), parsedType).orElse(null);

        if (profile != null && profile.getStatus() == PublisherProfile.PublisherStatus.APPROVED) {
            return badRequest("You are already a verified " + label(parsedType));
        }
        if (profile != null && profile.getStatus() == PublisherProfile.PublisherStatus.SUSPENDED) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "Your publishing access is suspended. Contact support."));
        }

        String logoUrl = null;
        String documentUrl = null;
        try {
            if (logo != null && !logo.isEmpty()) logoUrl = fileStorageService.store(logo);
            if (document != null && !document.isEmpty()) documentUrl = fileStorageService.store(document);
        } catch (IllegalArgumentException e) {
            return badRequest(e.getMessage());
        }

        if (profile == null) {
            profile = PublisherProfile.builder().userId(me.getId()).type(parsedType).build();
        }
        profile.setCompanyName(companyName.trim());
        profile.setRegistrationNumber(registrationNumber);
        profile.setWebsite(website);
        profile.setDescription(description);
        profile.setContactEmail(contactEmail != null ? contactEmail : me.getEmail());
        profile.setContactPhone(contactPhone);
        if (logoUrl != null) profile.setLogoUrl(logoUrl);
        if (documentUrl != null) profile.setDocumentUrl(documentUrl);
        // A resubmission is a fresh application: clear the previous verdict so the queue
        // does not still show the old rejection note next to new evidence.
        profile.setStatus(PublisherProfile.PublisherStatus.PENDING);
        profile.setAppliedAt(java.time.LocalDateTime.now());
        profile.setReviewedAt(null);
        profile.setReviewedBy(null);
        profile.setReviewNote(null);

        PublisherProfile saved = publisherRepository.save(profile);
        log.info("Publisher application: user={} type={} name={}", me.getId(), parsedType, companyName);
        return ResponseEntity.status(HttpStatus.CREATED).body(PublisherDto.ownerView(saved));
    }

    /**
     * The caller's own publisher applications, and what they are allowed to post.
     *
     * <p><b>GET /api/v1/publishers/me</b> - the UI uses {@code canPostJobs} /
     * {@code canPostNews} to decide whether to show the composer or the apply prompt,
     * rather than re-deriving the rule client-side and risking it drifting from the server.
     */
    @GetMapping("/me")
    public ResponseEntity<?> mine() {
        User me = currentUser();
        if (me == null) return ResponseEntity.status(401).build();

        List<PublisherProfile> profiles = publisherRepository.findByUserId(me.getId());
        boolean isAdmin = me.getRole() == com.hustleup.common.model.Role.ADMIN;

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("profiles", profiles.stream().map(PublisherDto::ownerView).collect(Collectors.toList()));
        out.put("canPostJobs", isAdmin || profiles.stream().anyMatch(p ->
                p.getType() == PublisherProfile.PublisherType.HIRING_COMPANY && p.isActive()));
        out.put("canPostNews", isAdmin || profiles.stream().anyMatch(p ->
                p.getType() == PublisherProfile.PublisherType.NEWS_OUTLET && p.isActive()));
        out.put("isAdmin", isAdmin);
        return ResponseEntity.ok(out);
    }

    /**
     * The public directory of verified publishers of one kind.
     *
     * <p><b>GET /api/v1/publishers?type=HIRING_COMPANY</b> - public, and deliberately
     * serves {@code publicView}, which drops the registration number, contact details and
     * supporting document.
     */
    @GetMapping
    public ResponseEntity<?> directory(@RequestParam String type) {
        PublisherProfile.PublisherType parsedType;
        try {
            parsedType = PublisherProfile.PublisherType.valueOf(type.toUpperCase());
        } catch (IllegalArgumentException e) {
            return badRequest("Invalid type. Allowed: HIRING_COMPANY, NEWS_OUTLET");
        }
        return ResponseEntity.ok(publisherRepository
                .findByTypeAndStatus(parsedType, PublisherProfile.PublisherStatus.APPROVED)
                .stream().map(PublisherDto::publicView).collect(Collectors.toList()));
    }

    private String label(PublisherProfile.PublisherType t) {
        return t == PublisherProfile.PublisherType.HIRING_COMPANY ? "hiring company" : "news outlet";
    }

    private ResponseEntity<?> badRequest(String m) {
        return ResponseEntity.badRequest().body(Map.of("error", m));
    }
}
