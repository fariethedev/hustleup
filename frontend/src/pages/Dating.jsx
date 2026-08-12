import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSelector } from 'react-redux';
import { selectUser, selectIsAuthenticated } from '../store/authSlice';
import { datingApi, subscriptionsApi, dispatchToast } from '../api/client';
import {
  Heart, X, Sparkles, MapPin, MessageCircle, User, Edit3, Camera,
  ChevronRight, Crown, Users, Zap
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import HeroBrief from '../components/HeroBrief';
import { formatPrice } from '../utils/constants';

const getAvatar = (p) =>
  p?.imageUrl ||
  `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(p?.fullName || 'user')}`;

// A subscription only counts as Premium if the plan is VERIFIED, the status
// isn't cancelled/expired, and (when set) the expiry date hasn't passed yet.
const isPremiumActive = (sub) => {
  if (!sub || sub.plan !== 'VERIFIED') return false;
  if (sub.status && sub.status !== 'ACTIVE') return false;
  if (sub.expiresAt && new Date(sub.expiresAt).getTime() < Date.now()) return false;
  return true;
};

// ── "It's a Match!" celebration ─────────────────────────────────────────────
// Tinder's signature moment: a full-screen takeover with both avatars, shown once
// per match instead of just a toast — so a match actually feels like an event.
function MatchCelebrationModal({ currentUser, matchedProfile, onClose, onSendMessage }) {
  return (
    <div className="fixed inset-0 z-[300] bg-black/95 backdrop-blur-md flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', bounce: 0.4, duration: 0.6 }}
        className="w-full max-w-sm text-center"
      >
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.15, type: 'spring', bounce: 0.6 }}
        >
          <Heart className="w-14 h-14 text-[#CDFF00] fill-[#CDFF00] mx-auto mb-3 drop-shadow-[0_0_20px_rgba(205,255,0,0.4)]" />
        </motion.div>
        <h1 className="text-4xl font-heading font-black text-white uppercase tracking-tight mb-2">
          It's a match!
        </h1>
        <p className="text-gray-400 text-sm mb-9">
          You and {matchedProfile?.fullName} liked each other
        </p>

        <div className="relative flex items-center justify-center h-28 mb-10">
          <motion.div
            initial={{ x: 0, rotate: 0, opacity: 0 }}
            animate={{ x: -28, rotate: -8, opacity: 1 }}
            transition={{ delay: 0.3, type: 'spring' }}
            className="absolute w-24 h-24 rounded-full border-4 border-[#CDFF00] overflow-hidden bg-black shadow-2xl"
          >
            <img src={getAvatar(currentUser)} className="w-full h-full object-cover" alt="" />
          </motion.div>
          <motion.div
            initial={{ x: 0, rotate: 0, opacity: 0 }}
            animate={{ x: 28, rotate: 8, opacity: 1 }}
            transition={{ delay: 0.4, type: 'spring' }}
            className="absolute w-24 h-24 rounded-full border-4 border-white overflow-hidden bg-black shadow-2xl"
          >
            <img
              src={getAvatar(matchedProfile)}
              className="w-full h-full object-cover"
              alt=""
              onError={(e) => { e.target.onerror = null; e.target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${matchedProfile?.id}`; }}
            />
          </motion.div>
        </div>

        <button
          onClick={onSendMessage}
          className="w-full py-3.5 rounded-xl bg-[#CDFF00] text-black font-bold text-sm hover:brightness-110 active:scale-[0.98] transition-all mb-3 flex items-center justify-center gap-2"
        >
          <MessageCircle className="w-4 h-4" /> Send a message
        </button>
        <button
          onClick={onClose}
          className="w-full py-3.5 rounded-xl border border-white/15 text-white font-bold text-sm hover:bg-white/5 transition-all"
        >
          Keep swiping
        </button>
      </motion.div>
    </div>
  );
}

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
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md bg-[#0A0A0A] border border-white/10 rounded-2xl p-6 overflow-y-auto max-h-[90vh]"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-white">Your Bond profile</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors">
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Avatar */}
        <div className="flex justify-center mb-7">
          <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-white/10 bg-black">
            <img src={imagePreview || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser?.id}`} className="w-full h-full object-cover" alt="" />
            <button onClick={() => fileRef.current?.click()} className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
              <Camera className="w-5 h-5 text-[#CDFF00] mb-1" />
              <span className="text-[9px] font-bold uppercase text-[#CDFF00]">Upload</span>
            </button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImage} />
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 block">Bio</label>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder="Tell people what you do..."
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-white text-sm resize-none h-24 focus:outline-none focus:border-[#CDFF00] transition-colors"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 block">Age</label>
              <input type="number" value={age} onChange={e => setAge(e.target.value)} placeholder="e.g. 25" className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#CDFF00] transition-colors" />
            </div>
            <div>
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 block">City</label>
              <input type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Warszawa" className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#CDFF00] transition-colors" />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 block">Looking for</label>
            <select value={lookingFor} onChange={e => setLookingFor(e.target.value)} className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#CDFF00] transition-colors appearance-none">
              {['Networking', 'Collaboration', 'Partnership', 'Mentorship', 'Friends', 'Dating'].map(o => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 block">Identity</label>
            <select value={gender} onChange={e => setGender(e.target.value)} className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#CDFF00] transition-colors appearance-none">
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
          className="w-full mt-7 py-3 rounded-xl bg-[#CDFF00] text-black font-bold text-sm hover:bg-[#d9ff33] active:scale-[0.99] transition-all disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save profile'}
        </button>
      </motion.div>
    </div>
  );
}

// ── Premium Paywall ──────────────────────────────────────────────────────────
function PremiumPaywall({ onUpgrade, upgrading }) {
  const perks = [
    { icon: Heart, text: 'Unlimited swipes on creatives near you' },
    { icon: Users, text: 'See mutual matches and message instantly' },
    { icon: Zap, text: 'Priority placement in other members’ stacks' },
  ];

  return (
    <div className="w-full max-w-sm mx-auto px-4">
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 text-center">
        <div className="w-11 h-11 rounded-full bg-[#CDFF00]/10 border border-[#CDFF00]/30 flex items-center justify-center mx-auto mb-3">
          <Crown className="w-5 h-5 text-[#CDFF00]" />
        </div>
        <h2 className="text-base font-bold text-white mb-1">Bond is a Premium feature</h2>
        <p className="text-xs text-gray-400 leading-relaxed mb-4">
          Upgrade to connect with creatives and hustlers near you.
        </p>

        <div className="space-y-2 text-left mb-4">
          {perks.map((p) => (
            <div key={p.text} className="flex items-start gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center shrink-0 mt-0.5">
                <p.icon className="w-3 h-3 text-[#CDFF00]" />
              </div>
              <span className="text-xs text-gray-300 leading-snug">{p.text}</span>
            </div>
          ))}
        </div>

        <button
          onClick={onUpgrade}
          disabled={upgrading}
          className="w-full py-2.5 rounded-xl bg-[#CDFF00] text-black font-bold text-sm hover:bg-[#d9ff33] active:scale-[0.99] transition-all disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {upgrading ? (
            <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
          ) : (
            <>Upgrade to Premium — {formatPrice(20, 'PLN')}/mo</>
          )}
        </button>
        <p className="text-[10px] text-gray-500 mt-2">Cancel anytime. No commitment.</p>
      </div>
    </div>
  );
}

