import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { listingsApi } from '../api/client';
import { LISTING_TYPES } from '../utils/constants';
import ListingCard from '../components/ListingCard';
import { Sparkles, ArrowRight, ShieldCheck, Star } from 'lucide-react';

const PREMIUM_SHOPS = [
  { name: 'Elite Barber VIP', category: 'Hair & Beauty', rating: '5.0', location: 'Warszawa' },
  { name: 'Gourmet Bites Co.', category: 'Food & Catering', rating: '4.9', location: 'Kraków' },
  { name: 'SoundWave Studios', category: 'Events & Entertainment', rating: '4.8', location: 'Wrocław' },
  { name: 'Style House', category: 'Fashion & Clothing', rating: '4.9', location: 'Poznań' },
  { name: 'ProFix Repairs', category: 'Skills & Services', rating: '5.0', location: 'Gdańsk' },
  { name: 'Urban Threads', category: 'Fashion & Clothing', rating: '4.7', location: 'Łódź' },
];

export default function Home() {
  const [featured, setFeatured] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listingsApi.browse({}).then((r) => {
      setFeatured(r.data.slice(0, 6));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      {/* Hero Section */}
      <section className="relative min-h-[85vh] flex items-center overflow-hidden" id="hero">
        {/* Background effects */}
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#CDFF00]/10 rounded-full blur-3xl animate-float" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-white/5 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 mt-10">
          <div className="text-center max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold bg-[#CDFF00]/10 text-[#CDFF00] border border-[#CDFF00]/20 mb-6 uppercase tracking-wider">
                <Sparkles className="w-4 h-4" />
                A Marketplace For Go-Getters
              </span>
            </motion.div>

            <motion.h1
              className="text-5xl sm:text-7xl lg:text-8xl font-heading font-extrabold text-white leading-[1.1] tracking-tight mb-6 uppercase"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              Hustle <span className="text-[#CDFF00]">Up</span>
            </motion.h1>

            <motion.p
              className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              Buy, sell, trade, and connect with independent sellers, creators, and service providers.
              Everything you need, in one powerful platform.
            </motion.p>

            <motion.div
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <Link
                to="/explore"
                className="px-8 py-4 rounded-xl bg-[#CDFF00] text-black font-bold text-base hover:bg-[#E0FF4D] hover:shadow-2xl hover:shadow-[#CDFF00]/20 active:scale-95 transition-all flex items-center gap-2"
              >
                Explore Marketplace <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                to="/register"
                className="px-8 py-4 rounded-xl bg-white/5 border border-white/10 text-white font-semibold text-base hover:bg-white/10 hover:border-[#CDFF00]/30 active:scale-95 transition-all"
              >
                Start Selling
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Premium Shops Marquee Segment */}
      <section className="py-12 border-y border-white/5 bg-black/50 overflow-hidden relative">
        <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-black to-transparent z-10" />
        <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-black to-transparent z-10" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
          <h3 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#CDFF00]" />
            Featured Premium Shops
          </h3>
        </div>

        <div className="flex w-max animate-slide gap-6 hover:[animation-play-state:paused] px-6">
          {[...PREMIUM_SHOPS, ...PREMIUM_SHOPS].map((shop, i) => (
            <div key={i} className="w-72 glass-strong rounded-2xl p-5 border border-white/10 hover:border-[#CDFF00]/40 transition-colors flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold px-2 py-1 rounded bg-[#CDFF00]/10 text-[#CDFF00] uppercase">{shop.category}</span>
                <span className="flex items-center gap-1 text-sm text-white font-semibold"><Star className="w-3.5 h-3.5 text-[#CDFF00] fill-current" /> {shop.rating}</span>
              </div>
              <h4 className="text-lg font-bold text-white leading-tight">{shop.name}</h4>
              <p className="text-sm text-gray-500 mt-auto">{shop.location}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="py-24" id="categories">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="text-center mb-14"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl sm:text-4xl font-heading font-extrabold text-white mb-3 uppercase">
              Browse by Category
            </h2>
            <p className="text-gray-400 text-lg">Find exactly what you need</p>
          </motion.div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {LISTING_TYPES.map((type, i) => {
              const Icon = type.icon;
              return (
                <motion.div
                  key={type.value}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08, duration: 0.4 }}
                >
                  <Link
                    to={`/explore?type=${type.value}`}
                    className="group flex flex-col items-center gap-4 p-6 rounded-2xl glass hover:border-[#CDFF00]/40 hover:bg-white/5 transition-all duration-300 hover:-translate-y-1"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-black border border-white/10 flex items-center justify-center text-[#CDFF00] group-hover:bg-[#CDFF00] group-hover:text-black transition-all">
                      <Icon className="w-8 h-8" />
                    </div>
                    <span className="text-sm font-medium text-gray-300 text-center group-hover:text-white transition-colors">
                      {type.label}
                    </span>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Featured Listings */}
      <section className="py-24 border-t border-white/5" id="featured">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl sm:text-4xl font-heading font-extrabold text-white mb-2 uppercase">
                Fresh Listings
              </h2>
              <p className="text-gray-400">Discover the latest drops</p>
            </motion.div>
            <Link to="/explore" className="hidden sm:inline-flex items-center gap-1 text-[#CDFF00] font-semibold text-sm hover:text-white transition-colors">
              View all <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="rounded-2xl glass overflow-hidden animate-pulse border border-white/5">
                  <div className="h-48 bg-surface-50" />
                  <div className="p-4 space-y-3">
                    <div className="h-4 bg-surface-50 rounded w-3/4" />
                    <div className="h-3 bg-surface-50 rounded w-1/2" />
                    <div className="h-6 bg-surface-50 rounded w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : featured.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {featured.map((listing, i) => (
                <ListingCard key={listing.id} listing={listing} index={i} />
              ))}
            </div>
          ) : (
            <div className="text-center py-20 glass rounded-2xl">
              <Sparkles className="w-12 h-12 mx-auto text-gray-500 mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">Marketplace is Fresh</h3>
              <p className="text-gray-400 mb-6">Be the first to list something amazing!</p>
              <Link to="/register" className="inline-flex px-6 py-3 rounded-xl bg-[#CDFF00] text-black font-bold hover:bg-[#E0FF4D] transition-all">
                Start Selling
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="relative rounded-3xl overflow-hidden glass-strong border border-white/10"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="absolute inset-0 bg-[#CDFF00]/5" />
            <div className="relative text-center py-20 px-8">
              <h2 className="text-3xl sm:text-5xl font-heading font-extrabold text-white mb-4 leading-tight uppercase">
                Ready to Hustle?
              </h2>
              <p className="text-gray-300 text-lg max-w-xl mx-auto mb-8">
                Join thousands of independent sellers and buyers. Your next opportunity is one click away.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link to="/register" className="px-8 py-4 rounded-xl bg-[#CDFF00] text-black font-bold hover:bg-[#E0FF4D] active:scale-95 transition-all shadow-lg">
                  Create Account
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
