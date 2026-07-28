import { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { listingsApi, usersApi, followsApi } from '../api/client';
import { selectUser } from '../store/authSlice';
import { LISTING_TYPES } from '../utils/constants';
import { SHOPS } from '../utils/shopData';
import ListingCard from '../components/ListingCard';
import ShopCard from '../components/ShopCard';
import {
  Store, ShoppingBag, Calendar, Briefcase,
  Newspaper, MapPin, ChevronLeft, ChevronRight, Sparkles, Flame,
  Compass, LayoutGrid, Users, BadgeCheck, UserPlus, Check
} from 'lucide-react';

/* ── Creator card: avatar + name + Follow / View profile actions ── */
function CreatorCard({ u }) {
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);

  const toggleFollow = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const next = !following;
    setFollowing(next); // optimistic
    try {
      if (next) await followsApi.follow(u.id);
      else await followsApi.unfollow(u.id);
    } catch {
      setFollowing(!next); // roll back on failure
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="snap-start shrink-0 w-[116px] flex flex-col items-center text-center">
      <Link to={`/profile/${u.id}`} className="group">
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden bg-black border border-white/10 flex items-center justify-center group-hover:border-white/25 transition-colors">
          {u.avatarUrl
            ? <img src={u.avatarUrl} alt={u.fullName} className="w-full h-full object-cover" />
            : <span className="text-[#00FFFF] font-black text-xl uppercase">{u.fullName?.[0] || 'U'}</span>}
        </div>
      </Link>
      <Link to={`/profile/${u.id}`} className="mt-2 flex items-center gap-1 text-[11px] font-black text-white leading-tight line-clamp-1 hover:text-[#00FFFF] transition-colors">
        {u.fullName}
        {u.idVerified && <BadgeCheck className="w-3 h-3 text-[#CDFF00] shrink-0" />}
      </Link>
      <span className="text-[8px] font-bold uppercase tracking-wider text-gray-500 mb-2">
        {u.role === 'SELLER' ? 'Seller' : 'Hustler'}
      </span>
      <div className="flex items-center gap-1.5 w-full">
        <button
          onClick={toggleFollow}
          disabled={busy}
          className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wide transition-all disabled:opacity-60 ${
            following
              ? 'bg-white/5 border border-white/10 text-gray-300'
              : 'bg-[#CDFF00] text-black hover:bg-[#d9ff33]'
          }`}
        >
          {following ? <><Check className="w-3 h-3" /> Following</> : <><UserPlus className="w-3 h-3" /> Follow</>}
        </button>
        <Link
          to={`/profile/${u.id}`}
          title="View profile"
          className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:border-white/25 transition-colors"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}

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
            {/* Scroll Buttons — always visible so users know the row scrolls */}
            <button
              onClick={() => scroll(-1)}
              aria-label="Scroll left"
              className="absolute -left-2 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-[#0A0A0A] border transition-all flex items-center justify-center text-white shadow-[0_4px_12px_rgba(0,0,0,0.6)] hover:scale-110 active:scale-95"
              style={{ borderColor: `${accentColor}66` }}
            >
              <ChevronLeft className="w-5 h-5" style={{ color: accentColor }} />
            </button>
            <button
              onClick={() => scroll(1)}
              aria-label="Scroll right"
              className="absolute -right-2 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-[#0A0A0A] border transition-all flex items-center justify-center text-white shadow-[0_4px_12px_rgba(0,0,0,0.6)] hover:scale-110 active:scale-95"
              style={{ borderColor: `${accentColor}66` }}
            >
              <ChevronRight className="w-5 h-5" style={{ color: accentColor }} />
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
  const currentUser = useSelector(selectUser);
  const [searchParams, setSearchParams] = useSearchParams();
  const [allListings, setAllListings] = useState([]);
  const [bestSelling, setBestSelling] = useState([]);
  const [creators, setCreators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bestSellingLoading, setBestSellingLoading] = useState(true);

  const activeType = searchParams.get('type') || '';
  // Section-type filter: '' (everything) | 'listings' | 'shops' | 'users'
  const activeSection = searchParams.get('show') || '';

  useEffect(() => {
    setLoading(true);
    listingsApi.browse({})
      .then((r) => {
        setAllListings(r.data || []);
      })
      .catch(() => setAllListings([]))
      .finally(() => setLoading(false));

    setBestSellingLoading(true);
    listingsApi.browse({ sort: 'best_selling' })
      .then((r) => {
        setBestSelling(r.data || []);
      })
      .catch(() => setBestSelling([]))
      .finally(() => setBestSellingLoading(false));

    // Creators row — needs auth; anonymous visitors just see the other sections.
    usersApi.getAll()
      .then((r) => setCreators((r.data || []).filter((u) => u.id !== currentUser?.id)))
      .catch(() => setCreators([]));
  }, [currentUser?.id]);

  const setFilter = (typeValue) => {
    const params = new URLSearchParams(searchParams);
    if (typeValue) params.set('type', typeValue);
    else params.delete('type');
    setSearchParams(params);
  };

  const setSection = (sectionValue) => {
    const params = new URLSearchParams(searchParams);
    if (sectionValue) params.set('show', sectionValue);
    else params.delete('show');
    setSearchParams(params);
  };

  const showShops = !activeSection || activeSection === 'shops';
  const showListings = !activeSection || activeSection === 'listings';
  const showUsers = !activeSection || activeSection === 'users';

  // Filter listings by active category filter first (if any)
  const filteredListings = activeType 
    ? allListings.filter(l => l.listingType === activeType || l.type === activeType)
    : allListings;

  // Segment current listings for vertical sections
  const featuredListings = filteredListings; // all of them inside active scope
  const events = filteredListings.filter(l => l.listingType === 'EVENT' || l.type === 'EVENT');
  const jobs = filteredListings.filter(l => l.listingType === 'SKILL' || l.type === 'SKILL');
  const filteredBestSelling = activeType
    ? bestSelling.filter(l => l.listingType === activeType || l.type === activeType)
    : bestSelling;

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
    <div className="min-h-screen font-sans pb-16">
      
      {/* ── COMPACT ICON BAR: heading + section filter + category filter ── */}
      <div className="sticky top-14 z-[100] bg-black/85 backdrop-blur-md border-b border-white/5 py-2">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-center gap-1.5">

          {/* Heading as icon */}
          <h1 className="flex items-center gap-1.5 text-sm font-black text-white uppercase tracking-tighter mr-1.5">
            <Compass className="w-4 h-4 text-[#FF00FF]" /> Explore
          </h1>
          <div className="w-px h-5 bg-white/10" />

          {/* Section-type filter: everything / listings / shops / creators */}
          {[
            { value: '', icon: LayoutGrid, label: 'All' },
            { value: 'listings', icon: ShoppingBag, label: 'Listings' },
            { value: 'shops', icon: Store, label: 'Shops' },
            { value: 'users', icon: Users, label: 'Creators' },
          ].map((s) => (
            <button
              key={s.value || 'all'}
              onClick={() => setSection(s.value)}
              title={s.label}
              aria-label={s.label}
              className={`flex items-center justify-center w-8 h-8 rounded-lg border transition-all shrink-0 ${
                activeSection === s.value
                  ? 'bg-[#00FFFF] text-black border-[#00FFFF] shadow-[0_0_10px_rgba(0,255,255,0.4)]'
                  : 'bg-[#0A0A0A] text-white/70 border-white/10 hover:border-[#00FFFF] hover:text-white'
              }`}
            >
              <s.icon className="w-4 h-4" />
            </button>
          ))}

          {/* Listing category filter (icons only) — relevant when listings are visible */}
          {showListings && (
            <>
              <div className="w-px h-5 bg-white/10" />
              <button
                onClick={() => setFilter('')}
                title="All categories"
                aria-label="All categories"
                className={`flex items-center justify-center w-8 h-8 rounded-lg border text-[8px] font-black uppercase transition-all shrink-0 ${
                  !activeType
                    ? 'bg-[#FF00FF] text-white border-[#FF00FF] shadow-[0_0_10px_rgba(255,0,255,0.4)]'
                    : 'bg-[#0A0A0A] text-white/70 border-white/10 hover:border-[#FF00FF]'
                }`}
              >
                ALL
              </button>
              {LISTING_TYPES.map((type) => (
                <button
                  key={type.value}
                  onClick={() => setFilter(type.value)}
                  title={type.label}
                  aria-label={type.label}
                  className={`flex items-center justify-center w-8 h-8 rounded-lg border transition-all shrink-0 ${
                    activeType === type.value
                      ? 'bg-[#FF00FF] text-white border-[#FF00FF] shadow-[0_0_10px_rgba(255,0,255,0.4)]'
                      : 'bg-[#0A0A0A] text-white/70 border-white/10 hover:border-[#FF00FF] hover:text-white'
                  }`}
                >
                  <type.icon className="w-4 h-4" />
                </button>
              ))}
            </>
          )}
        </div>
      </div>

      {/* ── MAIN VERTICAL SCROLL SECTIONS ── */}
      <div className="mt-4 space-y-4">
        
        {/* SECTION 0: CREATORS */}
        {showUsers && creators.length > 0 && (
          <ScrollRow title="Creators" subtitle="People On HustleUp" icon={Users} accentColor="#00FFFF" isEmpty={false}>
            {creators.map((u) => <CreatorCard key={u.id} u={u} />)}
          </ScrollRow>
        )}

        {/* SECTION 1: FEATURED SHOPS */}
        {showShops && (
        <ScrollRow title="Featured Shops" subtitle="Vibrant Hubs" icon={Store} accentColor="#FF00FF" isEmpty={SHOPS.length === 0}>
          {SHOPS.map((shop, i) => (
            <div key={shop.id} className="snap-start shrink-0 w-[280px]">
              <ShopCard shop={shop} index={i} />
            </div>
          ))}
        </ScrollRow>
        )}

        {/* SECTION 1.5: HIGH SELLING */}
        {showListings && (
        <ScrollRow title="High Selling" subtitle="Most Bought On HustleUp" icon={Flame} accentColor="#CDFF00" isEmpty={!bestSellingLoading && filteredBestSelling.length === 0}>
          {bestSellingLoading ? (
            [...Array(4)].map((_, i) => <div key={i} className="shrink-0 w-[240px] aspect-[4/5] bg-white/[0.02] border border-white/10 rounded-2xl animate-pulse" />)
          ) : (
            filteredBestSelling.map((l, i) => (
              <div key={l.id} className="snap-start shrink-0 w-[240px]">
                <ListingCard listing={l} index={i} />
              </div>
            ))
          )}
        </ScrollRow>
        )}

        {/* SECTION 2: FEATURED LISTINGS */}
        {showListings && (
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
        )}

        {/* SECTION 3: FEATURED EVENTS */}
        {showListings && (
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
        )}

        {/* SECTION 4: FEATURED NEWS (only in the unfiltered view) */}
        {!activeSection && (
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
        )}

        {/* SECTION 5: FEATURED JOBS */}
        {showListings && (
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
        )}

      </div>
    </div>
  );
}
