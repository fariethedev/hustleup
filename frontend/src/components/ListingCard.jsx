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
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05, duration: 0.4 }}>
      <Link to={`/listing/${listing.id}`} className="group block bg-white border border-gray-100 hover:border-[#CDFF00] rounded-[2rem] overflow-hidden transition-all duration-500 hover:shadow-2xl hover:-translate-y-2">
        <div className="relative h-60 overflow-hidden bg-gray-50">
          {imageUrl ? <img src={imageUrl} alt={listing.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out" /> : <div className={`w-full h-full bg-gradient-to-br ${typeInfo.color} opacity-10 flex items-center justify-center`}><TypeIcon className="w-16 h-16 text-gray-300 opacity-50" /></div>}
          <div className="absolute top-4 left-4"><span className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black text-[9px] font-black uppercase tracking-widest text-white"><Zap className="w-3 h-3 fill-[#CDFF00] text-[#CDFF00]" />{typeInfo.label}</span></div>
          <div className="absolute bottom-4 left-4 flex flex-col"><span className="text-[9px] font-black uppercase tracking-widest text-black/40 mb-0.5">Starting from</span><span className="text-3xl font-black text-black tracking-tighter">{formatPrice(listing.price, listing.currency)}</span></div>
        </div>
        <div className="p-6">
          <h3 className="text-xl font-black text-black mb-2 line-clamp-1 group-hover:text-[#CDFF00] transition-colors">{listing.title}</h3>
          <p className="text-xs text-gray-500 mb-6 line-clamp-2 leading-relaxed font-bold uppercase tracking-tight opacity-70">{listing.description || "Premium service details for the modern syndicate member."}</p>
          <div className="flex items-center justify-between border-t border-gray-50 pt-5">
            <div className="flex items-center gap-3">
              <div className="relative"><div className="w-8 h-8 rounded-full bg-black flex items-center justify-center text-[10px] font-black text-white border-2 border-white">{(listing.sellerName || 'S')[0]}</div>{listing.sellerVerified && <div className="absolute -bottom-1 -right-1 bg-[#CDFF00] rounded-full p-0.5 border border-white"><BadgeCheck className="w-2.5 h-2.5 text-black" /></div>}</div>
              <div className="flex flex-col"><span className="text-xs text-black font-black uppercase tracking-tighter">{listing.sellerName}</span><span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Verified Store</span></div>
            </div>
            <div className="flex flex-col items-end gap-1">{listing.avgRating > 0 && <ReviewStars rating={listing.avgRating} size="sm" />}<div className="flex items-center gap-1 opacity-40"><MapPin className="w-3 h-3 text-black" /><span className="text-[8px] font-black text-black tracking-widest uppercase">{listing.locationCity}</span></div></div>
          </div>
        </div>
      </Link>
      {!isOwn && (
        <button onClick={handleAddToCart} className={`mt-2 w-full py-2.5 rounded-2xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all ${inCart || added ? 'bg-green-500/20 border border-green-500/30 text-green-400' : 'bg-gray-50 border border-gray-100 text-black hover:bg-black hover:text-white transition-all shadow-sm'}`}>
          {inCart || added ? <><Check className="w-3 h-3" /> In Cart</> : <><ShoppingCart className="w-3 h-3" /> Add to Cart</>}
        </button>
      )}
    </motion.div>
  );
}
