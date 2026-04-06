/**
 * Categorises every listing on the HustleUp marketplace into a distinct type.
 *
 * <p>The listing type drives how the platform presents a listing to buyers:
 * different types may surface in different browse filters, display different
 * metadata fields, and eventually feed into personalised recommendations.
 *
 * <p>In the database this enum is stored as its string name (e.g. {@code "SKILL"})
 * using {@link jakarta.persistence.EnumType#STRING} so that the data remains readable
 * and resilient to enum value reordering. See {@link Listing#listingType}.
 */
package com.hustleup.listing.model;

public enum ListingType {

    /** Hair care, braiding, loc styling, makeup, and related beauty services. */
    HAIR_BEAUTY,

    /** Food preparation, catering, meal delivery, and private dining experiences. */
    FOOD,

    /**
     * Ticketed or bookable live events: workshops, concerts, classes, etc.
     * The listing price typically represents a per-person ticket or session fee.
     */
    EVENT,

    /** Clothing, accessories, and wearable goods — both bespoke and ready-to-wear. */
    FASHION,

    /**
     * Physical products that can be purchased and shipped or collected.
     * Examples: candles, art prints, crafts. Distinct from FASHION (wearables)
     * and FOOD (consumables) for more precise browsing.
     */
    GOODS,

    /**
     * Freelance skills and professional services offered on a project or hourly basis.
     * Examples: web development, graphic design, photography, tutoring.
     */
    SKILL,

    /**
     * Employment opportunities posted by businesses or individuals looking to hire.
     * The listing price may represent an hourly rate or an annual salary.
     */
    JOB
}
