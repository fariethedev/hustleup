import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { useSelector } from 'react-redux';
import { SHOPS } from '../utils/shopData';
import { LISTING_TYPES } from '../utils/constants';
import { listingsApi, usersApi } from '../api/client';
import ShopCard from '../components/ShopCard';
import ListingCard from '../components/ListingCard';
import { Sparkles, ArrowRight, TrendingUp, Store, Users, ChevronLeft, ChevronRight, MapPin, BadgeCheck, Briefcase, Plus } from 'lucide-react';
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
    <div>
      <section className="relative h-screen flex items-center overflow-hidden bg-black" id="hero" ref={containerRef}>
        {/* Parallax Background Image */}
        <motion.div 
          className="absolute inset-0 pointer-events-none"
          style={{ y: y1 }}
        >
          <img 
            src="https://images.unsplash.com/photo-1556761175-b413da4baf72?w=1920&q=80" 
            alt="Hustle HD" 
            className="w-full h-full object-cover opacity-40 scale-110" 
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/20 to-transparent" />
        </motion.div>

        {/* Floating Decorative Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full glass bg-white/5 border border-white/10 blur-xl"
              style={{
                width: Math.random() * 300 + 100,
                height: Math.random() * 300 + 100,
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
              animate={{
                y: [0, Math.random() * 100 - 50, 0],
                x: [0, Math.random() * 100 - 50, 0],
                rotate: [0, 180, 360],
                scale: [1, 1.2, 1],
              }}
              transition={{
                duration: Math.random() * 20 + 20,
                repeat: Infinity,
                ease: "linear"
              }}
            />
          ))}
        </div>

        <motion.div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 w-full" style={{ opacity: opacityHero, y: y2 }}>
          <div className="text-center max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold glass bg-black/40 border border-white/10 text-white backdrop-blur-md border border-white/20 mb-6 uppercase tracking-wider shadow-sm">
                <Sparkles className="w-4 h-4 text-[#CDFF00]" />
                A Marketplace For Go-Getters
              </span>
            </motion.div>

            <motion.h1
              className="text-5xl sm:text-7xl lg:text-8xl font-heading font-extrabold leading-[1.1] tracking-tight mb-6"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              <span className="text-white">Hustle</span>{' '}
              <span className="text-gradient-brand">Up</span>
            </motion.h1>

            <motion.p
              className="text-lg sm:text-xl text-gray-300 max-w-2xl mx-auto mb-10 leading-relaxed drop-shadow"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              Discover amazing shops, buy unique products, and connect with independent sellers and creators.
              Everything you need, in one vibrant marketplace.
            </motion.p>

            <motion.div
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <a
                href="#shops"
                className="px-8 py-4 rounded-2xl bg-[#CDFF00] text-black font-extrabold text-base hover:bg-[#b8e600] hover:shadow-2xl hover:shadow-[#CDFF00]/20 active:scale-95 transition-all flex items-center gap-2"
              >
                <Store className="w-5 h-5" /> Browse Shops <ArrowRight className="w-5 h-5" />
              </a>
              <Link
                to="/register"
                className="px-8 py-4 rounded-2xl glass bg-black/40 border border-white/10 border-2 text-gray-100 font-bold text-base hover:bg-[#121212] hover:border-[#CDFF00] hover:text-white active:scale-95 transition-all"
              >
                Start Selling
              </Link>
            </motion.div>
          </div>
        </motion.div>
      </section>



      {/* Community Carousel (Vertical) */}
      <section className="py-24 bg-black overflow-hidden" id="community">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
          <div className="flex flex-col lg:flex-row items-center gap-16 min-h-[700px]">
            {/* Left side text */}
            <motion.div
              className="lg:w-1/2"
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-extrabold bg-[#CDFF00]/10 text-[#CDFF00] border border-[#CDFF00]/20 mb-8 uppercase tracking-[0.3em]">
                <Users className="w-4 h-4" /> The Community
              </span>
              <h2 className="text-5xl sm:text-7xl font-heading font-extrabold text-white mb-8 leading-[1.05]">
                Built by <br/> <span className="text-[#CDFF00]">People</span> like You
              </h2>
              <p className="text-xl text-gray-400 leading-relaxed mb-12 max-w-xl">
                Discover the independent spirits powering HustleUp. From artisan creators to savvy collectors, our community is the heartbeat of this marketplace.
              </p>
              
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={previousUsers}
                  className="w-10 h-10 rounded-full border border-white/20 text-white hover:border-[#CDFF00] hover:text-[#CDFF00] transition-all flex items-center justify-center disabled:opacity-20"
                  disabled={users.length <= 1}
                >
                  <ChevronLeft className="w-5 h-5 rotate-90" />
                </button>
                <button
                  type="button"
                  onClick={nextUsers}
                  className="w-10 h-10 rounded-full bg-[#CDFF00] text-black hover:bg-[#b8e600] transition-all flex items-center justify-center disabled:opacity-20"
                  disabled={users.length <= 1}
                >
                  <ChevronRight className="w-5 h-5 rotate-90" />
                </button>
                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-4">
                  {carouselIndex + 1} / {users.length} Candidates
                </span>
              </div>
            </motion.div>

            {/* Right side Vertical Carousel */}
            <div className="lg:w-1/2 relative w-full h-[650px] flex justify-center items-center">
              {loadingUsers ? (
                <div className="w-full max-w-[380px] h-[550px] rounded-[2.5rem] bg-gray-900 animate-pulse border border-white/5" />
              ) : users.length > 0 ? (
                <div className="relative w-full max-w-[400px] h-full flex flex-col items-center">
                  <AnimatePresence mode="popLayout">
                    {visibleUsers.slice(0, 1).map((user) => user && (
                      <motion.div
                        key={`${user.id}-${carouselIndex}`}
                        initial={{ opacity: 0, y: 160, rotateX: 45, scale: 0.8 }}
                        animate={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -160, rotateX: -45, scale: 0.8 }}
                        transition={{ 
                          type: "spring",
                          stiffness: 100,
                          damping: 20,
                          mass: 1
                        }}
                        className="absolute inset-0"
                        style={{ perspective: "1200px" }}
                      >
                        {/* Redesigned User Card based on reference */}
                        <div className="w-full h-full glass bg-black/40 border border-white/10 border border-white/5 rounded-[3rem] overflow-hidden shadow-2xl flex flex-col group">
                          {/* Image section */}
                          <div className="relative h-[72%] w-full overflow-hidden">
                            <img
                              src={user.avatarUrl || USER_CARD_FALLBACK}
                              alt={user.fullName}
                              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                            />
                            {/* Decorative badge in top left if needed? Not in ref image but we can keep role */}
                            <div className="absolute top-6 left-6">
                              <span className="px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-full text-[10px] font-black text-[#CDFF00] uppercase tracking-widest border border-[#CDFF00]/30 shadow-lg">
                                {getUserLabel(user)}
                              </span>
                            </div>
                          </div>

                          {/* Content section */}
                          <div className="flex-1 bg-white p-8 flex flex-col justify-between">
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <h3 className="text-2xl font-black text-black tracking-tight">{user.fullName}</h3>
                                <BadgeCheck className="w-5 h-5 text-green-500 fill-current" />
                              </div>
                              <p className="text-gray-500 text-sm font-medium leading-relaxed line-clamp-2">
                                {user.bio || "Professional designer and curator focused on high-end results and user satisfaction."}
                              </p>
                            </div>

                            <div className="flex items-center justify-between mt-6">
                              <div className="flex items-center gap-6">
                                <div className="flex items-center gap-2 text-black/80">
                                  <Users className="w-4 h-4 text-black/40" />
                                  <span className="text-sm font-bold">{user.followersCount || 0}</span>
                                </div>
                                <div className="flex items-center gap-2 text-black/80">
                                  <Briefcase className="w-4 h-4 text-black/40" />
                                  <span className="text-sm font-bold">{user.activeListingsCount || 0}</span>
                                </div>
                              </div>
                              
                              <Link 
                                to={`/profile/${user.id}`}
                                className="px-6 py-2.5 bg-gray-100 hover:bg-[#CDFF00] text-black font-extrabold text-xs rounded-full uppercase tracking-tighter transition-all shadow-sm flex items-center gap-2 active:scale-95"
                              >
                                Follow <Plus className="w-3.5 h-3.5" />
                              </Link>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="w-full max-w-[380px] h-[550px] rounded-[2.5rem] bg-gray-900/50 border border-white/5 flex items-center justify-center">
                   <p className="text-gray-600 font-bold uppercase tracking-widest text-xs">No users found</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>


      {/* Event Advertisement Banner */}
      <section className="py-12 bg-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="relative h-[400px] rounded-[3rem] overflow-hidden group shadow-2xl border border-white/10"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            {/* Background Image */}
            <div 
              className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 group-hover:scale-105"
              style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=1600&q=80")' }}
            />
            {/* Overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/40 to-transparent" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(205,255,0,0.3),transparent_60%)]" />

            {/* Content */}
            <div className="relative h-full flex flex-col justify-center p-12 md:p-20">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-black bg-[#CDFF00] text-black mb-6 uppercase tracking-[0.3em] self-start shadow-xl">
                Upcoming Event
              </span>
              <h2 className="text-5xl sm:text-7xl font-heading font-extrabold text-white mb-6 leading-none">
                FREEMAN <br/> <span className="text-[#CDFF00]">LIVE</span> 2026
              </h2>
              <p className="text-xl text-gray-200 font-medium mb-10 max-w-lg leading-relaxed">
                Experience the most anticipated concert of the season. Tickets are selling fast! Join the community for a night of pure energy.
              </p>
              <div className="flex flex-wrap gap-4">
                <button className="px-8 py-4 rounded-2xl bg-white text-black font-black text-sm uppercase tracking-widest hover:bg-[#CDFF00] transition-all shadow-xl active:scale-95">
                  Get Tickets
                </button>
                <button className="px-8 py-4 rounded-2xl glass bg-black/40 border border-white/10 text-white font-bold text-sm uppercase tracking-widest hover:bg-white/10 transition-all border border-white/20 active:scale-95">
                  Learn More
                </button>
              </div>
            </div>

            {/* Floating Banner Tag */}
            <div className="absolute top-10 right-10 -rotate-12 group-hover:rotate-0 transition-transform duration-500">
               <div className="bg-[#CDFF00] text-black px-6 py-3 rounded-2xl font-black text-xl uppercase tracking-tighter shadow-2xl border-4 border-black">
                 SOLD OUT!
               </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Featured Shops */}
      <section className="py-20" id="featured-shops">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="text-center mb-14"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl sm:text-5xl font-heading font-extrabold text-white mb-4">
              Featured Shops
            </h2>
            <p className="text-gray-400 text-lg max-w-xl mx-auto">
              Our hand-picked selection of top-tier businesses making waves this week.
            </p>
          </motion.div>

          <motion.div 
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={{
              visible: {
                transition: {
                  staggerChildren: 0.15
                }
              }
            }}
          >
            {SHOPS.slice(0, 3).map((shop, i) => (
              <motion.div
                key={shop.id}
                className="relative aspect-square rounded-[3rem] overflow-hidden group shadow-2xl border border-white/5"
                variants={{
                  hidden: { opacity: 0, y: 40, scale: 0.95 },
                  visible: { opacity: 1, y: 0, scale: 1 }
                }}
                transition={{ type: "spring", stiffness: 100, damping: 20 }}
                whileHover={{ y: -12, scale: 1.02 }}
              >
                <img src={shop.image} alt={shop.name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/50 to-transparent opacity-95 transition-opacity duration-300" />
                
                <div className="absolute inset-0 p-8 flex flex-col justify-end">
                  <div className="translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                    <span className="inline-block px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-white/90 text-xs font-bold mb-4 uppercase tracking-wider border border-white/20">
                      {shop.category}
                    </span>
                    <h3 className="text-3xl font-heading font-extrabold text-white mb-3">{shop.name}</h3>
                    <p className="text-gray-300 font-medium mb-6 line-clamp-2 text-sm md:text-base leading-relaxed">{shop.description}</p>
                    <Link
                      to={`/shop/${shop.id}`}
                      className="inline-flex items-center justify-center gap-2 w-full py-4 rounded-xl bg-white text-black hover:bg-[#CDFF00] font-extrabold transition-colors duration-300"
                    >
                      Visit Shop <ArrowRight className="w-5 h-5" />
                    </Link>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Featured Listings */}
      <section className="py-20" id="featured">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-end justify-between mb-14 gap-4">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl sm:text-4xl font-heading font-extrabold text-white mb-2">
                Featured User Listings
              </h2>
              <p className="text-gray-400 text-lg">Top rated services and products from our community.</p>
            </motion.div>
            <Link to="/explore" className="text-[#CDFF00] font-bold hover:text-[#CDFF00] flex items-center gap-2 transition-colors">
              View all <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {loadingListings ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-64 bg-[#121212] rounded-2xl animate-pulse border border-white/5" />
              ))}
            </div>
          ) : featuredListings.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {featuredListings.map((listing, i) => (
                <ListingCard key={listing.id} listing={listing} index={i} />
              ))}
            </div>
          ) : (
             <div className="text-center py-20 bg-[#121212] rounded-3xl border border-white/5">
                <p className="text-gray-500 font-bold">No active user listings yet.</p>
             </div>
          )}
        </div>
      </section>

      {/* Shop Directory */}
      <section className="py-20 bg-[#121212]" id="shops">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="text-center mb-14"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold glass bg-black/40 border border-white/10 text-[#CDFF00] border border-[#CDFF00] mb-4 uppercase tracking-wider shadow-sm">
              <TrendingUp className="w-3.5 h-3.5" /> Premium Curated
            </span>
            <h2 className="text-3xl sm:text-5xl font-heading font-extrabold text-white mb-3">
              Explore Our Shops
            </h2>
            <p className="text-gray-400 text-lg max-w-xl mx-auto">
              Each shop is unique — click to browse their products and find exactly what you need.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {SHOPS.map((shop, i) => (
              <ShopCard key={shop.id} shop={shop} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-20 glass bg-black/40 border border-white/10" id="categories">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="text-center mb-14"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl sm:text-4xl font-heading font-extrabold text-white mb-3">
              Browse by Category
            </h2>
            <p className="text-gray-400 text-lg">Find exactly what you need</p>
          </motion.div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {LISTING_TYPES.map((type, i) => {
              const Icon = type.icon;
              const colors = [
                { bg: '#FDF2F8', iconBg: '#EC4899', hover: '#EC4899' },
                { bg: '#FFFBEB', iconBg: '#F59E0B', hover: '#F59E0B' },
                { bg: '#F5F3FF', iconBg: '#8B5CF6', hover: '#8B5CF6' },
                { bg: '#FDF2F8', iconBg: '#EC4899', hover: '#EC4899' },
                { bg: '#EFF6FF', iconBg: '#3B82F6', hover: '#3B82F6' },
                { bg: '#F0FDFA', iconBg: '#14B8A6', hover: '#14B8A6' },
              ][i];
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
                    className="group flex flex-col items-center gap-4 p-6 rounded-2xl bg-[#121212] border border-white/5 hover:border-white/10 hover:shadow-lg hover:glass bg-black/40 border border-white/10 transition-all duration-300 hover:-translate-y-1"
                  >
                    <div
                      className="w-16 h-16 rounded-2xl flex items-center justify-center text-white transition-all group-hover:scale-110 shadow-sm"
                      style={{ background: colors.iconBg }}
                    >
                      <Icon className="w-8 h-8" />
                    </div>
                    <span className="text-sm font-semibold text-gray-600 text-center group-hover:text-white transition-colors">
                      {type.label}
                    </span>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="relative rounded-[2.5rem] overflow-hidden shadow-2xl shadow-[#CDFF00]/10"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="absolute inset-0 bg-[#CDFF00]" />
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, white 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
            <div className="relative text-center py-24 px-8">
              <h2 className="text-3xl sm:text-5xl font-heading font-extrabold text-black mb-4 leading-tight">
                Ready to Hustle?
              </h2>
              <p className="text-black/70 text-lg max-w-xl mx-auto mb-10 font-medium">
                Join thousands of independent sellers and buyers. Your next opportunity is one click away.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link to="/register" className="px-8 py-4 rounded-xl glass bg-black/40 border border-white/10 text-[#CDFF00] font-bold hover:bg-[#1E1E1E] active:scale-95 transition-all shadow-xl shadow-black/10">
                  Create Account
                </Link>
                <Link to="/explore" className="px-8 py-4 rounded-xl glass bg-black/40 border border-white/10 border border-white/20 text-white font-semibold hover:glass bg-black/40 border border-white/10 active:scale-95 transition-all">
                  Browse Marketplace
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
