/**
 * Emails every in-app notification to the person it is for.
 *
 * <h2>Why this is a listener and not a call at each site</h2>
 * Notifications are raised from fourteen places across three services — bookings, listings,
 * shipments, payouts, direct messages, follows, posts, reposts, Bond matches and super likes.
 * Adding a send beside each one would work today and rot immediately: the fifteenth caller
 * would be written without it, silently, and nobody would notice a missing email. Hanging off
 * persistence means every notification is covered, including ones not written yet.
 *
 * <h2>Why after commit, and not inside the transaction</h2>
 * {@code @PostPersist} fires while the surrounding transaction is still open. Sending there
 * would hold a database transaction open across a network call to SES, and — worse — a
 * transaction that later rolled back would leave the recipient holding an email about
 * something that never happened. The entity callback therefore does nothing but publish a
 * cheap in-process event, and the send waits for {@code AFTER_COMMIT}: no email is ever sent
 * for a notification that did not survive.
 *
 * <h2>Failure is contained</h2>
 * A send that throws must not fail the request that triggered it — nobody should be unable to
 * follow someone because SES is down. {@code EmailService} already swallows its own failures,
 * and everything else here is wrapped for the same reason.
 */
package com.hustleup.common.notification;

import com.hustleup.common.email.EmailService;
import com.hustleup.common.model.Notification;
import com.hustleup.common.model.User;
import com.hustleup.common.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

@Component
public class NotificationEmailRelay {

    private static final Logger log = LoggerFactory.getLogger(NotificationEmailRelay.class);

    private final EmailService emailService;
    private final UserRepository userRepository;

    /**
     * Notification types that stay in-app only.
     *
     * <p>Empty by default: every notification is emailed, which is what was asked for. It is a
     * property rather than a hardcoded list because the judgement is about volume, not
     * correctness — if DIRECT_MESSAGE turns out to mean an email per chat line, that wants
     * changing in the environment, not in a release.
     */
    private final Set<String> excludedTypes;

    public NotificationEmailRelay(EmailService emailService,
                                  UserRepository userRepository,
                                  @Value("${app.notifications.email.exclude:}") String exclude) {
        this.emailService = emailService;
        this.userRepository = userRepository;
        this.excludedTypes = exclude == null || exclude.isBlank()
                ? Set.of()
                : new HashSet<>(Arrays.stream(exclude.split(","))
                        .map(String::trim)
                        .filter(s -> !s.isEmpty())
                        .map(String::toUpperCase)
                        .toList());
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onNotificationCreated(NotificationCreatedEvent event) {
        Notification n = event.notification();
        try {
            if (n.getUserId() == null) return;
            if (n.getNotificationType() != null
                    && excludedTypes.contains(n.getNotificationType().toUpperCase())) {
                return;
            }

            User user = userRepository.findById(n.getUserId()).orElse(null);
            if (user == null || user.getEmail() == null || user.getEmail().isBlank()) return;

            String subject = n.getTitle() != null && !n.getTitle().isBlank()
                    ? n.getTitle() : "New activity on HustleSpace";
            emailService.send(user.getEmail(), subject, body(n));
        } catch (Exception e) {
            // Never let a notification email break whatever raised the notification.
            log.warn("Could not email notification {} to user {}: {}",
                    n.getNotificationType(), n.getUserId(), e.getMessage());
        }
    }

    /**
     * The message as HTML.
     *
     * <p>Deliberately plain. The notification already carries the words the app shows on the
     * bell, and rewriting them per type here would give the same event two different wordings
     * that drift apart.
     */
    private String body(Notification n) {
        String title = escape(n.getTitle() == null ? "" : n.getTitle());
        String message = escape(n.getMessage() == null ? "" : n.getMessage());
        return """
                <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:520px">
                  <h2 style="margin:0 0 8px;font-size:18px;color:#111">%s</h2>
                  <p style="margin:0 0 16px;font-size:15px;line-height:1.5;color:#333">%s</p>
                  <p style="margin:0;font-size:13px;color:#888">
                    You're receiving this because of activity on your HustleSpace account.
                  </p>
                </div>
                """.formatted(title, message);
    }

    /** Notification text can contain a listing title someone else typed, so it is escaped. */
    private static String escape(String s) {
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }
}
