import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion as Motion } from "framer-motion";
import { useSelector } from 'react-redux';
import { useShop, useShops } from '../hooks/useShops';
import { listingsApi, followsApi } from '../api/client';
import { displayCity } from '../utils/constants';
import { selectUser, selectIsAuthenticated } from '../store/authSlice';
import { useToast } from '../context/ToastContext';
import { Sparkle, Navigation, MoveLeft, Box, Forward, ThumbsUp, SquarePen, ClipboardCheck, MessagesSquare } from 'lucide-react';
import { useState, useEffect } from 'react';
import SmartImage from '../components/SmartImage';
import ListingCard from '../components/ListingCard';
import ShopHighlights from '../components/ShopHighlights';
import { storeListing } from '../utils/storeListings';
import ShopReviews from '../components/ShopReviews';
import AppointmentBooking from '../components/AppointmentBooking';
import { uploadUrl } from '../config';
import { isAppointmentBusiness, isProductInStock } from '../utils/shopCategories';

export default function ShopDetail() {
  const { id } = useParams();
  const { shop, loading } = useShop(id);
  const { shops: allShops } = useShops();
  const currentUser = useSelector(selectUser);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState('All');
  const [productSearch, setProductSearch] = useState('');
  const [inStockOnly, setInStockOnly] = useState(false);
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

  // Following the shop means following its owner — the platform has one social graph, and a
  // separate "saved shops" list would be a second, weaker one that nothing else reads. This
  // way the shop's posts show up in the follower's feed, which is what following it should do.
  const [following, setFollowing] = useState(false);
  const [followRequested, setFollowRequested] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !shop?.ownerId || isOwner) { setFollowing(false); return undefined; }
    let cancelled = false;
    followsApi.relationship(shop.ownerId)
      .then((r) => { if (!cancelled) { setFollowing(!!r.data?.isFollowing); setFollowRequested(!!r.data?.followRequested); } })
      .catch(() => { if (!cancelled) setFollowing(false); });
    return () => { cancelled = true; };
  }, [isAuthenticated, shop?.ownerId, isOwner]);

  const toggleFollowShop = async () => {
    if (!isAuthenticated) { navigate('/login'); return; }
    if (!shop?.ownerId) return;
    const next = !following && !followRequested;
    setFollowing(next);          // optimistic — the button should answer the tap immediately
    setFollowBusy(true);
    try {
      const { data } = await (next ? followsApi.follow(shop.ownerId) : followsApi.unfollow(shop.ownerId));
      setFollowRequested(data.status === 'requested'); setFollowing(next && data.status !== 'requested');
      showToast(data.status === 'requested' ? 'Follow request sent' : next ? `Following ${shop.name}` : 'Follow removed', 'success');
    } catch (e) {
      setFollowing(following);   // Restore the accepted relationship, not a pending request.
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
          <Box className="w-16 h-16 mx-auto text-gray-300 mb-6 opacity-20" />
          <h2 className="text-2xl font-black text-white mb-2 tracking-tight">Shop not found</h2>
          <p className="text-gray-400 mb-6 font-medium">This storefront doesn't exist, or its owner has taken it down.</p>
          <Link to="/explore/shops" className="px-8 py-3.5 rounded-2xl bg-[#CDFF00] text-black font-black tracking-widest hover:scale-105 transition-all">
            Browse shops
          </Link>
        </div>
      </div>
    );
  }

  const products = shop.products || [];
  const categories = ['All', ...new Set(products.map((p) => p.category).filter(Boolean))];
  const selectedCategory = categories.includes(activeCategory) ? activeCategory : 'All';
  const filteredProducts = products.filter((product) =>
    (selectedCategory === 'All' || product.category === selectedCategory)
    && `${product.name} ${product.description || ''} ${product.category || ''}`.toLowerCase().includes(productSearch.trim().toLowerCase())
    && (!inStockOnly || isProductInStock(product)));

  // Cross-sell: a handful of other live storefronts, and one product from each.
  const otherShops = allShops.filter((s) => s.id !== shop.id).slice(0, 4);
  const suggestedProducts = otherShops
    .map((s) => ({ ...(s.products || []).find(isProductInStock), shop: s }))
    .filter((p) => p.id);

  return (
    <div className="min-h-screen text-white">
      {/* Immersive Shop Banner & Header */}
      <section className="relative h-[320px] sm:h-[380px] overflow-hidden media-overlay border-b border-white/10">
        <Motion.div
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
            fallbackIcon={Box}
            className="w-full h-full object-cover"
            fallbackClassName="opacity-40"
          />
        </Motion.div>
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
        <div className="absolute top-4 sm:top-6 left-0 right-0 max-w-7xl mx-auto px-4 sm:px-12 flex items-center justify-between gap-2 z-20">
          <Link
            to="/explore/shops"
            aria-label="All shops"
            className="flex items-center justify-center gap-2 h-10 w-10 sm:w-auto sm:px-5 rounded-2xl bg-black/70 backdrop-blur-md border border-white/15 text-white font-black text-[10px] tracking-widest hover:scale-105 transition-all active:scale-95 shrink-0"
          >
            <MoveLeft className="w-4 h-4 shrink-0" /> <span className="hidden sm:inline">All shops</span>
          </Link>
          <div className="flex gap-2 shrink-0">
            {/* The owner gets a direct route to the editor from their own storefront —
                seeing the page is usually what prompts wanting to change it. */}
            {isOwner && (
              <Link
                to="/dashboard?tab=shop"
                aria-label="Edit shop"
                className="flex items-center justify-center gap-2 h-10 w-10 sm:w-auto sm:px-4 rounded-2xl bg-[#CDFF00] text-black font-black text-[10px] tracking-widest hover:scale-105 transition-transform active:scale-95"
              >
                <SquarePen className="w-4 h-4 sm:w-3.5 sm:h-3.5 shrink-0" /> <span className="hidden sm:inline">Edit shop</span>
              </Link>
            )}
            {/* Both of these used to be rendered with an aria-label and no onClick — they
                looked like controls, took the tap, and did nothing whatsoever. */}
            <button
              onClick={shareShop}
              aria-label="Share this shop"
              className="w-10 h-10 rounded-2xl bg-black/70 backdrop-blur-md border border-white/15 flex items-center justify-center hover:scale-110 transition-transform active:scale-95"
            >
              <Forward className="w-4 h-4" />
            </button>
            {/* Messaging the owner is one action, so it is one button, here with the other
                two rather than a panel of its own down the sidebar. It used to be a full
                "Run by" card — avatar, name, city, glow and a full-width button — which is a
                lot of page to spend on a link to a chat, and on mobile it sat above the
                products a shopper came for. The owner is still one tap away: the name in the
                hero links to their profile. */}
            {!isOwner && (
              <Link
                to={`/dm/${shop.ownerId}`}
                aria-label={`Message ${shop.ownerName || 'the owner'}`}
                title={`Message ${shop.ownerName || 'the owner'}`}
                className="w-10 h-10 rounded-2xl bg-black/70 backdrop-blur-md border border-white/15 flex items-center justify-center hover:scale-110 transition-transform active:scale-95"
              >
                <MessagesSquare className="w-4 h-4" />
              </Link>
            )}
            {/* Hidden on your own shop: following yourself is not a thing. */}
            {!isOwner && (
              <button
                onClick={toggleFollowShop}
                disabled={followBusy}
                aria-label={following ? 'Unfollow this shop' : followRequested ? 'Cancel follow request' : 'Follow this shop'}
                aria-pressed={following}
                className={`w-10 h-10 rounded-2xl backdrop-blur-md border flex items-center justify-center hover:scale-110 transition-transform active:scale-95 disabled:opacity-50 ${
                  following
                    ? 'bg-[#FF00FF]/20 border-[#FF00FF]/50 text-[#FF00FF]'
                    : 'bg-black/70 border-white/15 text-white'
                }`}
              >
                <ThumbsUp className={`w-4 h-4 ${following ? 'fill-[#FF00FF]' : ''}`} />
              </button>
            )}
          </div>
        </div>

        {/* Shop Info Main Focus */}
        <div className="absolute bottom-4 sm:bottom-6 left-0 right-0 px-4 sm:px-12">
          <div className="max-w-7xl mx-auto flex flex-col items-start gap-1.5 sm:gap-2">
            {shop.category && (
              <Motion.span
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="px-3 py-1 sm:px-4 sm:py-1.5 rounded-2xl text-[9px] sm:text-[10px] font-black tracking-widest bg-black/70 backdrop-blur-md border border-white/20"
                style={{ color: shop.accentColor || '#CDFF00' }}
              >
                {shop.category}
              </Motion.span>
            )}
            <Motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              // Clamped: a long shop name wrapped to three lines at 30px and shoved the
              // meta row out through the bottom of the banner.
              className="text-2xl sm:text-5xl font-black text-white mb-0.5 sm:mb-1 tracking-tighter leading-[1.05] line-clamp-2 drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]"
            >
              {shop.name}
            </Motion.h1>
            <Motion.div
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               transition={{ delay: 0.3 }}
               // gap-6 between three wrapping items cost two extra rows on a phone.
               className="flex flex-wrap items-center gap-x-3 gap-y-1.5 sm:gap-6 text-gray-300 text-[10px] sm:text-xs font-bold tracking-widest"
            >
              <span className="flex items-center gap-1.5 sm:gap-2">
                <div className="w-fit px-2 py-1 bg-[#CDFF00] text-black rounded-lg flex items-center gap-1">
                  <Sparkle className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-black" />
                  {shop.rating > 0 ? shop.rating.toFixed(1) : 'New'}
                </div>
                ({shop.reviewCount} <span className="opacity-50">Reviews</span>)
              </span>
              <span className="flex items-center gap-1.5 sm:gap-2">
                <Navigation className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#CDFF00] shrink-0" /> {displayCity(shop.city)}
              </span>
              {shop.ownerName && (
                <Link to={`/profile/${shop.ownerId}`} className="flex items-center gap-2 min-w-0 rounded-full bg-white/5 px-2 py-1 hover:bg-white/10 transition-colors">
                  <SmartImage src={uploadUrl(shop.ownerAvatarUrl)} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
                  <span className="text-gray-400 shrink-0">By</span><span className="truncate">{shop.ownerName}</span>
                </Link>
              )}
            </Motion.div>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <div className="max-w-[1120px] mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <ShopHighlights key={shop.id} shop={shop} isOwner={isOwner} />
        <div className={`grid gap-6 lg:gap-10 items-start ${isOwner || shop.appointmentBased || isAppointmentBusiness(shop.businessType) ? 'lg:grid-cols-[minmax(0,1fr)_280px]' : ''}`}>

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
                <h4 className="text-[10px] font-black tracking-widest text-gray-500 mb-2">About this shop</h4>
                <p className="text-sm text-gray-300 leading-relaxed max-w-3xl whitespace-pre-line">
                  {shop.description}
                </p>
              </div>
            )}

            {/* Breadcrumb Navigation */}
            <div className="flex items-center justify-between gap-3 mb-5">
              <h2 className="text-xl font-bold tracking-tight text-white">Shop the collection</h2>
              <span className="text-xs text-gray-400 shrink-0">{products.length} products</span>
            </div>

            {products.length > 0 && (
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <input type="search" aria-label="Search this shop" placeholder="Search this shop" value={productSearch} onChange={(e) => setProductSearch(e.target.value)} className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white" />
                <label className="flex items-center gap-2 text-xs text-gray-300"><input type="checkbox" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} className="accent-[#CDFF00]" /> In stock only</label>
              </div>
            )}
            {/* Category filter — only worth showing when the seller uses more than one shelf */}
            {categories.length > 2 && (
              <div className="flex flex-wrap gap-2 mb-6 sm:mb-8 p-2 rounded-3xl bg-white/[0.03] border border-white/5 max-w-full w-fit">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    aria-pressed={selectedCategory === cat}
                    className={`px-4 py-2.5 sm:px-6 sm:py-3 rounded-2xl text-[10px] font-black tracking-widest transition-all ${
                      selectedCategory === cat
                        ? 'bg-[#CDFF00] text-black shadow-[0_0_20px_rgba(205,255,0,0.3)]'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}

            {/* Same grid as Explore — two-up on a phone, four across on a wide screen — so a
                seller's shelf and the browse pages read as one catalogue rather than two
                different products. */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5">
              {filteredProducts.map(product => <ListingCard key={product.id} listing={storeListing(shop, product)} />)}
            </div>

            {filteredProducts.length === 0 && (
              <div className="text-center px-4 py-14 sm:py-24 rounded-3xl sm:rounded-[48px] border-dashed border-2 border-white/5">
                <Box className="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-gray-500 mb-5 sm:mb-6 opacity-30" />
                <h3 className="text-lg sm:text-xl font-black text-white mb-2 tracking-tighter">
                  {products.length === 0 ? 'Nothing on the shelf yet' : 'Nothing in this category'}
                </h3>
                {isOwner && products.length === 0 ? (
                  <Link
                    to="/dashboard"
                    className="inline-block mt-2 px-6 py-2.5 rounded-2xl bg-[#CDFF00] text-black text-[10px] font-black tracking-widest hover:bg-[#d9ff33] transition-colors"
                  >
                    Add your first product
                  </Link>
                ) : products.length > 0 && (
                  <button
                    onClick={() => { setActiveCategory('All'); setProductSearch(''); setInStockOnly(false); }}
                    className="text-xs font-black tracking-widest text-[#CDFF00] hover:text-white transition-colors"
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
          {(isOwner || shop.appointmentBased || isAppointmentBusiness(shop.businessType)) && <aside className="order-1 lg:order-2 lg:sticky lg:top-24 flex flex-col gap-5 lg:gap-8 w-full min-w-0">
             {isOwner && (
               <div className="p-5 rounded-3xl sm:rounded-[32px] bg-[#CDFF00]/5 border border-[#CDFF00]/30">
                  <h5 className="text-[10px] font-black tracking-widest text-[#CDFF00] mb-1.5">This is your shop</h5>
                  <p className="text-xs text-gray-400 mb-4 leading-relaxed">
                    Everything on this page — the banner, colour, copy, city and every product —
                    is yours to change.
                  </p>
                  <Link
                    to="/dashboard?tab=shop"
                    className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-[#CDFF00] text-black text-[10px] font-black tracking-widest hover:bg-[#d9ff33] transition-colors"
                  >
                    <SquarePen className="w-3.5 h-3.5" /> Edit shop
                  </Link>
               </div>
             )}

             {(shop.appointmentBased || isAppointmentBusiness(shop.businessType)) && <AppointmentBooking key={shop.id} shop={shop} />}

          </aside>}
        </div>

        {/* The owner's marketplace listings — the other half of what this seller offers. */}
        {ownerListings.length > 0 && (
          <div className="mt-10 sm:mt-16">
            <div className="flex items-center gap-2 mb-5">
              <ClipboardCheck className="w-4 h-4 text-[#00FFFF]" />
              <h4 className="text-[10px] font-black tracking-widest text-gray-500">
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
            <h4 className="text-[10px] font-black tracking-widest text-gray-500 mb-5">Products you may also like</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-5">
              {suggestedProducts.map(product => <ListingCard key={product.id} listing={storeListing(product.shop, product)} />)}
            </div>
          </div>
        )}

        {/* Shops you may also like */}
        {otherShops.length > 0 && (
          <div className="mt-14 mb-4">
            <h4 className="text-[10px] font-black tracking-widest text-gray-500 mb-5">Shops you may also like</h4>
            <div className="flex gap-4 sm:gap-6 overflow-x-auto overscroll-x-contain scrollbar-hide pb-1">
              {otherShops.map((s) => (
                <Link key={s.id} to={`/shop/${s.slug || s.id}`} className="group flex flex-col items-center w-[92px] shrink-0 text-center">
                  <div
                    className="w-16 h-16 rounded-full p-[2px] group-hover:scale-105 transition-transform"
                    style={{ background: `linear-gradient(135deg, ${s.accentColor || '#CDFF00'}, ${s.accentColor || '#CDFF00'}4D)` }}
                  >
                    <div className="w-full h-full rounded-full overflow-hidden border-2 border-[#050505] bg-black">
                      <SmartImage src={s.bannerUrl} alt={s.name} fallbackIcon={Box} className="w-full h-full object-cover" />
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
