package com.hustleup.social.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * A member-created group with its own feed — "Cars in Lublin", "Warsaw street food".
 *
 * <h2>Why this is not a hashtag or a category</h2>
 * <p>A tag is a label anyone can staple to anything; nobody owns it, nobody joins it, and
 * a feed built from one is whatever the loudest poster decided it is. A community has a
 * membership ({@link CommunityMember}) and a creator who answers for it, which is what
 * makes "only posts about cars" enforceable by the people who care about cars rather than
 * by a keyword match.
 *
 * <h2>Why posts point at communities and not the reverse</h2>
 * <p>{@code Post.communityId} carries the relationship. The community feed is then one
 * indexed query over posts, and a post can be written, edited, liked and deleted without
 * the community row ever being touched — the same reason {@code authorId} is a plain id
 * here rather than a JPA association.
 */
@Entity
@Table(name = "communities", indexes = {
        @Index(name = "idx_communities_slug", columnList = "slug", unique = true),
        @Index(name = "idx_communities_city", columnList = "city")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Community {

    @Id
    @Column(columnDefinition = "VARCHAR(36)")
    private String id;

    /** UUID string of the member who created it; they are its first OWNER. */
    @Column(name = "creator_id", nullable = false, columnDefinition = "VARCHAR(36)")
    private String creatorId;

    @Column(nullable = false, length = 80)
    private String name;

    /**
     * URL-safe name, unique across the platform.
     *
     * <p>Communities are addressable by slug so a link to one reads as
     * {@code /communities/cars-in-lublin} rather than a UUID — the same treatment shops get.
     */
    @Column(nullable = false, unique = true, length = 100)
    private String slug;

    /** What belongs here and what does not — the rule members are joining up to. */
    @Column(columnDefinition = "TEXT")
    private String description;

    /**
     * Where this community is anchored, if anywhere.
     *
     * <p>Optional because plenty of communities are about a subject rather than a place,
     * but named explicitly because most of the ones people actually create here are local
     * ("Cars in Lublin"), and a blank city would drop those out of every city view.
     */
    @Column(length = 80)
    private String city;

    /** Free-text topic, e.g. "Cars" — what the community is about in one word. */
    @Column(length = 60)
    private String category;

    /** Banner shown on the community's own page and its card in the browse list. */
    @Column(name = "image_url", length = 512)
    private String imageUrl;

    /**
     * Denormalised member count.
     *
     * <p>Kept on the row for the same reason {@code Post.likesCount} is: every card in the
     * browse list shows it, and counting the membership table per card turns one listing
     * into one query per community.
     */
    @Column(name = "member_count", nullable = false)
    @Builder.Default
    private Integer memberCount = 0;

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    /** Null-safe read, for rows written before the counter existed. */
    public int memberCountOrZero() {
        return memberCount == null ? 0 : memberCount;
    }
}
