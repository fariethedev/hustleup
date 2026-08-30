import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useDispatch, useSelector } from 'react-redux';
import { useShop, useShops } from '../hooks/useShops';
import { listingsApi, followsApi } from '../api/client';
import { formatPrice, convertToPLN, displayCity } from '../utils/constants';
import { addToCart, selectCartItems } from '../store/cartSlice';
import { selectUser, selectIsAuthenticated } from '../store/authSlice';
import { useToast } from '../context/ToastContext';
import { Star, MapPin, ArrowLeft, ShoppingCart, Package, ChevronRight, Share2, Heart, Check, CalendarClock, ShoppingBag, Pencil, ClipboardList } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import SmartImage from '../components/SmartImage';
import ListingCard from '../components/ListingCard';
import ShopReviews from '../components/ShopReviews';
import { uploadUrl } from '../config';

// Shop categories whose products are appointments/sessions rather than physical goods
// (hair & beauty, skills & services) get a "book an appointment" slot picker instead
// of just an add-to-cart button.
const BOOKABLE_CATEGORIES = ['Beauty & Skincare', 'Skills & Services'];

// Builds 6 upcoming mock days of appointment slots for bookable shops.
function buildAvailability() {
  const times = ['09:00', '11:30', '14:00', '16:30'];
  return Array.from({ length: 6 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() + i + 1);
    return {
      key: date.toISOString().slice(0, 10),
      label: `${date.toLocaleDateString('en-GB', { weekday: 'short' })} ${date.getDate()}`,
      times,
    };
  });
}

