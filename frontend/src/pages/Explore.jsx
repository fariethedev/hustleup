import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { listingsApi } from '../api/client';
import { LISTING_TYPES } from '../utils/constants';
import ListingCard from '../components/ListingCard';
import { Search, SearchX, ChevronLeft, ChevronRight, ArrowLeft, Home, Image as ImageIcon } from 'lucide-react';

export default function Explore() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [scrolled, setScrolled] = useState(false);
  const itemsPerPage = 9;

  const activeQ = searchParams.get('q') || '';
  const activeType = searchParams.get('type') || '';
  const activeCity = searchParams.get('city') || '';
  const negotiable = searchParams.get('negotiable') === 'true';

  useEffect(() => {
    if (activeQ !== searchQuery) setSearchQuery(activeQ);
  }, [activeQ]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = {};
    if (activeQ) params.q = activeQ;
    if (activeType) params.type = activeType;
    if (activeCity) params.city = activeCity;
    if (negotiable) params.negotiable = true;

    listingsApi.browse(params)
      .then((r) => {
        setListings(r.data);
        setCurrentPage(1);
      })
      .catch(() => setListings([]))
      .finally(() => setLoading(false));
  }, [activeQ, activeType, activeCity, negotiable]);

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

  const totalPages = Math.ceil(listings.length / itemsPerPage);
  const currentItems = listings.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="min-h-screen pt-12">
      <div className="px-4 max-w-7xl mx-auto pt-6 pb-2">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <span className="text-[9px] font-black uppercase tracking-[0.4em] text-[#CDFF00] mb-2 block opacity-80">Marketplace discovery</span>
            <h1 className="text-5xl md:text-6xl font-black text-white uppercase tracking-tighter leading-none">Hustle <span className="text-[#CDFF00]">Scout</span></h1>
            <p className="text-gray-500 text-sm font-bold uppercase tracking-tight mt-2 opacity-60">The elite frontier of modern collaboration.</p>
          </div>
        </div>
      </div>

      <div className={`bg-[#CDFF00] border-y border-black/5 transition-all duration-300 ${scrolled ? 'py-2' : 'py-6'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`flex flex-wrap items-center justify-center gap-2 transition-all duration-300 ${scrolled ? 'gap-1.5' : 'gap-3'}`}>
            <button onClick={() => setFilter('type', '')} className={`px-5 rounded-full font-black tracking-widest transition-all ${scrolled ? 'py-1 text-[10px]' : 'py-2.5 text-xs'} ${!activeType ? 'bg-black text-[#CDFF00] shadow-xl shadow-black/20 scale-105' : 'text-black/60 hover:text-black hover:bg-black/5'}`}>ALL CATEGORIES</button>
            {LISTING_TYPES.map((type) => (
              <button key={type.value} onClick={() => setFilter('type', type.value)} className={`flex items-center gap-1.5 px-5 rounded-full font-black tracking-widest transition-all ${scrolled ? 'py-1 text-[10px]' : 'py-2.5 text-xs'} ${activeType === type.value ? 'bg-black text-[#CDFF00] shadow-xl shadow-black/20 scale-105' : 'text-black/60 hover:text-black hover:bg-black/5'}`}>
                <type.icon className={`transition-all ${scrolled ? 'w-3 h-3' : 'w-3.5 h-3.5'}`} />
                {type.label.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-between mb-12">
          <p className="text-sm font-black text-gray-400 uppercase tracking-[0.3em]">{loading ? 'Finding listings...' : `${listings.length} items found`}</p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[...Array(9)].map((_, i) => <div key={i} className="aspect-[4/5] rounded-[2.5rem] glass bg-black/40 border border-white/10 animate-pulse" />)}
          </div>
        ) : currentItems.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <AnimatePresence mode="wait">
              {currentItems.map((listing, i) => <ListingCard key={listing.id} listing={listing} index={i} />)}
            </AnimatePresence>
          </div>
        ) : (
          <div className="text-center py-32 rounded-[3.5rem] glass bg-black/40 border border-white/10">
            <SearchX className="w-16 h-16 mx-auto text-[#CDFF00] mb-6" />
            <h3 className="text-3xl font-black text-white mb-4 uppercase tracking-wide">No items found</h3>
            <button onClick={clearFilters} className="px-10 py-4 rounded-full bg-[#CDFF00] text-black font-black">Clear All Filters</button>
          </div>
        )}
      </div>
    </div>
  );
}
