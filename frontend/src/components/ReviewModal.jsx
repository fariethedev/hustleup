import { useState } from 'react';
import { motion } from 'framer-motion';
import { Star, X, Loader2 } from 'lucide-react';

/**
 * The rating dialog shown when a transaction is finished.
 *
 * Used in two places, which is why it takes a submit handler rather than calling an API
 * itself: the seller sees it as a required step of marking a booking complete, and the buyer
 * sees it afterwards for a booking they still owe a review on.
 *
 * A star is a real judgement about a real person, so nothing is preselected — an empty
 * rating stays empty until the reviewer actually chooses, rather than defaulting to five and
 * collecting praise nobody gave.
 *
 * @param {string}   title        heading, e.g. "Complete booking"
 * @param {string}   subjectName  who is being rated
 * @param {string}   [context]    what the review is about, e.g. the listing title
 * @param {string}   [note]       extra line explaining consequences (e.g. payout release)
 * @param {string}   submitLabel  button text
 * @param {Function} onSubmit     async ({ rating, comment }) => void; throw to keep the modal open
 * @param {Function} onClose      dismiss; omit to make the dialog non-dismissible
 */
export default function ReviewModal({
  title,
  subjectName,
  context,
  note,
  submitLabel = 'Submit',
  onSubmit,
  onClose,
}) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async () => {
    if (!rating) { setError('Pick a rating from 1 to 5 stars.'); return; }
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ rating, comment: comment.trim() || null });
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || 'Could not save your review.');
      setBusy(false);
    }
  };

  const shown = hover || rating;
  const RATING_WORDS = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'];

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center px-4">
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/80 backdrop-blur-sm ${onClose ? 'cursor-pointer' : ''}`}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-sm bg-[#0a0a0a] border border-white/10 rounded-2xl p-6"
      >
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-3 right-3 p-1.5 rounded-lg text-gray-500 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        <h3 className="text-sm font-black text-white tracking-tight">{title}</h3>
        <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
          How was it working with <span className="text-white font-bold">{subjectName}</span>?
          {context && <span className="block text-gray-500 mt-0.5 truncate">{context}</span>}
        </p>

        {/* Stars */}
        <div className="flex items-center justify-center gap-1.5 my-5" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => { setRating(n); setError(null); }}
              onMouseEnter={() => setHover(n)}
              aria-label={`${n} star${n === 1 ? '' : 's'}`}
              className="p-1 transition-transform hover:scale-110 active:scale-95"
            >
              <Star
                className={`w-8 h-8 transition-colors ${
                  n <= shown ? 'fill-[#CDFF00] text-[#CDFF00]' : 'text-white/20'
                }`}
              />
            </button>
          ))}
        </div>
        <p className="text-center text-[11px] font-black tracking-widest text-gray-500 -mt-3 mb-4 h-4">
          {RATING_WORDS[shown]}
        </p>

        <textarea
          rows={3}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={1000}
          placeholder="Add a few words (optional)"
          className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-[#CDFF00] transition-colors resize-none"
        />

        {note && <p className="mt-3 text-[11px] text-gray-500 leading-relaxed">{note}</p>}
        {error && <p className="mt-3 text-[11px] font-bold text-red-400">{error}</p>}

        <button
          onClick={submit}
          disabled={busy}
          className="w-full mt-4 py-3 rounded-xl bg-[#CDFF00] text-black font-black text-xs tracking-widest hover:bg-[#d9ff33] active:scale-[0.99] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : submitLabel}
        </button>
      </motion.div>
    </div>
  );
}
