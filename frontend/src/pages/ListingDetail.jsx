import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LISTING_TYPES, formatPrice } from '../utils/constants';
import { MapPin, BadgeCheck, MessageSquare, ShieldCheck, ShoppingCart, ArrowLeft, Star, Heart, Share2, Zap } from 'lucide-react';
import { useState } from 'react';
import ReviewStars from '../components/ReviewStars';

export default function ListingDetail() {
  const { id } = useParams();
  const [activeMedia, setActiveMedia] = useState(0);

  // Mock data — in a real app, fetch from the marketplace-service
  const listing = {
    id: id,
    title: "Vibes & Vinyls: Premium Headphones",
    description: "Experience sound like never before. These audiophile-grade headphones feature active noise cancellation, 40-hour battery life, and high-fidelity drivers tuned for perfection. Perfect for professional studio work or immersive home listening.",
    price: 350.00,
    currency: "USD",
    listingType: "PRODUCT",
    negotiable: true,
    locationCity: "New York",
    sellerId: "seller-1",
    sellerName: "Premium Sound Shop",
    sellerVerified: true,
    avgRating: 4.9,
    mediaUrls: [
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=2070&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1546435770-a3e426bf472b?q=80&w=2065&auto=format&fit=crop",
    ]
  };

  const typeInfo = LISTING_TYPES.find((t) => t.value === listing.listingType) || LISTING_TYPES[0];

  return (
    <div className="min-h-screen bg-[#050505] text-white pt-24 pb-20">
      <div className="max-w-7xl mx-auto px-6 sm:px-12">
        
        {/* Navigation / Header Row */}
        <div className="flex items-center justify-between mb-12">
          <Link
            to="/marketplace"
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl glass-strong text-[10px] font-black uppercase tracking-widest hover:text-[#CDFF00] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Marketplace
          </Link>
          <div className="flex gap-3">
             <button className="flex items-center gap-2 px-6 py-2.5 rounded-2xl glass-strong text-[10px] font-black uppercase tracking-widest text-[#CDFF00] border-white/5 hover:bg-white/5 transition-all">
                <Heart className="w-4 h-4" /> Save
             </button>
             <button className="flex items-center gap-2 px-6 py-2.5 rounded-2xl glass-strong text-[10px] font-black uppercase tracking-widest text-white border-white/5 hover:bg-white/5 transition-all">
                <Share2 className="w-4 h-4" /> Share
             </button>
          </div>
        </div>

        {/* 2-Column Luxury Viewport */}
        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-16 items-start">
          
          {/* Left Column: Visual Storytelling */}
          <div className="space-y-8">
             <motion.div 
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               className="relative aspect-[4/3] rounded-[48px] overflow-hidden glass-strong border-white/10"
             >
                <img 
                  src={listing.mediaUrls[activeMedia]} 
                  alt={listing.title} 
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                
                {/* Visual Badge */}
                <div className="absolute top-8 left-8">
                  <span className="flex items-center gap-2 px-5 py-2 rounded-2xl glass-violet text-[#CDFF00] font-black text-[10px] uppercase tracking-widest border-white/10">
                    <Zap className="w-4 h-4 fill-[#CDFF00]" /> {typeInfo.label}
                  </span>
                </div>
             </motion.div>

             {/* Media Thumbnails */}
             <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                {listing.mediaUrls.map((url, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveMedia(i)}
                    className={`w-24 h-24 rounded-2xl overflow-hidden shrink-0 transition-all duration-300 ${
                       activeMedia === i ? 'ring-2 ring-[#CDFF00] scale-105' : 'opacity-40 grayscale hover:opacity-100 hover:grayscale-0'
                    }`}
                  >
                    <img src={url} alt="Variant" className="w-full h-full object-cover" />
                  </button>
                ))}
             </div>
          </div>

          {/* Right Column: Information & Action Hub */}
          <div className="flex flex-col gap-10">
             
             {/* Title & Metadata */}
             <div>
                <motion.h1 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-5xl sm:text-6xl font-black text-white mb-6 uppercase tracking-tighter leading-tight"
                >
                  {listing.title}
                </motion.h1>
                
                <div className="flex flex-wrap items-center gap-6">
                   <div className="flex items-center gap-2 bg-[#CDFF00] text-black px-3 py-1 rounded-xl text-sm font-black">
                      <Star className="w-4 h-4 fill-black" /> {listing.avgRating}
                   </div>
                   <div className="flex items-center gap-2 text-gray-500 text-[10px] font-black uppercase tracking-widest">
                      <MapPin className="w-4 h-4 text-[#CDFF00]" /> {listing.locationCity}
                   </div>
                   {listing.sellerVerified && (
                      <div className="flex items-center gap-2 text-[#A855F7] text-[10px] font-black uppercase tracking-widest">
                         <ShieldCheck className="w-4 h-4" /> Trusted Merchant
                      </div>
                   )}
                </div>
             </div>

             {/* Price Focus Area */}
             <div className="p-10 rounded-[40px] glass-strong border-white/10 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-40 h-40 bg-violet-600/10 blur-[80px]" />
                <div className="relative z-10">
                   <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2 block">Acquisition Value</span>
                   <div className="flex items-baseline gap-3 mb-8">
                      <span className="text-6xl font-black text-white tracking-widest">
                        {formatPrice(listing.price, listing.currency)}
                      </span>
                      {listing.negotiable && (
                        <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 bg-white/5 border border-white/10 text-[#CDFF00] rounded-lg">Negotiable</span>
                      )}
                   </div>

                   <button 
                     className="w-full py-5 rounded-3xl bg-[#CDFF00] text-black font-black text-xs uppercase tracking-[0.2em] shadow-[0_15px_35px_rgba(205,255,0,0.3)] hover:scale-[1.02] transition-transform active:scale-95 flex items-center justify-center gap-3 group"
                   >
                     Initiate Negotiation <ShoppingCart className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                   </button>
                </div>
             </div>

             {/* Description & Narrative */}
             <div>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-[#CDFF00] mb-4 opacity-40">Narrative</h4>
                <p className="text-lg text-gray-300 leading-relaxed font-medium font-body opacity-90">
                  {listing.description}
                </p>
             </div>

             {/* Seller Profile Summary */}
             <div className="pt-10 border-t border-white/5">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-6">Store Integrity</h4>
                <div className="flex items-center gap-5 p-6 rounded-3xl glass-violet border-white/10 hover:border-white/20 transition-all cursor-pointer group">
                   <div className="w-16 h-16 rounded-[24px] bg-gray-800 flex items-center justify-center text-2xl font-black text-[#CDFF00] border border-white/10">
                      {listing.sellerName[0]}
                   </div>
                   <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                         <h5 className="text-lg font-black text-white uppercase tracking-tight group-hover:text-[#CDFF00] transition-colors">{listing.sellerName}</h5>
                         {listing.sellerVerified && <BadgeCheck className="w-4.5 h-4.5 text-[#CDFF00]" />}
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Professional Seller • 142 Vouchers</span>
                   </div>
                   <div className="w-12 h-12 rounded-2xl glass-strong flex items-center justify-center group-hover:bg-[#CDFF00]/10">
                      <MessageSquare className="w-5 h-5 text-white group-hover:text-[#CDFF00]" />
                   </div>
                </div>
             </div>

          </div>
        </div>
      </div>
    </div>
  );
}
