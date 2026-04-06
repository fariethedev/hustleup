/**
 * Represents the lifecycle state of a {@link Listing}.
 *
 * <p>Listings transition through these states as sellers manage their offerings.
 * Only {@code ACTIVE} listings are returned by the public browse and search APIs;
 * all other states hide the listing from buyer-facing queries while preserving the
 * record in the database for auditing and potential reactivation.
 *
 * <p>This is a simple state machine without enforced transitions — the service layer
 * ({@link com.hustleup.listing.service.ListingService}) validates that the caller
 * owns the listing before changing its status.
 */
package com.hustleup.listing.model;

public enum ListingStatus {

    /**
     * The listing is live and visible to all buyers in browse, search, and
     * recommendations. This is the default state for newly created listings.
     */
    ACTIVE,

    /**
     * The seller has temporarily hidden the listing. It is not visible to buyers
     * but can be reactivated by the seller at any time. Useful when a seller is
     * on holiday or temporarily unable to fulfil orders.
     */
    PAUSED,

    /**
     * The listing's inventory or availability is exhausted. It remains visible
     * in the seller's own dashboard but is excluded from public browse results.
     * The seller can restock and switch back to {@code ACTIVE}.
     */
    SOLD_OUT,

    /**
     * The seller has permanently removed the listing. Soft-delete: the row is
     * kept in the database so that existing {@link com.hustleup.booking.model.Booking}
     * and {@link com.hustleup.review.model.Review} records that reference this
     * listing ID remain consistent. Deleted listings are never shown to buyers.
     */
    DELETED
}
