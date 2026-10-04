package com.hustleup.social.privacy;

import com.hustleup.common.security.AccountPrivacy;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.util.List;

@Component @RequiredArgsConstructor
public class SocialPrivacyGuard {
    private final JdbcTemplate jdbc;
    private final AccountPrivacy privacy;
    public boolean post(String id) {
        String current = id;
        for (int depth = 0; depth < 16; depth++) {
            var rows = jdbc.queryForList("SELECT author_id,repost_of_id FROM posts WHERE id::text=?", current);
            if (rows.isEmpty()) return false;
            var row = rows.getFirst();
            if (!privacy.canView(String.valueOf(row.get("author_id")))) return false;
            Object parent = row.get("repost_of_id");
            if (parent == null) return true;
            current = parent.toString();
        }
        return false;
    }
    public boolean story(String id) {
        List<String> authors = jdbc.query("SELECT author_id FROM stories WHERE id::text=?", (r, n) -> r.getString(1), id);
        return !authors.isEmpty() && privacy.canView(authors.getFirst());
    }
    public void requirePost(String id) { if (!post(id)) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Post unavailable"); }
    public void requireStory(String id) { if (!story(id)) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Story unavailable"); }
    public void requireComment(String id) {
        var ids = jdbc.query("SELECT post_id FROM comments WHERE id::text=?", (r, n) -> r.getString(1), id);
        if (ids.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        requirePost(ids.getFirst());
    }
}
