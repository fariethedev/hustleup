package com.hustleup.marketplace.shop;

import com.hustleup.marketplace.shop.dto.ShopHighlight;
import org.junit.jupiter.api.Test;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

class ShopHighlightTest {
    private ShopHighlight highlight(String url, String type) {
        return new ShopHighlight("new", "New arrivals", List.of(new ShopHighlight.Media(url, type)));
    }
    @Test void acceptsPhotosVideosAndRemovingAllCollections() {
        assertDoesNotThrow(() -> ShopHighlight.validate(List.of()));
        assertDoesNotThrow(() -> ShopHighlight.validate(List.of(highlight("https://cdn.example.com/image.jpg", "image"))));
        assertDoesNotThrow(() -> ShopHighlight.validate(List.of(highlight("/uploads/movie.mp4", "video"))));
    }
    @Test void rejectsUnsafeUrlsAndUnknownMedia() {
        for (String url : List.of("javascript:alert(1)", "data:text/html,hello", "//example.com/image.jpg", "/uploads/../secret", "http://example.com/image.jpg"))
            assertThrows(IllegalArgumentException.class, () -> ShopHighlight.validate(List.of(highlight(url, "image"))));
        assertThrows(IllegalArgumentException.class, () -> ShopHighlight.validate(List.of(highlight("https://cdn.example.com/image.jpg", null))));
    }
    @Test void requiresNamesMediaAndUniqueIds() {
        var h = highlight("/uploads/a.jpg", "image");
        assertThrows(IllegalArgumentException.class, () -> ShopHighlight.validate(List.of(h, h)));
        assertThrows(IllegalArgumentException.class, () -> ShopHighlight.validate(List.of(new ShopHighlight("id", " ", h.items()))));
        assertThrows(IllegalArgumentException.class, () -> ShopHighlight.validate(List.of(new ShopHighlight("id", "Title", List.of()))));
        assertThrows(IllegalArgumentException.class, () -> ShopHighlight.validate(java.util.Collections.nCopies(13, h)));
    }
}
