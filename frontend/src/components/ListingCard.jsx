import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { selectUser } from '../store/authSlice';
import { LISTING_TYPES, formatPrice, convertToPLN } from '../utils/constants';
import { MapPin, Zap, BadgeCheck, ShoppingCart, Check, Star, HandCoins, Lock } from 'lucide-react';
import { addToCart, selectCartItems } from '../store/cartSlice';
import { useState } from 'react';

export default function ListingCard({ listing, index = 0, onDelete }) {
  const user = useSelector(selectUser);
  const dispatch = useDispatch();
  const cartItems = useSelector(selectCartItems);
  const isOwn = user?.id === listing.sellerId;
  const typeInfo = LISTING_TYPES.find((t) => t.value === listing.listingType) || LISTING_TYPES[0];
  const imageUrl = listing.mediaUrls?.[0] || null;
  const TypeIcon = typeInfo.icon;
  const [added, setAdded] = useState(false);
  const inCart = cartItems.some((i) => i.listingId === listing.id);

  const handleAddToCart = (e) => {
    e.preventDefault(); e.stopPropagation();
    // Normalized to PLN at add-time so a cart mixing listings/shops that were priced in
    // different currencies still sums to a correct total.
    dispatch(addToCart({ listingId: listing.id, title: listing.title, price: convertToPLN(listing.price, listing.currency || 'PLN'), currency: 'PLN', image: imageUrl, sellerId: listing.sellerId, sellerName: listing.sellerName || 'Seller' }));
    setAdded(true); setTimeout(() => setAdded(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.3), duration: 0.4 }}
      whileHover={{ y: -4 }}
      className="h-full"
    >
      <div className="group flex flex-col h-full bg-[#0A0A0A] border border-white/10 hover:border-[#00FFFF]/60 rounded-2xl overflow-hidden transition-all duration-300 shadow-[0_4px_12px_rgba(0,0,0,0.4)] hover:shadow-[0_8px_20px_rgba(0,255,255,0.15)]">
        <Link to={`/listing/${listing.id}`} className="block">
          {/* Image */}
          <div className="relative h-40 overflow-hidden bg-black">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={listing.title}
                onError={(e) => { e.target.onerror = null; e.target.style.display = 'none'; }}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
              />
            ) : (
              <div className={`w-full h-full bg-gradient-to-br ${typeInfo.color} opacity-20 flex items-center justify-center`}>
                <TypeIcon className="w-12 h-12 text-[#00FFFF] opacity-60" />
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />

            {/* Type badge */}
            <span className="absolute top-2.5 left-2.5 flex items-center gap-1 px-2 py-1 rounded-md bg-black/80 text-[8px] font-black uppercase tracking-widest text-[#00FFFF] border border-[#00FFFF]/40">
              <Zap className="w-2.5 h-2.5 fill-[#00FFFF]" />{typeInfo.label}
            </span>

            {/* Negotiable / fixed-price badge */}
            {listing.negotiable ? (
              <span className="absolute top-2.5 right-2.5 flex items-center gap-1 px-2 py-1 rounded-md bg-[#CDFF00] text-black text-[8px] font-black uppercase tracking-widest shadow-[0_0_8px_rgba(205,255,0,0.5)]">
                <HandCoins className="w-2.5 h-2.5" /> Negotiable
              </span>
            ) : (
              <span className="absolute top-2.5 right-2.5 flex items-center gap-1 px-2 py-1 rounded-md bg-black/80 text-gray-300 text-[8px] font-black uppercase tracking-widest border border-white/20">
                <Lock className="w-2.5 h-2.5" /> Fixed price
              </span>
            )}
          </div>

          {/* Body */}
          <div className="p-3.5 pb-0">
            {/* Price — the loudest element on the card */}
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xl font-black text-[#CDFF00] tracking-tight leading-none">
                {formatPrice(listing.price, listing.currency)}
              </span>
              {listing.avgRating > 0 && (
                <span className="flex items-center gap-1 text-[11px] font-black text-white">
                  <Star className="w-3.5 h-3.5 fill-[#CDFF00] text-[#CDFF00]" />
                  {Number(listing.avgRating).toFixed(1)}
                </span>
              )}
            </div>

            <h3 className="text-sm font-black text-white leading-snug line-clamp-1 group-hover:text-[#00FFFF] transition-colors">
              {listing.title}
            </h3>
            <p className="text-xs text-gray-400 mt-1 line-clamp-2 leading-relaxed min-h-[2rem]">
              {listing.description || 'Premium details for the modern creative.'}
            </p>

            {/* Seller + location */}
            <div className="flex items-center justify-between gap-2 mt-2.5 pt-2.5 border-t border-white/5">
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="relative shrink-0 w-6 h-6 rounded-full overflow-hidden bg-black border border-[#FF00FF]/60 flex items-center justify-center text-[9px] font-black text-[#FF00FF]">
                  {listing.sellerAvatarUrl
                    ? <img src={listing.sellerAvatarUrl} alt="" className="w-full h-full object-cover" />
                    : (listing.sellerName || 'C')[0]}
                </div>
                <span className="text-[10px] text-gray-300 font-bold truncate">{listing.sellerName || 'Creator'}</span>
                {listing.sellerVerified && <BadgeCheck className="w-3 h-3 text-[#CDFF00] shrink-0" />}
              </div>
              {listing.locationCity && (
                <span className="flex items-center gap-1 text-[9px] font-bold text-gray-500 uppercase tracking-wider shrink-0">
                  <MapPin className="w-3 h-3 text-[#CDFF00]" /> {listing.locationCity}
                </span>
              )}
            </div>
          </div>
        </Link>

        {/* Add to cart */}
        <div className="p-3.5 pt-2.5 mt-auto">
          {!isOwn ? (
            <button
              onClick={handleAddToCart}
              className={`w-full py-2 rounded-xl flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${
                inCart || added
                  ? 'bg-[#00FFFF] text-black'
                  : 'bg-white/5 border border-[#FF00FF]/50 text-[#FF00FF] hover:bg-[#FF00FF] hover:text-white'
              }`}
            >
              {inCart || added ? <><Check className="w-3.5 h-3.5" /> In cart</> : <><ShoppingCart className="w-3.5 h-3.5" /> Add to cart</>}
            </button>
          ) : onDelete ? (
            <button
              onClick={(e) => { e.preventDefault(); onDelete(listing.id); }}
              className="w-full py-2 rounded-xl flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-widest bg-red-500/10 border border-red-500/40 text-red-400 hover:bg-red-500/20 transition-all"
            >
              Delete listing
            </button>
          ) : (
            <div className="w-full py-2 rounded-xl text-center text-[9px] font-black uppercase tracking-widest text-gray-600 bg-white/[0.03] border border-white/5">
              Your listing
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
