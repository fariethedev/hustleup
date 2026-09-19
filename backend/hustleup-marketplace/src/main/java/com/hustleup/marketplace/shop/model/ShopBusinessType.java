package com.hustleup.marketplace.shop.model;

/**
 * What kind of business a shop is, and the one thing that actually follows from it: whether
 * buyers book a time slot or add something to a cart.
 *
 * <p>{@link Shop#getCategory()} stayed free text on purpose — "sellers name their own niche" —
 * and this does not change that. A salon typed as "Hair & Beauty" and one typed as "Beauty
 * Salon" are the same business to a human but not to code, so nothing about what features a
 * shop gets can be decided by parsing that string. This is the second, structured field a
 * shop now also carries: a fixed list the owner picks from at creation, existing only to
 * answer one question — {@link #isAppointmentBased()} — which is what {@code ShopManager}
 * and {@code ShopDetail} use to decide whether this shop's owner needs a services-and-slots
 * calendar or a product shelf.
 *
 * <h3>Why one flag and not two parallel feature sets</h3>
 * <p>A hair salon still sells product some of the time (shampoo on the counter) and a
 * clothing shop never takes a booking, so this is not exclusive — an appointment-based shop
 * keeps its product shelf too, it just also gets the booking calendar. {@link #GENERAL} is
 * the default for every shop created before this existed, and for anyone who genuinely just
 * wants a shelf.
 */
public enum ShopBusinessType {

    GENERAL("General store", Kind.CATALOGUE),
    CLOTHING_FASHION("Clothing & Fashion", Kind.CATALOGUE),
    GROCERY_FOOD("Grocery & Food", Kind.CATALOGUE),
    ELECTRONICS("Electronics", Kind.CATALOGUE),
    BOOKS_STATIONERY("Books & Stationery", Kind.CATALOGUE),
    HOME_LIVING("Home & Living", Kind.CATALOGUE),
    BEAUTY_COSMETICS("Beauty & Cosmetics", Kind.CATALOGUE),

    HAIR_SALON("Hair Salon", Kind.APPOINTMENT),
    BARBERSHOP("Barbershop", Kind.APPOINTMENT),
    NAIL_STUDIO("Nail Studio", Kind.APPOINTMENT),
    SPA_MASSAGE("Spa & Massage", Kind.APPOINTMENT),
    TATTOO_PIERCING("Tattoo & Piercing", Kind.APPOINTMENT),
    FITNESS_TRAINING("Fitness & Personal Training", Kind.APPOINTMENT),
    TUTORING_LESSONS("Tutoring & Lessons", Kind.APPOINTMENT),
    REPAIR_SERVICES("Repairs & Technical Services", Kind.APPOINTMENT);

    public enum Kind { CATALOGUE, APPOINTMENT }

    private final String label;
    private final Kind kind;

    ShopBusinessType(String label, Kind kind) {
        this.label = label;
        this.kind = kind;
    }

    public String label() { return label; }

    public boolean isAppointmentBased() { return kind == Kind.APPOINTMENT; }

    /** Falls back to {@link #GENERAL} for null, blank, or a value from before this existed. */
    public static ShopBusinessType parse(String raw) {
        if (raw == null || raw.isBlank()) return GENERAL;
        try {
            return ShopBusinessType.valueOf(raw.trim().toUpperCase());
        } catch (IllegalArgumentException notARealValue) {
            return GENERAL;
        }
    }
}
