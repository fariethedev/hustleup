package com.hustleup.social.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.Objects;

/**
 * One person's like on one comment.
 *
 * <p>Deliberately shaped exactly like {@link PostLike}: a composite {@code (comment_id,
 * user_id)} primary key rather than a surrogate id with a unique constraint bolted on. The
 * key <em>is</em> the fact being recorded, so liking twice is impossible at the database
 * level instead of depending on a check-then-insert that two concurrent taps can both pass.
 *
 * <p>Keeping the two shapes identical is not tidiness for its own sake — the batch
 * "which of these did I like?" query, the delete-on-parent-removal, and the counter
 * handling all read the same way, so anyone who has understood post likes already
 * understands these.
 */
@Entity
@Table(name = "comment_likes")
public class CommentLike {

    @EmbeddedId
    private CommentLikeId id;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    public CommentLike() {}

    public CommentLike(CommentLikeId id) {
        this.id = id;
    }

    public CommentLikeId getId() { return id; }
    public void setId(CommentLikeId id) { this.id = id; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    /**
     * The composite key. {@code Serializable} plus a real {@code equals}/{@code hashCode}
     * are both required by JPA — without them Hibernate cannot use the key to look an entity
     * up in the persistence context, and unliking silently fails to find the row.
     */
    @Embeddable
    public static class CommentLikeId implements Serializable {

        @Column(name = "comment_id", columnDefinition = "VARCHAR(36)")
        private String commentId;

        @Column(name = "user_id", columnDefinition = "VARCHAR(36)")
        private String userId;

        public CommentLikeId() {}

        public CommentLikeId(String commentId, String userId) {
            this.commentId = commentId;
            this.userId = userId;
        }

        public String getCommentId() { return commentId; }
        public void setCommentId(String commentId) { this.commentId = commentId; }

        public String getUserId() { return userId; }
        public void setUserId(String userId) { this.userId = userId; }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (!(o instanceof CommentLikeId other)) return false;
            return Objects.equals(commentId, other.commentId) && Objects.equals(userId, other.userId);
        }

        @Override
        public int hashCode() {
            return Objects.hash(commentId, userId);
        }
    }
}
