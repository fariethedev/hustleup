/**
 * JPA entity representing a single message within a booking-scoped chat thread.
 *
 * <p><strong>How does ChatMessage differ from DirectMessage?</strong>
 * <ul>
 *   <li>{@link DirectMessage} – free-form conversation between any two users
 *       (like a private inbox), delivered over HTTP REST.</li>
 *   <li>{@code ChatMessage} – conversation anchored to a specific booking
 *       (a shared workspace for client + freelancer), delivered in real-time
 *       over WebSocket/STOMP and also persisted here for history.</li>
 * </ul>
 *
 * <p><strong>Table mapping decision:</strong><br>
 * The table is named {@code chat_messages} and the primary key uses the native
 * {@code UUID} type (unlike {@code DirectMessage} which uses {@code String}).
 * Both approaches work; using {@code UUID} objects is slightly more type-safe
 * and integrates better with JPA's UUID comparison utilities.
 *
 * <p><strong>Why store messageType?</strong><br>
 * Although only {@code "TEXT"} is used today, reserving a {@code message_type}
 * column allows the schema to support richer message kinds (e.g. {@code "IMAGE"},
 * {@code "FILE"}, {@code "SYSTEM"}) in the future without a schema migration.
 *
 * <p><strong>Why no {@code @CreationTimestamp}?</strong><br>
 * Unlike {@code DirectMessage}, {@code createdAt} here is set with
 * {@code @Builder.Default} to {@code LocalDateTime.now()} at object construction
 * time.  This is a simpler approach that avoids the Hibernate-specific annotation
 * but means the timestamp is the Java application time rather than the DB server
 * time.  Both strategies are acceptable; consistency between the two models would
 * be a good future clean-up.
 */
package com.hustleup.messaging.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * {@code @Entity} registers this class with JPA/Hibernate so it is mapped to
 * a database table and its lifecycle (insert, update, delete) is managed
 * automatically when interacting via a {@link org.springframework.data.jpa.repository.JpaRepository}.
 */
@Entity

/**
 * {@code @Table(name = "chat_messages")} specifies the exact SQL table name.
 * Explicit naming prevents issues if Hibernate's default name-derivation
 * strategy differs from the actual migration-created table name.
 */
@Table(name = "chat_messages")

/** {@code @Getter} / {@code @Setter} generate individual get/set methods for every field. */
@Getter @Setter

/**
 * {@code @NoArgsConstructor} is required by JPA: Hibernate needs a public or
 * protected no-argument constructor to instantiate entity objects when
 * hydrating query results from the database.
 */
@NoArgsConstructor

/**
 * {@code @AllArgsConstructor} generates a constructor that accepts all fields.
 * Needed internally by the Lombok {@code @Builder} to construct fully
 * initialised objects.
 */
@AllArgsConstructor

/**
 * {@code @Builder} enables the fluent builder pattern so callers can write:
 * <pre>{@code
 *   ChatMessage msg = ChatMessage.builder()
 *       .bookingId(uuid)
 *       .senderId(userId)
 *       .content("Hello")
 *       .build();
 * }</pre>
 */
@Builder
public class ChatMessage {

    /**
     * Auto-generated UUID primary key for this chat message.
     *
     * <p>{@code @Id} declares this as the JPA primary key.
     *
     * <p>{@code @GeneratedValue(strategy = GenerationType.UUID)} instructs
     * Hibernate to generate a random UUID before the first INSERT, so the
     * application never needs to supply an ID manually.  This also means IDs
     * are globally unique, which is useful when messages from multiple services
     * or databases are aggregated.
     */
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /**
     * The UUID of the booking this message belongs to.
     *
     * <p>Every chat message is scoped to one booking; this column is the key
     * used to partition messages by conversation.  The repository method
     * {@code findByBookingIdOrderByCreatedAtAsc} uses this column heavily, so
     * a database index on {@code booking_id} would significantly improve query
     * performance in production.
     *
     * <p>{@code nullable = false} enforces at the DB level that an orphaned
     * message (one not attached to any booking) cannot exist.
     */
    @Column(name = "booking_id", nullable = false)
    private UUID bookingId;

    /**
     * The UUID of the user who authored this message.
     *
     * <p>As with {@link DirectMessage}, we store a raw ID rather than a
     * {@code @ManyToOne} relationship to the {@code User} entity, because
     * user data is owned by a different microservice.  The controller resolves
     * the sender's name by looking up this ID via {@code UserRepository}
     * before broadcasting the {@link com.hustleup.messaging.dto.ChatMessageDto}.
     *
     * <p>{@code nullable = false} ensures every message has an identifiable sender.
     */
    @Column(name = "sender_id", nullable = false)
    private UUID senderId;

    /**
     * The text (or other) content of the message.
     *
     * <p>{@code columnDefinition = "TEXT"} maps to the SQL {@code TEXT} type,
     * allowing message bodies of arbitrary length.  Using {@code VARCHAR(255)}
     * (the default) would silently truncate long messages.
     *
     * <p>{@code nullable = false} prevents blank messages from being saved;
     * input validation in the controller also enforces this at the application layer.
     */
    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    /**
     * Discriminator for the kind of message payload.
     *
     * <p>Currently always {@code "TEXT"}, but reserved for future message types
     * such as {@code "IMAGE"}, {@code "FILE"}, or {@code "SYSTEM"} (automated
     * booking status updates).
     *
     * <p>{@code @Builder.Default} tells Lombok's builder to use the given
     * expression ({@code "TEXT"}) as the default value when this field is not
     * explicitly set during construction.  Without this annotation, calling
     * {@code ChatMessage.builder().build()} would leave {@code messageType} as
     * {@code null}.
     */
    @Column(name = "message_type")
    @Builder.Default
    private String messageType = "TEXT";

    /**
     * Timestamp of when this message was created, set at construction time.
     *
     * <p>{@code @Builder.Default} initialises this field to {@code LocalDateTime.now()}
     * the moment the builder's {@code build()} method is called (i.e. application
     * time, not DB server time).
     *
     * <p>Note: unlike {@link DirectMessage} which uses {@code @CreationTimestamp}
     * (Hibernate sets it at INSERT time), this field is set in Java before the
     * entity reaches Hibernate.  The effective difference is negligible for
     * low-latency local DB calls, but could diverge on high-latency networks.
     */
    @Column(name = "created_at")
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
