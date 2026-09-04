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
