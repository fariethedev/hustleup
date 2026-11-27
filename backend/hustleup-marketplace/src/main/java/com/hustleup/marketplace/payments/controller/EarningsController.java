package com.hustleup.marketplace.payments.controller;

import com.hustleup.common.model.User;
import com.hustleup.common.repository.UserRepository;
import com.hustleup.common.storage.FileStorageService;
import com.hustleup.marketplace.booking.model.Booking;
import com.hustleup.marketplace.booking.model.BookingStatus;
import com.hustleup.marketplace.booking.repository.BookingRepository;
import com.hustleup.marketplace.listing.model.Listing;
import com.hustleup.marketplace.listing.repository.ListingRepository;
import com.hustleup.marketplace.payments.repository.SellerPayoutAccountRepository;
import com.hustleup.marketplace.payments.service.StripeConnectService;
import com.hustleup.marketplace.shop.model.ShopOrder;
import com.hustleup.marketplace.shop.repository.ShopOrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * A seller's earnings, the way a resale app shows them: money on its way (paid by the buyer,
 * held until they confirm receipt or the holding period ends) and money already released to
 * the seller's Stripe account.
 *
 * <p>Payment is captured on the platform account and transferred to the seller later, so a
 * seller's own Stripe dashboard shows nothing until release. Without this view a paid sale
 * looked like no sale at all.
 *
 * <p><b>GET /api/v1/payouts/earnings</b>
 */
@RestController
@RequestMapping("/api/v1/payouts")
@RequiredArgsConstructor
public class EarningsController {

    private final UserRepository userRepository;
    private final BookingRepository bookingRepository;
    private final ShopOrderRepository shopOrderRepository;
    private final ListingRepository listingRepository;
    private final SellerPayoutAccountRepository payoutAccountRepository;
    private final StripeConnectService stripeConnectService;
    private final FileStorageService fileStorageService;

    @Value("${app.payouts.hold-days:7}")
    private int holdDays = 7;

    @GetMapping("/earnings")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> earnings() {
        User seller = userRepository.findByEmail(SecurityContextHolder.getContext().getAuthentication().getName())
                .orElseThrow(() -> new RuntimeException("User not found"));
        List<Map<String, Object>> items = new ArrayList<>();
        Map<String, BigDecimal[]> totals = new TreeMap<>(); // currency -> [onTheWay, released]

        for (Booking b : bookingRepository.findBySellerIdOrderByCreatedAtDesc(seller.getId())) {
            String pay = b.getPaymentStatus();
            boolean held = "PAID".equals(pay) && b.getStatus() != BookingStatus.CANCELLED;
            boolean released = "TRANSFERRED".equals(pay);
            if (!held && !released) continue;
            Listing listing = listingRepository.findById(b.getListingId()).orElse(null);
            var f = b.getFulfilment();
            BigDecimal net = stripeConnectService.sellerNet(b.getAgreedPrice(), f == null ? null : f.shippingPriceOrZero());
            LocalDateTime releaseAt = !held ? null
                    : f != null && f.getBuyerConfirmedAt() != null ? LocalDateTime.now()
                    : f != null && f.getDeliveredAt() != null ? f.getDeliveredAt().plusDays(holdDays) : null;
            items.add(item("booking", b.getId().toString(), listing != null ? listing.getTitle() : "Booking",
                    listing != null ? firstImage(listing.getMediaUrls()) : null, net, b.getCurrency(), held,
                    releaseAt, released ? b.getUpdatedAt() : null,
                    f != null && f.getBuyerConfirmedAt() != null));
            add(totals, b.getCurrency(), net, held);
        }

        for (ShopOrder o : shopOrderRepository.findBySellerIdOrderByCreatedAtDesc(seller.getId())) {
            boolean paid = o.getStatus() == ShopOrder.ShopOrderStatus.PAID || o.getStatus() == ShopOrder.ShopOrderStatus.FULFILLED;
            boolean held = paid && "HELD".equals(o.getPayoutStatus());
            boolean released = "RELEASED".equals(o.getPayoutStatus());
            if (!held && !released) continue;
            var f = o.getFulfilment();
            BigDecimal net = stripeConnectService.sellerNet(o.getTotalPrice(), f == null ? null : f.shippingPriceOrZero());
            LocalDateTime releaseAt = !held ? null
                    : f != null && f.getBuyerConfirmedAt() != null ? LocalDateTime.now()
                    : f != null && f.getShippedAt() != null ? f.getShippedAt().plusDays(holdDays) : null;
            items.add(item("shop", o.getId().toString(), o.getProductName(), image(o.getProductImageUrl()), net,
                    o.getCurrency(), held, releaseAt, o.getReleasedAt(), f != null && f.getBuyerConfirmedAt() != null));
            add(totals, o.getCurrency(), net, held);
        }

        List<Map<String, Object>> summary = new ArrayList<>();
        totals.forEach((currency, t) -> summary.add(Map.of("currency", currency, "onTheWay", t[0], "released", t[1])));
        boolean payoutsEnabled = payoutAccountRepository.findBySellerId(seller.getId())
                .map(a -> a.isPayoutsEnabled()).orElse(false);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("totals", summary);
        body.put("items", items);
        body.put("payoutsEnabled", payoutsEnabled);
        body.put("holdDays", holdDays);
        body.put("platformFeePercent", stripeConnectService.getPlatformFeePercent());
        return ResponseEntity.ok().header("Cache-Control", "no-store").body(body);
    }

    private static void add(Map<String, BigDecimal[]> totals, String currency, BigDecimal net, boolean held) {
        BigDecimal[] t = totals.computeIfAbsent(currency == null ? "PLN" : currency, c -> new BigDecimal[]{BigDecimal.ZERO, BigDecimal.ZERO});
        if (held) t[0] = t[0].add(net); else t[1] = t[1].add(net);
    }

    private static Map<String, Object> item(String kind, String id, String title, String image, BigDecimal net,
                                            String currency, boolean held, LocalDateTime releaseAt,
                                            LocalDateTime releasedAt, boolean buyerConfirmed) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("kind", kind);
        m.put("id", id);
        m.put("title", title);
        m.put("image", image);
        m.put("net", net);
        m.put("currency", currency == null ? "PLN" : currency);
        m.put("state", held ? "ON_THE_WAY" : "RELEASED");
        m.put("buyerConfirmed", buyerConfirmed);
        m.put("releaseAt", releaseAt);
        m.put("releasedAt", releasedAt);
        return m;
    }

    private String firstImage(String mediaUrls) {
        if (mediaUrls == null || mediaUrls.isBlank()) return null;
        for (String raw : mediaUrls.split(",")) {
            String p = raw.trim();
            if (p.isEmpty() || p.toLowerCase().matches(".*\\.(mp4|mov|webm|m4v)(\\?.*)?$")) continue;
            return image(p);
        }
        return null;
    }

    private String image(String path) {
        if (path == null || path.isBlank()) return null;
        try { return fileStorageService.refreshUrl(path); } catch (Exception e) { return null; }
    }
}
