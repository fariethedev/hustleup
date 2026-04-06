/**
 * Kafka event publisher for the HustleUp social feed.
 *
 * <p>Publishes domain events to the {@value #TOPIC} Kafka topic whenever something
 * significant happens in the feed (post created, post liked).  Downstream services
 * (e.g. notification service, analytics pipeline, search indexer) can subscribe to
 * this topic and react asynchronously without being tightly coupled to this service.
 *
 * <h2>Why Kafka?</h2>
 * Kafka decouples the producer (this service) from consumers:
 * <ul>
 *   <li>The social service doesn't need to know which services care about feed events.</li>
 *   <li>Consumers can process events at their own pace (backpressure handling).</li>
 *   <li>Events are durable — Kafka retains them for a configurable period, so a consumer
 *       that was temporarily down can catch up.</li>
 *   <li>New consumers can be added later without changing this service.</li>
 * </ul>
 *
 * <h2>Resilience design</h2>
 * Kafka is treated as optional infrastructure.  If the Kafka broker is unavailable
 * (e.g. in a local dev environment that hasn't started Kafka), all publish calls are
 * silently swallowed — logged at DEBUG level but never re-thrown.  This means:
 * <ul>
 *   <li>The feed still works without Kafka.</li>
 *   <li>A Kafka outage does not cause post creation to fail.</li>
 *   <li>Events may be lost during an outage (at-most-once delivery).</li>
 * </ul>
 *
 * <h2>Event format</h2>
 * Events are simple colon-delimited strings: {@code "post_id:user_id"}.
 * The Kafka message key is the event type (e.g. {@code "POST_CREATED"}).
 * Using the event type as the key means all events of the same type go to the same
 * partition, guaranteeing ordering within a type.
 */
package com.hustleup.social.event;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

import java.util.concurrent.CompletableFuture;

// @Service: Spring will create a singleton instance of this class and inject it
// wherever it's needed (currently in FeedController).
@Service
public class FeedEventPublisher {

    /** SLF4J logger — used to log Kafka failures at DEBUG level. */
    private static final Logger log = LoggerFactory.getLogger(FeedEventPublisher.class);

    /** The Kafka topic all feed events are published to. */
    private static final String TOPIC = "feed-events";

    /**
     * Spring Kafka's template for sending messages.
     *
     * <p>{@code KafkaTemplate<String, String>} means both the key and value are strings.
     * The key is the event type; the value is the payload.
     * Spring Boot auto-configures this bean when {@code spring.kafka.bootstrap-servers}
     * is set in application properties.
     */
    private final KafkaTemplate<String, String> kafkaTemplate;

    /**
     * Constructor injection — Spring provides the KafkaTemplate.
     * If Kafka is not configured, Spring Boot still starts and injects a default
     * (no-op or failing) template; the try/catch in publish() handles failures.
     *
     * @param kafkaTemplate the Kafka producer template
     */
    public FeedEventPublisher(KafkaTemplate<String, String> kafkaTemplate) {
        this.kafkaTemplate = kafkaTemplate;
    }

    // ── Public event methods ──────────────────────────────────────────────────

    /**
     * Publishes a {@code POST_CREATED} event to the feed-events topic.
     *
     * <p>Called immediately after a new post is persisted to the database.
     * Downstream consumers can use this event to:
     * <ul>
     *   <li>Update a search/discovery index with the new post.</li>
     *   <li>Trigger push notifications to followers.</li>
     *   <li>Increment analytics counters.</li>
     * </ul>
     *
     * <p>Payload format: {@code "postId:authorId"}
     *
     * @param postId   the UUID string of the newly created post
     * @param authorId the UUID string of the post author
     */
    public void postCreated(String postId, String authorId) {
        publish("POST_CREATED", postId + ":" + authorId);
    }

    /**
     * Publishes a {@code POST_LIKED} event to the feed-events topic.
     *
     * <p>Currently defined but not called from the controller.  Reserved for future use
     * (e.g. to trigger "X liked your post" push notifications asynchronously).
     *
     * <p>Payload format: {@code "postId:userId"}
     *
     * @param postId the UUID string of the post that was liked
     * @param userId the UUID string of the user who liked it
     */
    public void postLiked(String postId, String userId) {
        publish("POST_LIKED", postId + ":" + userId);
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /**
     * Core publish method — sends a keyed message to the Kafka topic.
     *
     * <p>Wrapped in try/catch so that a Kafka outage never propagates up to the caller.
     * Failures are logged at DEBUG (not WARN/ERROR) because Kafka being unavailable in
     * a local or staging environment is expected and unimportant.
     *
     * @param eventType the Kafka message key (e.g. "POST_CREATED")
     * @param payload   the Kafka message value (e.g. "postId:authorId")
     */
    private void publish(String eventType, String payload) {
        // Run on a background thread — kafkaTemplate.send() can block for up to
        // max.block.ms (now 500ms) when Kafka is unavailable.  Running off the
        // request thread ensures the HTTP response is never delayed by Kafka.
        CompletableFuture.runAsync(() -> {
            try {
                kafkaTemplate.send(TOPIC, eventType, payload);
            } catch (Exception e) {
                // Kafka is optional infrastructure — log and continue if unavailable.
                log.debug("Kafka unavailable — skipped event {}: {}", eventType, e.getMessage());
            }
        });
    }
}
