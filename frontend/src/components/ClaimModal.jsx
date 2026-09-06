import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, X, Loader2 } from 'lucide-react';
import { claimsApi, dispatchToast } from '../api/client';

/**
 * Reporting that an order went wrong.
 *
 * The reasons are a fixed list rather than a free-text box alone, because they are what an
 * admin sorts the queue by — "never turned up" and "arrived scratched" need different
 * evidence and different urgency, and a paragraph has to be read before it can be triaged.
 * The box is still there underneath, since the reason alone never tells the whole story.
 */
const REASONS = [
  { value: 'NOT_RECEIVED', label: 'Never arrived' },
  { value: 'DAMAGED', label: 'Arrived damaged' },
  { value: 'NOT_AS_DESCRIBED', label: 'Not as described' },
  { value: 'OTHER', label: 'Something else' },
];

export default function ClaimModal({ claim, onClose, onRaised }) {
  const [reason, setReason] = useState('NOT_RECEIVED');
  const [detail, setDetail] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await claimsApi.raise(claim.orderType, claim.orderId, reason, detail.trim());
      dispatchToast('Claim opened — the payment is on hold while we review it', 'success');
      onRaised?.();
      onClose();
    } catch (e) {
      dispatchToast(e.response?.data?.error || e.response?.data?.message || 'Could not open that claim', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center px-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.97 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0E0E0E] p-5"
        >
          <div className="flex items-start gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-[#CDFF00] text-black flex items-center justify-center shrink-0">
              <ShieldAlert className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-black text-white leading-tight">Report a problem</h3>
              <p className="text-[11px] text-gray-500 truncate">{claim.title || 'This order'}</p>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-white shrink-0" aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-gray-400 leading-relaxed mb-4">
            The seller&apos;s payment is put on hold as soon as you send this, and stays there
            until someone has looked at it. Nothing reaches them in the meantime.
          </p>

          <div className="space-y-1.5 mb-4">
            {REASONS.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setReason(r.value)}
                className={`w-full text-left px-3 py-2 rounded-xl border text-xs font-bold transition-colors ${
                  reason === r.value
                    ? 'border-[#CDFF00]/50 bg-[#CDFF00]/10 text-[#CDFF00]'
                    : 'border-white/10 bg-white/[0.03] text-gray-300 hover:border-white/25'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <textarea
            rows={3}
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            maxLength={1000}
            placeholder="What happened? Anything you can add helps us settle it faster."
            className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 text-sm outline-none focus:border-[#CDFF00] transition-colors resize-none"
          />

          <div className="flex gap-2 mt-4">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-white/15 text-gray-300 font-black text-[10px] tracking-widest hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={busy}
              className="flex-1 py-2.5 rounded-xl bg-[#CDFF00] text-black font-black text-[10px] tracking-widest hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
            >
              {busy ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending…</> : 'Open claim'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
