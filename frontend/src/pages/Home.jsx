import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowRight, Users, Store, Zap, ChevronLeft, ChevronRight, 
  UserPlus, UserCheck, ShieldCheck, MapPin, Newspaper, Check,
  Mail, MessageSquare, Send
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectIsAuthenticated, selectUser } from '../store/authSlice';
import { usersApi } from '../api/client';
import HeroBrief from '../components/HeroBrief';

// Fallback images
const HERO_BG = "https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=1600&q=80";
const USER_CARD_FALLBACK = "https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?w=400&q=80";
const LISTING_FALLBACK_IMAGE = "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&q=60";

const heroFanItems = [
  { rotate: -15, x: -320, zIndex: 10, image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&q=80", handle: "creativ_mind" },
  { rotate: -8, x: -160, zIndex: 20, image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&q=80", handle: "dev_hustle" },
  { rotate: 0, x: 0, zIndex: 30, image: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=500&q=80", handle: "market_pro" },
  { rotate: 8, x: 160, zIndex: 20, image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=500&q=80", handle: "social_guru" },
  { rotate: 15, x: 320, zIndex: 10, image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500&q=80", handle: "fit_coach" },
];

export default function Home() {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const currentUser = useSelector(selectUser);
  const [topUsers, setTopUsers] = useState([]);
  const [userPageIndex, setUserPageIndex] = useState(0);
  const [followedIds, setFollowedIds] = useState(new Set());

  useEffect(() => {
    usersApi.getAll().then(r => setTopUsers(r.data)).catch(() => {});
  }, []);

  const nextUsers = () => {
    if ((userPageIndex + 1) * 2 < topUsers.length) setUserPageIndex(i => i + 1);
    else setUserPageIndex(0);
  };
  const previousUsers = () => {
    if (userPageIndex > 0) setUserPageIndex(i => i - 1);
    else setUserPageIndex(Math.floor((topUsers.length - 1) / 2));
  };

  const toggleFollow = (id) => {
    setFollowedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const visibleUsers = topUsers.slice(userPageIndex * 2, userPageIndex * 2 + 2);

  return (
    <div className="bg-[#050505] min-h-screen">
      
      {/* ── HERO ── THE DIGITAL COMMAND CENTER ── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden pt-20 perspective-1000">

        {/* Global Cinematic Background */}
        <div className="absolute inset-0 z-0">
          <motion.img
            initial={{ scale: 1.1 }}
            animate={{ scale: 1 }}
            transition={{ duration: 15, repeat: Infinity, repeatType: "reverse" }}
            src="https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1600&q=80"
            alt=""
            className="w-full h-full object-cover object-center opacity-30 grayscale contrast-125"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#050505] via-transparent to-[#050505]" />
          <div className="absolute inset-0 bg-[#050505]/60 backdrop-blur-[3px]" />
        </div>

        {/* Floating Profile Orbs — Drift Logic */}
        <div className="absolute inset-0 z-10 overflow-hidden pointer-events-none opacity-40">
          {heroFanItems.map((item, i) => (
            <motion.div
              key={i}
              initial={{ x: item.x * 2, y: 100, opacity: 0 }}
              animate={{ 
                x: [item.x * 1.5, item.x * 1.6, item.x * 1.5],
                y: [20 * (i % 2 ? 1 : -1), -20 * (i % 2 ? 1 : -1), 20 * (i % 2 ? 1 : -1)],
                opacity: 0.15
              }}
              transition={{ 
                duration: 12 + i * 3, 
                repeat: Infinity, 
                ease: "easeInOut",
                opacity: { duration: 1.5, delay: i * 0.2 }
              }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 sm:w-56 sm:h-56 rounded-full border border-white/5 p-2"
            >
              <div className="w-full h-full rounded-full overflow-hidden grayscale brightness-50">
                <img src={item.image} alt="" className="w-full h-full object-cover" />
              </div>
            </motion.div>
          ))}
        </div>

        {/* Main Glass Marketplace Hub */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-30 w-full max-w-5xl mx-auto px-6"
        >
          <div className="glass border border-white/10 rounded-[3rem] p-12 md:p-20 flex flex-col items-center text-center shadow-[0_40px_100px_rgba(0,0,0,0.9)] backdrop-blur-3xl overflow-hidden">
            
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-3 px-6 py-2 rounded-full text-[10px] sm:text-[11px] font-black uppercase tracking-[0.4em] text-white/40 border border-white/10 bg-white/5 mb-10 shadow-2xl"
            >
              <Store className="w-4 h-4" /> Global Commerce Layer
            </motion.div>

            <h1 className="text-5xl sm:text-7xl md:text-[5.5rem] font-black text-white uppercase tracking-tighter leading-[0.85] mb-10">
              HUSTLEUP<br />
              <span className="text-white/30">MARKETPLACE.</span>
            </h1>

            <p className="text-base sm:text-lg text-gray-500 font-bold max-w-2xl mb-14 leading-relaxed uppercase tracking-widest opacity-80">
              The premium destination for the modern professional. <br className="hidden md:block" /> 
              Scale your vision on the world's most elite exchange.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 w-full">
              <Link
                to="/explore"
                className="w-full sm:w-auto flex items-center justify-center gap-3 px-12 py-5 rounded-2xl bg-[#CDFF00] text-black font-black text-[11px] uppercase tracking-[0.2em] hover:scale-105 active:scale-95 transition-all shadow-[0_20px_40px_rgba(205,255,0,0.15)] group"
              >
                <Store className="w-5 h-5 group-hover:rotate-12 transition-transform" /> Enter the Vault
              </Link>
              <Link
                to={isAuthenticated ? "/feed" : "/register"}
                className="w-full sm:w-auto flex items-center justify-center gap-3 px-12 py-5 rounded-2xl bg-white/5 border border-white/10 text-white font-black text-[11px] uppercase tracking-[0.2em] hover:bg-white/10 hover:scale-105 active:scale-95 transition-all backdrop-blur-xl"
              >
                <Users className="w-5 h-5" /> Active Flow
              </Link>
            </div>

            {/* Micro Stats Bar */}
            <div className="hidden md:flex items-center gap-12 mt-20 pt-10 border-t border-white/5 w-full justify-center">
              <div className="flex flex-col items-center">
                <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Global Node</span>
                <span className="text-white font-black text-xs uppercase tracking-tight">Active</span>
              </div>
              <div className="w-px h-8 bg-white/5" />
              <div className="flex flex-col items-center">
                <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Sync Status</span>
                <span className="text-[#CDFF00] font-black text-xs uppercase tracking-tight">100% Secure</span>
              </div>
              <div className="w-px h-8 bg-white/5" />
              <div className="flex flex-col items-center">
                <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Community</span>
                <span className="text-white font-black text-xs uppercase tracking-tight">12.4K</span>
              </div>
            </div>

          </div>
        </motion.div>

        {/* Massive Ambient Background Overlay */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[1200px] bg-[#CDFF00]/5 rounded-full blur-[180px] pointer-events-none" />
      </section>

      {/* ── TOP SELLERS SECTION ── */}
      <section className="py-32" id="artists">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col items-center text-center mb-24">
             <span className="text-[#CDFF00] font-black uppercase tracking-[0.4em] text-xs mb-6 inline-block bg-[#CDFF00]/5 px-6 py-2 rounded-full border border-[#CDFF00]/10">Top Tier Market</span>
             <h2 className="text-5xl sm:text-7xl font-black text-white uppercase tracking-tighter leading-tight">
               Elite <span className="text-[#CDFF00]">Hustlers.</span>
             </h2>
             <p className="text-lg text-gray-500 mt-6 max-w-xl font-bold uppercase tracking-tight opacity-70">Meet the high-impact makers who are building the backbone of the HustleUp ecosystem.</p>
             
             <div className="flex gap-4 mt-12">
                <button onClick={previousUsers} className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white hover:bg-[#CDFF00] hover:text-black transition-all">
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button onClick={nextUsers} className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white hover:bg-[#CDFF00] hover:text-black transition-all">
                  <ChevronRight className="w-6 h-6" />
                </button>
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <AnimatePresence mode="wait">
              {visibleUsers.map((user, i) => user && (
                <motion.div
                  key={user.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="glass-card rounded-[3rem] h-[580px] flex flex-col relative group overflow-hidden border border-white/10 shadow-2xl"
                >
                  <div className="absolute inset-0 w-full h-full">
                    <img src={user.avatarUrl || USER_CARD_FALLBACK} alt="" className="w-full h-full object-cover p-2 rounded-[3.2rem]" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent p-2 rounded-[3.1rem]" />
                  </div>
                  
                  <div className="mt-auto p-10 z-10 flex flex-col items-center">
                     <div className="w-24 h-24 rounded-[32px] border-4 border-[#050505] bg-gray-900 overflow-hidden shadow-2xl mb-6 ring-2 ring-[#CDFF00]/20">
                        <img src={user.avatarUrl || USER_CARD_FALLBACK} alt="" className="w-full h-full object-cover" />
                     </div>
                     <div className="text-center">
                        <div className="flex items-center justify-center gap-2">
                           <h4 className="text-3xl font-black text-white uppercase tracking-tighter">{user.fullName}</h4>
                           {user.verified && <ShieldCheck className="w-5 h-5 text-[#CDFF00]" />}
                        </div>
                        <p className="text-sm font-black text-[#CDFF00] uppercase tracking-[0.3em] mt-2">@{user.fullName?.split(' ')[0].toLowerCase()}</p>
                     </div>
                     <p className="text-[14px] text-gray-400 mt-6 text-center line-clamp-2 font-black uppercase tracking-tight opacity-80 max-w-[80%]">
                        {user.bio || "Crafting premium experiences and building high-impact services for the community."}
                     </p>

                     <div className="w-full flex gap-4 mt-10">
                       <Link to={`/profile/${user.id}`} className="flex-1 py-4 rounded-2xl bg-white/5 border border-white/10 text-white text-[11px] font-black uppercase tracking-widest text-center hover:bg-white/10 transition-all">Profile</Link>
                       {isAuthenticated && String(user.id) !== String(currentUser?.id) && (
                         <button onClick={() => toggleFollow(user.id)} className={`flex-1 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${followedIds.has(user.id) ? 'bg-white/10 text-gray-400 border border-white/10' : 'bg-[#CDFF00] text-black shadow-lg shadow-[#CDFF00]/10'}`}>
                           {followedIds.has(user.id) ? 'Following' : 'Connect'}
                         </button>
                       )}
                     </div>
                   </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </section>

      {/* ── COMMUNITY PULSE ── */}
      <section className="py-32 border-t border-white/5" id="community-pulse">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col items-center text-center mb-24">
            <span className="text-[#CDFF00] font-black uppercase tracking-[0.4em] text-xs mb-6 inline-block bg-[#CDFF00]/5 px-6 py-2 rounded-full border border-[#CDFF00]/10">Hub Synergy</span>
            <h2 className="text-5xl sm:text-7xl font-black text-white uppercase tracking-tighter leading-tight">
              Community <span className="text-[#CDFF00]">Pulse.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                tag: "REGULATION", tagColor: "bg-orange-500/10 text-orange-400 border-orange-500/20",
                city: "Lagos, NG", title: "New TRC regulations for digital creators effective next month.",
                date: "Oct 24, 2026"
              },
              {
                tag: "EVENT", tagColor: "bg-[#CDFF00]/10 text-[#CDFF00] border-[#CDFF00]/20",
                city: "Nairobi, KE", title: "Global Diaspora Hustle Meetup at iHub Nairobi.",
                date: "Nov 02, 2026"
              },
              {
                tag: "OPPORTUNITY", tagColor: "bg-purple-500/10 text-purple-400 border-purple-500/20",
                city: "Harare, ZW", title: "City Council opens $1M grant for youth marketplaces.",
                date: "Oct 28, 2026"
              }
            ].map((news, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="glass border border-white/10 rounded-[3rem] p-10 hover:border-[#CDFF00]/30 transition-all group flex flex-col h-full bg-white/[0.02]"
              >
                <div className="flex items-center justify-between mb-8">
                  <span className={`px-4 py-1.5 rounded-full text-[9px] font-black tracking-widest border ${news.tagColor}`}>
                    {news.tag}
                  </span>
                  <span className="flex items-center gap-2 text-gray-500 text-[10px] font-black uppercase tracking-widest">
                    <MapPin className="w-3.5 h-3.5 text-[#CDFF00]" /> {news.city}
                  </span>
                </div>
                <h4 className="text-2xl font-black text-white mb-8 group-hover:text-[#CDFF00] transition-colors leading-tight uppercase tracking-tight">
                  {news.title}
                </h4>
                <div className="mt-auto flex items-center justify-between pt-8 border-t border-white/5">
                  <span className="text-gray-600 text-[10px] font-black uppercase tracking-widest">{news.date}</span>
                  <Link to="/news" className="text-white font-black text-[10px] uppercase tracking-[0.2em] group-hover:text-[#CDFF00] transition-all flex items-center gap-2">
                    Signal <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-20 flex justify-center">
            <Link to="/news" className="px-12 py-5 rounded-full bg-white/5 border border-white/10 text-white font-black text-[10px] uppercase tracking-[0.3em] hover:bg-[#CDFF00] hover:text-black transition-all shadow-2xl">
              Enter the Signal Hub
            </Link>
          </div>
        </div>
      </section>

      {/* ── JOIN THE SYNDICATE (SUBSCRIBE) ── */}
      <section className="py-32 relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-[#CDFF00]/5 rounded-full blur-[120px] pointer-events-none" />
        
        <div className="max-w-4xl mx-auto px-6">
          <div className="glass border border-white/10 rounded-[3.5rem] p-12 text-center relative z-10 overflow-hidden bg-white/[0.02]">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#CDFF00]/40 to-transparent" />
            
            <Zap className="w-10 h-10 text-[#CDFF00] mx-auto mb-8 animate-pulse" />
            <h2 className="text-4xl sm:text-5xl font-black text-white uppercase tracking-tighter leading-tight mb-6">
              Join the <span className="text-[#CDFF00]">Syndicate.</span>
            </h2>
            <p className="text-gray-400 font-bold uppercase tracking-widest text-xs mb-10 opacity-70">
              Get the latest alpha, exclusive drops, and market insights delivered straight to your terminal.
            </p>
            
            <form className="flex flex-col sm:flex-row gap-4 max-w-xl mx-auto" onSubmit={(e) => e.preventDefault()}>
              <input 
                type="email" 
                placeholder="ENTER YOUR EMAIL..." 
                className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white text-xs font-black uppercase tracking-widest focus:border-[#CDFF00] outline-none transition-all placeholder:text-gray-700"
              />
              <button className="px-10 py-4 rounded-2xl bg-[#CDFF00] text-black font-black text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-[0_15px_30px_rgba(205,255,0,0.2)]">
                JOIN NOW
              </button>
            </form>
            
            <p className="mt-8 text-[9px] text-gray-600 font-black uppercase tracking-[0.3em]">No spam. Only high-value signals. Unsubscribe anytime.</p>
          </div>
        </div>
      </section>

      {/* ── REACH OUT (CONTACT) ── */}
      <section className="py-32 border-t border-white/5" id="contact">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-[1fr_1.2fr] gap-20 items-start">
            
            <div className="flex flex-col">
              <span className="text-[#CDFF00] font-black uppercase tracking-[0.4em] text-xs mb-6 inline-block bg-[#CDFF00]/5 px-6 py-2 rounded-full border border-[#CDFF00]/10 w-fit">Direct Line</span>
              <h2 className="text-5xl sm:text-7xl font-black text-white uppercase tracking-tighter leading-tight mb-8">
                Reach <br /> Out.
              </h2>
              <p className="text-gray-400 text-lg font-bold uppercase tracking-tight mb-12 opacity-80 leading-relaxed">
                Have a proposal, an inquiry, or just want to sync with the syndicate? We're always listening to the pulse.
              </p>
              
              <div className="space-y-6">
                <div className="flex items-center gap-6 p-6 rounded-3xl bg-white/5 border border-white/10 group hover:border-[#CDFF00]/30 transition-all cursor-pointer">
                  <div className="w-12 h-12 rounded-2xl bg-black flex items-center justify-center text-[#CDFF00] group-hover:bg-[#CDFF00] group-hover:text-black transition-all">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">Email</p>
                    <p className="text-white font-black uppercase tracking-tight">syndicate@hustleup.com</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-6 p-6 rounded-3xl bg-white/5 border border-white/10 group hover:border-[#CDFF00]/30 transition-all cursor-pointer">
                  <div className="w-12 h-12 rounded-2xl bg-black flex items-center justify-center text-[#CDFF00] group-hover:bg-[#CDFF00] group-hover:text-black transition-all">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">Discord</p>
                    <p className="text-white font-black uppercase tracking-tight">HustleUp Syndicate</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="glass border border-white/10 rounded-[3.5rem] p-10 bg-white/[0.01]">
              <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest ml-4">Full Name</label>
                    <input type="text" placeholder="YOUR NAME" className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white text-xs font-black uppercase tracking-widest focus:border-[#CDFF00] outline-none transition-all placeholder:text-gray-800" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest ml-4">Email Address</label>
                    <input type="email" placeholder="YOUR EMAIL" className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white text-xs font-black uppercase tracking-widest focus:border-[#CDFF00] outline-none transition-all placeholder:text-gray-800" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest ml-4">Subject</label>
                  <input type="text" placeholder="WHAT'S ON YOUR MIND?" className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white text-xs font-black uppercase tracking-widest focus:border-[#CDFF00] outline-none transition-all placeholder:text-gray-800" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest ml-4">Message</label>
                  <textarea rows={5} placeholder="SEND YOUR SIGNAL..." className="w-full bg-white/5 border border-white/10 rounded-[2rem] px-6 py-6 text-white text-xs font-black uppercase tracking-widest focus:border-[#CDFF00] outline-none transition-all placeholder:text-gray-800 resize-none" />
                </div>
                <button className="w-full py-5 rounded-2xl bg-white/5 border border-white/10 text-white font-black text-xs uppercase tracking-[0.3em] flex items-center justify-center gap-3 hover:bg-[#CDFF00] hover:text-black hover:border-transparent transition-all shadow-xl group">
                  Send Signal <Send className="w-4 h-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                </button>
              </form>
            </div>

          </div>
        </div>
      </section>

      {/* ── FOOTER STYLE END ── */}
      <footer className="py-20 border-t border-white/5 text-center">
        <p className="text-gray-600 font-black text-[10px] uppercase tracking-[0.5em]">&copy; 2026 HUSTLEUP DIGITAL SYNDICATE</p>
      </footer>
    </div>
  );
}

