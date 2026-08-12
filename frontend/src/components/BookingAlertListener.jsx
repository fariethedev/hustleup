import { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSelector } from 'react-redux';
import { selectIsAuthenticated } from '../store/authSlice';
import { notificationsApi, bookingsApi } from '../api/client';
import { useToast } from '../context/ToastContext';
import { Handshake, Check, X, PenLine, Loader2 } from 'lucide-react';

const ACTIONABLE_TYPES = ['BOOKING_REQUEST', 'BOOKING_COUNTER'];
const POLL_MS = 8000; // matches the DM partner-list poll interval elsewhere in the app

/**
 * Global real-time-ish popup for booking negotiation. Polls for unread
 * BOOKING_REQUEST/BOOKING_COUNTER notifications (see BookingService.notifyInApp on the
 * backend) and surfaces the first one found as a full popup with Accept/Decline/Counter
 * actions — so a seller doesn't have to be sitting on the Dashboard bookings tab to know
 * a buyer wants to book, and a buyer doesn't have to refresh to see a counter-offer.
 *
 * Mounted once, globally, in App.jsx — active on every page while authenticated.
 */
export default function BookingAlertListener() {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const { showToast } = useToast();
  const [alert, setAlert] = useState(null); // the notification currently shown as a popup
  const [counterMode, setCounterMode] = useState(false);
  const [counterPrice, setCounterPrice] = useState('');
  const [busy, setBusy] = useState(false);
  const dismissedIds = useRef(new Set());
  const shownAlertRef = useRef(null); // mirrors `alert` synchronously, so the poll never races a re-show

  useEffect(() => {
    if (!isAuthenticated) return;

    const poll = async () => {
      // Don't fetch a new one while the user is already looking at a popup — avoid
      // swapping the card out from under them mid-decision.
      if (shownAlertRef.current) return;
      try {
        const res = await notificationsApi.getAll();
        const next = (res.data || []).find(
          (n) => !n.read && ACTIONABLE_TYPES.includes(n.notificationType) && !dismissedIds.current.has(n.id)
        );
        if (next) {
          shownAlertRef.current = next;
          setAlert(next);
        }
      } catch {
        // Best-effort — a failed poll just tries again next tick.
      }
    };

    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const dismiss = () => {
    if (alert) dismissedIds.current.add(alert.id);
    shownAlertRef.current = null;
    setAlert(null);
    setCounterMode(false);
    setCounterPrice('');
  };

  const closeAndMarkRead = async () => {
    const id = alert?.id;
    dismiss();
    if (id) {
      try { await notificationsApi.markRead(id); } catch {}
    }
  };

  const bookingId = alert?.referenceId;
  const isRequest = alert?.notificationType === 'BOOKING_REQUEST';

  const handleAccept = async () => {
    if (!bookingId) return;
    setBusy(true);
    try {
      await bookingsApi.accept(bookingId);
      showToast('Booking confirmed!', 'success');
      await closeAndMarkRead();
    } catch (e) {
      showToast(e.response?.data?.error || 'Could not accept — it may have already been updated', 'error');
      await closeAndMarkRead();
    } finally {
      setBusy(false);
    }
  };

  const handleDecline = async () => {
    if (!bookingId) return;
    setBusy(true);
    try {
      await bookingsApi.cancel(bookingId, isRequest ? 'Declined by seller' : 'Declined by buyer');
      showToast('Booking declined', 'success');
      await closeAndMarkRead();
    } catch (e) {
      showToast(e.response?.data?.error || 'Could not decline', 'error');
      await closeAndMarkRead();
    } finally {
      setBusy(false);
    }
  };

  const handleCounterSubmit = async () => {
    const price = parseFloat(counterPrice);
    if (!bookingId || !price || price <= 0) return;
    setBusy(true);
    try {
      await bookingsApi.counterOffer(bookingId, price);
      showToast('Counter-offer sent', 'success');
      await closeAndMarkRead();
    } catch (e) {
      showToast(e.response?.data?.error || 'Could not send counter-offer', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {alert && (
        <div className="fixed inset-0 z-[500] flex items-end sm:items-center justify-center px-4 pb-6 sm:pb-4 pointer-events-none">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={dismiss}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm pointer-events-auto"
          />
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ type: 'spring', bounce: 0.35 }}
            className="relative w-full max-w-sm bg-[#0A0A0A] border border-[#CDFF00]/30 rounded-3xl shadow-[0_0_60px_rgba(205,255,0,0.15)] p-6 pointer-events-auto"
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-11 h-11 rounded-2xl bg-[#CDFF00]/10 border border-[#CDFF00]/30 flex items-center justify-center shrink-0">
                <Handshake className="w-5 h-5 text-[#CDFF00]" />
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <p className="text-[10px] font-bold text-[#CDFF00] uppercase tracking-widest mb-1">
                  {isRequest ? 'New booking request' : 'Counter-offer'}
                </p>
                <h3 className="text-white font-bold text-sm leading-snug">{alert.title}</h3>
              </div>
              <button onClick={dismiss} className="p-1 -mt-1 -mr-1 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-sm text-gray-400 leading-relaxed mb-6">{alert.message}</p>

            {counterMode ? (
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 block">
                    Your counter price
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    autoFocus
                    value={counterPrice}
                    onChange={(e) => setCounterPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#CDFF00] transition-colors"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCounterMode(false)}
                    className="flex-1 py-2.5 rounded-xl border border-white/10 text-white text-sm font-bold hover:bg-white/5 transition-all"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleCounterSubmit}
                    disabled={busy || !counterPrice}
                    className="flex-1 py-2.5 rounded-xl bg-[#CDFF00] text-black text-sm font-bold disabled:opacity-40 hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
                  >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={handleDecline}
                  disabled={busy}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-300 text-sm font-bold hover:bg-white/5 hover:text-red-400 hover:border-red-400/30 transition-all flex items-center justify-center gap-1.5 disabled:opacity-40"
                >
                  <X className="w-4 h-4" /> Decline
                </button>
                {isRequest && (
                  <button
                    onClick={() => setCounterMode(true)}
                    disabled={busy}
                    className="flex-1 py-2.5 rounded-xl border border-white/10 text-white text-sm font-bold hover:bg-white/5 transition-all flex items-center justify-center gap-1.5 disabled:opacity-40"
                  >
                    <PenLine className="w-4 h-4" /> Counter
                  </button>
                )}
                <button
                  onClick={handleAccept}
                  disabled={busy}
                  className="flex-1 py-2.5 rounded-xl bg-[#CDFF00] text-black text-sm font-bold disabled:opacity-40 hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> Accept</>}
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
