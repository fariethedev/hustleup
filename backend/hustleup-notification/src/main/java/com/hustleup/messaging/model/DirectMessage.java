/**
 * JPA entity representing a single direct message exchanged between two users.
 *
 * <p><strong>Why JPA / Hibernate?</strong><br>
 * JPA (Java Persistence API) is the standard Java specification for mapping
 * Java objects to relational database tables.  Hibernate is the most popular
 * implementation.  Instead of writing raw SQL INSERT/SELECT statements, we
 * annotate a plain Java class and let Hibernate generate the SQL.  This
 * reduces boilerplate, eliminates most SQL injection risks, and makes the data
 * model self-documenting.
 *
 * <p><strong>Table mapping decision:</strong><br>
 * The table is named {@code direct_messages} (plural, snake_case) following the
 * HustleUp database naming convention.  We store only the UUIDs of sender and
 * receiver (as plain {@code String}s), not JPA {@code @ManyToOne} foreign-key
 * associations, because this service does not own the {@code users} table –
 * it belongs to a separate microservice.  Storing raw IDs avoids cross-service
 * JOIN complexity while still allowing the controller to look up user details
 * via the shared {@code UserRepository}.
 *
 * <p><strong>Why no {@code read} flag here?</strong><br>
 * The current design tracks "unread" state via separate in-app {@code Notification}
 * records rather than a flag on each message.  Future iterations may add a
 * {@code readAt} column here for fine-grained per-message read receipts.
 */
package com.hustleup.messaging.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * {@code @Entity} tells JPA that this class maps to a database table.
 * Hibernate will manage the lifecycle of instances of this class
 * (INSERT on {@code save()}, SELECT on {@code findById()}, etc.).
 */
@Entity

/**
 * {@code @Table(name = "direct_messages")} explicitly names the database table.
 * Without this annotation, Hibernate would default to deriving the table name
 * from the class name (e.g. "direct_message"), which may differ from the
 * actual table name and cause startup errors.
 */
@Table(name = "direct_messages")

/**
 * {@code @Data} is a Lombok meta-annotation that generates:
 * <ul>
 *   <li>Getters for all fields</li>
 *   <li>Setters for all non-final fields</li>
 *   <li>{@code toString()}, {@code equals()}, and {@code hashCode()} based on all fields</li>
 * </ul>
 * This eliminates hundreds of lines of boilerplate while keeping the source
 * file focused on the data model.
 */
@Data

/**
 * {@code @NoArgsConstructor} generates a public no-argument constructor.
 * JPA mandates a no-arg constructor so Hibernate can instantiate the entity
 * via reflection when loading rows from the database.
 */
@NoArgsConstructor

/**
 * {@code @AllArgsConstructor} generates a constructor with one parameter per
 * field.  Required by Lombok's {@code @Builder} pattern (the builder delegates
 * to this constructor internally).
 */
@AllArgsConstructor

/**
 * {@code @Builder} generates a static inner {@code Builder} class that provides
 * a fluent API for constructing instances:
 * <pre>{@code
 *   DirectMessage msg = DirectMessage.builder()
 *       .senderId("abc")
 *       .receiverId("xyz")
 *       .content("Hello!")
 *       .build();
 * }</pre>
 * This is more readable than calling a constructor with positional arguments
 * and avoids accidentally swapping {@code senderId} and {@code receiverId}.
 */
@Builder
public class DirectMessage {

    /**
     * Unique identifier for this message, stored as a String.
     *
     * <p>{@code @Id} marks this field as the JPA primary key.
     *
     * <p>{@code @GeneratedValue(strategy = GenerationType.UUID)} tells Hibernate
     * to auto-generate a UUID value before inserting a new row.  Using UUIDs
     * instead of auto-incrementing longs has two advantages here:
     * <ul>
     *   <li>UUIDs can be generated client-side or in application code without
     *       a database round-trip.</li>
     *   <li>UUIDs are non-sequential, making it harder to enumerate records by
     *       guessing the next ID.</li>
     * </ul>
     *
     * <p>Note: The ID is typed as {@code String} (not {@code UUID}) to match
     * the column type used in the existing schema migration.  {@code ChatMessage}
     * uses {@code UUID} for the same purpose – the inconsistency is a known
     * technical debt item.
     */
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    /**
     * UUID (as String) of the user who sent this message.
     *
     * <p>{@code @Column(name = "sender_id", nullable = false)} maps this field
     * to the {@code sender_id} column and adds a NOT NULL constraint so the
     * database rejects any insert without a sender.
     *
     * <p>We store the raw UUID string rather than a {@code @ManyToOne User}
     * reference because the {@code users} table is owned by a different
     * microservice.  A foreign-key annotation would require Hibernate to join
     * across service boundaries, which is architecturally incorrect.
     */
    @Column(name = "sender_id", nullable = false)
    private String senderId;

    /**
     * UUID (as String) of the user who should receive this message.
     *
     * <p>Same design rationale as {@code senderId} – stored as a raw string
     * to avoid cross-service JPA references.
     *
     * <p>{@code nullable = false} enforces that every DM has an intended
     * recipient; broadcast messages are handled via the booking chat
     * ({@link ChatMessage}) instead.
     */
    @Column(name = "receiver_id", nullable = false)
    private String receiverId;

    /**
     * The text body of the direct message.
     *
     * <p>{@code columnDefinition = "TEXT"} instructs Hibernate to use the SQL
     * {@code TEXT} type for this column rather than the default {@code VARCHAR(255)}.
     * {@code TEXT} supports up to 65,535 bytes in MySQL / unlimited in PostgreSQL,
     * which accommodates long messages without truncation.
     *
     * <p>{@code nullable = false} prevents empty-content messages from reaching
     * the database (the controller also validates this before calling save()).
     */
    @Column(columnDefinition = "TEXT", nullable = false)
    private String content;

    /**
     * The UTC timestamp of when this message was persisted.
     *
     * <p>{@code @CreationTimestamp} is a Hibernate-specific annotation that
     * automatically sets this field to the current date/time when the entity is
     * first inserted.  The application code never needs to set it manually.
     *
     * <p>{@code updatable = false} prevents Hibernate from ever changing the
     * {@code created_at} column in subsequent UPDATE statements, preserving the
     * original creation time even if other fields are modified.
     */
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
