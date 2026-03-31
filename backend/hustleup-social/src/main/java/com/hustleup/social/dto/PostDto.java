package com.hustleup.social.dto;

import com.hustleup.social.model.Post;
import lombok.Builder;
import lombok.Value;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

@Value
@Builder
public class PostDto {
    String id;
    String authorId;
    String authorName;
    String content;
    String imageUrl;
    List<PostMediaDto> media;
    String linkedListingId;
    Integer likesCount;
    Integer commentsCount;
    boolean likedByCurrentUser;
    LocalDateTime createdAt;

    public static PostDto from(Post post, boolean likedByCurrentUser) {
        List<PostMediaDto> media = parseMedia(post);

        return PostDto.builder()
                .id(post.getId())
                .authorId(post.getAuthorId())
                .authorName(post.getAuthorName())
                .content(post.getContent())
                .imageUrl(resolvePrimaryImageUrl(post, media))
                .media(media)
                .linkedListingId(post.getLinkedListingId())
                .likesCount(post.getLikesCount() == null ? 0 : post.getLikesCount())
                .commentsCount(post.getCommentsCount() == null ? 0 : post.getCommentsCount())
                .likedByCurrentUser(likedByCurrentUser)
                .createdAt(post.getCreatedAt())
                .build();
    }

    private static List<PostMediaDto> parseMedia(Post post) {
        List<String> urls = splitCsv(post.getMediaUrls());
        List<String> types = splitCsv(post.getMediaTypes());
        List<PostMediaDto> media = new ArrayList<>();

        for (int i = 0; i < urls.size(); i++) {
            String type = i < types.size() ? types.get(i) : inferMediaType(urls.get(i));
            media.add(new PostMediaDto(urls.get(i), type));
        }

        if (media.isEmpty() && post.getImageUrl() != null && !post.getImageUrl().isBlank()) {
            media.add(new PostMediaDto(post.getImageUrl(), "IMAGE"));
        }

        return media;
    }

    private static String resolvePrimaryImageUrl(Post post, List<PostMediaDto> media) {
        if (post.getImageUrl() != null && !post.getImageUrl().isBlank()) {
            return post.getImageUrl();
        }

        return media.stream()
                .filter(item -> "IMAGE".equals(item.getType()))
                .map(PostMediaDto::getUrl)
                .findFirst()
                .orElse(null);
    }

    private static List<String> splitCsv(String value) {
        if (value == null || value.isBlank()) {
            return List.of();
        }

        return Arrays.stream(value.split(","))
                .map(String::trim)
                .filter(entry -> !entry.isBlank())
                .toList();
    }

    private static String inferMediaType(String url) {
        String lower = url == null ? "" : url.toLowerCase();
        return lower.matches(".*\\.(mp4|mov|webm|ogg|m4v)(\\?.*)?$") ? "VIDEO" : "IMAGE";
    }

    @Value
    public static class PostMediaDto {
        String url;
        String type;
    }
}
