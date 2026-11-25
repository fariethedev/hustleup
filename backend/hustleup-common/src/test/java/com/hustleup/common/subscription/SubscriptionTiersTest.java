package com.hustleup.common.subscription;

import com.hustleup.common.model.Subscription;
import com.hustleup.common.repository.SubscriptionRepository;
import com.hustleup.common.repository.UserRepository;
import org.junit.jupiter.api.Test;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class SubscriptionTiersTest {
    private final SubscriptionRepository subscriptions = mock(SubscriptionRepository.class);
    private final PremiumAccess access = new PremiumAccess(subscriptions, mock(UserRepository.class));

    @Test void everySignedInAccountHasEveryFeatureAndNoBadge() {
        // Subscriptions were retired: features are free, nobody is "Premium".
        UUID id = UUID.randomUUID();
        assertTrue(access.isAllAccess(id));
        assertFalse(access.isPremium(id));
        verifyNoInteractions(subscriptions);
    }

    @Test void legacyPaidSubscribersKeepAllAccess() {
        UUID id = UUID.randomUUID();
        when(subscriptions.findBySellerId(id)).thenReturn(Optional.of(Subscription.builder().plan("VERIFIED").build()));
        assertTrue(access.isAllAccess(id));
    }

    @Test void expiredCancelledAndUnknownPlansFailClosed() {
        assertFalse(PremiumAccess.isActivePremium(Subscription.builder().plan("PLUS").expiresAt(LocalDateTime.now().minusSeconds(1)).build()));
        assertFalse(PremiumAccess.isActivePremium(Subscription.builder().plan("VERIFIED").status("CANCELLED").build()));
        assertFalse(PremiumAccess.isActivePremium(Subscription.builder().plan("INVALID").build()));
        assertFalse(access.isAllAccess(null));
    }
}
