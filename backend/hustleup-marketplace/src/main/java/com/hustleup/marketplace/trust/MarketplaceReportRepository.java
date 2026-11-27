package com.hustleup.marketplace.trust;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface MarketplaceReportRepository extends JpaRepository<MarketplaceReport, UUID> {
    List<MarketplaceReport> findByStatusOrderByCreatedAtAsc(MarketplaceReport.Status status);
    List<MarketplaceReport> findAllByOrderByCreatedAtDesc();
    long countBySellerIdAndStatus(UUID sellerId, MarketplaceReport.Status status);
    boolean existsByReporterIdAndTargetTypeAndTargetIdAndStatus(UUID reporterId, MarketplaceReport.TargetType type,
                                                                 UUID targetId, MarketplaceReport.Status status);
    long countByStatus(MarketplaceReport.Status status);
}
