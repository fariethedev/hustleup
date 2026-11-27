package com.hustleup.marketplace.safety;
import com.hustleup.common.repository.UserRepository;
import com.hustleup.marketplace.listing.repository.ListingRepository;
import com.hustleup.marketplace.listing.model.ListingStatus;
import com.hustleup.marketplace.listing.service.AlgoliaIndexService;
import com.hustleup.marketplace.shop.repository.ShopRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.time.LocalDateTime;
import java.util.UUID;
@Service @RequiredArgsConstructor
public class SellerSafetyService {
    private final SellerSafetyRepository states;
    private final UserRepository users;
    private final ListingRepository listings;
    private final ShopRepository shops;
    private final AlgoliaIndexService search;
    public boolean suspended(UUID id) { return states.existsBySellerIdAndSuspendedTrue(id); }
    public void requireActive(UUID id) {
        if (suspended(id)) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Seller is suspended");
    }
    @Transactional(propagation=Propagation.MANDATORY)
    public void lockAndRequireActive(UUID id) {
        users.findLockedById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Seller not found"));
        if (states.findLocked(id).map(SellerSafety::isSuspended).orElse(false))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Seller is suspended");
    }
    /** Commits independently of external recovery/refund calls. */
    @Transactional(propagation=Propagation.REQUIRES_NEW)
    public SellerSafety suspend(UUID id, String reason, boolean refundOpenOrders) {
        if (reason == null || reason.isBlank() || reason.length() > 1000)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A reason of 1–1000 characters is required");
        users.findLockedById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Seller not found"));
        SellerSafety state = states.findLocked(id).orElseGet(SellerSafety::new);
        state.setSellerId(id); state.setSuspended(true); state.setReason(reason);
        state.setRefundOpenOrders(state.isRefundOpenOrders() || refundOpenOrders);
        if (state.getSuspendedAt() == null) state.setSuspendedAt(LocalDateTime.now());
        hide(id);
        return states.save(state);
    }
    public void hide(UUID id) {
        for (var listing : listings.findBySellerId(id)) {
            if (listing.getStatus() == ListingStatus.ACTIVE) {
                listing.setStatus(ListingStatus.PAUSED); listings.save(listing);
            }
            search.deleteListing(listing.getId().toString());
        }
        shops.findByOwnerId(id).ifPresent(shop -> { shop.setPublished(false); shops.save(shop); });
    }
}
