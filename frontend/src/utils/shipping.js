import { Package, Truck, Store, Mail, Bike, Download, Handshake } from 'lucide-react';

/**
 * How sellers send things, and the delivery steps each method actually passes through.
 *
 * <p>Mirrors `ShippingMethod` and `FulfilmentStatus` on the backend
 * (backend/hustleup-marketplace/.../shipping/). The server stays the authority on which
 * transitions are legal — it re-checks every update and rejects anything off-track. What
 * lives here is the copy: the labels, the icons, and the per-method wording for a step,
 * none of which belongs in a Java enum. Keep `steps` in sync with `ShippingMethod.steps()`;
 * anything that drifts shows up as the seller being offered a button the server refuses.
 */

/** Delivery states in the order a parcel passes through them. Keys match the backend enum. */
export const FULFILMENT_STEPS = {
  AWAITING_PAYMENT: { label: 'Awaiting payment', color: 'text-gray-500' },
  CONFIRMED: { label: 'Order confirmed', color: 'text-[#CDFF00]' },
  PREPARING: { label: 'Being prepared', color: 'text-[#CDFF00]' },
  SHIPPED: { label: 'Sent', color: 'text-[#CDFF00]' },
  OUT_FOR_DELIVERY: { label: 'Out for delivery', color: 'text-[#CDFF00]' },
  READY_FOR_PICKUP: { label: 'Ready to collect', color: 'text-[#CDFF00]' },
  DELIVERED: { label: 'Delivered', color: 'text-emerald-400' },
  COLLECTED: { label: 'Collected', color: 'text-emerald-400' },
  CANCELLED: { label: 'Cancelled', color: 'text-red-400' },
};

/**
 * The methods a seller can pick, with the step track each one follows.
 *
 * `tracked` decides whether the update form asks for a carrier and consignment number —
 * asking for one that cannot exist is how you end up showing buyers "Tracking: n/a".
 * `needsDropoff` decides whether it asks where the buyer collects from.
 */
