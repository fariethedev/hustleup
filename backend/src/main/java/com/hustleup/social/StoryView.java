package com.hustleup.social;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;

import java.io.Serializable;
import java.time.LocalDateTime;

@Entity
@Table(name = "story_views")
@Data
public class StoryView {
    @EmbeddedId
    private StoryViewId id;

    @CreationTimestamp
    @Column(name = "viewed_at", updatable = false)
    private LocalDateTime viewedAt;

    @Embeddable
    @Data
    public static class StoryViewId implements Serializable {
        @Column(name = "story_id")
        private String storyId;

        @Column(name = "user_id")
        private String userId;
    }
}
