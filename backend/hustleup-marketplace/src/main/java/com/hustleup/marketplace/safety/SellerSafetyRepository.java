package com.hustleup.marketplace.safety;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.util.*;
public interface SellerSafetyRepository extends JpaRepository<SellerSafety, UUID> {
    boolean existsBySellerIdAndSuspendedTrue(UUID sellerId);
    List<SellerSafety> findBySuspendedTrue();
    @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select s from SellerSafety s where s.sellerId=:id")
    Optional<SellerSafety> findLocked(@Param("id") UUID id);
}
