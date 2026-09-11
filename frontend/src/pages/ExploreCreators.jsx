import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { AnimatePresence, motion } from 'framer-motion';
import { usersApi } from '../api/client';
import { selectUser } from '../store/authSlice';
import { POLISH_CITIES } from '../utils/constants';
import CreatorCard from '../components/CreatorCard';
import ExploreNav from '../components/ExploreNav';
import { MapPin, Search, Users, X } from 'lucide-react';

const ROLES = [
  { value: '', label: 'Everyone' },
  { value: 'SELLER', label: 'Sellers' },
  { value: 'BUYER', label: 'Hustlers' },
];

export default function ExploreCreators() {
  const currentUser = useSelector(selectUser);
  const [searchParams, setSearchParams] = useSearchParams();
  const [creators, setCreators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  const city = searchParams.get('city') || '';
  const role = searchParams.get('role') || '';
  const verifiedOnly = searchParams.get('verified') === '1';

  const setParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    setLoading(true);
    usersApi.getAll()
      .then((r) => setCreators((r.data || []).filter((u) => u.id !== currentUser?.id)))
      .catch(() => setCreators([]))
      .finally(() => setLoading(false));
  }, [currentUser?.id]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return creators.filter((u) => {
      if (city && u.city !== city) return false;
      // Anything that isn't an explicit SELLER is browsing/hustling as far as this filter goes.
      if (role === 'SELLER' && u.role !== 'SELLER') return false;
      if (role === 'BUYER' && u.role === 'SELLER') return false;
      if (verifiedOnly && !u.idVerified) return false;
      if (!needle) return true;
      return [u.fullName, u.username, u.city, u.bio]
        .some((f) => String(f || '').toLowerCase().includes(needle));
    });
  }, [creators, query, city, role, verifiedOnly]);

  // Only list cities somebody is actually in.
  const creatorCities = useMemo(
    () => POLISH_CITIES.filter((c) => creators.some((u) => u.city === c)),
    [creators],
  );

  const hasFilters = !!(city || role || query || verifiedOnly);
  const clearAll = () => { setQuery(''); setSearchParams({}, { replace: true }); };

  return (
    <div className="min-h-screen font-sans pb-20">
      <ExploreNav />

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-7 pb-5">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
          <span className="text-[10px] font-black tracking-[0.35em] text-[#CDFF00]">
            {city || 'All of Poland'}
          </span>
          <h1 className="mt-2 text-3xl sm:text-4xl font-black text-white tracking-tighter flex items-center gap-3">
            <Users className="w-7 h-7 text-[#CDFF00]" />
            Creators
          </h1>
          <p className="mt-2 text-sm text-gray-400">
            {loading ? 'Loading…' : `${visible.length} ${visible.length === 1 ? 'person' : 'people'}`}
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
                placeholder="Search people…"
                className="w-full pl-11 pr-4 py-3 rounded-2xl bg-black border border-white/10 text-white text-sm font-medium placeholder:text-gray-600 outline-none focus:border-[#00FFFF] transition-colors"
              />
            </div>

            <div className="relative sm:w-52">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#CDFF00] pointer-events-none" />
              <select
                value={city}
                onChange={(e) => setParam('city', e.target.value)}
                aria-label="Filter creators by city"
                className="w-full appearance-none pl-11 pr-4 py-3 rounded-2xl bg-black border border-white/10 text-white text-sm font-bold outline-none focus:border-[#CDFF00] transition-colors cursor-pointer"
              >
                <option value="">All of Poland</option>
                {creatorCities.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mt-3">
            {ROLES.map((r) => (
              <button
                key={r.value || 'all'}
                onClick={() => setParam('role', r.value)}
                className={`px-3.5 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all active:scale-95 ${
                  role === r.value ? 'bg-[#00FFFF] text-black' : 'bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:border-white/30'
                }`}
              >
                {r.label}
              </button>
            ))}
            <button
              onClick={() => setParam('verified', verifiedOnly ? '' : '1')}
              className={`px-3.5 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all active:scale-95 ${
                verifiedOnly ? 'bg-[#CDFF00] text-black' : 'bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:border-white/30'
              }`}
            >
              Verified only
            </button>
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
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-5">
            {[...Array(10)].map((_, i) => (
              <div
                key={i}
                className="h-64 rounded-3xl bg-white/[0.03] border border-white/5 animate-pulse"
                style={{ animationDelay: `${i * 80}ms` }}
              />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="text-center py-24">
            <Users className="w-12 h-12 mx-auto text-white/15 mb-5" />
            <h2 className="text-xl font-black text-white tracking-tight mb-2">No one here</h2>
            <p className="text-sm text-gray-400 mb-6">
              {creators.length === 0
                ? 'Sign in to see who else is building on HustleSpace.'
                : 'Nothing matches those filters yet.'}
            </p>
            {creators.length > 0 && (
              <button
                onClick={clearAll}
                className="px-6 py-3 rounded-2xl bg-[#CDFF00] text-black text-[10px] font-black tracking-widest hover:bg-[#d9ff33] active:scale-95 transition-all"
              >
                Clear filters
              </button>
            )}
          </motion.div>
        ) : (
          <motion.div layout className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-5">
            <AnimatePresence mode="popLayout">
              {visible.map((u, i) => (
                <motion.div key={u.id} layout exit={{ opacity: 0, scale: 0.94 }}>
                  <CreatorCard user={u} index={i} variant="full" />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </section>
    </div>
  );
}
