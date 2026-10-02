package com.hustleup.subscription.service;

import com.hustleup.common.model.Subscription;
import com.hustleup.common.repository.SubscriptionRepository;
import com.hustleup.subscription.model.SubscriptionPlan;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class StripeServiceTest {
    private final SubscriptionRepository repository = mock(SubscriptionRepository.class);
    private final StripeService service = new StripeService(repository);

    @Test void monthlyPurchaseGrantsPlusAndDuplicateDoesNotExtend() {
        UUID user = UUID.randomUUID();
        Subscription sub = Subscription.builder().sellerId(user).build();
        when(repository.findBySellerId(user)).thenReturn(Optional.of(sub));
        assertTrue(service.grantPremium(user, SubscriptionPlan.MONTHLY, "cs_once"));
        assertEquals("PLUS", sub.getPlan());
        LocalDateTime expiry = sub.getExpiresAt();
        assertFalse(service.grantPremium(user, SubscriptionPlan.MONTHLY, "cs_once"));
        assertEquals(expiry, sub.getExpiresAt());
        verify(repository, times(1)).save(sub);
    }

    @Test void upgradeConvertsRemainingPlusTimeInsteadOfGrantingFullPriceDays() {
        UUID user = UUID.randomUUID();
        LocalDateTime now = LocalDateTime.now();
        Subscription sub = Subscription.builder().sellerId(user).plan("PLUS")
                .pricePerMonth(new BigDecimal("9")).expiresAt(now.plusDays(20)).build();
        when(repository.findBySellerId(user)).thenReturn(Optional.of(sub));
        service.grantPremium(user, SubscriptionPlan.ALL_ACCESS, "cs_upgrade");
        assertEquals("VERIFIED", sub.getPlan());
        // 20 remaining days at 9 PLN convert to 9 days at 20 PLN, plus the new month.
        assertTrue(sub.getExpiresAt().isAfter(now.plusDays(9).plusMonths(1).minusSeconds(5)));
        assertTrue(sub.getExpiresAt().isBefore(now.plusDays(9).plusMonths(1).plusSeconds(5)));
    }

    @Test void cancelledTimeIsNotCarriedIntoNewPurchase() {
        UUID user = UUID.randomUUID();
        Subscription sub = Subscription.builder().sellerId(user).plan("PLUS").status("CANCELLED")
                .expiresAt(LocalDateTime.now().plusMonths(5)).build();
        when(repository.findBySellerId(user)).thenReturn(Optional.of(sub));
        service.grantPremium(user, SubscriptionPlan.MONTHLY, "cs_new");
        assertTrue(sub.getExpiresAt().isBefore(LocalDateTime.now().plusMonths(1).plusSeconds(5)));
    }
}
