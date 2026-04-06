package com.hustleup.common.repository;

import com.hustleup.common.model.Notification;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

/**
 * Spring Data JPA repository for {@link Notification} entities.
 *
 * <p><b>Responsibility:</b><br>
 * Provides database access for the {@code notifications} table. Beyond the standard
 * CRUD operations inherited from {@link JpaRepository}, this interface declares two
 * custom query methods that support the notification bell and notification centre
 * features of the HustleUp frontend.
 *
 * <p><b>Generic parameters:</b><br>
 * {@code JpaRepository<Notification, UUID>} — manages {@link Notification} entities
 * whose primary key is a {@link UUID}.
 *
 * <p><b>Architecture note:</b><br>
 * Defined in {@code hustleup-common} so any microservice that needs to create or query
 * notifications can depend on this shared repository without copy-pasting code.
 */
public interface NotificationRepository extends JpaRepository<Notification, UUID> {

    /**
     * Retrieves all notifications for a specific user, sorted from newest to oldest.
     *
     * <p><b>What it returns:</b><br>
     * A complete list of every {@link Notification} row where {@code user_id} matches the
     * supplied {@code userId}, ordered by {@code created_at DESC} so the most recent
     * notifications appear at the top of the list in the UI.
     *
     * <p><b>Why it's needed:</b><br>
     * The notification centre screen fetches this list when the user opens their inbox.
     * Ordering is done in the database (not in Java) for efficiency — the DB can use an
     * index on {@code (user_id, created_at)} to avoid a full table scan.
     *
     * <p><b>Derived query translation:</b><br>
     * {@code findByUserIdOrderByCreatedAtDesc} →
     * {@code SELECT n FROM Notification n WHERE n.userId = :userId ORDER BY n.createdAt DESC}
     *
     * <p><b>Note on large lists:</b><br>
     * This method returns an unbounded {@link List}. For users with many notifications,
     * consider adding a {@code Pageable} parameter in the future to avoid loading
     * thousands of rows into memory at once.
     *
     * @param userId the UUID of the user whose notifications are requested
     * @return all notifications for that user, newest first; empty list if none exist
     */
    List<Notification> findByUserIdOrderByCreatedAtDesc(UUID userId);

    /**
     * Counts how many unread notifications a user currently has.
     *
     * <p><b>What it returns:</b><br>
     * A {@code long} count of rows where {@code user_id = :userId} AND
     * {@code is_read = false}.
     *
     * <p><b>Why it's needed:</b><br>
     * The notification bell icon in the app header shows a badge with the unread count
     * (e.g. "🔔 3"). This method provides that number cheaply with a single
     * {@code COUNT} query — far more efficient than loading the full notification list
     * just to call {@code .stream().filter(!read).count()}.
     *
     * <p><b>Derived query translation:</b><br>
     * {@code countByUserIdAndReadFalse} →
     * {@code SELECT COUNT(n) FROM Notification n WHERE n.userId = :userId AND n.read = false}
     *
     * @param userId the UUID of the user to count unread notifications for
     * @return the number of unread notifications; 0 if all have been read
     */
    long countByUserIdAndReadFalse(UUID userId);
}
