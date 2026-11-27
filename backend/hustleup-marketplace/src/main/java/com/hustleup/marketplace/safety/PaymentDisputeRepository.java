package com.hustleup.marketplace.safety;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.util.*;
public interface PaymentDisputeRepository extends JpaRepository<PaymentDispute,String> {
    boolean existsByPaymentIntentId(String paymentIntentId);
    List<PaymentDispute> findByRecoveredFalseOrEvidenceSubmittedFalse();
    @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select d from PaymentDispute d where d.id=:id")
    Optional<PaymentDispute> findLocked(@Param("id") String id);
}
