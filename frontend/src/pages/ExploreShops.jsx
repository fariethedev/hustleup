import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useShops } from '../hooks/useShops';
import { POLISH_CITIES } from '../utils/constants';
import ShopCard from '../components/ShopCard';
import ExploreNav from '../components/ExploreNav';
import { MapPin, Search, Store, X } from 'lucide-react';

export default function ExploreShops() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { shops: allShops, loading } = useShops();
  const [query, setQuery] = useState('');

  const city = searchParams.get('city') || '';
  const category = searchParams.get('category') || '';

  const setParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  };

  // Categories are seller-authored free text, so the filter bar is built from whatever
  // shops actually exist rather than a fixed list.
  const categories = useMemo(
    () => [...new Set(allShops.map((s) => s.category).filter(Boolean))].sort(),
    [allShops],
  );
  // Only offer cities that actually have a shop — a dropdown full of dead ends is worse
  // than a short one.
  const shopCities = useMemo(
    () => POLISH_CITIES.filter((c) => allShops.some((s) => s.city === c)),
    [allShops],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return allShops.filter((s) => {
      if (city && s.city !== city) return false;
      if (category && s.category !== category) return false;
      if (!needle) return true;
      return [s.name, s.category, s.tagline, s.description, s.city, s.ownerName]
        .some((f) => String(f || '').toLowerCase().includes(needle));
    });
  }, [allShops, query, city, category]);

  const hasFilters = !!(city || category || query);
  const clearAll = () => { setQuery(''); setSearchParams({}, { replace: true }); };

  return (
    <div className="min-h-screen font-sans pb-20">
      <ExploreNav />

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-7 pb-5">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
          <span className="text-[10px] font-black tracking-[0.35em] text-[#FF00FF]">
            {city || 'All of Poland'}
          </span>
          <h1 className="mt-2 text-3xl sm:text-4xl font-black text-white tracking-tighter flex items-center gap-3">
            <Store className="w-7 h-7 text-[#FF00FF]" />
            {category || 'All shops'}
          </h1>
          <p className="mt-2 text-sm text-gray-400">
            {loading ? 'Loading…' : `${visible.length} ${visible.length === 1 ? 'storefront' : 'storefronts'}`}
            {query && <> for “{query}”</>}
          </p>
        </motion.div>
      </section>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.08 }}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8"
      >
        <div className="p-4 rounded-3xl bg-[#0A0A0A] border border-white/10">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search shops…"
                className="w-full pl-11 pr-4 py-3 rounded-2xl bg-black border border-white/10 text-white text-sm font-medium placeholder:text-gray-600 outline-none focus:border-[#FF00FF] transition-colors"
              />
            </div>

            <div className="relative sm:w-52">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#CDFF00] pointer-events-none" />
              <select
                value={city}
                onChange={(e) => setParam('city', e.target.value)}
                aria-label="Filter shops by city"
                className="w-full appearance-none pl-11 pr-4 py-3 rounded-2xl bg-black border border-white/10 text-white text-sm font-bold outline-none focus:border-[#CDFF00] transition-colors cursor-pointer"
              >
                <option value="">All of Poland</option>
                {shopCities.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mt-3">
            <button
              onClick={() => setParam('category', '')}
              className={`px-3.5 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all active:scale-95 ${
                !category ? 'bg-[#FF00FF] text-white' : 'bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:border-white/30'
              }`}
            >
              All categories
            </button>
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setParam('category', category === c ? '' : c)}
                className={`px-3.5 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all active:scale-95 ${
                  category === c ? 'bg-[#FF00FF] text-white' : 'bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:border-white/30'
                }`}
              >
                {c}
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

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="h-80 rounded-3xl bg-white/[0.03] border border-white/5 animate-pulse"
                style={{ animationDelay: `${i * 80}ms` }}
              />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="text-center py-24">
            <Store className="w-12 h-12 mx-auto text-white/15 mb-5" />
            <h2 className="text-xl font-black text-white tracking-tight mb-2">No shops here</h2>
            <p className="text-sm text-gray-400 mb-6">
              {allShops.length === 0
                ? 'No storefronts are open yet. Sellers can open one from their dashboard.'
                : 'Nothing matches those filters yet.'}
            </p>
            {allShops.length === 0 ? (
              <Link
                to="/dashboard"
                className="inline-block px-6 py-3 rounded-2xl bg-[#CDFF00] text-black text-[10px] font-black tracking-widest hover:bg-[#d9ff33] active:scale-95 transition-all"
              >
                Open your shop
              </Link>
            ) : (
              <button
                onClick={clearAll}
                className="px-6 py-3 rounded-2xl bg-[#CDFF00] text-black text-[10px] font-black tracking-widest hover:bg-[#d9ff33] active:scale-95 transition-all"
              >
                Clear filters
              </button>
            )}
          </motion.div>
        ) : (
          <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            <AnimatePresence mode="popLayout">
              {visible.map((shop, i) => (
                <motion.div key={shop.id} layout exit={{ opacity: 0, scale: 0.94 }}>
                  <ShopCard shop={shop} index={i} />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </section>
    </div>
  );
}
