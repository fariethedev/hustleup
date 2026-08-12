package com.hustleup.auth.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

/**
 * A single-use token for account flows that need to prove control of an email
 * address: email verification and password reset. Mirrors {@link RefreshToken}'s
 * shape (persisted, revocable-by-deletion) but carries a {@link Purpose} so one
 * table serves both flows instead of two near-identical entities.
 */
@Entity
@Table(name = "auth_tokens")
@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuthToken {

    public enum Purpose {
        VERIFY_EMAIL,
        RESET_PASSWORD
    }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(nullable = false, unique = true)
    private String token;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Purpose purpose;

    @Column(name = "expiry_date", nullable = false)
    private Instant expiryDate;
}
