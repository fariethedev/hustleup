import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Star, MapPin, ArrowUpRight } from 'lucide-react';

export default function ShopCard({ shop, index = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.5, ease: 'easeOut' }}
    >
      <Link
        to={`/shop/${shop.id}`}
        className="group block rounded-2xl overflow-hidden glass bg-black/40 border border-white/10 border border-white/5 hover:border-white/10 transition-all duration-400 hover:shadow-2xl hover:shadow-black/8 hover:-translate-y-2"
        id={`shop-card-${shop.id}`}
      >
        {/* Image */}
        <div className="relative h-52 overflow-hidden">
          <img
            src={shop.image}
            alt={shop.name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
          />
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
          
          {/* Category badge */}
          <div className="absolute top-4 left-4">
            <span
              className="px-3 py-1.5 rounded-full text-xs font-bold backdrop-blur-md border border-white/20 text-white"
              style={{ background: `${shop.accentColor}CC` }}
            >
              {shop.category}
            </span>
          </div>

          {/* Arrow icon on hover */}
          <div className="absolute top-4 right-4 w-9 h-9 rounded-full glass bg-black/40 border border-white/10 group-hover:glass bg-black/40 border border-white/10 flex items-center justify-center transition-all duration-300 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0">
            <ArrowUpRight className="w-4 h-4 text-gray-200" />
          </div>

          {/* Location */}
          <div className="absolute bottom-4 left-4 flex items-center gap-1.5 text-white/90 text-xs font-medium">
            <MapPin className="w-3.5 h-3.5" />
            {shop.location}
          </div>
        </div>

        {/* Content */}
        <div className="p-5">
          <div className="flex items-start justify-between gap-3 mb-2">
            <h3 className="text-lg font-heading font-bold text-white group-hover:text-gray-300 transition-colors leading-tight">
              {shop.name}
            </h3>
            <div className="flex items-center gap-1 shrink-0 px-2 py-1 rounded-lg" style={{ background: shop.accentBg }}>
              <Star className="w-3.5 h-3.5 fill-current" style={{ color: shop.accentColor }} />
              <span className="text-sm font-bold" style={{ color: shop.accentColor }}>{shop.rating}</span>
            </div>
          </div>
          
          <p className="text-sm text-gray-500 leading-relaxed line-clamp-2">
            {shop.tagline}
          </p>

          <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              {shop.products.length} Products
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider transition-colors" style={{ color: shop.accentColor }}>
              Visit Shop →
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
