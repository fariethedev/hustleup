/**
 * Spring Data JPA repository for {@link ChatMessage} entities.
 *
 * <p><strong>Purpose:</strong><br>
 * Provides database access for booking-scoped chat messages.  Every STOMP
 * message handled by {@link com.hustleup.messaging.controller.ChatController}
 * is persisted through this repository so the conversation history survives
 * WebSocket disconnects, page refreshes, and server restarts.
 *
 * <p><strong>Why extend JpaRepository?</strong><br>
 * {@code JpaRepository<ChatMessage, UUID>} is a Spring Data interface that
 * provides ready-made CRUD operations at no cost:
 * <ul>
 *   <li>{@code save(entity)} – INSERT or UPDATE</li>
 *   <li>{@code findById(id)} – SELECT by primary key</li>
 *   <li>{@code findAll()} – SELECT all rows</li>
 *   <li>{@code delete(entity)} – DELETE</li>
 *   <li>... and many more</li>
 * </ul>
 * Spring generates a concrete implementation class at runtime via dynamic proxies,
 * so no implementation class is needed.
 *
 * <p><strong>Generic parameters:</strong>
 * <ul>
 *   <li>{@code ChatMessage} – the entity this repository manages.</li>
 *   <li>{@code UUID} – the type of the entity's {@code @Id} field.</li>
 * </ul>
 *
 * <p><strong>Note – missing {@code @Repository}:</strong><br>
 * Unlike {@link DirectMessageRepository}, this interface does not have
 * {@code @Repository}.  This is valid: Spring Data automatically detects and
 * registers repository interfaces during the component scan triggered by
 * {@code @EnableJpaRepositories}.  The annotation is optional but recommended
 * for clarity and consistent exception translation.
 */
package com.hustleup.messaging.repository;

import com.hustleup.messaging.model.ChatMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, UUID> {

    /**
     * Retrieves all chat messages for a specific booking, sorted oldest-first.
     *
     * <p><strong>How Spring Data derives this query:</strong><br>
     * Spring Data JPA parses the method name using a keyword grammar:
     * <pre>
     *   find   By   BookingId   OrderBy   CreatedAt   Asc
     *   ────   ──   ─────────   ───────   ─────────   ───
     *   verb   sep  filter col  sort kw   sort col    dir
     * </pre>
     * This translates to the JPQL:
     * <pre>{@code
     *   SELECT m FROM ChatMessage m
     *   WHERE m.bookingId = :bookingId
     *   ORDER BY m.createdAt ASC
     * }</pre>
     * No {@code @Query} annotation is required – Spring generates the query
     * automatically at startup.  If the method name is misspelled or references
     * a non-existent field, Spring will throw an exception at boot time (not at
     * runtime), which is a helpful early-warning mechanism.
     *
     * <p><strong>Why ASC ordering?</strong><br>
     * Ascending {@code createdAt} order returns the oldest message first and the
     * newest last, matching the natural top-to-bottom reading direction of a chat
     * interface.  The {@link com.hustleup.messaging.controller.ChatController#getHistory}
     * endpoint uses this method to pre-populate the chat panel when it is first opened.
     *
     * <p><strong>Performance note:</strong><br>
     * In production, the {@code booking_id} column should have a database index.
     * Without one, this query performs a full table scan on {@code chat_messages},
     * which becomes slow as the table grows.
     *
     * @param bookingId the UUID of the booking whose messages to retrieve.
     * @return an ordered list of {@link ChatMessage} entities, oldest first;
     *         returns an empty list (not {@code null}) if no messages exist yet.
     */
    List<ChatMessage> findByBookingIdOrderByCreatedAtAsc(UUID bookingId);
}
