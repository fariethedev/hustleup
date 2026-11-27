package com.hustleup.common.util;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.util.Locale;

/**
 * Human-readable prices for emails, notifications and Stripe descriptions.
 *
 * <p>Amounts are stored as {@code DECIMAL(19,4)}, so concatenating a {@link BigDecimal} straight
 * into text printed "120.0000 PLN". This prints whole amounts without decimals ("120 PLN"),
 * anything else with exactly two ("120.50 PLN"), and groups thousands ("1,250 PLN").
 */
public final class Money {
    private Money() {}

    public static String format(BigDecimal amount, String currency) {
        String code = currency == null || currency.isBlank() ? "PLN" : currency.trim().toUpperCase(Locale.ROOT);
        if (amount == null) return "— " + code;
        BigDecimal cents = amount.setScale(2, RoundingMode.HALF_UP);
        boolean whole = cents.remainder(BigDecimal.ONE).signum() == 0;
        DecimalFormat f = new DecimalFormat(whole ? "#,##0" : "#,##0.00", DecimalFormatSymbols.getInstance(Locale.ENGLISH));
        return f.format(cents) + " " + code;
    }

    /** Unit price times quantity, formatted. */
    public static String format(BigDecimal unit, int quantity, String currency) {
        return format(unit == null ? null : unit.multiply(BigDecimal.valueOf(Math.max(1, quantity))), currency);
    }
}
