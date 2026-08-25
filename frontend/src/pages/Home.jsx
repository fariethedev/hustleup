import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight, Store, ShoppingBag, MapPin,
  Star, ShieldCheck, Sparkles, HeartHandshake
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectIsAuthenticated } from '../store/authSlice';
import { listingsApi, bookingsApi } from '../api/client';
import { useToast } from '../context/ToastContext';
import { formatPrice, displayCity } from '../utils/constants';
import { useShops } from '../hooks/useShops';
import SmartImage from '../components/SmartImage';

// The hero is a single full-bleed photograph, so one source at full-viewport width.
const heroImage = 'https://images.unsplash.com/photo-1744320911030-1ab998d994d7?auto=format&fit=crop&w=2400&q=80';

const aboutImage = 'https://images.unsplash.com/photo-1565703321618-2571b730ffe1?auto=format&fit=crop&w=1000&q=80';

const features = [
  { title: 'Marketplace', desc: 'Buy and sell products, services and digital goods with fellow students — negotiate prices and pay securely.', to: '/explore', cta: 'Browse listings' },
  { title: 'Student shops', desc: 'Follow your favourite campus shops, from fashion and beauty to food and electronics.', to: '/explore', cta: 'Discover shops' },
  { title: 'Jobs & gigs', desc: 'Find part-time jobs, side gigs and freelance work that fit around your studies.', to: '/jobs', cta: 'Find work' },
  { title: 'Messages', desc: 'Chat directly with buyers and sellers, negotiate deals and keep every conversation in one place.', to: '/dm', cta: 'Start chatting' },
  { title: 'Community feed', desc: 'Share your wins, showcase your work and see what other hustlers are building.', to: '/feed', cta: 'Join the feed' },
  { title: 'Campus news', desc: 'Stay in the loop with news, events and opportunities that matter to students.', to: '/news', cta: 'Read the news' },
];

const steps = [
  { num: '1', title: 'Create your account', desc: 'Sign up free in under a minute as a buyer, a seller — or both.' },
  { num: '2', title: 'Set up or explore', desc: 'Open your shop and list what you offer, or browse listings, shops, jobs and gigs near you.' },
  { num: '3', title: 'Hustle & get paid', desc: 'Chat, negotiate, close deals and grow your reputation with every sale.' },
];

/**
 * The "what you can do" cards, as a horizontally scrolling row.
 *
 * Shows exactly three at a time on desktop and pages through the rest, so the section stays
 * one screen tall instead of a six-card wall. Card widths are computed from the track width
 * minus the gaps, which is what makes the third card land flush with the right edge rather
 * than peeking.
 */
