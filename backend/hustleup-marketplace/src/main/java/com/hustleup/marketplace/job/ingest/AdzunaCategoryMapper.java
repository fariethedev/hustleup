package com.hustleup.marketplace.job.ingest;

import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Files an imported advert under one of the jobs board's own categories.
 *
 * <h2>Why the board's ids and not Adzuna's</h2>
 * <p>Adzuna returns its own taxonomy ("Logistics &amp; Warehouse Jobs", "Hospitality &amp;
 * Catering Jobs"), which matches nothing in the filter bar. Left unmapped, every imported
 * advert would be uncategorised and the category filters would stop reaching most of the
 * board — the same failure the news importer avoids with {@code NewsCategoryMapper}.
 *
 * <p>Matched against the advert's title and description as well as Adzuna's own label,
 * because the label is frequently absent and is coarse when present: "Other/General Jobs"
 * covers a great deal of what a student would actually take.
 */
@Component
public class AdzunaCategoryMapper {

    /**
     * Board category id → the words that put an advert in it.
     *
     * <p>First match wins, so the order is the priority order. Polish terms sit alongside
     * English because a large share of adverts in Poland are written in Polish, and matching
     * only English would file most of the board under "Everything else".
     */
    private static final Map<String, List<String>> KEYWORDS = new LinkedHashMap<>();

    static {
        KEYWORDS.put("it", List.of(
                "developer", "programist", "software", "engineer", "devops", "frontend",
                "backend", "full stack", "java", "python", "javascript", "qa ", "tester",
                "data scientist", "informatyk", " it "));

        KEYWORDS.put("healthcare", List.of(
                "nurse", "pielęgniar", "medical", "medyczn", "healthcare", "doctor",
                "lekarz", "opiekun osob", "caregiver", "carer", "physio", "dental"));

        KEYWORDS.put("teaching", List.of(
                "teacher", "nauczyciel", "tutor", "korepetycj", "lektor", "trainer",
                "education", "edukacj", "instructor", "wykładow"));

        KEYWORDS.put("babysitting", List.of(
                "babysit", "nanny", "niania", "childcare", "opieka nad dzieck", "au pair"));

        KEYWORDS.put("language", List.of(
                "translator", "tłumacz", "interpreter", "linguist", "native speaker",
                "language specialist", "copywriter", "proofread"));

        KEYWORDS.put("hospitality", List.of(
                "waiter", "waitress", "kelner", "barista", "bartender", "barman", "chef",
                "kucharz", "kitchen", "kuchni", "restaurant", "restauracj", "hotel",
                "hospitality", "catering", "gastronom", "food service"));

        KEYWORDS.put("delivery", List.of(
                "driver", "kierowc", "delivery", "dostaw", "kurier", "courier", "rider",
                "chauffeur", "transport"));

        KEYWORDS.put("warehouse", List.of(
                "warehouse", "magazyn", "picker", "packer", "forklift", "wózk",
                "logistics", "logistyk", "fulfilment", "fulfillment", "stock"));

        KEYWORDS.put("factory", List.of(
                "production", "produkcj", "factory", "fabryk", "assembly", "monter",
                "operator maszyn", "manufacturing", "welder", "spawacz", "cnc"));

        KEYWORDS.put("cleaning", List.of(
                "cleaner", "cleaning", "sprzątacz", "sprzątani", "housekeep", "janitor",
                "facilities", "maintenance", "konserwator"));

        KEYWORDS.put("support", List.of(
                "customer service", "customer support", "obsługa klienta", "call center",
                "call centre", "helpdesk", "help desk", "bok ", "contact center"));

        KEYWORDS.put("retail", List.of(
                "sales", "sprzedaw", "retail", "shop assistant", "cashier", "kasjer",
                "handlow", "merchandis", "store "));

        KEYWORDS.put("creative", List.of(
                "designer", "grafik", "marketing", "social media", "photograph", "fotograf",
                "video", "content creator", "ux", "ui "));

        KEYWORDS.put("office", List.of(
                "administrat", "office", "biuro", "assistant", "asystent", "accountant",
                "księgow", "hr ", "recruit", "rekrutacj", "analyst", "analityk", "specialist"));
    }

    /**
     * Picks a category for an imported advert.
     *
     * @param title        the advert's title
     * @param description  its body, where present
     * @param adzunaLabel  Adzuna's own category label, matched alongside the free text
     * @return a category id from the jobs board's list; never null
     */
    public String categorise(String title, String description, String adzunaLabel) {
        String haystack = ((title == null ? "" : title) + " "
                + (adzunaLabel == null ? "" : adzunaLabel) + " "
                // Only the opening of the description: the tail is usually boilerplate about
                // the company, and matching on it drags unrelated adverts into a category.
                + (description == null ? "" : description.substring(0, Math.min(description.length(), 400))))
                .toLowerCase(Locale.ROOT);

        for (Map.Entry<String, List<String>> category : KEYWORDS.entrySet()) {
            for (String keyword : category.getValue()) {
                if (haystack.contains(keyword)) return category.getKey();
            }
        }
        // An honest "we could not tell" beats guessing — the board has a category for it,
        // and a wrongly-filed advert is worse than an unfiled one.
        return "other";
    }
}
