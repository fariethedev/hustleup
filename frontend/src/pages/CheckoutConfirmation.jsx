import { useEffect, useState } from 'react';
import { useLocation, useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, ShoppingBag, MessageSquare, ArrowRight, Loader2, ClipboardList, AlertCircle } from 'lucide-react';
import { formatPrice } from '../utils/constants';
import { bookingsApi } from '../api/client';
import SmartImage from '../components/SmartImage';
import OrderNextSteps from '../components/OrderNextSteps';

/**
 * Post-purchase screen.
 *
 * Reached two different ways, which is why it does not simply trust router state:
 *  1. In-app, straight after placing an order — `state` carries the items.
 *  2. Redirected back from Stripe after paying — a full page load, so there is no state at
 *     all, only `?session_id=` in the URL.
 *
 * In the second case it verifies the session server-side and applies the payment, rather
 * than waiting on a webhook the browser cannot see. Locally that webhook never arrives, so
 * without this the buyer paid and the order still read "awaiting payment".
 */
export default function CheckoutConfirmation() {
  const { state } = useLocation();
  const [params] = useSearchParams();
  const { customer, items = [], total = 0, currency = 'PLN' } = state || {};

  const sessionId = params.get('session_id');
  const cameFromStripe = params.get('payment') === 'success';

  // 'idle' when there is nothing to verify (ordinary in-app arrival).
  const [confirming, setConfirming] = useState(sessionId ? 'working' : 'idle');
  const [confirmed, setConfirmed] = useState([]);

  useEffect(() => {
    if (!sessionId) return;
    bookingsApi.confirmPayment(sessionId)
      .then((r) => {
        const rows = Array.isArray(r.data) ? r.data : [];
        setConfirmed(rows);
        // 202 with an empty list means Stripe has not settled it yet — a real state for
        // bank redirects, and not the same thing as a failure.
        setConfirming(rows.length ? 'done' : 'pending');
      })
      .catch(() => setConfirming('failed'));
  }, [sessionId]);

  const paid = confirming === 'done' || (!sessionId && cameFromStripe);
  const first = confirmed[0];

  return (
    <div className="min-h-screen text-white flex items-center justify-center pt-20 pb-20 px-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-xl w-full text-center space-y-6"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.15, type: 'spring', stiffness: 260 }}
          className="w-20 h-20 rounded-full bg-[#CDFF00] text-black flex items-center justify-center mx-auto shadow-[0_0_60px_rgba(205,255,0,0.4)]"
        >
          {confirming === 'working'
            ? <Loader2 className="w-9 h-9 animate-spin" />
            : <CheckCircle className="w-10 h-10" />}
        </motion.div>

        <div>
          <h1 className="text-3xl sm:text-4xl font-black text-white uppercase tracking-tight mb-3">
            {confirming === 'working' ? 'Confirming payment…' : 'Order placed'}
          </h1>
          <p className="text-gray-400 font-medium">
            {customer?.fullName ? `Thanks, ${customer.fullName}. ` : ''}
            {confirming === 'working'
              ? 'Checking your payment with Stripe.'
              : confirming === 'pending'
                ? 'Your payment is still settling with your bank. The order updates on its own once it clears — you do not need to pay again.'
                : `Your order${items.length > 1 || confirmed.length > 1 ? 's have' : ' has'} been sent to the seller.`}
          </p>
        </div>

        {/* A failed verification must not read as a failed payment — the money may well have
            left. Say what is actually known and point at where the truth will show up. */}
        {confirming === 'failed' && (
          <div className="flex items-start gap-2.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-left">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-200/90 leading-relaxed">
              We couldn&apos;t confirm the payment just now. If it went through, your order updates
              shortly on its own — check <span className="font-bold">Dashboard → Bookings</span> before
              paying again, and message the seller if it still looks unpaid in a few minutes.
            </p>
          </div>
        )}

        {/* Items — from router state in-app, or from the reconciled bookings after Stripe */}
        {(items.length > 0 || confirmed.length > 0) && (
          <div className="rounded-3xl border border-white/10 bg-[#111] p-5 text-left space-y-3">
            {items.map((item) => (
              <div key={item.listingId} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl overflow-hidden bg-gray-800 shrink-0">
                    <SmartImage src={item.image} alt={item.title} fallbackIcon={ShoppingBag} className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-white font-black text-sm truncate">{item.title}</p>
                    <p className="text-gray-500 text-xs">Qty {item.quantity}</p>
                  </div>
                </div>
                <p className="text-[#CDFF00] font-black text-sm shrink-0">
                  {formatPrice((item.negotiatedPrice ?? item.price) * item.quantity, item.currency)}
                </p>
              </div>
            ))}

            {items.length === 0 && confirmed.map((b) => (
              <div key={b.id} className="flex items-center justify-between gap-4">
                <p className="text-white font-black text-sm truncate">{b.listingTitle || 'Your order'}</p>
                <p className="text-[#CDFF00] font-black text-sm shrink-0">
                  {formatPrice(b.agreedPrice ?? b.offeredPrice, b.currency)}
                </p>
              </div>
            ))}

            {items.length > 0 && (
              <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                <span className="text-white font-black uppercase tracking-widest text-sm">Total</span>
                <span className="text-[#CDFF00] text-xl font-black">{formatPrice(total, currency)}</span>
              </div>
            )}
          </div>
        )}

        <OrderNextSteps
          paid={paid}
          status={first?.fulfilment?.fulfilmentStatus}
          method={first?.fulfilment?.shippingMethod}
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Where the order actually lives, named explicitly — the previous version sent
              people to "Keep shopping" without ever saying where to watch the order. */}
          <Link
            to="/dashboard"
            className="flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-[#CDFF00] text-black font-black text-[11px] uppercase tracking-widest hover:bg-[#d9ff33] transition-colors"
          >
            <ClipboardList className="w-4 h-4" /> Track order
          </Link>
          <Link
            to="/dm"
            className="flex items-center justify-center gap-2 py-3.5 rounded-2xl border border-white/10 bg-white/5 text-white font-black text-[11px] uppercase tracking-widest hover:bg-white/10 transition-colors"
          >
            <MessageSquare className="w-4 h-4" /> Message seller
          </Link>
          <Link
            to="/explore"
            className="flex items-center justify-center gap-2 py-3.5 rounded-2xl border border-white/10 bg-white/5 text-white font-black text-[11px] uppercase tracking-widest hover:bg-white/10 transition-colors"
          >
            Keep shopping <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
