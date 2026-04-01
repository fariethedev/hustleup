import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { useSelector } from 'react-redux';
import { SHOPS } from '../utils/shopData';
import { LISTING_TYPES } from '../utils/constants';
import { listingsApi, usersApi } from '../api/client';
import ShopCard from '../components/ShopCard';
import ListingCard from '../components/ListingCard';
import { Sparkles, ArrowRight, TrendingUp, Store, Users, ChevronLeft, ChevronRight, MapPin, BadgeCheck, Briefcase, Plus, Image as ImageIcon, Camera, Globe, Award, DollarSign, Mail, Heart, Zap, ShieldCheck } from 'lucide-react';
import { selectIsAuthenticated } from '../store/authSlice';

const USER_CARD_FALLBACK = 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=1600&q=80';

const getUserLabel = (user) => {
  if (user.role === 'SELLER' && (user.activeListingsCount > 0 || user.followersCount > 0)) {
    return 'Hustler';
  }

  if (user.role === 'SELLER') {
    return 'Seller';
  }

  return 'Random Buyer';
};

export default function Home() {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const containerRef = useRef(null);
  const { scrollY } = useScroll();
  const y1 = useTransform(scrollY, [0, 500], [0, 200]);
  const y2 = useTransform(scrollY, [0, 500], [0, -150]);
  const opacityHero = useTransform(scrollY, [0, 300], [1, 0]);

  const [featuredListings, setFeaturedListings] = useState([]);
  const [loadingListings, setLoadingListings] = useState(true);
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [visibleCards, setVisibleCards] = useState(3);

  useEffect(() => {
    if (!isAuthenticated) {
      setFeaturedListings([]);
      setLoadingListings(false);
      return;
    }

    listingsApi.browse({})
      .then((res) => {
        // Filter out drafts or inactive, just take the first 3
        setFeaturedListings(res.data.slice(0, 3));
      })
      .catch((err) => console.error('Failed to load listings', err))
      .finally(() => setLoadingListings(false));
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      setUsers([]);
      setLoadingUsers(false);
      return;
    }

    usersApi.getAll()
      .then((res) => setUsers(res.data || []))
      .catch((err) => console.error('Failed to load users', err))
      .finally(() => setLoadingUsers(false));
  }, [isAuthenticated]);

  useEffect(() => {
    const updateVisibleCards = () => {
      if (window.innerWidth < 768) {
        setVisibleCards(1);
        return;
      }

      if (window.innerWidth < 1200) {
        setVisibleCards(2);
        return;
      }

      setVisibleCards(3);
    };

    updateVisibleCards();
    window.addEventListener('resize', updateVisibleCards);
    return () => window.removeEventListener('resize', updateVisibleCards);
  }, []);

  useEffect(() => {
    if (users.length <= visibleCards) return;

    const interval = window.setInterval(() => {
      setCarouselIndex((current) => (current + 1) % users.length);
    }, 4500);

    return () => window.clearInterval(interval);
  }, [users.length, visibleCards]);

  useEffect(() => {
    if (users.length === 0) {
      setCarouselIndex(0);
      return;
    }

    setCarouselIndex((current) => current % users.length);
  }, [users.length]);

  const nextUsers = () => {
    if (!users.length) return;
    setCarouselIndex((current) => (current + 1) % users.length);
  };

  const previousUsers = () => {
    if (!users.length) return;
    setCarouselIndex((current) => (current - 1 + users.length) % users.length);
  };

  const visibleUsers = users.length <= visibleCards
    ? users
    : Array.from({ length: visibleCards }, (_, offset) => users[(carouselIndex + offset) % users.length]);

  return (
    <div className="relative">
      {/* Background Ambient Glows */}
      <div className="ambient-glow ambient-glow-purple top-[-10%] left-[-10%]" />
      <div className="ambient-glow ambient-glow-lime top-[20%] right-[-10%]" />
      <div className="ambient-glow ambient-glow-purple bottom-[10%] left-[20%]" />

      {/* Hero Section Split Layout */}
      <section className="relative min-h-[90vh] flex items-center pt-10" id="hero">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
          {/* Left Side: Content */}
          <div className="lg:w-1/2 flex flex-col text-left">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
            >
              <h1 className="text-6xl sm:text-7xl lg:text-8xl font-heading font-extrabold leading-[1.05] mb-8 tracking-tighter">
                Discover <br />
                <span className="text-white">Premium</span> and <br />
                <span className="text-gradient-brand">Unique Services.</span>
              </h1>
              
              <p className="text-lg sm:text-xl text-gray-400 max-w-xl mb-12 leading-relaxed">
                HustleUp is your go-to marketplace for independent creators, professional services, and high-quality products. Join our community and elevate your hustle today.
              </p>

              <div className="flex flex-wrap gap-5">
                <Link
                  to="/explore"
                  className="px-10 py-5 rounded-[1.2rem] bg-[#D3FF37] text-black font-extrabold text-lg hover:scale-105 active:scale-95 transition-all shadow-xl shadow-[#D3FF37]/20"
                >
                  Get Started
                </Link>
                <Link
                  to="/dashboard"
                  className="px-10 py-5 rounded-[1.2rem] glass border border-white/10 text-white font-bold text-lg hover:bg-white/5 active:scale-95 transition-all flex items-center gap-2"
                >
                  Learn More <ArrowRight className="w-5 h-5" />
                </Link>
              </div>

              {/* Stats Bar Integrated */}
              <div className="mt-20 flex flex-wrap gap-12 sm:gap-20">
                <div>
                  <h4 className="text-4xl font-extrabold text-white mb-1">15k+</h4>
                  <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Services</p>
                </div>
                <div>
                  <h4 className="text-4xl font-extrabold text-white mb-1">2.4k+</h4>
                  <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Shops</p>
                </div>
                <div>
                  <h4 className="text-4xl font-extrabold text-white mb-1">12k+</h4>
                  <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Hustlers</p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Right Side: Primary Image Card */}
          <div className="lg:w-1/2 relative w-full aspect-[4/5] lg:aspect-square flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-full h-full rounded-[3.5rem] overflow-hidden group shadow-2xl border border-white/10 bg-gray-900"
            >
              <img 
                src="https://images.unsplash.com/photo-1556761175-b413da4baf72?w=1600&q=80" 
                alt="Main Feature" 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000" 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60" />
              
              {/* Overlaid Card Info */}
              <div className="absolute bottom-10 left-10 right-10 translate-y-4 group-hover:translate-y-0 transition-all duration-500">
                <div className="glass-card rounded-[2.5rem] p-8 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex -space-x-3 overflow-hidden">
                      {[1, 2, 3, 4].map(i => (
                        <img 
                          key={i}
                          className="inline-block h-10 w-10 rounded-full ring-2 ring-black bg-gray-800" 
                          src={`https://i.pravatar.cc/100?u=${i}`} 
                          alt="" 
                        />
                      ))}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Starting From</p>
                    <p className="text-2xl font-black text-white">$45.00</p>
                  </div>
                </div>
              </div>
            </motion.div>
            
            {/* Background Blob Glow for Hero */}
            <div className="absolute -z-10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-[radial-gradient(circle,rgba(211,255,55,0.1)_0%,transparent_70%)]" />
          </div>
        </div>
      </section>

      {/* Hot Trending Section */}
      <section className="py-32" id="trending">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row items-center gap-16 lg:gap-24">
            {/* Grid of Images */}
            <div className="lg:w-1/2 grid grid-cols-2 gap-6 w-full">
               <motion.div 
                 initial={{ opacity: 0, y: 20 }}
                 whileInView={{ opacity: 1, y: 0 }}
                 viewport={{ once: true }}
                 className="aspect-[4/5] rounded-[3.5rem] overflow-hidden border border-white/5 bg-gray-900 group"
               >
                 <img src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800&q=80" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="Trending 1" />
               </motion.div>
               <motion.div 
                 initial={{ opacity: 0, y: 20 }}
                 whileInView={{ opacity: 1, y: 0 }}
                 viewport={{ once: true, delay: 0.1 }}
                 className="aspect-[4/5] rounded-[3.5rem] overflow-hidden border border-white/5 bg-gray-900 group mt-10"
               >
                 <img src="https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=800&q=80" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="Trending 2" />
               </motion.div>
               <motion.div 
                 initial={{ opacity: 0, y: 20 }}
                 whileInView={{ opacity: 1, y: 0 }}
                 viewport={{ once: true, delay: 0.2 }}
                 className="aspect-[4/5] rounded-[3.5rem] overflow-hidden border border-white/5 bg-gray-900 group"
               >
                 <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="Trending 3" />
               </motion.div>
               <motion.div 
                 initial={{ opacity: 0, y: 20 }}
                 whileInView={{ opacity: 1, y: 0 }}
                 viewport={{ once: true, delay: 0.3 }}
                 className="aspect-[4/5] rounded-[3.5rem] overflow-hidden border border-white/5 bg-gray-900 group mt-10"
               >
                 <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&q=80" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="Trending 4" />
               </motion.div>
            </div>

            {/* Content Left */}
            <div className="lg:w-1/2 flex flex-col text-left">
              <span className="text-[#D3FF37] font-black uppercase tracking-[0.4em] text-xs mb-6">Popular Item</span>
              <h2 className="text-5xl sm:text-7xl font-heading font-extrabold text-white mb-8 leading-[1.1]">
                Hot Trending <br /> On This <br /> Week.
              </h2>
              <p className="text-xl text-gray-500 leading-relaxed mb-10 max-w-lg">
                Discover the most popular shops and top-rated services trending this week. Our community-driven marketplace highlights the best of the best.
              </p>
              <Link to="/explore" className="flex items-center gap-3 text-white font-bold text-lg hover:text-[#D3FF37] transition-colors group">
                See all <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Top List Artist Section */}
      <section className="py-32 bg-gradient-to-b from-black to-[#050505]" id="artists">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row items-end justify-between mb-20 gap-10">
            <div className="text-left">
               <span className="text-[#D3FF37] font-black uppercase tracking-[0.4em] text-xs mb-6 inline-block">Hustlers</span>
               <h2 className="text-5xl sm:text-7xl font-heading font-extrabold text-white leading-tight">
                 Top List <br /> Sellers.
               </h2>
               <p className="text-xl text-gray-500 mt-6 max-w-md">Meet the dedicated individuals who bring their expertise and passion to our platform.</p>
            </div>
            <div className="flex gap-4">
              <button onClick={previousUsers} className="w-14 h-14 rounded-full border border-white/10 flex items-center justify-center text-white hover:bg-white/5 active:scale-95 transition-all">
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button onClick={nextUsers} className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white hover:bg-[#D3FF37] hover:text-black active:scale-95 transition-all">
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-10">
            <AnimatePresence mode="wait">
              {visibleUsers.slice(0, 2).map((user, i) => user && (
                <motion.div
                  key={user.id}
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ delay: i * 0.1 }}
                  className="glass-card rounded-[3.5rem] p-4 flex flex-col relative group"
                >
                  <div className="relative h-[280px] w-full rounded-[3rem] overflow-hidden bg-gray-900 shadow-inner">
                    <img src={user.avatarUrl || USER_CARD_FALLBACK} alt="Service Preview" className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-700" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                  </div>
                  
                  {/* Floating Artist Info Card Overlay */}
                  <div className="absolute top-[200px] left-1/2 -translate-x-1/2 w-[85%] glass rounded-[2.5rem] p-6 shadow-2xl flex flex-col items-center border border-white/10">
                     <div className="w-20 h-20 rounded-full border-4 border-black bg-gray-800 overflow-hidden absolute top-[-40px] shadow-2xl">
                        <img src={user.avatarUrl || USER_CARD_FALLBACK} alt={user.fullName} className="w-full h-full object-cover" />
                     </div>
                     <div className="mt-10 text-center">
                        <h4 className="text-2xl font-black text-white">{user.fullName}</h4>
                        <p className="text-sm font-bold text-gray-500 uppercase tracking-widest mt-1">@{user.fullName?.split(' ')[0].toLowerCase()}</p>
                     </div>
                     <div className="w-full h-[100px] mt-6 rounded-[1.5rem] overflow-hidden bg-black/40">
                        <img src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&q=80" alt="Preview" className="w-full h-full object-cover opacity-50" />
                     </div>
                  </div>
                  
                  <div className="h-[200px]" /> {/* Spacer for overlap */}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </section>

      {/* Featured Shops & Partners */}
      <section className="py-20 border-y border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
           <div className="flex flex-wrap items-center justify-between gap-12 opacity-40 grayscale hover:grayscale-0 transition-all duration-700">
              <span className="flex items-center gap-2 font-black text-2xl tracking-tighter"><ShieldCheck className="w-8 h-8" /> STRIPE</span>
              <span className="flex items-center gap-2 font-black text-2xl tracking-tighter"><Globe className="w-8 h-8" /> WORLDWIDE</span>
              <span className="flex items-center gap-2 font-black text-2xl tracking-tighter"><ImageIcon className="w-8 h-8" /> QUALITY TOOLS</span>
              <span className="flex items-center gap-2 font-black text-2xl tracking-tighter"><Zap className="w-8 h-8" /> FAST DELIVERY</span>
           </div>
        </div>
      </section>

      {/* Newsletter Section */}
      <section className="py-40">
        <div className="max-w-3xl mx-auto px-4 text-center">
           <motion.div
             initial={{ opacity: 0, y: 30 }}
             whileInView={{ opacity: 1, y: 0 }}
             viewport={{ once: true }}
           >
             <h2 className="text-6xl sm:text-7xl font-heading font-extrabold text-white mb-10 leading-[1.05]">
               Subscribe to Get <br /> Fresh News Update <br /> About HustleUp.
             </h2>
             <div className="relative mt-12 max-w-xl mx-auto">
                <input 
                  type="email" 
                  placeholder="Enter your email address" 
                  className="w-full bg-gray-900 border border-white/10 rounded-full px-10 py-6 text-white text-lg focus:outline-none focus:border-[#D3FF37] transition-colors"
                />
                <button className="absolute right-2 top-2 bottom-2 px-10 rounded-full bg-[#D3FF37] text-black font-black text-sm uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-[#D3FF37]/20">
                  Subscribe
                </button>
             </div>
           </motion.div>
        </div>
      </section>

      {/* Remove duplicate footer from here, already in App.jsx */}
    </div>
  );
}
