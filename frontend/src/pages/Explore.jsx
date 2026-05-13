import { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { listingsApi } from '../api/client';
import { LISTING_TYPES, formatPrice } from '../utils/constants';
import ListingCard from '../components/ListingCard';
import { 
  Search, SearchX, Store, ShoppingBag, Calendar, Briefcase, 
  Newspaper, MapPin, ChevronLeft, ChevronRight, Sparkles
} from 'lucide-react';

/* ── Horizontal Scroll Section Component ── */
function ScrollRow({ title, subtitle, icon: Icon, accentColor, children, isEmpty }) {
  const scrollRef = useRef(null);

  const scroll = (direction) => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: direction * 300, behavior: 'smooth' });
    }
  };

  return (
    <div className="py-6 border-b border-white/5 relative group">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header - Centered */}
        <div className="text-center mb-6">
          <span className="text-[9px] font-black uppercase tracking-[0.3em] mb-1 block" style={{ color: accentColor }}>
            {subtitle}
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tighter flex items-center justify-center gap-2">
            <Icon className="w-5 h-5" style={{ color: accentColor }} />
            {title}
          </h2>
        </div>

        {isEmpty ? (
          <div className="text-center py-10 rounded-2xl bg-white/[0.02] border border-white/5 border-dashed">
            <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">More listings coming soon</p>
          </div>
        ) : (
          <div className="relative">
            {/* Scroll Buttons */}
            <button 
              onClick={() => scroll(-1)} 
              className="absolute left-0 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/80 border border-white/10 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 hover:scale-110"
            >
              ‹
            </button>
            <button 
              onClick={() => scroll(1)} 
              className="absolute right-0 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/80 border border-white/10 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 hover:scale-110"
            >
              ›
            </button>

            {/* Horizontal Scroll Area */}
            <div 
              ref={scrollRef} 
              className="flex gap-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-4 px-2"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {children}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Explore() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [allListings, setAllListings] = useState([]);
  const [loading, setLoading] = useState(true);

  const activeType = searchParams.get('type') || '';

  useEffect(() => {
    setLoading(true);
    listingsApi.browse({})
      .then((r) => {
        setAllListings(r.data || []);
      })
      .catch(() => setAllListings([]))
      .finally(() => setLoading(false));
  }, []);

  const setFilter = (typeValue) => {
    const params = new URLSearchParams(searchParams);
    if (typeValue) params.set('type', typeValue);
    else params.delete('type');
    setSearchParams(params);
  };

  // Filter listings by active category filter first (if any)
  const filteredListings = activeType 
    ? allListings.filter(l => l.listingType === activeType || l.type === activeType)
    : allListings;

  // Segment current listings for vertical sections
  const shops = filteredListings.filter(l => l.listingType === 'GOODS' || l.listingType === 'FASHION' || l.type === 'GOODS' || l.type === 'FASHION');
  const featuredListings = filteredListings; // all of them inside active scope
  const events = filteredListings.filter(l => l.listingType === 'EVENT' || l.type === 'EVENT');
  const jobs = filteredListings.filter(l => l.listingType === 'SKILL' || l.type === 'SKILL');

  const staticNews = [
    { title: 'Afro-Creators Rising Hub', desc: 'Connecting young creators with global venture tools.', date: 'May 2026', accent: '#FF00FF' },
    { title: 'MTN Partner Program Launches', desc: 'MTN Mobile Money direct integration is now active.', date: 'Jun 2026', accent: '#00FFFF' },
    { title: 'Nairobi Fashion Showcase', desc: 'Local fashion creators dominate top sales charts this week.', date: 'May 2026', accent: '#CDFF00' },
  ];

  const staticEvents = [
    { id: 'se-1', title: 'Afro Future Fest', price: 0, locationCity: 'Accra, GH', type: 'EVENT', tag: 'FESTIVAL' },
    { id: 'se-2', title: 'Creative Mixer NG', price: 0, locationCity: 'Lagos, NG', type: 'EVENT', tag: 'NETWORK' },
    { id: 'se-3', title: 'Tech Start Tour', price: 0, locationCity: 'Nairobi, KE', type: 'EVENT', tag: 'INNOVATE' },
  ];

  return (
    <div className="min-h-screen bg-[#050505] font-sans pb-16">
      
      {/* ── HEADER (Smaller margins, centered) ── */}
      <div className="relative overflow-hidden bg-[#0A0A0A] pt-20 pb-6 border-b border-white/5">
        <div className="absolute inset-0 z-0 flex opacity-[0.1] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 10px 10px, #FF00FF 2px, transparent 0), radial-gradient(circle at 30px 30px, #00FFFF 2px, transparent 0)', backgroundSize: '40px 40px' }}></div>
        <div className="absolute inset-0 bg-gradient-to-b from-[#FF00FF]/5 via-transparent to-[#0A0A0A] z-0" />
        
        <div className="px-4 max-w-7xl mx-auto relative z-10 text-center">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <span className="text-[9px] font-black uppercase tracking-[0.4em] text-[#FF00FF] mb-1 block drop-shadow-[0_0_5px_#FF00FF]">Creator Directory</span>
            <h1 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tighter drop-shadow-[2px_2px_0_#00FFFF]">Explore <span className="text-[#FF00FF]">Vibes</span></h1>
            <p className="text-[#00FFFF] text-xs font-bold uppercase tracking-widest mt-2">Discover the creative frontier.</p>
          </motion.div>
        </div>
      </div>

      {/* ── FILTER BAR (Categories in a single line, smaller) ── */}
      <div className="sticky top-14 z-[100] bg-black/90 backdrop-blur-md border-b border-white/5 py-3">
        <div className="max-w-7xl mx-auto px-4 flex justify-center">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-1 px-4 max-w-full">
            <button 
              onClick={() => setFilter('')} 
              className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all shrink-0 ${!activeType ? 'bg-[#FF00FF] text-white border-[#FF00FF] shadow-[0_0_10px_#FF00FF]' : 'bg-[#0A0A0A] text-white/70 border-white/10 hover:border-[#00FFFF]'}`}
            >
              ALL
            </button>
            {LISTING_TYPES.map((type) => (
              <button 
                key={type.value} 
                onClick={() => setFilter(type.value)} 
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all shrink-0 ${activeType === type.value ? 'bg-[#FF00FF] text-white border-[#FF00FF] shadow-[0_0_10px_#FF00FF]' : 'bg-[#0A0A0A] text-white/70 border-white/10 hover:border-[#00FFFF]'}`}
              >
                <type.icon className="w-3 h-3" />
                {type.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── MAIN VERTICAL SCROLL SECTIONS ── */}
      <div className="mt-4 space-y-4">
        
        {/* SECTION 1: FEATURED SHOPS */}
        <ScrollRow title="Featured Shops" subtitle="Vibrant Hubs" icon={Store} accentColor="#FF00FF" isEmpty={!loading && shops.length === 0}>
          {loading ? (
            [...Array(4)].map((_, i) => <div key={i} className="shrink-0 w-[240px] aspect-[4/5] bg-white/[0.02] border border-white/10 rounded-2xl animate-pulse" />)
          ) : (
            shops.map((l, i) => (
              <div key={l.id} className="snap-start shrink-0 w-[240px]">
                <ListingCard listing={l} index={i} />
              </div>
            ))
          )}
        </ScrollRow>

        {/* SECTION 2: FEATURED LISTINGS */}
        <ScrollRow title="Featured Listings" subtitle="Hot Off The Press" icon={ShoppingBag} accentColor="#00FFFF" isEmpty={!loading && featuredListings.length === 0}>
          {loading ? (
            [...Array(4)].map((_, i) => <div key={i} className="shrink-0 w-[240px] aspect-[4/5] bg-white/[0.02] border border-white/10 rounded-2xl animate-pulse" />)
          ) : (
            featuredListings.map((l, i) => (
              <div key={l.id} className="snap-start shrink-0 w-[240px]">
                <ListingCard listing={l} index={i} />
              </div>
            ))
          )}
        </ScrollRow>

        {/* SECTION 3: FEATURED EVENTS */}
        <ScrollRow title="Featured Events" subtitle="Gatherings & Meets" icon={Calendar} accentColor="#CDFF00" isEmpty={false}>
          {/* Dynamic Events from database */}
          {events.map((l, i) => (
            <div key={l.id} className="snap-start shrink-0 w-[240px]">
              <ListingCard listing={l} index={i} />
            </div>
          ))}
          {/* Fallback Static Events */}
          {staticEvents.map((e) => (
            <div key={e.id} className="snap-start shrink-0 w-[240px]">
              <div className="rounded-[2rem] border border-white/10 bg-[#0A0A0A] p-5 h-full hover:border-[#CDFF00] transition-all flex flex-col justify-between">
                <div>
                  <span className="inline-block px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-widest bg-[#CDFF00]/10 text-[#CDFF00] border border-[#CDFF00]/20 mb-3">
                    {e.tag}
                  </span>
                  <h4 className="text-sm font-black text-white uppercase tracking-tight mb-2 leading-snug">{e.title}</h4>
                </div>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#00FFFF]" /> {e.locationCity}
                </p>
              </div>
            </div>
          ))}
        </ScrollRow>

        {/* SECTION 4: FEATURED NEWS */}
        <ScrollRow title="Featured News" subtitle="The Culture Signal" icon={Newspaper} accentColor="#FF00FF" isEmpty={false}>
          {staticNews.map((n, i) => (
            <div key={i} className="snap-start shrink-0 w-[260px]">
              <div className="rounded-[2rem] border border-white/10 bg-[#0A0A0A] p-6 h-full flex flex-col justify-between hover:border-[#FF00FF]/50 transition-all">
                <div>
                  <span className="text-[8px] font-black uppercase tracking-widest" style={{ color: n.accent }}>{n.date}</span>
                  <h4 className="text-sm font-black text-white mt-2 mb-3 uppercase tracking-tight leading-snug">{n.title}</h4>
                  <p className="text-[10px] text-gray-400 font-bold leading-relaxed">{n.desc}</p>
                </div>
                <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                  <span className="text-[9px] text-[#00FFFF] font-black uppercase tracking-widest">Signal Active</span>
                  <Sparkles className="w-4 h-4" style={{ color: n.accent }} />
                </div>
              </div>
            </div>
          ))}
        </ScrollRow>

        {/* SECTION 5: FEATURED JOBS */}
        <ScrollRow title="Featured Jobs" subtitle="Hustle Gigs" icon={Briefcase} accentColor="#00FFFF" isEmpty={!loading && jobs.length === 0}>
          {loading ? (
            [...Array(4)].map((_, i) => <div key={i} className="shrink-0 w-[240px] aspect-[4/5] bg-white/[0.02] border border-white/10 rounded-2xl animate-pulse" />)
          ) : (
            jobs.map((l, i) => (
              <div key={l.id} className="snap-start shrink-0 w-[240px]">
                <ListingCard listing={l} index={i} />
              </div>
            ))
          )}
        </ScrollRow>

      </div>
    </div>
  );
}
