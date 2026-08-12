/**
 * Tracks a Snapchat-style daily messaging streak between two users.
 *
 * <p>One row exists per unordered pair of users ({@code userAId} is always the
 * lexicographically smaller UUID string of the two, so "A messages B" and
 * "B messages A" resolve to the same row instead of creating duplicates).
 *
 * <p><strong>Simplified rule (documented, not a full Snapchat clone):</strong>
 * the streak increments once per calendar day that <em>either</em> side sends
 * a message to the other (real Snapchat requires both sides to send within
 * the day). If a full calendar day passes with no messages from either side,
 * the streak resets to 1 on the next message. See
 * {@link com.hustleup.notification.messaging.controller.DirectMessageController#updateStreak}
 * for the update logic.
 */
package com.hustleup.notification.messaging.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Entity
@Table(name = "chat_streaks", uniqueConstraints = @UniqueConstraint(columnNames = {"user_a_id", "user_b_id"}))
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChatStreak {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    /** The lexicographically smaller of the two participant UUIDs (string comparison). */
    @Column(name = "user_a_id", nullable = false)
    private String userAId;

    /** The lexicographically larger of the two participant UUIDs. */
    @Column(name = "user_b_id", nullable = false)
    private String userBId;

    /** Consecutive days (as of {@link #lastMessageDate}) either side has messaged the other. */
    @Column(name = "current_streak", nullable = false)
    @Builder.Default
    private int currentStreak = 0;

    /** Calendar date (server-local) of the most recent message that counted toward the streak. */
    @Column(name = "last_message_date", nullable = false)
    private LocalDate lastMessageDate;
}
