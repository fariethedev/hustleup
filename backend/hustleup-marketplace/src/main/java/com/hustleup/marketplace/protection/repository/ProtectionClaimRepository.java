package com.hustleup.marketplace.protection.repository;

import com.hustleup.marketplace.protection.model.ProtectionClaim;
import com.hustleup.marketplace.protection.model.ProtectionClaim.ClaimOrderType;
import com.hustleup.marketplace.protection.model.ProtectionClaim.ClaimStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ProtectionClaimRepository extends JpaRepository<ProtectionClaim, UUID> {

    /**
     * The freeze check, asked before any money moves.
     *
     * <p>Deliberately "does one exist" rather than "fetch them": the release paths only need
     * to know whether to stop, and this runs on every payout sweep over every due order.
     */
    boolean existsByOrderTypeAndOrderIdAndStatus(ClaimOrderType orderType, UUID orderId, ClaimStatus status);

    /** Stops a buyer filing the same complaint twice while the first is still being read. */
    Optional<ProtectionClaim> findFirstByOrderTypeAndOrderIdAndStatus(
            ClaimOrderType orderType, UUID orderId, ClaimStatus status);

    /** The admin queue — oldest first, because the longest wait is the most urgent. */
    List<ProtectionClaim> findByStatusOrderByCreatedAtAsc(ClaimStatus status);

    /** Every claim, newest first, for the admin view once the queue is empty. */
    List<ProtectionClaim> findAllByOrderByCreatedAtDesc();

    /** A buyer's own claims, so the dashboard can show one is open on an order. */
    List<ProtectionClaim> findByBuyerIdOrderByCreatedAtDesc(UUID buyerId);
}
