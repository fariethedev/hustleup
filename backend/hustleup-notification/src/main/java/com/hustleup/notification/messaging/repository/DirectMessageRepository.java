/**
 * Spring Data JPA repository for {@link DirectMessage} entities.
 *
 * <p><strong>What is a Spring Data repository?</strong><br>
 * By extending {@link JpaRepository}, this interface automatically inherits a
 * full set of CRUD methods (save, findById, findAll, delete, count, etc.) without
 * writing any implementation code.  Spring generates a proxy at runtime that
 * translates method calls into the appropriate SQL queries.
 *
 * <p><strong>Custom queries:</strong><br>
 * The three custom query methods below use JPQL (Java Persistence Query Language)
 * or native SQL to express queries that cannot be derived automatically from a
 * method name.  JPQL uses entity class names and field names (not table/column
 * names), while native queries use raw SQL with table/column names.
 *
 * <p><strong>Generic parameters of JpaRepository:</strong>
 * <ul>
 *   <li>First type parameter: the entity class ({@link DirectMessage})</li>
 *   <li>Second type parameter: the type of the primary key ({@code String} here,
 *       because {@code DirectMessage.id} is a {@code String}-typed UUID)</li>
 * </ul>
 */
package com.hustleup.notification.messaging.repository;

import com.hustleup.notification.messaging.model.DirectMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * {@code @Repository} is a Spring stereotype annotation that:
 * <ol>
 *   <li>Marks this interface as a Spring-managed component so it is picked up
 *       by component scanning and registered as a bean.</li>
 *   <li>Enables Spring's persistence exception translation – any
 *       {@code PersistenceException} thrown by Hibernate will be wrapped in a
 *       Spring {@code DataAccessException}, giving callers a consistent exception
 *       hierarchy regardless of the underlying JPA provider.</li>
 * </ol>
 */
@Repository
public interface DirectMessageRepository extends JpaRepository<DirectMessage, String> {

    /**
     * Fetches the complete conversation between two users, in chronological order.
     *
     * <p><strong>Why this query?</strong><br>
     * A direct-message conversation is bidirectional: user A can send to B, and
     * B can send back to A.  A naive "WHERE sender_id = :user1" query would miss
     * messages sent in the opposite direction.  The OR condition
     * {@code (senderId = :user1 AND receiverId = :user2) OR (senderId = :user2 AND receiverId = :user1)}
     * captures both directions in a single query.
     *
     * <p><strong>JPQL vs. SQL:</strong><br>
     * This uses JPQL ({@code @Query} without {@code nativeQuery = true}).  JPQL
     * references the Java entity class {@code DirectMessage} and its field names
     * ({@code senderId}, {@code receiverId}) – <em>not</em> the database column
     * names ({@code sender_id}, {@code receiver_id}).
     *
     * <p><strong>Ordering:</strong>
     * {@code ORDER BY m.createdAt ASC} returns oldest messages first so the
     * UI can render the conversation in reading order (top = oldest, bottom = newest).
     *
     * @param user1 UUID string of the first participant (order doesn't matter).
     * @param user2 UUID string of the second participant.
     * @return list of {@link DirectMessage} entities, oldest first.
     */
    @Query("SELECT m FROM DirectMessage m " +
           "WHERE (m.senderId = :user1 AND m.receiverId = :user2) " +
           "   OR (m.senderId = :user2 AND m.receiverId = :user1) " +
           "ORDER BY m.createdAt ASC")
    List<DirectMessage> findConversation(String user1, String user2);

    /**
     * Returns the distinct set of user IDs with whom {@code userId} has exchanged
     * at least one direct message.  Used to populate the "Conversations" sidebar.
     *
     * <p><strong>How the CASE expression works:</strong><br>
     * Each row in {@code direct_messages} has a {@code senderId} and a
     * {@code receiverId}.  For a given {@code userId}, the "partner" on any given
     * message is:
     * <ul>
     *   <li>the {@code receiverId} if this user was the sender, or</li>
     *   <li>the {@code senderId} if this user was the receiver.</li>
     * </ul>
     * The JPQL {@code CASE WHEN} expression picks the right column:
     * <pre>{@code
     *   CASE WHEN m.senderId = :userId THEN m.receiverId ELSE m.senderId END
     * }</pre>
     *
     * <p>{@code DISTINCT} eliminates duplicates – if A and B exchanged 100 messages,
     * B's UUID appears once in the result, not 100 times.
     *
     * <p>The {@code WHERE} clause ensures we only look at rows that actually involve
     * {@code userId}, regardless of which side they were on.
     *
     * @param userId UUID string of the current user.
     * @return a deduplicated list of partner UUID strings.
     */
    @Query("SELECT DISTINCT CASE WHEN m.senderId = :userId THEN m.receiverId ELSE m.senderId END " +
           "FROM DirectMessage m " +
           "WHERE m.senderId = :userId OR m.receiverId = :userId")
    List<String> findDistinctChatPartners(String userId);

