package com.hustleup.marketplace.shop.repository;

import com.hustleup.marketplace.shop.model.ShopBookableService;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ShopBookableServiceRepository extends JpaRepository<ShopBookableService, UUID> {

    List<ShopBookableService> findByShopIdOrderBySortOrderAsc(UUID shopId);

    /** Only what a customer should be offered — a retired service stays for its history. */
    List<ShopBookableService> findByShopIdAndActiveTrueOrderBySortOrderAsc(UUID shopId);

    long countByShopId(UUID shopId);
}
