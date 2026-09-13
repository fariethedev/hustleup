package com.hustleup.marketplace.admin;

import com.hustleup.common.model.User;
import com.hustleup.common.repository.UserRepository;
import com.hustleup.marketplace.booking.repository.BookingRepository;
import com.hustleup.marketplace.listing.repository.ListingRepository;
import com.hustleup.marketplace.protection.model.ProtectionClaim;
import com.hustleup.marketplace.protection.repository.ProtectionClaimRepository;
import com.hustleup.marketplace.shop.model.ShopOrder;
import com.hustleup.marketplace.shop.repository.ShopOrderRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Buyer protection claims, as a support queue rather than a list of identifiers.
 *
 * <h2>Why this exists alongside {@code ProtectionClaimController}</h2>
 * <p>That controller already serves claims to admins, but it returns the raw entity: two
 * account UUIDs and an order UUID. Every question support is actually asked — who is this,
 * what did they buy, how much is frozen — needs three more lookups per row before the queue
 * can even be read. This is the same data with the people and the order attached.
 *
 * <p>Resolution deliberately stays on {@code PATCH /api/v1/claims/{id}}. That path runs the
 * refund through {@code ProtectionClaimService}, which is what actually moves money and
 * unfreezes the payout; a second write path here would be a second place for that to go
 * wrong. This controller is read-only on purpose.
 */
@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@Slf4j
public class AdminSupportController {

    private final ProtectionClaimRepository claimRepository;
    private final BookingRepository bookingRepository;
    private final ShopOrderRepository shopOrderRepository;
    private final ListingRepository listingRepository;
    private final UserRepository userRepository;

    /**
     * <b>GET /api/v1/admin/claims?status=OPEN|REFUNDED|REJECTED|ALL</b>
     *
     * <p>Defaults to OPEN — an open claim is freezing somebody's money, so it is the only
     * part of this queue with a clock on it.
     */
    @GetMapping("/claims")
    public ResponseEntity<?> claims(@RequestParam(required = false, defaultValue = "OPEN") String status) {
        List<ProtectionClaim> rows = claimRepository.findAll();

        if (!"ALL".equalsIgnoreCase(status)) {
            ProtectionClaim.ClaimStatus wanted;
            try {
                wanted = ProtectionClaim.ClaimStatus.valueOf(status.toUpperCase());
            } catch (IllegalArgumentException e) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "Unknown status. Allowed: OPEN, REFUNDED, REJECTED, ALL"));
            }
            rows = rows.stream().filter(c -> c.getStatus() == wanted).collect(Collectors.toList());
        }

        rows = rows.stream()
                .sorted(Comparator.comparing(ProtectionClaim::getCreatedAt,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .collect(Collectors.toList());

        // Both sides of every claim on the page, in one query rather than two per row.
        Set<UUID> people = new HashSet<>();
        rows.forEach(c -> { people.add(c.getBuyerId()); people.add(c.getSellerId()); });
        Map<UUID, User> byId = people.isEmpty() ? Map.of()
                : userRepository.findAllById(people).stream()
                    .collect(Collectors.toMap(User::getId, u -> u, (a, b) -> a));

        List<Map<String, Object>> out = rows.stream()
                .map(c -> describe(c, byId))
                .collect(Collectors.toList());

        return ResponseEntity.ok(Map.of(
                "claims", out,
                "openCount", claimRepository.findAll().stream()
                        .filter(c -> c.getStatus() == ProtectionClaim.ClaimStatus.OPEN).count()));
    }

    // ---- Helpers ------------------------------------------------------------

    private Map<String, Object> describe(ProtectionClaim c, Map<UUID, User> byId) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", c.getId());
        m.put("orderType", c.getOrderType());
        m.put("orderId", c.getOrderId());
        m.put("reason", c.getReason());
        m.put("detail", c.getDetail());
        m.put("status", c.getStatus());
        m.put("resolutionNote", c.getResolutionNote());
        m.put("resolvedAt", c.getResolvedAt());
        m.put("createdAt", c.getCreatedAt());

        m.put("buyerId", c.getBuyerId());
        m.put("sellerId", c.getSellerId());
        put(m, byId.get(c.getBuyerId()), "buyer");
        put(m, byId.get(c.getSellerId()), "seller");

        // What is actually in dispute. Without the amount, a queue of claims gives no way to
        // tell a 40 zł mix-up from a 4 000 zł one, and they are not the same job.
        if (c.getOrderType() == ProtectionClaim.ClaimOrderType.BOOKING) {
            bookingRepository.findById(c.getOrderId()).ifPresent(b -> {
                m.put("amount", b.getAgreedPrice() != null ? b.getAgreedPrice() : b.getOfferedPrice());
                m.put("currency", b.getCurrency());
                m.put("orderStatus", b.getStatus());
                m.put("paymentStatus", b.getPaymentStatus());
                listingRepository.findById(b.getListingId())
                        .ifPresent(l -> m.put("orderTitle", l.getTitle()));
            });
        } else {
            shopOrderRepository.findById(c.getOrderId()).ifPresent((ShopOrder o) -> {
                m.put("amount", o.getTotalPrice());
                m.put("currency", o.getCurrency());
                m.put("orderStatus", o.getStatus());
                m.put("payoutStatus", o.getPayoutStatus());
                m.put("orderTitle", o.getProductName());
            });
        }
        return m;
    }

    /** A missing account is left out rather than written as nulls — it may since have been deleted. */
    private void put(Map<String, Object> m, User u, String prefix) {
        if (u == null) return;
        m.put(prefix + "Name", u.getFullName());
        m.put(prefix + "Email", u.getEmail());
        m.put(prefix + "AvatarUrl", u.getAvatarUrl());
    }
}
