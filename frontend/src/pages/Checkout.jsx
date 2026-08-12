import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useDispatch, useSelector } from 'react-redux';
import { ArrowLeft, CreditCard, Landmark, Wallet, CircleDollarSign, ShieldCheck, Check, ShoppingBag } from 'lucide-react';
import { selectCartItems, selectCartTotal, clearCart } from '../store/cartSlice';
import { bookingsApi } from '../api/client';
import { formatPrice } from '../utils/constants';
import SmartImage from '../components/SmartImage';

const PAYMENT_METHODS = [
  { id: 'paypal', label: 'PayPal', description: 'Pay with your account', icon: CircleDollarSign },
  { id: 'blik', label: 'BLIK', description: 'Mobile (PL)', icon: Landmark },
  { id: 'apple_pay', label: 'Apple Pay', description: 'One-tap', icon: Wallet },
  { id: 'card', label: 'Card', description: 'Direct capture', icon: CreditCard },
];

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
      // listing row, so there's nothing to book for them — only real listings get a
      // booking created. This lets one cart mix items from multiple shops and sellers.
      const bookableItems = items.filter((item) => !String(item.listingId).startsWith('shop:'));
      const results = await Promise.allSettled(
        bookableItems.map((item) =>
          bookingsApi.create({
            listingId: item.listingId,
            offeredPrice: item.negotiatedPrice ?? item.price,
          })
        )
      );
      const failed = results.filter((r) => r.status === 'rejected');
      if (failed.length === bookableItems.length && bookableItems.length > 0) {
        throw new Error('Failed to place order. Please try again.');
      }
      dispatch(clearCart());
      navigate('/checkout/confirmation', { state: { customer, items, total, currency } });
    } catch (e) {
      setError(e.response?.data?.message || e.message || 'Failed to place order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen text-white pt-4 pb-10">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <Link
          to="/explore"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-white transition-colors mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Explore
        </Link>

        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight text-center mb-4">Checkout</h1>

          {error && (
            <div className="mb-4 p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-xs font-bold">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_0.85fr] gap-4">
            {/* Left: Customer Info + Payment */}
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-[#111] p-4">
                <h2 className="text-xs font-black text-white uppercase tracking-widest mb-3">Your Details</h2>
                <div className="space-y-2.5">
                  <input
                    type="text"
                    value={customer.fullName}
                    onChange={(e) => setCustomer((c) => ({ ...c, fullName: e.target.value }))}
                    placeholder="Full name"
                    className="w-full rounded-xl bg-[#1E1E1E] border border-white/10 px-4 py-2.5 text-sm text-white outline-none focus:border-[#CDFF00] transition-colors"
                  />
                  <input
                    type="email"
                    value={customer.email}
                    onChange={(e) => setCustomer((c) => ({ ...c, email: e.target.value }))}
                    placeholder="Email address"
                    className="w-full rounded-xl bg-[#1E1E1E] border border-white/10 px-4 py-2.5 text-sm text-white outline-none focus:border-[#CDFF00] transition-colors"
                  />
                  <input
                    type="tel"
                    value={customer.phone}
                    onChange={(e) => setCustomer((c) => ({ ...c, phone: e.target.value }))}
                    placeholder="Phone number (optional)"
                    className="w-full rounded-xl bg-[#1E1E1E] border border-white/10 px-4 py-2.5 text-sm text-white outline-none focus:border-[#CDFF00] transition-colors"
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#111] p-4">
                <h2 className="text-xs font-black text-white uppercase tracking-widest mb-3">Payment Method</h2>
                <div className="grid grid-cols-2 gap-2">
                  {PAYMENT_METHODS.map((method) => {
                    const Icon = method.icon;
                    const active = customer.paymentMethod === method.id;
                    return (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => setCustomer((c) => ({ ...c, paymentMethod: method.id }))}
                        className={`relative rounded-xl border p-2.5 text-left transition-all ${
                          active ? 'border-[#CDFF00] bg-[#CDFF00]/10' : 'border-white/10 bg-black/40 hover:border-white/25'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${active ? 'bg-[#CDFF00] text-black' : 'bg-[#1E1E1E] text-white'}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className={`text-[11px] font-black uppercase tracking-wide truncate ${active ? 'text-[#CDFF00]' : 'text-white'}`}>{method.label}</div>
                            <div className="text-[10px] text-gray-500 truncate">{method.description}</div>
                          </div>
                        </div>
                        {active && <Check className="w-3.5 h-3.5 text-[#CDFF00] absolute top-2 right-2" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right: Order Summary */}
            <div className="rounded-2xl border border-white/10 bg-black/50 p-4 h-fit lg:sticky lg:top-20">
              <h2 className="text-xs font-black text-white uppercase tracking-widest mb-3">Order Summary</h2>

              <div className="space-y-2 mb-4 max-h-[220px] overflow-y-auto pr-0.5">
                <AnimatePresence>
                  {items.map((item) => (
                    <motion.div
                      key={item.listingId}
                      layout
                      className="flex items-center gap-3 p-2.5 rounded-xl bg-[#111] border border-white/5"
                    >
                      <div className="w-9 h-9 rounded-lg overflow-hidden bg-gray-800 shrink-0 flex items-center justify-center">
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
                  <span className="text-white font-bold">—</span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-white/5">
                  <span className="text-white font-black uppercase tracking-widest text-xs">Total</span>
                  <span className="text-[#CDFF00] text-xl font-black">{formatPrice(total, currency)}</span>
                </div>
              </div>

              <div className="mt-4 p-3 rounded-xl bg-[#111] border border-white/5">
                <div className="flex items-center gap-1.5 text-[#CDFF00] text-[10px] font-black uppercase tracking-widest">
                  <ShieldCheck className="w-3.5 h-3.5" /> Secure Booking
                </div>
                <p className="text-[11px] text-gray-500 mt-1.5 leading-relaxed">
                  Bookings are confirmed with sellers before payment is captured.
                </p>
              </div>

              <button
                type="button"
                onClick={placeOrder}
                disabled={loading || !customer.fullName || !customer.email}
                className="mt-4 w-full py-3 rounded-xl bg-[#CDFF00] text-black font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50 hover:scale-[1.01] active:scale-95 transition-all shadow-[0_8px_20px_rgba(205,255,0,0.2)]"
              >
                {loading ? (
                  <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                ) : (
                  'Place Order'
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
