import { useEffect, useRef, useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { ShieldX, CircleX, Loader } from 'lucide-react';
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
  const [error, setError] = useState('');
  const dialogRef = useRef(null);
  const closeState = useRef({ busy, onClose });
  useEffect(() => { closeState.current = { busy, onClose }; }, [busy, onClose]);
  useEffect(() => {
    const previous = document.activeElement;
    const onKey = event => {
      if (event.key === 'Escape' && !closeState.current.busy) closeState.current.onClose();
      if (event.key !== 'Tab') return;
      const controls = [...dialogRef.current.querySelectorAll('button:not(:disabled), textarea')];
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); previous?.focus?.(); };
  }, []);

  const submit = async () => {
    if (busy || detail.trim().length < 10) return;
    setError('');
    setBusy(true);
    try {
      await claimsApi.raise(claim.orderType, claim.orderId, reason, detail.trim());
      dispatchToast('Problem reported. You can track the review on this order.', 'success');
      onRaised?.();
      onClose();
    } catch (e) {
      setError(e.response?.data?.error || e.response?.data?.message || 'Could not send your report. Your text is saved here; please retry.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      <Motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[400] bg-black/80 backdrop-blur-sm flex items-center justify-center px-4"
        onClick={() => { if (!busy) onClose(); }}
      >
        <Motion.div
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.97 }}
          onClick={(e) => e.stopPropagation()}
          role="dialog" aria-modal="true" aria-labelledby="claim-title"
          ref={dialogRef}
          className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0E0E0E] p-5"
        >
          <div className="flex items-start gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-[#CDFF00] text-black flex items-center justify-center shrink-0">
              <ShieldX className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 id="claim-title" className="text-base font-black text-white leading-tight">Report a problem</h3>
              <p className="text-[11px] text-gray-500 truncate">{claim.title || 'This order'}</p>
            </div>
            <button disabled={busy} onClick={onClose} className="text-gray-500 hover:text-white shrink-0" aria-label="Close">
              <CircleX className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-gray-400 leading-relaxed mb-4">
            Tell us what happened so we can review this order. An open report blocks any payout
            that has not already been released. Money already sent to the seller cannot be put
            back on hold, and a report does not guarantee a refund.
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
            aria-label="What happened?" autoFocus
            rows={3}
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            maxLength={1000}
            placeholder="What happened? Anything you can add helps us settle it faster."
            className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 text-sm outline-none focus:border-[#CDFF00] transition-colors resize-none"
          />
          <p className="mt-1 text-xs text-gray-400">Add at least 10 characters. Do not include passwords or bank details.</p>
          {error && <p role="alert" className="mt-3 text-sm text-red-400">{error}</p>}

          <div className="flex gap-2 mt-4">
            <button
              onClick={onClose}
              disabled={busy}
              className="flex-1 py-2.5 rounded-xl border border-white/15 text-gray-300 font-black text-[10px] tracking-widest hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={busy || detail.trim().length < 10}
              className="flex-1 py-2.5 rounded-xl bg-[#CDFF00] text-black font-black text-[10px] tracking-widest hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
            >
              {busy ? <><Loader className="w-3.5 h-3.5 animate-spin" /> Sending…</> : 'Open claim'}
            </button>
          </div>
        </Motion.div>
      </Motion.div>
    </AnimatePresence>
  );
}
