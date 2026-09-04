/**
 * REST API for Swap Mode.
 *
 * <p><b>Base path:</b> {@code /api/v1/swaps}
 *
 * <p>Auth follows the same pattern as {@link com.hustleup.marketplace.listing.controller.ListingController}:
 * the current user is resolved from the Spring Security context by email. Everything here
 * requires authentication except the public {@code /chain} feed.
 */
package com.hustleup.marketplace.swap.controller;

import com.hustleup.common.model.User;
import com.hustleup.common.repository.UserRepository;
import com.hustleup.marketplace.swap.dto.SwapOfferDto;
import com.hustleup.marketplace.swap.service.SwapService;
import com.hustleup.marketplace.swap.model.CashDirection;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/swaps")
public class SwapController {

    private final SwapService swapService;
    private final UserRepository userRepository;

    public SwapController(SwapService swapService, UserRepository userRepository) {
        this.swapService = swapService;
        this.userRepository = userRepository;
    }

    /**
     * Proposes a swap.
     *
     * <p>Body: {@code { targetListingId, offeredListingId? , offeredText?, cashAmount?,
     * cashDirection?, message? }} — exactly one of {@code offeredListingId} /
     * {@code offeredText} is required.
     *
     * <p>{@code cashAmount} is money on top of the items and {@code cashDirection} is
     * "PROPOSER_PAYS" or "OWNER_PAYS". Both are optional, but an amount without a direction
     * is rejected rather than guessed — assuming who pays would be a coin flip on the one
     * detail the two of them will actually argue about.
     */
    @PostMapping
    public ResponseEntity<SwapOfferDto> create(@RequestBody Map<String, Object> body) {
        User me = requireCurrentUser();

        UUID targetListingId = parseUuid(body.get("targetListingId"));
        if (targetListingId == null) {
            throw new IllegalArgumentException("targetListingId is required");
        }
        UUID offeredListingId = parseUuid(body.get("offeredListingId"));
        String offeredText = body.get("offeredText") != null ? body.get("offeredText").toString() : null;
        String message = body.get("message") != null ? body.get("message").toString() : null;

        // Parsed from the raw body rather than bound to a typed request object, matching how
        // the rest of this endpoint reads. A malformed number is a readable 400, not a 500.
        BigDecimal cashAmount = null;
        if (body.get("cashAmount") != null && !body.get("cashAmount").toString().isBlank()) {
            try {
                cashAmount = new BigDecimal(body.get("cashAmount").toString().trim());
            } catch (NumberFormatException e) {
                throw new IllegalArgumentException("cashAmount must be a number");
            }
        }

        CashDirection cashDirection = null;
        if (body.get("cashDirection") != null && !body.get("cashDirection").toString().isBlank()) {
            try {
                cashDirection = CashDirection.valueOf(body.get("cashDirection").toString().trim().toUpperCase());
            } catch (IllegalArgumentException e) {
                throw new IllegalArgumentException("cashDirection must be PROPOSER_PAYS or OWNER_PAYS");
            }
        }

        return ResponseEntity.ok(swapService.createOffer(targetListingId, offeredListingId, offeredText,
                cashAmount, cashDirection, message, me));
    }

    /** Offers waiting on me. */
    @GetMapping("/incoming")
    public ResponseEntity<List<SwapOfferDto>> incoming() {
        return ResponseEntity.ok(swapService.incoming(requireCurrentUser()));
    }

    /** Offers I have sent. */
    @GetMapping("/outgoing")
    public ResponseEntity<List<SwapOfferDto>> outgoing() {
        return ResponseEntity.ok(swapService.outgoing(requireCurrentUser()));
    }

    /** Pending offers against a single listing. */
    @GetMapping("/listing/{listingId}")
    public ResponseEntity<List<SwapOfferDto>> forListing(@PathVariable UUID listingId) {
        UUID viewerId = getCurrentUser().map(User::getId).orElse(null);
        return ResponseEntity.ok(swapService.forListing(listingId, viewerId));
    }

    /** Public feed of recent accepted trades — the "swap chain". */
    @GetMapping("/chain")
    public ResponseEntity<List<SwapOfferDto>> chain(@RequestParam(defaultValue = "12") int limit) {
        return ResponseEntity.ok(swapService.chain(limit));
    }

    @PatchMapping("/{id}/accept")
    public ResponseEntity<SwapOfferDto> accept(@PathVariable UUID id) {
        return ResponseEntity.ok(swapService.accept(id, requireCurrentUser()));
    }

    @PatchMapping("/{id}/decline")
    public ResponseEntity<SwapOfferDto> decline(@PathVariable UUID id) {
        return ResponseEntity.ok(swapService.decline(id, requireCurrentUser()));
    }

    @PatchMapping("/{id}/withdraw")
    public ResponseEntity<SwapOfferDto> withdraw(@PathVariable UUID id) {
        return ResponseEntity.ok(swapService.withdraw(id, requireCurrentUser()));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /** Tolerates null/blank/malformed input by returning null rather than throwing. */
    private UUID parseUuid(Object raw) {
        if (raw == null) return null;
        String s = raw.toString().trim();
        if (s.isEmpty()) return null;
        try {
            return UUID.fromString(s);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private User requireCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()
                || authentication instanceof AnonymousAuthenticationToken) {
            throw new AccessDeniedException("Not authenticated");
        }
        return userRepository.findByEmail(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found: " + authentication.getName()));
    }

    private Optional<User> getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()
                || authentication instanceof AnonymousAuthenticationToken) {
            return Optional.empty();
        }
        return userRepository.findByEmail(authentication.getName());
    }
}
