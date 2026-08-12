import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { listingsApi, usersApi } from '../api/client';
import { SHOPS } from '../utils/shopData';
import { formatPrice } from '../utils/constants';
import { lockBodyScroll } from '../utils/lockBodyScroll';
import { algoliaEnabled, searchListings } from '../utils/algolia';
import { Search, X, ShoppingBag, Store, User, MapPin, SearchX } from 'lucide-react';

const matches = (query, ...fields) =>
  fields.some((f) => typeof f === 'string' && f.toLowerCase().includes(query));

export default function GlobalSearch({ open, onClose }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [listings, setListings] = useState([]);
  const [users, setUsers] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const inputRef = useRef(null);

  // Fetch the searchable data once, the first time the palette opens.
  useEffect(() => {
    if (!open || loaded) return;
    Promise.allSettled([listingsApi.browse({}), usersApi.getAll()]).then(([l, u]) => {
      setListings(l.status === 'fulfilled' ? (l.value.data || []) : []);
      setUsers(u.status === 'fulfilled' ? (u.value.data || []) : []);
      setLoaded(true);
    });
  }, [open, loaded]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    const unlock = lockBodyScroll();
    setTimeout(() => inputRef.current?.focus(), 50);
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { unlock(); window.removeEventListener('keydown', onKey); };
  }, [open, onClose]);

  const q = query.trim().toLowerCase();

  // When Algolia is configured, listing search is delegated to it (typo-tolerant, ranked)
  // instead of the naive substring filter below. Hits are cross-referenced against the
  // already-loaded `listings` array so results carry full display data (image, seller, price)
  // without changing the Algolia record schema. Debounced to avoid a request per keystroke.
  const [algoliaListings, setAlgoliaListings] = useState(null);
  useEffect(() => {
    if (!algoliaEnabled || !q) { setAlgoliaListings(null); return; }
    const timer = setTimeout(async () => {
      const hits = await searchListings(q);
      if (!hits) { setAlgoliaListings(null); return; }
      const byId = new Map(listings.map((l) => [l.id, l]));
      setAlgoliaListings(hits.map((h) => byId.get(h.objectID)).filter(Boolean));
    }, 150);
    return () => clearTimeout(timer);
  }, [q, listings]);

  const results = useMemo(() => {
    if (!q) return { listings: [], shops: [], people: [] };
    return {
      listings: (algoliaListings ?? listings
        .filter((l) => matches(q, l.title, l.description, l.listingType, l.locationCity, l.sellerName)))
        .slice(0, 6),
      shops: SHOPS
        .filter((s) => matches(q, s.name, s.category, s.tagline, s.location)
          || s.products.some((p) => matches(q, p.name, p.category)))
        .slice(0, 4),
      people: users
        .filter((u) => matches(q, u.fullName, u.username, u.city, u.bio, u.role))
        .slice(0, 6),
    };
  }, [q, listings, users, algoliaListings]);

  const total = results.listings.length + results.shops.length + results.people.length;

  const go = (path) => { onClose(); navigate(path); };

  // Enter opens the top result, in display order: listing → shop → person.
  const openTopResult = () => {
    if (results.listings[0]) return go(`/listing/${results.listings[0].id}`);
    if (results.shops[0]) return go(`/shop/${results.shops[0].id}`);
    if (results.people[0]) return go(`/profile/${results.people[0].id}`);
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[500] flex items-start justify-center px-4 pt-[10vh]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -12 }}
            transition={{ duration: 0.15 }}
            className="relative w-full max-w-2xl bg-[#0A0A0A] border border-white/10 rounded-3xl shadow-[0_25px_80px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col max-h-[70vh]"
          >
            {/* Input row */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10 shrink-0">
              <Search className="w-5 h-5 text-[#CDFF00] shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') openTopResult(); }}
                type="text"
                placeholder="Search listings, shops, people…"
                className="flex-1 bg-transparent text-white text-base placeholder-gray-500 outline-none"
              />
              <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10 text-gray-500 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto">
              {!q ? (
                <div className="py-14 text-center">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                    Type to search everything on HustleUp
                  </p>
                  <p className="text-[10px] text-gray-600 mt-2">Listings · Shops · People</p>
                </div>
              ) : total === 0 ? (
                <div className="py-14 text-center">
                  <SearchX className="w-10 h-10 mx-auto text-gray-700 mb-3" />
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">No results for "{query}"</p>
                </div>
              ) : (
                <div className="py-2">
                  {results.listings.length > 0 && (
                    <section>
                      <h3 className="px-5 pt-3 pb-1.5 text-[10px] font-black uppercase tracking-[0.25em] text-[#00FFFF]">Listings</h3>
                      {results.listings.map((l) => (
                        <button key={l.id} onClick={() => go(`/listing/${l.id}`)}
                          className="w-full px-5 py-2.5 flex items-center gap-3 hover:bg-white/5 transition-colors text-left">
                          <div className="w-10 h-10 rounded-xl overflow-hidden bg-gray-800 shrink-0 flex items-center justify-center">
                            {l.mediaUrls?.[0]
                              ? <img src={l.mediaUrls[0]} className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
                              : <ShoppingBag className="w-4 h-4 text-gray-600" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-white truncate">{l.title}</p>
                            <p className="text-xs text-gray-500 truncate">{l.sellerName} · {l.locationCity}</p>
                          </div>
                          <span className="text-sm font-black text-[#CDFF00] shrink-0">{formatPrice(l.price, l.currency)}</span>
                        </button>
                      ))}
                    </section>
                  )}

                  {results.shops.length > 0 && (
                    <section>
                      <h3 className="px-5 pt-3 pb-1.5 text-[10px] font-black uppercase tracking-[0.25em] text-[#FF00FF]">Shops</h3>
                      {results.shops.map((s) => (
                        <button key={s.id} onClick={() => go(`/shop/${s.id}`)}
                          className="w-full px-5 py-2.5 flex items-center gap-3 hover:bg-white/5 transition-colors text-left">
                          <div className="w-10 h-10 rounded-xl overflow-hidden bg-gray-800 shrink-0">
                            <img src={s.image} className="w-full h-full object-cover" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-white truncate">{s.name}</p>
                            <p className="text-xs text-gray-500 truncate">{s.category} · {s.location}</p>
                          </div>
                          <Store className="w-4 h-4 text-gray-600 shrink-0" />
                        </button>
                      ))}
                    </section>
                  )}

                  {results.people.length > 0 && (
                    <section>
                      <h3 className="px-5 pt-3 pb-1.5 text-[10px] font-black uppercase tracking-[0.25em] text-[#CDFF00]">People</h3>
                      {results.people.map((u) => (
                        <button key={u.id} onClick={() => go(`/profile/${u.id}`)}
                          className="w-full px-5 py-2.5 flex items-center gap-3 hover:bg-white/5 transition-colors text-left">
                          <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-800 shrink-0 flex items-center justify-center">
                            {u.avatarUrl
                              ? <img src={u.avatarUrl} className="w-full h-full object-cover" />
                              : <span className="text-[#CDFF00] font-black text-sm">{u.fullName?.[0] || <User className="w-4 h-4" />}</span>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-white truncate">{u.fullName || u.username}</p>
                            <p className="text-xs text-gray-500 truncate flex items-center gap-1">
                              {u.role?.toLowerCase()}{u.city ? <> · <MapPin className="w-3 h-3 inline" /> {u.city}</> : null}
                            </p>
                          </div>
                        </button>
                      ))}
                    </section>
                  )}
                </div>
              )}
            </div>

            {/* Footer hint */}
            <div className="px-5 py-2.5 border-t border-white/10 flex items-center justify-between shrink-0 bg-black/40">
              <span className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">Enter opens top result</span>
              <span className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">Esc to close</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
