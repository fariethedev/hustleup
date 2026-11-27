package com.hustleup.marketplace.shop;

import com.hustleup.marketplace.shop.controller.ShopOrderController;
import com.hustleup.marketplace.shop.model.ShopOrder;
import com.hustleup.marketplace.shop.repository.ShopOrderRepository;
import com.hustleup.common.model.User;
import com.hustleup.common.repository.UserRepository;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ShopOrderStatusSecurityTest {
    @Mock UserRepository users;
    @Mock ShopOrderRepository orders;
    @InjectMocks ShopOrderController controller;
    @AfterEach void clear() { SecurityContextHolder.clearContext(); }
    @Test void sellerCannotForgePaymentRefundOrCancellationToBypassLimits() {
        UUID seller = UUID.randomUUID(), id = UUID.randomUUID();
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("seller", ""));
        when(users.findByEmail("seller")).thenReturn(Optional.of(User.builder().id(seller).build()));
        var order = ShopOrder.builder().id(id).sellerId(seller).build();
        when(orders.findById(id)).thenReturn(Optional.of(order));
        for (String status : List.of("PAID", "FULFILLED", "CANCELLED", "REFUNDED")) {
            assertEquals(409, controller.updateOrder(id, Map.of("status", status)).getStatusCode().value());
            assertEquals(ShopOrder.ShopOrderStatus.AWAITING_PAYMENT, order.getStatus());
        }
        verify(orders, never()).save(any());
    }
}
