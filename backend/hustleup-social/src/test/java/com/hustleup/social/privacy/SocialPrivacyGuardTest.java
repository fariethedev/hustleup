package com.hustleup.social.privacy;
import com.hustleup.common.security.AccountPrivacy;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.server.ResponseStatusException;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;
class SocialPrivacyGuardTest {
    @Test void repostCannotExposePrivateOriginal() {
        JdbcTemplate jdbc=mock(JdbcTemplate.class); AccountPrivacy privacy=mock(AccountPrivacy.class);
        String query="SELECT author_id,repost_of_id FROM posts WHERE id::text=?";
        when(jdbc.queryForList(query,"repost")).thenReturn(List.of(Map.of("author_id","public", "repost_of_id","original")));
        when(jdbc.queryForList(query,"original")).thenReturn(List.of(Map.of("author_id","private")));
        when(privacy.canView("public")).thenReturn(true);
        when(privacy.canView("private")).thenReturn(false);
        SocialPrivacyGuard guard=new SocialPrivacyGuard(jdbc,privacy);
        assertFalse(guard.post("repost"));
        assertThrows(ResponseStatusException.class, () -> guard.requirePost("original"));
        when(privacy.canView("private")).thenReturn(true);
        assertTrue(guard.post("repost"));
    }
    @Test void missingPostIsNotPublic() {
        var guard=new SocialPrivacyGuard(mock(JdbcTemplate.class),mock(AccountPrivacy.class));
        assertFalse(guard.post("missing"));
    }
}
