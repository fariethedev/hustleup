package com.hustleup.social.news.ingest;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;

import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.StringReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Fetches an RSS or Atom feed and returns its items.
 *
 * <h2>Why hand-rolled rather than a feed library</h2>
 * <p>Rome and friends pull in a dependency tree for what is, at the level this needs, a
 * dozen element lookups. The JDK ships both an HTTP client and an XML parser; the whole
 * job is reading {@code <item>}/{@code <entry>} out of a document and normalising two date
 * formats.
 *
 * <h2>Safety</h2>
 * <p>This parses XML fetched from third-party servers, so the parser is locked down against
 * XXE: external entity resolution and DTD loading are disabled outright. Without that, a
 * hostile or compromised feed could read files off this server or make it issue requests on
 * the attacker's behalf. Everything else here is best-effort — a feed that is unreachable,
 * malformed, or serving HTML is logged and skipped, never thrown.
 */
@Slf4j
@Component
public class FeedReader {

    /** One fetched entry, before it becomes a NewsArticle. */
    public record FeedItem(String title, String summary, String link, String imageUrl,
                           LocalDateTime publishedAt, String guid) {}

    private static final Duration TIMEOUT = Duration.ofSeconds(15);

    /** Real-world feeds 403 an unidentified client; say who we are. */
    private static final String USER_AGENT = "HustleSpace/1.0 (+https://hustlespace.pl) news-aggregator";

    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(TIMEOUT)
            // Outlets move feeds behind redirects constantly; following them is the
            // difference between a source that works for a year and one that works for a month.
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();

    /**
     * Reads a source, discovering its feed first if it was given a homepage.
     *
     * @return the feed's items, or an empty list if it could not be read for any reason
     */
    public List<FeedItem> read(NewsSource source) {
        try {
            String body = fetch(source.url());
            if (body == null) return List.of();

            // Handed a web page rather than a feed: find the feed it advertises and follow it.
            if (looksLikeHtml(body)) {
                String discovered = discoverFeedUrl(body, source.url());
                if (discovered == null) {
                    log.warn("News source '{}' ({}) served HTML with no RSS/Atom link — skipping",
                            source.name(), source.url());
                    return List.of();
                }
                log.info("News source '{}' resolved to feed {}", source.name(), discovered);
                body = fetch(discovered);
                if (body == null || looksLikeHtml(body)) return List.of();
            }

            return parse(body);
        } catch (Exception e) {
            log.warn("Could not read news source '{}' ({}): {}", source.name(), source.url(), e.toString());
            return List.of();
        }
    }

    // -------------------------------------------------------------------------
    // Fetching
    // -------------------------------------------------------------------------

