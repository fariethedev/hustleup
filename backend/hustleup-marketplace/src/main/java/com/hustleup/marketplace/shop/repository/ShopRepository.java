package com.hustleup.marketplace.shop.repository;

import com.hustleup.marketplace.shop.model.Shop;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ShopRepository extends JpaRepository<Shop, UUID> {

    /** A seller's own storefront — there is at most one, enforced by a unique constraint. */
    Optional<Shop> findByOwnerId(UUID ownerId);

    /** Lookup for the readable {@code /shop/{slug}} URLs. */
    Optional<Shop> findBySlug(String slug);

    /** Public browse: unpublished shops are hidden from everyone but their owner. */
    List<Shop> findByPublishedTrue();

    /** Slug collision check used when generating a slug from a shop name. */
    boolean existsBySlug(String slug);
}
