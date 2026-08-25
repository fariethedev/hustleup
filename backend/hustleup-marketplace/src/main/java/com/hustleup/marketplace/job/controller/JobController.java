package com.hustleup.marketplace.job.controller;

import com.hustleup.common.model.PublisherProfile;
import com.hustleup.common.model.Role;
import com.hustleup.common.model.User;
import com.hustleup.common.publisher.PublisherGuard;
import com.hustleup.common.repository.UserRepository;
import com.hustleup.common.storage.FileStorageService;
import com.hustleup.marketplace.job.dto.JobApplicationDto;
import com.hustleup.marketplace.job.dto.JobDto;
import com.hustleup.marketplace.job.model.Job;
import com.hustleup.marketplace.job.model.JobApplication;
import com.hustleup.marketplace.job.repository.JobApplicationRepository;
import com.hustleup.marketplace.job.repository.JobRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * The Jobs and Gigs board.
 *
 * <p><b>Reading is public; posting is not.</b> Anyone, signed in or not, can browse the
 * board, because a job advert nobody can see is worthless to the company that posted it.
 * Creating an advert requires an approved HIRING_COMPANY publisher profile, enforced
 * through the shared {@link PublisherGuard} so the rule stays identical to the one News
 * applies for outlets.
 */
@RestController
@RequestMapping("/api/v1/jobs")
@RequiredArgsConstructor
@Slf4j
public class JobController {

    private final JobRepository jobRepository;
    private final JobApplicationRepository applicationRepository;
    private final UserRepository userRepository;
    private final PublisherGuard publisherGuard;
    private final FileStorageService fileStorageService;

    // ---- Public board -------------------------------------------------------

    /**
     * The job board.
     *
     * <p><b>GET /api/v1/jobs</b> - public. Params: category, q, page, size.
     */
    @GetMapping
    public ResponseEntity<?> board(@RequestParam(required = false) String category,
                                   @RequestParam(required = false) String q,
                                   @RequestParam(defaultValue = "0") int page,
                                   @RequestParam(defaultValue = "30") int size) {
        String search = (q == null || q.isBlank()) ? null : q.toLowerCase();
        String cat = (category == null || category.isBlank() || "all".equalsIgnoreCase(category))
                ? null : category;

        var results = jobRepository.findBoard(LocalDateTime.now(), cat, search,
                PageRequest.of(Math.max(0, page), Math.min(100, Math.max(1, size))));

        User me = publisherGuard.currentUser().orElse(null);
        Set<UUID> appliedTo = appliedJobIds(me, results.getContent());

        List<JobDto> dtos = results.getContent().stream()
                .map(j -> JobDto.from(j,
                        me == null ? null : appliedTo.contains(j.getId()),
                        me != null && me.getId().equals(j.getPublisherUserId())))
                .collect(Collectors.toList());

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("content", dtos);
        body.put("page", results.getNumber());
        body.put("totalPages", results.getTotalPages());
        body.put("totalElements", results.getTotalElements());
        return ResponseEntity.ok(body);
    }

    /**
     * One advert in full, and bumps its view counter.
     *
     * <p><b>GET /api/v1/jobs/{id}</b> - public.
     */
    @GetMapping("/{id}")
    public ResponseEntity<?> one(@PathVariable UUID id) {
        Job job = jobRepository.findById(id).orElse(null);
        if (job == null) return notFound("Job not found");

        job.setViewsCount(job.getViewsCount() + 1);
        jobRepository.save(job);

        User me = publisherGuard.currentUser().orElse(null);
        boolean applied = me != null
                && applicationRepository.findByJobIdAndApplicantId(id, me.getId()).isPresent();
        return ResponseEntity.ok(JobDto.from(job,
                me == null ? null : applied,
                me != null && me.getId().equals(job.getPublisherUserId())));
    }

    // ---- Posting (verified hiring companies only) ---------------------------

