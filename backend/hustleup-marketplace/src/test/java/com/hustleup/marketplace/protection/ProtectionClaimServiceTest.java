package com.hustleup.marketplace.protection;
import com.hustleup.marketplace.protection.service.ProtectionClaimService;
import com.hustleup.marketplace.protection.repository.ProtectionClaimRepository;
import com.hustleup.marketplace.protection.model.ProtectionClaim;
import com.hustleup.marketplace.protection.model.ProtectionClaim.*;
import com.hustleup.marketplace.booking.model.Booking;
import com.hustleup.marketplace.booking.repository.BookingRepository;
import com.hustleup.marketplace.shop.repository.ShopOrderRepository;
import com.hustleup.marketplace.payments.service.StripeConnectService;
import com.hustleup.common.model.User;
import com.hustleup.common.repository.*;
import org.junit.jupiter.api.*;
import org.mockito.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.server.ResponseStatusException;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
@ExtendWith(MockitoExtension.class)
class ProtectionClaimServiceTest {
    @Mock ProtectionClaimRepository claims;
    @Mock BookingRepository bookings;
    @Mock ShopOrderRepository orders;
    @Mock StripeConnectService stripe;
    @Mock NotificationRepository notifications;
    @Mock UserRepository users;
    @Mock com.hustleup.marketplace.trust.TrustService trust;
    @InjectMocks ProtectionClaimService service;
    UUID buyer=UUID.randomUUID(), seller=UUID.randomUUID(), id=UUID.randomUUID();
    @BeforeEach void auth() {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("buyer", ""));
        when(users.findByEmail("buyer")).thenReturn(Optional.of(User.builder().id(buyer).build()));
    }
    @AfterEach void clear() { SecurityContextHolder.clearContext(); }
    Booking booking(String payment, UUID owner) { return Booking.builder().id(id).buyerId(owner).sellerId(seller).paymentStatus(payment).build(); }
    @Test void unpaidOrderCannotBeReported() {
        when(bookings.findById(id)).thenReturn(Optional.of(booking("PENDING",buyer)));
        assertThrows(ResponseStatusException.class,()->service.raise(ClaimOrderType.BOOKING,id,ClaimReason.DAMAGED,"The item arrived damaged"));
        verifyNoInteractions(claims,stripe);
    }
    @Test void someoneElsesOrderCannotBeReported() {
        when(bookings.findById(id)).thenReturn(Optional.of(booking("PAID",seller)));
        assertThrows(ResponseStatusException.class,()->service.raise(ClaimOrderType.BOOKING,id,ClaimReason.DAMAGED,"The item arrived damaged"));
        verifyNoInteractions(claims,stripe);
    }
    @Test void paidOrderOpensClaimWithoutMovingMoney() {
        when(bookings.findById(id)).thenReturn(Optional.of(booking("PAID",buyer)));
        when(claims.save(any())).thenAnswer(i->i.getArgument(0));
        var claim=service.raise(ClaimOrderType.BOOKING,id,ClaimReason.DAMAGED,"The item arrived damaged");
        assertEquals(ClaimStatus.OPEN,claim.getStatus()); assertEquals(buyer,claim.getBuyerId());
        verifyNoInteractions(stripe);
    }
    @Test void duplicateOpenClaimIsRejected() {
        when(bookings.findById(id)).thenReturn(Optional.of(booking("PAID",buyer)));
        when(claims.findFirstByOrderTypeAndOrderIdAndStatus(ClaimOrderType.BOOKING,id,ClaimStatus.OPEN)).thenReturn(Optional.of(new ProtectionClaim()));
        assertThrows(ResponseStatusException.class,()->service.raise(ClaimOrderType.BOOKING,id,ClaimReason.DAMAGED,"The item arrived damaged"));
        verify(claims,never()).save(any());
    }
    @Test void descriptionIsRequired() {
        assertThrows(ResponseStatusException.class,()->service.raise(ClaimOrderType.BOOKING,id,ClaimReason.OTHER,""));
        verifyNoInteractions(bookings,claims,stripe);
    }

    @Test void paidOutClaimRecoversTransferBeforeRefund() throws Exception {
        Booking b = booking("TRANSFERRED", buyer);
        b.setTransferId("tr_paid"); b.setPaymentIntentId("pi_paid");
        b.setAgreedPrice(new java.math.BigDecimal("100"));
        var claim = ProtectionClaim.builder().id(UUID.randomUUID()).orderId(id)
                .orderType(ClaimOrderType.BOOKING).buyerId(buyer).sellerId(seller)
                .status(ClaimStatus.OPEN).build();
        when(claims.findById(claim.getId())).thenReturn(Optional.of(claim));
        when(bookings.findById(id)).thenReturn(Optional.of(b));
        service.resolve(claim.getId(), true, "Item not delivered");
        var sequence = inOrder(stripe);
        sequence.verify(stripe).recoverTransfer("tr_paid");
        sequence.verify(stripe).refundPayment(eq("pi_paid"), eq(new java.math.BigDecimal("100")), eq(id));
        assertEquals("REFUNDED", b.getPaymentStatus());
        assertEquals(ClaimStatus.REFUNDED, claim.getStatus());
    }

    @Test void failedRecoveryKeepsClaimOpenAndDoesNotRefund() throws Exception {
        Booking b = booking("TRANSFERRED", buyer); b.setTransferId("tr_paid");
        var claim = ProtectionClaim.builder().id(UUID.randomUUID()).orderId(id)
                .orderType(ClaimOrderType.BOOKING).status(ClaimStatus.OPEN).build();
        when(claims.findById(claim.getId())).thenReturn(Optional.of(claim));
        when(bookings.findById(id)).thenReturn(Optional.of(b));
        doThrow(new com.stripe.exception.ApiException("Insufficient balance", null, null, 400, null))
                .when(stripe).recoverTransfer("tr_paid");
        assertThrows(ResponseStatusException.class, () -> service.resolve(claim.getId(), true, "Refund"));
        verify(stripe, never()).refundPayment(any(), any(), any());
        assertEquals(ClaimStatus.OPEN, claim.getStatus());
        assertEquals("TRANSFERRED", b.getPaymentStatus());
    }
}
