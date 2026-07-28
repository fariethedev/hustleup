/**
 * JPA entity recording a single swipe (like or pass) from one user onto another
 * in the Hustle Bond dating/networking feature.
 *
 * <p>Persisting swipes fixes two things that were previously broken: (1) a passed
 * or liked profile would reappear every time the discovery feed was reloaded, since
 * nothing was saved; and (2) there was no way to detect a mutual like ("match").
 *
 * <h2>Table: {@code dating_swipes}</h2>
 * One row per (swiper, target) pair — re-swiping the same person updates the
 * existing row's {@link #action} rather than creating a duplicate.
 */
package com.hustleup.social.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "dating_swipes", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"swiper_id", "target_id"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DatingSwipe {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** UUID of the user performing the swipe. */
    @Column(name = "swiper_id", nullable = false)
    private UUID swiperId;

    /** UUID of the profile being swiped on. */
    @Column(name = "target_id", nullable = false)
    private UUID targetId;

    /** Either {@code "LIKE"} or {@code "PASS"}. */
    @Column(nullable = false)
    private String action;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
