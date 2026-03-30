package com.hustleup.socialservice.social;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "stories")
@Data
public class Story {
    @Id
    private String id;
    @Column(name = "author_id", nullable = false)
    private String authorId;
    @Column(name = "author_name", nullable = false)
    private String authorName;
    @Column(columnDefinition = "TEXT")
    private String content;
    @Column(name = "media_url")
    private String mediaUrl;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private StoryType type;
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    public enum StoryType {
        VIDEO, IMAGE, TEXT
    }
}
