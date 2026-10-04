package com.hustleup.common.security;
import com.hustleup.common.model.User;
import com.hustleup.common.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import java.util.UUID;

@Service @RequiredArgsConstructor
public class AccountPrivacy {
    private final UserRepository users;
    private final JdbcTemplate jdbc;
    public UUID viewer() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return auth == null ? null : users.findByEmail(auth.getName()).map(User::getId).orElse(null);
    }
    public boolean canView(String owner) {
        try { return canView(UUID.fromString(owner)); } catch (IllegalArgumentException invalid) { return false; }
    }
    public boolean canView(UUID owner) {
        var user = users.findById(owner).orElse(null);
        if (user == null) return false;
        if (!user.isPrivateAccount()) return true;
        UUID viewer = viewer();
        if (owner.equals(viewer)) return true;
        return viewer != null && Boolean.TRUE.equals(jdbc.queryForObject(
                "SELECT EXISTS(SELECT 1 FROM follows WHERE follower_id=? AND following_id=?)", Boolean.class, viewer, owner));
    }
}
