/** Legacy media cleanup and identification of old generated padding. Never adds media. */
package com.hustleup.marketplace.listing.service;

import com.hustleup.marketplace.listing.model.ListingType;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

@Component
public class ListingMediaLibrary {

    /**
     * Historical padding threshold. Retained for compatibility; padding is now disabled.
     */
    public static final int MIN_MEDIA = 5;

    /**
     * Substrings identifying media that no longer resolves upstream. Matched with
     * {@code contains} rather than equality because the same dead photo can be stored with
     * different width/quality query strings.
     */
    private static final List<String> DEAD_URL_FRAGMENTS = List.of(
            // Unsplash removed this photo; it was the original "Luxury Scented Candles" image
            // and rendered as a broken thumbnail everywhere that listing appeared.
            "photo-1602607144291-ea57ab0dc5fc"
    );

    /** Standard rendering parameters appended to every curated Unsplash URL. */
    private static final String RENDER_PARAMS = "?w=1200&q=80";

    /**
     * Category-matched supporting shots. Order matters only in that it defines the rotation
     * a listing walks through; the entry point into each list is derived from the listing id.
     */
    private static final Map<ListingType, List<String>> GALLERIES = Map.of(
            ListingType.HAIR_BEAUTY, unsplash(
                    "1522337360788-8b13dee7a37e", "1560066984-138dadb4c035", "1503951914875-452162b0f3f1",
                    "1595476108010-b4d1f102b1b1", "1562322140-8baeececf3df", "1580618672591-eb180b1a973f",
                    "1596462502278-27bfdc403348", "1519699047748-de8e457a634e", "1516975080664-ed2fc6a32937"),

            ListingType.FOOD, unsplash(
                    "1567620905732-2d1ec7ab7445", "1512621776951-a57141f2eefd", "1504674900247-0877df9cc836",
                    "1414235077428-338989a2e8c0", "1466637574441-749b8f19452f", "1490645935967-10de6ba17061",
                    "1555939594-58d7cb561ad1", "1476224203421-9ac39bcb3327", "1540189549336-e6e99c3679fe"),

            ListingType.EVENT, unsplash(
                    "1504609773096-104ff2c73ba4", "1516450360452-9312f5e86fc7", "1519741497674-611481863552",
                    "1492684223066-81342ee5ff30", "1533174072545-7a4b6ad7a6c3", "1501281668745-f7f57925c3b4",
                    "1524368535928-5b5e00ddc76b", "1459749411175-04bf5292ceea"),

            ListingType.FASHION, unsplash(
                    "1594938298603-c8148c4dae35", "1556905055-8f358a7a47b2", "1490481651871-ab68de25d43d",
                    "1483985988355-763728e1935b", "1445205170230-053b83016050", "1479064555552-3ef4979f8908",
                    "1523381210434-271e8be1f52b", "1441984904996-e0b6ba687e04"),

            ListingType.GOODS, unsplash(
                    "1515562141207-7a88fb7ce338", "1549298916-b41d501d3772", "1496181133206-80ce9b88a853",
                    "1513519245088-0e12902e5a38", "1526170375885-4d8ecf77b99f", "1608571423902-eed4a5ad8108",
                    "1493663284031-b7e3aefcae8e", "1521572163474-6864f9cf17ab"),

            ListingType.SKILL, unsplash(
                    "1555066931-4365d14bab8c", "1626785774573-4b799315345d", "1581291518857-4e27b48ff24e",
                    "1542038784456-1ea8e935640e", "1478737270239-2f02b77fc618", "1611162616305-c69b3fa7fbe0",
                    "1517245386807-bb43f82c33c4", "1531482615713-2afd69097998", "1522071820081-009f0129c71c"),

            ListingType.JOB, unsplash(
                    "1521737604893-d14cc237f11d", "1497366754035-f200968a6e72", "1524758631624-e2822e304c36",
                    "1497215728101-856f4ea42174", "1556761175-b413da4baf72", "1454165804606-c3d57bc86b40"),

            ListingType.RENTAL, unsplash(
                    "1560448204-e02f11c3d0e2", "1502672260266-1c1ef2d93688", "1493809842364-78817add7ffb",
                    "1522708323590-d24dbb6b0267", "1484154218962-a197022b5858", "1512917774080-9991f1c4c750")
    );

    /** Expands bare Unsplash photo ids into full render URLs, keeping the tables above readable. */
    private static List<String> unsplash(String... photoIds) {
        return Arrays.stream(photoIds)
                .map(id -> "https://images.unsplash.com/photo-" + id + RENDER_PARAMS)
                .toList();
    }

    /** Compatibility entry point: preserves supplied live URLs without adding stock media. */
    public String padToMinimum(String existingCsv, ListingType type, String variantSeed) {
        // Compatibility only: never invent media, even if an old caller invokes this method.
        return String.join(",", liveUrls(existingCsv));
    }

    /** Exact historical padding URLs only; uploaded files and other external URLs are untouched. */
    public static boolean isGeneratedPadding(String url) {
        return GALLERIES.values().stream().anyMatch(pool -> pool.contains(url));
    }

    /**
     * Splits a stored CSV into individual URLs, dropping blanks and anything on the
     * {@link #DEAD_URL_FRAGMENTS} list.
     */
    private List<String> liveUrls(String csv) {
        if (csv == null || csv.isBlank()) return List.of();
        List<String> urls = new ArrayList<>();
        for (String raw : csv.split(",")) {
            String url = raw.trim();
            if (url.isEmpty() || isDead(url)) continue;
            urls.add(url);
        }
        return urls;
    }

    /**
     * The stored CSV with dead and blank entries removed, and nothing added.
     *
     * <p>Gallery padding was removed — a listing shows the seller's own photographs — but
     * dropping media that no longer loads is still worth doing, and this is that half on its
     * own. Returns null when nothing would change, so a caller can skip the write.
     */
    public String stripDeadUrls(String existingCsv) {
        List<String> live = liveUrls(existingCsv);
        int rawTokens = existingCsv == null || existingCsv.isBlank() ? 0 : existingCsv.split(",").length;
        if (live.size() == rawTokens) return null; // nothing dead — leave the row alone
        return String.join(",", live);
    }

    /** True if the URL matches a known-dead upstream asset. */
    private boolean isDead(String url) {
        return DEAD_URL_FRAGMENTS.stream().anyMatch(url::contains);
    }

    /** Padding is disabled, including for legacy callers. */
    public boolean needsPadding(String existingCsv) {
        return false;
    }
}
