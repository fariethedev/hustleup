import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LISTING_TYPES, formatPrice } from '../utils/constants';
import ReviewStars from './ReviewStars';
import { MapPin, BadgeCheck, Trash, Zap, ShoppingCart, Check } from 'lucide-react';
import { useSelector, useDispatch } from 'react-redux';
import { selectUser } from '../store/authSlice';
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
    e.preventDefault();
    e.stopPropagation();
    dispatch(addToCart({
      listingId: listing.id,
      title: listing.title,
      price: Number(listing.price),
      currency: listing.currency || 'GBP',
      image: imageUrl,
      sellerId: listing.sellerId,
      sellerName: listing.sellerName || 'Seller',
    }));
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4 }}
    >
      <Link
        to={`/listing/${listing.id}`}
        className="group block glass-card border border-white/5 hover:border-[#D3FF37]/40 rounded-[2.5rem] overflow-hidden transition-all duration-500 hover:shadow-premium hover:-translate-y-2"
      >
        {/* Immersive Image Section */}
        <div className="relative h-60 overflow-hidden bg-[#0A0A0A]">
          {imageUrl ? (
            <img 
              src={imageUrl} 
              alt={listing.title} 
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out" 
            />
          ) : (
            <div className={`w-full h-full bg-gradient-to-br ${typeInfo.color} opacity-20 flex items-center justify-center`}>
              <TypeIcon className="w-20 h-20 text-gray-400 opacity-30" />
            </div>
          )}
          
          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-90" />

          {/* Type Badge */}
          <div className="absolute top-4 left-4">
            <span className="flex items-center gap-2 px-4 py-1.5 rounded-2xl glass-lime text-[10px] font-black uppercase tracking-widest text-white border-white/10">
              <Zap className="w-3.5 h-3.5 fill-[#D3FF37] text-[#D3FF37]" />
              {typeInfo.label}
            </span>
          </div>

          {/* Price Tag - High Contrast Label */}
          <div className="absolute bottom-4 left-4">
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">Starting from</span>
              <span className="text-3xl font-black text-white tracking-tighter drop-shadow-lg">
                {formatPrice(listing.price, listing.currency)}
              </span>
            </div>
          </div>

          {listing.negotiable && (
            <div className="absolute top-4 right-4">
              <span className="px-3 py-1.5 rounded-full text-[10px] font-black bg-[#D3FF37] text-black uppercase tracking-widest animate-pulse shadow-[0_0_15px_rgba(211,255,55,0.4)]">
                Negotiable
              </span>
            </div>
          )}
        </div>

        {/* Content Section */}
        <div className="p-6">
          <h3 className="text-xl font-black text-white mb-2 line-clamp-1 group-hover:text-[#D3FF37] transition-colors duration-300">
            {listing.title}
          </h3>
          <p className="text-sm text-gray-500 mb-6 line-clamp-2 leading-relaxed font-medium italic">
            {listing.description || "The premium details of this listing are waiting for you."}
          </p>

          {/* Actions & Rating Row */}
          <div className="flex items-center justify-between border-t border-white/10 pt-5">
             <div className="flex items-center gap-3">
              {listing.sellerName && (
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center text-[10px] font-black border-2 border-black">
                    {listing.sellerName[0]}
                  </div>
                  {listing.sellerVerified && (
                    <div className="absolute -bottom-1 -right-1 bg-[#D3FF37] rounded-full p-0.5 border border-black">
                      <BadgeCheck className="w-2.5 h-2.5 text-black" />
                    </div>
                  )}
                </div>
              )}
              <div className="flex flex-col">
                <span className="text-xs text-white font-bold group-hover:text-gray-300 transition-colors">{listing.sellerName}</span>
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest opacity-60">Verified Store</span>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1">
              {listing.avgRating > 0 && (
                <ReviewStars rating={listing.avgRating} size="sm" />
              )}
              <div className="flex items-center gap-1 opacity-60">
                <MapPin className="w-3 h-3 text-[#D3FF37]" />
                <span className="text-[9px] font-bold text-gray-400 tracking-widest uppercase">{listing.locationCity}</span>
              </div>
            </div>
          </div>
        </div>
      </Link>

      {/* Cart button OUTSIDE the Link to prevent navigation on click */}
      {!isOwn && (
        <button
          onClick={handleAddToCart}
          className={`mt-2 w-full py-2.5 rounded-2xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all ${
            inCart || added
              ? 'bg-green-500/20 border border-green-500/30 text-green-400'
              : 'bg-white/5 border border-white/10 text-white hover:bg-[#CDFF00]/10 hover:border-[#CDFF00]/30 hover:text-[#CDFF00]'
          }`}
        >
          {inCart || added ? <><Check className="w-3 h-3" /> In Cart</> : <><ShoppingCart className="w-3 h-3" /> Add to Cart</>}
        </button>
      )}

      {isOwn && onDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(listing.id); }}
          className="mt-2 w-full py-2 rounded-2xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-red-400 hover:bg-red-500/10 border border-red-500/10 hover:border-red-500/30 transition-all"
        >
          <Trash className="w-3 h-3" /> Delete Listing
        </button>
      )}
    </motion.div>
  );
}
