package com.hustleup.social.news.repository;

import com.hustleup.social.news.model.NewsArticle;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

/** Data access for news articles. */
@Repository
public interface NewsArticleRepository extends JpaRepository<NewsArticle, UUID> {

    /**
     * The public news page: published articles only, newest first, with optional section
     * and free-text filters.
     *
     * <p>Both filters follow the "null means do not filter" pattern so a single query
     * serves every combination the page can ask for. Search covers title, summary and
     * outlet name — the three things a reader would type looking for a story.
     */
    @Query("""
           SELECT a FROM NewsArticle a
           WHERE a.status = com.hustleup.social.news.model.NewsArticle$ArticleStatus.PUBLISHED
             AND (:category IS NULL OR a.category = :category)
             AND (:q IS NULL OR LOWER(a.title) LIKE %:q%
                             OR LOWER(a.summary) LIKE %:q%
                             OR LOWER(a.outletName) LIKE %:q%)
           ORDER BY a.publishedAt DESC
           """)
    Page<NewsArticle> findPublished(String category, String q, Pageable pageable);

    /** Everything one outlet has written, drafts included — their newsroom view. */
    List<NewsArticle> findByPublisherUserIdOrderByCreatedAtDesc(UUID publisherUserId);

    /** Admin/moderation view. */
    List<NewsArticle> findAllByOrderByCreatedAtDesc();

    long countByStatus(NewsArticle.ArticleStatus status);
}
