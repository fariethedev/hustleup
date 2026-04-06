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
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md bg-[#0d0d0d] border border-white/10 rounded-3xl p-6 overflow-y-auto max-h-[90vh]"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-black text-white uppercase tracking-wide">Your Dating Profile</h2>
          <button onClick={onClose} className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Avatar */}
        <div className="flex justify-center mb-6">
          <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-[#CDFF00] bg-[#111]">
            <img src={imagePreview || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser?.id}`} className="w-full h-full object-cover" alt="" />
            <button onClick={() => fileRef.current?.click()} className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
              <Camera className="w-6 h-6 text-white" />
            </button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImage} />
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-black text-gray-500 uppercase tracking-widest mb-1 block">Bio</label>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder="Tell others about yourself..."
              className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-white text-sm resize-none h-20 focus:outline-none focus:border-[#CDFF00]/50"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-black text-gray-500 uppercase tracking-widest mb-1 block">Age</label>
              <input type="number" value={age} onChange={e => setAge(e.target.value)} placeholder="e.g. 25" className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#CDFF00]/50" />
            </div>
            <div>
              <label className="text-xs font-black text-gray-500 uppercase tracking-widest mb-1 block">City</label>
              <input type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. London" className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#CDFF00]/50" />
            </div>
          </div>
          <div>
            <label className="text-xs font-black text-gray-500 uppercase tracking-widest mb-1 block">Looking For</label>
            <select value={lookingFor} onChange={e => setLookingFor(e.target.value)} className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#CDFF00]/50">
              {['Networking', 'Collaboration', 'Partnership', 'Mentorship', 'Friends', 'Dating'].map(o => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-black text-gray-500 uppercase tracking-widest mb-1 block">Gender</label>
            <select value={gender} onChange={e => setGender(e.target.value)} className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#CDFF00]/50">
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
          className="w-full mt-6 py-3.5 rounded-xl bg-[#CDFF00] text-black font-black uppercase tracking-widest text-sm hover:bg-[#b8e600] transition-all disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Profile'}
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
    <div className="min-h-screen bg-[#050505] text-white pb-24 relative">
      <div className="pt-8 pb-6 px-4 max-w-7xl mx-auto text-center">
        <span className="inline-block px-3 py-1 text-[10px] font-black uppercase tracking-widest bg-[#CDFF00]/10 text-[#CDFF00] border border-[#CDFF00]/20 rounded-full mb-3">ELITE NETWORKING HUB</span>
        <h1 className="text-4xl font-black text-white uppercase tracking-tight">Hustle <span className="text-[#CDFF00]">Bond</span></h1>
        <p className="text-gray-500 text-sm mt-1">Beyond professional boundaries. Forge meaningful connections that transcend the boardroom.</p>
      </div>

      {/* Action Bar */}
      <div className="z-10 w-full max-w-sm mx-auto mb-12 flex justify-center items-center gap-4 px-4">
        <button
          onClick={() => setShowSetup(true)}
          className="px-6 py-3 rounded-2xl bg-white/5 border border-white/10 text-xs font-black text-white uppercase tracking-widest hover:bg-white/10 transition-all flex items-center gap-1.5"
        >
          <Edit3 className="w-3.5 h-3.5 text-[#CDFF00]" />
          {myProfile ? 'Edit Profile' : 'Setup Profile'}
        </button>
        <Link to="/dm" className="px-6 py-3 rounded-2xl bg-white/5 border border-white/10 text-xs font-black text-white uppercase tracking-widest hover:bg-white/10 transition-all flex items-center gap-1.5">
          <MessageCircle className="w-3.5 h-3.5 text-[#CDFF00]" />
          Message Hub
        </Link>
      </div>

      {/* Setup your profile CTA if not set up */}
      {!myProfile && (
        <div className="z-10 w-full max-w-sm px-4 mb-4">
          <button
            onClick={() => setShowSetup(true)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-[#CDFF00]/10 border border-[#CDFF00]/30 hover:bg-[#CDFF00]/15 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#CDFF00]/20 flex items-center justify-center">
                <User className="w-4 h-4 text-[#CDFF00]" />
              </div>
              <div className="text-left">
                <p className="text-xs font-black text-[#CDFF00] uppercase tracking-widest">Complete your profile</p>
                <p className="text-[10px] text-gray-500 font-bold">Let others discover you</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#CDFF00] group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      )}

      {/* Card stack */}
      <div className="relative w-full max-w-sm h-[540px] z-10 px-4">
        {profiles.length === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center bg-[#0d0d0d] border border-white/10 rounded-3xl p-8 text-center">
            <Sparkles className="w-16 h-16 text-[#CDFF00] mb-6" />
            <h3 className="text-2xl font-heading font-extrabold text-white uppercase tracking-wide mb-2">No profiles yet</h3>
            <p className="text-gray-500 font-bold uppercase tracking-widest text-xs mb-6">
              You're the only one here so far.<br/>Invite others to join HustleUp!
            </p>
            <button
              onClick={() => setShowSetup(true)}
              className="px-6 py-2.5 rounded-xl bg-[#CDFF00] text-black text-xs font-black uppercase tracking-widest hover:bg-[#b8e600] transition-all"
            >
              {myProfile ? 'Update my profile' : 'Setup my profile'}
            </button>
          </div>
        ) : (
          <>
            {next && (
              <div className="absolute inset-x-4 top-3 bottom-0 rounded-3xl overflow-hidden bg-[#111] border border-white/5 scale-95 opacity-60 pointer-events-none">
                <img src={getAvatar(next)} className="w-full h-full object-cover" alt="" onError={(e) => { e.target.onerror = null; e.target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${next.id}`; }} />
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
                  <div className="w-full h-full rounded-3xl overflow-hidden bg-[#0d0d0d] border border-white/10 shadow-2xl relative">
                    <img
                      src={getAvatar(top)}
                      className="absolute inset-0 w-full h-full object-cover"
                      alt={top.fullName}
                      onError={(e) => { e.target.onerror = null; e.target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(top.fullName || top.id)}`; }}
                      draggable={false}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />

                    {/* LIKE / NOPE stamps */}
                    <div className="absolute top-10 left-8 rotate-[-20deg] border-4 border-[#CDFF00] text-[#CDFF00] px-4 py-1 rounded-xl text-2xl font-black uppercase tracking-widest transition-opacity duration-100"
                      style={{ opacity: likeOpacity }}>MATCH</div>
                    <div className="absolute top-10 right-8 rotate-[20deg] border-4 border-red-500 text-red-500 px-4 py-1 rounded-xl text-2xl font-black uppercase tracking-widest transition-opacity duration-100"
                      style={{ opacity: nopeOpacity }}>NOPE</div>

                    <div className="absolute top-5 left-5">
                      <span className="px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-sm text-white text-[10px] font-black uppercase tracking-widest border border-white/10">
                        {top.lookingFor || 'Networking'}
                      </span>
                    </div>

                    <div className="absolute bottom-0 left-0 right-0 p-6 pb-24">
                      <h2 className="text-3xl font-black text-white leading-none">
                        {top.fullName}
                        {top.age > 0 && <span className="text-[#CDFF00] ml-2">{top.age}</span>}
                      </h2>
                      {top.location && (
                        <p className="flex items-center gap-1.5 text-xs font-bold text-gray-400 uppercase tracking-widest mt-2">
                          <MapPin className="w-3.5 h-3.5 text-[#CDFF00]" /> {top.location}
                        </p>
                      )}
                      {top.bio && (
                        <p className="text-sm text-gray-400 mt-3 line-clamp-2 leading-relaxed">{top.bio}</p>
                      )}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="absolute bottom-5 left-0 right-0 flex justify-center gap-5 z-20">
                    <button
                      onClick={(e) => { e.stopPropagation(); dismiss('left'); }}
                      className="w-14 h-14 rounded-full bg-[#0d0d0d] border border-white/10 flex items-center justify-center text-red-400 hover:bg-red-500/10 hover:border-red-500/40 hover:scale-110 active:scale-95 transition-all shadow-xl"
                    >
                      <X className="w-7 h-7" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); dismiss('right'); }}
                      className="w-16 h-16 rounded-full bg-[#CDFF00] flex items-center justify-center text-black hover:bg-[#b8e600] hover:scale-110 active:scale-95 transition-all shadow-xl shadow-[#CDFF00]/30"
                    >
                      <Heart className="w-7 h-7 fill-black" />
                    </button>
                    <Link
                      to={`/dm/${top.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="w-14 h-14 rounded-full bg-[#0d0d0d] border border-white/10 flex items-center justify-center text-[#CDFF00] hover:bg-[#CDFF00]/10 hover:border-[#CDFF00]/40 hover:scale-110 active:scale-95 transition-all shadow-xl"
                    >
                      <MessageCircle className="w-6 h-6" />
                    </Link>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>

      {profiles.length > 0 && (
        <p className="z-10 mt-4 text-[10px] text-gray-700 font-black uppercase tracking-[0.3em]">
          ← swipe or drag → to match
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

