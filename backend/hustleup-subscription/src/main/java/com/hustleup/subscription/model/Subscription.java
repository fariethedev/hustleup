package com.hustleup.subscription.model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * JPA entity representing a seller's subscription to the HustleUp platform.
 *
 * <h2>What is a JPA Entity?</h2>
 * <p>JPA (Jakarta Persistence API) is the standard Java specification for mapping
 * Java objects to relational database tables. When you annotate a class with
 * {@link Entity}, Hibernate (the JPA implementation used by Spring Boot by default)
 * automatically creates and manages the corresponding database table. You write
 * plain Java — Hibernate translates it to SQL.</p>
 *
 * <h2>Why does this class exist?</h2>
 * <p>Every seller on HustleUp can be on one of several subscription plans (FREE,
 * VERIFIED, etc.). This entity persists the state of that subscription — which
 * plan the seller is on, when it started, when it expires, and what Stripe charged.
 * Keeping it in its own table (separate from the {@code users} table) follows the
 * Single Responsibility Principle: billing data can evolve independently of user
 * profile data.</p>
 *
 * <h2>Lombok annotations</h2>
 * <p>Lombok is a code-generation library that removes boilerplate. The annotations
 * on this class auto-generate getters, setters, constructors, and a builder at
 * compile time — you never see that code, but the compiler emits it.</p>
 */
// Marks this class as a JPA entity — Hibernate will map it to a DB table.
@Entity

// Specifies the exact table name. Without this, Hibernate would derive the name
// from the class name ('subscription'), but being explicit avoids surprises when
// the class is renamed.
@Table(name = "subscriptions")

// Generates a public getter for every field (e.g. getId(), getPlan()).
@Getter

// Generates a public setter for every non-final field (e.g. setPlan(String)).
@Setter

// Generates a no-argument constructor required by JPA — Hibernate must be able
// to instantiate entities with new Subscription() before populating fields.
@NoArgsConstructor

// Generates a constructor that accepts values for all fields in declaration order.
// Useful in tests and when building objects programmatically.
@AllArgsConstructor

// Generates a fluent builder: Subscription.builder().plan("VERIFIED").build().
// Builders are preferred over constructors when a class has many optional fields.
@Builder
public class Subscription {

    // -------------------------------------------------------------------------
    // Primary key
    // -------------------------------------------------------------------------

    // Marks this field as the primary key column in the 'subscriptions' table.
    @Id

    // Tells Hibernate to generate a new UUID value automatically whenever a new
    // Subscription is persisted. UUIDs (rather than auto-increment integers) are
    // preferred in distributed systems because they are globally unique and do not
    // reveal insertion order to API consumers.
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    // -------------------------------------------------------------------------
    // Seller reference
    // -------------------------------------------------------------------------

    // Maps this field to the 'seller_id' column.
    // nullable = false  → a subscription must always belong to a seller (DB constraint).
    // unique = true     → enforces one-subscription-per-seller at the database level,
    //                     preventing accidental duplicates even if application code
    //                     has a bug.
    @Column(name = "seller_id", nullable = false, unique = true)
    private UUID sellerId;

    // -------------------------------------------------------------------------
    // Plan details
    // -------------------------------------------------------------------------

    // The subscription tier. Possible values: "FREE", "VERIFIED".
    // @Builder.Default is required when using Lombok's @Builder alongside a field
    // initialiser — without it, the builder would set the field to null instead of
    // the specified default value.
    @Builder.Default
    private String plan = "FREE";

    // Lifecycle state of this subscription. Possible values: "ACTIVE", "CANCELLED",
    // "EXPIRED". Allows soft-disabling without deleting the record.
    @Builder.Default
    private String status = "ACTIVE";

    // The monthly cost of the chosen plan stored with high precision.
    // BigDecimal is always used for monetary values — float/double introduce
    // floating-point rounding errors that are unacceptable in financial contexts.
    // precision = 12 → up to 12 significant digits total.
    // scale = 4       → 4 digits after the decimal point (e.g. 20.0000).
    @Column(name = "price_per_month", precision = 12, scale = 4)
    @Builder.Default
    private BigDecimal pricePerMonth = new BigDecimal("20.00");

    // ISO 4217 currency code. Defaults to South African Rand (ZAR) because
    // HustleUp's primary market is South Africa.
    @Builder.Default
    private String currency = "ZAR";

    // -------------------------------------------------------------------------
    // Temporal fields
    // -------------------------------------------------------------------------

    // The timestamp when this subscription was first activated.
    // Defaults to "now" so newly created subscriptions are immediately active.
    @Column(name = "started_at")
    @Builder.Default
    private LocalDateTime startedAt = LocalDateTime.now();

    // The timestamp when this subscription will expire. Null means the subscription
    // has no expiry (e.g. FREE plans never expire). Set to startedAt + 1 month when
    // the seller upgrades to a paid plan.
    @Column(name = "expires_at")
    private LocalDateTime expiresAt;
}
