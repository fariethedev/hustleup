import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight, Store, ShoppingBag, MapPin, Ticket,
  Star, ShieldCheck, Sparkles, HeartHandshake
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectIsAuthenticated } from '../store/authSlice';
import { listingsApi } from '../api/client';
import { formatPrice, displayCity } from '../utils/constants';
import { useShops } from '../hooks/useShops';
import SmartImage from '../components/SmartImage';
import { uploadUrl } from '../config';

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

/** Day and month only — a flyer badge has room for "14 Mar", not a full timestamp. */
const formatEventDate = (iso) => {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

/**
 * Whether an event is actually on right now.
 *
 * Listings carry a start time but no end, so "still running" has to be estimated: an event
 * counts as live from its start until six hours later, which covers an ordinary night out
 * without leaving last week's party pulsing away on the home page. An event with no start
 * time recorded is never live — the honest answer to "when is this?" is silence, not a badge
 * asserting it is happening this moment.
 */
const LIVE_WINDOW_MS = 6 * 60 * 60 * 1000;
const isHappeningNow = (iso) => {
  if (!iso) return false;
  const start = new Date(iso).getTime();
  if (Number.isNaN(start)) return false;
  const now = Date.now();
  return start <= now && now - start < LIVE_WINDOW_MS;
};

/**
 * Shared behaviour for the horizontal card rows on this page.
 *
 * Pages by a full visible width so each click advances one clean set rather than a fraction of
 * a card, and tracks whether either end has been reached so the arrows can hide instead of
 * sitting there as dead controls.
 */
function useCarousel() {
  const trackRef = useRef(null);
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
    el.scrollBy({ left: direction * el.clientWidth, behavior: 'smooth' });
  };

  return { trackRef, edges, page, syncEdges };
}

/** Paging arrows for a carousel. Desktop only — on touch you swipe the track itself. */
function CarouselArrows({ edges, page, label }) {
  return (
    <>
      {!edges.start && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={() => page(-1)}
          aria-label={`Previous ${label}`}
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
          aria-label={`More ${label}`}
          className="hidden md:flex absolute -right-5 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-[#0A0A0A] border border-[#CDFF00]/40 items-center justify-center text-[#CDFF00] shadow-[0_4px_16px_rgba(0,0,0,0.7)] hover:bg-[#CDFF00] hover:text-black transition-colors"
        >
          <ArrowRight className="w-5 h-5" />
        </motion.button>
      )}
    </>
  );
}

/**
 * The "what you can do" cards, as a horizontally scrolling row.
 *
 * Shows exactly three at a time on desktop and pages through the rest, so the section stays
 * one screen tall instead of a six-card wall. Card widths are computed from the track width
 * minus the gaps, which is what makes the third card land flush with the right edge rather
 * than peeking.
 */
