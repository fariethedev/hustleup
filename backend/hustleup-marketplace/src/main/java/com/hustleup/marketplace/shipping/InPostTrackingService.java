package com.hustleup.marketplace.shipping;
import com.fasterxml.jackson.databind.JsonNode;
import com.hustleup.common.repository.UserRepository;
import com.hustleup.marketplace.booking.repository.BookingRepository;
import com.hustleup.marketplace.shop.repository.ShopOrderRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.data.domain.PageRequest;
import java.time.*;
import java.util.UUID;
@Service @RequiredArgsConstructor @Slf4j
public class InPostTrackingService {
    private final InPostClient client;
    private final BookingRepository bookings;
    private final ShopOrderRepository orders;
    private final UserRepository users;
    private final CarrierBindingRepository bindings;
    private final PlatformTransactionManager transactions;
    @Value("${app.inpost.enabled:false}") private boolean enabled;
    @Scheduled(fixedDelayString="${app.inpost.poll-ms:900000}")
    public void poll() {
        if (!enabled || !client.configured()) return;
        for (var b : bookings.findPendingInPost(PageRequest.of(0,100))) {
            try { new TransactionTemplate(transactions).executeWithoutResult(status -> {
                var current = bookings.findLockedById(b.getId()).orElseThrow();
                check(current.getFulfilment(), "booking:"+b.getId(), current.getBuyerId(), current.getCreatedAt());
                bookings.save(current);
            }); } catch (Exception e) { log.warn("InPost verification pending for booking {}", b.getId()); }
        }
        for (var o : orders.findPendingInPost(PageRequest.of(0,100))) {
            try { new TransactionTemplate(transactions).executeWithoutResult(status -> {
                var current = orders.findLockedById(o.getId()).orElseThrow();
                check(current.getFulfilment(), "shop:"+o.getId(), current.getBuyerId(), current.getCreatedAt());
                orders.save(current);
            }); } catch (Exception e) { log.warn("InPost verification pending for shop order {}", o.getId()); }
        }
    }
    private void check(Fulfilment f, String reference, UUID buyer, LocalDateTime created) {
        f.setCarrierCheckedAt(LocalDateTime.now());
        try {
            var evidence = client.fetch(f.getTrackingNumber());
            String email = users.findById(buyer).orElseThrow().getEmail();
            LocalDateTime delivered = verify(evidence, f.getTrackingNumber(), reference, email, created);
            f.setCarrierVerificationError(null);
            if (delivered == null) return;
            var existing = bindings.findById(f.getTrackingNumber());
            if (existing.isPresent() && !reference.equals(existing.get().getOrderReference()))
                throw new IllegalStateException("Tracking already belongs to another order");
            var binding = existing.orElseGet(CarrierBinding::new);
            binding.setTrackingNumber(f.getTrackingNumber()); binding.setOrderReference(reference);
            bindings.saveAndFlush(binding);
            f.setCarrierConfirmedAt(delivered);
        } catch (Exception e) {
            // No release on missing/mismatched data or upstream failures. Do not expose HTTP bodies/tokens.
            f.setCarrierVerificationError("InPost delivery could not be verified; buyer confirmation remains available");
        }
    }
    static LocalDateTime verify(InPostClient.Evidence evidence, String tracking, String reference,
                                String buyerEmail, LocalDateTime created) {
        JsonNode shipment=evidence.shipment(), history=evidence.tracking();
        if (shipment==null || history==null || buyerEmail==null || created==null
                || !tracking.equals(shipment.path("tracking_number").asText())
                || !tracking.equals(history.path("tracking_number").asText())
                || !reference.equals(shipment.path("reference").asText())
                || !buyerEmail.equalsIgnoreCase(shipment.path("receiver").path("email").asText())
                || shipment.path("is_return").asBoolean()) throw new IllegalArgumentException("Shipment/order mismatch");
        LocalDateTime shipped = local(shipment.path("created_at").asText());
        if (shipped.isBefore(created) || shipped.isAfter(LocalDateTime.now().plusMinutes(5)))
            throw new IllegalArgumentException("Shipment predates order or is in the future");
        if (!"delivered".equals(history.path("status").asText())) return null;
        for (JsonNode event : history.path("tracking_details")) {
            if ("delivered".equals(event.path("status").asText())) {
                LocalDateTime delivered = local(event.path("datetime").asText());
                if (delivered.isBefore(shipped) || delivered.isAfter(LocalDateTime.now().plusMinutes(5)))
                    throw new IllegalArgumentException("Invalid delivery time");
                return delivered;
            }
        }
        throw new IllegalArgumentException("Delivery event missing");
    }
    private static LocalDateTime local(String iso) {
        return OffsetDateTime.parse(iso).atZoneSameInstant(ZoneId.systemDefault()).toLocalDateTime();
    }
}
