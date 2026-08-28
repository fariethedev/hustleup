package com.hustleup.common.repository;

import com.hustleup.common.model.Subscription;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Spring Data JPA repository for {@link Subscription} entities.
 *
 * <h2>What is a Spring Data Repository?</h2>
 * <p>Normally, to query a database you'd write a {@code DAO} class full of
 * boilerplate SQL or JPQL. Spring Data JPA eliminates that boilerplate: you
 * declare an interface that extends {@link JpaRepository} and Spring generates
 * the full implementation at startup time — you never write the CRUD methods
 * yourself.</p>
 *
 * <h2>How JpaRepository works</h2>
 * <p>{@code JpaRepository<Subscription, UUID>} takes two type parameters:</p>
 * <ul>
 *   <li><b>Subscription</b> — the entity this repository manages.</li>
 *   <li><b>UUID</b> — the type of the entity's {@code @Id} field.</li>
 * </ul>
 * <p>Inheriting from {@link JpaRepository} immediately provides methods like
 * {@code save()}, {@code findById()}, {@code findAll()}, {@code deleteById()},
 * and {@code count()} — all without any code.</p>
 *
 * <h2>Query derivation</h2>
 * <p>Spring Data can also derive SQL queries from method names. The method
 * {@code findBySellerId} is parsed as: <em>"SELECT * FROM subscriptions WHERE
 * seller_id = ?"</em> — Spring figures this out from the camel-case name alone.</p>
 */
public interface SubscriptionRepository extends JpaRepository<Subscription, UUID> {

    /**
     * Looks up a seller's subscription by their user ID.
     *
     * <p>Returns an {@link Optional} rather than a raw {@code Subscription} because
     * a seller may not have a subscription row yet (e.g. brand-new FREE-tier sellers).
     * Using {@code Optional} forces the caller to explicitly handle the "not found"
     * case, which prevents accidental {@code NullPointerException}s.</p>
     *
     * <p>Spring Data derives the SQL for this method entirely from its name:
     * {@code findBy} is the prefix, {@code SellerId} maps to the {@code seller_id}
     * column defined in {@link com.hustleup.common.model.Subscription}.</p>
     *
     * @param sellerId the UUID of the seller whose subscription is being queried
     * @return an Optional containing the seller's Subscription, or empty if none exists
     */
    Optional<Subscription> findBySellerId(UUID sellerId);

    /**
     * Subscriptions for a batch of accounts, so callers that need to know "which of these
     * people are premium" can ask once instead of per user. Used by the Bond discovery
     * stack, which would otherwise issue a query per profile it considers.
     */
    List<Subscription> findBySellerIdIn(Collection<UUID> sellerIds);

    /**
     * Every subscription on a given plan and status — the small set, rather than asking
     * "are you premium?" about every account on the platform. Expiry is still checked in
     * code, since a lapsed row keeps status ACTIVE until something sweeps it.
     */
    List<Subscription> findByPlanAndStatus(String plan, String status);
}
