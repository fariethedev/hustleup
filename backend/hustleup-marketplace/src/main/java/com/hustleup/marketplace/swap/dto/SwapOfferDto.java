/**
 * API shape for a {@link com.hustleup.marketplace.swap.model.SwapOffer}.
 *
 * <p>Flattens both sides of the trade into one object so the client can render a swap
 * card without chasing extra requests: who proposed, what they want, and what they are
 * putting up for it. The nested {@link Side} holds just enough of a listing to draw a
 * thumbnail and a title.
 */
package com.hustleup.marketplace.swap.dto;

import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class SwapOfferDto {

    private UUID id;
    private String status;

    // ── Proposer ──────────────────────────────────────────────────────────────
    private UUID proposerId;
    private String proposerName;
    private String proposerAvatarUrl;

    // ── Target owner ──────────────────────────────────────────────────────────
    private UUID targetOwnerId;
    private String targetOwnerName;
    private String targetOwnerAvatarUrl;

    // ── The trade ─────────────────────────────────────────────────────────────
    /** What the proposer wants. */
    private Side wants;
    /** What the proposer is giving. Has a null {@code listingId} for free-text offers. */
    private Side gives;

    // ── Cash on top ───────────────────────────────────────────────────────────

    /** Money added on top of the items, or null for a straight trade. Always positive. */
    private java.math.BigDecimal cashAmount;

    /**
     * "PROPOSER_PAYS" or "OWNER_PAYS" — which side hands over {@link #cashAmount}.
     *
     * <p>Sent as the enum name rather than resolved into "you"/"them" server-side: the same
     * offer is read by both parties, so whose money it is depends on who is looking. The
     * client knows the viewer and can say "you add 800 zł" or "they add 800 zł" correctly;
     * a pre-baked string would be right for one reader and backwards for the other.
     */
    private String cashDirection;

    private String cashCurrency;

    private String message;
    private LocalDateTime createdAt;
    private LocalDateTime respondedAt;

    /** True when the current viewer owns the targeted listing (i.e. can accept/decline). */
    private boolean incoming;

    // ── Handover ──────────────────────────────────────────────────────────────
    // Sent per-side rather than as "yours"/"theirs", for the same reason cashDirection is:
    // one offer is read by both parties, so which timestamp belongs to the viewer depends on
    // who is looking, and `incoming` already tells the client which side that is.

    /** When the proposer confirmed the owner's item arrived, or null. */
    private LocalDateTime proposerReceivedAt;
    /** When the owner confirmed the proposer's item arrived, or null. */
    private LocalDateTime ownerReceivedAt;

    /** Proof the proposer uploaded of what arrived. Presigned and safe to render. */
    private String proposerProofUrl;
    /** Proof the owner uploaded of what arrived. Presigned and safe to render. */
    private String ownerProofUrl;

    /** True once both sides have confirmed — the trade is physically done, not just agreed. */
    private boolean handoverComplete;

    /**
     * One half of a trade — either a real listing or, for text offers, just a label.
     */
    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    public static class Side {
        /** Null when this side is a free-text offer rather than a listing. */
        private UUID listingId;
        private String title;
        private String imageUrl;
        /** Indicative cash value of the listing, for a "roughly fair?" read. Null for text offers. */
        private java.math.BigDecimal price;
        private String currency;
    }
}
