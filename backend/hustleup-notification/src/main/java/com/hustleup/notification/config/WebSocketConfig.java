/**
 * Spring WebSocket configuration for the HustleUp Notification service.
 *
 * <p><strong>Why WebSocket instead of HTTP polling?</strong><br>
 * HTTP is a request/response protocol – a client always has to ask first.
 * To show a new chat message in near real-time with HTTP, the client would need
 * to poll (send a GET every second or two), which wastes bandwidth and adds
 * latency.  WebSocket is a <em>full-duplex, persistent</em> TCP connection:
 * once the handshake is complete either party can push data at any time.
 * For a chat feature, this means messages appear instantly without the client
 * polling.
 *
 * <p><strong>Why STOMP over raw WebSocket?</strong><br>
 * Raw WebSocket gives you a byte stream with no built-in concept of destinations,
 * acknowledgements, or message types.  STOMP (Simple Text Oriented Messaging
 * Protocol) adds a lightweight framing layer on top: clients SUBSCRIBE to
 * named destinations (e.g. {@code /topic/booking/123}) and SEND to named
 * destinations (e.g. {@code /app/chat.send/123}).  Spring's
 * {@code @MessageMapping} annotations map inbound STOMP frames to Java methods,
 * exactly like {@code @RequestMapping} works for HTTP.
 *
 * <p><strong>Why SockJS?</strong><br>
 * Some corporate networks or older browsers block WebSocket upgrades.  SockJS
 * is a browser library that transparently falls back to HTTP long-polling or
 * other transports when a real WebSocket connection cannot be established,
 * ensuring the chat works everywhere.
 */
package com.hustleup.notification.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.lang.NonNull;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

/**
 * {@code @Configuration} marks this as a Spring configuration class so that
 * its method-based bean definitions and interface implementations are picked up
 * during application startup.
 */
@Configuration

/**
 * {@code @EnableWebSocketMessageBroker} switches on the full STOMP-over-WebSocket
 * messaging infrastructure in Spring.  It creates the internal message channel
 * pipeline (client inbound/outbound channels and a broker channel) and registers
 * the necessary handler adapters so that {@code @MessageMapping} methods in
 * controllers work correctly.
 */
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    /**
     * Registers the WebSocket/SockJS handshake endpoint – the URL that clients
     * connect to first when establishing a STOMP session.
     *
     * <p>Flow from the client's perspective:
     * <ol>
     *   <li>Client calls {@code new SockJS('/ws')} (or {@code new WebSocket('ws://host/ws')}).</li>
     *   <li>The browser performs an HTTP upgrade to WebSocket (or falls back via SockJS).</li>
     *   <li>Once connected, the client sends a STOMP {@code CONNECT} frame.</li>
     *   <li>Spring responds with a STOMP {@code CONNECTED} frame.</li>
     *   <li>The client can now SUBSCRIBE and SEND.</li>
     * </ol>
     *
     * @param registry Spring's fluent builder for STOMP endpoints; non-null.
     */
    @Override
    public void registerStompEndpoints(@NonNull StompEndpointRegistry registry) {
        registry
            // "/ws" is the HTTP path clients connect to for the WebSocket handshake.
            // The full URL in development is typically: ws://localhost:8083/ws
            .addEndpoint("/ws")

            // Allow connections from any origin.
            // In production, replace "*" with specific allowed origins (e.g. your
            // front-end domain) to prevent cross-origin WebSocket abuse.
            .setAllowedOriginPatterns("*")

            // withSockJS() wraps the endpoint with SockJS support.
            // If a browser cannot upgrade to WebSocket, SockJS will automatically
            // negotiate a fallback transport (XHR-streaming, long-polling, etc.).
            .withSockJS();
    }

    /**
     * Configures the in-memory STOMP message broker – the component responsible
     * for routing messages from senders to subscribers.
     *
     * <p><strong>Destination namespacing:</strong>
     * <ul>
     *   <li>Destinations starting with {@code /topic} or {@code /queue} are
     *       handled by the simple in-process broker and delivered to all
     *       subscribers of that destination.</li>
     *   <li>Destinations starting with {@code /app} are routed to
     *       {@code @MessageMapping} methods in controllers first; the controller
     *       can then forward results to a broker destination.</li>
     * </ul>
     *
     * <p><strong>Note on the simple broker vs. a full broker:</strong><br>
     * {@code enableSimpleBroker} uses an in-memory broker built into Spring.
     * It is sufficient for a single-node deployment.  If HustleUp later needs
     * to scale horizontally (multiple service instances), the simple broker
     * should be replaced with a full STOMP broker (e.g. RabbitMQ or ActiveMQ)
     * using {@code enableStompBrokerRelay()} so that messages published on
     * instance A reach subscribers on instance B.
     *
     * @param registry Spring's fluent builder for broker configuration; non-null.
     */
    @Override
    public void configureMessageBroker(@NonNull MessageBrokerRegistry registry) {
        // Enable the simple (in-memory) broker for two destination prefixes:
        //   /topic  – used for broadcast/pub-sub semantics (one sender → many subscribers)
        //             Example: /topic/booking/abc123  (all participants in a booking chat)
        //   /queue  – conventionally used for point-to-point semantics (one sender → one receiver)
        //             Currently reserved for future use (e.g. per-user private queues).
        registry.enableSimpleBroker("/topic", "/queue");

        // Any client message sent to a destination starting with "/app" will be
        // routed to a @MessageMapping-annotated controller method, NOT directly
        // to subscribers.  The "/app" prefix is stripped before matching, so
        // @MessageMapping("/chat.send/{bookingId}") handles "/app/chat.send/{bookingId}".
        registry.setApplicationDestinationPrefixes("/app");
    }
}
