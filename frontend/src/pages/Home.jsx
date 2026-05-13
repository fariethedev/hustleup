import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  ArrowRight, Store, Zap, ArrowUpRight, Sparkles, Tag,
  ShoppingBag, TrendingUp, Calendar, Star, MapPin
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectIsAuthenticated } from '../store/authSlice';
import { listingsApi } from '../api/client';

export default function Home() {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listingsApi.browse({}).then(r => {
      setListings(r.data?.slice(0, 8) || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const categories = [
    { icon: ShoppingBag, label: 'Fashion', color: 'from-[#FF00FF]/40 to-purple-600/40', border: 'border-[#FF00FF]/50' },
    { icon: Tag, label: 'Services', color: 'from-[#00FFFF]/40 to-blue-600/40', border: 'border-[#00FFFF]/50' },
    { icon: TrendingUp, label: 'Digital', color: 'from-[#CDFF00]/40 to-green-600/40', border: 'border-[#CDFF00]/50' },
    { icon: Calendar, label: 'Events', color: 'from-[#FF00FF]/40 to-orange-500/40', border: 'border-[#FF00FF]/50' },
    { icon: Star, label: 'Premium', color: 'from-[#00FFFF]/40 to-indigo-500/40', border: 'border-[#00FFFF]/50' },
    { icon: Store, label: 'Shops', color: 'from-[#CDFF00]/40 to-lime-500/40', border: 'border-[#CDFF00]/50' },
  ];

  return (
    <div className="bg-[#050505] min-h-screen font-sans">
      
      {/* ── HERO ── */}
      <section className="relative w-full overflow-hidden bg-[#0A0A0A] pt-16 md:pt-24 pb-20 md:pb-32 lg:min-h-[85vh] flex items-center">
        {/* Subtle Geometric Afro Pattern */}
        <div className="absolute inset-0 z-0 flex opacity-[0.15] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 10px 10px, #FF00FF 2px, transparent 0), radial-gradient(circle at 30px 30px, #00FFFF 2px, transparent 0)', backgroundSize: '40px 40px' }}>
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-[#FF00FF]/5 to-[#0A0A0A] z-0" />

        <div className="relative z-10 max-w-6xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center w-full">
          
          {/* Left */}
          <div className="flex flex-col">
            <motion.div
              initial={{ opacity: 0, scale: 0.8, rotate: -5 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ type: 'spring', bounce: 0.5, duration: 0.8 }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.3em] text-white border-2 border-[#FF00FF] bg-[#FF00FF]/20 mb-5 shadow-[0_0_15px_#FF00FF]">
                <Sparkles className="w-4 h-4 text-[#FF00FF]" /> CREATOR MARKETPLACE
              </div>
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-white leading-[1.05] uppercase tracking-tighter mb-4 drop-shadow-[4px_4px_0_#FF00FF]">
                Buy, Sell &<br />
                <span className="text-[#00FFFF] drop-shadow-[4px_4px_0_#CDFF00]">Elevate.</span>
              </h1>
              <p className="text-[#CDFF00] text-base font-bold max-w-md mb-6 leading-relaxed tracking-wider">
                The ultimate platform for modern creatives. List your brand, discover fresh talent, and connect with the movement.
              </p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', bounce: 0.4, duration: 0.8, delay: 0.2 }}
              className="flex items-center gap-4"
            >
              <Link 
                to="/explore" 
                className="px-8 py-4 rounded-full bg-[#FF00FF] text-white font-black text-[12px] uppercase tracking-widest hover:scale-110 hover:-rotate-2 transition-transform shadow-[0_0_20px_#FF00FF]"
              >
                DISCOVER
              </Link>
              <Link 
                to={isAuthenticated ? "/create" : "/register"} 
                className="px-8 py-4 rounded-full border-2 border-[#00FFFF] bg-transparent text-[#00FFFF] font-black text-[12px] uppercase tracking-widest hover:bg-[#00FFFF] hover:text-black hover:scale-110 hover:rotate-2 transition-all shadow-[0_0_15px_#00FFFF]"
              >
                JOIN THE MOVEMENT
              </Link>
            </motion.div>

            {/* Quick stats */}
            <motion.div 
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="flex items-center gap-6 mt-10 p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm w-max"
            >
              <div className="flex flex-col items-center">
                <span className="text-[#FF00FF] font-black text-xl drop-shadow-[1px_1px_0_#fff]">12.4K</span>
                <span className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">CREATIVES</span>
              </div>
              <div className="w-px h-10 bg-[#00FFFF]/30" />
              <div className="flex flex-col items-center">
                <span className="text-[#00FFFF] font-black text-xl drop-shadow-[1px_1px_0_#fff]">50K+</span>
                <span className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">PROJECTS</span>
              </div>
              <div className="w-px h-10 bg-[#FF00FF]/30" />
              <div className="flex flex-col items-center">
                <span className="text-[#CDFF00] font-black text-xl drop-shadow-[1px_1px_0_#fff]">98%</span>
                <span className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">SUCCESS</span>
              </div>
            </motion.div>
          </div>

          {/* Right — Hero Image */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.8, rotate: 5 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ type: 'spring', bounce: 0.5, duration: 1 }}
            className="relative perspective-1000 w-full"
          >
            <div className="relative overflow-hidden rounded-[2rem] border-4 border-[#FF00FF] shadow-[0_0_30px_#FF00FF] p-1 bg-black transform hover:rotate-y-12 hover:scale-105 transition-all duration-500 w-full">
              <img 
                src="/hero_afro.png" 
                alt="Youth Marketplace" 
                className="w-full aspect-[4/5] sm:aspect-square md:aspect-[4/5] object-cover rounded-3xl"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#FF00FF]/40 via-transparent to-transparent rounded-3xl pointer-events-none" />
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── CATEGORIES STRIP ── */}
      <section className="py-10 border-b border-[#FF00FF]/20 bg-gradient-to-r from-[#050505] via-[#FF00FF]/5 to-[#050505]">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
            {categories.map((cat, i) => (
              <motion.div
                key={i}
                whileHover={{ scale: 1.1, rotate: (i % 2 === 0 ? 3 : -3) }}
                whileTap={{ scale: 0.9 }}
              >
                <Link 
                  to={`/explore?type=${cat.label.toLowerCase()}`}
                  className={`flex flex-col items-center gap-3 p-5 rounded-[1.5rem] bg-gradient-to-br ${cat.color} border-2 ${cat.border} cursor-pointer group shadow-[0_4px_15px_rgba(0,0,0,0.5)]`}
                >
                  <cat.icon className="w-8 h-8 text-white group-hover:text-black transition-colors z-10" />
                  <span className="text-[11px] font-black text-white uppercase tracking-widest group-hover:text-black transition-colors z-10">{cat.label}</span>
                  <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-100 transition-opacity rounded-[1.3rem] -z-0"></div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURED LISTINGS ── */}
      <section className="py-20 relative">
        <div className="absolute left-0 top-1/4 w-64 h-64 bg-[#00FFFF]/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute right-0 bottom-1/4 w-64 h-64 bg-[#FF00FF]/10 rounded-full blur-[100px] pointer-events-none" />
        
        <div className="max-w-6xl mx-auto px-4 relative z-10">
          <div className="flex items-center justify-between mb-12">
            <div>
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-[#00FFFF] mb-2 block drop-shadow-[0_0_5px_#00FFFF]">Trending Projects</span>
              <h2 className="text-3xl sm:text-5xl font-black text-white uppercase tracking-tighter drop-shadow-[2px_2px_0_#FF00FF]">
                Fresh <span className="text-[#CDFF00]">Talent</span>
              </h2>
            </div>
            <motion.div whileHover={{ scale: 1.1 }}>
              <Link to="/explore" className="flex items-center gap-2 px-6 py-3 rounded-full border-2 border-[#FF00FF] bg-transparent text-[#FF00FF] text-[10px] font-black uppercase tracking-widest hover:bg-[#FF00FF] hover:text-white transition-all shadow-[0_0_10px_#FF00FF]">
                DISCOVER ALL <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="aspect-[3/4] rounded-3xl bg-white/5 border border-white/10 animate-pulse" />
              ))}
            </div>
          ) : listings.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {listings.slice(0, 8).map((listing, i) => (
                <motion.div
                  key={listing.id}
                  initial={{ opacity: 0, y: 50, rotateX: -20 }}
                  whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.6, delay: i * 0.1, type: "spring" }}
                  whileHover={{ y: -10 }}
                >
                  <Link 
                    to={`/listing/${listing.id}`}
                    className="group block rounded-[2rem] overflow-hidden border-2 border-[#00FFFF]/30 bg-[#0A0A0A] hover:border-[#00FFFF] transition-all shadow-[0_5px_15px_rgba(0,255,255,0.1)] hover:shadow-[0_10px_25px_rgba(0,255,255,0.3)]"
                  >
                    <div className="aspect-[3/4] overflow-hidden relative p-2">
                      <img 
                        src={listing.imageUrls?.[0] || listing.imageUrl || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&q=60'} 
                        alt={listing.title}
                        className="w-full h-full object-cover rounded-[1.5rem] group-hover:scale-110 transition-transform duration-700"
                      />
                      <div className="absolute inset-2 bg-gradient-to-t from-[#FF00FF]/80 via-transparent to-transparent rounded-[1.5rem]" />
                      {listing.negotiable && (
                        <span className="absolute top-4 left-4 px-3 py-1 rounded-full bg-[#CDFF00] text-black text-[9px] font-black uppercase shadow-[0_0_10px_#CDFF00]">OBO</span>
                      )}
                      <div className="absolute bottom-2 left-2 right-2 p-4 bg-black/60 backdrop-blur-md rounded-2xl border border-white/10">
                        <h4 className="text-sm font-black text-white truncate mb-1">{listing.title}</h4>
                        <div className="flex items-center justify-between">
                          <span className="text-[#00FFFF] font-black text-sm">${listing.price}</span>
                          <span className="text-[#FF00FF] text-[9px] font-black uppercase tracking-widest">{listing.type}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-24 rounded-[3rem] bg-gradient-to-b from-[#FF00FF]/10 to-transparent border-2 border-[#FF00FF]/20 border-dashed">
              <Store className="w-16 h-16 mx-auto text-[#FF00FF] mb-4 drop-shadow-[0_0_10px_#FF00FF]" />
              <p className="text-white text-lg font-black tracking-widest uppercase mb-6">Marketplace is Empty</p>
              <Link to="/create" className="inline-block px-8 py-3 rounded-full bg-[#00FFFF] text-black text-[12px] font-black uppercase shadow-[0_0_15px_#00FFFF] hover:scale-105 transition-transform">Create Listing</Link>
            </div>
          )}
        </div>
      </section>

      {/* ── HIGHLIGHT CARDS ── */}
      <section className="py-20 bg-gradient-to-b from-[#050505] to-[#110011]">
        <div className="max-w-6xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-8">
          
          <motion.div 
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            whileHover={{ scale: 1.05, rotate: -2 }}
            className="bg-gradient-to-br from-[#FF00FF] to-purple-600 rounded-[2.5rem] p-8 flex flex-col group shadow-[0_0_20px_#FF00FF] relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full blur-2xl pointer-events-none" />
            <div className="flex justify-between items-start mb-6 relative z-10">
              <span className="px-4 py-1.5 rounded-full border-2 border-white/30 bg-black/20 text-[10px] text-white font-black uppercase tracking-widest backdrop-blur-sm">
                Connect
              </span>
              <Link to="/explore" className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-[#FF00FF] group-hover:scale-110 transition-all shadow-lg">
                <ArrowUpRight className="w-4 h-4 font-black" />
              </Link>
            </div>
            <h3 className="text-2xl font-black text-white leading-tight tracking-tighter mb-6 relative z-10 drop-shadow-[2px_2px_0_rgba(0,0,0,0.5)]">
              Build your network with visionary creators.
            </h3>
            <div className="overflow-hidden rounded-[1.5rem] border-2 border-white/20 mt-auto relative z-10 bg-black">
              <img src="/card_afro_1.png" alt="Creative Network" className="w-full h-48 object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ delay: 0.1 }}
            whileHover={{ scale: 1.05 }}
            className="bg-gradient-to-br from-[#00FFFF] to-blue-500 rounded-[2.5rem] p-8 flex flex-col group shadow-[0_0_20px_#00FFFF] relative overflow-hidden mt-0 md:mt-10"
          >
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/30 rounded-full blur-2xl pointer-events-none" />
            <div className="flex justify-between items-start mb-6 relative z-10">
              <span className="px-4 py-1.5 rounded-full border-2 border-black/20 bg-white/30 text-[10px] text-black font-black uppercase tracking-widest backdrop-blur-sm">
                Innovate
              </span>
              <Link to="/explore" className="w-10 h-10 rounded-full bg-black flex items-center justify-center text-[#00FFFF] shadow-lg group-hover:scale-110 transition-all">
                <ArrowUpRight className="w-4 h-4 font-black" />
              </Link>
            </div>
            <h3 className="text-2xl font-black text-black leading-tight tracking-tighter mb-6 relative z-10 drop-shadow-[2px_2px_0_rgba(255,255,255,0.5)]">
              Launch your ideas to a global audience.
            </h3>
            <div className="overflow-hidden rounded-[1.5rem] border-2 border-black/20 mt-auto relative z-10 bg-black">
              <img src="/card_afro_2.png" alt="Innovation" className="w-full h-48 object-cover opacity-90 group-hover:opacity-100 group-hover:scale-110 transition-all duration-500" />
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ delay: 0.2 }}
            whileHover={{ scale: 1.05, rotate: 2 }}
            className="bg-gradient-to-br from-[#CDFF00] to-green-500 rounded-[2.5rem] p-8 flex flex-col group shadow-[0_0_20px_#CDFF00] relative overflow-hidden"
          >
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-white/30 rounded-full blur-3xl pointer-events-none" />
            <div className="flex justify-between items-start mb-6 relative z-10">
              <span className="px-4 py-1.5 rounded-full border-2 border-black/20 bg-white/30 text-[10px] text-black font-black uppercase tracking-widest backdrop-blur-sm">
                Create
              </span>
              <Link to="/feed" className="w-10 h-10 rounded-full bg-black flex items-center justify-center text-[#CDFF00] shadow-lg group-hover:scale-110 transition-all">
                <ArrowUpRight className="w-4 h-4 font-black" />
              </Link>
            </div>
            <h3 className="text-2xl font-black text-black leading-tight tracking-tighter mb-6 relative z-10 drop-shadow-[2px_2px_0_rgba(255,255,255,0.5)]">
              Showcase your unique aesthetic.
            </h3>
            <div className="overflow-hidden rounded-[1.5rem] border-2 border-black/20 mt-auto relative z-10 bg-black">
              <img src="/card_afro_3.png" alt="Creative Style" className="w-full h-48 object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── JOIN CTA ── */}
      <section className="py-24 relative overflow-hidden bg-[#050505]">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-gradient-to-r from-[#FF00FF]/20 to-[#00FFFF]/20 rounded-full blur-[100px] pointer-events-none" />
        <div className="max-w-4xl mx-auto px-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="border-4 border-[#FF00FF] rounded-[3rem] p-12 text-center relative z-10 bg-[#0A0A0A] shadow-[0_0_40px_rgba(255,0,255,0.2)]"
          >
            <Sparkles className="w-12 h-12 text-[#FF00FF] mx-auto mb-6 drop-shadow-[0_0_10px_#FF00FF] animate-pulse" />
            <h2 className="text-4xl sm:text-5xl font-black text-white uppercase tracking-tighter mb-4 drop-shadow-[3px_3px_0_#00FFFF]">
              Ready to <span className="text-[#00FFFF]">Create?</span>
            </h2>
            <p className="text-[#CDFF00] text-base font-bold mb-10 max-w-lg mx-auto tracking-widest uppercase">
              Join the movement and empower your journey.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
              <motion.div whileHover={{ scale: 1.1, rotate: -2 }}>
                <Link to={isAuthenticated ? "/create" : "/register"} className="px-10 py-4 rounded-full bg-[#00FFFF] text-black font-black text-[12px] uppercase tracking-widest shadow-[0_0_20px_#00FFFF] flex items-center gap-2">
                  <Zap className="w-4 h-4" /> {isAuthenticated ? 'START PROJECT' : 'GET STARTED'}
                </Link>
              </motion.div>
              <motion.div whileHover={{ scale: 1.1, rotate: 2 }}>
                <Link to="/explore" className="px-10 py-4 rounded-full border-2 border-[#FF00FF] bg-black text-[#FF00FF] font-black text-[12px] uppercase tracking-widest shadow-[0_0_20px_rgba(255,0,255,0.3)] hover:bg-[#FF00FF] hover:text-white transition-colors">
                  EXPLORE TALENT
                </Link>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="py-12 border-t-4 border-[#FF00FF]/20 text-center bg-[#050505]">
        <p className="text-[#00FFFF] font-black text-[10px] uppercase tracking-[0.5em] drop-shadow-[0_0_5px_#00FFFF]">&copy; 2026 HUSTLEUP HUB</p>
      </footer>
    </div>
  );
}