function FeatureCarousel() {
  const trackRef = useRef(null);
  // Arrows hide at the ends rather than sitting there as dead controls.
  const [edges, setEdges] = useState({ start: true, end: false });

  const syncEdges = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    const start = el.scrollLeft <= 8;
    const end = maxScroll <= 8 || el.scrollLeft >= maxScroll - 8;
    // Return the previous object when nothing moved so React can bail out of the re-render.
    setEdges((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
  }, []);

  useEffect(() => {
    syncEdges();
    window.addEventListener('resize', syncEdges);
    return () => window.removeEventListener('resize', syncEdges);
  }, [syncEdges]);

  const page = (direction) => {
    const el = trackRef.current;
    if (!el) return;
    // Scroll by a full visible width so each click advances one clean set of three.
    el.scrollBy({ left: direction * el.clientWidth, behavior: 'smooth' });
  };

  return (
    <div className="relative">
      {!edges.start && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={() => page(-1)}
          aria-label="Previous features"
          className="hidden md:flex absolute -left-5 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-[#0A0A0A] border border-[#CDFF00]/40 items-center justify-center text-[#CDFF00] shadow-[0_4px_16px_rgba(0,0,0,0.7)] hover:bg-[#CDFF00] hover:text-black transition-colors"
        >
          <ArrowRight className="w-5 h-5 rotate-180" />
        </motion.button>
      )}
      {!edges.end && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={() => page(1)}
          aria-label="More features"
          className="hidden md:flex absolute -right-5 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-[#0A0A0A] border border-[#CDFF00]/40 items-center justify-center text-[#CDFF00] shadow-[0_4px_16px_rgba(0,0,0,0.7)] hover:bg-[#CDFF00] hover:text-black transition-colors"
        >
          <ArrowRight className="w-5 h-5" />
        </motion.button>
      )}

      <div
        ref={trackRef}
        onScroll={syncEdges}
        className="flex gap-6 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-2"
      >
        {features.map((feature, i) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.5, delay: (i % 3) * 0.1 }}
            // One card on mobile, two on tablet, three on desktop — each sized off the track
            // width minus the gaps between the visible cards.
            className="snap-start shrink-0 w-full sm:w-[calc((100%-1.5rem)/2)] lg:w-[calc((100%-3rem)/3)]"
          >
            <Link
              to={feature.to}
              className="group flex flex-col items-center text-center h-full p-7 rounded-3xl bg-white/[0.03] border border-white/10 hover:border-[#CDFF00]/40 hover:bg-white/[0.05] transition-all"
            >
              <h3 className="text-white font-heading font-bold text-lg mb-3">{feature.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed mb-5 flex-1">{feature.desc}</p>
              <span className="inline-flex items-center gap-1.5 text-[#CDFF00] text-sm font-bold">
                {feature.cta} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </span>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [listings, setListings] = useState([]);
  const { shops } = useShops();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [requestedIds, setRequestedIds] = useState(new Set());

  useEffect(() => {
    listingsApi.recommended().then(r => {
      setListings(r.data?.slice(0, 8) || []);
    }).catch(() => {}).finally(() => setLoading(false));

    listingsApi.browse({ type: 'EVENT' }).then(r => {
      setEvents(r.data || []);
    }).catch(() => {}).finally(() => setEventsLoading(false));
  }, []);

  const handleRequestJoin = async (event) => {
    if (!isAuthenticated) { navigate('/login'); return; }
    if (requestedIds.has(event.id)) return;
    setRequestedIds((prev) => new Set(prev).add(event.id));
    try {
      await bookingsApi.create({ listingId: event.id, joinRequest: true });
      showToast('Request sent  the organiser will review it', 'success');
    } catch (e) {
      setRequestedIds((prev) => {
        const next = new Set(prev);
        next.delete(event.id);
        return next;
      });
      showToast(e.response?.data?.message || 'Could not send request', 'error');
    }
  };

  useEffect(() => {
    if (location.hash === '#about') {
      document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [location.hash]);

  return (
    <div className="min-h-screen font-sans">

      {/* ── HERO — one full-bleed image, copy laid over it ── */}
      <section className="relative h-[100svh] min-h-[560px] w-full overflow-hidden flex items-end">
        {/* The photograph is the whole hero. 100svh (not 100vh) so mobile browser chrome
            appearing and disappearing doesn't make the section jump height mid-scroll. */}
        <img
          src={heroImage}
          alt="Students gathered together on their campus steps"
          className="absolute inset-0 w-full h-full object-cover object-center"
          fetchPriority="high"
        />

        {/* Three scrims, each with a job: the vertical one fades the photo into the page
            below, the vignette darkens the lower-centre where the copy sits, and the top band
            gives the navbar a dark ground — it renders transparent until scrolled, so without
            it the logo and icons float over open photograph. */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/55 to-[#050505]/25" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_78%,rgba(5,5,5,0.75)_0%,rgba(5,5,5,0.4)_50%,transparent_80%)]" />
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#050505]/90 to-transparent pointer-events-none" />

        <div className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 pb-20 md:pb-24">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="max-w-2xl mx-auto text-center"
          >
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-heading font-black text-white leading-[1.08] tracking-tight mb-5 drop-shadow-[0_4px_24px_rgba(0,0,0,0.6)]">
              <span className="text-[#CDFF00]">Hustle</span> hard. Shop smart. Connect fast.
            </h1>

            <p className="text-gray-200 text-sm sm:text-base leading-relaxed max-w-xl mx-auto mb-8 drop-shadow-[0_2px_12px_rgba(0,0,0,0.7)]">
              The all-in-one platform for students across Poland and beyond to sell what they
              make, find gigs that pay, discover shops and build a community around their
              hustle — all in Złoty.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link
                to={isAuthenticated ? '/dashboard' : '/register'}
                className="px-7 py-3.5 rounded-full bg-[#CDFF00] text-black font-bold text-sm hover:brightness-110 active:scale-95 transition-all shadow-[0_10px_30px_rgba(205,255,0,0.25)] inline-flex items-center gap-2"
              >
                Join the community <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/explore"
                className="px-7 py-3.5 rounded-full border border-white/25 bg-black/30 backdrop-blur-sm text-white font-bold text-sm hover:bg-white/10 hover:border-white/40 transition-all"
              >
                Explore the marketplace
              </Link>
            </div>

            {/* Trust line, carried over from the badge the old collage used to hold */}
            <div className="mt-10 flex items-center justify-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#CDFF00] flex items-center justify-center shrink-0">
                <Star className="w-4 h-4 text-black fill-black" />
              </div>
              <div>
                <p className="text-white text-sm font-bold leading-tight">Trusted by students</p>
                <p className="text-gray-400 text-xs">from Gdańsk to Lublin</p>
              </div>
            </div>
          </motion.div>
        </div>

      </section>

      {/* ── FEATURES ── */}
      <section className="py-16 md:py-24 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <p className="text-[#CDFF00] text-sm font-bold mb-3">What you can do</p>
            <h2 className="text-3xl sm:text-4xl font-heading font-black text-white tracking-tight mb-4">
              Everything you need to hustle in one place
            </h2>
            <p className="text-gray-400 leading-relaxed">
              From selling your first product to landing your next job, HustleSpace brings the
              whole student economy together.
            </p>
          </div>

          <FeatureCarousel />
        </div>
      </section>

      {/* ── POPULAR SHOPS — hidden entirely until sellers have opened storefronts ── */}
      {shops.length > 0 && (
      <section className="py-16 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <p className="text-[#CDFF00] text-sm font-bold mb-3">Community favourites</p>
            <h2 className="text-3xl font-heading font-black text-white tracking-tight">Popular shops right now</h2>
          </div>

          <div className="flex gap-6 sm:gap-8 overflow-x-auto scrollbar-hide pb-2 px-2 snap-x justify-start sm:justify-center"
               style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {shops.slice(0, 8).map((shop, i) => (
              <motion.div
                key={shop.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="snap-start shrink-0"
              >
                <Link to={`/shop/${shop.slug || shop.id}`} className="group flex flex-col items-center w-[104px] text-center">
                  <div
                    className="w-20 h-20 rounded-full p-[3px] transition-transform group-hover:scale-105"
                    style={{ background: `linear-gradient(135deg, ${shop.accentColor || '#CDFF00'}, ${shop.accentColor || '#CDFF00'}4D)` }}
                  >
                    <div className="w-full h-full rounded-full overflow-hidden border-2 border-[#050505] bg-black">
                      <SmartImage src={shop.bannerUrl} alt={shop.name} fallbackIcon={Store} className="w-full h-full object-cover" />
                    </div>
                  </div>
                  <span className="mt-2.5 text-sm font-bold text-white leading-tight line-clamp-1 group-hover:text-[#CDFF00] transition-colors">
                    {shop.name}
                  </span>
                  {shop.category && <span className="text-[11px] text-gray-500 line-clamp-1">{shop.category}</span>}
                  <span className="flex items-center gap-1 text-[11px] text-gray-500 line-clamp-1">
                    <MapPin className="w-2.5 h-2.5 text-[#CDFF00] shrink-0" /> {displayCity(shop.city)}
                  </span>
                  <div className="flex items-center gap-2.5 mt-1 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <ShoppingBag className="w-3 h-3" /> {shop.productCount ?? 0}
                    </span>
                    <span className="flex items-center gap-1">
                      <Star className="w-3 h-3 fill-[#CDFF00] text-[#CDFF00]" /> {shop.rating > 0 ? shop.rating.toFixed(1) : 'New'}
                    </span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
      )}

      {/* ── HAPPENING NOW (Events) ── */}
      {!eventsLoading && events.length > 0 && (
        <section className="py-16 border-t border-white/5">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
              <div>
                <p className="text-[#CDFF00] text-sm font-bold mb-3">Don't miss out</p>
                <h2 className="text-3xl font-heading font-black text-white tracking-tight">Events happening now</h2>
              </div>
              <Link
                to="/explore"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-white/15 text-white text-sm font-bold hover:bg-white/5 hover:border-white/30 transition-all"
              >
                View all <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {events.slice(0, 6).map((event, i) => {
                const requested = requestedIds.has(event.id);
                return (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-40px' }}
                    transition={{ duration: 0.5, delay: (i % 3) * 0.08 }}
                    className="flex flex-col rounded-3xl overflow-hidden border border-white/10 bg-white/[0.03] hover:border-[#CDFF00]/40 transition-all"
                  >
                    <Link to={`/listing/${event.id}`} className="block">
                      <div className="aspect-[16/9] overflow-hidden relative">
                        <img
                          src={event.mediaUrls?.[0] || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&q=60'}
                          alt={event.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          loading="lazy"
                          onError={(e) => { e.target.onerror = null; e.target.src = 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&q=60'; }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                        <span className="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#CDFF00] text-black text-[10px] font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-black animate-pulse" /> LIVE
                        </span>
                      </div>
                    </Link>
                    <div className="p-4 flex flex-col flex-1">
                      <Link to={`/listing/${event.id}`}>
                        <h4 className="text-sm font-bold text-white mb-1 line-clamp-1 hover:text-[#CDFF00] transition-colors">{event.title}</h4>
                      </Link>
                      <p className="text-xs text-gray-500 mb-3 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-[#CDFF00]" /> {displayCity(event.locationCity)}
                      </p>
                      <button
                        onClick={() => handleRequestJoin(event)}
                        disabled={requested}
                        className={`mt-auto w-full py-2.5 rounded-xl text-xs font-bold transition-all ${
                          requested
                            ? 'bg-white/10 text-gray-400 cursor-default'
                            : 'bg-[#CDFF00] text-black hover:brightness-110 active:scale-95'
                        }`}
                      >
                        {requested ? 'Request sent' : 'Request to join'}
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── TRENDING LISTINGS ── */}
      <section className="py-16 md:py-20 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
            <div>
              <p className="text-[#CDFF00] text-sm font-bold mb-3">Fresh on the marketplace</p>
              <h2 className="text-3xl font-heading font-black text-white tracking-tight">Trending listings</h2>
            </div>
            <Link
              to="/explore"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-white/15 text-white text-sm font-bold hover:bg-white/5 hover:border-white/30 transition-all"
            >
              View all <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="aspect-[3/4] rounded-3xl bg-white/5 border border-white/10 animate-pulse" />
              ))}
            </div>
          ) : listings.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
              {listings.slice(0, 8).map((listing, i) => (
                <motion.div
                  key={listing.id}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ duration: 0.5, delay: (i % 4) * 0.08 }}
                >
                  <Link
                    to={`/listing/${listing.id}`}
                    className="group block rounded-3xl overflow-hidden border border-white/10 bg-white/[0.03] hover:border-[#CDFF00]/40 transition-all"
                  >
                    <div className="aspect-[3/4] overflow-hidden relative">
                      <img
                        src={listing.mediaUrls?.[0] || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&q=60'}
                        alt={listing.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                        onError={(e) => { e.target.onerror = null; e.target.src = 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&q=60'; }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                      {listing.negotiable && (
                        <span className="absolute top-3 left-3 px-3 py-1 rounded-full bg-[#CDFF00] text-black text-[10px] font-bold">Negotiable</span>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 p-4">
                        <h4 className="text-sm font-bold text-white truncate mb-1">{listing.title}</h4>
                        <div className="flex items-center justify-between">
                          <span className="text-[#CDFF00] font-bold text-sm">{formatPrice(listing.price, listing.currency)}</span>
                          <span className="text-gray-400 text-[10px] font-semibold uppercase tracking-wide">{listing.listingType}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 rounded-3xl bg-white/[0.02] border border-dashed border-white/10">
              <Store className="w-12 h-12 mx-auto text-gray-600 mb-4" />
              <p className="text-white font-bold mb-2">No listings yet</p>
              <p className="text-gray-500 text-sm mb-6">Be the first to put something on the marketplace.</p>
              <Link to="/create" className="inline-block px-6 py-3 rounded-full bg-[#CDFF00] text-black text-sm font-bold hover:brightness-110 transition-all">
                Create a listing
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="py-16 md:py-24 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <p className="text-[#CDFF00] text-sm font-bold mb-3">How it works</p>
            <h2 className="text-3xl sm:text-4xl font-heading font-black text-white tracking-tight">
              Start hustling in three steps
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {steps.map((step, i) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.5, delay: i * 0.12 }}
                className="relative p-7 rounded-3xl bg-white/[0.03] border border-white/10"
              >
                <div className="w-12 h-12 rounded-2xl bg-[#CDFF00] text-black font-heading font-black text-xl flex items-center justify-center mb-5">
                  {step.num}
                </div>
                <h3 className="text-white font-heading font-bold text-lg mb-2">{step.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ABOUT ── */}
      <section id="about" className="py-16 md:py-24 border-t border-white/5 scroll-mt-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6 }}
            className="relative order-2 lg:order-1"
          >
            <div className="rounded-3xl overflow-hidden border border-white/10">
              <img
                src={aboutImage}
                alt="Main Square in Kraków, Poland"
                className="w-full aspect-[4/3] object-cover"
                loading="lazy"
              />
            </div>
            <div className="absolute -bottom-5 -right-3 sm:right-6 px-6 py-4 rounded-2xl bg-[#CDFF00] shadow-2xl">
              <p className="text-black font-heading font-black text-2xl leading-none">By students,</p>
              <p className="text-black/70 font-bold text-sm mt-1">for students.</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6 }}
            className="order-1 lg:order-2"
          >
            <p className="text-[#CDFF00] text-sm font-bold mb-3">About HustleSpace</p>
            <h2 className="text-3xl sm:text-4xl font-heading font-black text-white tracking-tight mb-6">
              We believe every student has a hustle worth backing
            </h2>
            <p className="text-gray-400 leading-relaxed mb-5">
              HustleSpace started with a simple idea: Polish students are already selling, freelancing
              and side-hustling — they just need one trusted place to do it. We built a platform
              where you can open a shop, land gigs, trade with people you trust and grow a real
              income without leaving campus life behind.
            </p>
            <p className="text-gray-400 leading-relaxed mb-8">
              Today, students from Warsaw to Kraków use HustleSpace to turn skills into businesses,
              connect with buyers and support each other's grind — all priced in Złoty.
            </p>

            <div className="space-y-4">
              {[
                { icon: HeartHandshake, title: 'Community first', desc: 'Every feature is built to help students support students.' },
                { icon: ShieldCheck, title: 'Safe & secure', desc: 'Verified profiles, secure checkout and in-app messaging keep your deals protected.' },
                { icon: Sparkles, title: 'Made for your grind', desc: 'Flexible selling, negotiable pricing and gigs that fit around your timetable.' },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[#CDFF00]/10 border border-[#CDFF00]/20 flex items-center justify-center shrink-0">
                    <item.icon className="w-5 h-5 text-[#CDFF00]" />
                  </div>
                  <div>
                    <p className="text-white font-bold text-sm">{item.title}</p>
                    <p className="text-gray-400 text-sm leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-16 md:py-24 border-t border-white/5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="rounded-[2.5rem] bg-[#CDFF00] p-10 sm:p-16 text-center relative overflow-hidden"
          >
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/30 rounded-full blur-3xl pointer-events-none" />
            <h2 className="text-3xl sm:text-5xl font-heading font-black text-black tracking-tight mb-4 relative">
              Ready to start your hustle?
            </h2>
            <p className="text-black/70 text-base sm:text-lg font-medium mb-9 max-w-xl mx-auto relative">
              Join students across Poland already buying, selling and building on HustleSpace. It's free.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 relative">
              <Link
                to={isAuthenticated ? '/create' : '/register'}
                className="px-8 py-4 rounded-full bg-black text-white font-bold text-sm hover:scale-105 active:scale-95 transition-transform inline-flex items-center gap-2"
              >
                Create your account <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/explore"
                className="px-8 py-4 rounded-full border-2 border-black/20 text-black font-bold text-sm hover:bg-black/5 transition-colors"
              >
                Browse the marketplace
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
