package com.hustleup.marketplace.shipping;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;

/**
 * A seller's tracking update, as posted from the dashboard.
 *
 * <p>Every field except {@code status} is optional and null means "leave alone" — the
 * seller who ships a parcel on Monday and adds the courier's reference on Tuesday should
 * not lose Monday's note by not retyping it. {@link ShipmentService#applyUpdate} is what
 * enforces that; this class only carries the values.
 */
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class FulfilmentUpdateRequest {

    /** Target {@link FulfilmentStatus} name, e.g. "SHIPPED". Case-insensitive. */
    private String status;

    private String carrier;
    private String trackingNumber;
    private String trackingUrl;
    private String dropoffPoint;
    private String note;

    /**
     * ISO date ("2026-09-04") from an {@code <input type="date">}.
     *
     * <p>Held as a String rather than a {@link LocalDate} so a browser sending an empty
     * value — which is what a cleared date input posts — is treated as "no estimate given"
     * instead of failing the whole update with a deserialisation error.
     */
    private String estimatedDelivery;

    /** @return the parsed date, or null if absent or not a date this parser understands. */
    public LocalDate parseEstimatedDelivery() {
        if (estimatedDelivery == null || estimatedDelivery.isBlank()) return null;
        try {
            return LocalDate.parse(estimatedDelivery.trim());
        } catch (Exception e) {
            return null;
        }
    }
}
