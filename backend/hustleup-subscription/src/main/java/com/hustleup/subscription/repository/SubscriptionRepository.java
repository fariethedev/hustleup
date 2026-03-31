package com.hustleup.subscription.repository;

import com.hustleup.subscription.model.Subscription;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface SubscriptionRepository extends JpaRepository<Subscription, UUID> {
    Optional<Subscription> findBySellerId(UUID sellerId);
}
