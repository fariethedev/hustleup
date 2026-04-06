/**
 * JPA entity representing a service or product listing on the HustleUp marketplace.
 *
 * <p>A {@code Listing} is the core domain object of the marketplace. It captures everything
 * a seller wants to advertise: what they are offering, how much they charge, where they are
 * based, and whether the price is open to negotiation. Buyers browse listings, and every
 * {@link com.hustleup.booking.model.Booking} must reference exactly one listing.
 *
 * <h3>JPA / Hibernate design decisions</h3>
 * <ul>
 *   <li><b>UUID primary key</b> — UUIDs are globally unique across services and databases,
 *       which avoids collisions if data is ever migrated or merged. We store them as
 *       {@code VARCHAR(36)} (the canonical hyphenated form) rather than a binary column
 *       so they are human-readable in database tools.</li>
 *   <li><b>Seller relationship</b> — Instead of a JPA {@code @ManyToOne} join to a User entity,
 *       we store only the {@code sellerId} (a UUID foreign key). This is a deliberate
 *       microservice boundary: the User entity lives in the common/social service and we do
 *       not want to couple this module's database schema to it. Seller details are looked up
 *       separately in {@link com.hustleup.listing.service.ListingService#enrichDto}.</li>
 *   <li><b>Enum as STRING</b> — Storing {@link ListingType} and {@link ListingStatus} as
 *       strings (e.g. "SKILL", "ACTIVE") rather than ordinals makes the database readable
 *       and resilient to enum reordering.</li>
 *   <li><b>Optimistic locking (@Version)</b> — The {@code version} column prevents
 *       lost-update bugs when two requests update the same listing simultaneously. Hibernate
 *       automatically increments it on each save and throws
 *       {@link org.springframework.orm.ObjectOptimisticLockingFailureException} if a
 *       concurrent update has changed the version since the entity was loaded.</li>
 *   <li><b>Lombok</b> — {@code @Getter}, {@code @Setter}, {@code @NoArgsConstructor},
 *       {@code @AllArgsConstructor}, and {@code @Builder} are all Lombok annotations that
 *       generate boilerplate Java code at compile time, keeping the source file concise.</li>
 * </ul>
 */
package com.hustleup.listing.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

