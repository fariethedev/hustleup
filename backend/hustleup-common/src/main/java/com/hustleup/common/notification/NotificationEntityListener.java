/**
 * Turns persisting a {@link Notification} into an application event.
 *
 * <h2>Why a static publisher</h2>
 * JPA instantiates entity listeners itself, outside the Spring context, so constructor
 * injection is not available here. Holding the publisher statically — set once at startup by
 * Spring through {@link org.springframework.context.ApplicationEventPublisherAware} — is the
 * standard way to bridge the two, and is safe because the field is written once during
 * refresh and only read afterwards.
 *
 * <p>The callback does nothing but publish. Every reason for that is in
 * {@link NotificationEmailRelay}: doing real work here would run it inside the caller's
 * transaction, and would send mail for notifications that later rolled back.
 */
package com.hustleup.common.notification;

import com.hustleup.common.model.Notification;
import jakarta.persistence.PostPersist;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.ApplicationEventPublisherAware;
import org.springframework.stereotype.Component;

@Component
public class NotificationEntityListener implements ApplicationEventPublisherAware {

    private static ApplicationEventPublisher publisher;

    @Override
    public void setApplicationEventPublisher(ApplicationEventPublisher applicationEventPublisher) {
        NotificationEntityListener.publisher = applicationEventPublisher;
    }

    @PostPersist
    public void onPostPersist(Notification notification) {
        // Null before the context finishes starting, and in tests that touch JPA without
        // Spring. Nothing to do then — a missing email is not worth a failed insert.
        if (publisher != null) {
            publisher.publishEvent(new NotificationCreatedEvent(notification));
        }
    }
}
