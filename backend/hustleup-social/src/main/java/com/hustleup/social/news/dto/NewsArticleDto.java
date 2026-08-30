package com.hustleup.social.news.dto;

import com.hustleup.social.news.model.NewsArticle;
import lombok.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * API shape of a news article.
 *
 * <p>Comes in two forms. {@link #card} omits {@code body}, because the news page renders
 * dozens of articles at once and shipping every full article body to draw a grid of cards
 * would dominate the payload. {@link #full} includes it, for the reader view.
 */
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class NewsArticleDto {

    private UUID id;
    private UUID publisherUserId;
    private String outletName;
    private String outletLogoUrl;

    private String title;
    private String summary;
    /** Null on card(); populated by full(). */
    private String body;
    private String category;
    private String coverImageUrl;
    private List<String> mediaUrls;
    private List<String> tags;

    private String status;
    private int viewsCount;
    private int readingMinutes;
    private LocalDateTime publishedAt;
    private LocalDateTime createdAt;

    /** True only for the outlet that wrote it — gates edit controls in the UI. */
    private Boolean ownedByCurrentUser;

    /**
     * Set on articles aggregated from an outside feed; null on native ones.
     *
     * <p>The client uses {@code sourceName} to credit the outlet and {@code sourceUrl} to
     * send the reader to the original. Both are needed: an imported article stores only the
     * feed's summary, so a reader who wants the story has to be sent to the people who
     * wrote it rather than shown a truncated body with no way out.
     */
    private String sourceName;
    private String sourceUrl;

    /** Card projection: everything the news grid needs, without the article body. */
    public static NewsArticleDto card(NewsArticle a, Boolean owned) {
        if (a == null) return null;
        return base(a, owned).build();
    }

    /** Full projection: the card fields plus the body, for the reader view. */
    public static NewsArticleDto full(NewsArticle a, Boolean owned) {
        if (a == null) return null;
        return base(a, owned).body(a.getBody()).build();
    }

    private static NewsArticleDtoBuilder base(NewsArticle a, Boolean owned) {
        return NewsArticleDto.builder()
                .id(a.getId())
                .publisherUserId(a.getPublisherUserId())
                .outletName(a.getOutletName())
                .outletLogoUrl(a.getOutletLogoUrl())
                .title(a.getTitle())
                .summary(a.getSummary())
                .category(a.getCategory())
                .coverImageUrl(a.getCoverImageUrl())
                // Defensive copies: these are lazy collections, and handing the live proxy
                // to Jackson outside the session raises LazyInitializationException.
                .mediaUrls(a.getMediaUrls() != null ? new ArrayList<>(a.getMediaUrls()) : List.of())
                .tags(a.getTags() != null ? new ArrayList<>(a.getTags()) : List.of())
                .status(a.getStatus() != null ? a.getStatus().name() : null)
                .viewsCount(a.getViewsCount())
                .readingMinutes(a.readingMinutes())
                .publishedAt(a.getPublishedAt())
                .createdAt(a.getCreatedAt())
                .sourceName(a.getSourceName())
                .sourceUrl(a.getSourceUrl())
                .ownedByCurrentUser(owned);
    }
}
