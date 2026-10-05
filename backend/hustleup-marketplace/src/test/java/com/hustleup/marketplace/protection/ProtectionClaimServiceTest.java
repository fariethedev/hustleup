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
}
