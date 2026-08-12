/**
 * Lifecycle states of a digital event ticket.
 *
 * <p>Stored as a string ({@link jakarta.persistence.EnumType#STRING}) so the database stays
 * readable and adding a state later can't shift the meaning of existing rows.
 */
package com.hustleup.marketplace.ticket.model;

public enum TicketStatus {

    /**
     * Issued and not yet used. This is the only state in which a ticket will pass a door scan.
     */
    VALID,

    /**
     * The organiser has scanned this ticket at the door and the holder is inside. Terminal for
     * the purposes of admission — a second scan of the same ticket is rejected, which is what
     * stops one ticket being screenshotted and shared around a queue.
     */
    CHECKED_IN,

    /**
     * Voided because the underlying booking was cancelled or refunded. Kept as a row rather
     * than deleted so a cancelled attendee still shows in the organiser's history and a
     * scan of the old QR gives an explicit "cancelled" answer instead of "unknown ticket".
     */
    CANCELLED
}
