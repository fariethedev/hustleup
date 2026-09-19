package com.hustleup.marketplace.shop.repository;

import com.hustleup.marketplace.shop.model.ShopAppointment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ShopAppointmentRepository extends JpaRepository<ShopAppointment, UUID> {

    /** The shop owner's own calendar of bookings, newest first. */
    List<ShopAppointment> findByShopIdOrderByCreatedAtDesc(UUID shopId);

    /** A customer's own appointments across every shop, for their side of the booking. */
    List<ShopAppointment> findByBuyerIdOrderByCreatedAtDesc(UUID buyerId);
}