// ── Main Dating Component ───────────────────────────────────────────────────
export default function Dating() {
  const user = useSelector(selectUser);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const navigate = useNavigate();

  const [checkingAccess, setCheckingAccess] = useState(true);
  const [premium, setPremium] = useState(false);
  const [upgrading, setUpgrading] = useState(false);

  const [profiles, setProfiles] = useState([]);
  const [myProfile, setMyProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSetup, setShowSetup] = useState(false);
  const [matchData, setMatchData] = useState(null); // the profile just matched with, or null
  const [swipeDir, setSwipeDir] = useState(null);
  const [dragX, setDragX] = useState(0);
  const isDragging = useRef(false);
  const dragStart = useRef(0);

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return; }
    checkAccess();
  }, [isAuthenticated]);

  // Bond is Premium-gated: only load the discovery feed once an active
  // subscription is confirmed. Anyone else sees the paywall instead.
  const checkAccess = async () => {
    setCheckingAccess(true);
    try {
      const res = await subscriptionsApi.my();
      const active = isPremiumActive(res.data);
      setPremium(active);
      if (active) await loadData();
    } catch (e) {
      setPremium(false);
    } finally {
      setCheckingAccess(false);
    }
  };

  const handleUpgrade = async () => {
    setUpgrading(true);
    try {
      await subscriptionsApi.upgrade();
      dispatchToast('Welcome to Premium!', 'success');
      setPremium(true);
      await loadData();
    } catch (e) {
      dispatchToast('Could not upgrade — try again', 'error');
    } finally {
      setUpgrading(false);
    }
  };

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

  // Persist the swipe so the profile never resurfaces, and surface a real match
  // when both sides have liked each other. Previously this only updated local
  // state — nothing was saved, so every reload reset the whole discovery stack.
  const dismiss = (dir) => {
    const target = profiles[0];
    setSwipeDir(dir);
    setTimeout(() => setSwipeDir(null), 350);
    setTimeout(() => { setDragX(0); setProfiles(prev => prev.slice(1)); }, 350);
    if (!target) return;

    if (dir === 'right') {
      datingApi.like(target.id)
        .then((res) => {
          if (res.data?.matched) {
            // Full-screen celebration instead of an immediate auto-navigate — the user
            // chooses whether to message now or keep swiping (matches Tinder's flow).
            setMatchData(target);
          } else {
            dispatchToast(`Liked ${target.fullName} — you'll be notified if it's mutual`, 'success');
          }
        })
        .catch(() => {});
    } else {
      datingApi.pass(target.id).catch(() => {});
    }
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

  if (checkingAccess) return (
    <div className="h-[calc(100vh-8.5rem-env(safe-area-inset-bottom))] md:h-[calc(100vh-4rem)] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#CDFF00]/20 border-t-[#CDFF00] rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="h-[calc(100vh-8.5rem-env(safe-area-inset-bottom))] md:h-[calc(100vh-4rem)] text-white font-sans flex flex-col overflow-hidden">
      <div className="shrink-0">
        <HeroBrief title="Hustle Bond" />
      </div>

      {!premium ? (
        <div className="flex-1 min-h-0 flex items-center justify-center">
          <PremiumPaywall onUpgrade={handleUpgrade} upgrading={upgrading} />
        </div>
      ) : loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[#CDFF00]/20 border-t-[#CDFF00] rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col w-full max-w-sm mx-auto px-4">
          {/* Action Bar */}
          <div className="shrink-0 mb-2 flex justify-center items-center gap-2">
            <button
              onClick={() => setShowSetup(true)}
              className="px-3.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[10px] font-bold text-white uppercase tracking-widest hover:bg-white/10 transition-all flex items-center gap-1.5"
            >
              <Edit3 className="w-3 h-3" />
              {myProfile ? 'Edit profile' : 'Create profile'}
            </button>
            <Link to="/dm" className="px-3.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[10px] font-bold text-white uppercase tracking-widest hover:bg-white/10 transition-all flex items-center gap-1.5">
              <MessageCircle className="w-3 h-3" />
              Messages
            </Link>
          </div>

          {/* Setup your profile CTA if not set up */}
          {!myProfile && (
            <div className="shrink-0 mb-2">
              <button
                onClick={() => setShowSetup(true)}
                className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 hover:border-[#CDFF00]/40 transition-all group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-[#CDFF00]/10 flex items-center justify-center">
                    <User className="w-3.5 h-3.5 text-[#CDFF00]" />
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-bold text-white">Set up your profile</p>
                    <p className="text-[10px] text-gray-500">Required to start connecting</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-500 group-hover:translate-x-1 group-hover:text-[#CDFF00] transition-all" />
              </button>
            </div>
          )}

          {/* Card stack */}
          <div className="relative flex-1 min-h-0">
            {profiles.length === 0 ? (
              <div className="w-full h-full flex flex-col items-center justify-center bg-white/[0.02] border border-dashed border-white/10 rounded-2xl p-5 text-center">
                <Sparkles className="w-8 h-8 text-gray-600 mb-3" />
                <h3 className="text-sm font-bold text-white mb-1">No one new right now</h3>
                <p className="text-xs text-gray-500 mb-3">
                  No creatives found in your area yet.
                </p>
                <button
                  onClick={() => setShowSetup(true)}
                  className="px-5 py-2 rounded-xl bg-[#CDFF00] text-black text-xs font-bold hover:bg-[#d9ff33] active:scale-95 transition-all"
                >
                  {myProfile ? 'Edit preferences' : 'Create profile'}
                </button>
              </div>
            ) : (
              <>
                {next && (
                  <div className="absolute inset-x-3 top-3 bottom-0 rounded-2xl overflow-hidden bg-black border border-white/10 scale-[0.94] opacity-50 pointer-events-none">
                    <img src={getAvatar(next)} className="w-full h-full object-cover filter grayscale blur-[2px]" alt="" onError={(e) => { e.target.onerror = null; e.target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${next.id}`; }} />
                  </div>
                )}

                <AnimatePresence>
                  {top && (
                    <motion.div
                      key={top.id}
                      className="absolute inset-x-0 top-0 bottom-0 cursor-grab active:cursor-grabbing"
                      animate={{
                        x: swipeDir === 'left' ? -400 : swipeDir === 'right' ? 400 : dragX,
                        rotate: swipeDir ? (swipeDir === 'left' ? -18 : 18) : rotate,
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
                      <div className="w-full h-full rounded-2xl overflow-hidden bg-black border border-white/10 relative">
                        <img
                          src={getAvatar(top)}
                          className="absolute inset-0 w-full h-full object-cover"
                          alt={top.fullName}
                          onError={(e) => { e.target.onerror = null; e.target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(top.fullName || top.id)}`; }}
                          draggable={false}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />

                        {/* LIKE / PASS indicators */}
                        <div className="absolute top-8 left-6 rounded-lg border-2 border-[#CDFF00] text-[#CDFF00] px-3 py-1 text-sm font-bold uppercase tracking-widest bg-black/40 backdrop-blur-sm"
                          style={{ opacity: likeOpacity }}>Like</div>
                        <div className="absolute top-8 right-6 rounded-lg border-2 border-red-400 text-red-400 px-3 py-1 text-sm font-bold uppercase tracking-widest bg-black/40 backdrop-blur-sm"
                          style={{ opacity: nopeOpacity }}>Pass</div>

                        <div className="absolute top-4 left-4">
                          <span className="px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 text-white text-[10px] font-bold uppercase tracking-widest">
                            {top.lookingFor || 'Networking'}
                          </span>
                        </div>

                        <div className="absolute bottom-0 left-0 right-0 p-4 pb-16">
                          <h2 className="text-lg font-bold text-white leading-tight">
                            {top.fullName}
                            {top.age > 0 && <span className="text-gray-300 ml-2 font-semibold">{top.age}</span>}
                          </h2>
                          {top.location && (
                            <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-300 mt-1">
                              <MapPin className="w-3 h-3 text-[#CDFF00]" /> {top.location}
                            </p>
                          )}
                          {top.bio && (
                            <p className="text-xs text-gray-300 mt-1.5 line-clamp-1 leading-relaxed">{top.bio}</p>
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="absolute bottom-3 left-0 right-0 flex justify-center items-center gap-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); dismiss('left'); }}
                          className="w-11 h-11 rounded-full bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center text-gray-300 hover:text-red-400 hover:border-red-400/50 hover:scale-105 active:scale-95 transition-all"
                        >
                          <X className="w-5 h-5" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); dismiss('right'); }}
                          className="w-12 h-12 rounded-full bg-[#CDFF00] flex items-center justify-center text-black hover:scale-105 active:scale-95 transition-all shadow-lg shadow-[#CDFF00]/20"
                        >
                          <Heart className="w-5 h-5 fill-black" />
                        </button>
                        <Link
                          to={`/dm/${top.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="w-11 h-11 rounded-full bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center text-gray-300 hover:text-[#00FFFF] hover:border-[#00FFFF]/50 hover:scale-105 active:scale-95 transition-all"
                        >
                          <MessageCircle className="w-5 h-5" />
                        </Link>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}
          </div>

          {profiles.length > 0 && (
            <p className="shrink-0 mt-2 text-center text-[10px] text-gray-600 font-semibold uppercase tracking-[0.3em]">
              ← Pass &nbsp;·&nbsp; Like →
            </p>
          )}
        </div>
      )}

      {showSetup && (
        <ProfileSetupModal
          currentUser={user}
          existing={myProfile}
          onClose={() => setShowSetup(false)}
          onSaved={loadData}
        />
      )}

      {matchData && (
        <MatchCelebrationModal
          currentUser={user}
          matchedProfile={matchData}
          onClose={() => setMatchData(null)}
          onSendMessage={() => navigate(`/dm/${matchData.id}`)}
        />
      )}
    </div>
  );
}
