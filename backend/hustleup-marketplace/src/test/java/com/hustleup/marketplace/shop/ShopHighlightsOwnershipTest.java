package com.hustleup.marketplace.shop;

import com.hustleup.common.model.User;
import com.hustleup.common.repository.UserRepository;
import com.hustleup.common.storage.FileStorageService;
import com.hustleup.marketplace.shop.controller.ShopController;
import com.hustleup.marketplace.shop.dto.*;
import com.hustleup.marketplace.shop.model.Shop;
import com.hustleup.marketplace.shop.repository.*;
import com.hustleup.marketplace.shop.service.ShopService;
import org.junit.jupiter.api.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.server.ResponseStatusException;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;

class ShopHighlightsOwnershipTest {
    final ShopRepository shops = mock(ShopRepository.class);
    final UserRepository users = mock(UserRepository.class);
    final ShopService service = mock(ShopService.class);
    final ShopController controller = new ShopController(shops, mock(ShopProductRepository.class), service, users, mock(FileStorageService.class));
    final UUID owner = UUID.randomUUID();
    final Shop shop = Shop.builder().id(UUID.randomUUID()).ownerId(owner).published(false).build();
    @BeforeEach void setup() {
        when(shops.findBySlug("test")).thenReturn(Optional.of(shop));
        when(users.findByEmail("owner@example.test")).thenReturn(Optional.of(User.builder().id(owner).build()));
        when(shops.save(shop)).thenReturn(shop);
        when(service.detail(shop)).thenAnswer(inv -> ShopDto.from(shop));
    }
    @AfterEach void cleanup() { SecurityContextHolder.clearContext(); }
    void login(String email) { SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(email, null, List.of())); }
    ShopRequest request() {
        var r = new ShopRequest();
        r.setHighlights(List.of(new ShopHighlight("id", "Offers", List.of(new ShopHighlight.Media("/uploads/a.jpg", "image")))));
        return r;
    }
    @Test void onlyOwnerCanWriteHighlights() {
        assertThrows(AccessDeniedException.class, () -> controller.update("test", request()));
        when(users.findByEmail("other@example.test")).thenReturn(Optional.of(User.builder().id(UUID.randomUUID()).build()));
        login("other@example.test");
        assertThrows(AccessDeniedException.class, () -> controller.update("test", request()));
        verify(shops, never()).save(any());
        login("owner@example.test");
        assertEquals("Offers", controller.update("test", request()).getBody().getHighlights().getFirst().title());
    }
    @Test void unpublishedShopHighlightsStayPrivate() {
        assertThrows(ResponseStatusException.class, () -> controller.getOne("test"));
        login("owner@example.test");
        assertEquals(200, controller.getOne("test").getStatusCode().value());
    }
    @Test void invalidCollectionCannotBeSaved() {
        login("owner@example.test");
        var invalid = request(); invalid.setHighlights(List.of(new ShopHighlight("id", "", List.of())));
        assertThrows(ResponseStatusException.class, () -> controller.update("test", invalid));
        verify(shops, never()).save(any());
    }
}
