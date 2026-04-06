/**
 * Controller for booking-scoped real-time chat via WebSocket (STOMP).
 *
 * <p><strong>Context – what is booking chat?</strong><br>
 * When a client books a freelancer on HustleUp, both parties need a shared
 * space to coordinate: clarify requirements, share files, ask questions.
 * This chat is <em>scoped to a specific booking</em> (identified by a
 * {@code bookingId} UUID), meaning each booking has its own isolated
 * message thread.
 *
 * <p><strong>How the WebSocket flow works end-to-end:</strong>
 * <ol>
 *   <li>The front-end connects to {@code /ws} (configured in
 *       {@link com.hustleup.notification.config.WebSocketConfig}) and performs
 *       a STOMP handshake.</li>
 *   <li>Both the client and the freelancer SUBSCRIBE to
 *       {@code /topic/booking/{bookingId}}.</li>
 *   <li>When either party types a message, the browser sends a STOMP SEND
 *       frame to {@code /app/chat.send/{bookingId}}.</li>
 *   <li>{@link #sendMessage} is invoked, persists the message, and then
 *       broadcasts it back to {@code /topic/booking/{bookingId}} via
 *       {@code SimpMessagingTemplate}.</li>
 *   <li>All subscribers (both participants) receive the message in real time.</li>
 * </ol>
 *
 * <p>Additionally, a REST endpoint ({@link #getHistory}) allows the client to
 * load the historical messages when the chat panel is first opened, before any
 * new WebSocket messages arrive.
 */
package com.hustleup.messaging.controller;

import com.hustleup.messaging.dto.ChatMessageDto;
import com.hustleup.messaging.model.ChatMessage;
import com.hustleup.messaging.repository.ChatMessageRepository;
import com.hustleup.common.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.handler.annotation.*;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * {@code @RestController} registers this class as a Spring MVC controller whose
 * return values are serialised directly to the HTTP response body as JSON.
 * It also allows this same class to mix WebSocket {@code @MessageMapping} methods
 * with regular HTTP {@code @GetMapping} methods – a convenient pattern when
 * the two concerns are tightly related (chat send vs. chat history).
 */
@RestController
public class ChatController {

    /**
     * JPA repository for persisting and querying {@link ChatMessage} entities.
     * Every message sent through the WebSocket is saved here so the conversation
     * history survives page refreshes and reconnects.
     */
    private final ChatMessageRepository chatMessageRepository;

    /**
     * JPA repository for {@link com.hustleup.common.model.User} entities.
     * Used to enrich outgoing {@link ChatMessageDto} objects with the sender's
     * display name (since the entity only stores the sender UUID).
     */
    private final UserRepository userRepository;

    /**
     * Spring's high-level WebSocket messaging abstraction.
     * {@code SimpMessagingTemplate} lets server-side code push a message to a
     * STOMP destination programmatically (i.e. without a client having sent a
     * message first).  Here it is used to broadcast the saved chat message to
     * all subscribers of {@code /topic/booking/{bookingId}}.
     *
     * <p>"Simp" stands for "Simple Messaging Protocol" – it is Spring's term
     * for the simplified, framework-managed STOMP support (as opposed to a full
     * external message broker).
     */
    private final SimpMessagingTemplate messagingTemplate;

    /**
     * Constructor injection of all three dependencies.
     *
     * @param chatMessageRepository repository for booking chat messages.
     * @param userRepository        repository for user profile data.
     * @param messagingTemplate     template for broadcasting WebSocket messages.
     */
    public ChatController(ChatMessageRepository chatMessageRepository, UserRepository userRepository,
                          SimpMessagingTemplate messagingTemplate) {
        this.chatMessageRepository = chatMessageRepository;
        this.userRepository = userRepository;
        this.messagingTemplate = messagingTemplate;
    }

