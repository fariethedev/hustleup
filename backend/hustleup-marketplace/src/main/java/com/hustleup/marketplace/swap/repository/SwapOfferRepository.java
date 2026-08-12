/**
 * Spring Data repository for {@link SwapOffer} rows.
 *
 * <p>Most methods are derived queries (Spring builds the SQL from the method name). The
 * two {@code @Query} methods exist because they aggregate rather than select entities.
 */
package com.hustleup.marketplace.swap.repository;

import com.hustleup.marketplace.swap.model.SwapOffer;
import com.hustleup.marketplace.swap.model.SwapStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface SwapOfferRepository extends JpaRepository<SwapOffer, UUID> {

    /** Inbox: everything addressed to me, newest first. */
    List<SwapOffer> findByTargetOwnerIdOrderByCreatedAtDesc(UUID targetOwnerId);

    /** Outbox: everything I have proposed, newest first. */
    List<SwapOffer> findByProposerIdOrderByCreatedAtDesc(UUID proposerId);

    /** Offers against one listing in a given state — used for the "N offers" badge. */
    List<SwapOffer> findByTargetListingIdAndStatus(UUID targetListingId, SwapStatus status);

    /**
     * Guards against a proposer spamming the same listing: one live offer per
     * (listing, proposer) pair.
     */
    boolean existsByTargetListingIdAndProposerIdAndStatus(UUID targetListingId, UUID proposerId, SwapStatus status);

    /** The public swap chain — accepted trades, newest first. */
    List<SwapOffer> findByStatusOrderByRespondedAtDesc(SwapStatus status);

    /**
     * How many accepted swaps a user has taken part in, on either side of the trade.
     *
     * <p>Counting both sides is deliberate: a swap is a mutual act, so both participants
     * should get credit for it in their hustle score.
     */
    @Query("""
            SELECT COUNT(s) FROM SwapOffer s
            WHERE s.status = com.hustleup.marketplace.swap.model.SwapStatus.ACCEPTED
              AND (s.proposerId = :userId OR s.targetOwnerId = :userId)
            """)
    long countAcceptedForUser(@Param("userId") UUID userId);

    /**
     * Accepted-swap counts for every user at once, as {@code [userId, count]} rows.
     *
     * <p>Used by the leaderboard so scoring a whole page of users stays one query instead
     * of one per user. Each accepted swap yields two rows (one per participant), which the
     * service folds into a map.
     */
    @Query(value = """
            SELECT participant, COUNT(*) FROM (
                SELECT proposer_id AS participant FROM swap_offers WHERE status = 'ACCEPTED'
                UNION ALL
                SELECT target_owner_id AS participant FROM swap_offers WHERE status = 'ACCEPTED'
            ) sides
            GROUP BY participant
            """, nativeQuery = true)
    List<Object[]> acceptedSwapCountsByUser();
}
