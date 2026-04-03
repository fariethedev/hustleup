import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { listingsApi } from '../api/client';
import { LISTING_TYPES } from '../utils/constants';
import ListingCard from '../components/ListingCard';
import { Search, SearchX, ChevronLeft, ChevronRight } from 'lucide-react';

export default function Explore() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [scrolled, setScrolled] = useState(false);
  const itemsPerPage = 9;

  const activeType = searchParams.get('type') || '';
  const activeCity = searchParams.get('city') || '';
  const negotiable = searchParams.get('negotiable') === 'true';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = {};
    if (activeType) params.type = activeType;
    if (activeCity) params.city = activeCity;
    if (negotiable) params.negotiable = true;

    listingsApi.browse(params)
      .then((r) => {
        setListings(r.data);
        setCurrentPage(1); // Reset to first page on filter change
      })
      .catch(() => setListings([]))
      .finally(() => setLoading(false));
  }, [activeType, activeCity, negotiable]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setLoading(true);
    listingsApi.search(searchQuery)
      .then((r) => {
        setListings(r.data);
        setCurrentPage(1);
      })
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

  // Pagination logic
  const totalPages = Math.ceil(listings.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = listings.slice(indexOfFirstItem, indexOfLastItem);

  return (
    <div className="min-h-screen pt-10">
      <div className="pt-8 pb-6 px-4 max-w-7xl mx-auto">
        <span className="inline-block px-3 py-1 text-[10px] font-black uppercase tracking-widest bg-[#CDFF00]/10 text-[#CDFF00] border border-[#CDFF00]/20 rounded-full mb-3">DISCOVER LIMITLESS POSSIBILITIES</span>
        <h1 className="text-4xl font-black text-white uppercase tracking-tight">Hustle <span className="text-[#CDFF00]">Scout</span></h1>
        <p className="text-gray-500 text-sm mt-1">Uncover trending opportunities and elite creators. The frontier of modern collaboration begins here.</p>
      </div>

      {/* Simplified Search */}
      <div className="max-w-3xl mx-auto px-4 mb-20">
        <form onSubmit={handleSearch} className="relative group">
          <input
            type="text"
            placeholder="Search for anything..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-20 py-6 rounded-full glass bg-white/5 border border-white/10 text-white text-lg placeholder-gray-500 focus:border-[#CDFF00] focus:ring-1 focus:ring-[#CDFF00] outline-none transition-all font-medium shadow-2xl"
          />
          <button
            type="submit"
            className="absolute right-3 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-[#CDFF00] text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg shadow-[#CDFF00]/20"
          >
            <Search className="w-6 h-6 stroke-[3px]" />
          </button>
        </form>
      </div>

      {/* Horizontal Filter Bar — shrinks on scroll, stays in flow (no overlap) */}
      <div className={`bg-[#CDFF00] border-y border-black/5 transition-all duration-300 ${scrolled ? 'py-2' : 'py-6'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`flex flex-wrap items-center justify-center gap-2 transition-all duration-300 ${scrolled ? 'gap-1.5' : 'gap-3'}`}>
            <button
              onClick={() => setFilter('type', '')}
              className={`px-5 rounded-full font-black tracking-widest transition-all ${scrolled ? 'py-1 text-[10px]' : 'py-2.5 text-xs'} ${!activeType ? 'bg-black text-[#CDFF00] shadow-xl shadow-black/20 scale-105' : 'text-black/60 hover:text-black hover:bg-black/5'}`}
            >
              ALL CATEGORIES
            </button>
            {LISTING_TYPES.map((type) => {
              const Icon = type.icon;
              const isActive = activeType === type.value;
              return (
                <button
                  key={type.value}
                  onClick={() => setFilter('type', type.value)}
                  className={`flex items-center gap-1.5 px-5 rounded-full font-black tracking-widest transition-all ${scrolled ? 'py-1 text-[10px]' : 'py-2.5 text-xs'} ${
                    isActive ? 'bg-black text-[#CDFF00] shadow-xl shadow-black/20 scale-105' : 'text-black/60 hover:text-black hover:bg-black/5'
                  }`}
                >
                  <Icon className={`transition-all ${scrolled ? 'w-3 h-3' : 'w-3.5 h-3.5'}`} />
                  {type.label.toUpperCase()}
                </button>
              );
            })}
            
            <div className={`w-[1px] bg-black/10 mx-1 transition-all ${scrolled ? 'h-4' : 'h-6'}`} />
            
            <button
              onClick={() => setFilter('negotiable', negotiable ? '' : 'true')}
              className={`px-5 rounded-full font-black tracking-widest transition-all ${scrolled ? 'py-1 text-[10px]' : 'py-2.5 text-xs'} ${
                negotiable ? 'bg-black text-white shadow-xl shadow-black/20 scale-105' : 'text-black/60 hover:text-black hover:bg-black/5 border border-black/10'
              }`}
            >
              NEGOTIABLE ONLY
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-between mb-12">
          <p className="text-sm font-black text-gray-400 uppercase tracking-[0.3em]">
            {loading ? 'Finding listings...' : `${listings.length} items found`}
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
               <button 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => p - 1)}
                className="p-2 rounded-full hover:bg-white/5 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
               >
                 <ChevronLeft className="w-6 h-6 text-white" />
               </button>
               <span className="text-white font-black text-sm px-4">PAGE {currentPage} OF {totalPages}</span>
               <button 
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => p + 1)}
                className="p-2 rounded-full hover:bg-white/5 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
               >
                 <ChevronRight className="w-6 h-6 text-white" />
               </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[...Array(9)].map((_, i) => (
              <div key={i} className="aspect-[4/5] rounded-[2.5rem] glass bg-black/40 border border-white/10 animate-pulse" />
            ))}
          </div>
        ) : currentItems.length > 0 ? (
          <div className="space-y-12">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentPage + activeType}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
              >
                {currentItems.map((listing, i) => (
                  <ListingCard key={listing.id} listing={listing} index={i} />
                ))}
              </motion.div>
            </AnimatePresence>

            {/* Bottom Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center pt-12">
                <div className="flex items-center gap-4 glass bg-black/40 border border-white/10 px-8 py-4 rounded-full">
                  <button 
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => p - 1)}
                    className="text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <div className="flex items-center gap-4">
                    {[...Array(totalPages)].map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setCurrentPage(i + 1)}
                        className={`w-10 h-10 rounded-full font-black text-sm transition-all ${currentPage === i + 1 ? 'bg-[#CDFF00] text-black scale-110 shadow-lg shadow-[#CDFF00]/20' : 'text-gray-500 hover:text-white'}`}
                      >
                        {i + 1}
                      </button>
                    ))}
                  </div>
                  <button 
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(p => p + 1)}
                    className="text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-32 rounded-[3.5rem] glass bg-black/40 border border-white/10">
            <SearchX className="w-16 h-16 mx-auto text-[#CDFF00] mb-6" />
            <h3 className="text-3xl font-black text-white mb-4 uppercase tracking-wide">No items found</h3>
            <p className="text-gray-400 mb-8 max-w-sm mx-auto font-medium">We couldn't find anything matching your current filters. Try resetting or selecting a different category.</p>
            <button onClick={clearFilters} className="px-10 py-4 rounded-full bg-[#CDFF00] text-black font-black transition-all hover:scale-105 active:scale-95 shadow-lg shadow-[#CDFF00]/20">
              Clear All Filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
