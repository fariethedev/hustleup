/**
 * The answer to a door scan.
 *
 * <p>A scanner is used at speed, in bad light, by someone holding a queue. So this never throws
 * for the ordinary "no" cases — an unknown code, someone else's event, a ticket already used —
 * it always returns 200 with {@link #admitted} set and a short {@link #reason} the door screen
 * can show in large type. Reserving exceptions for genuine faults means the scanner UI has
 * exactly one success path and one failure path to render.
 *
 * <p>{@link #outcome} is the machine-readable version of the same answer, so the UI can pick a
 * colour and a sound without string-matching the human sentence.
 */
package com.hustleup.marketplace.ticket.dto;

import lombok.*;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ScanResultDto {

    /** True only when this scan just admitted the holder. A repeat scan is false. */
    private boolean admitted;

    /**
     * One of:
     * <ul>
     *   <li>{@code ADMITTED} — valid ticket, now checked in</li>
     *   <li>{@code ALREADY_CHECKED_IN} — genuine ticket, but it has already been used</li>
     *   <li>{@code CANCELLED} — the booking behind it was cancelled or refunded</li>
     *   <li>{@code WRONG_EVENT} — a real HustleUp ticket, but for a different event</li>
     *   <li>{@code NOT_FOUND} — no such code, or the QR secret didn't match</li>
     * </ul>
     */
    private String outcome;

    /** Short sentence for the door screen, e.g. "Already checked in at 19:42". */
    private String reason;

    /** The ticket that was scanned, when one was found — lets the door show who just walked in. */
    private TicketDto ticket;

    /** Running total of admitted attendees for this event, so the door has a live head count. */
    private long checkedInCount;

    /** Tickets issued for this event that are still valid or already admitted (excludes cancelled). */
    private long totalTickets;
}
