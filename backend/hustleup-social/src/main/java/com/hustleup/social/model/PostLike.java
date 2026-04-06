/**
 * JPA entity representing a "like" on a feed post.
 *
 * <p>Each row in {@code post_likes} means "user X liked post Y".
 *
 * <h2>Composite primary key ({@code @EmbeddedId})</h2>
 * Rather than adding a meaningless surrogate integer ID, we use the natural composite
 * key of ({@code post_id}, {@code user_id}).  This has two benefits:
 * <ol>
 *   <li>It inherently prevents duplicate likes at the database level.</li>
 *   <li>It avoids a separate UNIQUE constraint and saves one index.</li>
 * </ol>
 *
 * <p>The composite key is modelled as a nested static class {@link PostLikeId} annotated
 * with {@code @Embeddable}.  The outer entity embeds it with {@code @EmbeddedId}.
 *
 * <h2>Table: {@code post_likes}</h2>
 *
 * <h2>Lombok annotations used</h2>
 * <ul>
 *   <li>{@code @Data} — generates getters, setters, equals, hashCode, toString</li>
 *   <li>{@code @Builder} — enables the builder pattern: {@code PostLike.builder().id(likeId).build()}</li>
 *   <li>{@code @NoArgsConstructor} — no-arg constructor required by JPA</li>
 *   <li>{@code @AllArgsConstructor} — all-args constructor required by {@code @Builder}</li>
 * </ul>
 */
package com.hustleup.social.model;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.io.Serializable;
import java.time.LocalDateTime;

// @Entity: marks this class as a JPA entity mapped to a table.
@Entity

// Explicit table name; the default derivation would produce "post_like".
@Table(name = "post_likes")

// @Data: Lombok generates getters, setters, equals, hashCode, toString automatically.
@Data

// @Builder: enables fluent construction — PostLike.builder().id(likeId).build()
@Builder

// @NoArgsConstructor: JPA requires a public or protected no-arg constructor to
// instantiate entities via reflection.
@NoArgsConstructor

// @AllArgsConstructor: required alongside @Builder when all fields are final or
// need to be set at construction time.
@AllArgsConstructor
public class PostLike {

    /**
     * The composite primary key embedding both {@code post_id} and {@code user_id}.
     *
     * <p>{@code @EmbeddedId} tells JPA that the primary key is not a single column
     * but is instead defined by the {@link PostLikeId} embeddable class below.
     * Spring Data's {@code existsById(PostLikeId)} uses this to check for duplicates.
     */
    @EmbeddedId
    private PostLikeId id;

    /**
     * Timestamp of when the like was recorded.
     *
     * <p>Automatically set by Hibernate; {@code updatable = false} ensures it is
     * written once and never modified.  Useful for "liked X minutes ago" displays.
     */
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    /**
     * Composite primary key for the {@link PostLike} entity.
     *
     * <p>{@code @Embeddable} tells JPA that this class's fields should be "embedded"
     * (inlined) into the owning entity's table rather than mapped to a separate table.
     *
     * <p>Must implement {@link Serializable} — a JPA spec requirement for all embedded
     * ID classes, needed for Hibernate's second-level cache and serialisation.
     */
    @Embeddable
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PostLikeId implements Serializable {

        /**
         * The UUID string of the post that was liked.
         * Combined with {@link #userId} this uniquely identifies one like record.
         */
        @Column(name = "post_id")
        private String postId;

        /**
         * The UUID string of the user who liked the post.
         * Combined with {@link #postId} this forms the composite key.
         */
        @Column(name = "user_id")
        private String userId;
    }
}
