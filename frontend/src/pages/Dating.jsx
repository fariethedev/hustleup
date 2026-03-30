import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSelector } from 'react-redux';
import { selectUser, selectIsAuthenticated } from '../store/authSlice';
import { datingApi } from '../api/client';
import { Heart, X, Sparkles, Filter, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=1920&q=80';

export default function Dating() {
  const user = useSelector(selectUser);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const navigate = useNavigate();
  
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return; }
    loadData();
  }, [isAuthenticated, navigate]);

  const loadData = async () => {
    setLoading(true);
    try {
      const allProfiles = await datingApi.getProfiles();
      setProfiles(allProfiles.data.filter(p => p.id !== user?.id));
    } catch (e) {
      console.error(e);
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSwipe = (direction, id) => {
    if (direction === 'right') {
      navigate(`/dm/${id}`);
    } else {
      setProfiles((prev) => prev.filter(p => p.id !== id));
    }
  };

  if (loading) return (
    <div className="min-h-[85vh] flex items-center justify-center">
      <div className="text-center animate-pulse text-[#CDFF00] font-bold uppercase tracking-widest text-sm">
        <Heart className="w-8 h-8 mx-auto mb-3 animate-bounce" /> Loading matches...
      </div>
    </div>
  );

  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center py-10 overflow-hidden relative">
      
      {/* Background elements */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#CDFF00]/50 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#CDFF00]/50 rounded-full blur-3xl pointer-events-none" />
      
      <div className="z-10 w-full max-w-sm mb-6 flex justify-between items-center px-4">
        <div>
          <h1 className="text-2xl font-heading font-extrabold text-white uppercase tracking-tight flex items-center gap-2">
            Hustle<span className="text-[#CDFF00]">Mates</span>
          </h1>
        </div>
        <button className="w-10 h-10 rounded-full glass bg-black/40 border border-white/10 border border-white/5 flex items-center justify-center hover:bg-[#121212] hover:shadow-md transition-all">
          <Filter className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      <div className="relative w-full max-w-sm h-[600px] z-10 px-4 flex flex-col items-center">
        {profiles.length > 0 ? (
          <AnimatePresence>
            {profiles.slice(0, 1).map((p) => (
              <motion.div
                key={p.id}
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ x: p.swipeDir === 'left' ? -300 : 300, opacity: 0, rotate: p.swipeDir === 'left' ? -20 : 20 }}
                className="absolute w-full px-4 h-full"
              >
                <div className="w-full h-full glass bg-black/40 border border-white/10 border border-white/5 rounded-3xl overflow-hidden shadow-2xl relative block group shadow-black/10">
                  <div className="w-full h-[70%] bg-[#121212]">
                    <img src={p.imageUrl || DEFAULT_AVATAR} className="w-full h-full object-cover" alt={p.fullName} />
                  </div>
                  
                  <div className="absolute top-0 left-0 right-0 p-6 bg-gradient-to-b from-gray-900/40 to-transparent">
                    <span className="px-3 py-1 glass bg-black/40 border border-white/10 text-gray-200 text-[10px] font-bold uppercase tracking-widest rounded-full shadow-sm">
                      Looking for {p.lookingFor || 'Friends'}
                    </span>
                  </div>

                  <div className="absolute bottom-0 left-0 right-0 h-[40%] glass bg-black/40 border border-white/10 p-6 flex flex-col justify-start">
                    <h2 className="text-3xl font-heading font-extrabold text-white flex items-center gap-3">
                      {p.fullName}, {p.age || '25'}
                    </h2>
                    {p.location && (
                      <p className="text-[#CDFF00] font-bold uppercase tracking-widest text-xs flex items-center gap-1 mt-1">
                        <MapPin className="w-3.5 h-3.5" /> {p.location}
                      </p>
                    )}
                    <p className="text-gray-500 font-medium text-sm mt-3 line-clamp-3 leading-relaxed">
                      {p.bio || "No bio provided"}
                    </p>
                  </div>
                </div>

                {/* Controls */}
                <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-6 z-20">
                  <button 
                    onClick={() => { p.swipeDir = 'left'; handleSwipe('left', p.id); }}
                    className="w-16 h-16 glass bg-black/40 border border-white/10 border border-white/5 rounded-full flex items-center justify-center text-gray-400 hover:text-[#CDFF00] hover:border-white/10 transition-all shadow-xl hover:scale-110 active:scale-95"
                  >
                    <X className="w-8 h-8" />
                  </button>
                  <button 
                    onClick={() => { p.swipeDir = 'right'; handleSwipe('right', p.id); }}
                    className="w-16 h-16 bg-[#CDFF00] rounded-full flex items-center justify-center text-white transition-all shadow-xl shadow-[#CDFF00]/30 hover:shadow-[#CDFF00]/50 hover:scale-110 active:scale-95"
                  >
                    <Heart className="w-8 h-8 fill-current" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center glass bg-black/40 border border-white/10 rounded-3xl border border-white/5 shadow-sm p-8">
            <Sparkles className="w-16 h-16 text-[#CDFF00] mb-6" />
            <h3 className="text-2xl font-heading font-extrabold text-white uppercase tracking-wide mb-2">No more profiles</h3>
            <p className="text-gray-500 font-bold uppercase tracking-widest text-xs text-center">We've run out of potential matches in your area.</p>
          </div>
        )}
      </div>
    </div>
  );
}