function FeatureCarousel() {
  const { trackRef, edges, page, syncEdges } = useCarousel();

  return (
    <div className="relative">
      <CarouselArrows edges={edges} page={page} label="features" />

      <div
        ref={trackRef}
        onScroll={syncEdges}
        className="flex gap-6 overflow-x-auto overscroll-x-contain scrollbar-hide snap-x snap-mandatory pb-2"
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

/**
 * Events as a row of flyers.
 *
 * The card is 4/5 rather than the 16/9 the rest of the marketplace uses: posters are drawn
 * portrait, and letterboxing one crops away the half that carries the line-up and the date —
 * the part that actually sells the night. The card leads to the listing, where the quantity
 * picker and the QR ticket live.
 */
function EventCarousel({ events }) {
  const { trackRef, edges, page, syncEdges } = useCarousel();

  return (
    <div className="relative">
      <CarouselArrows edges={edges} page={page} label="events" />

      <div
        ref={trackRef}
        onScroll={syncEdges}
        className="flex gap-3 sm:gap-5 overflow-x-auto overscroll-x-contain scrollbar-hide snap-x snap-mandatory pb-2"
      >
        {events.map((event, i) => {
          const startsOn = formatEventDate(event.eventStartsAt);
          const isLive = isHappeningNow(event.eventStartsAt);
          return (
            <motion.div
              key={event.id}
              // animate, not whileInView. In a horizontally scrolling track, viewport-triggered
              // reveals leave every card past the right edge sitting at opacity 0 — swiping the
              // row showed blank space where the next flyer should be. Only the first few are
              // staggered, so the entrance still reads as one row arriving rather than a
              // cascade that outlasts the scroll.
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: Math.min(i, 3) * 0.06 }}
              // Two-up on mobile, matching the carousels on Explore and News — sized off the
              // track minus the single gap so the second card lands flush with the edge.
              className="snap-start shrink-0 w-[calc((100%-0.75rem)/2)] sm:w-[calc((100%-1.25rem)/2)] lg:w-[calc((100%-2.5rem)/3)]"
            >
              <div className="group flex flex-col h-full rounded-3xl overflow-hidden border border-white/10 bg-white/[0.03] hover:border-[#CDFF00]/40 transition-all">
                <Link to={`/listing/${event.id}`} className="block">
                  <div className="aspect-square sm:aspect-[4/5] overflow-hidden relative">
                    <img
                      src={uploadUrl(event.mediaUrls?.[0] || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=600&q=60')}
                      alt={event.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                      onError={(e) => { e.target.onerror = null; e.target.src = 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=600&q=60'; }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    {/* One badge, and only when it says something true. Every card used to be
                        stamped LIVE — including events months away and events with no start
                        time recorded — and a badge that is always on carries no information. */}
                    {isLive ? (
                      <span className="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#CDFF00] text-black text-[10px] font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-black animate-pulse" /> LIVE
                      </span>
                    ) : startsOn ? (
                      <span className="absolute top-3 left-3 px-3 py-1 rounded-full bg-black/70 backdrop-blur-sm text-white text-[10px] font-bold">
                        {startsOn}
                      </span>
                    ) : null}
                  </div>
                </Link>

                <div className="p-4 flex flex-col flex-1">
                  <Link to={`/listing/${event.id}`}>
                    <h4 className="text-sm font-bold text-white mb-1.5 line-clamp-1 hover:text-[#CDFF00] transition-colors">{event.title}</h4>
                  </Link>
                  {event.description && (
                    <p className="text-xs text-gray-400 leading-relaxed line-clamp-2 mb-2.5">{event.description}</p>
                  )}
                  <p className="text-xs text-gray-500 mb-3 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-[#CDFF00] shrink-0" />
                    <span className="truncate">{event.eventVenue || displayCity(event.locationCity)}</span>
                  </p>
                  <Link
                    to={`/listing/${event.id}`}
                    className="mt-auto w-full py-2.5 rounded-xl bg-[#CDFF00] text-black text-xs font-bold hover:brightness-110 active:scale-95 transition-all inline-flex items-center justify-center gap-1.5"
                  >
                    <Ticket className="w-3.5 h-3.5" /> Get tickets
                  </Link>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

export default function Home() {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const location = useLocation();
  const [listings, setListings] = useState([]);
  const { shops } = useShops();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(true);

  useEffect(() => {
    listingsApi.recommended().then(r => {
      setListings(r.data?.slice(0, 8) || []);
    }).catch(() => {}).finally(() => setLoading(false));

    listingsApi.browse({ type: 'EVENT' }).then(r => {
      setEvents(r.data || []);
    }).catch(() => {}).finally(() => setEventsLoading(false));
  }, []);

  useEffect(() => {
    if (location.hash === '#about') {
      document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [location.hash]);

  return (
    <div className="min-h-screen font-sans">

      {/* ── HERO ──
          Two layouts in one section. On mobile the photograph gets a block of its own at the
          top, uninterrupted, and the copy sits beneath it on the page background. From md up
          it returns to the full-bleed frame with the copy laid over the lower third. */}
      <section className="relative w-full overflow-hidden md:h-[100svh] md:min-h-[560px] md:flex md:items-end">
        {/* 100svh (not 100vh) so mobile browser chrome appearing and disappearing doesn't make
            the section jump height mid-scroll. */}
        <div className="relative h-[54svh] min-h-[300px] w-full md:absolute md:inset-0 md:h-full">
          <img
            src={heroImage}
            alt="Students gathered together on their campus steps"
            className="w-full h-full object-cover object-center"
            fetchPriority="high"
          />

          {/* Three scrims, each with a job. The bottom fade blends the photo into what follows
              — on mobile it stays low so the picture reads on its own, on desktop it carries
              up the frame to keep the overlaid copy legible. The vignette darkens the
              lower-centre behind that copy, so it is desktop-only. The top band gives the
              navbar a dark ground: it renders transparent until scrolled, and without it the
              logo and icons float over open photograph. */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent md:via-[#050505]/55 md:to-[#050505]/25" />
          <div className="hidden md:block absolute inset-0 bg-[radial-gradient(ellipse_at_50%_78%,rgba(5,5,5,0.75)_0%,rgba(5,5,5,0.4)_50%,transparent_80%)]" />
          <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#050505]/90 to-transparent pointer-events-none" />
        </div>

        <div className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 pt-8 md:pt-0 pb-14 md:pb-24">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="max-w-2xl mx-auto text-center"
          >
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-heading font-black text-white leading-[1.08] tracking-tight mb-7 drop-shadow-[0_4px_24px_rgba(0,0,0,0.6)]">
              The <span className="text-[#CDFF00]">space</span> to shop, connect and{' '}
              <span className="text-[#CDFF00]">hustle</span>.
            </h1>

            <div className="flex flex-wrap items-center justify-center gap-4">
              {/* Desktop offers both routes. Mobile leads with browsing alone: a signed-out
                  visitor meets the sign-up wall the moment they act on anything they find,
                  so putting the choice up front only adds a decision before the value. */}
              <Link
                to={isAuthenticated ? '/dashboard' : '/register'}
                className="hidden md:inline-flex px-7 py-3.5 rounded-full bg-[#CDFF00] text-black font-bold text-sm hover:brightness-110 active:scale-95 transition-all shadow-[0_10px_30px_rgba(205,255,0,0.25)] items-center gap-2"
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

          <div className="flex gap-6 sm:gap-8 overflow-x-auto overscroll-x-contain scrollbar-hide pb-2 px-2 snap-x justify-start sm:justify-center"
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

      {/* ── EVENTS ── */}
      {!eventsLoading && events.length > 0 && (
        <section className="py-16 border-t border-white/5">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            {/* No "View all" here — the carousel already scrolls through every upcoming
                event, and the old link only ever pointed at unfiltered /explore rather than
                anything event-specific. */}
            <div className="mb-10">
              <p className="text-[#CDFF00] text-sm font-bold mb-3">Don't miss out</p>
              <h2 className="text-3xl font-heading font-black text-white tracking-tight">Events</h2>
            </div>

            <EventCarousel events={events.slice(0, 9)} />
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
                        src={uploadUrl(listing.mediaUrls?.[0] || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&q=60')}
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
                          <span className="text-gray-400 text-[10px] font-semibold tracking-wide">{listing.listingType}</span>
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
              {/* Nothing left to sign up for once you are signed in. */}
              {!isAuthenticated && (
                <Link
                  to="/register"
                  className="px-8 py-4 rounded-full bg-black text-white font-bold text-sm hover:scale-105 active:scale-95 transition-transform inline-flex items-center gap-2"
                >
                  Create your account <ArrowRight className="w-4 h-4" />
                </Link>
              )}
              <Link
                to="/explore"
                className={`px-8 py-4 rounded-full font-bold text-sm transition-all ${
                  isAuthenticated
                    // Sole remaining action for a signed-in reader, so it takes the primary
                    // treatment rather than sitting on the lime panel as a lone outline.
                    ? 'bg-black text-white hover:scale-105 active:scale-95'
                    : 'border-2 border-black/20 text-black hover:bg-black/5'
                }`}
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
