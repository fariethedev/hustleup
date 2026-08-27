import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Star, MessageSquareQuote } from 'lucide-react';
import { reviewsApi } from '../api/client';

/** Row of five stars at a given rating. */
function Stars({ rating, className = 'w-3.5 h-3.5' }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`${className} ${n <= Math.round(rating) ? 'fill-[#CDFF00] text-[#CDFF00]' : 'text-white/20'}`}
        />
      ))}
    </span>
  );
}

/**
 * What buyers said about this shop, shown above the products.
 *
 * Reviews live against the shop's OWNER rather than the shop itself — a review is written
 * about the person you transacted with, and the same seller's rating is what the shop card
 * on Explore already averages. Reading them from `reviews/user/{ownerId}` keeps the number
 * on the card and the reviews on the page telling the same story.
 */
export default function ShopReviews({ ownerId, ownerName, rating = 0, reviewCount = 0 }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!ownerId) { setLoading(false); return undefined; }
    let cancelled = false;
    setLoading(true);
    reviewsApi.getForUser(ownerId)
      .then((r) => { if (!cancelled) setReviews(r.data || []); })
      .catch(() => { if (!cancelled) setReviews([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [ownerId]);

  // Distribution of 5→1, so a shop with one bad review among thirty reads honestly.
  const breakdown = useMemo(() => {
    const counts = [0, 0, 0, 0, 0];
    reviews.forEach((r) => { if (r.rating >= 1 && r.rating <= 5) counts[r.rating - 1] += 1; });
    return counts;
  }, [reviews]);

  if (loading) {
    return <div className="h-32 rounded-3xl bg-white/[0.03] border border-white/5 animate-pulse mb-8" />;
  }

  // A brand-new shop says so plainly rather than rendering an empty five-star shell, which
  // would imply a perfect record nobody earned.
  if (reviews.length === 0) {
    return (
      <div className="mb-8 flex items-center gap-3 p-4 rounded-2xl bg-white/[0.02] border border-white/10 border-dashed">
        <MessageSquareQuote className="w-5 h-5 text-white/25 shrink-0" />
        <p className="text-xs text-gray-500">
          No reviews yet — {ownerName || 'this seller'} hasn&apos;t completed a transaction on
          HustleSpace so far. Ratings appear here automatically once they do.
        </p>
      </div>
    );
  }

  const shown = expanded ? reviews : reviews.slice(0, 3);
  const total = reviewCount || reviews.length;
  const average = rating || (reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length);

  return (
    <section className="mb-10">
      <div className="rounded-3xl bg-white/[0.03] border border-white/10 p-5 sm:p-6">
        {/* Headline number + distribution */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-5 pb-5 border-b border-white/10">
          <div className="flex items-center gap-4 shrink-0">
            <div className="text-center">
              <p className="text-4xl font-black text-[#CDFF00] leading-none">{average.toFixed(1)}</p>
              <div className="mt-1.5 flex justify-center"><Stars rating={average} /></div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mt-1.5">
                {total} review{total === 1 ? '' : 's'}
              </p>
            </div>
          </div>

          <div className="flex-1 space-y-1 min-w-0">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = breakdown[star - 1];
              const pct = reviews.length ? (count / reviews.length) * 100 : 0;
              return (
                <div key={star} className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-gray-500 w-3 shrink-0">{star}</span>
                  <Star className="w-3 h-3 text-white/25 shrink-0" />
                  <span className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                    <motion.span
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                      className="block h-full rounded-full bg-[#CDFF00]"
                    />
                  </span>
                  <span className="text-[10px] font-bold text-gray-500 w-6 text-right shrink-0">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Individual reviews */}
        <div className="pt-5 space-y-4">
          {shown.map((r, i) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.05, 0.2) }}
              className="flex gap-3"
            >
              <div className="w-9 h-9 rounded-full bg-black border border-white/10 flex items-center justify-center shrink-0 text-[11px] font-black text-[#00FFFF]">
                {(r.reviewerName || 'U')[0].toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-white truncate">{r.reviewerName || 'Buyer'}</span>
                  <Stars rating={r.rating} className="w-3 h-3" />
                  {r.createdAt && (
                    <span className="text-[10px] text-gray-600">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
                {r.comment && (
                  <p className="text-xs text-gray-300 leading-relaxed mt-1 whitespace-pre-line">{r.comment}</p>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {reviews.length > 3 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="mt-5 w-full py-2.5 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-gray-300 hover:text-white hover:border-white/30 transition-colors"
          >
            {expanded ? 'Show fewer' : `Read all ${reviews.length} reviews`}
          </button>
        )}
      </div>
    </section>
  );
}
