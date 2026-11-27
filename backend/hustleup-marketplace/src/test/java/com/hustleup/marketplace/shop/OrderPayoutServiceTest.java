package com.hustleup.marketplace.shop;

import com.hustleup.marketplace.shop.service.OrderPayoutService;
import com.hustleup.marketplace.shop.model.ShopOrder;
import com.hustleup.marketplace.shop.repository.ShopOrderRepository;
import com.hustleup.marketplace.payments.repository.SellerPayoutAccountRepository;
import com.hustleup.marketplace.payments.service.StripeConnectService;
import com.hustleup.marketplace.protection.service.ProtectionClaimService;
import com.hustleup.common.repository.NotificationRepository;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import java.time.LocalDateTime;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class OrderPayoutServiceTest {
    final ShopOrderRepository orders = mock(ShopOrderRepository.class);
    final SellerPayoutAccountRepository accounts = mock(SellerPayoutAccountRepository.class);
    final StripeConnectService stripe = mock(StripeConnectService.class);
    final NotificationRepository notifications = mock(NotificationRepository.class);
    final ProtectionClaimService claims = mock(ProtectionClaimService.class);
    final OrderPayoutService service = new OrderPayoutService(orders, accounts, stripe, notifications, claims,
            mock(com.hustleup.marketplace.safety.SellerSafetyService.class),
            mock(org.springframework.transaction.PlatformTransactionManager.class));
    ShopOrder order() {
        ReflectionTestUtils.setField(service, "holdDays", 30);
        var order = ShopOrder.builder().status(ShopOrder.ShopOrderStatus.PAID).build();
        order.getFulfilment().setBuyerConfirmationRequired(false);
        return order;
    }
    @Test void dispatchAloneNeverReleasesMoney() {
        var o = order(); o.getFulfilment().setShippedAt(LocalDateTime.now().minusDays(90));
        assertFalse(service.release(o)); verifyNoInteractions(stripe, notifications, accounts);
    }
    @Test void sellerDeliveryCannotReleaseWithinThirtyDays() {
        var o = order(); o.getFulfilment().setDeliveredAt(LocalDateTime.now().minusDays(8));
        assertFalse(service.release(o)); verifyNoInteractions(stripe, notifications, accounts);
    }
    @Test void overdueOrderIsRemindedAndWaitsAnotherFortyEightHours() {
        var o = order(); o.getFulfilment().setDeliveredAt(LocalDateTime.now().minusDays(60));
        assertFalse(service.release(o));
        assertNotNull(o.getFulfilment().getReleaseReminderAt());
        assertFalse(service.release(o));
        verify(notifications, times(1)).save(any()); verifyNoInteractions(stripe, accounts);
        o.getFulfilment().setReleaseReminderAt(LocalDateTime.now().minusHours(49));
        when(claims.isFrozen(any(), any())).thenReturn(true);
        assertFalse(service.release(o)); verifyNoInteractions(stripe, accounts);
    }
    @Test void failedReminderDoesNotStartCountdown() {
        var o = order(); o.getFulfilment().setDeliveredAt(LocalDateTime.now().minusDays(60));
        when(notifications.save(any())).thenThrow(new IllegalStateException("DB unavailable"));
        assertThrows(IllegalStateException.class, () -> service.release(o));
        assertNull(o.getFulfilment().getReleaseReminderAt()); verifyNoInteractions(stripe, accounts);
    }
    @Test void buyerConfirmationBypassesTimerButNeverAnOpenClaim() {
        var o = order(); o.getFulfilment().setBuyerConfirmedAt(LocalDateTime.now());
        when(claims.isFrozen(any(), any())).thenReturn(true);
        assertFalse(service.release(o)); verifyNoInteractions(stripe, accounts, notifications);
    }
    @Test void newSellerCannotAutoReleaseEvenAfterReminderAndLongHold() {
        var o = order(); o.getFulfilment().setBuyerConfirmationRequired(true);
        o.getFulfilment().setDeliveredAt(LocalDateTime.now().minusDays(90));
        o.getFulfilment().setReleaseReminderAt(LocalDateTime.now().minusDays(10));
        assertFalse(service.release(o)); verifyNoInteractions(stripe, accounts, notifications);
    }
}
