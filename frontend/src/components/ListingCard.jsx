import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { selectUser } from '../store/authSlice';
import { LISTING_TYPES, formatPrice } from '../utils/constants';
import { Star, MapPin, Zap, BadgeCheck, ShoppingCart, Check, Trash } from 'lucide-react';
import ReviewStars from './ReviewStars';
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
    dispatch(addToCart({ listingId: listing.id, title: listing.title, price: Number(listing.price), currency: listing.currency || 'GBP', image: imageUrl, sellerId: listing.sellerId, sellerName: listing.sellerName || 'Seller' }));
    setAdded(true); setTimeout(() => setAdded(false), 2000);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 50, rotateX: -10 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} transition={{ delay: index * 0.05, duration: 0.6, type: 'spring' }} whileHover={{ y: -10 }}>
      <Link to={`/listing/${listing.id}`} className="group block bg-[#0A0A0A] border-2 border-[#00FFFF]/30 hover:border-[#00FFFF] rounded-[2rem] overflow-hidden transition-all duration-500 shadow-[0_5px_15px_rgba(0,255,255,0.1)] hover:shadow-[0_10px_25px_rgba(0,255,255,0.3)]">
        <div className="relative h-60 overflow-hidden bg-black p-2 pb-0">
          {imageUrl ? <img src={imageUrl} alt={listing.title} className="w-full h-full object-cover rounded-t-[1.5rem] group-hover:scale-110 transition-transform duration-700 ease-out" /> : <div className={`w-full h-full bg-gradient-to-br ${typeInfo.color} opacity-20 flex items-center justify-center rounded-t-[1.5rem]`}><TypeIcon className="w-16 h-16 text-[#00FFFF] opacity-50 drop-shadow-[0_0_10px_#00FFFF]" /></div>}
          <div className="absolute inset-x-2 inset-y-0 bottom-0 bg-gradient-to-t from-[#FF00FF]/80 via-transparent to-transparent rounded-t-[1.5rem] pointer-events-none" />
          <div className="absolute top-4 left-4"><span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black text-[9px] font-black uppercase tracking-widest text-[#00FFFF] border border-[#00FFFF]/50 shadow-[0_0_10px_#00FFFF]"><Zap className="w-3 h-3 fill-[#00FFFF] text-[#00FFFF]" />{typeInfo.label}</span></div>
          <div className="absolute bottom-4 left-4 flex flex-col drop-shadow-[2px_2px_0_rgba(0,0,0,0.8)]"><span className="text-[9px] font-black uppercase tracking-widest text-[#CDFF00] mb-0.5">Starting from</span><span className="text-3xl font-black text-white tracking-tighter">{formatPrice(listing.price, listing.currency)}</span></div>
        </div>
        <div className="p-6 relative z-10 bg-[#0A0A0A] border-t-2 border-[#FF00FF]/30">
          <h3 className="text-xl font-black text-white mb-2 line-clamp-1 group-hover:text-[#00FFFF] transition-colors drop-shadow-[1px_1px_0_#FF00FF]">{listing.title}</h3>
          <p className="text-xs text-gray-400 mb-6 line-clamp-2 leading-relaxed font-bold uppercase tracking-tight">{listing.description || "Premium details for the modern creative."}</p>
          <div className="flex items-center justify-between border-t border-white/10 pt-5">
            <div className="flex items-center gap-3">
              <div className="relative"><div className="w-8 h-8 rounded-full bg-black flex items-center justify-center text-[10px] font-black text-[#FF00FF] border-2 border-[#FF00FF] shadow-[0_0_10px_#FF00FF]">{(listing.sellerName || 'C')[0]}</div>{listing.sellerVerified && <div className="absolute -bottom-1 -right-1 bg-[#CDFF00] rounded-full p-0.5 border border-black"><BadgeCheck className="w-2.5 h-2.5 text-black" /></div>}</div>
              <div className="flex flex-col"><span className="text-xs text-white font-black uppercase tracking-tighter">{listing.sellerName}</span><span className="text-[9px] text-[#00FFFF] font-bold uppercase tracking-widest">Verified Creator</span></div>
            </div>
            <div className="flex flex-col items-end gap-1">{listing.avgRating > 0 && <ReviewStars rating={listing.avgRating} size="sm" />}<div className="flex items-center gap-1 opacity-70"><MapPin className="w-3 h-3 text-[#CDFF00]" /><span className="text-[8px] font-black text-white tracking-widest uppercase">{listing.locationCity}</span></div></div>
          </div>
        </div>
      </Link>
      {!isOwn && (
        <button onClick={handleAddToCart} className={`mt-4 w-full py-3 rounded-full flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(0,0,0,0)] hover:shadow-[0_0_15px_#00FFFF] ${inCart || added ? 'bg-[#00FFFF] text-black border-2 border-[#00FFFF] shadow-[0_0_15px_#00FFFF]' : 'bg-transparent border-2 border-[#FF00FF] text-[#FF00FF] hover:bg-[#FF00FF] hover:text-white'}`}>
          {inCart || added ? <><Check className="w-4 h-4" /> ADDED</> : <><ShoppingCart className="w-4 h-4" /> GRAB IT</>}
        </button>
      )}
    </motion.div>
  );
}
