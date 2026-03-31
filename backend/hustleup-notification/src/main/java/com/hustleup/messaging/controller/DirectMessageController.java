package com.hustleup.messaging.controller;

import com.hustleup.messaging.model.DirectMessage;
import com.hustleup.messaging.repository.DirectMessageRepository;
import com.hustleup.common.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/direct-messages")
public class DirectMessageController {

    private final DirectMessageRepository dmRepo;
    private final UserRepository userRepo;

    public DirectMessageController(DirectMessageRepository dmRepo, UserRepository userRepository) {
        this.dmRepo = dmRepo;
        this.userRepo = userRepository;
    }

    private String getCurrentUserId() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepo.findByEmail(email).orElseThrow().getId().toString();
    }

    @GetMapping("/partners")
    public ResponseEntity<?> getChatPartners() {
        String currentUserId = getCurrentUserId();
        List<String> partnerIds = dmRepo.findDistinctChatPartners(currentUserId);
        List<Map<String, String>> partners = new ArrayList<>();
        
        for (String pid : partnerIds) {
            try {
                userRepo.findById(java.util.UUID.fromString(pid)).ifPresent(user -> {
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
                // Ignore invalid mock partner IDs from before wipe
            }
        }
        return ResponseEntity.ok(partners);
    }

    @GetMapping("/{partnerId}")
    public ResponseEntity<?> getConversation(@PathVariable String partnerId) {
        String currentUserId = getCurrentUserId();
        List<DirectMessage> messages = dmRepo.findConversation(currentUserId, partnerId);
        return ResponseEntity.ok(messages);
    }

    @PostMapping("/{partnerId}")
    public ResponseEntity<?> sendMessage(@PathVariable String partnerId, @RequestBody Map<String, String> payload) {
        String content = payload.get("content");
        if (content == null || content.trim().isEmpty()) return ResponseEntity.badRequest().build();
        
        String currentUserId = getCurrentUserId();
        
        DirectMessage msg = DirectMessage.builder()
                .senderId(currentUserId)
                .receiverId(partnerId)
                .content(content)
                .build();
                
        DirectMessage saved = dmRepo.save(msg);
        return ResponseEntity.ok(saved);
    }
}
