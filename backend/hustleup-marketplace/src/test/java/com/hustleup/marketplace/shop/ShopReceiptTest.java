package com.hustleup.marketplace.shop;

import com.hustleup.common.model.User;
import com.hustleup.common.repository.UserRepository;
import com.hustleup.marketplace.shop.controller.ShopOrderController;
import com.hustleup.marketplace.shop.model.ShopOrder;
import com.hustleup.marketplace.shop.repository.ShopOrderRepository;
import com.hustleup.marketplace.protection.service.ProtectionClaimService;
import com.hustleup.marketplace.protection.model.ProtectionClaim.ClaimOrderType;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ShopReceiptTest {
    @Mock UserRepository users;
    @Mock ShopOrderRepository orders;
    @Mock ProtectionClaimService claims;
    @InjectMocks ShopOrderController controller;
    UUID buyer = UUID.randomUUID(), orderId = UUID.randomUUID();
    @BeforeEach void authenticate() {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("buyer", ""));
        when(users.findByEmail("buyer")).thenReturn(Optional.of(User.builder().id(buyer).build()));
    }
    @AfterEach void clear() { SecurityContextHolder.clearContext(); }
    @Test void unpaidOrdersCannotApproveReceipt() {
        var order = ShopOrder.builder().id(orderId).buyerId(buyer).status(ShopOrder.ShopOrderStatus.AWAITING_PAYMENT).build();
        when(orders.findById(orderId)).thenReturn(Optional.of(order));
        assertEquals(400, controller.confirmReceipt(orderId).getStatusCode().value());
        verify(orders, never()).save(any()); verifyNoInteractions(claims);
    }
    @Test void openProblemReportBlocksReceiptAndPayoutApproval() {
        var order = ShopOrder.builder().id(orderId).buyerId(buyer).status(ShopOrder.ShopOrderStatus.PAID).build();
        when(orders.findById(orderId)).thenReturn(Optional.of(order));
        when(claims.isFrozen(ClaimOrderType.SHOP_ORDER, orderId)).thenReturn(true);
        assertEquals(409, controller.confirmReceipt(orderId).getStatusCode().value());
        verify(orders, never()).save(any());
        assertEquals(ShopOrder.ShopOrderStatus.PAID, order.getStatus());
    }
    @Test void sellerCannotApproveTheirOwnReceipt() {
        var order = ShopOrder.builder().id(orderId).buyerId(UUID.randomUUID()).sellerId(buyer).status(ShopOrder.ShopOrderStatus.PAID).build();
        when(orders.findById(orderId)).thenReturn(Optional.of(order));
        assertEquals(403, controller.confirmReceipt(orderId).getStatusCode().value());
        verify(orders, never()).save(any()); verifyNoInteractions(claims);
    }
}
