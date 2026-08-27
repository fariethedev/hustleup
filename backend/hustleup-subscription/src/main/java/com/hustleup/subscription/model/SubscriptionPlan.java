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

    /** 9.99 zł for one month. */
    MONTHLY("Monthly", 999, 1),

    /** 25 zł for three months — works out cheaper per month than MONTHLY. */
    QUARTERLY("3 Months", 2500, 3),

    /** 100 zł for a full year. */
    ANNUAL("12 Months", 10_000, 12);

    /** ISO 4217 code. Poland is the primary market, so everything is priced in złoty. */
    public static final String CURRENCY = "PLN";

    private final String label;

    /**
     * Price in grosze. Stripe takes amounts in a currency's minor unit, and PLN has two
     * decimal places, so 9.99 zł is 999 — holding it as an integer avoids ever rounding a
     * price at charge time.
     */
    private final long amountMinorUnits;

    private final int months;

    SubscriptionPlan(String label, long amountMinorUnits, int months) {
        this.label = label;
        this.amountMinorUnits = amountMinorUnits;
        this.months = months;
    }

    public String getLabel() { return label; }

    public long getAmountMinorUnits() { return amountMinorUnits; }

    public int getMonths() { return months; }

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
