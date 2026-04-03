package com.hustleup.messaging.controller;

import com.hustleup.messaging.model.DirectMessage;
import com.hustleup.messaging.repository.DirectMessageRepository;
import com.hustleup.notification.model.Notification;
import com.hustleup.notification.repository.NotificationRepository;
import com.hustleup.common.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/direct-messages")
public class DirectMessageController {

    private final DirectMessageRepository dmRepo;
    private final UserRepository userRepo;
    private final NotificationRepository notificationRepo;

    public DirectMessageController(DirectMessageRepository dmRepo, UserRepository userRepository,
                                   NotificationRepository notificationRepo) {
        this.dmRepo = dmRepo;
        this.userRepo = userRepository;
        this.notificationRepo = notificationRepo;
    }

    private String getCurrentUserId() {
        org.springframework.security.core.Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) return null;
        String email = auth.getName();
        return userRepo.findByEmail(email)
                .map(u -> u.getId().toString())
                .orElse(null);
    }

    @GetMapping("/partners")
    public ResponseEntity<?> getChatPartners() {
        String currentUserId = getCurrentUserId();
        if (currentUserId == null) return ResponseEntity.status(401).build();
        
        List<String> partnerIds = dmRepo.findDistinctChatPartners(currentUserId);
        List<Map<String, String>> partners = new ArrayList<>();
        
        for (String pid : partnerIds) {
            try {
                userRepo.findById(UUID.fromString(pid)).ifPresent(user -> {
                    boolean isOnline = false;
                    if (user.getLastActive() != null) {
                        isOnline = user.getLastActive().isAfter(java.time.LocalDateTime.now().minusMinutes(5));
                    }
                    partners.add(Map.of(
                        "id", user.getId().toString(),
                        "name", user.getFullName(),
                        "verified", String.valueOf(user.isIdVerified()),
                        "online", String.valueOf(isOnline)
                    ));
                });
            } catch (IllegalArgumentException e) {
                // Ignore invalid UUIDs
            }
        }
        return ResponseEntity.ok(partners);
    }

    @GetMapping("/{partnerId}")
    public ResponseEntity<?> getConversation(@PathVariable String partnerId) {
        String currentUserId = getCurrentUserId();
        if (currentUserId == null) return ResponseEntity.status(401).build();
        
        List<DirectMessage> messages = dmRepo.findConversation(currentUserId, partnerId);
        return ResponseEntity.ok(messages);
    }

    @PostMapping("/{partnerId}")
    public ResponseEntity<?> sendMessage(@PathVariable String partnerId, @RequestBody Map<String, String> payload) {
        String content = payload.get("content");
        if (content == null || content.trim().isEmpty()) return ResponseEntity.badRequest().build();
        
        String currentUserId = getCurrentUserId();
        if (currentUserId == null) return ResponseEntity.status(401).build();
        
        DirectMessage msg = DirectMessage.builder()
                .senderId(currentUserId)
                .receiverId(partnerId)
                .content(content)
                .build();
                
        DirectMessage saved = dmRepo.save(msg);

        // Create notification for the recipient
        try {
            String senderName = userRepo.findById(UUID.fromString(currentUserId))
                    .map(u -> u.getFullName())
                    .orElse("Someone");
            String preview = content.length() > 60 ? content.substring(0, 60) + "…" : content;
            notificationRepo.save(Notification.builder()
                    .userId(UUID.fromString(partnerId))
                    .title("New message from " + senderName)
                    .message(preview)
                    .notificationType("DIRECT_MESSAGE")
                    .referenceId(UUID.fromString(currentUserId))
                    .build());
        } catch (Exception ignored) {}

        return ResponseEntity.ok(saved);
    }
}

