/**
 * Guarantees that every listing carries a full gallery of supporting media.
 *
 * <p>A listing with a single photo looks half-finished next to one with a real gallery, and
 * the detail page's thumbnail strip only appears once there is more than one item. Sellers
 * frequently upload one image and stop, so this class tops every listing's media list up to
 * {@link #MIN_MEDIA} entries using a curated, category-matched pool of supporting shots.
 *
 * <h3>How the padding works</h3>
 * <ul>
 *   <li>Whatever the seller actually uploaded always comes <b>first</b> — their own photos and
 *       videos are the hero images, and padding only ever appends behind them.</li>
 *   <li>The pool is picked by {@link ListingType}, so a FOOD listing is padded with food shots
 *       and a RENTAL listing with interiors.</li>
 *   <li>The starting offset into the pool is derived from the listing's own id, so two listings
 *       of the same category don't end up with an identical gallery, and any given listing gets
 *       the same supporting shots every time it is padded (the choice is stable, not random).</li>
 *   <li>Entries the listing already has are skipped, so padding never duplicates an image.</li>
 * </ul>
 *
 * <h3>Dead URLs</h3>
 * <p>{@link #DEAD_URL_FRAGMENTS} lists media that used to exist upstream but now 404s. Those
 * entries are dropped whenever a listing's media passes through here, so a broken thumbnail
 * heals itself rather than needing a manual database edit. Every URL in the pools below was
 * checked as reachable when it was added — add to the dead list rather than silently swapping
 * a URL, so the reason a link disappeared stays visible in the source.
 */
package com.hustleup.marketplace.listing.service;

import com.hustleup.marketplace.listing.model.ListingType;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Component
public class ListingMediaLibrary {

    /**
     * Minimum number of supporting images/videos every listing is guaranteed to expose.
     * Five is enough to fill the detail page's thumbnail strip without the gallery
     * turning into an endless scroll.
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

    /**
     * Returns the listing's media as a comma-separated string containing at least
     * {@link #MIN_MEDIA} entries, with dead URLs removed and the seller's own uploads kept
     * at the front.
     *
     * @param existingCsv the {@code media_urls} value currently on the listing (may be null/blank)
     * @param type        the listing's category, which selects the supporting-media pool
     * @param variantSeed any stable per-listing string (its id once saved, otherwise its title).
     *                    Only used to pick the entry point into the pool, so that two listings in
     *                    the same category don't get an identical gallery. Null starts at the top.
     * @return a CSV of at least {@link #MIN_MEDIA} media URLs
     */
    public String padToMinimum(String existingCsv, ListingType type, String variantSeed) {
        // LinkedHashSet: preserves the seller's original ordering while making the
        // "don't add something that's already here" check a cheap lookup.
        Set<String> media = new LinkedHashSet<>(liveUrls(existingCsv));

        List<String> pool = GALLERIES.getOrDefault(type, GALLERIES.get(ListingType.GOODS));
        // Math.floorMod (not %) because hashCode() is frequently negative and a negative
        // index would blow up on the first pool lookup.
        int offset = variantSeed == null ? 0 : Math.floorMod(variantSeed.hashCode(), pool.size());

        // Walk the whole pool once from the offset. Bounding the loop by pool.size() rather
        // than "until we have MIN_MEDIA" means a pool smaller than MIN_MEDIA (or one whose
        // entries the listing already has) terminates instead of spinning forever.
        for (int i = 0; i < pool.size() && media.size() < MIN_MEDIA; i++) {
            media.add(pool.get((offset + i) % pool.size()));
        }

        return String.join(",", media);
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

    /** True if the URL matches a known-dead upstream asset. */
    private boolean isDead(String url) {
        return DEAD_URL_FRAGMENTS.stream().anyMatch(url::contains);
    }

    /**
     * Whether a listing's stored media needs rewriting — either it is short of
     * {@link #MIN_MEDIA} live entries, or it contains something {@link #padToMinimum} would
     * strip (a dead URL, a blank token). Used by the startup backfill so listings that are
     * already healthy are left untouched and the runner is a no-op after its first pass.
     */
    public boolean needsPadding(String existingCsv) {
        List<String> live = liveUrls(existingCsv);
        if (live.size() < MIN_MEDIA) return true;
        // Fewer live entries than raw tokens means padToMinimum would drop something, so the
        // stored value is stale even though it's long enough.
        int rawTokens = existingCsv == null || existingCsv.isBlank() ? 0 : existingCsv.split(",").length;
        return live.size() != rawTokens;
    }
}
