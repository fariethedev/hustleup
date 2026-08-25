package com.hustleup.social.news.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * An article published by a verified news outlet.
 *
 * <h2>Why this is not a feed Post</h2>
 * <p>A feed post is a person talking to their followers; an article is an outlet
 * publishing to everyone. They differ in who may create them (anyone, versus an approved
 * outlet), in what they carry (a caption, versus a headline plus a body), and in how they
 * are read (a scrolling feed, versus a reader view). Keeping them separate means the feed
 * never has to filter articles out and the news page never has to filter posts out.
 *
 * <h2>Outlet snapshot</h2>
 * <p>{@code outletName} and {@code outletLogoUrl} are copied from the publisher profile at
 * publish time rather than joined on read, for the same reason job adverts snapshot their
 * company: an article is a record of what was published, by whom, on that date. If an
 * outlet is later suspended or renamed, the byline on an old article should still show
 * what the reader actually saw.
 */
@Entity
@Table(name = "news_articles")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor @Builder
public class NewsArticle {

    /** Draft is the outlet's own workspace; only PUBLISHED appears on the news page. */
    public enum ArticleStatus { DRAFT, PUBLISHED, ARCHIVED, REMOVED }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    // ---- Who published it ---------------------------------------------------

    @Column(name = "publisher_user_id", nullable = false)
    private UUID publisherUserId;

    @Column(name = "publisher_profile_id")
    private UUID publisherProfileId;

    /** Snapshot, see class javadoc. */
    @Column(name = "outlet_name", nullable = false)
    private String outletName;

    @Column(name = "outlet_logo_url")
    private String outletLogoUrl;

    // ---- The article --------------------------------------------------------

    @Column(nullable = false)
    private String title;

    /** One-paragraph standfirst shown on the card and in link previews. */
    @Column(name = "summary", columnDefinition = "TEXT")
    private String summary;

    @Column(name = "body", columnDefinition = "LONGTEXT", nullable = false)
    private String body;

    /** Section slug the news page filters by, e.g. "business", "tech". */
    @Column(name = "category")
    private String category;

    /** Lead image for the card and the top of the reader view. */
    @Column(name = "cover_image_url", length = 1024)
    private String coverImageUrl;

    /** Additional images or clips embedded in the article. */
    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "news_media", joinColumns = @JoinColumn(name = "article_id"))
    @Column(name = "media_url", length = 1024)
    @Builder.Default
    private List<String> mediaUrls = new ArrayList<>();

    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "news_tags", joinColumns = @JoinColumn(name = "article_id"))
    @Column(name = "tag")
    @Builder.Default
    private List<String> tags = new ArrayList<>();

    // ---- Lifecycle ----------------------------------------------------------

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private ArticleStatus status = ArticleStatus.PUBLISHED;

    @Column(name = "views_count", nullable = false)
    @Builder.Default
    private int viewsCount = 0;

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "published_at")
    private LocalDateTime publishedAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    /** Rough read time in minutes, from a 200-words-per-minute baseline. */
    public int readingMinutes() {
        if (body == null || body.isBlank()) return 1;
        return Math.max(1, body.trim().split("\\s+").length / 200);
    }
}
