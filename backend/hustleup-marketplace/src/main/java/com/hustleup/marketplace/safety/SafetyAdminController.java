package com.hustleup.marketplace.safety;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;
import java.util.*;
@RestController @RequestMapping("/api/v1/admin/safety") @PreAuthorize("hasRole('ADMIN')") @RequiredArgsConstructor
public class SafetyAdminController {
    private final SellerSafetyService safety;
    private final SuspensionRecoveryService recovery;
    private final SellerSafetyRepository states;
    private final PaymentDisputeRepository disputes;
    private final DisputeService disputeService;
    public record SuspendRequest(String reason) {}
    @PostMapping("/sellers/{sellerId}/suspend")
    public SellerSafety suspend(@PathVariable UUID sellerId, @RequestBody SuspendRequest request) {
        safety.suspend(sellerId, request.reason(), true);
        return recovery.recover(sellerId);
    }
    @PostMapping("/sellers/{sellerId}/retry") public SellerSafety retry(@PathVariable UUID sellerId) { return recovery.recover(sellerId); }
    @GetMapping("/sellers") public List<SellerSafety> sellers() { return states.findBySuspendedTrue(); }
    @GetMapping("/disputes") public List<PaymentDispute> disputes() { return disputes.findAll(); }
    @PostMapping("/disputes/{id}/retry") public void retryDispute(@PathVariable String id) { disputeService.handle(id); }
}
