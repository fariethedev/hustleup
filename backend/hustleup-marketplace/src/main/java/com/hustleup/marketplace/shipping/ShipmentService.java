package com.hustleup.marketplace.shipping;

import com.hustleup.common.email.EmailService;
import com.hustleup.common.model.Notification;
import com.hustleup.common.model.User;
import com.hustleup.common.push.ExpoPushService;
import com.hustleup.common.repository.NotificationRepository;
import com.hustleup.common.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Moves an order along its delivery track and tells the people waiting on it.
 *
 * <p><b>Why one service for two order types.</b> Marketplace bookings and storefront
 * orders are separate entities, but the delivery story is identical: money lands, the
 * seller packs it, a carrier takes it, the buyer gets it. Both hold the same
 * {@link Fulfilment} value object, so both go through here — which is what stops the two
 * flows from developing different rules about what a seller may do, or different wording
 * for the same event.
 *
 * <p><b>Notification is best-effort.</b> Every send is individually swallowed. A mail
 * server being down must not roll back a seller's tracking update or, worse, fail the
 * Stripe webhook and have the payment retried.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ShipmentService {

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;
    private final EmailService emailService;
    private final ExpoPushService expoPushService;

    /** In-app notification type for everything on the delivery track. */
    public static final String NOTIFICATION_TYPE = "ORDER";

    // -------------------------------------------------------------------------
    // Payment
    // -------------------------------------------------------------------------

    /**
     * Starts the delivery track for an order that has just been paid for.
     *
     * <p>Called from the Stripe webhook, which is the only place that knows money actually
     * arrived. Both sides are told, because both have something to do next: the buyer now
     * has an order to follow, and the seller now owes them goods.
     *
     * @param fulfilment the order's delivery state, mutated in place by this call
     * @param itemName   what was bought, used in the notification copy
     * @param orderId    the booking or shop-order id, so the alert can deep-link to it
     */
    public void confirmPaid(Fulfilment fulfilment, String itemName, UUID orderId,
                            UUID buyerId, UUID sellerId) {
        // Guard against a webhook Stripe has replayed: without this, a retried
        // checkout.session.completed would drag an order the seller has already marked
        // SHIPPED back to CONFIRMED, and re-announce it to both of them.
        if (fulfilment.getFulfilmentStatus() != null
                && fulfilment.getFulfilmentStatus() != FulfilmentStatus.AWAITING_PAYMENT) {
            return;
        }

        fulfilment.setFulfilmentStatus(FulfilmentStatus.CONFIRMED);
        fulfilment.setUpdatedAt(LocalDateTime.now());

        ShippingMethod method = fulfilment.methodOrDefault();
        String howItArrives = method == ShippingMethod.NONE
                ? "The seller will be in touch to arrange it."
                : "Delivery method: " + method.label() + ". You will see each step in your dashboard.";

        notify(buyerId, orderId,
                "Payment confirmed — " + itemName,
                "Your order is confirmed and the seller has been notified. " + howItArrives);

        notify(sellerId, orderId,
                "You have been paid for " + itemName,
                "Payment has cleared. Update the delivery status from your dashboard so the buyer "
                + "can follow it — you are sending this by " + method.label().toLowerCase() + ".");
    }

    // -------------------------------------------------------------------------
    // Seller updates
    // -------------------------------------------------------------------------

    /**
     * Applies a seller's tracking update.
     *
     * <p>Only fields present on the request are written, so a seller adding a note later
     * does not blank the tracking number they entered earlier. The buyer is notified only
     * when the status itself moves — otherwise correcting a typo in a carrier name would
     * ping them as though the parcel had gone somewhere.
     *
     * @return null on success, or a human-readable reason the update was rejected
     */
    public String applyUpdate(Fulfilment fulfilment, FulfilmentUpdateRequest request,
                              String itemName, UUID orderId, UUID buyerId) {

        ShippingMethod method = fulfilment.methodOrDefault();
        FulfilmentStatus previous = fulfilment.getFulfilmentStatus();

        FulfilmentStatus target;
        try {
            target = request.getStatus() == null
                    ? previous
                    : FulfilmentStatus.valueOf(request.getStatus().trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return "Unknown delivery status \"" + request.getStatus() + "\".";
        }
        if (target == null) return "No delivery status given.";

        if (!method.allows(target)) {
            return "An order sent by " + method.label().toLowerCase()
                   + " never reaches \"" + label(target) + "\". Allowed: " + method.steps() + ".";
        }
        // An unpaid order has nothing to track. Letting a seller mark it shipped would show
        // the buyer a parcel on its way for something they were never charged for.
        if (previous == FulfilmentStatus.AWAITING_PAYMENT && target != FulfilmentStatus.CANCELLED) {
            return "This order has not been paid for yet, so there is nothing to send.";
        }

        if (request.getCarrier() != null)        fulfilment.setCarrier(blankToNull(request.getCarrier()));
        if (request.getTrackingNumber() != null) fulfilment.setTrackingNumber(blankToNull(request.getTrackingNumber()));
        if (request.getTrackingUrl() != null)    fulfilment.setTrackingUrl(blankToNull(request.getTrackingUrl()));
        if (request.getDropoffPoint() != null)   fulfilment.setDropoffPoint(blankToNull(request.getDropoffPoint()));
        if (request.getNote() != null)           fulfilment.setNote(blankToNull(request.getNote()));
        if (request.getEstimatedDelivery() != null) {
            fulfilment.setEstimatedDelivery(request.parseEstimatedDelivery());
        }

        fulfilment.setFulfilmentStatus(target);
        fulfilment.setUpdatedAt(LocalDateTime.now());

        // First time only: these read as "when did it ship", not "when was it last touched",
        // so a seller correcting a typo afterwards must not move them.
        if (fulfilment.getShippedAt() == null
                && (target == FulfilmentStatus.SHIPPED || target == FulfilmentStatus.OUT_FOR_DELIVERY)) {
            fulfilment.setShippedAt(LocalDateTime.now());
        }
        if (target.isComplete() && fulfilment.getDeliveredAt() == null) {
            fulfilment.setDeliveredAt(LocalDateTime.now());
        }

        if (target != previous) {
            notify(buyerId, orderId, buyerHeadline(target, itemName), buyerBody(target, fulfilment));
        }
        return null;
    }

    // -------------------------------------------------------------------------
    // Buyer-facing copy
    // -------------------------------------------------------------------------

    /** Written from the buyer's point of view — they are being told about their own order. */
    private String buyerHeadline(FulfilmentStatus status, String itemName) {
        return switch (status) {
            case PREPARING        -> "Your order is being prepared — " + itemName;
            case SHIPPED          -> "Your order has been sent — " + itemName;
            case OUT_FOR_DELIVERY -> "Out for delivery — " + itemName;
            case READY_FOR_PICKUP -> "Ready to collect — " + itemName;
            case DELIVERED        -> "Delivered — " + itemName;
            case COLLECTED        -> "Collected — " + itemName;
            case CANCELLED        -> "Order cancelled — " + itemName;
            default               -> "Order update — " + itemName;
        };
    }

    private String buyerBody(FulfilmentStatus status, Fulfilment f) {
        StringBuilder body = new StringBuilder(switch (status) {
            case PREPARING        -> "The seller is getting your order ready.";
            case SHIPPED          -> "The seller has handed your order to "
                                     + (f.getCarrier() != null ? f.getCarrier() : "the carrier") + ".";
            case OUT_FOR_DELIVERY -> "Your order is out for delivery.";
            case READY_FOR_PICKUP -> "Your order is waiting for you"
                                     + (f.getDropoffPoint() != null ? " at " + f.getDropoffPoint() : "") + ".";
            case DELIVERED        -> "Your order has been delivered.";
            case COLLECTED        -> "Your order is marked as collected.";
            case CANCELLED        -> "The seller has cancelled the delivery of this order.";
            default               -> "There is an update on your order.";
        });

        if (f.getTrackingNumber() != null) {
            body.append(" Tracking: ").append(f.getTrackingNumber()).append(".");
        }
        if (f.getEstimatedDelivery() != null && !status.isComplete()) {
            body.append(" Expected by ").append(f.getEstimatedDelivery()).append(".");
        }
        if (f.getNote() != null) {
            body.append(" Seller says: ").append(f.getNote());
        }
        return body.toString();
    }

    /** "OUT_FOR_DELIVERY" reads badly in an error message aimed at a seller. */
    private String label(FulfilmentStatus status) {
        String name = status.name();
        return name.charAt(0) + name.substring(1).toLowerCase().replace('_', ' ');
    }

    // -------------------------------------------------------------------------
    // Delivery of the notification itself
    // -------------------------------------------------------------------------

    /**
     * One order event, delivered every way this user can receive it: the in-app bell (which
     * the global alert listener polls and surfaces as a toast), email, and mobile push.
     */
    private void notify(UUID userId, UUID orderId, String title, String message) {
        if (userId == null) return;
        try {
            notificationRepository.save(Notification.builder()
                    .userId(userId)
                    .title(title)
                    .message(message)
                    .notificationType(NOTIFICATION_TYPE)
                    .referenceId(orderId)
                    .build());
        } catch (Exception e) {
            log.warn("Could not store order notification for {}: {}", userId, e.getMessage());
        }

        try {
            User user = userRepository.findById(userId).orElse(null);
            if (user == null) return;
            emailService.send(user.getEmail(), title,
                    "<p>" + escape(message) + "</p><p>Track it in your HustleSpace dashboard.</p>");
            expoPushService.send(user.getPushToken(), title, message);
        } catch (Exception e) {
            log.warn("Could not send order notification to {}: {}", userId, e.getMessage());
        }
    }

    /** The note is seller-typed free text going into an HTML email body. */
    private String escape(String text) {
        return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
