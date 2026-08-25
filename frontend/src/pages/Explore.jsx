import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { AnimatePresence, motion } from 'framer-motion';
import { listingsApi, usersApi } from '../api/client';
import { selectUser } from '../store/authSlice';
import { POLISH_CITIES, LISTING_TYPES } from '../utils/constants';
import { useShops } from '../hooks/useShops';
import ListingCard from '../components/ListingCard';
import ShopCard from '../components/ShopCard';
import CreatorCard from '../components/CreatorCard';
import {
  Store, ShoppingBag, MapPin, Search, X, Users, Compass,
  SlidersHorizontal, LayoutGrid,
} from 'lucide-react';

/* ── Tab definitions ── */
const TABS = [
  { key: 'all',      label: 'All',      icon: LayoutGrid, accent: '#00FFFF' },
  { key: 'listings', label: 'Listings',  icon: ShoppingBag, accent: '#00FFFF' },
  { key: 'shops',    label: 'Shops',     icon: Store,       accent: '#FF00FF' },
  { key: 'creators', label: 'Creators',  icon: Users,       accent: '#CDFF00' },
];

/* ── Sort options (listings only) ── */
const SORTS = [
  { value: 'latest',       label: 'Newest first' },
  { value: 'best_selling', label: 'Best selling' },
  { value: 'price_asc',    label: 'Price: low → high' },
  { value: 'price_desc',   label: 'Price: high → low' },
  { value: 'rating',       label: 'Top rated' },
];

/** Case/diacritic-tolerant substring match across searchable fields. */
function matches(query, ...fields) {
  if (!query) return true;
  const needle = query.trim().toLowerCase();
  return fields.some((f) => String(f || '').toLowerCase().includes(needle));
}

