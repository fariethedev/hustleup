/**
 * JPA entity for a seller's storefront.
 *
 * <p>A {@code Shop} is the branded container a seller presents to buyers: the card shown on
 * Explore and the page behind it. Every field a visitor sees — name, category, tagline,
 * description, banner, accent colour, city — is owned and edited by the seller from their
 * dashboard. Nothing about a shop is platform-authored.
 *
 * <h3>One shop per seller</h3>
 * <p>{@link #ownerId} carries a unique constraint. A seller has exactly one storefront, which
 * keeps the model aligned with the existing {@code User.shopBannerUrl}/{@code shopCategory}
 * fields and means "my shop" is always unambiguous in the dashboard.
 *
 * <h3>Why {@code ownerId} is not a {@code @ManyToOne}</h3>
 * <p>Same reasoning as {@link com.hustleup.marketplace.listing.model.Listing#getSellerId()}:
 * the {@code User} entity is owned by another service, so this module stores a soft foreign
 * key and resolves owner details at the service layer instead of coupling schemas.
 */
package com.hustleup.marketplace.shop.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(
    name = "shops",
    uniqueConstraints = {
        // One storefront per seller, and slugs must be unique because they appear in URLs.
        @UniqueConstraint(name = "uk_shops_owner", columnNames = "owner_id"),
        @UniqueConstraint(name = "uk_shops_slug", columnNames = "slug"),
    }
)
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Shop {

    @Id
    @org.hibernate.annotations.UuidGenerator
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(columnDefinition = "VARCHAR(36)")
    private UUID id;

    /** Soft foreign key to the users table. The only account allowed to edit this shop. */
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "owner_id", nullable = false, columnDefinition = "VARCHAR(36)")
    private UUID ownerId;

    /**
     * URL-safe identifier derived from the name (e.g. "Oja Market" → "oja-market").
     *
     * <p>Shops are reachable at {@code /shop/{slug}} as well as by UUID, which keeps links
     * readable and survives the seller renaming their shop — the slug is generated once at
     * creation and then left alone.
     */
    @Column(nullable = false, length = 80)
    private String slug;

    @Column(nullable = false, length = 80)
    private String name;

    /** Free text rather than an enum: sellers name their own niche. */
    @Column(length = 60)
    private String category;

    /** One-line hook shown on the shop card. */
    @Column(length = 160)
    private String tagline;

    @Column(length = 2000)
    private String description;

    /** Cover image for the card and the detail page banner. */
    @Column(name = "banner_url", length = 512)
    private String bannerUrl;

    /** Hex colour (e.g. "#CDFF00") used for the card's glow and product tint. */
    @Column(name = "accent_color", length = 9)
    private String accentColor;

    /** Polish city the shop trades from — drives the city filters on Explore. */
    @Column(length = 80)
    private String city;

    /**
     * Whether the shop appears in public browse results. Lets a seller take their storefront
     * down for a rework without deleting it and losing their products.
     */
    @Column(nullable = false)
    @Builder.Default
    private boolean published = true;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    /** Guards against lost updates when the dashboard saves twice in quick succession. */
    @Version
    private Long version;

    @PrePersist
    void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = createdAt;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
