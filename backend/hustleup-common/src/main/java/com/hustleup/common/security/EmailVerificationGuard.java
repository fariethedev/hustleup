package com.hustleup.common.security;

import com.hustleup.common.model.User;
import org.springframework.stereotype.Component;

/**
 * Stops an unverified account from doing the two things that actually need a reachable
 * address: buying and selling.
 *
 * <h3>Why login itself no longer blocks on this</h3>
 * Every account created before email verification existed has {@code emailVerified = false}
 * — nobody backfilled it, because there was nothing to backfill it from. Once outbound mail
 * started working, {@code AuthController#login} began refusing every one of those accounts at
 * the door, re-issuing a code they had never been asked for and had no reason to expect. That
 * is not "confirm your email to finish signing up" — signing up finished months ago for these
 * accounts — it is locking out the entire existing user base of the app in one deploy.
 *
 * <p>Verification still matters — a seller HustleSpace cannot reach cannot be told a sale
 * went wrong, and a buyer with no working address cannot be told their order shipped, or
 * recover their password if this ever needs asking again. So the requirement moves rather
 * than disappears: an already-registered account can always log in, and is asked to verify at
 * the moment it tries to buy or sell, not before.
 *
 * <h3>Why this throws instead of returning a boolean</h3>
 * {@link #require} is meant to read as a guard clause at the top of the method it protects,
 * the same shape as every ownership check already written that way in this codebase
 * ({@code if (!x) throw new RuntimeException(...)}). The thrown exception carries the email
 * and the action attempted; {@code GlobalExceptionHandler#handleEmailNotVerified} turns it
 * into a 403 with {@code emailVerificationRequired: true}, the same shape
 * {@code AuthController#login} already uses for the pre-existing "confirm your email"
 * response. One flag, one meaning, wherever the client sees it.
 */
@Component
public class EmailVerificationGuard {

    /** Thrown by {@link #require} when the account has not confirmed its address. */
    public static class EmailNotVerifiedException extends RuntimeException {
        private final String email;

        public EmailNotVerifiedException(User user, String action) {
            super("Verify your email to " + action + " on HustleSpace.");
            this.email = user.getEmail();
        }

        public String getEmail() {
            return email;
        }
    }

    /**
     * @param user   the account attempting the action; assumed non-null, since every caller
     *               has already resolved the authenticated user before reaching here
     * @param action a short present-tense verb phrase completing "Verify your email to ___
     *               on HustleSpace." — e.g. {@code "list an item"}, {@code "buy this"}
     * @throws EmailNotVerifiedException if the account's email is unconfirmed
     */
    public void require(User user, String action) {
        if (!user.isEmailVerified()) {
            throw new EmailNotVerifiedException(user, action);
        }
    }
}
