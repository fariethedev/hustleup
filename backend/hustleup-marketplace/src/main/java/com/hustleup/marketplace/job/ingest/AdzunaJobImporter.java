package com.hustleup.marketplace.job.ingest;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hustleup.marketplace.job.model.Job;
import com.hustleup.marketplace.job.repository.JobRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Fills the jobs board with real vacancies in Poland, via Adzuna.
 *
 * <h2>Why the board needed this</h2>
 * <p>Adverts could only be posted by an approved HIRING_COMPANY profile, of which there are
 * effectively none — so the jobs page opened empty for every user, in a market where the
 * audience (students in Lublin, many of them international) is looking for exactly this.
 *
 * <h2>Why Adzuna</h2>
 * <p>It aggregates Polish boards behind one documented JSON endpoint, covers the whole
 * country rather than one city, and returns the fields a card needs — title, company,
 * location, salary range, contract type, and a link back to apply. The alternatives are
 * either IT-only or have no public API at all.
 *
 * <h2>Applying happens on the board, not here</h2>
 * <p>An imported advert is marked with a {@code sourceName} and carries the original URL.
 * There is no employer on HustleSpace to receive an application for it, so the client sends
 * candidates to the source rather than collecting a CV nobody would ever read.
 *
 * <h2>No credentials, no importer</h2>
 * <p>Dormant until {@code ADZUNA_APP_ID} / {@code ADZUNA_APP_KEY} are set, in the same shape
 * as {@code AlgoliaIndexService} — the service starts and the board works, it just shows
 * only what was posted natively.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AdzunaJobImporter {

    private final JobRepository jobRepository;
    private final AdzunaCategoryMapper categoryMapper;

    @Value("${app.adzuna.app-id:}")
    private String appId;

    @Value("${app.adzuna.app-key:}")
    private String appKey;

    /** ISO country code in Adzuna's path. "pl" is the whole point of this integration. */
    @Value("${app.adzuna.country:pl}")
    private String country;

    /**
     * Where to search.
     *
     * <p>Defaults to Lublin because that is where the audience is; set to a blank string to
     * pull the whole country. Adzuna treats this as a fuzzy location match, so a city name
     * also brings in the surrounding area rather than only exact matches.
     */
    @Value("${app.adzuna.where:Lublin}")
    private String where;

    /** Pages to walk per run, 50 results each. Four pages is ~200 adverts. */
    @Value("${app.adzuna.pages:4}")
    private int pages;

    /** Imported adverts are dropped after this many days — see {@link #pruneOldImports}. */
    @Value("${app.adzuna.retention-days:30}")
    private int retentionDays;

    private static final int RESULTS_PER_PAGE = 50;
    private static final Duration TIMEOUT = Duration.ofSeconds(20);
    private static final String SOURCE_NAME = "Adzuna";

    private final HttpClient http = HttpClient.newBuilder().connectTimeout(TIMEOUT).build();
    private final ObjectMapper json = new ObjectMapper();

    /** Result of one run, so the admin endpoint can report what happened. */
    public record ImportReport(int fetched, int imported, int skipped, List<String> failures) {}

    public boolean isConfigured() {
        return appId != null && !appId.isBlank() && appKey != null && !appKey.isBlank();
    }

    // -------------------------------------------------------------------------
    // Scheduled runs
    // -------------------------------------------------------------------------

    /**
     * Refreshes the board.
     *
     * <p>Every two hours, plus once shortly after startup. Job adverts do not turn over
     * faster than that, and Adzuna's free tier is rate-limited — polling harder would spend
     * the quota without showing anyone a job they could not already see.
     */
    @Scheduled(initialDelay = 90_000, fixedRate = 2 * 60 * 60_000)
    public void scheduledImport() {
        if (!isConfigured()) return;
        ImportReport report = importAll();
        log.info("Adzuna import: {} new ({} already had, {} failures)",
                report.imported(), report.skipped(), report.failures().size());
    }

    /**
     * Drops imported adverts past their retention window.
     *
     * <p>Nothing here can tell when an imported role is filled — the board just stops
     * returning it — so age is the only signal available, and without this the page fills
     * up with vacancies that no longer exist. Native adverts are untouched: closing one is
     * the employer's decision.
     */
    @Scheduled(cron = "0 45 3 * * *")
    public void pruneOldImports() {
        if (!isConfigured()) return;
        try {
            List<Job> stale = jobRepository
                    .findBySourceNameIsNotNullAndCreatedAtBefore(LocalDateTime.now().minusDays(retentionDays));
            if (stale.isEmpty()) return;
            jobRepository.deleteAll(stale);
            log.info("Adzuna import: pruned {} adverts older than {} days", stale.size(), retentionDays);
        } catch (Exception e) {
            log.warn("Adzuna import: prune failed: {}", e.toString());
        }
    }

    // -------------------------------------------------------------------------
    // The run itself
    // -------------------------------------------------------------------------

    /** Walks the configured pages and stores what is new. Safe to call at any time. */
    public ImportReport importAll() {
        int fetched = 0;
        int imported = 0;
        int skipped = 0;
        List<String> failures = new ArrayList<>();

        for (int page = 1; page <= Math.max(1, pages); page++) {
            try {
                JsonNode results = fetchPage(page);
                if (results == null || !results.isArray() || results.isEmpty()) break;

                for (JsonNode advert : results) {
                    fetched++;
                    String externalId = advert.path("id").asText(null);
                    if (externalId == null || externalId.isBlank()) continue;

                    if (jobRepository.existsByExternalId(externalId)) {
                        skipped++;
                        continue;
                    }
                    Job job = toJob(advert, externalId);
                    if (job != null) {
                        jobRepository.save(job);
                        imported++;
                    }
                }
            } catch (Exception e) {
                // Per page, so a failure partway through keeps everything already stored.
                log.warn("Adzuna page {} failed: {}", page, e.toString());
                failures.add("page " + page + ": " + e.getClass().getSimpleName());
            }
        }
        return new ImportReport(fetched, imported, skipped, failures);
    }

    private JsonNode fetchPage(int page) throws Exception {
        StringBuilder url = new StringBuilder("https://api.adzuna.com/v1/api/jobs/")
                .append(country.trim().toLowerCase())
                .append("/search/").append(page)
                .append("?app_id=").append(encode(appId))
                .append("&app_key=").append(encode(appKey))
                .append("&results_per_page=").append(RESULTS_PER_PAGE)
                .append("&content-type=application/json");
        if (where != null && !where.isBlank()) {
            url.append("&where=").append(encode(where.trim()));
        }

        HttpRequest request = HttpRequest.newBuilder(URI.create(url.toString()))
                .timeout(TIMEOUT)
                .header("Accept", "application/json")
                .GET()
                .build();

        HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() / 100 != 2) {
            // Do not log the URL — it carries the app key.
            log.warn("Adzuna returned HTTP {} for page {}", response.statusCode(), page);
            return null;
        }
        return json.readTree(response.body()).path("results");
    }

    /**
     * Maps one Adzuna advert onto a {@link Job}.
     *
     * @return the job, or null when the advert is missing something a card cannot do without
     */
    private Job toJob(JsonNode advert, String externalId) {
        String title = text(advert, "title");
        if (title == null) return null;

        String description = text(advert, "description");
        String company = advert.path("company").path("display_name").asText(null);
        String location = advert.path("location").path("display_name").asText(null);
        String category = advert.path("category").path("label").asText(null);
        String link = text(advert, "redirect_url");

        return Job.builder()
                // Nobody on HustleSpace posted this — it belongs to the board.
                .publisherUserId(null)
                .companyName(company != null && !company.isBlank() ? company : "Employer via Adzuna")
                .title(trim(title, 250))
                // Adzuna descriptions arrive truncated with a trailing ellipsis; the full
                // text is on their page, which is where applying happens anyway.
                .description(description != null ? trim(description, 4000) : "See the full advert on Adzuna.")
                .category(categoryMapper.categorise(title, description, category))
                .location(trim(location, 250))
                .remote(looksRemote(title, description))
                .jobType(contractType(advert))
                .salaryMin(decimal(advert, "salary_min"))
                .salaryMax(decimal(advert, "salary_max"))
                .salaryCurrency("PLN")
                // Adzuna normalises every salary to an annual figure regardless of how the
                // advert stated it, so labelling these per-year is the only honest reading.
                .salaryPeriod("YEAR")
                .sourceName(SOURCE_NAME)
                .sourceUrl(trim(link, 1024))
                .externalId(trim(externalId, 512))
                .status(Job.JobStatus.OPEN)
                .createdAt(created(advert))
                .build();
    }

    /**
     * Maps Adzuna's contract fields onto {@link Job.JobType}.
     *
     * <p>Adzuna splits this across two independent fields — {@code contract_type} is
     * permanent/contract and {@code contract_time} is full/part time — and populates
     * neither reliably. Part-time wins when present because it is the distinction that
     * actually matters to a student reading the board.
     */
    private Job.JobType contractType(JsonNode advert) {
        String time = text(advert, "contract_time");
        String type = text(advert, "contract_type");

        if ("part_time".equalsIgnoreCase(time)) return Job.JobType.PART_TIME;
        if ("contract".equalsIgnoreCase(type)) return Job.JobType.CONTRACT;
        if ("permanent".equalsIgnoreCase(type)) return Job.JobType.FULL_TIME;
        return Job.JobType.FULL_TIME;
    }

    /** Adzuna has no remote flag, so this reads the words the advert used. */
    private boolean looksRemote(String title, String description) {
        String haystack = ((title == null ? "" : title) + " " + (description == null ? "" : description))
                .toLowerCase();
        return haystack.contains("remote") || haystack.contains("zdalna") || haystack.contains("zdalnie")
                || haystack.contains("home office") || haystack.contains("praca zdalna");
    }

    private LocalDateTime created(JsonNode advert) {
        String raw = text(advert, "created");
        if (raw == null) return LocalDateTime.now();
        try {
            return ZonedDateTime.parse(raw).toLocalDateTime();
        } catch (Exception e) {
            return LocalDateTime.now();
        }
    }

    private BigDecimal decimal(JsonNode advert, String field) {
        JsonNode node = advert.path(field);
        return node.isNumber() ? node.decimalValue() : null;
    }

    private String text(JsonNode node, String field) {
        String value = node.path(field).asText(null);
        return value == null || value.isBlank() ? null : value.trim();
    }

    private String trim(String value, int max) {
        if (value == null) return null;
        String clean = value.trim();
        if (clean.isEmpty()) return null;
        return clean.length() <= max ? clean : clean.substring(0, max);
    }

    private String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}