    /**
     * Posts a job advert.
     *
     * <p><b>POST /api/v1/jobs</b> - multipart, so photos and clips arrive with the advert
     * instead of needing a second upload round-trip.
     *
     * <p>Requires an approved HIRING_COMPANY profile. The company name and logo are taken
     * from that profile and never from the request body, otherwise one verified company
     * could post adverts under another company's name.
     */
    @PostMapping(consumes = "multipart/form-data")
    public ResponseEntity<?> create(@RequestParam String title,
                                    @RequestParam String description,
                                    @RequestParam(required = false) String category,
                                    @RequestParam(required = false) String location,
                                    @RequestParam(defaultValue = "false") boolean remote,
                                    @RequestParam(defaultValue = "FULL_TIME") String jobType,
                                    @RequestParam(required = false) BigDecimal salaryMin,
                                    @RequestParam(required = false) BigDecimal salaryMax,
                                    @RequestParam(defaultValue = "PLN") String salaryCurrency,
                                    @RequestParam(defaultValue = "MONTH") String salaryPeriod,
                                    @RequestParam(required = false) String tags,
                                    @RequestParam(required = false) Integer expiresInDays,
                                    @RequestParam(required = false) List<MultipartFile> media) {
        PublisherProfile publisher;
        try {
            publisher = publisherGuard.requirePublisher(PublisherProfile.PublisherType.HIRING_COMPANY);
        } catch (PublisherGuard.NotAPublisherException e) {
            return forbidden(e.getMessage());
        }

        Job.JobType parsedType;
        try {
            parsedType = Job.JobType.valueOf(jobType.toUpperCase());
        } catch (IllegalArgumentException e) {
            return badRequest("Invalid job type. Allowed: FULL_TIME, PART_TIME, CONTRACT, TEMPORARY, INTERNSHIP, GIG");
        }
        if (title.isBlank() || description.isBlank()) {
            return badRequest("Title and description are required");
        }
        if (salaryMin != null && salaryMax != null && salaryMin.compareTo(salaryMax) > 0) {
            return badRequest("Minimum salary cannot be greater than maximum");
        }

        // FileStorageService validates type and extension, throwing IllegalArgumentException
        // for anything that is not an image or video. Surface that as a 400 carrying its
        // message rather than letting it abort midway and leave a half-created advert.
        List<String> mediaUrls = new ArrayList<>();
        if (media != null) {
            for (MultipartFile f : media) {
                if (f != null && !f.isEmpty()) {
                    try {
                        mediaUrls.add(fileStorageService.store(f));
                    } catch (IllegalArgumentException e) {
                        return badRequest(e.getMessage());
                    }
                }
            }
        }

        Job job = Job.builder()
                .publisherUserId(publisher.getUserId())
                .publisherProfileId(publisher.getId())
                .companyName(publisher.getCompanyName())
                .companyLogoUrl(publisher.getLogoUrl())
                .title(title.trim())
                .description(description.trim())
                .category(category)
                .location(location)
                .remote(remote)
                .jobType(parsedType)
                .salaryMin(salaryMin)
                .salaryMax(salaryMax)
                .salaryCurrency(salaryCurrency)
                .salaryPeriod(salaryPeriod)
                .mediaUrls(mediaUrls)
                .tags(splitTags(tags))
                .expiresAt(expiresInDays != null && expiresInDays > 0
                        ? LocalDateTime.now().plusDays(expiresInDays) : null)
                .build();

        Job saved = jobRepository.save(job);
        log.info("Job posted: id={} publisher={} company={}",
                saved.getId(), publisher.getUserId(), publisher.getCompanyName());
        return ResponseEntity.status(HttpStatus.CREATED).body(JobDto.from(saved, false, true));
    }

