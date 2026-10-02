package com.hustleup.marketplace.payments.controller;

import com.hustleup.common.model.User;
import com.hustleup.common.repository.UserRepository;
import com.hustleup.marketplace.payments.model.SellerPayoutAccount;
import com.hustleup.marketplace.payments.repository.SellerPayoutAccountRepository;
import com.hustleup.marketplace.payments.service.StripeConnectService;
import com.stripe.exception.StripeException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import java.math.BigDecimal;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class PayoutControllerTest {
    private final StripeConnectService stripe = mock(StripeConnectService.class);
    private final SellerPayoutAccountRepository accounts = mock(SellerPayoutAccountRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final PayoutController controller = new PayoutController(stripe, accounts, users, null, null, null, null, null, null, null);
    private final UUID userId = UUID.randomUUID();

    @BeforeEach void authenticatedOwner() {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("seller@example.test", null));
        when(users.findByEmail("seller@example.test")).thenReturn(Optional.of(User.builder().id(userId).build()));
        when(stripe.getPlatformFeePercent()).thenReturn(new BigDecimal("8"));
    }
    @AfterEach void clearContext() { SecurityContextHolder.clearContext(); }

    @Test void expiredMembersKeepAuthenticatedBankManagement() throws Exception {
        for (String method : new String[]{"connect", "status", "dashboard"}) {
            assertEquals("isAuthenticated()", PayoutController.class.getMethod(method).getAnnotation(PreAuthorize.class).value());
        }
        when(accounts.findBySellerId(userId)).thenReturn(Optional.empty());
        assertEquals(false, ((Map<?, ?>) controller.status().getBody()).get("connected"));
        assertEquals(409, controller.dashboard().getStatusCode().value());
    }

    @Test void dashboardResolvesOnlyAuthenticatedOwnersStoredAccount() throws Exception {
        SellerPayoutAccount account = SellerPayoutAccount.builder().sellerId(userId).stripeAccountId("acct_owner").build();
        when(accounts.findBySellerId(userId)).thenReturn(Optional.of(account));
        when(stripe.createDashboardLink(account)).thenReturn("https://stripe.com/express/test");
        var response = controller.dashboard();
        assertEquals(200, response.getStatusCode().value());
        assertEquals("no-store", response.getHeaders().getFirst("Cache-Control"));
        verify(stripe).createDashboardLink(account);
    }

    @Test void failedStripeRefreshDoesNotReportCachedPayoutsAsReady() throws Exception {
        SellerPayoutAccount account = SellerPayoutAccount.builder().sellerId(userId).payoutsEnabled(true).build();
        when(accounts.findBySellerId(userId)).thenReturn(Optional.of(account));
        when(stripe.accountStatus(account)).thenThrow(mock(StripeException.class));
        var response = controller.status();
        assertEquals(502, response.getStatusCode().value());
        assertEquals(true, ((Map<?, ?>) response.getBody()).get("statusUnavailable"));
        assertFalse(((Map<?, ?>) response.getBody()).containsKey("payoutsEnabled"));
    }
}
