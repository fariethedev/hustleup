package com.hustleup.marketplace.protection.controller;

import com.hustleup.marketplace.protection.model.ProtectionClaim;
import com.hustleup.marketplace.protection.model.ProtectionClaim.ClaimOrderType;
import com.hustleup.marketplace.protection.model.ProtectionClaim.ClaimReason;
import com.hustleup.marketplace.protection.service.ProtectionClaimService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Buyer protection claims.
 *
 * <p>Buyers raise them and read their own; admins read the queue and decide. There is no
 * seller-facing write here on purpose — a seller cannot close a complaint made about them.
 */
@RestController
@RequestMapping("/api/v1/claims")
public class ProtectionClaimController {

    private final ProtectionClaimService claimService;

    public ProtectionClaimController(ProtectionClaimService claimService) {
        this.claimService = claimService;
    }

    /**
     * Reporting a problem with an order.
     *
     * <p><b>POST /api/v1/claims</b> — the buyer on the order.
     * <br>Body: {@code {"orderType":"BOOKING","orderId":"…","reason":"NOT_RECEIVED","detail":"…"}}
     *
     * <p>Opening this freezes the order's payout until an admin decides, which is the whole
     * point of it — see {@link ProtectionClaimService}.
     */
    @PostMapping
    public ResponseEntity<ProtectionClaim> raise(@RequestBody Map<String, String> body) {
        ClaimOrderType orderType = parseEnum(ClaimOrderType.class, body.get("orderType"), "orderType");
        ClaimReason reason = parseEnum(ClaimReason.class, body.get("reason"), "reason");
        UUID orderId = parseUuid(body.get("orderId"));
        return ResponseEntity.ok(claimService.raise(orderType, orderId, reason, body.get("detail")));
    }

    /** The caller's own claims, newest first — so a buyer can see one is still open. */
    @GetMapping("/mine")
    public ResponseEntity<List<ProtectionClaim>> mine() {
        return ResponseEntity.ok(claimService.mine());
    }

    /** The admin queue: everything still open, oldest first. */
    @GetMapping("/open")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<ProtectionClaim>> open() {
        return ResponseEntity.ok(claimService.open());
    }

    /** Every claim ever, newest first — the admin view once the queue is clear. */
    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<ProtectionClaim>> all() {
        return ResponseEntity.ok(claimService.all());
    }

    /**
     * Deciding a claim.
     *
     * <p><b>PATCH /api/v1/claims/{id}</b> — admin only.
     * <br>Body: {@code {"refund": true, "note": "Tracking shows never dispatched"}}
     *
     * <p>{@code refund} true returns the buyer's charge and cancels the order; false lifts the
     * freeze and lets the payout continue. Either way the claim closes, and closing it is what
     * unfreezes the money — an open claim holds funds for as long as it stays open.
     */
    @PatchMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ProtectionClaim> resolve(@PathVariable UUID id, @RequestBody Map<String, Object> body) {
        boolean refund = Boolean.TRUE.equals(body.get("refund"));
        String note = body.get("note") instanceof String s ? s : null;
        return ResponseEntity.ok(claimService.resolve(id, refund, note));
    }

    private UUID parseUuid(String raw) {
        try {
            return UUID.fromString(String.valueOf(raw).trim());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "orderId must be a UUID");
        }
    }

    private <E extends Enum<E>> E parseEnum(Class<E> type, String raw, String field) {
        if (raw == null || raw.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, field + " is required");
        }
        try {
            return Enum.valueOf(type, raw.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    field + " must be one of " + java.util.Arrays.toString(type.getEnumConstants()));
        }
    }
}