    /**
     * Retrieves the single most recent message exchanged between two users.
     * Used to display the "last message" preview in the chat list UI.
     *
     * <p><strong>Why a native query?</strong><br>
     * JPQL does not support {@code LIMIT}.  The standard JPQL alternative would
     * be to use a {@code Pageable} parameter or the {@code @Query} with
     * Spring Data's {@code Limit} annotation (added in Spring Data 3.2+).
     * Using {@code nativeQuery = true} with SQL {@code LIMIT 1} is a simpler
     * approach that works across all Spring Data versions and clearly expresses
     * the intent.
     *
     * <p><strong>Bidirectional WHERE:</strong><br>
     * Same as {@link #findConversation}: we match rows where the two users appear
     * in either order as sender/receiver.
     *
     * <p><strong>ORDER BY DESC + LIMIT 1:</strong><br>
     * Sort by {@code created_at} descending (newest first), then take only the
     * first row ({@code LIMIT 1}).  This gives us the most recent message
     * without loading the entire conversation.
     *
     * @param user1 UUID string of the first participant.
     * @param user2 UUID string of the second participant.
     * @return an {@link java.util.Optional} containing the most recent message,
     *         or {@code Optional.empty()} if the two users have never exchanged a message.
     */
    @Query(value = "SELECT * FROM direct_messages " +
                   "WHERE (sender_id = :user1 AND receiver_id = :user2) " +
                   "   OR (sender_id = :user2 AND receiver_id = :user1) " +
                   "ORDER BY created_at DESC LIMIT 1",
           nativeQuery = true) // nativeQuery = true → raw SQL, not JPQL
    java.util.Optional<DirectMessage> findLastMessage(String user1, String user2);

    // ── Unread tracking ──────────────────────────────────────────────────────
    // A message counts as unread when the caller is its RECEIVER and its readAt is
    // still null. Filtering on receiverId is what stops your own outgoing messages
    // from inflating your unread badge.

    /**
     * Total messages the given user has received but not yet opened — the number
     * shown on the DMs tab and beside the "Chats" heading.
     *
     * <p>Derived query: Spring Data builds the SQL from the method name, so
     * {@code ReceiverId} + {@code ReadAtIsNull} becomes
     * {@code WHERE receiver_id = ? AND read_at IS NULL}. No {@code @Query} needed.
     *
     * @param receiverId UUID string of the user whose inbox is being counted
     * @return how many unopened messages they have across every conversation
     */
    long countByReceiverIdAndReadAtIsNull(String receiverId);

    /**
     * Unread messages from one specific partner — the per-row badge in the chat list.
     *
     * @param senderId   UUID string of the partner who sent the messages
     * @param receiverId UUID string of the user reading them (the caller)
     * @return how many messages that partner sent which the caller has not opened
     */
    long countBySenderIdAndReceiverIdAndReadAtIsNull(String senderId, String receiverId);

    /**
     * Stamps every still-unread message the caller received in one conversation as
     * read, in a single UPDATE.
     *
     * <p><b>Why bulk rather than load-and-save:</b> opening a chat with a long unread
     * backlog would otherwise pull every row into the persistence context just to flip
     * one field each. This touches only the rows that actually need it — the
     * {@code readAt IS NULL} guard means reopening an already-read conversation is a
     * no-op that updates nothing.
     *
     * <p>{@code @Modifying} tells Spring Data this query writes (so it uses
     * {@code executeUpdate()} rather than expecting a result set), and
     * {@code clearAutomatically} discards the now-stale first-level cache so a
     * subsequent read in the same transaction sees the new values rather than the
     * pre-update copies Hibernate is still holding.
     *
     * @param senderId   UUID string of the partner whose messages are being marked
     * @param receiverId UUID string of the caller, who is opening the conversation
     * @param readAt     the timestamp to stamp on those messages
     * @return the number of messages actually marked read
     */
    @org.springframework.data.jpa.repository.Modifying(clearAutomatically = true)
    @Query("UPDATE DirectMessage m SET m.readAt = :readAt " +
           "WHERE m.senderId = :senderId AND m.receiverId = :receiverId AND m.readAt IS NULL")
    int markConversationRead(String senderId, String receiverId, java.time.LocalDateTime readAt);

    /**
     * Whether a price negotiation has ever been opened between these two people.
     *
     * <p>Drives the lime treatment on the conversation list: a thread where money is being
     * agreed should be findable at a glance among ordinary chat.
     *
     * <p>Asks "has an OFFER ever been sent" rather than "is the last message an OFFER",
     * because a negotiation is a thread, not a message. The two of you go on talking after
     * the card is posted -- countering, asking about postage -- and the offer card stays
     * live above that conversation the whole time. Keying off the newest message would
     * light the row up and then drop it again on the next "ok sounds good", which is
     * exactly when you most want to find the thread.
     *
     * @param user1 either participant (order does not matter)
     * @param user2 the other participant
     * @return true when at least one OFFER message exists in either direction
     */
    @Query("SELECT COUNT(m) > 0 FROM DirectMessage m " +
           "WHERE m.messageType = 'OFFER' " +
           "  AND ((m.senderId = :user1 AND m.receiverId = :user2) " +
           "    OR (m.senderId = :user2 AND m.receiverId = :user1))")
    boolean hasNegotiation(String user1, String user2);
}
