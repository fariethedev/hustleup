package com.hustleup.marketplace.booking.service;

import com.hustleup.marketplace.booking.model.*;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import java.math.BigDecimal;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;

class NegotiationRulesTest {
    @Test void participantsAlternateUntilAgreement() {
        UUID buyer = UUID.randomUUID(), seller = UUID.randomUUID();
        Booking b = Booking.builder().buyerId(buyer).sellerId(seller).status(BookingStatus.INQUIRED).version(0L).build();
        assertThrows(ResponseStatusException.class, () -> NegotiationRules.respond(b, buyer, 0L));
        assertDoesNotThrow(() -> NegotiationRules.respond(b, seller, 0L));
        b.setStatus(BookingStatus.NEGOTIATING); b.setLastOfferBy(seller); b.setVersion(1L);
        assertThrows(ResponseStatusException.class, () -> NegotiationRules.respond(b, seller, 1L));
        assertThrows(ResponseStatusException.class, () -> NegotiationRules.respond(b, buyer, 0L));
        assertThrows(ResponseStatusException.class, () -> NegotiationRules.respond(b, UUID.randomUUID(), 1L));
        assertDoesNotThrow(() -> NegotiationRules.respond(b, buyer, 1L));
        b.setLastOfferBy(buyer); b.setVersion(2L);
        assertDoesNotThrow(() -> NegotiationRules.respond(b, seller, 2L));
        b.setStatus(BookingStatus.BOOKED);
        assertThrows(ResponseStatusException.class, () -> NegotiationRules.respond(b, seller, 2L));
    }
    @Test void validatesMoney() {
        for (String bad : new String[]{"0", "-1", "1.001", "1000001"})
            assertThrows(ResponseStatusException.class, () -> NegotiationRules.price(new BigDecimal(bad)));
        assertThrows(ResponseStatusException.class, () -> NegotiationRules.price(null));
        assertDoesNotThrow(() -> NegotiationRules.price(new BigDecimal("9.99")));
    }
}
