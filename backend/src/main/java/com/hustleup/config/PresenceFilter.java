package com.hustleup.config;

import com.hustleup.user.User;
import com.hustleup.user.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.LocalDateTime;

@Component
public class PresenceFilter extends OncePerRequestFilter {

    private final UserRepository userRepository;

    public PresenceFilter(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && !auth.getName().equals("anonymousUser")) {
            String email = auth.getName();
            try {
                userRepository.findByEmail(email).ifPresent(user -> {
                    if (user.getLastActive() == null || user.getLastActive().isBefore(LocalDateTime.now().minusMinutes(1))) {
                        user.setLastActive(LocalDateTime.now());
                        userRepository.save(user);
                    }
                });
            } catch (Exception e) {
                // Ignore DB failure
            }
        }
        
        filterChain.doFilter(request, response);
    }
}
