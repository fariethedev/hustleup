package com.hustleup.common.model;

/**
 * Enumeration of all user roles recognised by the HustleUp platform.
 *
 * <p><b>Why an enum?</b><br>
 * Using a Java {@code enum} instead of a plain {@code String} field has several advantages:
 * <ul>
 *   <li>The compiler enforces valid values — you cannot accidentally assign "SUPERUSER" or
 *       a typo like "SELER".</li>
 *   <li>Switch statements and pattern matching are exhaustive, so the IDE warns you when a
 *       new role is added but not handled.</li>
 *   <li>JPA stores it as a readable string (configured via {@code @Enumerated(EnumType.STRING)}
 *       on {@link User#role}) rather than a fragile integer ordinal.</li>
 * </ul>
 *
 * <p><b>Architecture note:</b><br>
 * This enum is defined in {@code hustleup-common} so every microservice shares exactly the
 * same role vocabulary. JWT tokens embed the role name as a claim (see
 * {@link com.hustleup.common.security.JwtTokenProvider}), and Spring Security converts it
 * to a {@code GrantedAuthority} (e.g. {@code ROLE_SELLER}) inside
 * {@link com.hustleup.common.security.CommonJwtFilter}.
 */
public enum Role {

    /**
     * A regular consumer who browses listings and makes purchases.
     *
     * <p>This is the default role assigned to every new account. A buyer can upgrade to
     * SELLER during the onboarding flow.
     */
    BUYER,

    /**
     * A user who has set up a shop and can create / manage listings.
     *
     * <p>Sellers have additional permissions such as accessing the seller dashboard,
     * managing orders, and responding to reviews. Access is gated by the
     * {@code ROLE_SELLER} Spring Security authority.
     */
    SELLER,

    /**
     * A platform administrator with elevated privileges.
     *
     * <p>Admins can moderate content, verify IDs, resolve disputes, and perform actions
     * not available to regular users. Admin endpoints are protected by the
     * {@code ROLE_ADMIN} Spring Security authority and should never be exposed to the
     * public internet without additional authentication layers.
     */
    ADMIN
}
