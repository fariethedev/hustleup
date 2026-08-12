/**
 * JPA entity representing a "save"/bookmark on a feed post.
 *
 * <p>Mirrors {@link PostLike}'s composite-key design exactly (same rationale: the
 * natural key of ({@code post_id}, {@code user_id}) both prevents duplicate saves at
 * the database level and avoids a redundant surrogate ID + unique constraint).
 *
 * <h2>Table: {@code saved_posts}</h2>
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

@Entity
@Table(name = "saved_posts")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SavedPost {

    @EmbeddedId
    private SavedPostId id;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Embeddable
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SavedPostId implements Serializable {

        @Column(name = "post_id")
        private String postId;

        @Column(name = "user_id")
        private String userId;
    }
}
