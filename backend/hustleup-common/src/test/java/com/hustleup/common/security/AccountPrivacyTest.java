package com.hustleup.common.security;
import com.hustleup.common.model.User;
import com.hustleup.common.repository.UserRepository;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;
class AccountPrivacyTest {
    @AfterEach void clear() { SecurityContextHolder.clearContext(); }
    @Test void privateContentRequiresOwnerOrAcceptedFollower() {
        var users=mock(UserRepository.class); var jdbc=mock(JdbcTemplate.class);
        UUID owner=UUID.randomUUID(), viewer=UUID.randomUUID();
        User privateUser=User.builder().id(owner).privateAccount(true).build();
        when(users.findById(owner)).thenReturn(Optional.of(privateUser));
        var privacy=new AccountPrivacy(users,jdbc);
        assertFalse(privacy.canView(owner));
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("viewer", ""));
        when(users.findByEmail("viewer")).thenReturn(Optional.of(User.builder().id(viewer).build()));
        String query="SELECT EXISTS(SELECT 1 FROM follows WHERE follower_id=? AND following_id=?)";
        when(jdbc.queryForObject(query,Boolean.class,viewer,owner)).thenReturn(false,true);
        assertFalse(privacy.canView(owner)); assertTrue(privacy.canView(owner));
        when(users.findByEmail("viewer")).thenReturn(Optional.of(privateUser));
        assertTrue(privacy.canView(owner));
        privateUser.setPrivateAccount(false); SecurityContextHolder.clearContext();
        assertTrue(privacy.canView(owner));
    }
}
