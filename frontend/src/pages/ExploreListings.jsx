import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { listingsApi } from '../api/client';
import { LISTING_TYPES, POLISH_CITIES } from '../utils/constants';
import ListingCard from '../components/ListingCard';
import ExploreNav from '../components/ExploreNav';
import { MapPin, Search, ShoppingBag, SlidersHorizontal, X } from 'lucide-react';

/** Sort modes. `latest` and `best_selling` are handled by the API; the rest are local. */
const SORTS = [
  { value: 'latest', label: 'Newest first' },
  { value: 'best_selling', label: 'Best selling' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'rating', label: 'Top rated' },
];

const SERVER_SORTS = ['latest', 'best_selling'];

export default function ExploreListings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  const type = searchParams.get('type') || '';
  const city = searchParams.get('city') || '';
  const sort = searchParams.get('sort') || 'latest';
  const q = searchParams.get('q') || '';

  // Local mirror so typing feels instant; the URL only updates on a debounce below.
  const [draftQuery, setDraftQuery] = useState(q);
  useEffect(() => { setDraftQuery(q); }, [q]);

  const setParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (draftQuery !== q) setParam('q', draftQuery);
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftQuery]);

  useEffect(() => {
    setLoading(true);
    // Filtering happens server-side so the page works over the whole catalogue, not just
    // the slice already downloaded. Unsupported sorts fall back to `latest` and are then
    // re-ordered locally.
    listingsApi.browse({
      ...(q ? { q } : {}),
      ...(type ? { type } : {}),
      ...(city ? { city } : {}),
      sort: SERVER_SORTS.includes(sort) ? sort : 'latest',
    })
      .then((r) => setListings(r.data || []))
      .catch(() => setListings([]))
      .finally(() => setLoading(false));
  }, [q, type, city, sort]);

  const visible = useMemo(() => {
    const items = [...listings];
    if (sort === 'price_asc') items.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    if (sort === 'price_desc') items.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    if (sort === 'rating') items.sort((a, b) => Number(b.avgRating || 0) - Number(a.avgRating || 0));
    return items;
  }, [listings, sort]);

  const activeType = LISTING_TYPES.find((t) => t.value === type);
  const hasFilters = !!(type || city || q) || sort !== 'latest';
  const clearAll = () => setSearchParams({}, { replace: true });

  return (
    <div className="min-h-screen font-sans pb-20">
      <ExploreNav />

      {/* ── Page header ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-7 pb-5">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
          <span className="text-[10px] font-black tracking-[0.35em] text-[#00FFFF]">
            {city || 'All of Poland'}
          </span>
          <h1 className="mt-2 text-3xl sm:text-4xl font-black text-white tracking-tighter flex items-center gap-3">
            <ShoppingBag className="w-7 h-7 text-[#00FFFF]" />
            {activeType ? activeType.label : 'All listings'}
          </h1>
          <p className="mt-2 text-sm text-gray-400">
            {loading ? 'Loading…' : `${visible.length} ${visible.length === 1 ? 'result' : 'results'}`}
            {q && <> for “{q}”</>}
          </p>
        </motion.div>
      </section>

      {/* ── Filter bar ── */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.08 }}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8"
      >
        <div className="p-4 rounded-3xl bg-[#0A0A0A] border border-white/10">
          <div className="flex flex-col lg:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="search"
                value={draftQuery}
                onChange={(e) => setDraftQuery(e.target.value)}
                placeholder="Search listings…"
                className="w-full pl-11 pr-4 py-3 rounded-2xl bg-black border border-white/10 text-white text-sm font-medium placeholder:text-gray-600 outline-none focus:border-[#00FFFF] transition-colors"
              />
            </div>

            <div className="relative lg:w-52">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#CDFF00] pointer-events-none" />
              <select
                value={city}
                onChange={(e) => setParam('city', e.target.value)}
                aria-label="Filter by city"
                className="w-full appearance-none pl-11 pr-4 py-3 rounded-2xl bg-black border border-white/10 text-white text-sm font-bold outline-none focus:border-[#CDFF00] transition-colors cursor-pointer"
              >
                <option value="">All of Poland</option>
                {POLISH_CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="relative lg:w-52">
              <SlidersHorizontal className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#FF00FF] pointer-events-none" />
              <select
                value={sort}
                onChange={(e) => setParam('sort', e.target.value === 'latest' ? '' : e.target.value)}
                aria-label="Sort listings"
                className="w-full appearance-none pl-11 pr-4 py-3 rounded-2xl bg-black border border-white/10 text-white text-sm font-bold outline-none focus:border-[#FF00FF] transition-colors cursor-pointer"
              >
                {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>

          {/* Category chips — labelled, not bare icons, so the filter is readable at a glance */}
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              onClick={() => setParam('type', '')}
              className={`px-3.5 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all active:scale-95 ${
                !type ? 'bg-[#FF00FF] text-white' : 'bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:border-white/30'
              }`}
            >
              All categories
            </button>
            {LISTING_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setParam('type', type === t.value ? '' : t.value)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all active:scale-95 ${
                  type === t.value ? 'bg-[#FF00FF] text-white' : 'bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:border-white/30'
                }`}
              >
                <t.icon className="w-3.5 h-3.5" /> {t.label}
              </button>
            ))}

            {hasFilters && (
              <button
                onClick={clearAll}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[10px] font-black tracking-widest bg-white/5 border border-white/10 text-gray-300 hover:text-white hover:border-white/30 transition-all active:scale-95"
              >
                <X className="w-3.5 h-3.5" /> Clear
              </button>
            )}
          </div>
        </div>
      </motion.section>

      {/* ── Results ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="h-80 rounded-2xl bg-white/[0.03] border border-white/5 animate-pulse"
                style={{ animationDelay: `${i * 80}ms` }}
              />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="text-center py-24">
            <ShoppingBag className="w-12 h-12 mx-auto text-white/15 mb-5" />
            <h2 className="text-xl font-black text-white tracking-tight mb-2">Nothing matched</h2>
            <p className="text-sm text-gray-400 mb-6">Try a wider search, or clear the filters.</p>
            <button
              onClick={clearAll}
              className="px-6 py-3 rounded-2xl bg-[#CDFF00] text-black text-[10px] font-black tracking-widest hover:bg-[#d9ff33] active:scale-95 transition-all"
            >
              Clear filters
            </button>
          </motion.div>
        ) : (
          <motion.div layout className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
            <AnimatePresence mode="popLayout">
              {visible.map((l, i) => (
                <motion.div key={l.id} layout exit={{ opacity: 0, scale: 0.94 }}>
                  <ListingCard listing={l} index={i} />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </section>
    </div>
  );
}
