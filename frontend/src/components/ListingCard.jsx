import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LISTING_TYPES, formatPrice } from '../utils/constants';
import ReviewStars from './ReviewStars';
import { MapPin, BadgeCheck, Trash } from 'lucide-react';
import { useSelector } from 'react-redux';
import { selectUser } from '../store/authSlice';

export default function ListingCard({ listing, index = 0, onDelete }) {
  const user = useSelector(selectUser);
  const isOwn = user?.id === listing.sellerId;
  const typeInfo = LISTING_TYPES.find((t) => t.value === listing.listingType) || LISTING_TYPES[0];
  const imageUrl = listing.mediaUrls?.[0] || null;
  const TypeIcon = typeInfo.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4 }}
    >
      <Link
        to={`/listing/${listing.id}`}
        className="group block glass bg-black/40 border border-white/10 rounded-2xl overflow-hidden border border-white/5 hover:border-white/10 hover:shadow-xl hover:shadow-black/5 transition-all duration-300 hover:-translate-y-1"
      >
        {/* Image */}
        <div className="relative h-48 bg-[#121212] overflow-hidden border-b border-white/5">
          {imageUrl ? (
            <img src={imageUrl} alt={listing.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          ) : (
            <div className={`w-full h-full bg-gradient-to-br ${typeInfo.color} opacity-10 flex items-center justify-center group-hover:opacity-20 transition-opacity`}>
              <TypeIcon className="w-16 h-16 text-gray-400" />
            </div>
          )}
          
          {/* Top badges */}
          <div className="absolute top-3 left-3 flex gap-2">
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold glass bg-black/40 border border-white/10 text-gray-300 border border-white/10 uppercase tracking-wider shadow-sm">
              <TypeIcon className="w-3.5 h-3.5 text-[#CDFF00]" />
              {typeInfo.label}
            </span>
          </div>
          {listing.negotiable && (
            <div className="absolute top-3 right-3">
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#CDFF00] text-black uppercase tracking-widest shadow-sm">
                Negotiable
              </span>
            </div>
          )}
          {isOwn && onDelete && (
            <button 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (window.confirm('Delete this listing?')) {
                  onDelete(listing.id);
                }
              }}
              className={`absolute top-3 ${listing.negotiable ? 'right-[100px]' : 'right-3'} w-7 h-7 rounded-full bg-[#CDFF00]/90 backdrop-blur text-white flex items-center justify-center hover:bg-[#CDFF00] transition-colors shadow-sm`}
            >
              <Trash className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-5">
          <h3 className="text-white font-bold text-base line-clamp-1 group-hover:text-[#CDFF00] transition-colors mb-1">
            {listing.title}
          </h3>
          {listing.description && (
            <p className="text-gray-400 text-xs line-clamp-2 mb-4 leading-relaxed">{listing.description}</p>
          )}

          {/* Meta row */}
          <div className="flex items-center justify-between mt-auto mb-4">
            <div>
              <span className="text-xl font-heading font-extrabold text-white">
                {formatPrice(listing.price, listing.currency)}
              </span>
            </div>
            <div className="flex flex-col items-end gap-1">
              {listing.avgRating > 0 && (
                <ReviewStars rating={listing.avgRating} size="sm" />
              )}
              {listing.locationCity && (
                <span className="text-[11px] text-gray-400 font-medium flex items-center gap-1 bg-[#121212] px-2 py-0.5 rounded-full">
                  <MapPin className="w-3 h-3 text-[#CDFF00]" />
                  {listing.locationCity}
                </span>
              )}
            </div>
          </div>

          {/* Seller */}
          {listing.sellerName && (
            <div className="pt-4 border-t border-white/5 flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-[#CDFF00] border border-[#CDFF00] flex items-center justify-center text-[#CDFF00] text-[10px] font-bold shrink-0 uppercase">
                {listing.sellerName[0]}
              </div>
              <span className="text-xs font-semibold text-gray-500 truncate tracking-wide">
                {listing.sellerName}
              </span>
              {listing.sellerVerified && (
                <BadgeCheck className="w-4 h-4 text-[#CDFF00] shrink-0 ml-auto" />
              )}
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  );
}
