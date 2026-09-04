/**
 * Premium plan helpers.
 *
 * The rule lives here rather than inline in each page so the feed composer, Hustle Bond and
 * anything gated later all agree on what "Premium" means — and so it stays in step with the
 * server-side check in `PremiumAccess.java`, which is the one that actually decides.
 *
 * Treat these as presentation helpers only. They choose what to *offer*; a premium feature
 * that matters must also be enforced by the API, because anything decided in the browser can
 * be skipped by calling the endpoint directly.
 */

/** The paid tier's plan name, as stored by the subscription service. */
export const PREMIUM_PLAN = 'VERIFIED';

/**
 * The plan ids `POST /subscriptions/checkout` accepts, mirroring the SubscriptionPlan enum.
 *
 * The prices themselves are deliberately NOT here — they come from
 * `GET /subscriptions/plans` so the UI can never advertise an amount different from the one
 * Stripe charges. This is only the set of valid identifiers, for validating what a caller
 * passes before it reaches the server.
 */
export const PLAN_IDS = ['MONTHLY', 'QUARTERLY', 'ANNUAL'];

/**
 * Whether a subscription record grants Premium right now.
 *
 * Fails closed: no record, a cancelled plan, or a lapsed expiry all read as not premium.
 *
 * @param {{plan?: string, status?: string, expiresAt?: string}|null|undefined} sub
 * @returns {boolean}
 */
export function isPremiumActive(sub) {
  if (!sub || sub.plan !== PREMIUM_PLAN) return false;
  if (sub.status && sub.status !== 'ACTIVE') return false;
  if (sub.expiresAt && new Date(sub.expiresAt).getTime() < Date.now()) return false;
  return true;
}

/**
 * True when an API error is the server refusing a Premium-only action.
 *
 * The feed returns `403 {code: "PREMIUM_REQUIRED"}` rather than silently downgrading the
 * request, so callers can tell "you need to upgrade" apart from a generic failure.
 *
 * @param {unknown} error an axios error
 */
export function isPremiumRequiredError(error) {
  return error?.response?.status === 403 && error?.response?.data?.code === 'PREMIUM_REQUIRED';
}
