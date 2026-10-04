package com.hustleup.marketplace.booking.service;
import com.hustleup.marketplace.booking.model.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.math.BigDecimal;
import java.util.UUID;

public final class NegotiationRules {
    private NegotiationRules() {}
    public static void price(BigDecimal amount) {
        if (amount == null || amount.signum() <= 0 || amount.scale() > 2 || amount.compareTo(new BigDecimal("1000000")) > 0)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Enter a positive price with at most two decimal places");
    }
    public static void respond(Booking booking, UUID actor, Long version) {
        if (!actor.equals(booking.getBuyerId()) && !actor.equals(booking.getSellerId()))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "This is not your negotiation");
        if (booking.getStatus() != BookingStatus.INQUIRED && booking.getStatus() != BookingStatus.NEGOTIATING)
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This negotiation is no longer open");
        if (version != null && !version.equals(booking.getVersion()))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "The offer changed. Review the latest price before responding");
        UUID last = booking.getLastOfferBy() != null ? booking.getLastOfferBy()
                : booking.getStatus() == BookingStatus.NEGOTIATING ? booking.getSellerId() : booking.getBuyerId();
        if (actor.equals(last)) throw new ResponseStatusException(HttpStatus.CONFLICT, "Waiting for the other person to respond");
    }
}
