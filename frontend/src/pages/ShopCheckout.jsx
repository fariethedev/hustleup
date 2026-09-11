import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, ShieldCheck, Lock, User, Mail, Phone, Loader2, AlertCircle, CreditCard } from 'lucide-react';
import { formatPrice } from '../utils/constants';
import { getMethod } from '../utils/shipping';
import { useShopProduct } from '../hooks/useShops';
import { shopsApi } from '../api/client';
import SmartImage from '../components/SmartImage';
import { ApplePayMark, PayPalMark, VisaMark, MastercardMark } from '../components/PaymentBrands';

const STORAGE_KEY = 'hustleup_shop_checkout_draft';

/**
 * Checkout for a single shop product.
 *
 * Deliberately the same shape as the cart checkout: details on the left, a summary that
 * stays in view on the right, and the same wording for the money. Buying one item from a
 * storefront and checking out a full cart used to look like two different products.
 *
 * <p>The payment-method picker is gone for the same reason it went from the cart: this flow
 * ends in a Stripe Checkout redirect, which asks for the method itself. Whatever was chosen
 * here was never sent anywhere, so the page collected a decision it could not honour and
 * then printed it back as "Paying with PayPal" beside a button that might take a card.
 */
export default function ShopCheckout() {
  const { id, productId } = useParams();
  const navigate = useNavigate();
  const { shop, product, loading, notFound } = useShopProduct(id, productId);
  const [customer, setCustomer] = useState({ fullName: '', email: '', phone: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const draft = useMemo(() => {
    try {
      return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}');
    } catch {
      return {};
    }
  }, []);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 mt-8">
        <div className="h-96 rounded-2xl bg-white/[0.03] border border-white/5 animate-pulse" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="text-center">
          <h2 className="text-2xl font-heading font-bold text-white mb-2">Checkout unavailable</h2>
          <p className="text-sm text-gray-400 mb-5">This product is no longer on sale.</p>
          <Link to="/explore/shops" className="px-6 py-3 rounded-xl bg-[#CDFF00] text-black font-bold">Browse shops</Link>
        </div>
      </div>
    );
  }

  const quantity = Number(draft.quantity) || 1;
  const unitPrice = draft.offer ? Number(draft.offer) : Number(product.price);
  // Postage is charged once per order, not per unit — the server does the same arithmetic
  // when it builds the Stripe session, so the number here is the number that gets charged.
  const shipping = Number(product.shippingPrice) || 0;
  const shippingMethod = getMethod(product.shippingMethod);
  const total = unitPrice * quantity + shipping;

  const canSubmit = !!(customer.fullName && customer.email) && !submitting;
  // Names the specific blocker so a disabled pay button is never a mystery.
  const missing = [
    !customer.fullName && 'name',
    !customer.email && 'email address',
  ].filter(Boolean).join(' and ');

  const placeOrder = async () => {
    setSubmitting(true);
    setError(null);
    try {
      // Creates a real order per line and returns one Stripe Checkout URL. Previously this
      // wrote the basket to sessionStorage and navigated to a confirmation page — nothing
      // reached the server, so the buyer saw a completed purchase that never happened.
      const { data } = await shopsApi.checkout(shop.slug || shop.id, {
        items: [{ productId: product.id, quantity }],
        customer,
        notes: draft.notes || '',
      });

      // The order exists now, so the draft has done its job. Clearing it stops a
      // back-button press from re-submitting the same basket.
      sessionStorage.removeItem(STORAGE_KEY);

      if (data.url) {
        window.location.href = data.url;
        return;
      }
      // No URL means nothing was payable — surface it rather than implying a sale.
      setError('This order could not be sent for payment. Please try again.');
    } catch (e) {
      const d = e.response?.data;
      setError(d?.error || d?.message
        || (e.response?.status === 401
            ? 'Sign in to place this order.'
            : 'Could not place the order. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  const field = (key, placeholder, type, Icon) => (
    <div className="relative">
      <Icon className="w-4 h-4 text-gray-600 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      <input
        type={type}
        value={customer[key]}
        onChange={(e) => setCustomer((c) => ({ ...c, [key]: e.target.value }))}
        placeholder={placeholder}
        className="w-full rounded-xl bg-black/40 border border-white/10 pl-10 pr-4 py-3 text-sm text-white placeholder-gray-600 outline-none focus:border-[#CDFF00]/60 focus:bg-black/60 transition-colors"
      />
    </div>
  );

  return (
    <div className="min-h-screen text-white pt-4 pb-10">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <Link
          to={`/shop/${shop.slug || shop.id}/product/${product.id}/negotiate`}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to negotiation
        </Link>

        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-center mb-6">
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Checkout</h1>
            <p className="text-[11px] text-gray-500 font-bold mt-1.5">{shop.name}</p>
            {/* Payment is a real step, it just happens on Stripe — showing it stops the
                redirect feeling like the page threw you somewhere unexpected. */}
            <div className="mt-3 inline-flex items-center gap-2 sm:gap-3 text-[10px] font-black tracking-widest">
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#CDFF00] text-black">
                <span className="w-4 h-4 rounded-full bg-black/20 flex items-center justify-center text-[9px]">1</span>
                Your details
              </span>
              <span className="w-4 sm:w-6 h-px bg-white/20" />
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-gray-400">
                <span className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center text-[9px]">2</span>
                Pay on Stripe
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_0.85fr] gap-4">
            {/* ── Left: details + payment ── */}
            <div className="space-y-4">
              <section className="rounded-2xl border border-white/10 bg-[#0E0E0E] p-5">
                <h2 className="text-xs font-black text-white tracking-widest mb-1">Your details</h2>
                <p className="text-[11px] text-gray-500 mb-4">So {shop.name} knows who to deliver to.</p>
                <div className="space-y-2.5">
                  {field('fullName', 'Full name', 'text', User)}
                  {field('email', 'Email address', 'email', Mail)}
                  {field('phone', 'Phone number (optional)', 'tel', Phone)}
                </div>
              </section>

              {/* Where the picker used to be: what the next screen does, not a choice this
                  page cannot act on. */}
              <section className="rounded-2xl border border-white/10 bg-[#0E0E0E] p-5">
                <div className="flex items-start gap-3">
                  <span className="w-9 h-9 rounded-xl bg-[#CDFF00]/10 border border-[#CDFF00]/25 flex items-center justify-center shrink-0">
                    <CreditCard className="w-4 h-4 text-[#CDFF00]" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-xs font-black text-white tracking-widest">Payment</h2>
                    <p className="text-[11px] text-gray-400 mt-1.5 leading-relaxed">
                      You&apos;ll choose how to pay on Stripe&apos;s secure page — card,
                      Apple&nbsp;Pay, Google&nbsp;Pay, BLIK or PayPal, depending on what&apos;s
                      available. Your card details never touch HustleSpace.
                    </p>
                    <div className="mt-3 flex items-center gap-2 opacity-80">
                      <span className="h-6 px-1.5 rounded bg-white flex items-center"><VisaMark className="h-3 w-auto" /></span>
                      <span className="h-6 px-1.5 rounded bg-white flex items-center"><MastercardMark className="h-3.5 w-auto" /></span>
                      <span className="h-6 px-1.5 rounded bg-white flex items-center"><ApplePayMark className="h-3.5 w-auto" /></span>
                      <span className="h-6 px-1.5 rounded bg-white flex items-center"><PayPalMark className="h-3 w-auto" /></span>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            {/* ── Right: summary, in view while the form is filled ── */}
            <aside className="rounded-2xl border border-white/10 bg-[#0E0E0E] p-5 h-fit lg:sticky lg:top-20">
              <h2 className="text-xs font-black text-white tracking-widest mb-4">Order summary</h2>

              <div className="flex items-center gap-3 pb-3">
                <div className="w-14 h-14 rounded-xl overflow-hidden bg-black/40 border border-white/10 shrink-0">
                  <SmartImage src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white truncate">{product.name}</p>
                  <p className="text-[10px] font-black tracking-widest text-gray-500 truncate">{shop.name}</p>
                </div>
              </div>

              <div className="border-t border-white/10 pt-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">Unit price</span>
                  <span className="text-white font-bold">{formatPrice(unitPrice, product.currency)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">Quantity</span>
                  <span className="text-white font-bold">{quantity}</span>
                </div>
                {/* Named with the method, not just a number: "Delivery 15 PLN" and
                    "Parcel locker 15 PLN" are the same charge, but only the second tells the
                    buyer what they're getting for it. Shown even when free, because free
                    delivery is worth saying out loud. */}
                {shippingMethod && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">{shippingMethod.label}</span>
                    <span className={shipping > 0 ? 'text-white font-bold' : 'text-[#CDFF00] font-bold'}>
                      {shipping > 0 ? formatPrice(shipping, product.currency) : 'Free'}
                    </span>
                  </div>
                )}
                {/* Stated outright rather than left as a dash — an unexplained "Fees" line is
                    exactly what makes people brace for a surprise on the next screen. */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">Fees</span>
                  <span className="text-[#CDFF00] font-bold">Included</span>
                </div>
                <div className="flex items-center justify-between pt-2.5 border-t border-white/5">
                  <span className="text-white font-black tracking-widest text-xs">Total</span>
                  <span className="text-[#CDFF00] text-2xl font-black">{formatPrice(total, product.currency)}</span>
                </div>
                <p className="text-[10px] text-gray-500 leading-relaxed">
                  This is the final amount. Nothing is added at the next step.
                </p>
              </div>

              {missing && (
                <p className="mt-4 -mb-1 text-[11px] font-bold text-gray-400">
                  Add your {missing} to continue.
                </p>
              )}

              {error && (
                <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-2 text-red-400">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="text-xs font-medium">{error}</span>
                </div>
              )}

              <button
                type="button"
                onClick={placeOrder}
                disabled={!canSubmit}
                className="mt-4 w-full py-3.5 rounded-xl bg-[#CDFF00] text-black font-black text-xs tracking-widest flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 active:scale-95 transition-all shadow-[0_8px_24px_rgba(205,255,0,0.22)]"
              >
                {submitting
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Taking you to Stripe…</>
                  : <>Continue to payment <ArrowRight className="w-3.5 h-3.5" /></>}
              </button>

              {/* This flow now really does charge, so the copy says so. It previously read
                  "Nothing charged yet" because the button only wrote to sessionStorage —
                  leaving that wording in place would be a lie in the opposite direction. */}
              <div className="mt-3 p-3 rounded-xl bg-black/40 border border-white/5">
                <div className="flex items-center gap-1.5 text-[#CDFF00] text-[10px] font-black tracking-widest">
                  <ShieldCheck className="w-3.5 h-3.5" /> Secure checkout
                </div>
                <p className="text-[11px] text-gray-500 mt-1.5 leading-relaxed">
                  Payment is handled by Stripe. Your card details never touch HustleSpace.
                </p>
              </div>

              <div className="mt-3 flex items-center justify-center gap-1.5 text-[10px] font-bold text-gray-500">
                <Lock className="w-3 h-3" /> Encrypted checkout powered by Stripe
              </div>
            </aside>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
