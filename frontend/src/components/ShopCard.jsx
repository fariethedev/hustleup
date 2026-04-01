import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Star, MapPin, ArrowUpRight, ShieldCheck } from 'lucide-react';

export default function ShopCard({ shop, index = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.5, ease: 'easeOut' }}
    >
      <Link
        to={`/shop/${shop.id}`}
        className="group block relative rounded-[2.5rem] overflow-hidden glass-card border border-white/10 transition-all duration-500 hover:shadow-premium hover:-translate-y-2"
        id={`shop-card-${shop.id}`}
      >
        {/* Background Accent Glow */}
        <div 
          className="absolute -top-24 -right-24 w-48 h-48 rounded-full blur-[80px] opacity-20 group-hover:opacity-40 transition-opacity duration-700" 
          style={{ background: shop.accentColor }}
        />

        {/* Image Section */}
        <div className="relative h-64 overflow-hidden">
          <img
            src={shop.image}
            alt={shop.name}
            className="w-full h-full object-cover scale-105 group-hover:scale-115 transition-transform duration-1000 ease-out"
          />
          
          {/* Immersive Gradient Overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-80" />
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-transparent to-black/40" />

          {/* Top Badges */}
          <div className="absolute top-5 left-5 flex flex-col gap-2">
            <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest glass-lime text-white border-white/20">
              {shop.category}
            </span>
            {shop.rating >= 4.8 && (
              <span className="flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-[#D3FF37] text-black">
                <ShieldCheck className="w-3 h-3" /> Top Rated
              </span>
            )}
          </div>

          {/* Action Icon */}
          <div className="absolute top-5 right-5 w-10 h-10 rounded-2xl glass-lime flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-500">
            <ArrowUpRight className="w-5 h-5 text-white" />
          </div>

          {/* Bottom Info Overlay */}
          <div className="absolute bottom-5 left-5 right-5">
            <div className="flex items-center gap-2 mb-1">
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md border border-white/10">
                <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                <span className="text-xs font-bold text-white">{shop.rating}</span>
              </div>
              <span className="text-[10px] font-bold text-white/60 tracking-wider uppercase">{shop.reviewCount} Reviews</span>
            </div>
            <h3 className="text-2xl font-black text-white tracking-tight leading-none group-hover:text-[#D3FF37] transition-colors duration-300">
              {shop.name}
            </h3>
          </div>
        </div>

        {/* Footer Details */}
        <div className="p-6 bg-gradient-to-b from-transparent to-black/40">
          <p className="text-sm text-gray-400 line-clamp-2 mb-5 font-medium leading-relaxed italic">
            "{shop.tagline}"
          </p>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-500">
              <MapPin className="w-3.5 h-3.5 text-[#D3FF37]" />
              <span className="text-xs font-bold uppercase tracking-tighter">{shop.location}</span>
            </div>
            <div className="flex -space-x-2">
              {/* Mock product avatars or icons */}
              {[1,2,3].map(i => (
                <div key={i} className="w-7 h-7 rounded-full border-2 border-black bg-gray-800 flex items-center justify-center text-[10px]">
                  🎁
                </div>
              ))}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