    /** Adverts posted by the caller. <b>GET /api/v1/jobs/mine</b> */
    @GetMapping("/mine")
    public ResponseEntity<?> mine() {
        User me = publisherGuard.currentUser().orElse(null);
        if (me == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(jobRepository.findByPublisherUserIdOrderByCreatedAtDesc(me.getId())
                .stream().map(j -> JobDto.from(j, null, true)).collect(Collectors.toList()));
    }

    /**
     * Closes an advert, or reopens it.
     *
     * <p><b>PATCH /api/v1/jobs/{id}/status</b> - owner or admin only.
     */
    @PatchMapping("/{id}/status")
    public ResponseEntity<?> setStatus(@PathVariable UUID id, @RequestBody Map<String, String> body) {
        User me = publisherGuard.currentUser().orElse(null);
        if (me == null) return ResponseEntity.status(401).build();
        Job job = jobRepository.findById(id).orElse(null);
        if (job == null) return notFound("Job not found");
        if (!job.getPublisherUserId().equals(me.getId()) && me.getRole() != Role.ADMIN) {
            return forbidden("You can only change your own adverts");
        }
        try {
            job.setStatus(Job.JobStatus.valueOf(String.valueOf(body.get("status")).toUpperCase()));
        } catch (IllegalArgumentException e) {
            return badRequest("Invalid status. Allowed: OPEN, CLOSED, EXPIRED, REMOVED");
        }
        job.setUpdatedAt(LocalDateTime.now());
        return ResponseEntity.ok(JobDto.from(jobRepository.save(job), null, true));
    }

    // ---- Applying -----------------------------------------------------------

    /**
     * Applies to a job.
     *
     * <p><b>POST /api/v1/jobs/{id}/apply</b> - any signed-in user. Idempotent: re-applying
     * returns the existing application rather than creating a duplicate or double-counting
     * the advert's application total.
     */
    @PostMapping(value = "/{id}/apply", consumes = "multipart/form-data")
    public ResponseEntity<?> apply(@PathVariable UUID id,
                                   @RequestParam(required = false) String message,
                                   @RequestParam(required = false) MultipartFile attachment) {
        User me = publisherGuard.currentUser().orElse(null);
        if (me == null) return ResponseEntity.status(401).body(Map.of("error", "Sign in to apply"));

        Job job = jobRepository.findById(id).orElse(null);
        if (job == null) return notFound("Job not found");
        if (!job.isLive()) return badRequest("This job is no longer accepting applications");
        if (job.getPublisherUserId().equals(me.getId())) {
            return badRequest("You cannot apply to your own advert");
        }

        var existing = applicationRepository.findByJobIdAndApplicantId(id, me.getId());
        if (existing.isPresent()) {
            return ResponseEntity.ok(JobApplicationDto.from(existing.get()));
        }

        String attachmentUrl = null;
        if (attachment != null && !attachment.isEmpty()) {
            try {
                attachmentUrl = fileStorageService.store(attachment);
            } catch (IllegalArgumentException e) {
                return badRequest(e.getMessage());
            }
        }

        JobApplication application = applicationRepository.save(JobApplication.builder()
                .jobId(id)
                .applicantId(me.getId())
                .message(message)
                .attachmentUrl(attachmentUrl)
                .build());

        job.setApplicationsCount(job.getApplicationsCount() + 1);
        jobRepository.save(job);

        log.info("Job application: job={} applicant={}", id, me.getId());
        return ResponseEntity.status(HttpStatus.CREATED).body(JobApplicationDto.from(application));
    }

    /**
     * The applications on one advert.
     *
     * <p><b>GET /api/v1/jobs/{id}/applications</b> - owner or admin only. Applications
     * carry the applicant's cover note and CV, so this is never public.
     */
    @GetMapping("/{id}/applications")
    public ResponseEntity<?> applications(@PathVariable UUID id) {
        User me = publisherGuard.currentUser().orElse(null);
        if (me == null) return ResponseEntity.status(401).build();
        Job job = jobRepository.findById(id).orElse(null);
        if (job == null) return notFound("Job not found");
        if (!job.getPublisherUserId().equals(me.getId()) && me.getRole() != Role.ADMIN) {
            return forbidden("Only the company that posted this advert can see its applicants");
        }

        List<JobApplicationDto> out = applicationRepository.findByJobIdOrderByCreatedAtDesc(id)
                .stream().map(a -> {
                    JobApplicationDto dto = JobApplicationDto.from(a);
                    dto.setJobTitle(job.getTitle());
                    userRepository.findById(a.getApplicantId()).ifPresent(u -> {
                        dto.setApplicantName(u.getFullName());
                        dto.setApplicantAvatarUrl(u.getAvatarUrl());
                    });
                    return dto;
                }).collect(Collectors.toList());
        return ResponseEntity.ok(out);
    }

    /** The caller's own applications. <b>GET /api/v1/jobs/applications/mine</b> */
    @GetMapping("/applications/mine")
    public ResponseEntity<?> myApplications() {
        User me = publisherGuard.currentUser().orElse(null);
        if (me == null) return ResponseEntity.status(401).build();
        List<JobApplicationDto> out = applicationRepository.findByApplicantIdOrderByCreatedAtDesc(me.getId())
                .stream().map(a -> {
                    JobApplicationDto dto = JobApplicationDto.from(a);
                    jobRepository.findById(a.getJobId()).ifPresent(j -> dto.setJobTitle(j.getTitle()));
                    return dto;
                }).collect(Collectors.toList());
        return ResponseEntity.ok(out);
    }

    /**
     * Moves an application along the hiring pipeline.
     *
     * <p><b>PATCH /api/v1/jobs/applications/{applicationId}</b> - the job's owner or admin.
     */
    @PatchMapping("/applications/{applicationId}")
    public ResponseEntity<?> updateApplication(@PathVariable UUID applicationId,
                                               @RequestBody Map<String, String> body) {
        User me = publisherGuard.currentUser().orElse(null);
        if (me == null) return ResponseEntity.status(401).build();
        JobApplication app = applicationRepository.findById(applicationId).orElse(null);
        if (app == null) return notFound("Application not found");
        Job job = jobRepository.findById(app.getJobId()).orElse(null);
        if (job == null) return notFound("Job not found");
        if (!job.getPublisherUserId().equals(me.getId()) && me.getRole() != Role.ADMIN) {
            return forbidden("Only the hiring company can update an application");
        }
        try {
            app.setStatus(JobApplication.ApplicationStatus.valueOf(
                    String.valueOf(body.get("status")).toUpperCase()));
        } catch (IllegalArgumentException e) {
            return badRequest("Invalid status. Allowed: SUBMITTED, REVIEWING, SHORTLISTED, REJECTED, HIRED, WITHDRAWN");
        }
        app.setUpdatedAt(LocalDateTime.now());
        return ResponseEntity.ok(JobApplicationDto.from(applicationRepository.save(app)));
    }

    // ---- Helpers ------------------------------------------------------------

    /** Which of these adverts the user already applied to, in one query rather than one per card. */
    private Set<UUID> appliedJobIds(User me, List<Job> jobs) {
        if (me == null || jobs.isEmpty()) return Set.of();
        List<UUID> ids = jobs.stream().map(Job::getId).collect(Collectors.toList());
        return applicationRepository.findByApplicantIdAndJobIdIn(me.getId(), ids)
                .stream().map(JobApplication::getJobId).collect(Collectors.toSet());
    }

    private List<String> splitTags(String tags) {
        if (tags == null || tags.isBlank()) return new ArrayList<>();
        return Arrays.stream(tags.split(","))
                .map(String::trim).filter(s -> !s.isEmpty()).limit(8)
                .collect(Collectors.toCollection(ArrayList::new));
    }

    private ResponseEntity<?> badRequest(String m) {
        return ResponseEntity.badRequest().body(Map.of("error", m));
    }

    private ResponseEntity<?> forbidden(String m) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", m));
    }

    private ResponseEntity<?> notFound(String m) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", m));
    }
}
