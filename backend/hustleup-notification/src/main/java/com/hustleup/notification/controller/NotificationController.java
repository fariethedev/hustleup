package com.hustleup.notification.controller;

import com.hustleup.notification.model.Notification;
import com.hustleup.notification.repository.NotificationRepository;
import com.hustleup.common.model.User;
import com.hustleup.common.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/notifications")
public class NotificationController {

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;

    public NotificationController(NotificationRepository notificationRepository, UserRepository userRepository) {
        this.notificationRepository = notificationRepository;
        this.userRepository = userRepository;
    }

    @GetMapping
    public ResponseEntity<?> getMyNotifications() {
        return getCurrentUser()
                .map(user -> ResponseEntity.ok((Object) notificationRepository.findByUserIdOrderByCreatedAtDesc(user.getId())))
                .orElse(ResponseEntity.ok(List.of()));
    }

    @GetMapping("/unread-count")
    public ResponseEntity<Map<String, Long>> getUnreadCount() {
        return getCurrentUser()
                .map(user -> ResponseEntity.ok(Map.of("count", notificationRepository.countByUserIdAndReadFalse(user.getId()))))
                .orElse(ResponseEntity.ok(Map.of("count", 0L)));
    }

    @PatchMapping("/{id}/read")
    public ResponseEntity<?> markRead(@PathVariable UUID id) {
        return getCurrentUser()
                .map(user -> {
                    Notification notification = notificationRepository.findById(id)
                            .orElseThrow(() -> new RuntimeException("Notification not found"));
                    if (!notification.getUserId().equals(user.getId())) {
                        throw new RuntimeException("Not authorized to update this notification");
                    }
                    notification.setRead(true);
                    notificationRepository.save(notification);
                    return ResponseEntity.ok(Map.of("success", true));
                })
                .orElse(ResponseEntity.status(401).build());
    }

    private java.util.Optional<User> getCurrentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        if (email == null || email.equals("anonymousUser")) {
            return java.util.Optional.empty();
        }
        return userRepository.findByEmail(email);
    }
}
