/**
 * Business logic for Swap Mode — barter offers against marketplace listings.
 *
 * <p>The rules encoded here are all about keeping a barter market trustworthy at small
 * scale, where a single bad interaction is a large fraction of everything that happened:
 * <ul>
 *   <li>You cannot offer on your own listing.</li>
 *   <li>You cannot offer a listing you do not own (otherwise you could "trade away"
 *       somebody else's property).</li>
 *   <li>One live offer per (listing, proposer) — no spamming the same seller.</li>
 *   <li>Only the target owner may accept/decline; only the proposer may withdraw.</li>
 *   <li>Accepting marks both listings {@code SOLD_OUT} in the same transaction, so a
 *       traded item cannot also be sold for cash.</li>
 * </ul>
 */
package com.hustleup.marketplace.swap.service;

import com.hustleup.common.model.User;
import com.hustleup.common.repository.UserRepository;
import com.hustleup.common.storage.FileStorageService;
import com.hustleup.marketplace.listing.model.Listing;
import com.hustleup.marketplace.listing.model.ListingStatus;
import com.hustleup.marketplace.listing.repository.ListingRepository;
import com.hustleup.marketplace.swap.dto.SwapOfferDto;
import com.hustleup.marketplace.swap.model.SwapOffer;
import com.hustleup.marketplace.swap.model.SwapStatus;
import com.hustleup.marketplace.swap.repository.SwapOfferRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Slf4j
public class SwapService {

    private final SwapOfferRepository swapOfferRepository;
    private final ListingRepository listingRepository;
    private final UserRepository userRepository;
    private final FileStorageService fileStorageService;

    public SwapService(SwapOfferRepository swapOfferRepository,
                       ListingRepository listingRepository,
                       UserRepository userRepository,
                       FileStorageService fileStorageService) {
        this.swapOfferRepository = swapOfferRepository;
        this.listingRepository = listingRepository;
        this.userRepository = userRepository;
        this.fileStorageService = fileStorageService;
    }

    // ── Commands ──────────────────────────────────────────────────────────────

    /**
     * Creates a PENDING swap offer.
     *
     * @param targetListingId  the listing the proposer wants
     * @param offeredListingId a listing the proposer owns, or null for a text offer
     * @param offeredText      free-text offer, or null when offering a listing
     * @param message          optional note
     * @param proposer         the authenticated user making the offer
     */
    @Transactional
    public SwapOfferDto createOffer(UUID targetListingId, UUID offeredListingId,
                                    String offeredText, String message, User proposer) {

        Listing target = listingRepository.findById(targetListingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Listing not found"));

        if (target.getSellerId().equals(proposer.getId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "You cannot swap for your own listing");
        }
        if (target.getStatus() != ListingStatus.ACTIVE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "That listing is no longer available");
        }

        boolean hasListing = offeredListingId != null;
        boolean hasText = offeredText != null && !offeredText.isBlank();
        // Exactly one form of offer — enforced here so the client gets a readable 400.
        if (hasListing == hasText) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Offer exactly one of: a listing you own, or a description of what you're offering");
        }

        if (hasListing) {
            Listing offered = listingRepository.findById(offeredListingId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Offered listing not found"));
            // Without this check a user could offer away somebody else's property.
            if (!offered.getSellerId().equals(proposer.getId())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only offer your own listings");
            }
            if (offered.getStatus() != ListingStatus.ACTIVE) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The listing you're offering is not active");
            }
        }

