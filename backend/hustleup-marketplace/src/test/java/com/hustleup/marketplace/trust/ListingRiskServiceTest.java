package com.hustleup.marketplace.trust;

import com.hustleup.marketplace.listing.repository.ListingRepository;
import com.hustleup.marketplace.payments.service.SellerRiskService;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ListingRiskServiceTest {
    private final ListingRepository listings = mock(ListingRepository.class);
    private final SellerRiskService sellerRisk = mock(SellerRiskService.class);
    private final ListingRiskService service = new ListingRiskService(listings, sellerRisk);
    private final UUID seller = UUID.randomUUID();

    private void sellerWithSales(long confirmed) {
        when(sellerRisk.status(any())).thenReturn(new SellerRiskService.Risk("T", 5, 0, confirmed, BigDecimal.ZERO, 0, 0, false));
    }

    @Test void holdsACheapIphoneFromANewSeller() {
        sellerWithSales(0);
        var reason = service.assess(seller, "iPhone 15 Pro 256GB", "Brand new", new BigDecimal("900"), "PLN");
        assertTrue(reason.isPresent());
        assertTrue(reason.get().contains("High-risk item"));
    }

    @Test void holdsCounterfeitWordingEvenFromEstablishedSellers() {
        sellerWithSales(50);
        assertTrue(service.assess(seller, "Designer bag", "1:1 replica, top quality", new BigDecimal("200"), "PLN").isPresent());
    }

    @Test void holdsPriceFarBelowSimilarListings() {
        sellerWithSales(50);
        when(listings.findActivePricesByTitleKeyword(anyString(), anyString())).thenReturn(List.of(
                new BigDecimal("3000"), new BigDecimal("3200"), new BigDecimal("3100"), new BigDecimal("2900"), new BigDecimal("3050")));
        var reason = service.assess(seller, "MacBook Air M2", "Works great", new BigDecimal("1100"), "PLN");
        assertTrue(reason.isPresent());
        assertTrue(reason.get().contains("under 40%"));
    }

    @Test void letsOrdinaryListingsGoLive() {
        sellerWithSales(0);
        assertFalse(service.assess(seller, "Wooden desk", "Solid oak, some scratches", new BigDecimal("250"), "PLN").isPresent());
    }

    @Test void letsAFairlyPricedPhoneFromAnEstablishedSellerGoLive() {
        sellerWithSales(20);
        when(listings.findActivePricesByTitleKeyword(anyString(), anyString())).thenReturn(List.of(
                new BigDecimal("3000"), new BigDecimal("3200"), new BigDecimal("3100"), new BigDecimal("2900"), new BigDecimal("3050")));
        assertFalse(service.assess(seller, "iPhone 15", "Used, boxed", new BigDecimal("2800"), "PLN").isPresent());
    }
}
