package com.hustleup.common.notification;

import com.hustleup.common.model.Notification;
import com.hustleup.common.push.ExpoPushService;
import com.hustleup.common.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

/**
 * Sends every in-app notification to the recipient's phone as a push, the same way
 * {@link NotificationEmailRelay} sends it by email.
 *
 * <p>Centralising it here means a new notification type gets a push for free, and every push
 * carries {@code type} and {@code referenceId} so tapping it opens the right screen. Runs
 * after the creating transaction commits, so a rolled-back action never pushes, and is
 * best-effort: a push failure never affects whatever raised the notification.
 *
 * <p>Types can be muted with {@code app.notifications.push.exclude} (comma-separated).
 */
@Component
public class NotificationPushRelay {

    private static final Logger log = LoggerFactory.getLogger(NotificationPushRelay.class);

    private final ExpoPushService expoPushService;
    private final UserRepository userRepository;
    private final Set<String> excludedTypes;

    public NotificationPushRelay(ExpoPushService expoPushService,
                                 UserRepository userRepository,
                                 @Value("${app.notifications.push.exclude:}") String exclude) {
        this.expoPushService = expoPushService;
        this.userRepository = userRepository;
        this.excludedTypes = exclude == null || exclude.isBlank()
                ? Set.of()
                : new HashSet<>(Arrays.stream(exclude.split(","))
                        .map(String::trim).filter(s -> !s.isEmpty()).map(String::toUpperCase).toList());
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onNotificationCreated(NotificationCreatedEvent event) {
        Notification n = event.notification();
        try {
            if (n.getUserId() == null) return;
            String type = n.getNotificationType() == null ? "" : n.getNotificationType().toUpperCase();
            if (excludedTypes.contains(type)) return;

            userRepository.findById(n.getUserId()).ifPresent(user -> {
                if (user.getPushToken() == null || user.getPushToken().isBlank()) return;
                Map<String, String> data = new HashMap<>();
                data.put("type", type);
                if (n.getReferenceId() != null) data.put("referenceId", n.getReferenceId().toString());
                if (n.getId() != null) data.put("notificationId", n.getId().toString());
                String title = n.getTitle() == null || n.getTitle().isBlank() ? "HustleSpace" : n.getTitle();
                expoPushService.send(user.getPushToken(), title, n.getMessage() == null ? "" : n.getMessage(), data);
            });
        } catch (Exception e) {
            log.warn("Could not push notification {} to user {}: {}", n.getNotificationType(), n.getUserId(), e.getMessage());
        }
    }
}