    /**
     * Handles an inbound STOMP message when a user sends a chat message within
     * a booking conversation.  Persists the message to the database and then
     * broadcasts it to all WebSocket subscribers of that booking's topic.
     *
     * <pre>
     * Protocol    : WebSocket / STOMP
     * Client sends to   : /app/chat.send/{bookingId}
     *                     (the "/app" prefix is stripped by the broker config,
     *                      leaving "/chat.send/{bookingId}" to match here)
     * Server pushes to  : /topic/booking/{bookingId}
     *                     (all subscribers, including the original sender)
     * Payload     : {@link ChatMessageDto} JSON, e.g.:
     *               {"senderId":"uuid","content":"Hello!","messageType":"TEXT"}
     * Auth        : Implicitly secured by the WebSocket handshake; the STOMP
     *               connection is established only after the JWT filter passes.
     * </pre>
     *
     * <p>{@code @MessageMapping} is the WebSocket equivalent of
     * {@code @RequestMapping}: it maps an inbound STOMP destination to this
     * method.  The return type is {@code void} because we broadcast manually
     * using {@code messagingTemplate} rather than returning a value
     * (which would use {@code @SendTo}).
     *
     * @param bookingId  the booking UUID, extracted from the destination path
     *                   by {@code @DestinationVariable}.
     * @param messageDto the inbound message payload, automatically deserialised
     *                   from the STOMP frame body JSON.
     */
    @MessageMapping("/chat.send/{bookingId}")
    public void sendMessage(
            // @DestinationVariable is the WebSocket equivalent of @PathVariable:
            // it extracts a template variable from the STOMP destination string.
            @DestinationVariable String bookingId,

            // Spring automatically deserialises the STOMP message body (JSON)
            // into a ChatMessageDto.  No annotation is needed here.
            ChatMessageDto messageDto) {

        // Build the JPA entity from the DTO. We do NOT trust the client to supply
        // a timestamp or an ID – those are generated server-side.
        ChatMessage message = ChatMessage.builder()
                .bookingId(UUID.fromString(bookingId))         // bind to this booking
                .senderId(messageDto.getSenderId())             // who sent it
                .content(messageDto.getContent())               // message text
                // Default to "TEXT" if the client omitted messageType (e.g. future
                // types could be "IMAGE", "FILE", etc.)
                .messageType(messageDto.getMessageType() != null ? messageDto.getMessageType() : "TEXT")
                .build();

        // Persist the message. The returned 'saved' entity has its generated
        // UUID and createdAt timestamp populated by the database/Hibernate.
        ChatMessage saved = chatMessageRepository.save(message);

        // Convert the persisted entity back to a DTO for broadcasting.
        // We use the DTO rather than the raw entity to avoid serialising
        // JPA proxy internals and to control the exact JSON shape.
        ChatMessageDto dto = ChatMessageDto.fromEntity(saved);

        // Enrich the DTO with the sender's human-readable name so the front-end
        // can display it without making a separate /users/{id} request.
        userRepository.findById(saved.getSenderId())
                .ifPresent(u -> dto.setSenderName(u.getFullName()));

        // Broadcast the enriched DTO to every STOMP client subscribed to
        // /topic/booking/{bookingId}.  This covers both the sender (so they
        // see their own message confirmed) and all other participants.
        messagingTemplate.convertAndSend("/topic/booking/" + bookingId, dto);
    }

    /**
     * Returns the full message history for a given booking, ordered oldest
     * first.  Called when the chat panel is first opened to populate existing
     * messages before new real-time ones start arriving via WebSocket.
     *
     * <pre>
     * HTTP Method : GET
     * Path        : /api/v1/messages/{bookingId}
     * Auth        : Required (JWT via HTTP security filter)
     * Path Param  : bookingId – UUID of the booking whose history to fetch
     * Response    : 200 OK – JSON array of {@link ChatMessageDto} objects,
     *               sorted by createdAt ascending (chronological order)
     * </pre>
     *
     * <p>Each message is enriched with the sender's name so the UI can render
     * the chat bubble without additional lookups.
     *
     * @param bookingId the booking UUID, extracted from the URL path.
     * @return a {@link ResponseEntity} containing the ordered message list.
     */
    @GetMapping("/api/v1/messages/{bookingId}")
    public ResponseEntity<List<ChatMessageDto>> getHistory(
            // Spring converts the String path segment to UUID automatically.
            @PathVariable UUID bookingId) {

        List<ChatMessageDto> messages = chatMessageRepository
                // Fetch all messages for this booking, oldest first.
                .findByBookingIdOrderByCreatedAtAsc(bookingId)
                .stream()
                .map(msg -> {
                    // Convert each ChatMessage entity to a ChatMessageDto.
                    ChatMessageDto dto = ChatMessageDto.fromEntity(msg);

                    // Look up and attach the sender's display name.
                    userRepository.findById(msg.getSenderId())
                            .ifPresent(u -> dto.setSenderName(u.getFullName()));

                    return dto;
                })
                // Collectors.toList() produces a mutable List; could also use .toList()
                // (Java 16+) if immutability is acceptable.
                .collect(Collectors.toList());

        return ResponseEntity.ok(messages);
    }
}
