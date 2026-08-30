package com.hustleup.social.model;

import jakarta.persistence.*;
import lombok.*;

import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * One person's membership of one {@link Community}.
 *
 * <p>The primary key is the (community, member) pair rather than a generated id, which is
 * what makes joining idempotent at the database level: a double-tapped Join button writes
 * the same row twice instead of creating two memberships and inflating the member count.
 * {@link PostLike} uses the same composite-key pattern for the same reason.
 */
@Entity
@Table(name = "community_members", indexes = {
        @Index(name = "idx_community_members_member", columnList = "member_id")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class CommunityMember {

    /** Composite key: a member belongs to a community at most once. */
    @Embeddable
    @Getter @Setter @NoArgsConstructor @AllArgsConstructor
    public static class Id implements Serializable {

        @Column(name = "community_id", nullable = false, columnDefinition = "VARCHAR(36)")
        private String communityId;

        @Column(name = "member_id", nullable = false, columnDefinition = "VARCHAR(36)")
        private String memberId;

        @Override
        public boolean equals(Object other) {
            if (this == other) return true;
            if (!(other instanceof Id that)) return false;
            return java.util.Objects.equals(communityId, that.communityId)
                    && java.util.Objects.equals(memberId, that.memberId);
        }

        @Override
        public int hashCode() {
            return java.util.Objects.hash(communityId, memberId);
        }
    }

    @EmbeddedId
    private Id id;

    /**
     * {@code OWNER} for whoever created it, {@code MEMBER} for everyone else.
     *
     * <p>Stored as a String rather than an enum so a moderator tier can be added later
     * without a schema change — the same reasoning as {@code Notification.notificationType}.
     */
    @Column(nullable = false, length = 16)
    @Builder.Default
    private String role = "MEMBER";

    @Column(name = "joined_at", nullable = false)
    @Builder.Default
    private LocalDateTime joinedAt = LocalDateTime.now();
}
