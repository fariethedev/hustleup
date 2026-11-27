package com.hustleup.marketplace.trust;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface SellerProfileRepository extends JpaRepository<SellerProfile, UUID> {
    List<SellerProfile> findByBankFingerprint(String bankFingerprint);
    List<SellerProfile> findByStrikesGreaterThanOrderByStrikesDesc(int strikes);
}