export const SHIPPING_METHODS = [
  {
    value: 'PICKUP',
    label: 'Collection in person',
    hint: 'The buyer comes to you. No postage.',
    icon: Store,
    tracked: false,
    needsDropoff: true,
    steps: ['CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'COLLECTED'],
  },
  {
    value: 'PARCEL_LOCKER',
    label: 'Parcel locker',
    hint: 'InPost or similar — you drop it, they collect it.',
    icon: Package,
    tracked: true,
    needsDropoff: true,
    steps: ['CONFIRMED', 'PREPARING', 'SHIPPED', 'READY_FOR_PICKUP', 'COLLECTED'],
  },
  {
    value: 'COURIER',
    label: 'Courier',
    hint: 'Tracked, delivered to the buyer’s door.',
    icon: Truck,
    tracked: true,
    needsDropoff: false,
    steps: ['CONFIRMED', 'PREPARING', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'],
  },
  {
    value: 'POST',
    label: 'Post',
    hint: 'Poczta Polska or similar.',
    icon: Mail,
    tracked: true,
    needsDropoff: false,
    steps: ['CONFIRMED', 'PREPARING', 'SHIPPED', 'DELIVERED'],
  },
  {
    value: 'SELLER_DELIVERY',
    label: 'You deliver it',
    hint: 'You take it to the buyer yourself.',
    icon: Bike,
    tracked: false,
    needsDropoff: false,
    steps: ['CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED'],
  },
  {
    value: 'DIGITAL',
    label: 'Digital delivery',
    hint: 'Files, codes or links — nothing to post.',
    icon: Download,
    tracked: false,
    needsDropoff: false,
    steps: ['CONFIRMED', 'DELIVERED'],
  },
  {
    value: 'NONE',
    label: 'No shipping needed',
    hint: 'A service you perform in person — nothing gets sent.',
    icon: Handshake,
    tracked: false,
    needsDropoff: false,
    steps: ['CONFIRMED', 'DELIVERED'],
  },
];

/** Listing categories that produce something physical, used to preselect a sensible method. */
export const SHIPPABLE_LISTING_TYPES = ['GOODS', 'FASHION', 'FOOD'];

/**
 * The method a create form should start on for a given category.
 *
 * Physical categories open on collection — always possible, costs nobody anything, and
 * promises the buyer nothing the seller hasn't offered. Services open on "no shipping",
 * which is simply the truth for a haircut.
 */
export function defaultMethodFor(listingType) {
  return SHIPPABLE_LISTING_TYPES.includes(listingType) ? 'PICKUP' : 'NONE';
}

export function getMethod(value) {
  return SHIPPING_METHODS.find((m) => m.value === value) || null;
}

/**
 * A method's step track.
 *
 * An unknown or absent method falls back to NONE's two-step track, mirroring
 * `Fulfilment.methodOrDefault()` on the server. Orders placed before sellers were asked how
 * they ship have no method recorded, and returning nothing for them would leave the seller
 * with a delivery dialog offering no steps at all — an order that can never be marked
 * delivered, for no reason the seller can see.
 */
export function stepsFor(value) {
  return getMethod(value)?.steps || getMethod('NONE').steps;
}

/**
 * Per-method wording for a step.
 *
 * "Delivered" is right for a courier and wrong for a haircut, and "Ready to collect" means
 * a locker in one case and the seller's front door in another. One label table cannot say
 * both, so the few places the generic word misleads are overridden here.
 */
const STEP_OVERRIDES = {
  NONE: { CONFIRMED: 'Booked', DELIVERED: 'Completed' },
  DIGITAL: { DELIVERED: 'Sent' },
  PICKUP: { READY_FOR_PICKUP: 'Ready for you' },
  PARCEL_LOCKER: { SHIPPED: 'Dropped at the locker', READY_FOR_PICKUP: 'In the locker' },
  SELLER_DELIVERY: { OUT_FOR_DELIVERY: 'On the way to you' },
};

export function stepLabel(method, status) {
  return STEP_OVERRIDES[method]?.[status] || FULFILMENT_STEPS[status]?.label || status;
}

/**
 * How far along a method's track a status is, as an index.
 *
 * @returns {number} 0-based position, or -1 when the status isn't on this track at all
 *                   (an unpaid or cancelled order, or a method that has since changed).
 */
export function stepIndex(method, status) {
  return stepsFor(method).indexOf(status);
}

/** True once the buyer has the goods, by either route. */
export function isComplete(status) {
  return status === 'DELIVERED' || status === 'COLLECTED';
}

/**
 * A tracking link for the buyer.
 *
 * Prefers whatever the seller pasted. Falls back to a carrier lookup only for carriers we
 * can build a URL for with confidence — guessing wrong sends the buyer to a stranger's
 * 404 rather than their parcel, so an unknown carrier gets no link and the number is shown
 * as plain text to copy instead.
 */
const CARRIER_URLS = {
  inpost: (n) => `https://inpost.pl/sledzenie-przesylek?number=${encodeURIComponent(n)}`,
  dpd: (n) => `https://tracktrace.dpd.com.pl/parcelDetails?p1=${encodeURIComponent(n)}`,
  dhl: (n) => `https://www.dhl.com/pl-pl/home/tracking.html?tracking-id=${encodeURIComponent(n)}`,
  gls: (n) => `https://gls-group.com/PL/pl/sledzenie-paczek?match=${encodeURIComponent(n)}`,
  ups: (n) => `https://www.ups.com/track?tracknum=${encodeURIComponent(n)}`,
  fedex: (n) => `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(n)}`,
  'poczta polska': (n) => `https://emonitoring.poczta-polska.pl/?numer=${encodeURIComponent(n)}`,
};

export function trackingLink(fulfilment) {
  if (!fulfilment) return null;
  if (fulfilment.trackingUrl) return fulfilment.trackingUrl;
  const { carrier, trackingNumber } = fulfilment;
  if (!carrier || !trackingNumber) return null;
  const build = CARRIER_URLS[carrier.trim().toLowerCase()];
  return build ? build(trackingNumber) : null;
}

/** Postage as a number, so callers can add it to a total without null-checking. */
export function shippingCost(fulfilment) {
  return Number(fulfilment?.shippingPrice) || 0;
}
