package com.hustleup.social.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import java.io.Serializable;
import java.time.LocalDateTime;

@Entity
@Table(name = "story_views",
    uniqueConstraints = @UniqueConstraint(columnNames = {"story_id", "user_id"}))
public class StoryView {
    @EmbeddedId
    private StoryViewId id;

    @CreationTimestamp
    @Column(name = "viewed_at", updatable = false)
    private LocalDateTime viewedAt;

    public StoryView() {}

    public StoryViewId getId() { return id; }
    public void setId(StoryViewId id) { this.id = id; }

    public LocalDateTime getViewedAt() { return viewedAt; }
    public void setViewedAt(LocalDateTime viewedAt) { this.viewedAt = viewedAt; }

    @Embeddable
    public static class StoryViewId implements Serializable {
        @Column(name = "story_id", columnDefinition = "VARCHAR(36)")
        private String storyId;

        @Column(name = "user_id", columnDefinition = "VARCHAR(36)")
        private String userId;

        public StoryViewId() {}
        public StoryViewId(String storyId, String userId) {
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
            StoryViewId that = (StoryViewId) o;
            return java.util.Objects.equals(storyId, that.storyId) && 
                   java.util.Objects.equals(userId, that.userId);
        }

        @Override
        public int hashCode() {
            return java.util.Objects.hash(storyId, userId);
        }
    }
}
