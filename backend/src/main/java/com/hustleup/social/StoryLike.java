package com.hustleup.social;

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
@Table(name = "story_likes")
@Data
public class StoryLike {
    @EmbeddedId
    private StoryLikeId id;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Embeddable
    @Data
    public static class StoryLikeId implements Serializable {
        @Column(name = "story_id")
        private String storyId;

        @Column(name = "user_id")
        private String userId;
    }
}
