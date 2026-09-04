import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { selectUser } from '../store/authSlice';
import { LISTING_TYPES, formatPrice, convertToPLN, displayCity } from '../utils/constants';
import { MapPin, BadgeCheck, ShoppingCart, Check, Star, HandCoins, Trash2 } from 'lucide-react';
import { addToCart, selectCartItems } from '../store/cartSlice';
import { useState } from 'react';
import CardCarousel from './CardCarousel';
import { coverImage, mediaList } from '../utils/media';

/**
 * A marketplace listing, as shown in browse grids and the mobile two-up carousel.
 *
 * Laid out for the narrowest place it appears — roughly 160px wide, half a phone screen.
 * Everything here earns that width:
 *
 * - The image is a 4:3 ratio rather than a fixed height, so the card scales with its column
 *   instead of going letterbox-thin when the column narrows.
 * - Every image is swipeable in place via `CardCarousel`. A listing carries five or so photos
 *   and the card used to show exactly one of them, with a small "5" badge as the only hint the
 *   rest existed — so seeing a listing properly meant opening it. The badge is gone; the dots
 *   under the image say the same thing and can be acted on.
 * - Add-to-cart floats on the image, which removes a whole stacked row.
 * - The description is hidden below `sm`. At two-up it rendered as two clipped lines and
 *   pushed the price out of view; the title and price are what people actually scan.
 * - Nothing is badged except a negotiable price, and that badge is now the icon alone.
 *   "Fixed price" went first: nearly every listing is fixed price, so it labelled the
 *   default state and told the reader nothing. The category label followed for the same
 *   reason — the type icon already stands in as the image fallback, and the word repeated
 *   what the title says in plain language.
 */
