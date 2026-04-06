/**
 * Data Transfer Object (DTO) for chat messages exchanged over WebSocket and HTTP.
 *
 * <p><strong>What is a DTO and why do we need one?</strong><br>
 * A DTO (Data Transfer Object) is a plain Java object whose sole purpose is to
 * carry data between layers – in this case, between the server and the front-end
 * (or the WebSocket client).
 *
 * <p>We could technically send the raw {@link com.hustleup.messaging.model.ChatMessage}
 * entity directly over the wire, but that has several drawbacks:
 * <ul>
 *   <li><strong>Over-exposure:</strong> JPA entities may include internal fields
 *       (lazy-loaded proxies, version columns) that are irrelevant or sensitive
 *       to the client.</li>
 *   <li><strong>Serialisation issues:</strong> Hibernate proxy objects and
 *       bidirectional relationships can cause infinite recursion in Jackson's
 *       JSON serialiser.</li>
 *   <li><strong>Extra data:</strong> The client needs the sender's <em>name</em>
 *       ({@code senderName}), but the entity only stores a {@code senderId}.
 *       The DTO lets us attach that enrichment without polluting the entity.</li>
 * </ul>
 * Using a DTO separates the persistence model from the API contract, making it
 * safe to change either without breaking the other.
 *
 * <p><strong>Flow:</strong>
 * <ol>
 *   <li>Inbound (client → server): The STOMP client sends a JSON payload that
 *       Spring deserialises into a {@code ChatMessageDto}.</li>
 *   <li>Outbound (server → client): After persisting a {@link com.hustleup.messaging.model.ChatMessage},
 *       the controller converts it back to a {@code ChatMessageDto} (enriched
 *       with the sender's name) and broadcasts it via WebSocket.</li>
 *   <li>REST history: The HTTP history endpoint also maps entities to
 *       {@code ChatMessageDto} instances before serialising the response.</li>
 * </ol>
 */
package com.hustleup.messaging.dto;

import com.hustleup.messaging.model.ChatMessage;
import lombok.*;
import java.time.LocalDateTime;
import java.util.UUID;

/** {@code @Getter} / {@code @Setter} generate standard accessor methods for all fields. */
@Getter @Setter

/**
 * {@code @NoArgsConstructor} generates a no-argument constructor.
 * Jackson (the JSON library Spring uses) requires a no-arg constructor to
 * deserialise JSON into a Java object via reflection.
 */
@NoArgsConstructor

/**
 * {@code @AllArgsConstructor} generates a constructor that accepts all fields.
 * Used internally by the Lombok {@code @Builder}.
 */
@AllArgsConstructor

/**
 * {@code @Builder} provides a fluent construction API.  This is used extensively
 * in {@link #fromEntity(ChatMessage)} to build instances in a readable way.
 */
@Builder
public class ChatMessageDto {

    /**
     * The server-assigned UUID of the persisted {@link ChatMessage}.
     * {@code null} on inbound messages (the client does not know the ID before
     * the server saves it); always populated on outbound messages after
     * {@link #fromEntity(ChatMessage)} is called.
     */
    private UUID id;

    /**
     * UUID of the booking this message belongs to.
     * Provided by the client on inbound messages so the server knows which
     * booking conversation to attach the message to.
     */
    private UUID bookingId;

    /**
     * UUID of the user who sent the message.
     * On inbound messages this is supplied by the client.  Future hardening:
     * this should be overridden server-side from the authenticated JWT principal
     * to prevent a client from impersonating another user.
     */
    private UUID senderId;

    /**
     * Human-readable display name of the sender (e.g. "Alice Johnson").
     * This field does NOT exist on the {@link ChatMessage} entity; it is added
     * by the controller by performing a {@code UserRepository.findById(senderId)}
     * lookup before broadcasting.  Providing it here saves the front-end from
     * making a separate API call for every message.
     */
    private String senderName;

    /**
     * The textual content of the message.  Always present for type {@code "TEXT"};
     * may be a URL or metadata string for future types like {@code "IMAGE"}.
     */
    private String content;

    /**
     * Discriminator for the message type.  Currently always {@code "TEXT"}.
     * Reserved for future rich message types ({@code "IMAGE"}, {@code "FILE"},
     * {@code "SYSTEM"}).  Mirrors {@link ChatMessage#getMessageType()}.
     */
    private String messageType;

    /**
     * UTC timestamp of when the message was created (set by the server when
     * the entity is saved).  Populated by {@link #fromEntity(ChatMessage)} and
     * sent to the client so it can display accurate message timestamps.
     */
    private LocalDateTime createdAt;

    /**
     * Static factory method that converts a persisted {@link ChatMessage} entity
     * into a {@code ChatMessageDto} suitable for sending over the wire.
     *
     * <p><strong>Why a static factory instead of a constructor or mapper?</strong><br>
     * A static factory method named {@code fromEntity} makes the conversion
     * intent self-documenting.  It avoids adding a dependency on a mapper
     * library (like MapStruct) for a single simple mapping and keeps the
     * conversion logic inside the DTO itself where it is easy to find.
     *
     * <p>Note: {@code senderName} is intentionally NOT set here – it requires
     * a database call to the User service that is performed by the caller
     * ({@link com.hustleup.messaging.controller.ChatController}) after calling
     * this method.
     *
     * @param msg the persisted {@link ChatMessage} entity; must not be {@code null}.
     * @return a new {@code ChatMessageDto} populated from the entity's fields,
     *         with {@code senderName} left as {@code null}.
     */
    public static ChatMessageDto fromEntity(ChatMessage msg) {
        return ChatMessageDto.builder()
                .id(msg.getId())                   // database-generated primary key
                .bookingId(msg.getBookingId())     // booking this message belongs to
                .senderId(msg.getSenderId())       // author's UUID
                // senderName is NOT set here; ChatController enriches it separately
                .content(msg.getContent())         // message text
                .messageType(msg.getMessageType()) // e.g. "TEXT"
                .createdAt(msg.getCreatedAt())     // server-set creation timestamp
                .build();
    }
}
