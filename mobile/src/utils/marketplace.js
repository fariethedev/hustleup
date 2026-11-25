export const LISTING_CATEGORIES = [
  { key: 'GOODS', label: 'Goods', icon: 'package' },
  { key: 'FOOD', label: 'Food', icon: 'coffee' },
  { key: 'FASHION', label: 'Fashion', icon: 'tag' },
  { key: 'HAIR_BEAUTY', label: 'Hair & beauty', icon: 'scissors' },
  { key: 'SKILL', label: 'Skills & services', icon: 'tool' },
  { key: 'EVENT', label: 'Events', icon: 'calendar' },
  { key: 'JOB', label: 'Jobs', icon: 'briefcase' },
  { key: 'RENTAL', label: 'Rentals', icon: 'home' },
  { key: 'LUGGAGE', label: 'Luggage', icon: 'truck' },
];

export const categoryLabel = (type) => LISTING_CATEGORIES.find(c => c.key === type)?.label || type || 'Listing';
export const errorMessage = (error, fallback = 'The request could not be completed.') => {
  const status = error?.response?.status;
  const data = error?.response?.data;
  const detail = typeof data?.error === 'string'
    ? data.error
    : typeof data?.message === 'string'
      ? data.message
      : null;

  if (status === 401) return 'Your session has expired or sign-in is required. Sign in again, then retry.';
  if (status === 403) return detail || 'Your account does not have permission to do this.';
  if (status === 404) {
    const path = error?.config?.url;
    return `The connected server does not have this API route${path ? ` (${path})` : ''}. In Expo Go, restart Expo with EXPO_PUBLIC_API_URL set to the running backend.`;
  }
  if (status === 429) return 'Too many requests. Wait a moment, then retry.';
  if (status >= 500) return detail || 'The server had a problem handling this request. Try again shortly.';
  if (!error?.response && (error?.request || error?.code === 'ERR_NETWORK')) {
    return 'Cannot reach the backend. Check that it is running, that EXPO_PUBLIC_API_URL points to it, and that your phone and computer are on the same Wi-Fi.';
  }
  return detail || error?.message || fallback;
};
export const money = (amount, currency = 'PLN') => {
  const code = currency || 'PLN';
  const value = Number(amount ?? 0);
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: code }).format(value); }
  catch { return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${code}`; }
};
export const cartKey = (item) => `${item.kind || 'listing'}:${item.id}${item.ticketTier ? `:${item.ticketTier}` : ''}`;
/** Ticket types for a tiered event, from the listing's meta JSON; [] when untiered. */
export const ticketTiers = (listing) => { try { const t = JSON.parse(listing?.meta || '{}').ticketTiers; return Array.isArray(t) ? t : []; } catch { return []; } };
export const cartGroup = (item) => `${item.kind === 'product' ? `shop:${item.shopId}` : 'listings'}:${item.currency || 'PLN'}`;
export const canPurchaseListing = (listing) => ['GOODS', 'FOOD', 'FASHION', 'EVENT', 'LUGGAGE', 'SKILL', 'HAIR_BEAUTY'].includes(listing.listingType) || (listing.listingType === 'RENTAL' && listing.payOnPlatform);
export const checkoutPrompts = (listing) => (listing.checkoutFields || '').split('\n').map(s => s.trim()).filter(Boolean);

export function addCartItem(items, item) {
  const key = cartKey(item);
  const existing = items.find(row => cartKey(row) === key);
  return existing
    ? items.map(row => cartKey(row) === key ? { ...row, quantity: Math.min(99, row.quantity + 1) } : row)
    : [...items, { ...item, quantity: 1 }];
}
