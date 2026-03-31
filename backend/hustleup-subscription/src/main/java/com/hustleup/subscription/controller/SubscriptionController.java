package com.hustleup.subscription.controller;

import com.hustleup.subscription.model.Subscription;
import com.hustleup.subscription.repository.SubscriptionRepository;
import com.hustleup.common.model.User;
import com.hustleup.common.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/subscriptions")
public class SubscriptionController {

    private final SubscriptionRepository subscriptionRepository;
    private final UserRepository userRepository;

    public SubscriptionController(SubscriptionRepository subscriptionRepository, UserRepository userRepository) {
        this.subscriptionRepository = subscriptionRepository;
        this.userRepository = userRepository;
    }

    @GetMapping("/my")
    @PreAuthorize("hasRole('SELLER')")
    public ResponseEntity<?> getMySubscription() {
        User user = getCurrentUser();
        return subscriptionRepository.findBySellerId(user.getId())
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElse(ResponseEntity.ok(Map.of("plan", "FREE")));
    }

    @PostMapping("/upgrade")
    @PreAuthorize("hasRole('SELLER')")
    public ResponseEntity<?> upgrade() {
        User user = getCurrentUser();
        Subscription sub = subscriptionRepository.findBySellerId(user.getId())
                .orElse(Subscription.builder().sellerId(user.getId()).build());

        sub.setPlan("VERIFIED");
        sub.setStatus("ACTIVE");
        sub.setStartedAt(LocalDateTime.now());
        sub.setExpiresAt(LocalDateTime.now().plusMonths(1));

        subscriptionRepository.save(sub);
        return ResponseEntity.ok(Map.of("success", true, "plan", "VERIFIED", "expiresAt", sub.getExpiresAt()));
    }

    private User getCurrentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }
}
