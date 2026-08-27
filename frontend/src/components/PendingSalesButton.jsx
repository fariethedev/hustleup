import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, X, Package, ChevronRight, Loader2 } from 'lucide-react';
import { bookingsApi } from '../api/client';
import { formatPrice } from '../utils/constants';

/**
 * The seller's pending-orders indicator: a circular badge showing how many sales are
 * outstanding, opening a panel listing them.
 *
 * <p>"Outstanding" is anything the seller still owes a customer — an inquiry to answer, a
 * live negotiation, or a confirmed order to fulfil. COMPLETED and CANCELLED are excluded
 * server-side because neither needs anything further from them.
 *
 * <p>Deliberately seller-side only. A seller who also buys sees their own purchases in the
 * dashboard; folding those in here would make the count answer a different question than
 * the one the badge implies, which is "how much do I owe people?".
 *
 * <p>Renders nothing at all when there is nothing pending, so a seller with a clear queue
 * gets a clean bar rather than a permanent zero.
 */
export default function PendingSalesButton({ compact = false }) {
  const [open, setOpen] = useState(false);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    bookingsApi.pendingSales()
      .then((res) => setSales(res.data || []))
      // A buyer account gets 200 with an empty list; a network failure should leave the
      // badge hidden rather than showing a misleading count.
      .catch(() => setSales([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    // Slow poll: a pending order is not a live-chat-grade event, and the badge only needs
    // to be roughly current.
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [load]);

  const count = sales.length;

  // Nothing owed, or still loading the first response — stay out of the way entirely.
  if (loading || count === 0) return null;

  const statusTone = (status) => ({
    INQUIRED: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
    NEGOTIATING: 'text-[#FF00FF] bg-[#FF00FF]/10 border-[#FF00FF]/25',
    BOOKED: 'text-[#CDFF00] bg-[#CDFF00]/10 border-[#CDFF00]/20',
  }[status] || 'text-gray-400 bg-white/5 border-white/10');

  const statusLabel = (status) => ({
    INQUIRED: 'New enquiry',
    NEGOTIATING: 'Negotiating',
    BOOKED: 'To fulfil',
  }[status] || status);

  return (
    <>
      <motion.button
        type="button"
        onClick={() => setOpen(true)}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.92 }}
        transition={{ type: 'spring', stiffness: 400, damping: 22 }}
        aria-label={`${count} pending ${count === 1 ? 'sale' : 'sales'}`}
        title={`${count} pending ${count === 1 ? 'sale' : 'sales'}`}
        className={`relative flex items-center justify-center rounded-full border transition-colors shrink-0
          border-amber-400/30 bg-amber-400/10 text-amber-400 hover:bg-amber-400/20
          ${compact ? 'w-[46px] h-[46px]' : 'w-9 h-9'}`}
      >
        <Clock className={compact ? 'w-[22px] h-[22px]' : 'w-4 h-4'} />
        <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[17px] h-[17px] px-1 rounded-full bg-amber-400 text-black text-[9px] font-black ring-2 ring-[#0a0a0a] tabular-nums">
          {count > 9 ? '9+' : count}
        </span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[700] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          >
            <motion.div
              initial={{ opacity: 0, y: 28, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 28, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-lg bg-[#0a0a0a] border border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[85vh]"
            >
              <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between shrink-0">
                <h2 className="text-base font-black text-white uppercase tracking-tight flex items-center gap-2.5">
                  <Clock className="w-4 h-4 text-amber-400" />
                  Pending sales
                  <span className="px-2 py-0.5 rounded-full bg-amber-400 text-black text-[10px] font-black tabular-nums">
                    {count}
                  </span>
                </h2>
                <button
                  onClick={() => setOpen(false)}
                  className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
                {sales.map((s) => (
                  <Link
                    key={s.id}
                    to="/dashboard"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-amber-400/40 transition-colors"
                  >
                    <div className="w-11 h-11 rounded-xl bg-black/40 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
                      {s.listingImage
                        ? <img src={s.listingImage} alt="" className="w-full h-full object-cover" />
                        : <Package className="w-5 h-5 text-gray-600" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-black text-white truncate">{s.listingTitle || 'Listing'}</p>
                      <p className="text-xs text-gray-500 truncate">{s.buyerName || 'A buyer'}</p>
                      <span className={`inline-block mt-1 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border ${statusTone(s.status)}`}>
                        {statusLabel(s.status)}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-black text-[#CDFF00]">
                        {formatPrice(s.agreedPrice ?? s.offeredPrice, s.currency)}
                      </p>
                      <ChevronRight className="w-4 h-4 text-gray-600 ml-auto mt-1" />
                    </div>
                  </Link>
                ))}
              </div>

              <div className="px-5 py-4 border-t border-white/10 shrink-0">
                <Link
                  to="/dashboard"
                  onClick={() => setOpen(false)}
                  className="w-full py-3 rounded-xl bg-[#CDFF00] text-black font-black text-[11px] uppercase tracking-widest hover:brightness-110 transition-all flex items-center justify-center gap-2"
                >
                  Manage in dashboard <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
