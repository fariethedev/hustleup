package com.hustleup.social.model;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * A block relationship: {@code blockerId} no longer wants any contact with
 * {@code blockedId}. Blocking removes any follow edges between the two users
 * and hides interaction affordances (follow/message) in the UI.
 *
 * <p>Mirrors the {@link Follow} design: surrogate UUID key plus a composite
 * unique constraint so the same block can't be recorded twice.
 */
@Entity
@Table(name = "user_blocks", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"blocker_id", "blocked_id"})
})
@Data
public class UserBlock {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "blocker_id", nullable = false)
    private UUID blockerId;

    @Column(name = "blocked_id", nullable = false)
    private UUID blockedId;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
