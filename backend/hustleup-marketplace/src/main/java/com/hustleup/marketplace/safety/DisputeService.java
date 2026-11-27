package com.hustleup.marketplace.safety;
import com.hustleup.marketplace.booking.repository.BookingRepository;
import com.hustleup.marketplace.shop.repository.ShopOrderRepository;
import com.hustleup.marketplace.payments.service.StripeConnectService;
import com.hustleup.common.repository.UserRepository;
import com.stripe.model.Dispute;
import com.stripe.model.PaymentIntent;
import com.stripe.net.RequestOptions;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.LocalDateTime;
import java.util.*;
@Service @RequiredArgsConstructor @Slf4j
public class DisputeService {
    private final PaymentDisputeRepository disputes;
    private final BookingRepository bookings;
    private final ShopOrderRepository orders;
    private final SellerSafetyService safety;
    private final SuspensionRecoveryService suspensionRecovery;
    private final UserRepository users;
    private final StripeConnectService stripe;
    private final PlatformTransactionManager transactions;
    private final JdbcTemplate jdbc;
    private TransactionTemplate tx() {
        var tx = new TransactionTemplate(transactions);
        tx.setPropagationBehavior(org.springframework.transaction.TransactionDefinition.PROPAGATION_REQUIRES_NEW); return tx;
    }
    /** Fetch current state so replayed/out-of-order webhook payloads cannot reopen a closed dispute. */
    public void handle(String id) {
        try {
            Dispute current = Dispute.retrieve(id);
            String pi = current.getPaymentIntent();
            if (pi == null) pi = com.stripe.model.Charge.retrieve(current.getCharge()).getPaymentIntent();
            if (pi == null) throw new IllegalStateException("Dispute has no payment reference");
            final String payment = pi;
            tx().executeWithoutResult(status -> {
                var row = disputes.findLocked(id).orElseGet(PaymentDispute::new);
                row.setId(id); row.setPaymentIntentId(payment); row.setStripeStatus(current.getStatus());
                row.setUpdatedAt(LocalDateTime.now()); disputes.save(row);
            });
            // Resolve metadata too: dispute delivery may precede the checkout-paid webhook.
            var bs = new LinkedHashMap<UUID, com.hustleup.marketplace.booking.model.Booking>();
            var os = new LinkedHashMap<UUID, com.hustleup.marketplace.shop.model.ShopOrder>();
            bookings.findAllByPaymentIntentId(payment).forEach(b -> bs.put(b.getId(), b));
            orders.findAllByPaymentIntentId(payment).forEach(o -> os.put(o.getId(), o));
            var meta = PaymentIntent.retrieve(payment).getMetadata();
            if (meta != null) {
                for (UUID key : ids(meta.get("bookingIds"))) bookings.findById(key).ifPresent(b -> bs.put(key,b));
                for (UUID key : ids(meta.get("shopOrderIds"))) orders.findById(key).ifPresent(o -> os.put(key,o));
                for (UUID key : ids(meta.get("bookingId"))) bookings.findById(key).ifPresent(b -> bs.put(key,b));
            }
            Set<UUID> sellers = new TreeSet<>();
            bs.values().forEach(b -> sellers.add(b.getSellerId())); os.values().forEach(o -> sellers.add(o.getSellerId()));
            if (sellers.isEmpty()) throw new IllegalStateException("No marketplace orders mapped; manual reconciliation required");
            for (UUID seller : sellers) safety.suspend(seller, "Stripe chargeback " + id, false);
            for (UUID seller : sellers) suspensionRecovery.recover(seller);
            tx().executeWithoutResult(status -> {
                for (UUID seller : sellers) users.findLockedById(seller).orElseThrow();
                var row = disputes.findLocked(id).orElseThrow();
                StringBuilder evidence = new StringBuilder("Marketplace order records. Seller-entered tracking is not proof of delivery.\n");
                boolean recovered = true;
                for (UUID key : bs.keySet()) {
                    var b = bookings.findLockedById(key).orElseThrow();
                    b.setPaymentIntentId(payment); b.setPaymentStatus("DISPUTED");
                    evidence.append("Booking ").append(key).append(" amount ").append(b.getAgreedPrice()).append(' ').append(b.getCurrency()).append('\n');
                    appendDelivery(evidence, b.getFulfilment());
                    // Include only messages explicitly attached to this booking, never unrelated chats.
                    try {
                        var chat = jdbc.queryForList("SELECT sender_id, content, created_at FROM direct_messages WHERE offer_booking_id = ? AND deleted_at IS NULL ORDER BY created_at LIMIT 50", key.toString());
                        evidence.append("Booking-linked chat: ").append(chat).append('\n');
                    } catch (org.springframework.dao.DataAccessException e) {
                        evidence.append("Booking-linked chat unavailable; not included.\n");
                    }
                    try { if (b.getTransferId() != null) stripe.recoverTransfer(b.getTransferId()); }
                    catch (Exception e) { recovered = false; }
                    bookings.save(b);
                }
                for (UUID key : os.keySet()) {
                    var o = orders.findLockedById(key).orElseThrow();
                    o.setPaymentIntentId(payment); o.setPayoutStatus("DISPUTED");
                    evidence.append("Shop order ").append(key).append(" item ").append(o.getProductName()).append(" amount ").append(o.grandTotal()).append(' ').append(o.getCurrency()).append('\n');
                    appendDelivery(evidence, o.getFulfilment());
                    try { if (o.getTransferId() != null) stripe.recoverTransfer(o.getTransferId()); }
                    catch (Exception e) { recovered = false; }
                    orders.save(o);
                }
                row.setRecovered(recovered);
                row.setLastError(recovered ? null : "Seller transfer recovery pending; retry scheduled");
                String text = evidence.substring(0, Math.min(18000, evidence.length()));
                if (row.getEvidence() == null) row.setEvidence(text);
                row.setUpdatedAt(LocalDateTime.now()); disputes.save(row);
            });
            // The immutable evidence is committed before calling Stripe, so retries after
            // a successful API call followed by a DB failure use exactly the same payload.
            tx().executeWithoutResult(status -> {
                var row = disputes.findLocked(id).orElseThrow();
                if (!row.isEvidenceSubmitted() && "needs_response".equals(current.getStatus())) {
                    try {
                        current.update(Map.of("evidence", Map.of("uncategorized_text", row.getEvidence()), "submit", true),
                                RequestOptions.builder().setIdempotencyKey("dispute-evidence-" + id).build());
                        row.setEvidenceSubmitted(true);
                    } catch (Exception e) { row.setLastError("Evidence submission pending; retry scheduled"); }
                }
                disputes.save(row);
            });
        } catch (Exception e) {
            log.warn("Dispute {} needs retry: {}", id, e.getClass().getSimpleName());
            tx().executeWithoutResult(status -> disputes.findLocked(id).ifPresent(row -> {
                row.setLastError("Dispute processing incomplete; retry or manual reconciliation required");
                row.setUpdatedAt(LocalDateTime.now()); disputes.save(row);
            }));
            throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_GATEWAY,
                    "Dispute processing incomplete; retry required", e);
        }
    }
    private List<UUID> ids(String csv) {
        if (csv == null || csv.isBlank()) return List.of();
        return Arrays.stream(csv.split(",")).map(String::trim).map(UUID::fromString).toList();
    }
    private void appendDelivery(StringBuilder text, com.hustleup.marketplace.shipping.Fulfilment f) {
        text.append("Carrier: ").append(f.getCarrier()).append("; seller-entered tracking: ").append(f.getTrackingNumber())
            .append("; buyer confirmed: ").append(f.getBuyerConfirmedAt()).append("; carrier verified delivery: ")
            .append(f.getCarrierConfirmedAt()).append('\n');
    }
    @Scheduled(fixedDelayString="${app.safety.retry-ms:300000}")
    public void retry() {
        for (var row : disputes.findByRecoveredFalseOrEvidenceSubmittedFalse()) {
            if (row.isRecovered() && !"needs_response".equals(row.getStripeStatus())) continue;
            try { handle(row.getId()); } catch (Exception ignored) { /* webhook/job will retry */ }
        }
    }
}
