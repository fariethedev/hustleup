package com.hustleup.common.email;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
class EmailLayoutTest {
    @Test void wrapsOnceAndEscapesUserControlledSubject() {
        String html=EmailLayout.wrap("<img src=x onerror=evil()>","<p>Account details</p>");
        assertFalse(html.contains("<img")); assertTrue(html.contains("&lt;img"));
        assertTrue(html.contains("<p>Account details</p>"));
        assertEquals(html,EmailLayout.wrap("Second subject",html));
    }
}
