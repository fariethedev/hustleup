package com.hustleup.marketplace.payments.repository;

import com.hustleup.marketplace.payments.model.SellerPayoutAccount;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface SellerPayoutAccountRepository extends JpaRepository<SellerPayoutAccount, UUID> {

    Optional<SellerPayoutAccount> findBySellerId(UUID sellerId);

    Optional<SellerPayoutAccount> findByStripeAccountId(String stripeAccountId);
}