export default function ShopDetail() {
  const { id } = useParams();
  const { shop, loading } = useShop(id);
  const { shops: allShops } = useShops();
  const currentUser = useSelector(selectUser);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState('All');
  const dispatch = useDispatch();
  const cartItems = useSelector(selectCartItems);
  const [justAdded, setJustAdded] = useState(null);
  const [ownerListings, setOwnerListings] = useState([]);
  const { showToast } = useToast();

  // The owner's marketplace listings, shown below their own catalogue — a storefront is
  // everything this seller offers, not just what they put on the shelf.
  useEffect(() => {
    if (!shop?.ownerId) { setOwnerListings([]); return; }
    listingsApi.browse({})
      .then((r) => setOwnerListings((r.data || []).filter((l) => l.sellerId === shop.ownerId)))
      .catch(() => setOwnerListings([]));
  }, [shop?.ownerId]);

  const isOwner = !!shop && currentUser?.id === shop.ownerId;
  const isBookable = !!shop && BOOKABLE_CATEGORIES.includes(shop.category);
  const availability = useMemo(() => (isBookable ? buildAvailability() : []), [isBookable]);
  const [selectedDay, setSelectedDay] = useState(0);
  const [selectedTime, setSelectedTime] = useState(null);

  const confirmSlot = (time) => {
    setSelectedTime(time);
    showToast(`Slot selected — ${availability[selectedDay].label}, ${time}`, 'success');
  };

  // Following the shop means following its owner — the platform has one social graph, and a
  // separate "saved shops" list would be a second, weaker one that nothing else reads. This
  // way the shop's posts show up in the follower's feed, which is what following it should do.
  const [following, setFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !shop?.ownerId || isOwner) { setFollowing(false); return undefined; }
    let cancelled = false;
    followsApi.relationship(shop.ownerId)
      .then((r) => { if (!cancelled) setFollowing(!!r.data?.isFollowing); })
      .catch(() => { if (!cancelled) setFollowing(false); });
    return () => { cancelled = true; };
  }, [isAuthenticated, shop?.ownerId, isOwner]);

  const toggleFollowShop = async () => {
    if (!isAuthenticated) { navigate('/login'); return; }
    if (!shop?.ownerId) return;
    const next = !following;
    setFollowing(next);          // optimistic — the button should answer the tap immediately
    setFollowBusy(true);
    try {
      await (next ? followsApi.follow(shop.ownerId) : followsApi.unfollow(shop.ownerId));
      showToast(next ? `Following ${shop.name}` : `Unfollowed ${shop.name}`, 'success');
    } catch (e) {
      setFollowing(!next);       // put it back — the server said no
      showToast(e.response?.data?.error || 'Could not update that', 'error');
    } finally {
      setFollowBusy(false);
    }
  };

  // The native share sheet where there is one, which on a phone is the whole point of a share
  // button — it reaches WhatsApp and Instagram, which a copy-link cannot. Desktop browsers
  // mostly lack it, so there the link goes to the clipboard and we say so.
  const shareShop = async () => {
    const url = window.location.href;
    const payload = {
      title: shop?.name || 'HustleSpace shop',
      text: shop?.tagline || `Check out ${shop?.name} on HustleSpace`,
      url,
    };
    try {
      if (navigator.share) {
        await navigator.share(payload);
        return;
      }
      await navigator.clipboard.writeText(url);
      showToast('Link copied', 'success');
    } catch (e) {
      // AbortError is the user dismissing the share sheet — not a failure worth reporting.
      if (e?.name !== 'AbortError') showToast('Could not share that link', 'error');
    }
  };

  const addProductToCart = (e, product) => {
    e.preventDefault();
    e.stopPropagation();
    dispatch(addToCart({
      listingId: `shop:${shop.id}:${product.id}`,
      title: product.name,
      price: convertToPLN(product.price, product.currency),
      currency: 'PLN',
      image: product.imageUrl,
      sellerId: `shop:${shop.id}`,
      sellerName: shop.name,
      // Delivery travels with the line, in PLN like the price, so the cart total is the
      // amount that actually gets charged rather than the goods total alone.
      shippingMethod: product.shippingMethod,
      shippingPrice: convertToPLN(product.shippingPrice || 0, product.currency),
    }));
    setJustAdded(product.id);
    setTimeout(() => setJustAdded((cur) => (cur === product.id ? null : cur)), 1500);
  };

  if (loading) {
    return (
      <div className="min-h-screen">
        <div className="h-[260px] sm:h-[320px] bg-white/[0.03] animate-pulse" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-10 grid grid-cols-1 md:grid-cols-3 gap-8">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-64 rounded-3xl bg-white/[0.03] border border-white/5 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="text-center">
          <Package className="w-16 h-16 mx-auto text-gray-300 mb-6 opacity-20" />
          <h2 className="text-2xl font-black text-white mb-2 uppercase tracking-tight">Shop not found</h2>
          <p className="text-gray-400 mb-6 font-medium">This storefront doesn't exist, or its owner has taken it down.</p>
          <Link to="/explore/shops" className="px-8 py-3.5 rounded-2xl bg-[#CDFF00] text-black font-black uppercase tracking-widest hover:scale-105 transition-all">
            Browse shops
          </Link>
        </div>
      </div>
    );
  }

  const products = shop.products || [];
  const categories = ['All', ...new Set(products.map((p) => p.category).filter(Boolean))];
  const filteredProducts = activeCategory === 'All'
    ? products
    : products.filter((p) => p.category === activeCategory);

  // Cross-sell: a handful of other live storefronts, and one product from each.
  const otherShops = allShops.filter((s) => s.id !== shop.id).slice(0, 4);
  const suggestedProducts = otherShops
    .map((s) => ({ ...(s.products || [])[0], shopId: s.slug || s.id, shopName: s.name, shopAccent: s.accentColor }))
    .filter((p) => p.id);

  return (
    <div className="min-h-screen text-white">
      {/* Immersive Shop Banner & Header */}
      <section className="relative h-[260px] sm:h-[320px] overflow-hidden">
        <motion.div
          initial={{ scale: 1.1 }}
          animate={{ scale: 1 }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
          className="w-full h-full"
        >
          {/* A seller who hasn't uploaded a banner gets their accent colour rather than a
              broken image, so a brand-new shop still looks deliberate. */}
          <SmartImage
            src={uploadUrl(shop.bannerUrl)}
            alt={shop.name}
            fallbackIcon={Package}
            className="w-full h-full object-cover"
            fallbackClassName="opacity-40"
          />
        </motion.div>
        <div
          className="absolute inset-0 opacity-25 pointer-events-none"
          style={{ background: `radial-gradient(circle at 30% 20%, ${shop.accentColor || '#CDFF00'} 0%, transparent 60%)` }}
        />
        
        {/* Dynamic Multi-layered Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#050505] to-transparent" />
        
        {/* Navigation Bar Over Banner */}
        {/* Four labelled pills came to roughly 310px of the ~327px a 375px phone has left
            after the gutters, so the row overflowed its own banner. Below `sm` the two
            labelled controls collapse to their icons and everything becomes the same 40px
            square, which fits with room to spare and reads as one toolbar.

            The icons also carry `w-4 h-4` now: the two buttons asked for `w-4.5`, which is
            not a Tailwind size, so they were rendering at whatever the SVG default was. */}
        <div className="absolute top-16 sm:top-20 left-0 right-0 px-4 sm:px-12 flex items-center justify-between gap-2 z-20">
          <Link
            to="/explore/shops"
            aria-label="All shops"
            className="flex items-center justify-center gap-2 h-10 w-10 sm:w-auto sm:px-5 rounded-2xl bg-black/70 backdrop-blur-md border border-white/15 text-white font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-all active:scale-95 shrink-0"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" /> <span className="hidden sm:inline">All shops</span>
          </Link>
          <div className="flex gap-2 shrink-0">
            {/* The owner gets a direct route to the editor from their own storefront —
                seeing the page is usually what prompts wanting to change it. */}
            {isOwner && (
              <Link
                to="/dashboard"
                aria-label="Edit shop"
                className="flex items-center justify-center gap-2 h-10 w-10 sm:w-auto sm:px-4 rounded-2xl bg-[#CDFF00] text-black font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-transform active:scale-95"
              >
                <Pencil className="w-4 h-4 sm:w-3.5 sm:h-3.5 shrink-0" /> <span className="hidden sm:inline">Edit shop</span>
              </Link>
            )}
            {/* Both of these used to be rendered with an aria-label and no onClick — they
                looked like controls, took the tap, and did nothing whatsoever. */}
            <button
              onClick={shareShop}
              aria-label="Share this shop"
              className="w-10 h-10 rounded-2xl bg-black/70 backdrop-blur-md border border-white/15 flex items-center justify-center hover:scale-110 transition-transform active:scale-95"
            >
              <Share2 className="w-4 h-4" />
            </button>
            {/* Hidden on your own shop: following yourself is not a thing. */}
            {!isOwner && (
              <button
                onClick={toggleFollowShop}
                disabled={followBusy}
                aria-label={following ? 'Unfollow this shop' : 'Follow this shop'}
                aria-pressed={following}
                className={`w-10 h-10 rounded-2xl backdrop-blur-md border flex items-center justify-center hover:scale-110 transition-transform active:scale-95 disabled:opacity-50 ${
                  following
                    ? 'bg-[#FF00FF]/20 border-[#FF00FF]/50 text-[#FF00FF]'
                    : 'bg-black/70 border-white/15 text-white'
                }`}
              >
                <Heart className={`w-4 h-4 ${following ? 'fill-[#FF00FF]' : ''}`} />
              </button>
            )}
          </div>
        </div>

        {/* Shop Info Main Focus */}
        <div className="absolute bottom-4 sm:bottom-6 left-0 right-0 px-4 sm:px-12">
          <div className="max-w-7xl mx-auto flex flex-col items-start gap-1.5 sm:gap-2">
            {shop.category && (
              <motion.span
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="px-3 py-1 sm:px-4 sm:py-1.5 rounded-2xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest bg-black/70 backdrop-blur-md border border-white/20"
                style={{ color: shop.accentColor || '#CDFF00' }}
              >
                {shop.category}
              </motion.span>
            )}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              // Clamped: a long shop name wrapped to three lines at 30px and shoved the
              // meta row out through the bottom of the banner.
              className="text-2xl sm:text-5xl font-black text-white mb-0.5 sm:mb-1 tracking-tighter leading-[1.05] line-clamp-2 drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]"
            >
              {shop.name}
            </motion.h1>
            <motion.div
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               transition={{ delay: 0.3 }}
               // gap-6 between three wrapping items cost two extra rows on a phone.
               className="flex flex-wrap items-center gap-x-3 gap-y-1.5 sm:gap-6 text-gray-300 text-[10px] sm:text-xs font-bold uppercase tracking-widest"
            >
              <span className="flex items-center gap-1.5 sm:gap-2">
                <div className="w-fit px-2 py-1 bg-[#CDFF00] text-black rounded-lg flex items-center gap-1">
                  <Star className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-black" />
                  {shop.rating > 0 ? shop.rating.toFixed(1) : 'New'}
                </div>
                ({shop.reviewCount} <span className="opacity-50">Reviews</span>)
              </span>
              <span className="flex items-center gap-1.5 sm:gap-2">
                <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#CDFF00] shrink-0" /> {displayCity(shop.city)}
              </span>
              {shop.ownerName && (
                <Link to={`/profile/${shop.ownerId}`} className="flex items-center gap-1.5 sm:gap-2 min-w-0 hover:text-white transition-colors">
                  <span className="opacity-50 shrink-0">by</span> <span className="truncate">{shop.ownerName}</span>
                </Link>
              )}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-8 sm:py-10">
        <div className="grid lg:grid-cols-[1fr_320px] gap-6 lg:gap-10 items-start">

          {/* Left Column: Feed & Explore */}
          <div className="order-2 lg:order-1 min-w-0">
            <ShopReviews
              shopId={shop.id}
              ownerId={shop.ownerId}
              ownerName={shop.ownerName}
              rating={shop.rating}
              reviewCount={shop.reviewCount}
            />

            {shop.tagline && (
              <p className="text-lg font-bold text-white leading-snug mb-3">{shop.tagline}</p>
            )}
            {shop.description && (
              <div className="mb-8">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">About this shop</h4>
                <p className="text-sm text-gray-300 leading-relaxed max-w-3xl whitespace-pre-line">
                  {shop.description}
                </p>
              </div>
            )}

            {/* Breadcrumb Navigation */}
            <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-gray-500 mb-6">
              <Link to="/explore/shops" className="hover:text-[#CDFF00] transition-colors">Shops</Link>
              <ChevronRight className="w-3 h-3" />
              <span className="text-[#CDFF00]">{shop.name}</span>
            </div>

            {/* Category filter — only worth showing when the seller uses more than one shelf */}
            {categories.length > 2 && (
              <div className="flex flex-wrap gap-2 mb-6 sm:mb-8 p-2 rounded-3xl bg-white/[0.03] border border-white/5 max-w-full w-fit">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-4 py-2.5 sm:px-6 sm:py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                      activeCategory === cat
                        ? 'bg-[#CDFF00] text-black shadow-[0_0_20px_rgba(205,255,0,0.3)]'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}

            {/* High-Impact Products Grid */}
            <div className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-6 xl:gap-8">
              {filteredProducts.map((product, i) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.5 }}
                  className="h-full"
                >
                  <Link
                    to={`/shop/${shop.slug || shop.id}/product/${product.id}/negotiate`}
                    className="group flex flex-col h-full rounded-2xl sm:rounded-[32px] overflow-hidden bg-black/60 border border-white/10 hover:border-[#CDFF00]/40 transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_20px_60px_rgba(0,0,0,0.8)]"
                  >
                  {/* Product photo */}
                  <div className="h-28 sm:h-36 shrink-0 relative overflow-hidden bg-black/40 border-b border-white/5">
                    <SmartImage
                      src={uploadUrl(product.imageUrl)}
                      alt={product.name}
                      fallbackIcon={ShoppingBag}
                      className="w-full h-full object-cover z-10 group-hover:scale-110 transition-transform duration-700 ease-out"
                      loading="lazy"
                    />
                    {/* Shop-tinted wash so the grid still reads as one storefront */}
                    <div
                      className="absolute inset-0 z-20 opacity-20 group-hover:opacity-10 transition-opacity duration-700 pointer-events-none"
                      style={{ background: `radial-gradient(circle at center, ${shop.accentColor || '#CDFF00'} 0%, transparent 70%)` }}
                    />
                  </div>

                  <div className="p-3 sm:p-5 flex flex-col flex-1 min-w-0">
                    {product.category && (
                      <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
                        <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-[#CDFF00] opacity-40 truncate">{product.category}</span>
                        <div className="h-px bg-white/10 flex-1" />
                      </div>
                    )}
                    <h3 className="text-sm sm:text-lg font-black text-white mb-2 sm:mb-3 leading-tight group-hover:text-[#CDFF00] transition-colors line-clamp-2 uppercase tracking-tighter">
                      {product.name}
                    </h3>
                    <div className="flex items-center justify-between gap-2 mt-auto min-w-0">
                      <div className="flex flex-col min-w-0">
                        {/* The label is the first thing to go at two-up: it is a caption on a
                            number that already looks like a price. */}
                        <span className="hidden sm:block text-[9px] font-black uppercase tracking-widest text-gray-500 mb-0.5">Price Point</span>
                        <span className="text-base sm:text-2xl font-black text-white tracking-tighter truncate">
                          {formatPrice(product.price, product.currency)}
                        </span>
                        {/* Postage named on the tile, not saved for checkout — a shopper
                            comparing two shops is comparing what it costs to get the thing,
                            not what it costs before delivery is added. */}
                        {product.shippingMethod && product.shippingMethod !== 'NONE' && (
                          <span className="text-[9px] font-black uppercase tracking-widest text-gray-500 mt-0.5 truncate">
                            {Number(product.shippingPrice) > 0
                              ? `+ ${formatPrice(product.shippingPrice, product.currency)} delivery`
                              : 'Free delivery'}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={(e) => addProductToCart(e, product)}
                        className={`w-9 h-9 sm:w-11 sm:h-11 shrink-0 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-[0_10px_20px_rgba(205,255,0,0.2)] ${
                          justAdded === product.id || cartItems.some((i) => i.listingId === `shop:${shop.id}:${product.id}`)
                            ? 'bg-white text-black'
                            : 'bg-[#CDFF00] text-black'
                        }`}
                        title="Add to cart"
                      >
                        {justAdded === product.id || cartItems.some((i) => i.listingId === `shop:${shop.id}:${product.id}`) ? (
                          <Check className="w-4 h-4 sm:w-5 sm:h-5" />
                        ) : (
                          <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5" />
                        )}
                      </button>
                    </div>
                  </div>
                  </Link>
                </motion.div>
              ))}
            </div>

            {filteredProducts.length === 0 && (
              <div className="text-center px-4 py-14 sm:py-24 rounded-3xl sm:rounded-[48px] border-dashed border-2 border-white/5">
                <Package className="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-gray-500 mb-5 sm:mb-6 opacity-30" />
                <h3 className="text-lg sm:text-xl font-black text-white mb-2 uppercase tracking-tighter">
                  {products.length === 0 ? 'Nothing on the shelf yet' : 'Nothing in this category'}
                </h3>
                {isOwner && products.length === 0 ? (
                  <Link
                    to="/dashboard"
                    className="inline-block mt-2 px-6 py-2.5 rounded-2xl bg-[#CDFF00] text-black text-[10px] font-black uppercase tracking-widest hover:bg-[#d9ff33] transition-colors"
                  >
                    Add your first product
                  </Link>
                ) : products.length > 0 && (
                  <button
                    onClick={() => setActiveCategory('All')}
                    className="text-xs font-black uppercase tracking-widest text-[#CDFF00] hover:text-white transition-colors"
                  >
                    Show all products
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Right Column: Sidebar. `order-1` on mobile puts the booking widget and the
              message button directly under the hero instead of below every product; sticky
              is desktop-only, where there is actually a second column to stick beside. */}
          <aside className="order-1 lg:order-2 lg:sticky lg:top-32 flex flex-col gap-5 lg:gap-8 w-full min-w-0">
             {isOwner && (
               <div className="p-5 rounded-3xl sm:rounded-[32px] bg-[#CDFF00]/5 border border-[#CDFF00]/30">
                  <h5 className="text-[10px] font-black uppercase tracking-widest text-[#CDFF00] mb-1.5">This is your shop</h5>
                  <p className="text-xs text-gray-400 mb-4 leading-relaxed">
                    Everything on this page — the banner, colour, copy, city and every product —
                    is yours to change.
                  </p>
                  <Link
                    to="/dashboard"
                    className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-[#CDFF00] text-black text-[10px] font-black uppercase tracking-widest hover:bg-[#d9ff33] transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Edit shop
                  </Link>
               </div>
             )}

             {isBookable && (
               <div className="p-5 sm:p-6 rounded-3xl sm:rounded-[32px] bg-white/[0.03] border border-white/10">
                  <h5 className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1 flex items-center gap-2">
                    <CalendarClock className="w-3.5 h-3.5 text-[#CDFF00]" /> Book an appointment
                  </h5>
                  <p className="text-xs text-gray-400 mb-4">Pick a date and time that works for you.</p>

                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {availability.map((day, i) => (
                      <button
                        key={day.key}
                        onClick={() => { setSelectedDay(i); setSelectedTime(null); }}
                        className={`px-2 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wide transition-all ${
                          selectedDay === i ? 'bg-[#CDFF00] text-black' : 'bg-white/5 text-gray-400 hover:bg-white/10'
                        }`}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {availability[selectedDay]?.times.map((time) => (
                      <button
                        key={time}
                        onClick={() => confirmSlot(time)}
                        className={`px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                          selectedTime === time ? 'bg-[#CDFF00] text-black' : 'bg-white/5 text-white hover:bg-white/10'
                        }`}
                      >
                        {time}
                      </button>
                    ))}
                  </div>

                  {selectedTime && (
                    <p className="mt-4 text-[11px] text-[#CDFF00] font-bold text-center">
                      Selected: {availability[selectedDay].label} · {selectedTime}
                    </p>
                  )}
               </div>
             )}

             {!isOwner && (
               <div className="p-5 sm:p-8 rounded-3xl sm:rounded-[32px] bg-white/[0.03] border border-white/5 overflow-hidden relative">
                  <div
                    className="absolute top-0 right-0 w-32 h-32 blur-3xl opacity-20"
                    style={{ background: shop.accentColor || '#CDFF00' }}
                  />
                  <h5 className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-4">Run by</h5>
                  <Link to={`/profile/${shop.ownerId}`} className="flex items-center gap-3 mb-5 group">
                    <div className="w-11 h-11 rounded-full overflow-hidden bg-black border border-white/10 shrink-0">
                      <SmartImage src={shop.ownerAvatarUrl} alt={shop.ownerName} className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white truncate group-hover:text-[#CDFF00] transition-colors">
                        {shop.ownerName || 'Seller'}
                      </p>
                      <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                        {displayCity(shop.city)}
                      </p>
                    </div>
                  </Link>
                  {/* DMs go to the owner's account, which is who actually answers. */}
                  <Link
                    to={`/dm/${shop.ownerId}`}
                    className="block w-full py-4 rounded-2xl bg-white/5 border border-white/10 text-center text-[10px] font-black uppercase tracking-widest text-white hover:bg-white/10 transition-colors"
                  >
                    Message owner
                  </Link>
               </div>
             )}
          </aside>
        </div>

        {/* The owner's marketplace listings — the other half of what this seller offers. */}
        {ownerListings.length > 0 && (
          <div className="mt-10 sm:mt-16">
            <div className="flex items-center gap-2 mb-5">
              <ClipboardList className="w-4 h-4 text-[#00FFFF]" />
              <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                Also from {shop.ownerName || 'this seller'}
              </h4>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5">
              {ownerListings.slice(0, 8).map((l, i) => (
                <ListingCard key={l.id} listing={l} index={i} />
              ))}
            </div>
          </div>
        )}

        {/* Products you may also like */}
        {suggestedProducts.length > 0 && (
          <div className="mt-10 sm:mt-16">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-5">Products you may also like</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-5">
              {suggestedProducts.map((product) => (
                <Link
                  key={`${product.shopId}-${product.id}`}
                  to={`/shop/${product.shopId}/product/${product.id}/negotiate`}
                  className="group flex flex-col h-full rounded-2xl overflow-hidden bg-black/40 border border-white/10 hover:border-[#CDFF00]/40 transition-all duration-300"
                >
                  <div className="h-24 shrink-0 relative overflow-hidden bg-black/40 border-b border-white/5">
                    <SmartImage
                      src={uploadUrl(product.imageUrl)}
                      alt={product.name}
                      fallbackIcon={ShoppingBag}
                      className="w-full h-full object-cover z-10 group-hover:scale-110 transition-transform duration-500"
                      loading="lazy"
                    />
                    <div
                      className="absolute inset-0 z-20 opacity-20 group-hover:opacity-10 transition-opacity duration-500 pointer-events-none"
                      style={{ background: `radial-gradient(circle at center, ${product.shopAccent || '#CDFF00'} 0%, transparent 70%)` }}
                    />
                  </div>
                  <div className="p-3.5 flex flex-col flex-1">
                    <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest truncate mb-1">{product.shopName}</span>
                    <h5 className="text-xs font-bold text-white line-clamp-2 mb-2 group-hover:text-[#CDFF00] transition-colors">{product.name}</h5>
                    <span className="mt-auto text-sm font-black text-white">{formatPrice(product.price, product.currency)}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Shops you may also like */}
        {otherShops.length > 0 && (
          <div className="mt-14 mb-4">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-5">Shops you may also like</h4>
            <div className="flex gap-4 sm:gap-6 overflow-x-auto scrollbar-hide pb-1">
              {otherShops.map((s) => (
                <Link key={s.id} to={`/shop/${s.slug || s.id}`} className="group flex flex-col items-center w-[92px] shrink-0 text-center">
                  <div
                    className="w-16 h-16 rounded-full p-[2px] group-hover:scale-105 transition-transform"
                    style={{ background: `linear-gradient(135deg, ${s.accentColor || '#CDFF00'}, ${s.accentColor || '#CDFF00'}4D)` }}
                  >
                    <div className="w-full h-full rounded-full overflow-hidden border-2 border-[#050505] bg-black">
                      <SmartImage src={s.bannerUrl} alt={s.name} fallbackIcon={Package} className="w-full h-full object-cover" />
                    </div>
                  </div>
                  <span className="mt-2 text-xs font-bold text-white line-clamp-1 group-hover:text-[#CDFF00] transition-colors">{s.name}</span>
                  <span className="text-[10px] text-gray-500 line-clamp-1">{s.category}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
