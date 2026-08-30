package com.hustleup.social.news.ingest;

import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Files an imported article under one of the news page's own sections.
 *
 * <h2>Why this exists at all</h2>
 * <p>An imported article arrives with whatever categories its outlet uses — "Wiadomości",
 * "Region", "Sport" — which match nothing in HustleSpace's filter bar. Without a mapping,
 * every fetched story lands uncategorised, and the section filters silently stop being able
 * to reach the majority of the news page.
 *
 * <h2>Why keywords and not a model</h2>
 * <p>The classification needed here is coarse: is this about Lublin, about studying, about
 * visas, about somewhere to live. Keyword matching over a headline is legible, free,
 * instant, and wrong in ways a maintainer can see and fix by editing a list — none of which
 * is true of a model call per article on every poll.
 *
 * <p>The source's own configured category is the fallback, so an outlet that only ever
 * publishes Lublin news still files correctly even when a particular headline says nothing
 * matchable.
 */
@Component
public class NewsCategoryMapper {

    /**
     * Section id → the words that put an article in it.
     *
     * <p>Ordered most-specific first, and the first match wins: "student visa" should file
     * under visas rather than student life, and both are more useful than the generic
     * "poland" bucket. Polish terms sit alongside English because roughly half the sources
     * worth reading for Lublin publish in Polish.
     */
    private static final Map<String, List<String>> KEYWORDS = new java.util.LinkedHashMap<>();

    static {
        KEYWORDS.put("immigration", List.of(
                "visa", "wiza", "residence permit", "karta pobytu", "temporary residence",
                "residency", "work permit", "zezwolenie na prac", "pesel", "legalizacja",
                "immigration", "imigra", "cudzoziemc", "foreigner", "border guard", "schengen"));

        KEYWORDS.put("housing", List.of(
                "housing", "rent", "rental", "mieszkan", "wynajem", "akademik", "dormitory",
                "dorm", "landlord", "tenancy", "czynsz", "accommodation", "nieruchomo"));

        KEYWORDS.put("students", List.of(
                "student", "studen", "university", "uniwersytet", "umcs", "politechnika",
                "erasmus", "campus", "scholarship", "stypendium", "uczeln", "akademic",
                "graduate", "international student", "rekrutacja"));

        KEYWORDS.put("opportunity", List.of(
                "job", "jobs", "hiring", "praca", "zatrudnie", "internship", "staż",
                "career", "kariera", "recruit", "vacanc", "grant", "funding", "dotacj"));

        KEYWORDS.put("event", List.of(
                "festival", "festiwal", "concert", "koncert", "event", "wydarzeni",
                "exhibition", "wystawa", "meetup", "conference", "konferencj"));

        KEYWORDS.put("tech", List.of(
                "startup", "tech", "technolog", "software", " ai ", "developer",
                "programist", "cyber", "innowacj"));

        KEYWORDS.put("business", List.of(
                "business", "biznes", "invest", "inwestycj", "economy", "gospodark",
                "company", "firma", "market", "rynek"));

        KEYWORDS.put("regulation", List.of(
                "law", "prawo", "regulation", "przepis", "ustaw", "court", "sąd",
                "ministry", "ministerstw", "tax", "podatek", "zus"));

        // Checked last: almost any Lublin outlet's article mentions Lublin somewhere, so
        // matching it early would swallow the more specific sections above.
        KEYWORDS.put("lublin", List.of(
                "lublin", "lubelsk", "lubelszczyzn", "świdnik", "zamość", "chełm"));
    }

    /**
     * Picks a section for an article.
     *
     * @param title           the headline
     * @param summary         the standfirst, if the feed carried one
     * @param sourceDefault   the section configured for this outlet, used when nothing matches
     * @return a section id from the news page's list; never null
     */
    public String categorise(String title, String summary, String sourceDefault) {
        String haystack = ((title == null ? "" : title) + " " + (summary == null ? "" : summary))
                .toLowerCase(Locale.ROOT);

        for (Map.Entry<String, List<String>> section : KEYWORDS.entrySet()) {
            for (String keyword : section.getValue()) {
                if (haystack.contains(keyword)) return section.getKey();
            }
        }

        // Nothing matched: trust what the outlet was configured as, and fall back to the
        // country section rather than inventing a topic for it.
        return sourceDefault != null && !sourceDefault.isBlank() ? sourceDefault : "poland";
    }
}