export default function Explore() {
  const currentUser = useSelector(selectUser);
  const { shops: allShops, loading: shopsLoading } = useShops();
  const [allListings, setAllListings] = useState([]);
  const [creators, setCreators] = useState([]);
  const [loading, setLoading] = useState(true);

  /* ── UI state ── */
  const [tab, setTab] = useState('all');
  const [query, setQuery] = useState('');
  const [city, setCity] = useState('');
  const [sort, setSort] = useState('latest');
  const [listingType, setListingType] = useState('');

  /* ── Data fetching ── */
  useEffect(() => {
    setLoading(true);
    listingsApi.browse({})
      .then((r) => setAllListings(r.data || []))
      .catch(() => setAllListings([]))
      .finally(() => setLoading(false));

    usersApi.getAll()
      .then((r) => setCreators((r.data || []).filter((u) => u.id !== currentUser?.id)))
      .catch(() => setCreators([]));
  }, [currentUser?.id]);

  /* ── Filtering ── */
  const cityMatch = useCallback(
    (value) => !city || String(value || '').toLowerCase() === city.toLowerCase(),
    [city],
  );

  const listings = useMemo(() => {
    let items = allListings.filter((l) =>
      cityMatch(l.locationCity) && matches(query, l.title, l.description, l.locationCity, l.sellerName));
    if (listingType) items = items.filter((l) => (l.listingType || l.type) === listingType);

    // Local sorting
    if (sort === 'price_asc')  items = [...items].sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    if (sort === 'price_desc') items = [...items].sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    if (sort === 'rating')     items = [...items].sort((a, b) => Number(b.avgRating || 0) - Number(a.avgRating || 0));
    return items;
  }, [allListings, query, cityMatch, listingType, sort]);

  const shops = useMemo(
    () => allShops.filter((s) =>
      cityMatch(s.city) && matches(query, s.name, s.category, s.tagline, s.city, s.ownerName)),
    [allShops, query, cityMatch],
  );

  const people = useMemo(
    () => creators.filter((u) => cityMatch(u.city) && matches(query, u.fullName, u.username, u.city, u.bio)),
    [creators, query, cityMatch],
  );

  /* ── Result counts ── */
  const counts = { all: listings.length + shops.length + people.length, listings: listings.length, shops: shops.length, creators: people.length };
  const activeTab = TABS.find((t) => t.key === tab);
  const resultCount = counts[tab] || 0;
  const isLoading = loading || shopsLoading;
  const hasFilters = !!(query || city || listingType) || sort !== 'latest';
  const clearFilters = () => { setQuery(''); setCity(''); setListingType(''); setSort('latest'); };

  /* ── Render helpers ── */
  const skeletons = (count, height = 'h-72') => (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
      {[...Array(count)].map((_, i) => (
        <div
          key={i}
          className={`${height} rounded-2xl bg-white/[0.03] border border-white/5 animate-pulse`}
          style={{ animationDelay: `${i * 80}ms` }}
        />
      ))}
    </div>
  );

  const emptyState = (icon, message) => (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="text-center py-20">
      {icon}
      <h2 className="text-xl font-black text-white uppercase tracking-tight mb-2">No results</h2>
      <p className="text-sm text-gray-400 mb-6">{message}</p>
      <button
        onClick={clearFilters}
        className="px-6 py-3 rounded-2xl bg-[#CDFF00] text-black text-[10px] font-black uppercase tracking-widest hover:bg-[#d9ff33] active:scale-95 transition-all"
      >
        Clear filters
      </button>
    </motion.div>
  );

  /* Interleave listings, shops, and creators for the "All" tab */
  const allItems = useMemo(() => {
    const items = [];
    const maxLen = Math.max(listings.length, shops.length, people.length);
    for (let i = 0; i < maxLen; i++) {
      if (i < listings.length) items.push({ type: 'listing', data: listings[i], id: `l-${listings[i].id}` });
      if (i < shops.length) items.push({ type: 'shop', data: shops[i], id: `s-${shops[i].id}` });
      if (i < people.length) items.push({ type: 'creator', data: people[i], id: `c-${people[i].id}` });
    }
    return items;
  }, [listings, shops, people]);

  return (
    <div className="min-h-screen font-sans pb-20">

      {/* ── Sticky search & filter header ── */}
      <div className="sticky top-14 md:top-16 z-[90] bg-black/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">

          {/* Row 1: Search + City */}
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search listings, shops, creators…"
                className="w-full pl-11 pr-10 py-3 rounded-2xl bg-[#0A0A0A] border border-white/10 text-white text-sm font-medium placeholder:text-gray-600 outline-none focus:border-[#00FFFF] transition-colors"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="relative sm:w-52">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#CDFF00] pointer-events-none" />
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                aria-label="Filter by city"
                className="w-full appearance-none pl-11 pr-4 py-3 rounded-2xl bg-[#0A0A0A] border border-white/10 text-white text-sm font-bold outline-none focus:border-[#CDFF00] transition-colors cursor-pointer"
              >
                <option value="">All of Poland</option>
                {POLISH_CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Sort — only visible on listings tab or all tab */}
            {(tab === 'listings' || tab === 'all') && (
              <div className="relative sm:w-52">
                <SlidersHorizontal className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#FF00FF] pointer-events-none" />
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  aria-label="Sort results"
                  className="w-full appearance-none pl-11 pr-4 py-3 rounded-2xl bg-[#0A0A0A] border border-white/10 text-white text-sm font-bold outline-none focus:border-[#FF00FF] transition-colors cursor-pointer"
                >
                  {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Row 2: Tabs + result count */}
          <div className="flex items-center justify-between mt-3 gap-3">
            <nav className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
              {TABS.map((t) => {
                const isActive = tab === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => { setTab(t.key); setListingType(''); }}
                    className={`relative flex items-center gap-1.5 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-colors ${
                      isActive ? 'text-black' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="explore-tab-bg"
                        className="absolute inset-0 rounded-xl shadow-[0_0_16px_rgba(0,255,255,0.3)]"
                        style={{ backgroundColor: t.accent }}
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      />
                    )}
                    <t.icon className="relative w-4 h-4" />
                    <span className="relative">{t.label}</span>
                    <span className={`relative text-[9px] ml-0.5 ${isActive ? 'opacity-70' : 'opacity-50'}`}>
                      {counts[t.key]}
                    </span>
                  </button>
                );
              })}
            </nav>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 hidden sm:block">
                {isLoading ? 'Loading…' : `${resultCount} result${resultCount !== 1 ? 's' : ''}`}
              </span>
              {hasFilters && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-white/5 border border-white/10 text-gray-300 hover:text-white hover:border-white/25 transition-colors"
                >
                  <X className="w-3 h-3" /> Clear
                </button>
              )}
            </div>
          </div>

          {/* Row 3: Listing type chips — only on listings tab */}
          {(tab === 'listings') && (
            <div className="flex flex-wrap gap-2 mt-3">
              <button
                onClick={() => setListingType('')}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${
                  !listingType ? 'bg-[#00FFFF] text-black' : 'bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:border-white/30'
                }`}
              >
                All types
              </button>
              {LISTING_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setListingType(listingType === t.value ? '' : t.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${
                    listingType === t.value ? 'bg-[#00FFFF] text-black' : 'bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:border-white/30'
                  }`}
                >
                  <t.icon className="w-3.5 h-3.5" /> {t.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Ambient glow behind content ── */}
      <div className="relative">
        <div className="absolute -top-32 -left-24 w-96 h-96 rounded-full blur-[120px] pointer-events-none" style={{ background: activeTab?.accent, opacity: 0.08 }} />
        <div className="absolute -top-20 right-0 w-72 h-72 rounded-full bg-[#FF00FF]/10 blur-[120px] pointer-events-none" />
      </div>

      {/* ── Content grid ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-10">
        <AnimatePresence mode="wait">

          {/* ═══ ALL TAB ═══ */}
          {tab === 'all' && (
            <motion.div key="all" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}>
              {isLoading ? skeletons(8) : allItems.length === 0 ? (
                emptyState(<Compass className="w-12 h-12 mx-auto text-white/15 mb-5" />, 'Nothing matches your search. Try different keywords or clear the filters.')
              ) : (
                <motion.div layout className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
                  {allItems.map((item, i) => (
                    <motion.div key={item.id} layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3), duration: 0.35 }}>
                      {item.type === 'listing' && <ListingCard listing={item.data} index={i} />}
                      {item.type === 'shop' && <ShopCard shop={item.data} index={i} />}
                      {item.type === 'creator' && <CreatorCard user={item.data} index={i} variant="full" />}
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </motion.div>
          )}

          {/* ═══ LISTINGS TAB ═══ */}
          {tab === 'listings' && (
            <motion.div key="listings" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}>
              {loading ? skeletons(8) : listings.length === 0 ? (
                emptyState(<ShoppingBag className="w-12 h-12 mx-auto text-white/15 mb-5" />, 'No listings match your search.')
              ) : (
                <motion.div layout className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
                  <AnimatePresence mode="popLayout">
                    {listings.map((l, i) => (
                      <motion.div key={l.id} layout exit={{ opacity: 0, scale: 0.94 }}>
                        <ListingCard listing={l} index={i} />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* ═══ SHOPS TAB ═══ */}
          {tab === 'shops' && (
            <motion.div key="shops" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}>
              {shopsLoading ? skeletons(6, 'h-80') : shops.length === 0 ? (
                emptyState(<Store className="w-12 h-12 mx-auto text-white/15 mb-5" />, 'No shops match your search.')
              ) : (
                <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                  <AnimatePresence mode="popLayout">
                    {shops.map((shop, i) => (
                      <motion.div key={shop.id} layout exit={{ opacity: 0, scale: 0.94 }}>
                        <ShopCard shop={shop} index={i} />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* ═══ CREATORS TAB ═══ */}
          {tab === 'creators' && (
            <motion.div key="creators" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}>
              {loading ? skeletons(10, 'h-64') : people.length === 0 ? (
                emptyState(<Users className="w-12 h-12 mx-auto text-white/15 mb-5" />, 'No creators match your search.')
              ) : (
                <motion.div layout className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-5">
                  <AnimatePresence mode="popLayout">
                    {people.map((u, i) => (
                      <motion.div key={u.id} layout exit={{ opacity: 0, scale: 0.94 }}>
                        <CreatorCard user={u} index={i} variant="full" />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </motion.div>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </section>
    </div>
  );
}
