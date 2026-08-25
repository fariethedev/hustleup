package com.hustleup.social.news.controller;

import com.hustleup.common.model.PublisherProfile;
import com.hustleup.common.model.Role;
import com.hustleup.common.model.User;
import com.hustleup.common.publisher.PublisherGuard;
import com.hustleup.common.storage.FileStorageService;
import com.hustleup.social.news.dto.NewsArticleDto;
import com.hustleup.social.news.model.NewsArticle;
import com.hustleup.social.news.repository.NewsArticleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * The News desk.
 *
 * <p><b>Reading is public; publishing requires an approved NEWS_OUTLET profile.</b> This
 * is the surface where an unverified poster does the most reputational damage, so the gate
 * is the same shared {@link PublisherGuard} that Jobs uses — one rule, enforced identically
 * in both services.
 */
@RestController
@RequestMapping("/api/v1/news")
@RequiredArgsConstructor
@Slf4j
public class NewsController {

    private final NewsArticleRepository articleRepository;
    private final PublisherGuard publisherGuard;
    private final FileStorageService fileStorageService;

    // ---- Public reading -----------------------------------------------------

    /**
     * The news page.
     *
     * <p><b>GET /api/v1/news</b> - public. Params: category, q, page, size.
     */
    @GetMapping
    public ResponseEntity<?> feed(@RequestParam(required = false) String category,
                                  @RequestParam(required = false) String q,
                                  @RequestParam(defaultValue = "0") int page,
                                  @RequestParam(defaultValue = "24") int size) {
        String search = (q == null || q.isBlank()) ? null : q.toLowerCase();
        String cat = (category == null || category.isBlank() || "all".equalsIgnoreCase(category))
                ? null : category;

        var results = articleRepository.findPublished(cat, search,
                PageRequest.of(Math.max(0, page), Math.min(100, Math.max(1, size))));

        User me = publisherGuard.currentUser().orElse(null);
        List<NewsArticleDto> dtos = results.getContent().stream()
                .map(a -> NewsArticleDto.card(a, me != null && me.getId().equals(a.getPublisherUserId())))
                .collect(Collectors.toList());

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("content", dtos);
        body.put("page", results.getNumber());
        body.put("totalPages", results.getTotalPages());
        body.put("totalElements", results.getTotalElements());
        return ResponseEntity.ok(body);
    }

    /**
     * One article in full, and bumps its view counter.
     *
     * <p><b>GET /api/v1/news/{id}</b> - public for published articles. A draft is visible
     * only to the outlet that wrote it (and to admins), so an unpublished story cannot be
     * read early by guessing its id.
     */
    @GetMapping("/{id}")
    public ResponseEntity<?> one(@PathVariable UUID id) {
        NewsArticle article = articleRepository.findById(id).orElse(null);
        if (article == null) return notFound("Article not found");

        User me = publisherGuard.currentUser().orElse(null);
        boolean owned = me != null && me.getId().equals(article.getPublisherUserId());
        boolean isAdmin = me != null && me.getRole() == Role.ADMIN;

        if (article.getStatus() != NewsArticle.ArticleStatus.PUBLISHED && !owned && !isAdmin) {
            return notFound("Article not found");
        }

        article.setViewsCount(article.getViewsCount() + 1);
        articleRepository.save(article);

        return ResponseEntity.ok(NewsArticleDto.full(article, owned));
    }

    // ---- Publishing (verified outlets only) ---------------------------------

