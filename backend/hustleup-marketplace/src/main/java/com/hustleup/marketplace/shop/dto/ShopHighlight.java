package com.hustleup.marketplace.shop.dto;

import java.net.URI;
import java.util.List;

public record ShopHighlight(String id, String title, List<Media> items) {
    public record Media(String url, String type) {}

    public static void validate(List<ShopHighlight> highlights) {
        if (highlights.size() > 12) throw new IllegalArgumentException("Maximum 12 highlight collections");
        var ids = new java.util.HashSet<String>();
        for (var highlight : highlights) {
            if (highlight == null || highlight.id() == null || highlight.id().isBlank() || highlight.id().length() > 80 || !ids.add(highlight.id())
                    || highlight.title() == null || highlight.title().isBlank() || highlight.title().length() > 40
                    || highlight.items() == null || highlight.items().isEmpty() || highlight.items().size() > 20)
                throw new IllegalArgumentException("Each highlight needs a unique ID, a title (1–40 characters), and 1–20 photos or videos");
            for (var media : highlight.items()) {
                if (media == null || !("image".equals(media.type()) || "video".equals(media.type())) || media.url() == null || media.url().length() > 4096)
                    throw new IllegalArgumentException("Invalid highlight media");
                URI uri;
                try { uri = URI.create(media.url()); } catch (IllegalArgumentException invalid) { throw new IllegalArgumentException("Invalid media URL"); }
                boolean https = "https".equals(uri.getScheme()) && uri.getHost() != null && uri.getUserInfo() == null;
                boolean upload = media.url().startsWith("/uploads/") && !media.url().contains("..") && !media.url().contains("\\");
                if (!https && !upload) throw new IllegalArgumentException("Media must use an uploaded file or HTTPS URL");
            }
        }
    }
}
