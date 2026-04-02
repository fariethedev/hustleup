package com.hustleup.social.model;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import java.io.Serializable;
import java.time.LocalDateTime;

@Entity
@Table(name = "story_likes")
public class StoryLike {
    @EmbeddedId
    private StoryLikeId id;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    public StoryLike() {}

    public StoryLikeId getId() { return id; }
    public void setId(StoryLikeId id) { this.id = id; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    @Embeddable
    public static class StoryLikeId implements Serializable {
        @Column(name = "story_id", columnDefinition = "VARCHAR(36)")
        private String storyId;

        @Column(name = "user_id", columnDefinition = "VARCHAR(36)")
        private String userId;

        public StoryLikeId() {}
        public StoryLikeId(String storyId, String userId) {
            this.storyId = storyId;
            this.userId = userId;
        }

        public String getStoryId() { return storyId; }
        public void setStoryId(String storyId) { this.storyId = storyId; }

        public String getUserId() { return userId; }
        public void setUserId(String userId) { this.userId = userId; }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (o == null || getClass() != o.getClass()) return false;
            StoryLikeId that = (StoryLikeId) o;
            return java.util.Objects.equals(storyId, that.storyId) && 
                   java.util.Objects.equals(userId, that.userId);
        }

        @Override
        public int hashCode() {
            return java.util.Objects.hash(storyId, userId);
        }
    }
}
