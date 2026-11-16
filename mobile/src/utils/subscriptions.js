// Presentation only: protected APIs remain the authority for access.
export function isPremiumActive(subscription, now = Date.now()) {
  if (!subscription || !['PLUS', 'VERIFIED'].includes(subscription.plan)) return false;
  if (subscription.status && subscription.status !== 'ACTIVE') return false;
  return !subscription.expiresAt || new Date(subscription.expiresAt).getTime() > now;
}
export function isAllAccessActive(subscription, now = Date.now()) {
  return isPremiumActive(subscription, now) && subscription.plan === 'VERIFIED';
}
export function currentTier(subscription) {
  return isAllAccessActive(subscription) ? 'ALL_ACCESS' : isPremiumActive(subscription) ? 'MONTHLY' : 'FREE';
}
export const membershipTiers = [
  { id: 'FREE', name: 'Free', features: ['Browse and buy', 'Community feed', 'Profile and messaging'], excluded: 'Selling, Bond and leaderboards not included' },
  { id: 'MONTHLY', name: 'Plus', features: ['Everything in Free', 'List products, services and events', 'Storefront and booking availability', 'Seller tools and bank payouts', 'Anonymous posting'], excluded: 'Bond and leaderboards not included' },
  { id: 'ALL_ACCESS', name: 'All Access', features: ['Everything in Plus', 'Hustle Bond discovery and matching', 'Leaderboards'], excluded: '' },
];
