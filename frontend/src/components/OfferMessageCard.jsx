import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, HandCoins, Pencil, X } from 'lucide-react';
import { bookingsApi, dispatchToast } from '../api/client';
import { formatPrice, BOOKING_STATUS_MAP } from '../utils/constants';

const LIME = '#CDFF00';
// Statuses where the negotiation itself is over — the card stops polling and drops
// its action buttons for a plain confirmation line.
const TERMINAL = ['BOOKED', 'COMPLETED', 'CANCELLED'];

/**
 * The live, in-chat negotiation card for a single Booking — sent once (as an OFFER
 * message) when a buyer proposes a price, then re-rendered forever after: accept,
 * counter and decline are all PATCHes to the same booking, not new chat messages, so
 * this polls the booking by id rather than trusting anything snapshotted on the
 * message itself. Same lime accent as every other marketplace surface in the app —
 * see the palette comment at the top of DirectMessages.jsx for why Bond gets rose
 * instead and this doesn't.
 */
export default function OfferMessageCard({ bookingId }) {
  const [booking, setBooking] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [countering, setCountering] = useState(false);
  const [counterValue, setCounterValue] = useState('');
  const [busy, setBusy] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => () => { mountedRef.current = false; }, []);

  const load = () => {
    bookingsApi.getById(bookingId)
      .then((res) => { if (mountedRef.current) setBooking(res.data); })
      .catch(() => { if (mountedRef.current) setNotFound(true); });
  };

  useEffect(() => {
    if (!bookingId) return undefined;
    load();
    // Matches the BookingAlertListener poll cadence used elsewhere for booking state.
    const interval = setInterval(() => {
      // booking is read fresh via the functional setState below, so this closure
      // never needs booking?.status in its dependency array.
      setBooking((current) => {
        if (current && TERMINAL.includes(current.status)) {
          clearInterval(interval);
          return current;
        }
        load();
        return current;
      });
    }, 8000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  const act = async (fn, successMessage) => {
    setBusy(true);
    try {
      const res = await fn();
      setBooking(res.data);
      if (successMessage) dispatchToast(successMessage, 'success');
    } catch (err) {
      dispatchToast(err.response?.data?.error || 'Could not update that offer.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const submitCounter = async () => {
    const price = parseFloat(counterValue);
    if (!price || price <= 0) return;
    setBusy(true);
    try {
      const res = await bookingsApi.counterOffer(bookingId, price);
      setBooking(res.data);
      setCountering(false);
      setCounterValue('');
    } catch (err) {
      // Left open on failure — the price the seller typed shouldn't vanish along with the error.
      dispatchToast(err.response?.data?.error || 'Could not send counter-offer.', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (notFound) return null; // deleted/inaccessible booking — fail quiet, not with a broken card

  if (!booking) {
    return (
      <div className="w-[260px] rounded-2xl border border-white/10 bg-white/[0.03] p-3 animate-pulse">
        <div className="h-3 w-2/3 bg-white/10 rounded mb-2" />
        <div className="h-5 w-1/2 bg-white/10 rounded" />
      </div>
    );
  }

  const isBuyer = booking.role === 'buyer';
  const status = BOOKING_STATUS_MAP[booking.status] || { label: booking.status, color: 'bg-gray-800 text-gray-400' };
  // A pending INQUIRED request reads as something to "decline"; anything already
  // moving (negotiating/booked) reads as something to "cancel" — same endpoint either way.
  const isPendingRequest = booking.status === 'INQUIRED' && !isBuyer;

  const price = booking.agreedPrice ?? booking.counterPrice ?? booking.offeredPrice;
  const priceLabel = booking.agreedPrice
    ? 'Agreed price'
    : booking.status === 'NEGOTIATING' && booking.counterPrice
      ? 'Countered'
      : 'Offered';

  return (
    <div
      className="w-[280px] rounded-2xl border p-3"
      style={{ borderColor: `${LIME}40`, backgroundColor: `${LIME}0d` }}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: LIME }}>
          <HandCoins className="w-3.5 h-3.5 text-black" />
        </div>
        <span className="text-xs font-black text-white truncate flex-1">{booking.listingTitle || 'Negotiation'}</span>
        <span className={`px-1.5 py-0.5 rounded text-[8px] font-black tracking-[0.1em] shrink-0 ${status.color}`}>
          {status.label}
        </span>
      </div>

      <div className="flex items-baseline gap-1.5 mb-2.5">
        <span className="text-[9px] font-bold tracking-[0.15em] text-gray-500">{priceLabel}</span>
        <span className="text-lg font-black" style={{ color: LIME }}>{formatPrice(price, booking.currency)}</span>
        {booking.status === 'NEGOTIATING' && booking.counterPrice && (
          <span className="text-[10px] text-gray-500">(was {formatPrice(booking.offeredPrice, booking.currency)})</span>
        )}
      </div>

      {!TERMINAL.includes(booking.status) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {booking.status === 'INQUIRED' && !isBuyer && (
            <>
              <button
                disabled={busy}
                onClick={() => act(() => bookingsApi.accept(bookingId), 'Offer accepted')}
                className="px-2.5 py-1.5 rounded-lg font-black text-[9px] tracking-widest text-black hover:scale-105 transition-all disabled:opacity-50 flex items-center gap-1"
                style={{ backgroundColor: LIME }}
              >
                <Check className="w-3 h-3" /> Accept
              </button>
              <button
                disabled={busy}
                onClick={() => { setCountering((v) => !v); setCounterValue(''); }}
                className="px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white font-black text-[9px] tracking-widest hover:bg-white/10 transition-all flex items-center gap-1"
              >
                <Pencil className="w-3 h-3" /> Counter
              </button>
            </>
          )}

          {booking.status === 'NEGOTIATING' && isBuyer && (
            <button
              disabled={busy}
              onClick={() => act(() => bookingsApi.accept(bookingId), 'Deal agreed')}
              className="px-2.5 py-1.5 rounded-lg font-black text-[9px] tracking-widest text-black hover:scale-105 transition-all disabled:opacity-50 flex items-center gap-1"
              style={{ backgroundColor: LIME }}
            >
              <Check className="w-3 h-3" /> Accept {formatPrice(booking.counterPrice, booking.currency)}
            </button>
          )}

          <button
            disabled={busy}
            onClick={() => { if (confirm(isPendingRequest ? 'Decline this offer?' : 'Cancel this negotiation?')) act(() => bookingsApi.cancel(bookingId, 'Declined in chat')); }}
            className="px-2.5 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 font-black text-[9px] tracking-widest hover:bg-red-500/20 transition-all flex items-center gap-1"
          >
            <X className="w-3 h-3" /> {isPendingRequest ? 'Decline' : 'Cancel'}
          </button>
        </div>
      )}

      {countering && (
        <div className="mt-2 pt-2 border-t border-white/10 flex items-center gap-1.5">
          <input
            type="number"
            min="0"
            step="0.01"
            autoFocus
            value={counterValue}
            onChange={(e) => setCounterValue(e.target.value)}
            placeholder={`Counter (${booking.currency})`}
            className="flex-1 min-w-0 bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none"
          />
          <button
            disabled={busy || !counterValue}
            onClick={submitCounter}
            className="px-2.5 py-1.5 rounded-lg font-black text-[9px] tracking-widest text-black disabled:opacity-50 shrink-0"
            style={{ backgroundColor: LIME }}
          >
            Send
          </button>
        </div>
      )}

      {booking.status === 'BOOKED' && (
        <Link to="/dashboard" className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between text-[10px] font-bold text-gray-400 hover:text-white transition-colors">
          Manage in Dashboard →
        </Link>
      )}
    </div>
  );
}
