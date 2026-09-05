import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Star, MapPin, ArrowUpRight, ShieldCheck, Package, ClipboardList } from 'lucide-react';
import { displayCity } from '../utils/constants';
import SmartImage from './SmartImage';
import { uploadUrl } from '../config';

export default function ShopCard({ shop, index = 0 }) {
  // The three thumbnails used to be gift emojis, which said nothing about the shop.
  // Real product photos preview what's actually inside before anyone taps through.
  const products = shop.products || [];
  const previews = products.slice(0, 3);
  const remaining = Math.max((shop.productCount ?? products.length) - previews.length, 0);
  // Shops are addressable by their readable slug; the UUID is the fallback.
  const href = `/shop/${shop.slug || shop.id}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ delay: Math.min(index * 0.06, 0.35), duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -6 }}
      className="h-full"
    >
      <Link
        to={href}
        className="group flex flex-col h-full relative rounded-3xl overflow-hidden bg-[#0A0A0A] border border-white/10 hover:border-[#CDFF00]/50 transition-colors duration-300 shadow-[0_4px_16px_rgba(0,0,0,0.5)] hover:shadow-[0_16px_40px_rgba(0,0,0,0.7)]"
        id={`shop-card-${shop.id}`}
      >
        {/* Accent glow keyed to the colour the seller picked, so a row of shops reads as
            distinct hubs rather than one repeated template. */}
        <div
          className="absolute -top-24 -right-24 w-48 h-48 rounded-full blur-[80px] opacity-20 group-hover:opacity-45 transition-opacity duration-700 pointer-events-none"
          style={{ background: shop.accentColor || '#CDFF00' }}
        />

        {/* ── Cover ── */}
        <div className="relative h-44 shrink-0 overflow-hidden bg-black">
          <SmartImage
            src={uploadUrl(shop.bannerUrl)}
            alt={shop.name}
            fallbackIcon={Package}
            className="w-full h-full object-cover scale-105 group-hover:scale-110 transition-transform duration-700 ease-out"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/25 to-transparent" />

          {/* Top badges */}
          <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 pr-12">
            {shop.category && (
              <span className="px-2.5 py-1 rounded-full text-[9px] font-black tracking-widest bg-black/75 backdrop-blur-md text-white border border-white/20">
                {shop.category}
              </span>
            )}
            {shop.rating >= 4.8 && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black tracking-widest bg-[#CDFF00] text-black">
                <ShieldCheck className="w-3 h-3" /> Top rated
              </span>
            )}
          </div>

          {/* Hover affordance — tells you the whole card is a link */}
          <div className="absolute top-3 right-3 w-9 h-9 rounded-xl bg-[#CDFF00] text-black flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300">
            <ArrowUpRight className="w-5 h-5" />
          </div>

          {/* Name sits on the image so the body below is all substance */}
          <div className="absolute bottom-3 left-4 right-4">
            <h3 className="text-xl font-black text-white tracking-tight leading-tight line-clamp-1 group-hover:text-[#CDFF00] transition-colors duration-300">
              {shop.name}
            </h3>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex flex-col flex-1 p-4">
          {/* Stat strip — all three are platform-derived, so they're trustworthy in a way
              seller-written copy isn't. */}
          <div className="flex items-center gap-3 mb-3 text-[10px] font-bold tracking-wider text-gray-400">
            <span className="flex items-center gap-1 text-white">
              <Star className="w-3.5 h-3.5 fill-[#CDFF00] text-[#CDFF00]" />
              {shop.rating > 0 ? shop.rating.toFixed(1) : 'New'}
            </span>
            <span className="w-px h-3 bg-white/10" />
            <span className="flex items-center gap-1">
              <Package className="w-3.5 h-3.5 text-[#FF00FF]" /> {shop.productCount ?? products.length}
            </span>
            {shop.listingCount > 0 && (
              <>
                <span className="w-px h-3 bg-white/10" />
                <span className="flex items-center gap-1">
                  <ClipboardList className="w-3.5 h-3.5 text-[#00FFFF]" /> {shop.listingCount}
                </span>
              </>
            )}
          </div>

          <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed mb-4 min-h-[2rem]">
            {shop.tagline || `${shop.name} on HustleSpace.`}
          </p>

          {/* Product preview strip + city, pinned to the bottom so cards align in a grid */}
          <div className="mt-auto flex items-center justify-between gap-3 pt-3 border-t border-white/5">
            <span className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-gray-400 min-w-0">
              <MapPin className="w-3.5 h-3.5 text-[#CDFF00] shrink-0" />
              <span className="truncate">{displayCity(shop.city)}</span>
            </span>

            <div className="flex items-center -space-x-2 shrink-0">
              {previews.map((p) => (
                <div
                  key={p.id}
                  className="w-8 h-8 rounded-full overflow-hidden border-2 border-[#0A0A0A] bg-black group-hover:-space-x-1 transition-all"
                  title={p.name}
                >
                  <SmartImage src={p.imageUrl} alt={p.name} fallbackIcon={Package} className="w-full h-full object-cover" />
                </div>
              ))}
              {remaining > 0 && (
                <div className="w-8 h-8 rounded-full border-2 border-[#0A0A0A] bg-white/10 flex items-center justify-center text-[9px] font-black text-white">
                  +{remaining}
                </div>
              )}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