        if (swapOfferRepository.existsByTargetListingIdAndProposerIdAndStatus(
                targetListingId, proposer.getId(), SwapStatus.PENDING)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "You already have a pending offer on this listing");
        }

        SwapOffer offer = SwapOffer.builder()
                .targetListingId(targetListingId)
                .targetOwnerId(target.getSellerId())
                .proposerId(proposer.getId())
                .offeredListingId(hasListing ? offeredListingId : null)
                .offeredText(hasText ? offeredText.trim() : null)
                .message(message)
                .status(SwapStatus.PENDING)
                .build();

        SwapOffer saved = swapOfferRepository.save(offer);
        log.info("Swap offer created: {} on listing {} by {}", saved.getId(), targetListingId, proposer.getId());
        return toDto(saved, proposer.getId());
    }

    /**
     * Accepts an offer. Only the target listing's owner may do this.
     *
     * <p>Both listings are flipped to {@code SOLD_OUT} in the same transaction so a traded
     * item cannot subsequently be sold for cash, and any other pending offers on the target
     * are declined — the item is gone, so leaving them hanging would be a lie.
     */
    @Transactional
    public SwapOfferDto accept(UUID offerId, User actor) {
        SwapOffer offer = requirePending(offerId);
        if (!offer.getTargetOwnerId().equals(actor.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the listing owner can accept this swap");
        }

        offer.setStatus(SwapStatus.ACCEPTED);
        offer.setRespondedAt(LocalDateTime.now());
        SwapOffer saved = swapOfferRepository.save(offer);

        markSoldOut(offer.getTargetListingId());
        if (offer.getOfferedListingId() != null) {
            markSoldOut(offer.getOfferedListingId());
        }

        // Everything else queued against this listing is now moot.
        swapOfferRepository.findByTargetListingIdAndStatus(offer.getTargetListingId(), SwapStatus.PENDING)
                .stream()
                .filter(other -> !other.getId().equals(offerId))
                .forEach(other -> {
                    other.setStatus(SwapStatus.DECLINED);
                    other.setRespondedAt(LocalDateTime.now());
                    swapOfferRepository.save(other);
                });

        log.info("Swap accepted: {} ({} <-> {})", offerId, offer.getTargetListingId(), offer.getOfferedListingId());
        return toDto(saved, actor.getId());
    }

    /** Declines an offer. Only the target listing's owner may do this. */
    @Transactional
    public SwapOfferDto decline(UUID offerId, User actor) {
        SwapOffer offer = requirePending(offerId);
        if (!offer.getTargetOwnerId().equals(actor.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the listing owner can decline this swap");
        }
        offer.setStatus(SwapStatus.DECLINED);
        offer.setRespondedAt(LocalDateTime.now());
        return toDto(swapOfferRepository.save(offer), actor.getId());
    }

    /** Withdraws an offer. Only the proposer may do this. */
    @Transactional
    public SwapOfferDto withdraw(UUID offerId, User actor) {
        SwapOffer offer = requirePending(offerId);
        if (!offer.getProposerId().equals(actor.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the proposer can withdraw this offer");
        }
        offer.setStatus(SwapStatus.WITHDRAWN);
        offer.setRespondedAt(LocalDateTime.now());
        return toDto(swapOfferRepository.save(offer), actor.getId());
    }

    // ── Queries ───────────────────────────────────────────────────────────────

    /** Offers waiting on me (as listing owner). */
    public List<SwapOfferDto> incoming(User me) {
        return swapOfferRepository.findByTargetOwnerIdOrderByCreatedAtDesc(me.getId())
                .stream().map(o -> toDto(o, me.getId())).collect(Collectors.toList());
    }

    /** Offers I have proposed. */
    public List<SwapOfferDto> outgoing(User me) {
        return swapOfferRepository.findByProposerIdOrderByCreatedAtDesc(me.getId())
                .stream().map(o -> toDto(o, me.getId())).collect(Collectors.toList());
    }

    /** Pending offers against one listing — shown to the owner on the listing page. */
    public List<SwapOfferDto> forListing(UUID listingId, UUID viewerId) {
        return swapOfferRepository.findByTargetListingIdAndStatus(listingId, SwapStatus.PENDING)
                .stream().map(o -> toDto(o, viewerId)).collect(Collectors.toList());
    }

    /**
     * The public swap chain: the most recent accepted trades.
     *
     * <p>This is the screenshot surface — A traded with B, B traded with C — so it is
     * intentionally global rather than personalised.
     */
    public List<SwapOfferDto> chain(int limit) {
        return swapOfferRepository.findByStatusOrderByRespondedAtDesc(SwapStatus.ACCEPTED)
                .stream()
                .limit(Math.max(1, Math.min(limit, 50)))
                .map(o -> toDto(o, null))
                .collect(Collectors.toList());
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private SwapOffer requirePending(UUID offerId) {
        SwapOffer offer = swapOfferRepository.findById(offerId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Swap offer not found"));
        if (offer.getStatus() != SwapStatus.PENDING) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "This offer has already been " + offer.getStatus().name().toLowerCase());
        }
        return offer;
    }

    private void markSoldOut(UUID listingId) {
        listingRepository.findById(listingId).ifPresent(l -> {
            l.setStatus(ListingStatus.SOLD_OUT);
            l.setUpdatedAt(LocalDateTime.now());
            listingRepository.save(l);
        });
    }

    /**
     * Builds the wire shape. {@code viewerId} may be null (public chain), in which case
     * {@code incoming} is simply false.
     */
    private SwapOfferDto toDto(SwapOffer offer, UUID viewerId) {
        SwapOfferDto.SwapOfferDtoBuilder b = SwapOfferDto.builder()
                .id(offer.getId())
                .status(offer.getStatus().name())
                .proposerId(offer.getProposerId())
                .targetOwnerId(offer.getTargetOwnerId())
                .message(offer.getMessage())
                .createdAt(offer.getCreatedAt())
                .respondedAt(offer.getRespondedAt())
                .incoming(viewerId != null && viewerId.equals(offer.getTargetOwnerId()));

        userRepository.findById(offer.getProposerId()).ifPresent(u -> {
            b.proposerName(u.getFullName());
            b.proposerAvatarUrl(refresh(u.getAvatarUrl()));
        });
        userRepository.findById(offer.getTargetOwnerId()).ifPresent(u -> {
            b.targetOwnerName(u.getFullName());
            b.targetOwnerAvatarUrl(refresh(u.getAvatarUrl()));
        });

        b.wants(sideFromListing(offer.getTargetListingId()));
        b.gives(offer.getOfferedListingId() != null
                ? sideFromListing(offer.getOfferedListingId())
                : SwapOfferDto.Side.builder().title(offer.getOfferedText()).build());

        return b.build();
    }

    private SwapOfferDto.Side sideFromListing(UUID listingId) {
        return listingRepository.findById(listingId)
                .map(l -> SwapOfferDto.Side.builder()
                        .listingId(l.getId())
                        .title(l.getTitle())
                        .imageUrl(firstMediaUrl(l.getMediaUrls()))
                        .price(l.getPrice())
                        .currency(l.getCurrency())
                        .build())
                // The listing could have been hard-deleted after the offer was made; degrade
                // to a placeholder rather than dropping the whole swap from the response.
                .orElseGet(() -> SwapOfferDto.Side.builder().title("Removed listing").build());
    }

    /** Listings store media as CSV; the card only needs the first image. */
    private String firstMediaUrl(String mediaUrls) {
        if (mediaUrls == null || mediaUrls.isBlank()) return null;
        String first = mediaUrls.split(",")[0].trim()
                .replace("[", "").replace("]", "").replace("\"", "");
        return first.isBlank() ? null : refresh(first);
    }

    private String refresh(String url) {
        if (url == null || url.isBlank()) return null;
        try {
            return fileStorageService.refreshUrl(url);
        } catch (Exception e) {
            return url;
        }
    }
}
