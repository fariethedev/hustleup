import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * One horizontally-scrolling shelf on the Explore page.
 *
 * The row deliberately shows a *sample* — the "View all" link is the way through to the
 * full collection on its own page, so Explore stays a short, scannable overview instead of
 * an endless wall of cards.
 *
 * @param {string}   title       shelf heading
 * @param {string}   subtitle    small eyebrow line above the heading
 * @param {Function} icon        lucide icon component drawn beside the heading
 * @param {string}   accentColor brand colour for this shelf
 * @param {string}   [viewAllTo] route for the "View all" link; omitted = no link
 * @param {number}   [total]     size of the full collection, shown next to the link
 * @param {boolean}  [loading]   renders skeleton tiles instead of children
 * @param {string}   [emptyText] message when there is nothing to show
 */
export default function ExploreRow({
  title,
  subtitle,
  icon: Icon,
  accentColor,
  viewAllTo,
  total,
  loading = false,
  isEmpty = false,
  emptyText = 'Nothing here yet — check back soon',
  skeletonWidth = 'w-[240px]',
  children,
}) {
  const scrollRef = useRef(null);
  // Arrows are hidden at the ends rather than left dangling as dead controls.
  const [edges, setEdges] = useState({ start: true, end: false });

  const syncEdges = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    const start = el.scrollLeft <= 8;
    // A row narrower than its container can't scroll at all — treat that as "at both ends".
    const end = maxScroll <= 8 || el.scrollLeft >= maxScroll - 8;
    // Returning the previous object when nothing moved makes React bail out of the re-render.
    // Without it, the effect below (which depends on `children`, a fresh array every render)
    // would set state → re-render → run again, forever.
    setEdges((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
  }, []);

  useEffect(() => {
    syncEdges();
    window.addEventListener('resize', syncEdges);
    return () => window.removeEventListener('resize', syncEdges);
  }, [syncEdges, children]);

  const scroll = (direction) => {
    const el = scrollRef.current;
    if (!el) return;
    // Page by roughly one viewport of cards so repeated clicks feel like turning pages.
    el.scrollBy({ left: direction * Math.max(el.clientWidth * 0.8, 280), behavior: 'smooth' });
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 26 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="py-6"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* ── Shelf header: stacked and centred, with the way out beneath the title ── */}
        <div className="flex flex-col items-center text-center gap-3 mb-5">
          <div className="min-w-0">
            <span className="text-[9px] font-black tracking-[0.3em] block mb-1" style={{ color: accentColor }}>
              {subtitle}
            </span>
            <h2 className="text-lg sm:text-2xl font-black text-white tracking-tighter flex items-center justify-center gap-2">
              <Icon className="w-5 h-5 shrink-0" style={{ color: accentColor }} />
              <span className="truncate">{title}</span>
            </h2>
          </div>

          {viewAllTo && (
            <Link
              to={viewAllTo}
              className="group shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-[10px] font-black tracking-widest text-white transition-all hover:text-black active:scale-95"
              style={{ borderColor: `${accentColor}66` }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = accentColor; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              View all
              {total > 0 && <span className="opacity-60 group-hover:opacity-80">({total})</span>}
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          )}
        </div>

        {isEmpty && !loading ? (
          <div className="text-center py-10 rounded-2xl bg-white/[0.02] border border-white/5 border-dashed">
            <p className="text-gray-500 text-xs font-bold tracking-widest">{emptyText}</p>
          </div>
        ) : (
          <div className="relative">
            {!edges.start && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={() => scroll(-1)}
                aria-label={`Scroll ${title} left`}
                className="hidden sm:flex absolute -left-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-[#0A0A0A] border items-center justify-center shadow-[0_4px_16px_rgba(0,0,0,0.7)] hover:scale-110 active:scale-95 transition-transform"
                style={{ borderColor: `${accentColor}66` }}
              >
                <ChevronLeft className="w-5 h-5" style={{ color: accentColor }} />
              </motion.button>
            )}
            {!edges.end && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={() => scroll(1)}
                aria-label={`Scroll ${title} right`}
                className="hidden sm:flex absolute -right-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-[#0A0A0A] border items-center justify-center shadow-[0_4px_16px_rgba(0,0,0,0.7)] hover:scale-110 active:scale-95 transition-transform"
                style={{ borderColor: `${accentColor}66` }}
              >
                <ChevronRight className="w-5 h-5" style={{ color: accentColor }} />
              </motion.button>
            )}

            <div
              ref={scrollRef}
              onScroll={syncEdges}
              // Centre the cards only when the shelf doesn't actually overflow. Applying
              // justify-center to a scrollable flex row clips the first card out of reach,
              // so it's gated on "can't scroll in either direction".
              className={`flex gap-4 overflow-x-auto overscroll-x-contain scrollbar-hide snap-x pb-3 px-1 ${
                edges.start && edges.end ? 'justify-center' : ''
              }`}
            >
              {loading
                ? [...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className={`shrink-0 ${skeletonWidth} h-72 bg-white/[0.03] border border-white/5 rounded-3xl animate-pulse`}
                      style={{ animationDelay: `${i * 90}ms` }}
                    />
                  ))
                : children}
            </div>
          </div>
        )}
      </div>
    </motion.section>
  );
}
