package com.hustleup.marketplace.safety;
import com.hustleup.common.model.User;
import com.hustleup.common.repository.UserRepository;
import com.hustleup.marketplace.booking.repository.BookingRepository;
import com.hustleup.marketplace.shop.repository.ShopOrderRepository;
import com.hustleup.marketplace.shop.model.ShopOrder;
import com.hustleup.marketplace.payments.repository.SellerPayoutAccountRepository;
import com.hustleup.marketplace.payments.service.StripeConnectService;
import com.hustleup.marketplace.ticket.service.TicketService;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;
import java.util.*;
import java.math.BigDecimal;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class SuspensionRecoveryServiceTest {
    final SellerSafetyRepository states=mock(SellerSafetyRepository.class);
    final SellerSafetyService safety=mock(SellerSafetyService.class);
    final UserRepository users=mock(UserRepository.class);
    final BookingRepository bookings=mock(BookingRepository.class);
    final ShopOrderRepository orders=mock(ShopOrderRepository.class);
    final StripeConnectService stripe=mock(StripeConnectService.class);
    final PaymentDisputeRepository disputes=mock(PaymentDisputeRepository.class);
    final PlatformTransactionManager tm=mock(PlatformTransactionManager.class);
    final SuspensionRecoveryService service=new SuspensionRecoveryService(states,safety,users,bookings,orders,
            mock(SellerPayoutAccountRepository.class),stripe,disputes,mock(TicketService.class),tm);
    final UUID seller=UUID.randomUUID(), id=UUID.randomUUID();
    final SellerSafety state=new SellerSafety();
    final ShopOrder order=ShopOrder.builder().id(id).sellerId(seller).status(ShopOrder.ShopOrderStatus.PAID)
            .paymentIntentId("pi_1").transferId("tr_1").totalPrice(new BigDecimal("100")).build();
    void setup() {
        state.setSellerId(seller); state.setSuspended(true); state.setRefundOpenOrders(true);
        when(tm.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
        when(users.findLockedById(seller)).thenReturn(Optional.of(new User()));
        when(states.findLocked(seller)).thenReturn(Optional.of(state)); when(states.findById(seller)).thenReturn(Optional.of(state));
        when(states.save(any())).thenAnswer(i->i.getArgument(0));
        when(orders.findBySellerIdOrderByCreatedAtDesc(seller)).thenReturn(List.of(order));
        when(orders.findLockedById(id)).thenReturn(Optional.of(order));
    }
    @Test void recoveryPrecedesRefundAndRetriedRefundDoesNotRunTwice() throws Exception {
        setup(); service.recover(seller); service.recover(seller);
        var sequence=inOrder(stripe); sequence.verify(stripe).recoverTransfer("tr_1");
        sequence.verify(stripe).refundPayment("pi_1",new BigDecimal("100"),id);
        verifyNoMoreInteractions(stripe);
        assertEquals("REFUNDED",order.getPayoutStatus()); assertTrue(state.isSuspended());
    }
    @Test void failureLeavesSellerFrozenAndOrderPendingWithVisibleError() throws Exception {
        setup(); doThrow(new com.stripe.exception.ApiException("Unavailable",null,null,400,null)).when(stripe).recoverTransfer("tr_1");
        service.recover(seller);
        assertTrue(state.isSuspended()); assertNotNull(state.getLastError());
        assertEquals(ShopOrder.ShopOrderStatus.PAID,order.getStatus());
        verify(stripe,never()).refundPayment(any(),any(),any());
    }
    @Test void disputedChargeIsNotAlsoRefunded() {
        setup(); when(disputes.existsByPaymentIntentId("pi_1")).thenReturn(true);
        service.recover(seller); verifyNoInteractions(stripe);
        assertEquals(ShopOrder.ShopOrderStatus.PAID,order.getStatus());
    }
}
