import { useState } from 'react';
import { motion } from 'framer-motion';
import { Star, X, Loader2, Sparkles } from 'lucide-react';

/**
 * Asks the seller how HustleSpace is working for them, once a sale is finished.
 *
 * <h3>Why this replaced a review of the buyer</h3>
 * Completing a sale used to require the seller to rate the buyer. That collected the wrong
 * thing: the stars on a shop card, the leaderboard and the storefront average all come from
 * the buyer's review of the seller, which the buyer leaves separately. What the gate produced
 * was a seller's opinion of a buyer, shown almost nowhere — and it produced it by holding the
 * seller's own payout behind an opinion they had no particular reason to hold.
 *
 * Finishing a sale is still the right moment to ask a seller something. They have just been
 * all the way round the product — listed it, negotiated, shipped it, got paid — so it is the
 * one moment they can answer "did that work?" from memory rather than from impression.
 *
 * <h3>It is skippable, and says so</h3>
 * The sale is already complete before this opens. Nothing here gates the money, the order or
 * the buyer, so "Not now" is a real option rather than a dark-pattern decoy — and the copy
 * says the order is done so nobody sits on an unanswered dialog thinking their payout is
 * waiting on it. Feedback extracted under duress is worth less than no feedback, because it
 * is answered to make the box go away.
 *
 * @param {Function} onSubmit  async ({ rating, improvement }) => void
 * @param {Function} onClose   dismiss without answering
 */
export default function PlatformFeedbackModal({ onSubmit, onClose }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [improvement, setImprovement] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Nothing preselected. A default of five stars collects praise nobody gave.
  const shown = hover || rating;

  const LABELS = {
    1: 'Painful',
    2: 'Rough going',
    3: 'Does the job',
    4: 'Good',
    5: 'Excellent',
  };

  const submit = async () => {
    if (!rating) { setError('Pick a rating from 1 to 5 stars.'); return; }
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ rating, improvement: improvement.trim() || null });
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Could not send that. Try again.');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-title"
        className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0E0E0E] p-6 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)]"
      >
        <div className="flex items-start gap-3 mb-1">
          <span className="w-9 h-9 rounded-xl bg-[#CDFF00]/10 border border-[#CDFF00]/25 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-[#CDFF00]" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="feedback-title" className="text-lg font-black text-white leading-tight">
              Sale complete — how are we doing?
            </h2>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              Your order is finished and the payout is on its way. This is about HustleSpace,
              not the buyer, and only we see it.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 w-8 h-8 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-5">
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-500 mb-2">
            How is selling here working for you?
          </p>
          <div className="flex items-center gap-1.5" onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onMouseEnter={() => setHover(n)}
                onClick={() => { setRating(n); setError(null); }}
                aria-label={`${n} out of 5 — ${LABELS[n]}`}
                aria-pressed={rating === n}
                className="p-1 rounded-lg transition-transform hover:scale-110 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#CDFF00]"
              >
                <Star
                  className={`w-8 h-8 transition-colors ${
                    n <= shown ? 'fill-[#CDFF00] text-[#CDFF00]' : 'text-white/20'
                  }`}
                />
              </button>
            ))}
            {/* The word, not just the count — five anonymous stars mean different things to
                different people, and naming them is what makes a 3 usable data. */}
            <span className="ml-2 text-xs font-bold text-gray-400">{shown ? LABELS[shown] : ''}</span>
          </div>
        </div>

        <div className="mt-5">
          <label htmlFor="improvement" className="block text-[10px] font-black uppercase tracking-[0.15em] text-gray-500 mb-2">
            What should we improve?
          </label>
          <textarea
            id="improvement"
            value={improvement}
            onChange={(e) => setImprovement(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="Anything that slowed you down — fees, payouts, shipping, the listing form…"
            className="w-full rounded-xl bg-black/40 border border-white/10 px-3.5 py-3 text-sm text-white placeholder-gray-600 outline-none focus:border-[#CDFF00]/60 focus:bg-black/60 transition-colors resize-none"
          />
          <p className="text-[10px] text-gray-600 mt-1.5">Optional. A rating on its own still helps.</p>
        </div>

        {error && (
          <p className="mt-3 text-xs font-bold text-red-400">{error}</p>
        )}

        <div className="mt-5 flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-[10px] font-black uppercase tracking-widest hover:text-white hover:border-white/25 transition-colors"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="flex-1 py-3 rounded-xl bg-[#CDFF00] text-black text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50 hover:brightness-110 active:scale-95 transition-all"
          >
            {busy ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending…</> : 'Send feedback'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
