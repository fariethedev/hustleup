/**
 * Raised when a {@link Notification} row has been persisted.
 *
 * <p>Published from the entity's {@code @PostPersist} callback and consumed after the
 * transaction commits — see {@link NotificationEmailRelay} for why the send cannot happen in
 * the callback itself.
 */
package com.hustleup.common.notification;

import com.hustleup.common.model.Notification;

public record NotificationCreatedEvent(Notification notification) {}
