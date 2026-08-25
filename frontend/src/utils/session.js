/**
 * The localStorage keys that belong to a signed-in session, and the one function that
 * clears them.
 *
 * <h3>Why this is a module and not three removeItem calls</h3>
 * A session ends in more than one place — the user presses Log out, or a refresh token
 * expires and the API interceptor tears the session down on a 401. Each of those used to
 * carry its own hand-written list of keys to remove, so every new piece of per-user state
 * had to remember to enrol in all of them. The cart never did: it kept writing to
 * `hustleup_cart` and no teardown path ever removed it, so signing out left the previous
 * user's basket sitting on the device for whoever signed in next.
 *
 * Anything stored per-user belongs in SESSION_KEYS. That is the whole contract.
 */

export const TOKEN_KEY = 'hustleup_token';
export const REFRESH_KEY = 'hustleup_refresh';
export const USER_KEY = 'hustleup_user';
export const CART_KEY = 'hustleup_cart';
export const SAVED_KEY = 'hustleup_saved';

/** Every key that must not outlive the session that created it. */
export const SESSION_KEYS = [TOKEN_KEY, REFRESH_KEY, USER_KEY, CART_KEY, SAVED_KEY];

/**
 * Wipes all session-scoped storage.
 *
 * Safe to call when no session exists, and safe where localStorage is unavailable — Safari
 * in private mode throws on access, and failing to sign out is a worse outcome than failing
 * to clear one key, so each removal is guarded independently.
 */
export const clearStoredSession = () => {
  for (const key of SESSION_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch { /* storage unavailable — nothing was persisted to clear */ }
  }
};