    /**
     * Publishes an article.
     *
     * <p><b>POST /api/v1/news</b> - multipart, so the cover image and any inline media
     * arrive with the article.
     *
     * <p>Requires an approved NEWS_OUTLET profile. The byline comes from that profile and
     * never from the request body, so one outlet cannot publish under another's name.
     */
    @PostMapping(consumes = "multipart/form-data")
    public ResponseEntity<?> create(@RequestParam String title,
                                    @RequestParam String body,
                                    @RequestParam(required = false) String summary,
                                    @RequestParam(required = false) String category,
                                    @RequestParam(required = false) String tags,
                                    @RequestParam(defaultValue = "PUBLISHED") String status,
                                    @RequestParam(required = false) MultipartFile coverImage,
                                    @RequestParam(required = false) List<MultipartFile> media) {
        PublisherProfile outlet;
        try {
            outlet = publisherGuard.requirePublisher(PublisherProfile.PublisherType.NEWS_OUTLET);
        } catch (PublisherGuard.NotAPublisherException e) {
            return forbidden(e.getMessage());
        }

        if (title.isBlank() || body.isBlank()) {
            return badRequest("Title and body are required");
        }

        NewsArticle.ArticleStatus parsedStatus;
        try {
            parsedStatus = NewsArticle.ArticleStatus.valueOf(status.toUpperCase());
        } catch (IllegalArgumentException e) {
            return badRequest("Invalid status. Allowed: DRAFT, PUBLISHED, ARCHIVED, REMOVED");
        }

        String coverUrl = null;
        List<String> mediaUrls = new ArrayList<>();
        try {
            if (coverImage != null && !coverImage.isEmpty()) {
                coverUrl = fileStorageService.store(coverImage);
            }
            if (media != null) {
                for (MultipartFile f : media) {
                    if (f != null && !f.isEmpty()) mediaUrls.add(fileStorageService.store(f));
                }
            }
        } catch (IllegalArgumentException e) {
            // Upload allowlist rejection - surface the reason rather than a bare 500.
            return badRequest(e.getMessage());
        }

        NewsArticle article = NewsArticle.builder()
                .publisherUserId(outlet.getUserId())
                .publisherProfileId(outlet.getId())
                .outletName(outlet.getCompanyName())
                .outletLogoUrl(outlet.getLogoUrl())
                .title(title.trim())
                .summary(summary)
                .body(body)
                .category(category)
                .coverImageUrl(coverUrl)
                .mediaUrls(mediaUrls)
                .tags(splitTags(tags))
                .status(parsedStatus)
                .publishedAt(parsedStatus == NewsArticle.ArticleStatus.PUBLISHED
                        ? LocalDateTime.now() : null)
                .build();

        NewsArticle saved = articleRepository.save(article);
        log.info("Article {}: id={} outlet={}", parsedStatus, saved.getId(), outlet.getCompanyName());
        return ResponseEntity.status(HttpStatus.CREATED).body(NewsArticleDto.full(saved, true));
    }

    /** Articles written by the caller, drafts included. <b>GET /api/v1/news/mine</b> */
    @GetMapping("/mine")
    public ResponseEntity<?> mine() {
        User me = publisherGuard.currentUser().orElse(null);
        if (me == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(articleRepository.findByPublisherUserIdOrderByCreatedAtDesc(me.getId())
                .stream().map(a -> NewsArticleDto.card(a, true)).collect(Collectors.toList()));
    }

    /**
     * Changes an article's state, e.g. publishing a draft or archiving a story.
     *
     * <p><b>PATCH /api/v1/news/{id}/status</b> - author or admin only.
     */
    @PatchMapping("/{id}/status")
    public ResponseEntity<?> setStatus(@PathVariable UUID id, @RequestBody Map<String, String> payload) {
        User me = publisherGuard.currentUser().orElse(null);
        if (me == null) return ResponseEntity.status(401).build();
        NewsArticle article = articleRepository.findById(id).orElse(null);
        if (article == null) return notFound("Article not found");
        if (!article.getPublisherUserId().equals(me.getId()) && me.getRole() != Role.ADMIN) {
            return forbidden("You can only change your own articles");
        }

        NewsArticle.ArticleStatus next;
        try {
            next = NewsArticle.ArticleStatus.valueOf(String.valueOf(payload.get("status")).toUpperCase());
        } catch (IllegalArgumentException e) {
            return badRequest("Invalid status. Allowed: DRAFT, PUBLISHED, ARCHIVED, REMOVED");
        }

        // Stamp publishedAt the first time it goes live, and never overwrite it after —
        // an article that is archived and restored keeps its original publication date.
        if (next == NewsArticle.ArticleStatus.PUBLISHED && article.getPublishedAt() == null) {
            article.setPublishedAt(LocalDateTime.now());
        }
        article.setStatus(next);
        article.setUpdatedAt(LocalDateTime.now());
        return ResponseEntity.ok(NewsArticleDto.card(articleRepository.save(article), true));
    }

    // ---- Helpers ------------------------------------------------------------

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
