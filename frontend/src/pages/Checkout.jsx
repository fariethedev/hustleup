import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useDispatch, useSelector } from 'react-redux';
import { ArrowLeft, ArrowRight, ShieldCheck, ShoppingBag, Lock, User, Mail, Phone, CreditCard, Clock } from 'lucide-react';
import { selectCartItems, removeFromCart } from '../store/cartSlice';
import { bookingsApi } from '../api/client';
import { formatPrice } from '../utils/constants';
import SmartImage from '../components/SmartImage';
import { ApplePayMark, PayPalMark, VisaMark, MastercardMark } from '../components/PaymentBrands';

/**
 * Basket checkout.
 *
 * <h3>There is no payment-method picker</h3>
 * There used to be one, and it was theatre. Whatever you chose, `placeOrder` created the
 * bookings and handed you to Stripe Checkout, which then asked you to pick a payment method
 * again — the earlier choice was never sent anywhere and could not be honoured. Two costs to
 * that: a screen of decisions that changed nothing, and a summary line reading "Paying with
 * PayPal" next to a button that might well take a card. Stripe owns that choice, so the page
 * now says so and shows which methods are waiting on the next screen instead of pretending
 * to collect one.
 *
 * <h3>Shape</h3>
 * What is left is one short form and a receipt, so the page is built as exactly that: details
 * on the left, a summary that stays in view beside them, and a single button whose label
 * names what actually happens next. The old numbered steps went with the picker — numbering
 * a list of one is noise.
 */