// @Entity tells Hibernate that this Java class maps to a database table.
// Hibernate will create (or validate) the table at startup based on the fields below.
@Entity
// @Table(name = "listings") overrides the default table name (which would be "listing")
// and maps it explicitly to "listings".
@Table(name = "listings")
// Lombok annotations — these generate Java code at compile time:
//   @Getter      → generates getXxx() for every field
//   @Setter      → generates setXxx() for every field
//   @NoArgsConstructor  → generates a public no-arg constructor (required by JPA / Hibernate)
//   @AllArgsConstructor → generates a constructor that accepts every field (used by @Builder internally)
//   @Builder     → generates a fluent builder: Listing.builder().title("...").build()
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Listing {

    // @Id marks this field as the primary key of the "listings" table.
    @Id
    // @UuidGenerator tells Hibernate to automatically generate a UUID value when a new
    // Listing is persisted for the first time (i.e. when id is null). No need to set it
    // manually in application code.
    @org.hibernate.annotations.UuidGenerator
    // @JdbcTypeCode(SqlTypes.VARCHAR) instructs Hibernate to treat the UUID as a VARCHAR
    // column at the JDBC level, ensuring compatibility with databases that don't have a
    // native UUID column type (e.g. MySQL, SQLite).
    @JdbcTypeCode(SqlTypes.VARCHAR)
    // columnDefinition = "VARCHAR(36)" pins the exact DDL so Hibernate generates
    // the right column type when it creates or validates the schema.
    @Column(columnDefinition = "VARCHAR(36)")
    private UUID id; // unique identifier for this listing

    // sellerId is a soft foreign key to the users table (managed by the common service).
    // We intentionally do NOT use @ManyToOne here because the User entity lives in a
    // different module. Resolving seller details is done at the service layer instead.
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "seller_id", nullable = false, columnDefinition = "VARCHAR(36)")
    private UUID sellerId; // UUID of the user who created this listing

    // nullable = false means Hibernate will add a NOT NULL constraint to this column.
    @Column(nullable = false)
    private String title; // short, human-readable headline for the listing (e.g. "Hair Braiding")

    // TEXT is used instead of VARCHAR because descriptions can be long (no fixed upper bound).
    @Column(columnDefinition = "TEXT")
    private String description; // detailed explanation of the service or product being offered

    // @Enumerated(EnumType.STRING) persists the enum as its name() string value.
    // EnumType.ORDINAL (the default) would persist the position (0, 1, 2...) which breaks
    // if the enum order ever changes — STRING is always safer.
    @Enumerated(EnumType.STRING)
    @Column(name = "listing_type", nullable = false)
    private ListingType listingType; // category of this listing (e.g. SKILL, FOOD, EVENT)

    // BigDecimal is used for monetary values because it avoids the floating-point precision
    // errors that would occur with double or float (e.g. 0.1 + 0.2 != 0.3 in IEEE 754).
    // precision = 12 allows up to £99,999,999.9999; scale = 4 stores 4 decimal places.
    @Column(nullable = false, precision = 12, scale = 4)
    private BigDecimal price; // listing price in the specified currency

    // @Builder.Default provides a default value when using the Lombok builder pattern.
    // Without it, builder().build() would leave currency as null.
    @Builder.Default
    private String currency = "GBP"; // ISO 4217 currency code, defaults to British Pound

    // Maps to a column named "is_negotiable" rather than "negotiable" to follow the
    // SQL convention of using "is_" prefix for boolean columns.
    @Column(name = "is_negotiable")
    @Builder.Default
    private boolean negotiable = false; // true if the buyer can haggle the price

    // Free-text city name; we do not use a foreign key to a cities table to keep it simple
    // and flexible (sellers can type any city, including "Remote" for online services).
    @Column(name = "location_city")
    private String locationCity; // city where the service is offered, or "Remote"

    // Flexible JSON/string blob for category-specific extras (e.g. cuisine type for FOOD).
    // Stored as TEXT so any amount of metadata can be attached without schema changes.
    @Column(columnDefinition = "TEXT")
    private String meta; // optional extra structured data, stored as a JSON string

    // Media URLs are stored as a comma-separated string rather than a separate join table.
    // This is a pragmatic trade-off: it avoids an extra table and extra queries for a simple
    // list of URLs. The DTO layer splits this back into a List<String> for API consumers.
    @Column(name = "media_urls", columnDefinition = "TEXT")
    private String mediaUrls; // comma-separated list of image/video URLs for this listing

    // The lifecycle status of the listing. Defaults to ACTIVE so new listings are immediately
    // visible. Sellers can PAUSE or mark as SOLD_OUT without permanently removing the record.
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private ListingStatus status = ListingStatus.ACTIVE; // current visibility/availability state

    // @Version enables JPA optimistic locking. Every time the entity is updated,
    // Hibernate automatically increments this number. If two threads load the same entity
    // and both try to save it, the second save will fail because the version they loaded
    // no longer matches the current database value — preventing silent data loss.
    @Version
    @Builder.Default
    private Long version = 0L; // optimistic-lock version counter, managed by Hibernate

    // Timestamps are set in Java rather than relying on database DEFAULT NOW() so that
    // the application controls the timezone (UTC via LocalDateTime on the JVM).
    @Column(name = "created_at")
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now(); // when the listing was first saved

    // updatedAt should be refreshed manually in service code whenever the entity is modified.
    @Column(name = "updated_at")
    @Builder.Default
    private LocalDateTime updatedAt = LocalDateTime.now(); // when the listing was last modified
}
