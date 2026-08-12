package com.hustleup.common.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * JPA entity representing a mutual "Bond" (dating/networking) match between two users.
 *
 * <p><b>Why this lives in {@code hustleup-common} rather than the social service:</b><br>
 * A match is created by {@code hustleup-social}'s dating feature (when two users like each
 * other), but needs to be read by {@code hustleup-notification}'s direct-messaging feature
 * (to tag a DM conversation with a heart, showing it started as a Bond match rather than a
 * cold DM or a marketplace negotiation). Every HustleUp service shares one MySQL database,
 * so putting this entity in the common module lets both services query the same
 * {@code matches} table directly via JPA — no cross-service HTTP call needed, the same
 * pattern already used for {@link User} and {@link Notification}.
 *
 * <p><b>Canonical ordering:</b><br>
 * {@code userIdA} is always the lexicographically smaller of the two UUIDs (as strings),
 * {@code userIdB} the larger — enforced by whoever constructs this entity (see
 * {@code MatchRepository} usage), not by the entity itself. This guarantees exactly one row
 * per pair regardless of who liked whom last, so a lookup only ever needs to check one
 * ordering instead of two.
 */
@Entity
@Table(name = "matches", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"user_id_a", "user_id_b"})
})
@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Match {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** The lexicographically smaller of the two matched users' UUIDs. */
    @Column(name = "user_id_a", nullable = false)
    private UUID userIdA;

    /** The lexicographically larger of the two matched users' UUIDs. */
    @Column(name = "user_id_b", nullable = false)
    private UUID userIdB;

    @Column(name = "matched_at")
    @Builder.Default
    private LocalDateTime matchedAt = LocalDateTime.now();

    /**
     * Canonicalises an unordered pair of user IDs into the (smaller, larger) form this
     * entity is keyed on, so callers never have to remember or check which side is which.
     */
    public record Pair(UUID smaller, UUID larger) {
        public static Pair of(UUID x, UUID y) {
            return x.compareTo(y) <= 0 ? new Pair(x, y) : new Pair(y, x);
        }
    }
}
