package com.hustleup.social.dto;

import com.hustleup.social.model.Community;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.function.UnaryOperator;

/** One community as the client sees it, plus whether the caller is in it. */
@Data
@Builder
public class CommunityDto {

    String id;
    String slug;
    String name;
    String description;
    String city;
    String category;
    String imageUrl;
    String creatorId;
    int memberCount;

    /**
     * Whether the caller has joined.
     *
     * <p>Computed per request rather than stored: it drives whether the card offers "Join"
     * or "Joined", and whether the composer will let them post here at all.
     */
    boolean joinedByCurrentUser;

    /** Whether the caller created it — the one member who cannot simply leave. */
    boolean ownedByCurrentUser;

    LocalDateTime createdAt;

    public static CommunityDto from(Community community, boolean joined, boolean owned,
                                    UnaryOperator<String> urlRefresher) {
        return CommunityDto.builder()
                .id(community.getId())
                .slug(community.getSlug())
                .name(community.getName())
                .description(community.getDescription())
                .city(community.getCity())
                .category(community.getCategory())
                // Refreshed like post media: the banner may be an S3 object behind a
                // presigned URL that expires.
                .imageUrl(community.getImageUrl() == null ? null : urlRefresher.apply(community.getImageUrl()))
                .creatorId(community.getCreatorId())
                .memberCount(community.memberCountOrZero())
                .joinedByCurrentUser(joined)
                .ownedByCurrentUser(owned)
                .createdAt(community.getCreatedAt())
                .build();
    }
}
