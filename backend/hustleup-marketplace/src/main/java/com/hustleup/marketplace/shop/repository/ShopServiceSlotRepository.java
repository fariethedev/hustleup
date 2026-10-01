package com.hustleup.marketplace.shop.repository;

import com.hustleup.marketplace.shop.model.ShopServiceSlot;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ShopServiceSlotRepository extends JpaRepository<ShopServiceSlot, UUID> {

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select s from ShopServiceSlot s where s.id = :id")
    java.util.Optional<ShopServiceSlot> findLockedById(@org.springframework.data.repository.query.Param("id") UUID id);

    List<ShopServiceSlot> findByShopServiceIdOrderByStartTimeAsc(UUID shopServiceId);

    /** Every slot the owner has opened, across every service on the shop — for their calendar. */
    List<ShopServiceSlot> findByShopIdOrderByStartTimeAsc(UUID shopId);

    boolean existsByShopServiceIdAndBookedTrue(UUID shopServiceId);
}
