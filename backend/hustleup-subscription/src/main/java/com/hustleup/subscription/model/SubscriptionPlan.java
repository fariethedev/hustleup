package com.hustleup.subscription.model;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.Optional;

/**
 * The Premium price list, defined on the server.
 *
 * <h2>Why the prices live here and not in the request</h2>
 * <p>The previous checkout endpoint took a Stripe {@code priceId} straight from the request
 * body, which let the caller name their own price — pass the id of any cheaper Price object
 * on the account and Stripe charges that instead. Prices are chosen here, by enum constant,
 * and the client only ever sends which <em>plan</em> it wants.
 *
 * <h2>Why the amounts are inline rather than Stripe Price IDs</h2>
 * <p>Inline {@code price_data} means the amounts work against any Stripe account with no
 * dashboard setup, so a fresh test key or a rotated account cannot leave checkout pointing
 * at a Price that no longer exists. The trade-off is that changing a price is a code change.
 *
 * <p>Each plan is a one-time payment buying a fixed term, not an auto-renewing subscription.
 * {@code Subscription.expiresAt} already models exactly that.
 */
public enum SubscriptionPlan {

    /** 9 zł for one month of Plus access. */
    MONTHLY("Plus", 900, 1),

    /** 20 zł for one month of full HustleSpace access. */
    ALL_ACCESS("All Access", 2000, 1),

    /**
     * Legacy checkout identifiers kept readable so old Stripe webhook metadata can still be
     * confirmed. They are intentionally omitted from the public plan list.
     */
    @Deprecated QUARTERLY("3 Months", 2500, 3, true),
    @Deprecated ANNUAL("12 Months", 10_000, 12, true);

    /** ISO 4217 code. Poland is the primary market, so everything is priced in złoty. */
    public static final String CURRENCY = "PLN";

    private final String label;

    /**
     * Price in grosze. Stripe takes amounts in a currency's minor unit, and PLN has two
     * decimal places, so 9 zł is 900 — holding it as an integer avoids ever rounding a
     * price at charge time.
     */
    private final long amountMinorUnits;

    private final int months;
    private final boolean legacy;

    SubscriptionPlan(String label, long amountMinorUnits, int months) {
        this(label, amountMinorUnits, months, false);
    }

    SubscriptionPlan(String label, long amountMinorUnits, int months, boolean legacy) {
        this.label = label;
        this.amountMinorUnits = amountMinorUnits;
        this.months = months;
        this.legacy = legacy;
    }

    public String getLabel() { return label; }

    public long getAmountMinorUnits() { return amountMinorUnits; }

    public int getMonths() { return months; }

    public boolean isLegacy() { return legacy; }

    /** The price as a decimal, for display and for the stored subscription record. */
    public BigDecimal getAmount() {
        return BigDecimal.valueOf(amountMinorUnits, 2);
    }

    /** Effective monthly cost, so the UI can show what each term actually saves. */
    public BigDecimal getPricePerMonth() {
        return getAmount().divide(BigDecimal.valueOf(months), 2, java.math.RoundingMode.HALF_UP);
    }

    /**
     * Resolves a plan name from a request or from Stripe metadata.
     *
     * <p>Returns empty rather than throwing on an unknown value: this parses input that
     * crosses a trust boundary in both directions — a request body, and a webhook payload
     * echoing metadata back — and callers should reject those explicitly.
     */
    public static Optional<SubscriptionPlan> from(String name) {
        if (name == null || name.isBlank()) return Optional.empty();
        return Arrays.stream(values())
                .filter(p -> p.name().equalsIgnoreCase(name.trim()))
                .findFirst();
    }
}
