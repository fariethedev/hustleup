package com.hustleup.marketplace.trust;

import com.hustleup.marketplace.listing.repository.ListingRepository;
import com.hustleup.marketplace.payments.service.SellerRiskService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Decides whether a new or edited listing may go live straight away or must wait for a
 * moderator — the "catch it before money moves" layer against fake-phone shops.
 *
 * <p>A listing is held ({@code PENDING_REVIEW}) when:
 * <ol>
 *   <li>its text uses counterfeit language ("replica", "1:1", "AAA quality"…);</li>
 *   <li>it is a high-risk item (phones, consoles, laptops, designer goods) from a seller with
 *       fewer than {@value #ESTABLISHED_SALES} confirmed sales; or</li>
 *   <li>its price is far below what similar live listings ask ({@value #PRICE_FLOOR_PERCENT}% of
 *       the median), or below a sanity floor for well-known models.</li>
 * </ol>
 * Nothing is rejected automatically: a person approves or removes it, with reasons.
 */
@Service
@RequiredArgsConstructor
public class ListingRiskService {

    static final int ESTABLISHED_SALES = 5;
    static final int PRICE_FLOOR_PERCENT = 40;
    private static final int MIN_SAMPLES = 5;

    private final ListingRepository listingRepository;
    private final SellerRiskService sellerRiskService;

    private static final Pattern COUNTERFEIT = Pattern.compile(
            "\\b(replica|replika|fake|podr[oó]bk\\w*|1:1|aaa\\+? quality|mirror quality|copy|kopia|inspired by|"
            + "same as original|unbranded \\w+ style|super ?copy|high quality copy)\\b",
            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);

    /**
     * High-risk keywords and, for the best-known models, a PLN price below which a genuine
     * item is implausible whatever the market data says.
     */
    private static final Map<String, Integer> HIGH_RISK = Map.ofEntries(
            Map.entry("iphone", 600), Map.entry("ipad", 500), Map.entry("macbook", 1000),
            Map.entry("airpods", 150), Map.entry("apple watch", 300), Map.entry("galaxy s", 500),
            Map.entry("samsung galaxy", 400), Map.entry("pixel", 400), Map.entry("playstation", 500),
            Map.entry("ps5", 900), Map.entry("xbox", 500), Map.entry("nintendo switch", 400),
            Map.entry("steam deck", 900), Map.entry("rtx", 600), Map.entry("dyson", 400),
            Map.entry("rolex", 5000), Map.entry("omega", 2000), Map.entry("louis vuitton", 800),
            Map.entry("gucci", 600), Map.entry("chanel", 800), Map.entry("dior", 600),
            Map.entry("prada", 600), Map.entry("balenciaga", 600), Map.entry("jordan", 150),
            Map.entry("yeezy", 300), Map.entry("off-white", 300), Map.entry("moncler", 800),
            Map.entry("canada goose", 800), Map.entry("gopro", 300), Map.entry("canon eos", 800),
            Map.entry("sony a7", 2000));

    /** Why this listing should wait for a moderator, or empty if it can go live. */
    public Optional<String> assess(UUID sellerId, String title, String description, BigDecimal price, String currency) {
        String text = ((title == null ? "" : title) + " " + (description == null ? "" : description)).toLowerCase(Locale.ROOT);
        String titleLc = title == null ? "" : title.toLowerCase(Locale.ROOT);
        List<String> reasons = new ArrayList<>();

        if (COUNTERFEIT.matcher(text).find()) {
            reasons.add("Uses wording associated with counterfeit goods");
        }

        String keyword = HIGH_RISK.keySet().stream().filter(titleLc::contains)
                .max((a, b) -> Integer.compare(a.length(), b.length())).orElse(null);
        if (keyword != null) {
            long confirmed = 0;
            try { confirmed = sellerRiskService.status(sellerId).confirmedSales(); } catch (Exception ignored) { }
            if (confirmed < ESTABLISHED_SALES) {
                reasons.add("High-risk item (" + keyword + ") from a seller with fewer than "
                        + ESTABLISHED_SALES + " completed sales");
            }
            if (price != null && price.signum() > 0) {
                String cur = currency == null ? "PLN" : currency.toUpperCase(Locale.ROOT);
                if ("PLN".equals(cur) && price.compareTo(BigDecimal.valueOf(HIGH_RISK.get(keyword))) < 0) {
                    reasons.add("Price is below what a genuine " + keyword + " plausibly sells for");
                } else {
                    BigDecimal median = median(listingRepository.findActivePricesByTitleKeyword(keyword, cur));
                    if (median != null && price.multiply(BigDecimal.valueOf(100))
                            .compareTo(median.multiply(BigDecimal.valueOf(PRICE_FLOOR_PERCENT))) < 0) {
                        reasons.add("Price is under " + PRICE_FLOOR_PERCENT + "% of similar listings (median "
                                + median.stripTrailingZeros().toPlainString() + " " + cur + ")");
                    }
                }
            }
        }
        return reasons.isEmpty() ? Optional.empty() : Optional.of(String.join("; ", reasons));
    }

    private static BigDecimal median(List<BigDecimal> prices) {
        if (prices == null || prices.size() < MIN_SAMPLES) return null;
        List<BigDecimal> sorted = prices.stream().sorted().toList();
        int mid = sorted.size() / 2;
        return sorted.size() % 2 == 1 ? sorted.get(mid)
                : sorted.get(mid - 1).add(sorted.get(mid)).divide(BigDecimal.valueOf(2));
    }
}