export default function Checkout() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const items = useSelector(selectCartItems);

  // Storefront products carry a synthetic "shop:<shopId>:<productId>" id — they are not
  // marketplace listings, and the bookings endpoint cannot charge for them. They used to be
  // filtered out of the payment silently while still counting toward the total on this page,
  // so a buyer was quoted one figure, charged a smaller one, and had the basket emptied of
  // items nobody had ordered or taken money for. They are separated here instead, so the
  // summary only ever promises what the next screen actually charges.
  const isStorefrontItem = (item) => String(item.listingId).startsWith('shop:');
  const bookableItems = items.filter((i) => !isStorefrontItem(i));
  const shopItems = items.filter(isStorefrontItem);

  // Same arithmetic as the cart selectors, over the payable lines only: price (or the
  // negotiated one) per unit, and postage once per line rather than per unit.
  const subtotal = bookableItems.reduce((acc, i) => acc + (i.negotiatedPrice ?? i.price) * i.quantity, 0);
  // Postage is a separate line rather than folded into the subtotal, and is added once per
  // item in the basket rather than per unit — the same arithmetic the server does when it
  // builds the Stripe session, so this page cannot promise a total the charge contradicts.
  const shipping = bookableItems.reduce((acc, i) => acc + (Number(i.shippingPrice) || 0), 0);
  const total = subtotal + shipping;

  const [customer, setCustomer] = useState({ fullName: '', email: '', phone: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const currency = bookableItems[0]?.currency || items[0]?.currency || 'PLN';

  if (items.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center space-y-4">
          <ShoppingBag className="w-16 h-16 mx-auto text-gray-700" />
          <h2 className="text-2xl font-black text-white uppercase tracking-tight">Your cart is empty</h2>
          <Link to="/explore" className="px-8 py-3 rounded-2xl bg-[#CDFF00] text-black font-black text-sm uppercase tracking-widest inline-block">
            Browse Listings
          </Link>
        </div>
      </div>
    );
  }

  const placeOrder = async () => {
    if (!customer.fullName || !customer.email) return;
    setLoading(true);
    setError(null);
    try {
      if (bookableItems.length === 0) {
        throw new Error('Storefront items are bought from their shop page — open the shop to check out.');
      }

      // One request creates a booking per line and returns a SINGLE Stripe Checkout URL
      // covering all of them — one redirect, one card charge, however many sellers.
      const { data } = await bookingsApi.cartCheckout(
        bookableItems.map((item) => ({
          listingId: item.listingId,
          quantity: item.quantity ?? 1,
        }))
      );

      // The bookings now exist, so those lines have done their job — dropping them here
      // stops a back-button press from ordering them twice. If the buyer abandons Stripe,
      // the orders are still payable from their dashboard. Anything not ordered stays in
      // the basket: clearing the lot used to throw away storefront items that had never
      // been sent anywhere, so they vanished without ever being bought.
      bookableItems.forEach((item) => dispatch(removeFromCart(item.listingId)));

      if (data.url) {
        // Hand off to Stripe's hosted page. Stripe returns the buyer to
        // /checkout/confirmation?payment=success afterwards.
        window.location.href = data.url;
        return;
      }

      // Nothing was instantly purchasable — every item needs its seller to accept first,
      // so there is no payment to make yet. Say so instead of implying a completed sale.
      navigate('/checkout/confirmation', {
        state: { customer, items: bookableItems, total, currency, awaitingApproval: data.awaitingApproval || [] },
      });
    } catch (e) {
      setError(e.response?.data?.error || e.response?.data?.message || e.message
        || 'Failed to place order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = !loading && customer.fullName && customer.email;
  // Names the specific blocker so a disabled pay button is never a mystery.
  const missing = [
    !customer.fullName && 'name',
    !customer.email && 'email address',
  ].filter(Boolean).join(' and ');

  const field = (key, placeholder, type, Icon, autoComplete) => (
    <div className="relative">
      <Icon className="w-4 h-4 text-gray-600 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      <input
        type={type}
        value={customer[key]}
        onChange={(e) => setCustomer((c) => ({ ...c, [key]: e.target.value }))}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full rounded-xl bg-black/40 border border-white/10 pl-10 pr-4 py-3 text-sm text-white placeholder-gray-600 outline-none focus:border-[#CDFF00]/60 focus:bg-black/60 transition-colors"
      />
    </div>
  );

  return (
    <div className="min-h-screen text-white pt-4 pb-10">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <Link
          to="/explore"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Explore
        </Link>

        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
          {/* ── Header. The two-step rail replaces the old numbered sections: payment is a
                 real step, it just happens on Stripe rather than here, and showing it stops
                 the redirect feeling like the page threw you somewhere unexpected. ── */}
          <div className="text-center mb-6">
            <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">Checkout</h1>
            <div className="mt-3 inline-flex items-center gap-2 sm:gap-3 text-[10px] font-black uppercase tracking-widest">
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

          {error && (
            <div className="mb-4 p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-xs font-bold">
              {error}
            </div>
          )}

          {/* Said before the button, not after the charge: these lines cannot be paid for
              here, and staying silent about them is what made them disappear unbought. */}
          {shopItems.length > 0 && (
            <div className="mb-4 p-3 rounded-xl border border-[#CDFF00]/30 bg-[#CDFF00]/[0.07] text-[11px] leading-relaxed">
              <span className="font-black uppercase tracking-widest text-[#CDFF00]">
                {shopItems.length} storefront {shopItems.length === 1 ? 'item' : 'items'} not included
              </span>
              <p className="text-gray-400 mt-1">
                {shopItems.map((i) => i.title).join(', ')} — {shopItems.length === 1 ? 'this is' : 'these are'} sold
                through {shopItems.length === 1 ? 'its' : 'their'} shop page and {shopItems.length === 1 ? 'is' : 'are'} paid
                for there. {shopItems.length === 1 ? 'It stays' : 'They stay'} in your basket; the total below covers
                only what this checkout charges.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_0.85fr] gap-4">
            {/* ── Left: the only thing this page actually collects ── */}
            <div className="space-y-4">
              <section className="rounded-2xl border border-white/10 bg-[#0E0E0E] p-5">
                <h2 className="text-xs font-black text-white uppercase tracking-widest mb-1">Your details</h2>
                <p className="text-[11px] text-gray-500 mb-4">So the seller knows who to deliver to.</p>
                <div className="space-y-2.5">
                  {field('fullName', 'Full name', 'text', User, 'name')}
                  {field('email', 'Email address', 'email', Mail, 'email')}
                  {field('phone', 'Phone number (optional)', 'tel', Phone, 'tel')}
                </div>
              </section>

              {/* Where the payment picker used to be. It states what the next screen does
                  rather than asking for a choice this page cannot act on. */}
              <section className="rounded-2xl border border-white/10 bg-[#0E0E0E] p-5">
                <div className="flex items-start gap-3">
                  <span className="w-9 h-9 rounded-xl bg-[#CDFF00]/10 border border-[#CDFF00]/25 flex items-center justify-center shrink-0">
                    <CreditCard className="w-4 h-4 text-[#CDFF00]" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-xs font-black text-white uppercase tracking-widest">Payment</h2>
                    <p className="text-[11px] text-gray-400 mt-1.5 leading-relaxed">
                      You&apos;ll choose how to pay on Stripe&apos;s secure page — card, Apple&nbsp;Pay,
                      Google&nbsp;Pay, BLIK or PayPal, depending on what&apos;s available for your
                      basket. Your card details never touch HustleSpace.
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

              {/* A basket can mix goods (charged now) with services (charged after the seller
                  accepts). Saying so here stops a part-charged order looking like a fault. */}
              <section className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <div className="flex items-start gap-2.5">
                  <Clock className="w-3.5 h-3.5 text-gray-500 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-gray-500 leading-relaxed">
                    Goods are paid for now. Anything that needs the seller to accept first
                    isn&apos;t charged yet — you&apos;ll be notified when it&apos;s approved,
                    and can pay it from your dashboard.
                  </p>
                </div>
              </section>
            </div>

            {/* ── Right: the receipt, in view while the form is filled ── */}
            <aside className="rounded-2xl border border-white/10 bg-[#0E0E0E] p-5 h-fit lg:sticky lg:top-20">
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="text-xs font-black text-white uppercase tracking-widest">Order summary</h2>
                <span className="text-[10px] font-bold text-gray-500">
                  {items.length} item{items.length === 1 ? '' : 's'}
                </span>
              </div>

              <div className="space-y-2 mb-4 max-h-[220px] overflow-y-auto scrollbar-hide pr-0.5">
                <AnimatePresence>
                  {bookableItems.map((item) => (
                    <motion.div
                      key={item.listingId}
                      layout
                      className="flex items-center gap-3 p-2.5 rounded-xl bg-black/40 border border-white/5"
                    >
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-800 shrink-0 flex items-center justify-center">
                        {item.emoji ? (
                          <span className="text-lg">{item.emoji}</span>
                        ) : (
                          <SmartImage
                            src={item.image}
                            alt={item.title}
                            fallbackIcon={ShoppingBag}
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-bold text-xs truncate">{item.title}</p>
                        <p className="text-gray-500 text-[10px] mt-0.5">Qty {item.quantity}</p>
                      </div>
                      <p className="text-white font-black text-xs shrink-0">
                        {formatPrice((item.negotiatedPrice ?? item.price) * item.quantity, item.currency)}
                      </p>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              <div className="border-t border-white/10 pt-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">Subtotal</span>
                  <span className="text-white font-bold">{formatPrice(subtotal, currency)}</span>
                </div>
                {/* Shown even at zero: free delivery is worth saying out loud, and a basket
                    that silently omits the line reads as one that might add it later. */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">Delivery</span>
                  <span className={shipping > 0 ? 'text-white font-bold' : 'text-[#CDFF00] font-bold'}>
                    {shipping > 0 ? formatPrice(shipping, currency) : 'Free'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">Fees</span>
                  <span className="text-[#CDFF00] font-bold">Included</span>
                </div>
                {/* The "Paying with" row went with the picker — it named a choice that was
                    never sent to Stripe and could not be honoured. */}
                <div className="flex items-center justify-between pt-2.5 border-t border-white/5">
                  <span className="text-white font-black uppercase tracking-widest text-xs">Total</span>
                  <span className="text-[#CDFF00] text-2xl font-black">{formatPrice(total, currency)}</span>
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

              {/* Labelled for what it does. "Place order" implied this page completed the
                  purchase, when it hands off to Stripe. */}
              <button
                type="button"
                onClick={placeOrder}
                disabled={!canSubmit}
                className="mt-4 w-full py-3.5 rounded-xl bg-[#CDFF00] text-black font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 active:scale-95 transition-all shadow-[0_8px_24px_rgba(205,255,0,0.22)]"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    Taking you to Stripe…
                  </>
                ) : (
                  <>Continue to payment <ArrowRight className="w-3.5 h-3.5" /></>
                )}
              </button>

              <div className="mt-3 flex items-center justify-center gap-1.5 text-[10px] font-bold text-gray-500">
                <Lock className="w-3 h-3" /> Encrypted checkout powered by Stripe
              </div>

              <div className="mt-3 p-3 rounded-xl bg-black/40 border border-white/5">
                <div className="flex items-center gap-1.5 text-[#CDFF00] text-[10px] font-black uppercase tracking-widest">
                  <ShieldCheck className="w-3.5 h-3.5" /> Buyer protection
                </div>
                <p className="text-[11px] text-gray-500 mt-1.5 leading-relaxed">
                  Money is held by HustleSpace and only released to the seller once your order
                  is marked complete.
                </p>
              </div>
            </aside>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
