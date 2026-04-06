package com.hustleup.auth.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.UUID;

/**
 * RefreshToken — a JPA entity representing a persisted refresh token record.
 *
 * <h2>What problem does this solve?</h2>
 * <p>JWT access tokens are stateless: once issued, the server cannot revoke them
 * before they expire. To allow revocation (e.g., on logout, password change, or
 * suspicious activity), we use a separate long-lived <em>refresh token</em> that
 * is stored in the database. When a client wants a new access token it presents
 * the refresh token; the server checks that it exists in this table and has not
 * expired before issuing the new access token. To revoke a session, the server
 * simply deletes the refresh token row.</p>
 *
 * <h2>Why a JPA @Entity?</h2>
 * <p>JPA (Java Persistence API) is the standard ORM (Object-Relational Mapping)
 * specification for Java. Marking this class with {@code @Entity} tells Hibernate
 * (the JPA implementation) to map it to a database table. Hibernate generates SQL
 * automatically, handles the object-to-row mapping, and manages transactions.
 * The alternative (raw JDBC) would require writing boilerplate SQL by hand.</p>
 *
 * <h2>What the table stores</h2>
 * <p>The {@code refresh_tokens} table has one row per active session. When a user
 * logs in or registers a row is inserted. When the access token is refreshed the
 * old row stays (the refresh token is reused). When the user logs out (not yet
 * implemented) the row should be deleted to invalidate the session.</p>
 *
 * <h2>Lombok annotations used here</h2>
 * <ul>
 *   <li>{@code @Getter}         — generates {@code getXxx()} for every field</li>
 *   <li>{@code @Setter}         — generates {@code setXxx()} for every field</li>
 *   <li>{@code @NoArgsConstructor} — generates a no-arg constructor (required by JPA)</li>
 *   <li>{@code @AllArgsConstructor} — generates a constructor with all fields (used by @Builder)</li>
 *   <li>{@code @Builder}        — generates a fluent builder: {@code RefreshToken.builder()...build()}</li>
 * </ul>
 */
// @Entity tells JPA/Hibernate that this class maps to a database table.
// Without this annotation Hibernate completely ignores the class.
@Entity

// @Table(name = "refresh_tokens") explicitly names the DB table.
// Without it, Hibernate would default to "refresh_token" (singular, camel-case mapped to snake_case),
// which is close but not what we want. Being explicit avoids surprises.
@Table(name = "refresh_tokens")

// Lombok: generate getters/setters for all fields.
@Getter @Setter

// Lombok: generate a no-argument constructor.
// JPA REQUIRES a no-arg constructor to instantiate entities when loading them from the DB.
// Without it, Hibernate will throw an exception at startup.
@NoArgsConstructor

// Lombok: generate a constructor with all fields — needed internally by @Builder.
@AllArgsConstructor

// Lombok: generate a builder so callers can write:
//   RefreshToken.builder().userId(...).token(...).expiryDate(...).build()
// This is safer and more readable than a positional constructor call.
@Builder
public class RefreshToken {

    // @Id marks this field as the primary key of the table.
    @Id

    // @GeneratedValue(strategy = GenerationType.UUID) instructs Hibernate to
    // auto-generate a UUID for new rows instead of requiring the caller to supply one.
    // UUID is preferred over a sequential integer PK for security (ids are not guessable)
    // and for distributed systems (no central sequence counter needed).
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id; // surrogate primary key — purely an internal identifier

    // @Column(name = "user_id", nullable = false) maps this field to the "user_id" column.
    // nullable = false adds a NOT NULL constraint at the database level AND tells
    // Hibernate not to allow null values when inserting/updating this column.
    // We store the user's UUID here instead of a full @ManyToOne relationship to keep
    // this entity lightweight and avoid unnecessary joins.
    @Column(name = "user_id", nullable = false)
    private UUID userId; // FK reference to the users table (denormalised for simplicity)

    // unique = true adds a UNIQUE constraint on the "token" column.
    // This guarantees that the same token string can never appear twice, which is
    // important for security — each token must identify exactly one session.
    @Column(nullable = false, unique = true)
    private String token; // the opaque refresh token string sent to and from the client

    // Instant is Java's best type for UTC timestamps — it represents a point in time
    // with nanosecond precision and no timezone ambiguity. Always prefer Instant or
    // ZonedDateTime over java.util.Date or java.sql.Timestamp for new code.
    @Column(name = "expiry_date", nullable = false)
    private Instant expiryDate; // when this token expires; checked before issuing a new access token
}
