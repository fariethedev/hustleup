package com.hustleup.common.email;

public final class EmailLayout {
    private EmailLayout() {}
    public static String escape(String text) {
        return text == null ? "" : text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;").replace("'", "&#39;");
    }
    public static String wrap(String subject, String content) {
        if (content != null && content.contains("data-hustlespace-email")) return content;
        String body = content == null ? "" : content.replaceAll("(?is)<!doctype[^>]*>|</?(?:html|body)[^>]*>|<head>.*?</head>", "");
        return """
          <!doctype html><html><body style="margin:0;background:#f3f4f1;font-family:Arial,Helvetica,sans-serif;color:#20221e">
          <div data-hustlespace-email="true" style="display:none;max-height:0;overflow:hidden">%s</div>
          <table role="presentation" width="100%%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:28px 12px">
          <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e0e3da;border-radius:20px;overflow:hidden">
          <tr><td style="padding:28px 30px;background:#11150d;color:#cdff00;font-size:24px;font-weight:bold">HustleSpace<span style="display:block;font-size:11px;font-weight:normal;color:#c7cebc;margin-top:8px;letter-spacing:2px">YOUR ACCOUNT UPDATE</span></td></tr>
          <tr><td style="padding:30px;font-size:15px;line-height:1.7"><h1 style="font-size:25px;line-height:1.25;margin:0 0 22px;color:#171a14">%s</h1>%s</td></tr>
          <tr><td style="padding:22px 30px;border-top:1px solid #e8ebe2;font-size:12px;line-height:1.7;color:#626859">This email relates to activity on your HustleSpace account. Never share your password or verification codes with another user. If something looks unfamiliar, open your account directly and check your activity.</td></tr>
          </table><p style="font-size:11px;color:#74796e;max-width:520px;line-height:1.6">HustleSpace · Account and marketplace updates</p>
          </td></tr></table></body></html>
          """.formatted(escape(subject), escape(subject), body);
    }
}
