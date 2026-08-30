package com.hustleup.social.news.ingest;

import com.hustleup.social.news.model.NewsArticle;
import com.hustleup.social.news.repository.NewsArticleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Pulls articles from configured outlets into the news page.
 *
 * <h2>What this is for</h2>
 * <p>The news page only ever had articles written by verified HustleSpace publishers, of
 * which there are approximately none — so it opened empty for every user. This fills it
 * with what the audience actually needs: local Lublin news, and Poland coverage that
 * matters to an international student (visas, residence permits, housing, university).
 *
 * <h2>Summaries, not reproductions</h2>
 * <p>An imported article stores the feed's own headline and standfirst, credits the outlet
 * by name, and links to the original. It deliberately does not scrape the full text: that
 * would be republishing someone else's work without permission, and a feed summary plus a
 * link is what RSS is published for.
 *
 * <h2>Failure behaviour</h2>
 * <p>Every source is fetched independently and every failure is contained to that source.
 * One outlet moving its feed cannot stop the other nine importing, and nothing here can
 * fail a request — the whole thing runs on a schedule, off the request path.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class NewsImportService {

    private final NewsArticleRepository articleRepository;
    private final FeedReader feedReader;
    private final NewsCategoryMapper categoryMapper;

    /** See {@link NewsSource} for the format. Empty by default — no sources, no imports. */
    @Value("${app.news.sources:}")
    private String configuredSources;

    /** Imported articles are dropped after this many days. See the cleanup method. */
    @Value("${app.news.retention-days:45}")
    private int retentionDays;

    /** Guards against one outlet with a 500-entry feed drowning out every other source. */
    private static final int MAX_PER_SOURCE = 40;

    /** Result of one run, so the admin endpoint can report what happened. */
    public record ImportReport(int sources, int fetched, int imported, int skipped, List<String> failures) {}

    // -------------------------------------------------------------------------
    // Scheduled run
    // -------------------------------------------------------------------------

    /**
     * Refreshes every configured source.
     *
     * <p>Every 30 minutes, and once shortly after startup so a freshly deployed instance
     * has a populated news page rather than an empty one for the first half hour.
     * Local news does not move fast enough to justify polling harder than this, and
     * hammering a small outlet's server is a good way to get blocked by it.
     */
    @Scheduled(initialDelay = 60_000, fixedRate = 30 * 60_000)
    public void scheduledImport() {
        if (sources().isEmpty()) return;   // nothing configured; stay quiet
        ImportReport report = importAll();
        log.info("News import: {} new from {} sources ({} already had, {} failures)",
                report.imported(), report.sources(), report.skipped(), report.failures().size());
    }

    /**
     * Deletes imported articles past their retention window.
     *
     * <p>Only ever touches aggregated rows. A publisher's own article is theirs and stays
     * until they archive it; a three-week-old headline from somebody else's feed is just
     * a row nobody will read again.
     */
    @Scheduled(cron = "0 30 3 * * *")
    public void pruneOldImports() {
        try {
            List<NewsArticle> stale = articleRepository
                    .findBySourceNameIsNotNullAndPublishedAtBefore(LocalDateTime.now().minusDays(retentionDays));
            if (stale.isEmpty()) return;
            articleRepository.deleteAll(stale);
            log.info("News import: pruned {} articles older than {} days", stale.size(), retentionDays);
        } catch (Exception e) {
            log.warn("News import: prune failed: {}", e.toString());
        }
    }

    // -------------------------------------------------------------------------
    // The run itself
    // -------------------------------------------------------------------------

    /** Fetches every source and stores what is new. Safe to call at any time. */
    public ImportReport importAll() {
        List<NewsSource> sources = sources();
        int fetched = 0;
        int imported = 0;
        int skipped = 0;
        List<String> failures = new java.util.ArrayList<>();

        for (NewsSource source : sources) {
            try {
                List<FeedReader.FeedItem> items = feedReader.read(source);
                if (items.isEmpty()) {
                    failures.add(source.name() + ": no items");
                    continue;
                }
                for (FeedReader.FeedItem item : items.stream().limit(MAX_PER_SOURCE).toList()) {
                    fetched++;
                    if (articleRepository.existsByExternalId(item.guid())) {
                        skipped++;
                        continue;
                    }
                    articleRepository.save(toArticle(item, source));
                    imported++;
                }
            } catch (Exception e) {
                // Contained per source, on purpose — see the class javadoc.
                log.warn("News import failed for '{}': {}", source.name(), e.toString());
                failures.add(source.name() + ": " + e.getClass().getSimpleName());
            }
        }
        return new ImportReport(sources.size(), fetched, imported, skipped, failures);
    }

    private NewsArticle toArticle(FeedReader.FeedItem item, NewsSource source) {
        String summary = trim(item.summary(), 800);
        return NewsArticle.builder()
                // No HustleSpace publisher — this belongs to the outlet.
                .publisherUserId(null)
                .outletName(source.name())
                .title(trim(item.title(), 250))
                .summary(summary)
                // The body is the summary plus a pointer, not a scrape. A reader who wants
                // the article gets sent to the people who wrote it.
                .body(buildBody(summary, source.name(), item.link()))
                .category(categoryMapper.categorise(item.title(), summary, source.defaultCategory()))
                .coverImageUrl(trim(item.imageUrl(), 1024))
                .sourceName(source.name())
                .sourceUrl(trim(item.link(), 1024))
                .externalId(trim(item.guid(), 512))
                .status(NewsArticle.ArticleStatus.PUBLISHED)
                .publishedAt(item.publishedAt())
                .createdAt(LocalDateTime.now())
                .build();
    }

    private String buildBody(String summary, String outlet, String link) {
        String lead = summary == null || summary.isBlank()
                ? "This story was published by " + outlet + "."
                : summary;
        return lead + "\n\nRead the full article at " + outlet + ": " + link;
    }

    /** The configured sources, re-parsed per call so a config refresh is picked up. */
    public List<NewsSource> sources() {
        return NewsSource.parseAll(configuredSources);
    }

    private String trim(String value, int max) {
        if (value == null) return null;
        String clean = value.trim();
        if (clean.isEmpty()) return null;
        return clean.length() <= max ? clean : clean.substring(0, max);
    }
}