export default function ListingCard({ listing, index = 0, onDelete }) {
  const user = useSelector(selectUser);
  const dispatch = useDispatch();
  const cartItems = useSelector(selectCartItems);
  const isOwn = user?.id === listing.sellerId;
  const typeInfo = LISTING_TYPES.find((t) => t.value === listing.listingType) || LISTING_TYPES[0];
  // coverImage prefers a still over a video: a card showing a clip's first frame is usually
  // just a black rectangle. Still needed on its own for the cart thumbnail, which is a single
  // fixed image.
  const imageUrl = coverImage(listing);
  // Falls back to the cover so a listing with no `mediaUrls` still renders one slide.
  const media = mediaList(listing);
  const slides = media.length > 0 ? media : [imageUrl].filter(Boolean);
  const TypeIcon = typeInfo.icon;
  const [added, setAdded] = useState(false);
  const inCart = cartItems.some((i) => i.listingId === listing.id);
  const isInCart = inCart || added;

  const handleAddToCart = (e) => {
    e.preventDefault(); e.stopPropagation();
    // Normalized to PLN at add-time so a cart mixing listings/shops that were priced in
    // different currencies still sums to a correct total.
    dispatch(addToCart({ listingId: listing.id, title: listing.title, price: convertToPLN(listing.price, listing.currency || 'PLN'), currency: 'PLN', image: imageUrl, sellerId: listing.sellerId, sellerName: listing.sellerName || 'Seller', shippingMethod: listing.shippingMethod, shippingPrice: convertToPLN(listing.shippingPrice || 0, listing.currency || 'PLN') }));
    setAdded(true); setTimeout(() => setAdded(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.3), duration: 0.4 }}
      whileHover={{ y: -4 }}
      className="h-full"
    >
      <div className="group relative flex flex-col h-full bg-[#0A0A0A] border border-white/10 hover:border-[#00FFFF]/60 rounded-2xl overflow-hidden transition-colors duration-300 shadow-[0_4px_12px_rgba(0,0,0,0.4)] hover:shadow-[0_8px_24px_rgba(0,255,255,0.15)]">

        <Link to={`/listing/${listing.id}`} className="flex flex-col h-full">
          {/* ── Image ── */}
          {/* 4:5, not 4:3 — the shorter ratio cropped tightly into portrait product
              photos (the common case for fashion/goods listings), which is also the
              ratio already used for event flyers elsewhere in the app. */}
          <div className="relative aspect-[4/5] overflow-hidden bg-black shrink-0">
            <CardCarousel
              media={slides}
              title={listing.title}
              fallbackIcon={TypeIcon}
              fallbackClassName={`bg-gradient-to-br ${typeInfo.color} opacity-30`}
              // The hover zoom is dropped once there is more than one slide: a scaled image
              // inside a snapping track drifts against its neighbours as you swipe.
              imageClassName={`w-full h-full object-cover ${
                slides.length > 1 ? '' : 'group-hover:scale-105 transition-transform duration-500 ease-out'
              }`}
            />
            {/* Drawn over the track, under the z-10 controls: it is what keeps the cart button
                and the dots legible on a bright photo. */}
            <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />

            {/* The one exceptional fact about a listing, as an icon. Dropping the "Nego"
                text costs nothing a hover or a screen reader cannot recover, and the
                accessible name carries the full word rather than the abbreviation. */}
            {listing.negotiable && (
              <span
                role="img"
                title="Price negotiable"
                aria-label="Price negotiable"
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-[#CDFF00] text-black flex items-center justify-center shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
              >
                <HandCoins className="w-3.5 h-3.5" strokeWidth={2.5} />
              </span>
            )}

            {/* Cart floats on the image, saving the full-width row the old card spent on it —
                height is the scarce dimension at two-up. */}
            {!isOwn && (
              <button
                onClick={handleAddToCart}
                aria-label={isInCart ? 'In cart' : `Add ${listing.title} to cart`}
                className={`absolute bottom-2 right-2 w-9 h-9 rounded-full flex items-center justify-center shadow-[0_4px_12px_rgba(0,0,0,0.5)] transition-all active:scale-90 ${
                  isInCart
                    ? 'bg-[#00FFFF] text-black'
                    : 'bg-white/10 backdrop-blur-md border border-white/25 text-white hover:bg-[#CDFF00] hover:text-black hover:border-[#CDFF00]'
                }`}
              >
                {isInCart ? <Check className="w-4 h-4" strokeWidth={3} /> : <ShoppingCart className="w-4 h-4" />}
              </button>
            )}
          </div>

          {/* ── Body ── */}
          <div className="flex flex-col flex-1 p-3">
            <div className="flex items-baseline justify-between gap-1.5">
              <span className="text-lg sm:text-xl font-black text-[#CDFF00] tracking-tight leading-none truncate">
                {formatPrice(listing.price, listing.currency)}
              </span>
              {listing.avgRating > 0 && (
                <span className="flex items-center gap-0.5 text-[10px] font-black text-white shrink-0">
                  <Star className="w-3 h-3 fill-[#CDFF00] text-[#CDFF00]" />
                  {Number(listing.avgRating).toFixed(1)}
                </span>
              )}
            </div>

            <h3 className="mt-1.5 text-[13px] font-black text-white leading-snug line-clamp-2 group-hover:text-[#00FFFF] transition-colors">
              {listing.title}
            </h3>

            {/* Hidden at two-up, where it only ever showed clipped filler */}
            {listing.description && (
              <p className="hidden sm:block text-xs text-gray-400 mt-1 line-clamp-2 leading-relaxed">
                {listing.description}
              </p>
            )}

            {/* Seller and place on one line, pinned to the bottom so cards align */}
            <div className="mt-auto pt-2.5 flex items-center gap-1.5 min-w-0">
              <div className="shrink-0 w-5 h-5 rounded-full overflow-hidden bg-black border border-[#FF00FF]/60 flex items-center justify-center text-[8px] font-black text-[#FF00FF]">
                {listing.sellerAvatarUrl
                  ? <img src={listing.sellerAvatarUrl} alt="" className="w-full h-full object-cover" />
                  : (listing.sellerName || 'C')[0]}
              </div>
              <span className="text-[10px] text-gray-300 font-bold truncate min-w-0">
                {listing.sellerName || 'Creator'}
              </span>
              {listing.sellerVerified && <BadgeCheck className="w-3 h-3 text-[#CDFF00] shrink-0" />}
              <span className="ml-auto flex items-center gap-0.5 text-[9px] font-bold text-gray-500 uppercase tracking-wider shrink-0">
                <MapPin className="w-3 h-3 text-[#CDFF00]" />
                <span className="max-w-[64px] truncate">{displayCity(listing.locationCity)}</span>
              </span>
            </div>
          </div>
        </Link>

        {/* Owner-only footer. Buyers get the floating cart button instead, so this row exists
            only for the person who posted the listing. */}
        {isOwn && (
          <div className="px-3 pb-3">
            {onDelete ? (
              <button
                onClick={(e) => { e.preventDefault(); onDelete(listing.id); }}
                className="w-full py-1.5 rounded-lg flex items-center justify-center gap-1.5 text-[9px] font-black uppercase tracking-widest bg-red-500/10 border border-red-500/40 text-red-400 hover:bg-red-500/20 transition-colors"
              >
                <Trash2 className="w-3 h-3" /> Delete
              </button>
            ) : (
              <div className="w-full py-1.5 rounded-lg text-center text-[9px] font-black uppercase tracking-widest text-gray-600 bg-white/[0.03] border border-white/5">
                Your listing
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