    private String fetch(String url) throws Exception {
        HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                .timeout(TIMEOUT)
                .header("User-Agent", USER_AGENT)
                .header("Accept", "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.5")
                .GET()
                .build();
        HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() / 100 != 2) {
            log.warn("Feed {} returned HTTP {}", url, response.statusCode());
            return null;
        }
        return response.body();
    }

    private boolean looksLikeHtml(String body) {
        String head = body.stripLeading();
        if (head.length() > 400) head = head.substring(0, 400);
        String lower = head.toLowerCase();
        return lower.startsWith("<!doctype html") || lower.startsWith("<html") || lower.contains("<head");
    }

    /**
     * Pulls the feed URL out of a page's {@code <link rel="alternate">} tag.
     *
     * <p>Regex rather than an HTML parser: real pages are not well-formed XML, and this is
     * a single attribute lookup rather than a reason to take on a parsing dependency. The
     * first RSS or Atom link wins, which on every outlet layout seen is the main feed.
     */
    String discoverFeedUrl(String html, String pageUrl) {
        Pattern link = Pattern.compile("<link\\b[^>]*>", Pattern.CASE_INSENSITIVE);
        Matcher tags = link.matcher(html);
        while (tags.find()) {
            String tag = tags.group();
            String lower = tag.toLowerCase();
            if (!lower.contains("alternate")) continue;
            if (!lower.contains("rss+xml") && !lower.contains("atom+xml")) continue;

            Matcher href = Pattern.compile("href\\s*=\\s*[\"']([^\"']+)[\"']", Pattern.CASE_INSENSITIVE).matcher(tag);
            if (href.find()) return absolutise(href.group(1), pageUrl);
        }
        return null;
    }

    /** Feeds are routinely advertised as "/feed" — resolve against the page they came from. */
    private String absolutise(String href, String pageUrl) {
        try {
            return URI.create(pageUrl).resolve(href.trim()).toString();
        } catch (Exception e) {
            return href;
        }
    }

    // -------------------------------------------------------------------------
    // Parsing
    // -------------------------------------------------------------------------

    List<FeedItem> parse(String xml) throws Exception {
        Document doc = newSecureBuilder().parse(new InputSource(new StringReader(xml.trim())));
        doc.getDocumentElement().normalize();

        // RSS calls them <item>, Atom calls them <entry>. Same shape once read.
        NodeList items = doc.getElementsByTagName("item");
        boolean atom = items.getLength() == 0;
        if (atom) items = doc.getElementsByTagName("entry");

        List<FeedItem> parsed = new ArrayList<>();
        for (int i = 0; i < items.getLength(); i++) {
            if (!(items.item(i) instanceof Element element)) continue;

            String title = text(element, "title");
            if (title == null || title.isBlank()) continue;   // an untitled entry is unusable

            String link = atom ? atomLink(element) : text(element, "link");
            if (link == null || link.isBlank()) continue;     // nothing to link the reader to

            String summary = firstNonBlank(
                    text(element, "description"),
                    text(element, "summary"),
                    text(element, "content:encoded"),
                    text(element, "content"));

            parsed.add(new FeedItem(
                    stripHtml(title),
                    summary == null ? null : stripHtml(summary),
                    link.trim(),
                    imageUrl(element),
                    publishedAt(element),
                    // guid is the feed's own stable id where it has one; the link is the
                    // fallback, and is what dedupe keys on so a re-poll cannot duplicate.
                    firstNonBlank(text(element, "guid"), text(element, "id"), link).trim()));
        }
        return parsed;
    }

    /**
     * An XML parser that cannot be talked into fetching anything.
     *
     * <p>Every one of these switches closes off a documented XXE vector. This parses
     * documents from servers we do not control, so the defaults are not acceptable.
     */
    private DocumentBuilder newSecureBuilder() throws Exception {
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
        factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
        factory.setFeature("http://apache.org/xml/features/nonvalidating/load-external-dtd", false);
        factory.setXIncludeAware(false);
        factory.setExpandEntityReferences(false);
        factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD, "");
        factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_SCHEMA, "");
        return factory.newDocumentBuilder();
    }

    /** Atom puts the URL in an attribute rather than the element body. */
    private String atomLink(Element entry) {
        NodeList links = entry.getElementsByTagName("link");
        for (int i = 0; i < links.getLength(); i++) {
            if (!(links.item(i) instanceof Element link)) continue;
            String rel = link.getAttribute("rel");
            if (rel.isBlank() || "alternate".equalsIgnoreCase(rel)) {
                String href = link.getAttribute("href");
                if (!href.isBlank()) return href;
            }
        }
        return null;
    }

    /**
     * The lead image, from whichever of the four competing conventions this feed uses.
     *
     * <p>There is no standard for this. RSS has {@code <enclosure>}, Media RSS has
     * {@code <media:content>} and {@code <media:thumbnail>}, and a good number of outlets
     * only ever put the image in the HTML of the description. Checked in that order because
     * the explicit elements carry a real image while the description scrape is a guess.
     */
    private String imageUrl(Element element) {
        String enclosure = attr(element, "enclosure", "url");
        if (enclosure != null) return enclosure;

        String mediaContent = attr(element, "media:content", "url");
        if (mediaContent != null) return mediaContent;

        String thumbnail = attr(element, "media:thumbnail", "url");
        if (thumbnail != null) return thumbnail;

        String description = firstNonBlank(text(element, "description"), text(element, "content:encoded"));
        if (description != null) {
            Matcher img = Pattern.compile("<img[^>]+src\\s*=\\s*[\"']([^\"']+)[\"']", Pattern.CASE_INSENSITIVE)
                    .matcher(description);
            if (img.find()) return img.group(1);
        }
        return null;
    }

    /**
     * The publication date, across the two formats feeds actually use.
     *
     * <p>RSS uses RFC-1123 ("Tue, 3 Jun 2026 09:00:00 +0200"), Atom uses ISO-8601. An
     * unparseable or missing date falls back to now rather than dropping the article: a
     * story with a slightly wrong timestamp is worth more to a reader than no story.
     */
    private LocalDateTime publishedAt(Element element) {
        String raw = firstNonBlank(
                text(element, "pubDate"), text(element, "published"),
                text(element, "updated"), text(element, "dc:date"));
        if (raw == null) return LocalDateTime.now();

        for (DateTimeFormatter format : List.of(DateTimeFormatter.RFC_1123_DATE_TIME, DateTimeFormatter.ISO_DATE_TIME)) {
            try {
                return ZonedDateTime.parse(raw.trim(), format).toLocalDateTime();
            } catch (Exception ignored) {
                // Try the next format.
            }
        }
        return LocalDateTime.now();
    }

    // -------------------------------------------------------------------------
    // Small DOM helpers
    // -------------------------------------------------------------------------

    /** Direct-child lookup: {@code getElementsByTagName} would reach into nested entries. */
    private String text(Element parent, String tag) {
        NodeList nodes = parent.getElementsByTagName(tag);
        for (int i = 0; i < nodes.getLength(); i++) {
            Node node = nodes.item(i);
            if (node.getParentNode() != parent) continue;
            String value = node.getTextContent();
            if (value != null && !value.isBlank()) return value.trim();
        }
        return null;
    }

    private String attr(Element parent, String tag, String attribute) {
        NodeList nodes = parent.getElementsByTagName(tag);
        for (int i = 0; i < nodes.getLength(); i++) {
            if (nodes.item(i) instanceof Element element) {
                String value = element.getAttribute(attribute);
                if (!value.isBlank()) return value;
            }
        }
        return null;
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) return value;
        }
        return null;
    }

    /** Feed titles and summaries arrive as escaped HTML; readers want the words. */
    static String stripHtml(String value) {
        if (value == null) return null;
        return value.replaceAll("(?is)<script.*?</script>", " ")
                .replaceAll("(?is)<style.*?</style>", " ")
                .replaceAll("<[^>]+>", " ")
                .replace("&nbsp;", " ")
                .replace("&amp;", "&")
                .replace("&quot;", "\"")
                .replace("&#39;", "'")
                .replace("&apos;", "'")
                .replace("&lt;", "<")
                .replace("&gt;", ">")
                .replaceAll("\\s+", " ")
                .trim();
    }
}
