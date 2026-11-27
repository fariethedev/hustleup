package com.hustleup.common.safety;

import java.util.regex.Pattern;

/**
 * Spots chat messages that try to move a deal off HustleSpace — the classic opening of a
 * marketplace scam ("pay me by BLIK / bank transfer instead, it's cheaper"). A buyer who pays
 * outside the platform has no buyer protection, no refund and no record.
 *
 * <p>The message is still delivered: this only labels it, so the apps can warn the reader,
 * and moderators can see the pattern on an account. English and Polish phrasing.
 */
public final class OffPlatformDetector {
    private OffPlatformDetector() {}

    /** Asking to pay or be paid outside the app. */
    public static final String OFF_PLATFORM_PAYMENT = "OFF_PLATFORM_PAYMENT";
    /** Pushing the conversation to another channel (phone, WhatsApp, Telegram). */
    public static final String CONTACT_SHARING = "CONTACT_SHARING";

    private static final Pattern PAYMENT = Pattern.compile(
            "\\b(blik|przelew\\w*|bank ?transfer|wire transfer|iban|nr ?konta|numer ?konta|account number|"
            + "revolut|paypal|western ?union|moneygram|zelle|cash ?app|venmo|skrill|crypto|bitcoin|btc|usdt|"
            + "pay (me )?(outside|off|directly|direct)|outside (the )?app|poza (aplikacj\\w+|platform\\w+)|"
            + "zapła\\w* bezpośrednio|bez (aplikacji|platformy)|prepaid|gift ?card)\\b",
            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);

    private static final Pattern CONTACT = Pattern.compile(
            "(\\bwhats ?app\\b|\\btelegram\\b|\\bsignal\\b|\\bviber\\b|\\bwechat\\b|"
            + "(\\+?48[\\s-]?)?\\b\\d{3}[\\s-]?\\d{3}[\\s-]?\\d{3}\\b|"            // Polish mobile numbers
            + "\\b[\\w.+-]+@[\\w-]+\\.[a-z]{2,}\\b)",                               // email addresses
            Pattern.CASE_INSENSITIVE);

    /** The strongest flag that applies, or null for an ordinary message. */
    public static String classify(String text) {
        if (text == null || text.isBlank()) return null;
        if (PAYMENT.matcher(text).find()) return OFF_PLATFORM_PAYMENT;
        if (CONTACT.matcher(text).find()) return CONTACT_SHARING;
        return null;
    }
}
