package com.hustleup.common.subscription;

import com.hustleup.common.model.Subscription;
import com.hustleup.common.repository.SubscriptionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * The single authority on whether an account currently holds Premium.
 *
 * <h2>Why this exists</h2>
 * <p>Premium-gated features were previously decided in the browser — {@code Dating.jsx}
 * carries its own {@code isPremiumActive} helper and the server never re-checks it. That is
 * fine for hiding a button, but it is not a control: anyone can call the API directly and
 * get the feature anyway.
 *
 * <p>Anonymous posting cannot rely on a client-side check. It is a moderation-sensitive
 * capability, so the decision has to be made server-side, in one place, from the database
 * row that billing actually writes.
 *
 * <h2>What counts as Premium</h2>
 * <p>Deliberately identical to the rule the frontend uses to decide what to show, so the
 * button and the endpoint never disagree:
 * <ol>
 *   <li>plan is {@code VERIFIED} — the paid tier,</li>
 *   <li>status is {@code ACTIVE} (not CANCELLED or EXPIRED), and</li>
 *   <li>{@code expiresAt}, when set, is still in the future.</li>
 * </ol>
 *
 * <p>Lives in {@code hustleup-common} rather than the subscription service because the
 * services that need to <em>ask</em> the question (social, marketplace) are not the service
 * that owns billing. Every service already component-scans {@code com.hustleup.common}, so
 * injecting this needs no extra configuration.
 */
@Service
@RequiredArgsConstructor
public class PremiumAccess {

    /** The paid tier's plan name, as written by {@code SubscriptionController#upgrade}. */
    public static final String PREMIUM_PLAN = "VERIFIED";

    private final SubscriptionRepository subscriptionRepository;

    /**
     * Whether this account can use Premium-only features right now.
     *
     * <p>Fails closed: a null user id, a missing subscription row (the implicit FREE tier),
     * a cancelled plan or a lapsed expiry all return {@code false}. A caller that cannot
     * answer the question must not be granted the feature.
     *
     * @param userId the account to check; may be {@code null}
     * @return {@code true} only when an active, unexpired paid plan exists
     */
    public boolean isPremium(UUID userId) {
        if (userId == null) return false;
        return subscriptionRepository.findBySellerId(userId)
                .map(PremiumAccess::isActivePremium)
                .orElse(false);
    }

    /**
     * Which of these accounts currently hold Premium.
     *
     * <p>The batched form of {@link #isPremium}. Callers filtering a list — the Bond
     * discovery stack, say — would otherwise run one query per candidate.
     *
     * @param userIds accounts to check; may be empty
     * @return the subset that hold an active, unexpired paid plan
     */
    public Set<UUID> premiumAmong(Collection<UUID> userIds) {
        if (userIds == null || userIds.isEmpty()) return Set.of();
        return subscriptionRepository.findBySellerIdIn(userIds).stream()
                .filter(PremiumAccess::isActivePremium)
                .map(Subscription::getSellerId)
                .collect(Collectors.toSet());
    }

    /**
     * Every account currently holding Premium.
     *
     * <p>Preferred over {@link #premiumAmong} when the question is "filter this large list
     * down to subscribers": subscribers are far fewer than users, so this reads the small
     * table instead of sending every user id back as an IN clause.
     */
    public Set<UUID> allPremiumUserIds() {
        return subscriptionRepository.findByPlanAndStatus(PREMIUM_PLAN, "ACTIVE").stream()
                .filter(PremiumAccess::isActivePremium)
                .map(Subscription::getSellerId)
                .collect(Collectors.toSet());
    }

    /**
     * The plan rule itself, split out so it can be unit-tested without a database and reused
     * anywhere a {@link Subscription} is already in hand.
     */
    public static boolean isActivePremium(Subscription sub) {
        if (sub == null) return false;
        if (!PREMIUM_PLAN.equalsIgnoreCase(sub.getPlan())) return false;
        // status is nullable on legacy rows; only an explicit non-ACTIVE value disqualifies.
        if (sub.getStatus() != null && !"ACTIVE".equalsIgnoreCase(sub.getStatus())) return false;
        // A null expiry means "does not lapse", which is how FREE-turned-paid rows behave.
        return sub.getExpiresAt() == null || sub.getExpiresAt().isAfter(LocalDateTime.now());
    }
}