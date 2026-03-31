package com.hustleup.social.dto;

import com.hustleup.social.model.Story;
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
    private Integer viewsCount;
    private boolean likedByCurrentUser;
    private boolean viewedByCurrentUser;

    public static StoryDto from(Story story, boolean likedByCurrentUser, boolean viewedByCurrentUser) {
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
                .viewsCount(story.getViewsCount() == null ? 0 : story.getViewsCount())
                .likedByCurrentUser(likedByCurrentUser)
                .viewedByCurrentUser(viewedByCurrentUser)
                .build();
    }
}
