import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useDispatch, useSelector } from 'react-redux';
import { ArrowLeft, CreditCard, Landmark, Wallet, ShieldCheck, Check, ShoppingBag } from 'lucide-react';
import { selectCartItems, selectCartTotal, clearCart } from '../store/cartSlice';
import { bookingsApi } from '../api/client';
import { formatPrice } from '../utils/constants';

const PAYMENT_METHODS = [
  { id: 'stripe', label: 'Stripe', description: 'Cards and wallets gateway.', icon: CreditCard },
  { id: 'blik', label: 'BLIK', description: 'Fast mobile checkout (Poland).', icon: Landmark },
  { id: 'apple_pay', label: 'Apple Pay', description: 'One-tap wallet checkout.', icon: Wallet },
  { id: 'card', label: 'Card', description: 'Direct card capture.', icon: CreditCard },
];

export default function Checkout() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const items = useSelector(selectCartItems);
  const total = useSelector(selectCartTotal);

  const [customer, setCustomer] = useState({ fullName: '', email: '', phone: '', paymentMethod: 'stripe' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const currency = items[0]?.currency || 'GBP';

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center px-4">
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
      // Create a booking for each cart item
      await Promise.all(
        items.map((item) =>
          bookingsApi.create({
            listingId: item.listingId,
            offeredPrice: item.negotiatedPrice ?? item.price,
          })
        )
      );
      dispatch(clearCart());
      navigate('/checkout/confirmation', { state: { customer, items, total, currency } });
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to place order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white pt-24 pb-20">
      <div className="max-w-6xl mx-auto px-6">
        <Link
          to="/explore"
          className="inline-flex items-center gap-2 text-sm font-bold text-gray-400 hover:text-white transition-colors mb-10"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Explore
        </Link>

        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-4xl font-black text-white uppercase tracking-tight mb-10">Checkout</h1>

          {error && (
            <div className="mb-6 p-4 rounded-2xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm font-bold">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_0.85fr] gap-8">
            {/* Left: Customer Info + Payment */}
            <div className="space-y-6">
              <div className="rounded-[2rem] border border-white/10 bg-[#111] p-8">
                <h2 className="text-lg font-black text-white uppercase tracking-tight mb-6">Your Details</h2>
                <div className="space-y-4">
                  <input
                    type="text"
                    value={customer.fullName}
                    onChange={(e) => setCustomer((c) => ({ ...c, fullName: e.target.value }))}
                    placeholder="Full name"
                    className="w-full rounded-2xl bg-[#1E1E1E] border border-white/10 px-5 py-4 text-white outline-none focus:border-[#CDFF00] transition-colors"
                  />
                  <input
                    type="email"
                    value={customer.email}
                    onChange={(e) => setCustomer((c) => ({ ...c, email: e.target.value }))}
                    placeholder="Email address"
                    className="w-full rounded-2xl bg-[#1E1E1E] border border-white/10 px-5 py-4 text-white outline-none focus:border-[#CDFF00] transition-colors"
                  />
                  <input
                    type="tel"
                    value={customer.phone}
                    onChange={(e) => setCustomer((c) => ({ ...c, phone: e.target.value }))}
                    placeholder="Phone number (optional)"
                    className="w-full rounded-2xl bg-[#1E1E1E] border border-white/10 px-5 py-4 text-white outline-none focus:border-[#CDFF00] transition-colors"
                  />
                </div>
              </div>

              <div className="rounded-[2rem] border border-white/10 bg-[#111] p-8">
                <h2 className="text-lg font-black text-white uppercase tracking-tight mb-6">Payment Method</h2>
                <div className="space-y-3">
                  {PAYMENT_METHODS.map((method) => {
                    const Icon = method.icon;
                    const active = customer.paymentMethod === method.id;
                    return (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => setCustomer((c) => ({ ...c, paymentMethod: method.id }))}
                        className={`w-full rounded-2xl border p-4 text-left transition-all ${
                          active ? 'border-[#CDFF00] bg-[#CDFF00]/10' : 'border-white/10 bg-black/40 hover:border-white/25'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${active ? 'bg-[#CDFF00] text-black' : 'bg-[#1E1E1E] text-white'}`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <div className="flex-1">
                            <div className={`text-sm font-black uppercase tracking-[0.2em] ${active ? 'text-[#CDFF00]' : 'text-white'}`}>{method.label}</div>
                            <div className="text-xs text-gray-500 mt-0.5">{method.description}</div>
                          </div>
                          {active && <Check className="w-5 h-5 text-[#CDFF00]" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right: Order Summary */}
            <div className="rounded-[2rem] border border-white/10 bg-black/50 p-8 h-fit sticky top-24">
              <h2 className="text-lg font-black text-white uppercase tracking-tight mb-6">Order Summary</h2>

              <div className="space-y-3 mb-6">
                <AnimatePresence>
                  {items.map((item) => (
                    <motion.div
                      key={item.listingId}
                      layout
                      className="flex items-center gap-4 p-4 rounded-2xl bg-[#111] border border-white/5"
                    >
                      <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-800 shrink-0">
                        {item.image ? (
                          <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ShoppingBag className="w-5 h-5 text-gray-600" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-black text-sm truncate">{item.title}</p>
                        <p className="text-gray-500 text-xs mt-0.5">Qty {item.quantity}</p>
                      </div>
                      <p className="text-white font-black text-sm shrink-0">
                        {formatPrice((item.negotiatedPrice ?? item.price) * item.quantity, item.currency)}
                      </p>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              <div className="border-t border-white/10 pt-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Subtotal</span>
                  <span className="text-white font-bold">{formatPrice(total, currency)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Fees</span>
                  <span className="text-white font-bold">—</span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-white/5">
                  <span className="text-white font-black uppercase tracking-widest text-sm">Total</span>
                  <span className="text-[#CDFF00] text-2xl font-black">{formatPrice(total, currency)}</span>
                </div>
              </div>

              <div className="mt-6 p-4 rounded-2xl bg-[#111] border border-white/5">
                <div className="flex items-center gap-2 text-[#CDFF00] text-xs font-black uppercase tracking-widest">
                  <ShieldCheck className="w-4 h-4" /> Secure Booking
                </div>
                <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                  Payment processing integration ready. Bookings are confirmed with sellers before payment is captured.
                </p>
              </div>

              <button
                type="button"
                onClick={placeOrder}
                disabled={loading || !customer.fullName || !customer.email}
                className="mt-6 w-full py-4 rounded-2xl bg-[#CDFF00] text-black font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50 hover:scale-[1.02] active:scale-95 transition-all shadow-[0_8px_30px_rgba(205,255,0,0.25)]"
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
