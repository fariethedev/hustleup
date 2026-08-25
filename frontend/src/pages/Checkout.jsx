import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useDispatch, useSelector } from 'react-redux';
import { ArrowLeft, ShieldCheck, Check, ShoppingBag, Lock, User, Mail, Phone } from 'lucide-react';
import { selectCartItems, selectCartTotal, clearCart } from '../store/cartSlice';
import { bookingsApi } from '../api/client';
import { formatPrice } from '../utils/constants';
import SmartImage from '../components/SmartImage';
import { ApplePayMark, PayPalMark, VisaMark, MastercardMark } from '../components/PaymentBrands';
import PaymentMethodPicker from '../components/PaymentMethodPicker';
import { findMethod } from '../utils/paymentMethods';

export default function Checkout() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const items = useSelector(selectCartItems);
  const total = useSelector(selectCartTotal);

  const [customer, setCustomer] = useState({ fullName: '', email: '', phone: '', paymentMethod: 'paypal' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const currency = items[0]?.currency || 'PLN';

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
      // Shop items (from the curated storefronts) aren't backed by a real marketplace
      // listing row, so there's nothing to book or charge for them. Only real listings
      // go to Stripe. This lets one cart mix items from multiple shops and sellers.
      const bookableItems = items.filter((item) => !String(item.listingId).startsWith('shop:'));
      if (bookableItems.length === 0) {
        throw new Error('Nothing in your basket can be purchased yet.');
      }

      // One request creates a booking per line and returns a SINGLE Stripe Checkout URL
      // covering all of them — one redirect, one card charge, however many sellers.
      const { data } = await bookingsApi.cartCheckout(
        bookableItems.map((item) => ({
          listingId: item.listingId,
          quantity: item.quantity ?? 1,
        }))
      );

      // The bookings now exist, so the cart has done its job — clearing it here stops a
      // back-button press from ordering the same basket twice. If the buyer abandons
      // Stripe, the orders are still payable from their dashboard.
      dispatch(clearCart());

      if (data.url) {
        // Hand off to Stripe's hosted page. Stripe returns the buyer to
        // /checkout/confirmation?payment=success afterwards.
        window.location.href = data.url;
        return;
      }

      // Nothing was instantly purchasable — every item needs its seller to accept first,
      // so there is no payment to make yet. Say so instead of implying a completed sale.
      navigate('/checkout/confirmation', {
        state: { customer, items, total, currency, awaitingApproval: data.awaitingApproval || [] },
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
  const selected = findMethod(customer.paymentMethod);

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
          to="/explore"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Explore
        </Link>

        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">Checkout</h1>
            <p className="inline-flex items-center gap-1.5 text-[11px] text-gray-500 font-bold mt-1.5">
              <Lock className="w-3 h-3" /> Encrypted · {items.length} item{items.length === 1 ? '' : 's'}
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-xs font-bold">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_0.85fr] gap-4">
            {/* ── Left: details + payment ── */}
            <div className="space-y-4">
              <section className="rounded-2xl border border-white/10 bg-[#0E0E0E] p-5">
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-6 h-6 rounded-full bg-[#CDFF00] text-black text-[11px] font-black flex items-center justify-center">1</span>
                  <h2 className="text-xs font-black text-white uppercase tracking-widest">Your details</h2>
                </div>
                <div className="space-y-2.5">
                  {field('fullName', 'Full name', 'text', User)}
                  {field('email', 'Email address', 'email', Mail)}
                  {field('phone', 'Phone number (optional)', 'tel', Phone)}
                </div>
              </section>

              <section className="rounded-2xl border border-white/10 bg-[#0E0E0E] p-5">
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-6 h-6 rounded-full bg-[#CDFF00] text-black text-[11px] font-black flex items-center justify-center">2</span>
                  <h2 className="text-xs font-black text-white uppercase tracking-widest">Payment method</h2>
                </div>

                <PaymentMethodPicker
                  value={customer.paymentMethod}
                  onChange={(id) => setCustomer((c) => ({ ...c, paymentMethod: id }))}
                />
              </section>
            </div>

            {/* ── Right: order summary ── */}
            <aside className="rounded-2xl border border-white/10 bg-[#0E0E0E] p-5 h-fit lg:sticky lg:top-20">
              <h2 className="text-xs font-black text-white uppercase tracking-widest mb-3">Order summary</h2>

              <div className="space-y-2 mb-4 max-h-[220px] overflow-y-auto scrollbar-hide pr-0.5">
                <AnimatePresence>
                  {items.map((item) => (
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
                  <span className="text-white font-bold">{formatPrice(total, currency)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">Fees</span>
                  <span className="text-[#CDFF00] font-bold">Included</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">Paying with</span>
                  <span className="text-white font-bold">{selected?.label}</span>
                </div>
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

              <button
                type="button"
                onClick={placeOrder}
                disabled={!canSubmit}
                className="mt-4 w-full py-3.5 rounded-xl bg-[#CDFF00] text-black font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 active:scale-95 transition-all shadow-[0_8px_24px_rgba(205,255,0,0.22)]"
              >
                {loading ? (
                  <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                ) : (
                  <><Lock className="w-3.5 h-3.5" /> Place order</>
                )}
              </button>

              <div className="mt-3 p-3 rounded-xl bg-black/40 border border-white/5">
                <div className="flex items-center gap-1.5 text-[#CDFF00] text-[10px] font-black uppercase tracking-widest">
                  <ShieldCheck className="w-3.5 h-3.5" /> Secure booking
                </div>
                <p className="text-[11px] text-gray-500 mt-1.5 leading-relaxed">
                  Bookings are confirmed with sellers before payment is captured.
                </p>
              </div>

              {/* Trust strip */}
              <div className="mt-3 flex items-center justify-center gap-2 opacity-70">
                <span className="h-6 px-1.5 rounded bg-white flex items-center"><VisaMark className="h-3 w-auto" /></span>
                <span className="h-6 px-1.5 rounded bg-white flex items-center"><MastercardMark className="h-3.5 w-auto" /></span>
                <span className="h-6 px-1.5 rounded bg-white flex items-center"><ApplePayMark className="h-3.5 w-auto" /></span>
                <span className="h-6 px-1.5 rounded bg-white flex items-center"><PayPalMark className="h-3 w-auto" /></span>
              </div>
            </aside>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
