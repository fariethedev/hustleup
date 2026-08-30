package com.hustleup.social.news.ingest;

import java.util.ArrayList;
import java.util.List;

/**
 * One outlet HustleSpace pulls articles from.
 *
 * <h2>Why sources are configuration, not code</h2>
 * <p>Feed URLs rot. Outlets move them, rename them, or drop RSS entirely, and a list baked
 * into a compiled service means a dead feed needs a rebuild and a redeploy to remove. Since
 * the useful sources here are local Lublin outlets and English-language Poland desks — the
 * kind of small publisher whose site gets rebuilt every couple of years — the list lives in
 * {@code NEWS_SOURCES} so it can be corrected in an env var.
 *
 * <h2>Format</h2>
 * <p>Comma-separated entries, each {@code Name|url|category}:
 *
 * <pre>
 * NEWS_SOURCES="Dziennik Wschodni|https://www.dziennikwschodni.pl|lublin,\
 *               Notes from Poland|https://notesfrompoland.com/feed/|students"
 * </pre>
 *
 * <p>{@code url} may be either a feed URL or the outlet's homepage —
 * {@link FeedReader} discovers the feed from the page when it is handed HTML. That matters
 * because a homepage is the one URL for an outlet that is easy to verify and unlikely to
 * change, while the feed path underneath it is neither.
 *
 * <p>{@code category} is the section id from the news page's own list ("lublin",
 * "students", "immigration", …). It is the fallback: {@link NewsCategoryMapper} may still
 * file an individual article somewhere more specific based on what it is about.
 */
public record NewsSource(String name, String url, String defaultCategory) {

    /**
     * Parses the configured source list, skipping anything malformed.
     *
     * <p>Lenient on purpose. One mistyped entry in an env var should cost you that one
     * outlet, not every outlet — a strict parse here would take the whole news page down
     * over a missing pipe character.
     */
    public static List<NewsSource> parseAll(String raw) {
        List<NewsSource> sources = new ArrayList<>();
        if (raw == null || raw.isBlank()) return sources;

        for (String entry : raw.split(",")) {
            String[] parts = entry.split("\\|");
            if (parts.length < 2) continue;
            String name = parts[0].trim();
            String url = parts[1].trim();
            if (name.isEmpty() || url.isEmpty()) continue;
            if (!url.startsWith("http://") && !url.startsWith("https://")) continue;
            String category = parts.length > 2 && !parts[2].isBlank() ? parts[2].trim() : null;
            sources.add(new NewsSource(name, url, category));
        }
        return sources;
    }
}
