package com.hustleup.social.model;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;

import java.io.Serializable;
import java.time.LocalDateTime;

@Entity
@Table(name = "post_likes")
@Data
public class PostLike {
    @EmbeddedId
    private PostLikeId id;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Embeddable
    @Data
    public static class PostLikeId implements Serializable {
        @Column(name = "post_id")
        private String postId;

        @Column(name = "user_id")
        private String userId;
    }
}
