package com.hustleup.marketplace.safety;
import com.hustleup.marketplace.booking.repository.BookingRepository;
import com.hustleup.marketplace.booking.model.Booking;
import com.hustleup.marketplace.shop.repository.ShopOrderRepository;
import com.hustleup.marketplace.payments.service.StripeConnectService;
import com.hustleup.common.repository.UserRepository;
import com.hustleup.common.model.User;
import com.stripe.model.*;
import com.stripe.net.RequestOptions;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class DisputeServiceTest {
    final PaymentDisputeRepository disputes=mock(PaymentDisputeRepository.class);
    final BookingRepository bookings=mock(BookingRepository.class);
    final ShopOrderRepository orders=mock(ShopOrderRepository.class);
    final SellerSafetyService safety=mock(SellerSafetyService.class);
    final UserRepository users=mock(UserRepository.class);
    final StripeConnectService stripe=mock(StripeConnectService.class);
    final PlatformTransactionManager tm=mock(PlatformTransactionManager.class);
    final DisputeService service=new DisputeService(disputes,bookings,orders,safety,mock(SuspensionRecoveryService.class),users,stripe,tm,mock(JdbcTemplate.class));
    final UUID seller=UUID.randomUUID(), id=UUID.randomUUID();
    final Booking b=Booking.builder().id(id).sellerId(seller).paymentStatus("TRANSFERRED").transferId("tr_1").build();
    final PaymentDispute row=new PaymentDispute();
    void setup() {
        when(tm.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
        when(disputes.findLocked("dp_1")).thenReturn(Optional.of(row));
        when(bookings.findAllByPaymentIntentId("pi_1")).thenReturn(List.of(b));
        when(bookings.findLockedById(id)).thenReturn(Optional.of(b));
        when(users.findLockedById(seller)).thenReturn(Optional.of(new User()));
    }
    @Test void repeatedEventFreezesSellerRecoversTransferAndSubmitsEvidenceOnlyOnce() throws Exception {
        setup(); var current=mock(Dispute.class); when(current.getPaymentIntent()).thenReturn("pi_1");
        when(current.getStatus()).thenReturn("needs_response");
        try (var ds=mockStatic(Dispute.class); var ps=mockStatic(PaymentIntent.class)) {
            ds.when(()->Dispute.retrieve("dp_1")).thenReturn(current);
            ps.when(()->PaymentIntent.retrieve("pi_1")).thenReturn(new PaymentIntent());
            service.handle("dp_1"); service.handle("dp_1");
            assertEquals("DISPUTED",b.getPaymentStatus()); assertTrue(row.isRecovered()); assertTrue(row.isEvidenceSubmitted());
            verify(safety,times(2)).suspend(seller,"Stripe chargeback dp_1",false);
            verify(stripe,times(2)).recoverTransfer("tr_1");
            verify(current,times(1)).update(anyMap(),any(RequestOptions.class));
            verify(stripe,never()).refundPayment(anyString(),any(),any());
        }
    }
    @Test void recoveryFailurePersistsPendingWorkWithoutDroppingSellerFreeze() throws Exception {
        setup(); var current=mock(Dispute.class); when(current.getPaymentIntent()).thenReturn("pi_1");
        when(current.getStatus()).thenReturn("under_review");
        doThrow(new com.stripe.exception.ApiException("Balance unavailable",null,null,400,null)).when(stripe).recoverTransfer("tr_1");
        try (var ds=mockStatic(Dispute.class); var ps=mockStatic(PaymentIntent.class)) {
            ds.when(()->Dispute.retrieve("dp_1")).thenReturn(current);
            ps.when(()->PaymentIntent.retrieve("pi_1")).thenReturn(new PaymentIntent());
            service.handle("dp_1");
            assertFalse(row.isRecovered()); assertNotNull(row.getLastError());
            verify(safety).suspend(seller,"Stripe chargeback dp_1",false);
            assertEquals("DISPUTED",b.getPaymentStatus());
        }
    }
    @Test void currentClosedStateOverridesOldWebhookAndDoesNotResubmitEvidence() throws Exception {
        setup(); var current=mock(Dispute.class); when(current.getPaymentIntent()).thenReturn("pi_1");
        when(current.getStatus()).thenReturn("won");
        try (var ds=mockStatic(Dispute.class); var ps=mockStatic(PaymentIntent.class)) {
            ds.when(()->Dispute.retrieve("dp_1")).thenReturn(current);
            ps.when(()->PaymentIntent.retrieve("pi_1")).thenReturn(new PaymentIntent());
            service.handle("dp_1"); assertEquals("won",row.getStripeStatus());
            verify(current,never()).update(anyMap(),any(RequestOptions.class));
            assertEquals("DISPUTED",b.getPaymentStatus(),"Winning does not automatically pay an unreviewed seller again");
        }
    }
}
