package com.hustleup.marketplace.shop.repository;

import com.hustleup.marketplace.shop.model.ShopProduct;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ShopProductRepository extends JpaRepository<ShopProduct, UUID> {

    /** A shop's shelf, in the order the seller arranged it. */
    List<ShopProduct> findByShopIdOrderBySortOrderAscCreatedAtAsc(UUID shopId);

    /** Bulk load for the browse endpoint, so listing N shops doesn't fire N queries. */
    List<ShopProduct> findByShopIdIn(List<UUID> shopIds);

    /**
     * Used when a seller deletes their whole storefront.
     *
     * <p>{@code @Transactional} here for defense-in-depth, matching every other derived
     * delete in this codebase, even though the one caller ({@code ShopController#delete})
     * already carries its own {@code @Transactional} that covers this today. Not depending
     * on that is the point: {@code RefreshTokenRepository}'s sibling method went unnoticed
     * for exactly this reason until it broke password resets in production.
     */
    @org.springframework.transaction.annotation.Transactional
    void deleteByShopId(UUID shopId);

    long countByShopId(UUID shopId);
}
