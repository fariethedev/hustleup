package com.hustleup.social;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class StoryDto {
    private String id;
    private String authorId;
    private String authorName;
    private String content;
    private String mediaUrl;
    private Story.StoryType type;
    private LocalDateTime createdAt;
    private LocalDateTime expiresAt;
    private Integer likesCount;
    private boolean likedByCurrentUser;

    public static StoryDto from(Story story, boolean likedByCurrentUser) {
        return StoryDto.builder()
                .id(story.getId())
                .authorId(story.getAuthorId())
                .authorName(story.getAuthorName())
                .content(story.getContent())
                .mediaUrl(story.getMediaUrl())
                .type(story.getType())
                .createdAt(story.getCreatedAt())
                .expiresAt(story.getExpiresAt())
                .likesCount(story.getLikesCount() == null ? 0 : story.getLikesCount())
                .likedByCurrentUser(likedByCurrentUser)
                .build();
    }
}
