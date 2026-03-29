import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { listingsApi } from '../api/client';
import { LISTING_TYPES } from '../utils/constants';
import ListingCard from '../components/ListingCard';
import { Search, Filter, X, Check, SearchX } from 'lucide-react';

export default function Explore() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const activeType = searchParams.get('type') || '';
  const activeCity = searchParams.get('city') || '';
  const negotiable = searchParams.get('negotiable') === 'true';

  useEffect(() => {
    setLoading(true);
    const params = {};
    if (activeType) params.type = activeType;
    if (activeCity) params.city = activeCity;
    if (negotiable) params.negotiable = true;

    listingsApi.browse(params)
      .then((r) => setListings(r.data))
      .catch(() => setListings([]))
      .finally(() => setLoading(false));
  }, [activeType, activeCity, negotiable]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setLoading(true);
    listingsApi.search(searchQuery)
      .then((r) => setListings(r.data))
      .catch(() => setListings([]))
      .finally(() => setLoading(false));
  };

  const setFilter = (key, value) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    setSearchParams(params);
  };

  const clearFilters = () => {
    setSearchParams({});
    setSearchQuery('');
  };

  return (
    <div className="min-h-screen pt-10">
      {/* Header */}
      <div className="border-b border-white/5 bg-surface-400/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-3xl sm:text-5xl font-heading font-extrabold text-white mb-2 uppercase tracking-wide">
              Explore <span className="text-[#CDFF00]">Marketplace</span>
            </h1>
            <p className="text-gray-400 text-lg">Discover services, products, and opportunities</p>
          </motion.div>

          {/* Search bar */}
          <form onSubmit={handleSearch} className="mt-8 flex flex-col sm:flex-row gap-3 max-w-2xl">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="text"
                placeholder="Search for anything..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-4 rounded-xl bg-surface-100 border border-white/10 text-white placeholder-gray-500 focus:border-[#CDFF00] focus:ring-1 focus:ring-[#CDFF00] outline-none transition-all font-medium"
              />
            </div>
            <button
              type="submit"
              className="px-8 py-4 rounded-xl bg-[#CDFF00] text-black font-bold uppercase tracking-wider hover:bg-[#E0FF4D] transition-all"
            >
              Search
            </button>
          </form>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col lg:flex-row gap-10">
          {/* Sidebar Filters */}
          <aside className="lg:w-64 shrink-0">
            <div className="glass rounded-2xl p-6 sticky top-28 border border-white/5">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
                  <Filter className="w-4 h-4 text-[#CDFF00]" /> Filters
                </h3>
                {(activeType || activeCity || negotiable) && (
                  <button onClick={clearFilters} className="text-xs text-[#CDFF00] hover:text-white uppercase font-bold tracking-wider">Clear all</button>
                )}
              </div>

              {/* Category filter */}
              <div className="mb-8">
                <label className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-4 block">Categories</label>
                <div className="space-y-1.5">
                  <button
                    onClick={() => setFilter('type', '')}
                    className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${!activeType ? 'bg-[#CDFF00]/10 text-[#CDFF00] border-l-2 border-[#CDFF00]' : 'text-gray-400 hover:text-white hover:bg-white/5 border-l-2 border-transparent'}`}
                  >
                    All Categories
                  </button>
                  {LISTING_TYPES.map((type) => {
                    const Icon = type.icon;
                    const isActive = activeType === type.value;
                    return (
                      <button
                        key={type.value}
                        onClick={() => setFilter('type', type.value)}
                        className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-3 transition-all ${
                          isActive ? 'bg-[#CDFF00]/10 text-[#CDFF00] border-l-2 border-[#CDFF00]' : 'text-gray-400 hover:text-white hover:bg-white/5 border-l-2 border-transparent'
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${isActive ? 'text-[#CDFF00]' : 'text-gray-500'}`} />
                        {type.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Negotiable toggle */}
              <div>
                <label className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-4 block">Pricing</label>
                <button
                  onClick={() => setFilter('negotiable', negotiable ? '' : 'true')}
                  className={`w-full text-left p-4 rounded-xl border transition-all flex items-center gap-3 ${
                    negotiable ? 'bg-[#CDFF00]/10 border-[#CDFF00]/30 text-[#CDFF00]' : 'border-white/5 text-gray-400 hover:border-white/20'
                  }`}
                >
                  <div className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${negotiable ? 'bg-[#CDFF00] border-[#CDFF00]' : 'border-gray-500'}`}>
                    {negotiable && <Check className="w-3.5 h-3.5 text-black" />}
                  </div>
                  <span className="text-sm font-bold tracking-wide">Negotiable Only</span>
                </button>
              </div>
            </div>
          </aside>

          {/* Listings Grid */}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/5">
              <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">
                {loading ? 'Finding listings...' : `${listings.length} result${listings.length !== 1 ? 's' : ''}`}
              </p>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="rounded-2xl glass overflow-hidden animate-pulse border border-white/5">
                    <div className="h-48 bg-surface-50" />
                    <div className="p-4 space-y-3">
                      <div className="h-4 bg-surface-50 rounded w-3/4" />
                      <div className="h-3 bg-surface-50 rounded w-1/2" />
                      <div className="h-6 bg-surface-50 rounded w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : listings.length > 0 ? (
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeType + activeCity + negotiable}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
                >
                  {listings.map((listing, i) => (
                    <ListingCard key={listing.id} listing={listing} index={i} />
                  ))}
                </motion.div>
              </AnimatePresence>
            ) : (
              <div className="text-center py-32 rounded-3xl glass border border-white/5">
                <SearchX className="w-16 h-16 mx-auto text-gray-600 mb-6" />
                <h3 className="text-2xl font-bold text-white mb-2 uppercase tracking-wide">No listings found</h3>
                <p className="text-gray-400 mb-8 max-w-sm mx-auto">We couldn't find anything matching your current filters or search terms.</p>
                <button onClick={clearFilters} className="px-8 py-3 rounded-xl bg-white/10 text-white font-bold hover:bg-white/20 uppercase tracking-wider transition-all">
                  Clear Filters
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
