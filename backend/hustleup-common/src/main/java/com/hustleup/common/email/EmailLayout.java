package com.hustleup.common.email;

/**
 * The branded HTML shell every HustleSpace email is sent in, plus small helpers for the
 * pieces bodies repeat (call-to-action buttons, one-time codes).
 *
 * <p>Email clients ignore stylesheets and most modern CSS, so everything is inline styles on
 * tables. The logo is referenced by absolute URL (emails cannot bundle relative assets) and
 * can be overridden with the {@code EMAIL_LOGO_URL} environment variable.
 */
public final class EmailLayout {
    private EmailLayout() {}

    // Brand palette (frontend/src/index.css @theme + the logo itself).
    static final String LIME = "#D3FF37";
    static final String VIOLET = "#7D39EB";
    static final String INK = "#111111";
    static final String MUTED = "#5B5F57";
    static final String PAGE = "#F4F5F0";
    static final String LINE = "#E6E8E0";

    private static final String DEFAULT_LOGO_URL = "https://hustlespace.space/hustlespace-logo.png";

    static String logoUrl() {
        String fromEnv = System.getenv("EMAIL_LOGO_URL");
        return fromEnv == null || fromEnv.isBlank() ? DEFAULT_LOGO_URL : fromEnv.trim();
    }

    public static String escape(String text) {
        return text == null ? "" : text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;").replace("'", "&#39;");
    }

    /** A lime call-to-action button. {@code href} and {@code label} are escaped here. */
    public static String button(String href, String label) {
        return ("<table role=\"presentation\" cellspacing=\"0\" cellpadding=\"0\" style=\"margin:24px 0\"><tr>"
                + "<td style=\"border-radius:12px;background:%s\">"
                + "<a href=\"%s\" style=\"display:inline-block;padding:14px 26px;border-radius:12px;background:%s;"
                + "color:%s;font-size:15px;font-weight:bold;text-decoration:none\">%s</a></td></tr></table>")
                .formatted(LIME, escape(href), LIME, INK, escape(label));
    }

    /** A large one-time code, e.g. email verification. */
    public static String code(String value) {
        return ("<div style=\"margin:20px 0;padding:18px 0;border-radius:14px;background:%s;text-align:center;"
                + "font-family:'Courier New',monospace;font-size:32px;font-weight:bold;letter-spacing:10px;color:%s\">%s</div>")
                .formatted(INK, LIME, escape(value));
    }

    public static String wrap(String subject, String content) {
        if (content != null && content.contains("data-hustlespace-email")) return content;
        String body = content == null ? "" : content.replaceAll("(?is)<!doctype[^>]*>|</?(?:html|body)[^>]*>|<head>.*?</head>", "");
        // Plain links written by callers pick up the brand link colour; styled ones (buttons)
        // are left exactly as they are.
        body = body.replaceAll("(?i)<a(?![^>]*\\bstyle=)(\\s[^>]*)?>",
                "<a$1 style=\"color:" + VIOLET + ";font-weight:bold;text-decoration:underline\">");
        return """
          <!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"></head>
          <body style="margin:0;padding:0;background:%1$s;font-family:Arial,Helvetica,sans-serif;color:%2$s">
          <div data-hustlespace-email="true" style="display:none;max-height:0;overflow:hidden;opacity:0">%3$s</div>
          <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" style="background:%1$s"><tr><td align="center" style="padding:32px 12px">
            <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid %4$s;border-radius:22px;overflow:hidden">
              <tr><td style="background:%2$s;padding:22px 30px">
                <table role="presentation" cellspacing="0" cellpadding="0"><tr>
                  <td style="vertical-align:middle"><img src="%5$s" width="44" height="44" alt="HustleSpace" style="display:block;border:0;border-radius:11px"></td>
                  <td style="vertical-align:middle;padding-left:14px;font-size:22px;font-weight:bold;letter-spacing:-0.3px;color:#ffffff">Hustle<span style="color:%6$s">Space</span></td>
                </tr></table>
              </td></tr>
              <tr><td style="height:5px;line-height:5px;font-size:0;background:%6$s">&nbsp;</td></tr>
              <tr><td style="padding:34px 30px 30px;font-size:15px;line-height:1.7;color:%2$s">
                <h1 style="font-size:24px;line-height:1.25;margin:0 0 20px;color:%2$s">%3$s</h1>
                %7$s
              </td></tr>
              <tr><td style="padding:22px 30px;background:#FAFBF7;border-top:1px solid %4$s;font-size:12px;line-height:1.7;color:%8$s">
                This email relates to activity on your HustleSpace account. Never share your password or verification codes with anyone. If something looks unfamiliar, open the app directly and check your activity.
              </td></tr>
            </table>
            <p style="margin:18px 0 0;font-size:11px;line-height:1.6;color:%8$s">
              <a href="https://hustlespace.space" style="color:%9$s;font-weight:bold;text-decoration:none">hustlespace.space</a> &middot; Find work, sell and connect locally
            </p>
          </td></tr></table>
          </body></html>
          """.formatted(PAGE, INK, escape(subject), LINE, escape(logoUrl()), LIME, body, MUTED, VIOLET);
    }
}
