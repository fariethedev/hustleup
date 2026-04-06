package com.hustleup.subscription.repository;

import com.hustleup.subscription.model.Subscription;
import org.springframework.data.jpa.repository.JpaRepository;
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
     * column defined in {@link com.hustleup.subscription.model.Subscription}.</p>
     *
     * @param sellerId the UUID of the seller whose subscription is being queried
     * @return an Optional containing the seller's Subscription, or empty if none exists
     */
    Optional<Subscription> findBySellerId(UUID sellerId);
}
