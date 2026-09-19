package com.hustleup.marketplace.shop.repository;

import com.hustleup.marketplace.shop.model.ShopServiceSlot;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ShopServiceSlotRepository extends JpaRepository<ShopServiceSlot, UUID> {

    List<ShopServiceSlot> findByShopServiceIdOrderByStartTimeAsc(UUID shopServiceId);

    /** Every slot the owner has opened, across every service on the shop — for their calendar. */
    List<ShopServiceSlot> findByShopIdOrderByStartTimeAsc(UUID shopId);

    boolean existsByShopServiceIdAndBookedTrue(UUID shopServiceId);
}
