import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSelector } from 'react-redux';
import { selectUser, selectIsAuthenticated } from '../store/authSlice';
import { datingApi } from '../api/client';
import { Heart, X, Sparkles, Filter, Image as ImageIcon, MapPin } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export default function Dating() {
  const user = useSelector(selectUser);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const navigate = useNavigate();
  
  const [profile, setProfile] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Setup form states
  const [showSetup, setShowSetup] = useState(false);
  const [form, setForm] = useState({
    fullName: user?.fullName || '',
    bio: '',
    age: '',
    gender: 'MALE',
    preferredGender: 'ANY',
    lookingFor: 'Dating',
    location: ''
  });
  const [image, setImage] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return; }
    loadData();
  }, [isAuthenticated, navigate]);

  const loadData = async () => {
    setLoading(true);
    try {
      try {
        const myProfile = await datingApi.me();
        setProfile(myProfile.data);
      } catch (e) {
        setShowSetup(true); // Don't have a profile yet
      }
      const allProfiles = await datingApi.getProfiles();
      setProfiles(allProfiles.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSetup = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    Object.keys(form).forEach(k => formData.append(k, form[k]));
    if (image) formData.append('image', image);
    
    try {
      const res = await datingApi.saveProfile(formData);
      setProfile(res.data);
      setShowSetup(false);
      loadData();
    } catch (e) {
      alert("Failed to save profile");
    }
  };

  const handleSwipe = (direction, id) => {
    // direction is 'left' or 'right'
    setProfiles((prev) => prev.filter(p => p.id !== id));
    // In a real app we would call a "like" or "pass" endpoint here
  };

  if (loading) return <div className="text-center py-20 animate-pulse text-[#CDFF00] font-black uppercase tracking-widest mt-20">Loading...</div>;

  if (showSetup) {
    return (
      <div className="max-w-xl mx-auto px-4 py-10 mt-10">
        <div className="text-center mb-8">
          <Heart className="w-12 h-12 mx-auto text-rose-500 mb-4" />
          <h1 className="text-3xl font-heading font-black text-white uppercase tracking-tight">HustleMates</h1>
          <p className="text-gray-400 font-bold uppercase tracking-widest text-xs mt-2">Set up your dating & networking profile</p>
        </div>
        <form onSubmit={handleSetup} className="glass border border-white/5 rounded-3xl p-8 space-y-6">
          <div>
            <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Display Name</label>
            <input type="text" value={form.fullName} onChange={e=>setForm({...form, fullName: e.target.value})} required className="w-full px-5 py-4 rounded-xl bg-black border border-white/10 text-white outline-none font-bold focus:border-[#CDFF00]" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Age</label>
              <input type="number" value={form.age} onChange={e=>setForm({...form, age: e.target.value})} required className="w-full px-5 py-4 rounded-xl bg-black border border-white/10 text-white outline-none font-bold focus:border-[#CDFF00]" />
            </div>
            <div>
              <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Location</label>
              <input type="text" value={form.location} onChange={e=>setForm({...form, location: e.target.value})} required className="w-full px-5 py-4 rounded-xl bg-black border border-white/10 text-white outline-none font-bold focus:border-[#CDFF00]" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">I am</label>
              <select value={form.gender} onChange={e=>setForm({...form, gender: e.target.value})} className="w-full px-4 py-4 rounded-xl bg-black border border-white/10 text-white font-bold outline-none focus:border-[#CDFF00]">
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Interested In</label>
              <select value={form.preferredGender} onChange={e=>setForm({...form, preferredGender: e.target.value})} className="w-full px-4 py-4 rounded-xl bg-black border border-white/10 text-white font-bold outline-none focus:border-[#CDFF00]">
                <option value="MALE">Men</option>
                <option value="FEMALE">Women</option>
                <option value="ANY">Anyone</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Looking For</label>
            <select value={form.lookingFor} onChange={e=>setForm({...form, lookingFor: e.target.value})} className="w-full px-4 py-4 rounded-xl bg-black border border-white/10 text-white font-bold outline-none focus:border-[#CDFF00]">
              <option value="Dating">Dating</option>
              <option value="Networking">Networking</option>
              <option value="Friends">Friends</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Bio</label>
            <textarea value={form.bio} onChange={e=>setForm({...form, bio: e.target.value})} rows="3" className="w-full px-5 py-4 rounded-xl bg-black border border-white/10 text-white outline-none font-medium focus:border-[#CDFF00] resize-none" placeholder="A little about yourself..."></textarea>
          </div>
          <div>
            <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Profile Photo (Optional)</label>
            <label className="block w-full p-4 rounded-xl border-2 border-dashed border-white/20 text-center cursor-pointer hover:border-[#CDFF00] transition-colors">
              <ImageIcon className="w-6 h-6 mx-auto text-gray-500 mb-1" />
              <input type="file" className="hidden" accept="image/*" onChange={e=>setImage(e.target.files[0])} />
              {image ? <span className="text-[#CDFF00] text-xs font-bold">{image.name}</span> : <span className="text-gray-400 text-xs">Upload Image</span>}
            </label>
          </div>
          <button type="submit" className="w-full py-4 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 text-white font-black uppercase tracking-widest shadow-lg hover:shadow-rose-500/20 transition-all text-xs">
            Join HustleMates
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center py-10 overflow-hidden relative mt-10">
      
      {/* Background elements */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl" />
      
      <div className="z-10 w-full max-w-sm mb-6 flex justify-between items-center px-4">
        <div>
          <h1 className="text-2xl font-heading font-black text-white uppercase tracking-tight flex items-center gap-2">
            Hustle<span className="text-rose-500">Mates</span>
          </h1>
        </div>
        <button onClick={() => setShowSetup(true)} className="w-10 h-10 rounded-full glass flex items-center justify-center hover:bg-white/10 transition-colors">
          <Filter className="w-5 h-5 text-gray-400" />
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
                <div className="w-full h-full bg-black border border-white/10 rounded-3xl overflow-hidden shadow-2xl relative block group">
                  {p.imageUrl ? (
                    <img src={p.imageUrl} className="w-full h-[70%] object-cover" alt={p.fullName} />
                  ) : (
                    <div className="w-full h-[70%] bg-gradient-to-br from-rose-500/20 to-pink-500/20 flex justify-center items-center">
                      <Sparkles className="w-20 h-20 text-rose-500/40" />
                    </div>
                  )}
                  
                  <div className="absolute top-0 left-0 right-0 p-6 bg-gradient-to-b from-black/80 to-transparent">
                    <span className="px-3 py-1 bg-white/20 backdrop-blur text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow">
                      Looking for {p.lookingFor}
                    </span>
                  </div>

                  <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black via-black/80 to-transparent p-6 flex flex-col justify-end">
                    <h2 className="text-3xl font-heading font-black text-white flex items-center gap-3">
                      {p.fullName}, {p.age}
                    </h2>
                    {p.location && (
                      <p className="text-[#CDFF00] font-bold uppercase tracking-widest text-[10px] flex items-center gap-1 mt-2">
                        <MapPin className="w-3.5 h-3.5" /> {p.location}
                      </p>
                    )}
                    <p className="text-gray-300 font-medium text-sm mt-3 line-clamp-3 leading-relaxed">
                      {p.bio || "No bio provided"}
                    </p>
                  </div>
                </div>

                {/* Controls */}
                <div className="absolute bottom-10 left-0 right-0 flex justify-center gap-6 z-20">
                  <button 
                    onClick={() => { p.swipeDir = 'left'; handleSwipe('left', p.id); }}
                    className="w-16 h-16 bg-black border-2 border-white/10 rounded-full flex items-center justify-center text-gray-400 hover:border-gray-400 hover:bg-white/10 transition-all shadow-lg hover:scale-110"
                  >
                    <X className="w-8 h-8" />
                  </button>
                  <button 
                    onClick={() => { p.swipeDir = 'right'; handleSwipe('right', p.id); }}
                    className="w-16 h-16 bg-gradient-to-r from-rose-500 to-pink-500 rounded-full flex items-center justify-center text-white hover:shadow-[0_0_30px_rgba(244,63,94,0.3)] transition-all shadow-lg hover:scale-110"
                  >
                    <Heart className="w-8 h-8 fill-current" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center glass rounded-3xl border border-white/5">
            <Sparkles className="w-16 h-16 text-gray-600 mb-6" />
            <h3 className="text-2xl font-black text-white uppercase tracking-wider mb-2">No more profiles</h3>
            <p className="text-gray-500 font-bold uppercase tracking-widest text-xs text-center max-w-[200px]">We've run out of potential matches in your area.</p>
          </div>
        )}
      </div>
    </div>
  );
}
