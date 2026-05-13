import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSelector } from 'react-redux';
import { selectUser, selectIsAuthenticated } from '../store/authSlice';
import { datingApi, dispatchToast } from '../api/client';
import { Heart, X, Sparkles, MapPin, Briefcase, MessageCircle, User, Edit3, Camera, ChevronRight } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';

const getAvatar = (p) =>
  p?.imageUrl ||
  `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(p?.fullName || 'user')}`;

// ── Profile Setup Modal ─────────────────────────────────────────────────────
function ProfileSetupModal({ currentUser, existing, onClose, onSaved }) {
  const [bio, setBio] = useState(existing?.bio || '');
  const [age, setAge] = useState(existing?.age || '');
  const [location, setLocation] = useState(existing?.location || '');
  const [lookingFor, setLookingFor] = useState(existing?.lookingFor || 'Networking');
  const [gender, setGender] = useState(existing?.gender || '');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(existing?.imageUrl || currentUser?.avatarUrl || null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  const handleImage = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const fd = new FormData();
      if (bio) fd.append('bio', bio);
      if (age) fd.append('age', String(age));
      if (location) fd.append('location', location);
      if (lookingFor) fd.append('lookingFor', lookingFor);
      if (gender) fd.append('gender', gender);
      if (imageFile) fd.append('image', imageFile);
      await datingApi.saveProfile(fd);
      dispatchToast('Profile saved!', 'success');
      onSaved();
      onClose();
    } catch (e) {
      dispatchToast('Failed to save profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md bg-[#0A0A0A] border-2 border-[#00FFFF] rounded-[2.5rem] p-6 overflow-y-auto max-h-[90vh] shadow-[0_0_30px_rgba(0,255,255,0.2)]"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-black text-white uppercase tracking-widest drop-shadow-[2px_2px_0_#FF00FF]">Create Your Profile</h2>
          <button onClick={onClose} className="p-2 rounded-full bg-black border border-white/10 hover:border-[#FF00FF] hover:bg-[#FF00FF]/10 text-white transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Avatar */}
        <div className="flex justify-center mb-8">
          <div className="relative w-28 h-28 rounded-full overflow-hidden border-4 border-[#FF00FF] shadow-[0_0_15px_#FF00FF] bg-black">
            <img src={imagePreview || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser?.id}`} className="w-full h-full object-cover" alt="" />
            <button onClick={() => fileRef.current?.click()} className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
              <Camera className="w-6 h-6 text-[#00FFFF] mb-1" />
              <span className="text-[8px] font-black uppercase text-[#00FFFF]">UPLOAD</span>
            </button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImage} />
        </div>

        <div className="space-y-5">
          <div>
            <label className="text-[10px] font-black text-[#00FFFF] uppercase tracking-widest mb-2 block">Your Vibe (Bio)</label>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder="Tell us about yourself..."
              className="w-full bg-black border-2 border-white/10 rounded-2xl px-4 py-4 text-white text-sm resize-none h-24 focus:outline-none focus:border-[#FF00FF] focus:shadow-[0_0_10px_rgba(255,0,255,0.2)] transition-all font-bold"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black text-[#00FFFF] uppercase tracking-widest mb-2 block">Age</label>
              <input type="number" value={age} onChange={e => setAge(e.target.value)} placeholder="e.g. 25" className="w-full bg-black border-2 border-white/10 rounded-2xl px-4 py-3.5 text-white text-sm focus:outline-none focus:border-[#FF00FF] focus:shadow-[0_0_10px_rgba(255,0,255,0.2)] transition-all font-bold" />
            </div>
            <div>
              <label className="text-[10px] font-black text-[#00FFFF] uppercase tracking-widest mb-2 block">City</label>
              <input type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Lagos" className="w-full bg-black border-2 border-white/10 rounded-2xl px-4 py-3.5 text-white text-sm focus:outline-none focus:border-[#FF00FF] focus:shadow-[0_0_10px_rgba(255,0,255,0.2)] transition-all font-bold" />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-black text-[#00FFFF] uppercase tracking-widest mb-2 block">Looking For</label>
            <select value={lookingFor} onChange={e => setLookingFor(e.target.value)} className="w-full bg-black border-2 border-white/10 rounded-2xl px-4 py-3.5 text-white text-sm focus:outline-none focus:border-[#FF00FF] focus:shadow-[0_0_10px_rgba(255,0,255,0.2)] transition-all font-bold appearance-none">
              {['Networking', 'Collaboration', 'Partnership', 'Mentorship', 'Friends', 'Dating'].map(o => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-black text-[#00FFFF] uppercase tracking-widest mb-2 block">Identity</label>
            <select value={gender} onChange={e => setGender(e.target.value)} className="w-full bg-black border-2 border-white/10 rounded-2xl px-4 py-3.5 text-white text-sm focus:outline-none focus:border-[#FF00FF] focus:shadow-[0_0_10px_rgba(255,0,255,0.2)] transition-all font-bold appearance-none">
              <option value="">Prefer not to say</option>
              {['Male', 'Female', 'Non-binary', 'Other'].map(o => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full mt-8 py-4 rounded-full bg-[#FF00FF] text-white font-black uppercase tracking-widest text-[12px] hover:scale-105 active:scale-95 transition-transform disabled:opacity-50 shadow-[0_0_15px_#FF00FF]"
        >
          {saving ? 'UPLOADING...' : 'SAVE PROFILE'}
        </button>
      </motion.div>
    </div>
  );
}

// ── Main Dating Component ───────────────────────────────────────────────────
export default function Dating() {
  const user = useSelector(selectUser);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const navigate = useNavigate();

  const [profiles, setProfiles] = useState([]);
  const [myProfile, setMyProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSetup, setShowSetup] = useState(false);
  const [swipeDir, setSwipeDir] = useState(null);
  const [dragX, setDragX] = useState(0);
  const isDragging = useRef(false);
  const dragStart = useRef(0);

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return; }
    loadData();
  }, [isAuthenticated]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [profilesRes, myRes] = await Promise.all([
        datingApi.getProfiles(),
        datingApi.getMyProfile().catch(() => ({ data: null })),
      ]);
      const all = profilesRes.data || [];
      setProfiles(all.filter(p => p && String(p.id) !== String(user?.id)));
      setMyProfile(myRes.data);
    } catch (e) {
      console.error(e);
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  };

  const dismiss = (dir) => {
    setSwipeDir(dir);
    setTimeout(() => {
      setSwipeDir(null);
      setDragX(0);
      if (dir === 'right') {
        const top = profiles[0];
        if (top) navigate(`/dm/${top.id}`);
      } else {
        setProfiles(prev => prev.slice(1));
      }
    }, 350);
  };

  const onDragStart = (e) => {
    isDragging.current = true;
    dragStart.current = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
  };
  const onDragMove = (e) => {
    if (!isDragging.current) return;
    const x = (e.type === 'touchmove' ? e.touches[0].clientX : e.clientX) - dragStart.current;
    setDragX(x);
  };
  const onDragEnd = () => {
    isDragging.current = false;
    if (dragX > 100) dismiss('right');
    else if (dragX < -100) dismiss('left');
    else setDragX(0);
  };

  const top = profiles[0];
  const next = profiles[1];
  const rotate = dragX * 0.08;
  const likeOpacity = Math.min(dragX / 80, 1);
  const nopeOpacity = Math.min(-dragX / 80, 1);

  if (loading) return (
    <div className="min-h-[85vh] flex items-center justify-center">
      <div className="text-center animate-pulse text-[#CDFF00] font-bold uppercase tracking-widest text-sm">
        <Heart className="w-8 h-8 mx-auto mb-3 animate-bounce" /> Loading matches...
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-24 relative font-sans overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 z-0 flex opacity-[0.05] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 10px 10px, #00FFFF 2px, transparent 0), radial-gradient(circle at 30px 30px, #FF00FF 2px, transparent 0)', backgroundSize: '60px 60px' }}></div>
      <div className="absolute top-0 left-0 right-0 h-[30vh] bg-gradient-to-b from-[#FF00FF]/10 to-transparent z-0 pointer-events-none" />

      <div className="pt-20 pb-8 px-4 max-w-7xl mx-auto text-center relative z-10">
        <span className="inline-block px-4 py-1 text-[10px] font-black uppercase tracking-[0.4em] bg-black text-[#00FFFF] border-2 border-[#00FFFF] rounded-full mb-4 shadow-[0_0_10px_#00FFFF]">CONNECT & COLLAB</span>
        <h1 className="text-5xl font-black text-white uppercase tracking-tighter drop-shadow-[2px_2px_0_#FF00FF]">Hustle <span className="text-[#00FFFF]">Bond</span></h1>
        <p className="text-[#FF00FF] font-bold uppercase tracking-widest text-xs mt-3 drop-shadow-[1px_1px_0_#000]">Connect with creatives in your area.</p>
      </div>

      {/* Action Bar */}
      <div className="z-10 w-full max-w-sm mx-auto mb-10 flex justify-center items-center gap-4 px-4 relative">
        <button
          onClick={() => setShowSetup(true)}
          className="px-6 py-3.5 rounded-full bg-black border-2 border-[#FF00FF]/50 text-[10px] font-black text-[#FF00FF] uppercase tracking-widest hover:bg-[#FF00FF] hover:text-white transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(255,0,255,0.2)]"
        >
          <Edit3 className="w-4 h-4" />
          {myProfile ? 'EDIT PROFILE' : 'CREATE PROFILE'}
        </button>
        <Link to="/dm" className="px-6 py-3.5 rounded-full bg-black border-2 border-[#00FFFF]/50 text-[10px] font-black text-[#00FFFF] uppercase tracking-widest hover:bg-[#00FFFF] hover:text-black transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(0,255,255,0.2)]">
          <MessageCircle className="w-4 h-4" />
          MESSAGES
        </Link>
      </div>

      {/* Setup your profile CTA if not set up */}
      {!myProfile && (
        <div className="z-10 w-full max-w-sm mx-auto px-4 mb-6 relative">
          <button
            onClick={() => setShowSetup(true)}
            className="w-full flex items-center justify-between px-5 py-4 rounded-[1.5rem] bg-black border-2 border-[#FF00FF] hover:shadow-[0_0_20px_#FF00FF] transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-[#FF00FF]/20 flex items-center justify-center">
                <User className="w-5 h-5 text-[#FF00FF]" />
              </div>
              <div className="text-left">
                <p className="text-[11px] font-black text-white uppercase tracking-widest">Setup Profile</p>
                <p className="text-[9px] text-[#00FFFF] font-bold uppercase tracking-widest mt-0.5">Required to connect</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-[#FF00FF] group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      )}

      {/* Card stack */}
      <div className="relative w-full max-w-sm mx-auto h-[540px] z-10 px-4 perspective-1000">
        {profiles.length === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center bg-[#0A0A0A] border-2 border-dashed border-[#00FFFF]/50 rounded-[2.5rem] p-8 text-center shadow-[0_0_30px_rgba(0,255,255,0.1)]">
            <Sparkles className="w-20 h-20 text-[#00FFFF] mb-6 drop-shadow-[0_0_15px_#00FFFF]" />
            <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-2 drop-shadow-[2px_2px_0_#FF00FF]">NO MATCHES</h3>
            <p className="text-[#00FFFF] font-bold uppercase tracking-widest text-[10px] mb-8">
              No creatives found in your area yet.
            </p>
            <button
              onClick={() => setShowSetup(true)}
              className="px-8 py-3.5 rounded-full bg-[#FF00FF] text-white text-[11px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-transform shadow-[0_0_20px_#FF00FF]"
            >
              {myProfile ? 'EDIT PREFERENCES' : 'CREATE PROFILE'}
            </button>
          </div>
        ) : (
          <>
            {next && (
              <div className="absolute inset-x-4 top-4 bottom-0 rounded-[2.5rem] overflow-hidden bg-black border-2 border-[#00FFFF]/30 scale-[0.92] opacity-50 pointer-events-none transform -translate-y-4">
                <img src={getAvatar(next)} className="w-full h-full object-cover filter grayscale blur-[2px]" alt="" onError={(e) => { e.target.onerror = null; e.target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${next.id}`; }} />
              </div>
            )}

            <AnimatePresence>
              {top && (
                <motion.div
                  key={top.id}
                  className="absolute inset-x-0 top-0 bottom-0 px-0 cursor-grab active:cursor-grabbing"
                  animate={{
                    x: swipeDir === 'left' ? -400 : swipeDir === 'right' ? 400 : dragX,
                    rotate: swipeDir ? (swipeDir === 'left' ? -25 : 25) : rotate,
                    opacity: swipeDir ? 0 : 1,
                  }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  onMouseDown={onDragStart}
                  onMouseMove={onDragMove}
                  onMouseUp={onDragEnd}
                  onMouseLeave={onDragEnd}
                  onTouchStart={onDragStart}
                  onTouchMove={onDragMove}
                  onTouchEnd={onDragEnd}
                >
                  <div className="w-full h-full rounded-[2.5rem] overflow-hidden bg-black border-4 border-[#FF00FF] shadow-[0_0_40px_rgba(255,0,255,0.3)] relative">
                    <img
                      src={getAvatar(top)}
                      className="absolute inset-0 w-full h-full object-cover"
                      alt={top.fullName}
                      onError={(e) => { e.target.onerror = null; e.target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(top.fullName || top.id)}`; }}
                      draggable={false}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

                    {/* LIKE / NOPE stamps */}
                    <div className="absolute top-12 left-8 rotate-[-20deg] border-4 border-[#00FFFF] text-[#00FFFF] px-6 py-2 rounded-2xl text-3xl font-black uppercase tracking-[0.3em] transition-opacity duration-100 shadow-[0_0_15px_#00FFFF] bg-black/50 backdrop-blur-sm"
                      style={{ opacity: likeOpacity }}>VIBE</div>
                    <div className="absolute top-12 right-8 rotate-[20deg] border-4 border-red-500 text-red-500 px-6 py-2 rounded-2xl text-3xl font-black uppercase tracking-[0.3em] transition-opacity duration-100 shadow-[0_0_15px_red] bg-black/50 backdrop-blur-sm"
                      style={{ opacity: nopeOpacity }}>PASS</div>

                    <div className="absolute top-6 left-6">
                      <span className="px-4 py-2 rounded-full bg-black border-2 border-[#00FFFF] text-[#00FFFF] text-[9px] font-black uppercase tracking-[0.3em] shadow-[0_0_10px_rgba(0,255,255,0.5)]">
                        OBJ: {top.lookingFor || 'NETWORKING'}
                      </span>
                    </div>

                    <div className="absolute bottom-0 left-0 right-0 p-8 pb-28 bg-gradient-to-t from-black via-black/80 to-transparent">
                      <h2 className="text-4xl font-black text-white leading-none uppercase tracking-tighter drop-shadow-[2px_2px_0_#FF00FF]">
                        {top.fullName}
                        {top.age > 0 && <span className="text-[#00FFFF] ml-3 text-3xl drop-shadow-none">[{top.age}]</span>}
                      </h2>
                      {top.location && (
                        <p className="flex items-center gap-2 text-[11px] font-black text-[#00FFFF] uppercase tracking-widest mt-3">
                          <MapPin className="w-4 h-4" /> LOC: {top.location}
                        </p>
                      )}
                      {top.bio && (
                        <p className="text-sm text-gray-300 font-bold mt-4 line-clamp-3 leading-relaxed border-l-2 border-[#FF00FF] pl-3">{top.bio}</p>
                      )}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="absolute bottom-6 left-0 right-0 flex justify-center items-center gap-6 z-20">
                    <button
                      onClick={(e) => { e.stopPropagation(); dismiss('left'); }}
                      className="w-16 h-16 rounded-full bg-black border-4 border-[#0A0A0A] flex items-center justify-center text-gray-500 hover:text-red-500 hover:border-red-500 hover:scale-110 active:scale-95 transition-all shadow-2xl"
                    >
                      <X className="w-8 h-8 font-black" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); dismiss('right'); }}
                      className="w-20 h-20 rounded-full bg-[#FF00FF] border-4 border-black flex items-center justify-center text-white hover:scale-110 active:scale-95 transition-all shadow-[0_0_30px_#FF00FF]"
                    >
                      <Heart className="w-10 h-10 fill-white drop-shadow-md" />
                    </button>
                    <Link
                      to={`/dm/${top.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="w-16 h-16 rounded-full bg-black border-4 border-[#0A0A0A] flex items-center justify-center text-gray-500 hover:text-[#00FFFF] hover:border-[#00FFFF] hover:scale-110 active:scale-95 transition-all shadow-2xl"
                    >
                      <MessageCircle className="w-8 h-8 font-black" />
                    </Link>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>

      {profiles.length > 0 && (
        <p className="relative z-10 mt-8 text-center text-[10px] text-gray-600 font-black uppercase tracking-[0.4em]">
          ← PASS &nbsp; || &nbsp; VIBE →
        </p>
      )}

      {showSetup && (
        <ProfileSetupModal
          currentUser={user}
          existing={myProfile}
          onClose={() => setShowSetup(false)}
          onSaved={loadData}
        />
      )}
    </div>
  );
}

