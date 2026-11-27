package com.hustleup.common.email;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
class EmailLayoutTest {
    @Test void wrapsOnceAndEscapesUserControlledSubject() {
        String html=EmailLayout.wrap("<img src=x onerror=evil()>","<p>Account details</p>");
        assertFalse(html.contains("<img src=x")); assertTrue(html.contains("&lt;img src=x"));
        assertTrue(html.contains("<p>Account details</p>"));
        assertEquals(html,EmailLayout.wrap("Second subject",html));
    }

    @Test void carriesTheBrandLogoAndColours() {
        String html=EmailLayout.wrap("Hello","<p>Body</p>");
        assertTrue(html.contains("<img src=\"https://hustlespace.space/hustlespace-logo.png\""));
        assertTrue(html.contains(EmailLayout.LIME));
    }

    @Test void stylesPlainLinksButLeavesStyledOnesAlone() {
        String html=EmailLayout.wrap("S","<a href=\"https://a\">plain</a> "+EmailLayout.button("https://b","Go"));
        assertTrue(html.contains("<a href=\"https://a\" style=\"color:"+EmailLayout.VIOLET));
        assertEquals(1, html.split("href=\"https://b\"",-1).length-1);
        assertFalse(html.contains("href=\"https://b\" style=\"color:"+EmailLayout.VIOLET));
    }

    @Test void escapesButtonAndCodeInput() {
        String b=EmailLayout.button("https://x?a=1&b=\"2\"","<b>Go</b>");
        assertTrue(b.contains("href=\"https://x?a=1&amp;b=&quot;2&quot;\""));
        assertTrue(b.contains("&lt;b&gt;Go&lt;/b&gt;"));
        assertTrue(EmailLayout.code("<123>").contains("&lt;123&gt;"));
    }
}
