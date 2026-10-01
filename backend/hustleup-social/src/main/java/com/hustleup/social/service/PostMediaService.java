package com.hustleup.social.service;

import com.hustleup.common.storage.FileStorageService;
import com.hustleup.social.dto.PostDto;
import com.hustleup.social.model.Post;
import com.hustleup.social.repository.PostRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PostMediaService {
    // Same ceiling as FileStorageService and this service's multipart configuration.
    private static final long MAX_IMAGE_BYTES = 500L * 1024 * 1024;
    private static final Map<String, Set<String>> IMAGE_TYPES = Map.of(
            "image/jpeg", Set.of("jpg", "jpeg"),
            "image/png", Set.of("png"),
            "image/gif", Set.of("gif"),
            "image/webp", Set.of("webp"),
            "image/avif", Set.of("avif"),
            "image/heic", Set.of("heic"),
            "image/heif", Set.of("heif"),
            "image/bmp", Set.of("bmp"),
            "image/x-ms-bmp", Set.of("bmp"));

    private final PostRepository postRepository;
    private final FileStorageService storageService;

    @Transactional
    public Post replaceImage(String postId, String authorId, int mediaIndex, List<MultipartFile> files) {
        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Post not found"));
        if (!authorId.equals(post.getAuthorId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only edit your own posts");
        }

        // Reuse the DTO's parsing so indexes and legacy image-only rows match what the
        // client sees. The identity URL refresher keeps raw storage URLs intact.
        List<PostDto.PostMediaDto> media = PostDto.from(post, false).getMedia();
        if (mediaIndex < 0 || mediaIndex >= media.size()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Media index is out of range");
        }
        if (!"IMAGE".equals(media.get(mediaIndex).getType())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only existing photos can be replaced");
        }
        MultipartFile file = validateImage(files);
        String replacementUrl = storageService.storePublicMedia(file);
        media.set(mediaIndex, new PostDto.PostMediaDto(replacementUrl, "IMAGE"));
        String urls = media.stream().map(PostDto.PostMediaDto::getUrl).collect(Collectors.joining(","));
        String types = media.stream().map(PostDto.PostMediaDto::getType).collect(Collectors.joining(","));
        String primaryImage = media.stream().filter(item -> "IMAGE".equals(item.getType()))
                .map(PostDto.PostMediaDto::getUrl).findFirst().orElse(null);

        int changed = postRepository.replaceMediaIfUnchanged(postId, authorId, post.getMediaUrls(),
                post.getMediaTypes(), post.getImageUrl(), urls, types, primaryImage, LocalDateTime.now());
        if (changed != 1) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Post media changed during upload. Reload the post and try again");
        }

        // Storage exposes neither deletion nor cross-service reference tracking. Retain
        // old files (and uploads on failure) until safe orphan cleanup is available.
        return postRepository.findById(postId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Post not found"));
    }

    private MultipartFile validateImage(List<MultipartFile> files) {
        if (files == null || files.size() != 1 || files.get(0) == null || files.get(0).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Upload exactly one non-empty media image");
        }
        MultipartFile file = files.get(0);
        if (file.getSize() > MAX_IMAGE_BYTES) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "The maximum image size is 500MB");
        }
        String contentType = file.getContentType();
        String filename = file.getOriginalFilename();
        int dot = filename == null ? -1 : filename.lastIndexOf('.');
        String extension = dot < 0 ? "" : filename.substring(dot + 1).toLowerCase(Locale.ROOT);
        Set<String> extensions = contentType == null ? null : IMAGE_TYPES.get(contentType.toLowerCase(Locale.ROOT));
        if (extensions == null || !extensions.contains(extension)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Upload a raster image with a matching image content type and filename extension");
        }
        return file;
    }
}
