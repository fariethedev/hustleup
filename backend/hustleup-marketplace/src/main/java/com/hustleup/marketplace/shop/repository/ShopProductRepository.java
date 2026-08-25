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

    /** Used when a seller deletes their whole storefront. */
    void deleteByShopId(UUID shopId);

    long countByShopId(UUID shopId);
}
