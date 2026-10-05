package com.hustleup.common.subscription;

import com.hustleup.common.model.Subscription;
import com.hustleup.common.repository.SubscriptionRepository;
import com.hustleup.common.repository.UserRepository;
import org.junit.jupiter.api.Test;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class PremiumAccessTest {
    @Test void bothPaidTiersQualifyButFreeAndLapsedPlansDoNot() {
        for (String plan : List.of("PLUS", "VERIFIED")) {
            var sub = new Subscription(); sub.setPlan(plan); sub.setStatus("ACTIVE");
            sub.setExpiresAt(LocalDateTime.now().plusDays(1));
            assertTrue(PremiumAccess.isActivePremium(sub));
            sub.setStatus("CANCELLED"); assertFalse(PremiumAccess.isActivePremium(sub));
            sub.setStatus("ACTIVE"); sub.setExpiresAt(LocalDateTime.now().minusDays(1));
            assertFalse(PremiumAccess.isActivePremium(sub));
        }
        var free = new Subscription(); free.setPlan("FREE"); free.setStatus("ACTIVE");
        assertFalse(PremiumAccess.isActivePremium(free));
        assertFalse(PremiumAccess.isActivePremium(null));
    }

    @Test void publicBadgesCanBeResolvedInOneBatch() {
        var subscriptions = mock(SubscriptionRepository.class);
        var access = new PremiumAccess(subscriptions, mock(UserRepository.class));
        UUID paidId = UUID.randomUUID(), freeId = UUID.randomUUID();
        var paid = new Subscription(); paid.setSellerId(paidId); paid.setPlan("PLUS"); paid.setStatus("ACTIVE");
        when(subscriptions.findBySellerIdIn(List.of(paidId, freeId))).thenReturn(List.of(paid));
        assertEquals(Set.of(paidId), access.premiumAmong(List.of(paidId, freeId)));
        verify(subscriptions).findBySellerIdIn(List.of(paidId, freeId));
        verifyNoMoreInteractions(subscriptions);
    }
}
