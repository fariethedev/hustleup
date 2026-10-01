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
export const errorMessage = (error, fallback) => error?.response?.data?.error || error?.response?.data?.message || fallback;
export const money = (amount, currency = 'PLN') => `${currency || 'PLN'} ${Number(amount ?? 0).toFixed(2)}`;
export const cartKey = (item) => `${item.kind || 'listing'}:${item.id}`;
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
