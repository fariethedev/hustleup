package com.hustleup.marketplace.shop.service;

import com.hustleup.marketplace.shop.model.ShopOrder;
import com.hustleup.marketplace.shop.model.ShopProduct;
import com.hustleup.marketplace.shop.repository.ShopOrderRepository;
import com.hustleup.marketplace.shop.repository.ShopProductRepository;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import java.util.Optional;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ShopInventoryServiceTest {
    private final ShopProductRepository products = mock(ShopProductRepository.class);
    private final ShopOrderRepository orders = mock(ShopOrderRepository.class);
    private final ShopInventoryService inventory = new ShopInventoryService(products, orders);

    @Test void checkoutCannotSellMoreThanAvailable() {
        ShopProduct product = ShopProduct.builder().name("Apples").stockQuantity(2).build();
        assertThrows(ResponseStatusException.class, () -> inventory.reserve(product, 3));
        assertEquals(2, product.getStockQuantity());
        verifyNoInteractions(products);
    }

    @Test void lastUnitsBecomeUnavailable() {
        ShopProduct product = ShopProduct.builder().name("Apples").stockQuantity(2).build();
        assertTrue(inventory.reserve(product, 2));
        assertEquals(0, product.getStockQuantity());
        assertThrows(ResponseStatusException.class, () -> inventory.reserve(product, 1));
    }

    @Test void existingUntrackedProductsRemainPurchasable() {
        ShopProduct product = ShopProduct.builder().name("Untracked").build();
        assertFalse(inventory.reserve(product, 3));
        assertNull(product.getStockQuantity());
        verifyNoInteractions(products);
    }

    @Test void repeatedExpiredWebhookRestoresStockOnlyOnce() {
        UUID orderId = UUID.randomUUID();
        UUID productId = UUID.randomUUID();
        ShopProduct product = ShopProduct.builder().id(productId).stockQuantity(2).build();
        ShopOrder order = ShopOrder.builder().id(orderId).productId(productId).quantity(3).stockReserved(true).build();
        when(orders.findLockedById(orderId)).thenReturn(Optional.of(order));
        when(products.findLockedById(productId)).thenReturn(Optional.of(product));
        inventory.releaseUnpaid(orderId);
        inventory.releaseUnpaid(orderId);
        assertEquals(5, product.getStockQuantity());
        assertFalse(order.isStockReserved());
        assertEquals(ShopOrder.ShopOrderStatus.CANCELLED, order.getStatus());
        verify(products, times(1)).save(product);
    }

    @Test void lateExpiryDoesNotRestockPaidOrders() {
        UUID id = UUID.randomUUID();
        ShopOrder order = ShopOrder.builder().id(id).stockReserved(true).status(ShopOrder.ShopOrderStatus.PAID).build();
        when(orders.findLockedById(id)).thenReturn(Optional.of(order));
        inventory.releaseUnpaid(id);
        assertTrue(order.isStockReserved());
        verifyNoInteractions(products);
        verify(orders, never()).save(any());
    }
}
