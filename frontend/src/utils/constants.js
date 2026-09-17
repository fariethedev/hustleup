import { Slice, ChefHat, Cake, Footprints, Box, Hammer, Luggage, Building2 } from 'lucide-react';

// `color` is a solid Tailwind bg-* class, one per category — not a gradient. Each still
// gets its own hue so a category is still recognisable at a glance (a listing-type fallback
// tile or an Onboarding preview card in category colour is wayfinding, not decoration), but
// consumers apply the class directly rather than wrapping it in bg-gradient-to-*.
export const LISTING_TYPES = [
  { value: 'HAIR_BEAUTY', label: 'Hair & Beauty', icon: Slice, color: 'bg-pink-500' },
  { value: 'FOOD', label: 'Food & Catering', icon: ChefHat, color: 'bg-orange-500' },
  { value: 'EVENT', label: 'Events & Entertainment', icon: Cake, color: 'bg-purple-500' },
  { value: 'FASHION', label: 'Fashion & Clothing', icon: Footprints, color: 'bg-fuchsia-500' },
  { value: 'GOODS', label: 'Goods & Products', icon: Box, color: 'bg-blue-500' },
  { value: 'SKILL', label: 'Skills & Services', icon: Hammer, color: 'bg-emerald-500' },
  // Spare luggage allowance sold by the kg — mainly Poland-to-Africa, carrying goods home
  // or for a customer. See CreateListing's LUGGAGE-only fields and ListingDetail's kg picker.
  { value: 'LUGGAGE', label: 'Luggage Space', icon: Luggage, color: 'bg-cyan-500' },
  // Was an enum value with nowhere to be created from — see Listing.payOnPlatform for the
  // agent's choice between taking payment here and just collecting enquiries.
  { value: 'RENTAL', label: 'Rooms & Rentals', icon: Building2, color: 'bg-amber-500' },
];

export const BOOKING_STATUS_MAP = {
  POSTED: { label: 'Posted', color: 'bg-sky-500/15 text-sky-400' },
  INQUIRED: { label: 'Inquired', color: 'bg-[#CDFF00]/15 text-[#CDFF00]' },
  NEGOTIATING: { label: 'Negotiating', color: 'bg-[#CDFF00]/15 text-[#CDFF00]' },
  BOOKED: { label: 'Booked', color: 'bg-emerald-500/15 text-emerald-400' },
  COMPLETED: { label: 'Completed', color: 'bg-green-500/15 text-green-400' },
  CANCELLED: { label: 'Cancelled', color: 'bg-[#CDFF00]/15 text-[#CDFF00]' },
};

/**
 * Turns a server enum into something readable: "OUT_FOR_DELIVERY" → "Out for delivery".
 *
 * The UI no longer sets everything in capitals, which means enum values that used to be
 * hidden behind `text-transform` now reach the screen exactly as the database spells them.
 * Anywhere a raw status, role or type is rendered, it goes through here first.
 */
export const labelize = (value) => {
  if (!value) return '';
  const words = String(value).replace(/_/g, ' ').trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

export const CURRENCIES = ['PLN', 'EUR', 'USD', 'GBP', 'ZAR'];

export const POLISH_CITIES = [
  'Warszawa', 'Kraków', 'Wrocław', 'Poznań', 'Gdańsk',
  'Łódź', 'Szczecin', 'Katowice', 'Lublin', 'Białystok',
  'Gdynia', 'Toruń', 'Rzeszów', 'Bydgoszcz', 'Olsztyn',
];

/**
 * Shown in place of a city on records that never had one set. HustleSpace's market is Poland,
 * so a location chip always reads as somewhere in Poland — but we deliberately do NOT
 * invent a specific city for a real seller who left the field blank, since a made-up
 * "Kraków" on someone's listing is worse than an honest country-level label.
 */
export const DEFAULT_REGION = 'Polska';

/**
 * The location label for a card. Every listing/shop/creator card renders one, so browsing
 * never shows a card with no sense of where it is.
 *
 * @param {string} [city] the record's own city, if it has one
 * @returns {string} the city, or the country-level fallback
 */
export function displayCity(city) {
  const trimmed = typeof city === 'string' ? city.trim() : '';
  return trimmed || DEFAULT_REGION;
}

// Approximate fixed exchange rates used only to keep cart totals arithmetically
// correct when items from different shops/listings are combined in one cart —
// not a live FX feed, this app has no real payment processing behind it.
// PLN is HustleSpace's base/overall currency (Poland is the primary market).
// Indicative rates only — used to normalise mixed-currency baskets and listings to a
// single comparable number. Not a pricing source: a real deployment should pull these
// from an FX feed rather than trusting a hardcoded table that silently goes stale.
const FX_TO_PLN = { PLN: 1, GBP: 5, EUR: 4.3, USD: 3.95, ZAR: 0.21 };

export function convertToPLN(amount, currency = 'PLN') {
  const rate = FX_TO_PLN[currency] ?? 1;
  return Math.round(Number(amount) * rate * 100) / 100;
}

/**
 * Converts between any two supported currencies, via PLN as the pivot.
 *
 * <p>Used by the cart's currency switcher so a basket assembled from listings priced in
 * different currencies can be read as one comparable total. Rates come from
 * {@link FX_TO_PLN} and are indicative — this changes what a shopper *sees*, never what
 * they are charged. The charge is always taken in the currency the seller listed in.
 *
 * @param {number} amount
 * @param {string} from source currency code
 * @param {string} to   target currency code
 * @returns {number} amount in `to`, rounded to 2dp
 */
export function convertPrice(amount, from = 'PLN', to = 'PLN') {
  const value = Number(amount);
  if (isNaN(value)) return 0;
  if (from === to) return Math.round(value * 100) / 100;
  const inPln = value * (FX_TO_PLN[from] ?? 1);
  const rate = FX_TO_PLN[to] ?? 1;
  return Math.round((inPln / rate) * 100) / 100;
}

export function formatPrice(amount, currency = 'PLN') {
  const num = Number(amount);
  if (isNaN(num)) return `${currency} 0`;
  const formatted = num.toLocaleString('pl-PL', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  switch (currency) {
    case 'PLN': return `${formatted} PLN`;
    case 'EUR': return `€${formatted}`;
    case 'USD': return `$${formatted}`;
    case 'GBP': return `£${formatted}`;
    case 'ZAR': return `R${formatted}`;
    default: return `${formatted} ${currency}`;
  }
}
