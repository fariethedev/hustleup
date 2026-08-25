import {
  ApplePayMark, PayPalMark, BlikMark, CardMark, GooglePayMark,
} from '../components/PaymentBrands';

/**
 * The payment options offered at checkout — one definition, shared by every checkout screen.
 *
 * The cart checkout and the shop checkout each used to carry their own copy of this list with
 * subtly different wording ("Pay with your account" vs "Pay with your PayPal account"), so the
 * same purchase described itself two ways depending on the route in.
 *
 * `onLight` marks brands whose official artwork is full-colour or black and so needs a light
 * chip behind it to stay legible on this dark UI — Apple, PayPal, Google and BLIK all specify
 * light backgrounds for their primary mark. The card tile has no brand of its own, so it
 * inherits the surrounding colour instead.
 *
 * `next` states plainly what happens after you press the button. Telling someone they are
 * about to be redirected, before they commit, is the difference between a considered choice
 * and a surprise.
 */
export const PAYMENT_METHODS = [
  { id: 'paypal',     label: 'PayPal',     description: 'Pay with your account', Mark: PayPalMark,    onLight: true,  next: "You'll be redirected to PayPal to approve this payment." },
  { id: 'blik',       label: 'BLIK',       description: 'Polish mobile payment', Mark: BlikMark,      onLight: true,  next: 'Enter the 6-digit BLIK code from your banking app to confirm.' },
  { id: 'apple_pay',  label: 'Apple Pay',  description: 'One-tap wallet',        Mark: ApplePayMark,  onLight: true,  next: 'Confirm with Face ID or Touch ID on your device.' },
  { id: 'google_pay', label: 'Google Pay', description: 'One-tap wallet',        Mark: GooglePayMark, onLight: true,  next: 'Confirm in the Google Pay sheet on your device.' },
  { id: 'card',       label: 'Card',       description: 'Visa · Mastercard',     Mark: CardMark,      onLight: false, next: "You'll enter your card details on the next step." },
];

/** Look up a method by id, falling back to the first so callers never render an empty label. */
export const findMethod = (id) => PAYMENT_METHODS.find((m) => m.id === id) || PAYMENT_METHODS[0];
