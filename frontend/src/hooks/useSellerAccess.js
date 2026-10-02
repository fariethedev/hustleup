import { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { subscriptionsApi } from '../api/client';
import { isPremiumActive } from '../utils/premium';
import { selectUser, selectIsAuthenticated } from '../store/authSlice';

/**
 * Whether the signed-in account may sell: list items, run a shop, set availability, take payouts.
 *
 * <h3>Why this exists</h3>
 * The frontend used to answer this with `user.role === 'SELLER'` while the server answered it
 * with `PremiumAccess.canSell`, and the two had drifted into disagreeing about the product.
 * Selling is no longer a property of the account you picked at signup — the server grants it
 * to any active subscriber, and never assigns the SELLER role to new accounts at all. So
 * someone who paid for Premium was allowed to create a listing by the API and refused the
 * form by the UI, which is the worst of the two possible bugs: they had already been charged.
 *
 * The rule below is deliberately the same three clauses as `PremiumAccess.canSell`, in the
 * same order, so a change to one is an obvious prompt to change the other:
 *   1. an active Premium subscription,
 *   2. the grandfathered SELLER role (accounts that predate subscription-based selling), or
 *   3. ADMIN, who has to be able to act on anything.
 *
 * This still only decides what to *offer*. The endpoints enforce it independently, which is
 * what actually protects them — anything decided in a browser can be skipped.
 */

// Dashboard, CreateListing and the nav can all mount together; without this they would each
// fire their own GET /subscriptions/my. Short TTL because the answer changes the moment a
// checkout clears, and a stale "no" is what locks a paying seller out.
let cache = null;
let cachedAt = 0;
let cacheUserId = null;
const TTL_MS = 15_000;

/**
 * Drops the cached subscription so the next read hits the server.
 *
 * Call after returning from Stripe: the webhook may land while the old answer is still
 * inside its TTL, and the seller would be told to upgrade again having just paid.
 */
export function invalidateSellerAccess() {
  cache = null;
  cachedAt = 0;
}

function fetchSubscription(userId) {
  if (cacheUserId !== userId) { invalidateSellerAccess(); cacheUserId = userId; }
  const fresh = cache && Date.now() - cachedAt < TTL_MS;
  if (!fresh) {
    cachedAt = Date.now();
    cache = subscriptionsApi.my()
      .then((r) => r.data)
      .catch((err) => {
        invalidateSellerAccess(); // never cache a failure — the next caller should retry
        throw err;
      });
  }
  return cache;
}

/**
 * @returns {{
 *   canSell: boolean,      may sell right now
 *   premium: boolean,      holds an active paid plan
 *   grandfathered: boolean granted by the legacy SELLER/ADMIN role rather than by paying
 *   subscription: object|undefined  the raw GET /subscriptions/my record, once loaded —
 *                                    for showing plan/expiry, e.g. on a cancel-subscription
 *                                    screen; undefined while still loading
 *   loading: boolean,      still deciding — render neither the seller UI nor the upgrade wall
 *   refresh: Function,
 * }}
 */
export function useSellerAccess() {
  const user = useSelector(selectUser);
  const isAuthenticated = useSelector(selectIsAuthenticated);

  // Known synchronously from the session, so these accounts never wait on a network call
  // to be shown their own shop.
  const grandfathered = user?.role === 'SELLER' || user?.role === 'ADMIN';

  // undefined = not answered yet. Distinct from false: a failed lookup must not be
  // indistinguishable from a confirmed "not subscribed" while the request is still in
  // flight, or the upgrade wall flashes over a subscriber's dashboard on every load.
  const [result, setResult] = useState(null);
  const loaded = isAuthenticated && result?.userId === user?.id;
  const subscription = loaded ? result.subscription : undefined;
  const premium = loaded && isPremiumActive(subscription);

  const load = useCallback((force = false) => {
    if (!isAuthenticated) return undefined;
    if (force) invalidateSellerAccess();
    let cancelled = false;
    fetchSubscription(user?.id)
      .then((sub) => { if (!cancelled) setResult({ userId: user?.id, subscription: sub }); })
      .catch(() => { if (!cancelled) setResult({ userId: user?.id, subscription: null }); });
    return () => { cancelled = true; };
  }, [isAuthenticated, user?.id]);

  // Asked even for grandfathered accounts: a legacy seller who also subscribed should see
  // themselves as a subscriber, and the role clause is meant to be deleted once those
  // accounts have been migrated.
  useEffect(() => load(), [load]);

  return {
    canSell: grandfathered || premium === true,
    premium: premium === true,
    grandfathered,
    subscription,
    loading: isAuthenticated && !grandfathered && !loaded,
    refresh: () => load(true),
  };
}
