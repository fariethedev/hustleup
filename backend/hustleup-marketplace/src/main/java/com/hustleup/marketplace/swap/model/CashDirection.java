package com.hustleup.marketplace.swap.model;

/**
 * Which side of a swap puts money on the table.
 *
 * <h3>Why a direction and not a signed number</h3>
 * <p>A single signed {@code cashAmount} would encode the same information in half the
 * columns, but "-800" only means "the owner pays" if you already know the sign convention,
 * and every read site — the API, two screens, a notification, a future statement — would
 * have to know it too. One of them eventually gets it backwards and tells somebody they are
 * owed money they actually owe. A named direction cannot be misread.
 *
 * <h3>Why the amount is a top-up, never the whole offer</h3>
 * <p>An offer still has to put up an item or a skill: cash alone is not a swap, it is a
 * purchase, and the booking flow already does purchases properly with Stripe behind it.
 * Allowing a cash-only "swap" would route real money through a feature with no payment leg.
 */
public enum CashDirection {

    /**
     * The proposer adds money on top of what they are offering.
     *
     * <p>The common case, and the one people mean by "swap and top": trading up, e.g. an
     * iPhone 12 plus 800 PLN for an iPhone 15.
     */
    PROPOSER_PAYS,

    /**
     * The listing owner adds money on top of the item the proposer wants.
     *
     * <p>Trading down — offering something worth more and asking for the difference back.
     * Less common but exactly as real, and leaving it out would force those trades to be
     * agreed in the message field where nothing can act on them.
     */
    OWNER_PAYS;

    /** How the proposer would describe it. Used for notification and summary copy. */
    public String describe(String amount) {
        return this == PROPOSER_PAYS
                ? "plus " + amount + " from them"
                : "and " + amount + " back to them";
    }
}
