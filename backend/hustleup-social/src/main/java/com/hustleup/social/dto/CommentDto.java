package com.hustleup.social.dto;

import com.hustleup.social.model.Comment;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * A comment as the feed renders it: the row itself, plus the three things the entity cannot
 * know on its own — whether you liked it, the author's current avatar, and its replies.
 *
 * <h2>Why the endpoint stopped returning entities directly</h2>
 * <p>{@code GET /{postId}/comments} used to hand back {@code List<Comment>} straight from
 * the repository. That was flat: replies carried a {@code parentId} nobody assembled, so a
 * reply rendered as a top-level comment and the thread read as though everyone was talking
 * past each other. It also had no like state and no avatar, so the client could not draw a
 * filled heart or a face without a request per comment.
 *
 * <h2>Two levels, not arbitrary depth</h2>
 * <p>Replies nest one level: a reply to a reply is attached to the same top-level comment
 * rather than indenting further. Unbounded nesting turns into a staircase that runs out of
 * horizontal room on a phone by the third level, and the conversations here are short.
 */
@Data
@Builder
public class CommentDto {

    String id;
    String postId;
    String authorId;
    String authorName;

    /** Fetched from the user table during assembly — not stored on the comment row. */
    String authorAvatarUrl;

    String content;

    /** The comment this replies to, or null for a top-level comment. */
    String parentId;

    Integer likesCount;

    /** Computed per-viewer; false for anonymous callers. */
    boolean likedByCurrentUser;

    LocalDateTime createdAt;

    /**
     * Replies to this comment, oldest first. Always present on a top-level comment (possibly
     * empty) and always empty on a reply, so the client can render without null checks.
     */
    @Builder.Default
    List<CommentDto> replies = new ArrayList<>();

    /**
     * Converts one row. Callers supply the per-viewer and cross-table parts, because a DTO
     * that fetched them itself would be one query per comment.
     */
    public static CommentDto from(Comment c, boolean likedByCurrentUser, String authorAvatarUrl) {
        return CommentDto.builder()
                .id(c.getId())
                .postId(c.getPostId())
                .authorId(c.getAuthorId())
                .authorName(c.getAuthorName())
                .authorAvatarUrl(authorAvatarUrl)
                .content(c.getContent())
                .parentId(c.getParentId())
                .likesCount(c.getLikesCount())
                .likedByCurrentUser(likedByCurrentUser)
                .createdAt(c.getCreatedAt())
                .replies(new ArrayList<>())
                .build();
    }
}
