import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { motion, useMotionValue, useTransform, useAnimationControls } from 'framer-motion';
import { useSelector } from 'react-redux';
import { selectUser, selectIsAuthenticated } from '../store/authSlice';
import { datingApi, subscriptionsApi, dispatchToast } from '../api/client';
import { isPremiumActive } from '../utils/premium';
import {
  Heart, X, Sparkles, MessageCircle, User, Camera, Crown, Users, Zap,
  Star, RotateCcw,
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import BondCard from '../components/BondCard';
import { formatPrice } from '../utils/constants';
import { uploadUrl } from '../config';
import { displayName, shortName } from '../utils/displayName';

const getAvatar = (p) =>
  p?.imageUrl ||
  p?.avatarUrl ||
  `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(displayName(p))}`;

// Was the first word of the full name. Now the handle, whole: a handle is already
// short, and cutting one at a dot or underscore produces someone else's handle.
const firstName = (p) => (p ? shortName(p) : 'them');

// Swiping is a physical gesture, so it gets a physical response where the device has one.
// Silently ignored on desktop and on iOS, neither of which expose the Vibration API.
const buzz = (pattern) => { try { navigator.vibrate?.(pattern); } catch { /* unsupported */ } };

// How far, or how fast, a drag has to go before releasing it counts as a decision.
// Distance alone would force a long deliberate drag for every swipe; velocity alone would
// fire on any twitch. Requiring either — past a small minimum travel — is what makes both
// a lazy shove and a quick flick work, which is most of what "feels like Tinder" means.
const SWIPE_DISTANCE = 110;
const SWIPE_VELOCITY = 520;
const MIN_TRAVEL = 45;
const SUPER_DISTANCE = 130;
const SUPER_VELOCITY = 600;

// ── "It's a Match!" celebration ─────────────────────────────────────────────
// A full-screen takeover with both avatars rather than a toast, so a match lands as an
// event. Super likes get their own colourway — the whole point of spending one is that
// the payoff looks different from an ordinary match.
function MatchCelebrationModal({ currentUser, matchedProfile, superLike, onClose, onSendMessage }) {
  const accent = superLike ? '#00E0FF' : '#CDFF00';

  return (
    <div className="fixed inset-0 z-[300] bg-black/95 backdrop-blur-md flex items-center justify-center p-4">
      {/* Hearts drifting up behind the card. Purely decorative, hence aria-hidden. */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        {[...Array(9)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ y: '105vh', opacity: 0, scale: 0.5 }}
            animate={{ y: '-15vh', opacity: [0, 0.7, 0], scale: 1 }}
            transition={{ duration: 3.5 + (i % 4) * 0.6, delay: i * 0.22, repeat: Infinity, ease: 'linear' }}
            className="absolute"
            style={{ left: `${8 + i * 10}%` }}
          >
            <Heart className="w-5 h-5" style={{ color: accent, fill: accent, opacity: 0.5 }} />
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', bounce: 0.4, duration: 0.6 }}
        className="relative w-full max-w-sm text-center"
      >
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.15, type: 'spring', bounce: 0.6 }}
        >
          {superLike ? (
            <Star
              className="w-14 h-14 mx-auto mb-3"
              style={{ color: accent, fill: accent, filter: `drop-shadow(0 0 20px ${accent}66)` }}
            />
          ) : (
            <Heart
              className="w-14 h-14 mx-auto mb-3"
              style={{ color: accent, fill: accent, filter: `drop-shadow(0 0 20px ${accent}66)` }}
            />
          )}
        </motion.div>

        <h1 className="text-4xl font-heading font-black text-white tracking-tight mb-2">
          It's a match!
        </h1>
        <p className="text-gray-400 text-sm mb-9">
          {superLike
            ? `${matchedProfile?.fullName} liked you back after your super like`
            : `You and ${matchedProfile?.fullName} liked each other`}
        </p>

        <div className="relative flex items-center justify-center h-28 mb-10">
          <motion.div
            initial={{ x: 0, rotate: 0, opacity: 0 }}
            animate={{ x: -28, rotate: -8, opacity: 1 }}
            transition={{ delay: 0.3, type: 'spring' }}
            className="absolute w-24 h-24 rounded-full border-4 overflow-hidden bg-black shadow-2xl"
            style={{ borderColor: accent }}
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
          className="w-full py-3.5 rounded-xl text-black font-bold text-sm hover:brightness-110 active:scale-[0.98] transition-all mb-3 flex items-center justify-center gap-2"
          style={{ backgroundColor: accent }}
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

const INTEREST_OPTIONS = [
  'Music', 'Design', 'Fashion', 'Photography', 'Fitness', 'Food', 'Travel',
  'Gaming', 'Startups', 'Marketing', 'Art', 'Coding', 'Film', 'Dancing',
  'Coffee', 'Nightlife', 'Sports', 'Reading',
];
const MAX_INTERESTS = 5;

const LOOKING_FOR_OPTIONS = ['Networking', 'Collaboration', 'Partnership', 'Mentorship', 'Friends', 'Dating'];
const GENDER_OPTIONS = ['Male', 'Female', 'Non-binary', 'Other'];
const SHOW_ME_OPTIONS = ['Everyone', 'Men', 'Women'];

/** A pill in a single- or multi-select row — the setup form's only input primitive. */
function Chip({ label, selected, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={`px-3.5 py-2 rounded-full text-xs font-bold transition-all active:scale-95 border ${
        selected
          ? 'bg-[#CDFF00] text-black border-[#CDFF00]'
          : disabled
            ? 'bg-white/[0.02] text-gray-600 border-white/5 cursor-not-allowed'
            : 'bg-white/[0.04] text-gray-300 border-white/10 hover:border-white/30 hover:text-white'
      }`}
    >
      {label}
    </button>
  );
}

function ProfileSetupModal({ currentUser, existing, onClose, onSaved }) {
  const [bio, setBio] = useState(existing?.bio || '');
  const [age, setAge] = useState(existing?.age || '');
  const [location, setLocation] = useState(existing?.location || '');
  const [lookingFor, setLookingFor] = useState(existing?.lookingFor || 'Networking');
  const [gender, setGender] = useState(existing?.gender || '');
  const [showMe, setShowMe] = useState(existing?.showMe || 'Everyone');
  const [interests, setInterests] = useState(
    (existing?.interests || '').split(',').map((i) => i.trim()).filter(Boolean)
  );
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

  const toggleInterest = (tag) => {
    setInterests((prev) =>
      prev.includes(tag)
        ? prev.filter((t) => t !== tag)
        : prev.length >= MAX_INTERESTS ? prev : [...prev, tag]
    );
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
      if (showMe) fd.append('showMe', showMe);
      // Always sent, including when empty — that is how a user clears every interest.
      fd.append('interests', interests.join(','));
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
              <span className="text-[9px] font-bold text-[#CDFF00]">Upload</span>
            </button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImage} />
        </div>

        <div className="space-y-5">
          <div>
            <label className="text-[11px] font-bold text-gray-400 tracking-widest mb-1.5 block">Bio</label>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder="Tell people what you do..."
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-white text-sm resize-none h-24 focus:outline-none focus:border-[#CDFF00] transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-gray-400 tracking-widest mb-1.5 block">Age</label>
              <input type="number" value={age} onChange={e => setAge(e.target.value)} placeholder="e.g. 25" className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#CDFF00] transition-colors" />
            </div>
            <div>
              <label className="text-[11px] font-bold text-gray-400 tracking-widest mb-1.5 block">City</label>
              <input type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Warszawa" className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#CDFF00] transition-colors" />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-gray-400 tracking-widest mb-2 block">Looking for</label>
            <div className="flex flex-wrap gap-2">
              {LOOKING_FOR_OPTIONS.map((o) => (
                <Chip key={o} label={o} selected={lookingFor === o} onClick={() => setLookingFor(o)} />
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-2">
              <label className="text-[11px] font-bold text-gray-400 tracking-widest">Interests</label>
              <span className="text-[10px] text-gray-500">{interests.length}/{MAX_INTERESTS}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {INTEREST_OPTIONS.map((o) => {
                const selected = interests.includes(o);
                return (
                  <Chip
                    key={o}
                    label={o}
                    selected={selected}
                    disabled={!selected && interests.length >= MAX_INTERESTS}
                    onClick={() => toggleInterest(o)}
                  />
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-gray-400 tracking-widest mb-2 block">Identity</label>
            <div className="flex flex-wrap gap-2">
              <Chip label="Prefer not to say" selected={gender === ''} onClick={() => setGender('')} />
              {GENDER_OPTIONS.map((o) => (
                <Chip key={o} label={o} selected={gender === o} onClick={() => setGender(o)} />
              ))}
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-gray-400 tracking-widest mb-2 block">Show me</label>
            <div className="flex flex-wrap gap-2">
              {SHOW_ME_OPTIONS.map((o) => (
                <Chip key={o} label={o} selected={showMe === o} onClick={() => setShowMe(o)} />
              ))}
            </div>
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
/**
 * @param onUpgrade   called with a plan id ('MONTHLY' | 'QUARTERLY' | 'ANNUAL')
 * @param upgrading   the plan id currently being started, or null
 * @param plans       price list from GET /subscriptions/plans; null while loading
 */
function PremiumPaywall({ onUpgrade, upgrading, plans }) {
  const perks = [
    { icon: Heart, text: 'Unlimited swipes on creatives near you' },
    { icon: Users, text: 'See mutual matches and message instantly' },
    { icon: Zap, text: 'Priority placement in other members’ stacks' },
  ];

  // The longest term is the best per-month value, so it is worth pointing at. Derived
  // from the returned prices rather than hardcoded, so it stays correct if they change.
  const bestValueId = plans?.length
    ? plans.reduce((best, p) => (Number(p.pricePerMonth) < Number(best.pricePerMonth) ? p : best)).id
    : null;

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

        {!plans ? (
          <div className="py-6 flex justify-center">
            <span className="w-5 h-5 border-2 border-white/20 border-t-[#CDFF00] rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-2">
            {plans.map((p) => {
              const isBest = p.id === bestValueId && plans.length > 1;
              const busy = upgrading === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => onUpgrade(p.id)}
                  // Any in-flight checkout locks all three: a second click would open a
                  // second Stripe session and risk charging twice.
                  disabled={!!upgrading}
                  className={`w-full py-2.5 px-3 rounded-xl font-bold text-sm active:scale-[0.99] transition-all disabled:opacity-60 flex items-center justify-between gap-2 ${
                    isBest
                      ? 'bg-[#CDFF00] text-black hover:bg-[#d9ff33]'
                      : 'bg-white/5 text-white border border-white/10 hover:bg-white/10'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {p.label}
                    {isBest && (
                      <span className="text-[9px] font-extrabold tracking-wide px-1.5 py-0.5 rounded bg-black/20">
                        Best value
                      </span>
                    )}
                  </span>
                  {busy ? (
                    <span className={`w-4 h-4 border-2 rounded-full animate-spin ${
                      isBest ? 'border-black/30 border-t-black' : 'border-white/30 border-t-white'
                    }`} />
                  ) : (
                    <span className="text-right leading-tight">
                      <span className="block">{formatPrice(Number(p.price), 'PLN')}</span>
                      {p.months > 1 && (
                        <span className={`block text-[9px] font-medium ${isBest ? 'text-black/60' : 'text-gray-400'}`}>
                          {formatPrice(Number(p.pricePerMonth), 'PLN')}/mo
                        </span>
                      )}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
        {/* Prepaid terms, so there is nothing to cancel — the old "Cancel anytime"
            line described a recurring plan that does not exist. */}
        <p className="text-[10px] text-gray-500 mt-2.5">
          One-off payment. Access ends when the term does.
        </p>
      </div>
    </div>
  );
}

// ── Deck furniture ───────────────────────────────────────────────────────────

/**
 * A card waiting its turn underneath the top one. Dimmed rather than blurred: seeing who is
 * next is half of why the deck reads as a deck, and it makes the stack look deep instead of
 * looking like a rendering artefact.
 */
function StackCard({ profile, style, className }) {
  const fallback = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(profile.fullName || profile.id)}`;
  return (
    <motion.div style={style} className={`absolute inset-0 pointer-events-none ${className || ''}`}>
      <div className="w-full h-full rounded-3xl overflow-hidden bg-[#0A0A0A] border border-white/10">
        <img
          src={uploadUrl(profile.imageUrl || fallback)}
          alt=""
          className="w-full h-full object-cover brightness-[0.4]"
          onError={(e) => { e.target.onerror = null; e.target.src = fallback; }}
        />
      </div>
    </motion.div>
  );
}

/**
 * One of the round controls under the deck.
 *
 * @param {MotionValue} [glow] drag progress toward this button's gesture, 0→1. Wiring the
 *        gesture into the buttons means the two ways to swipe teach each other: drag a little
 *        to the right and the like button lights up, so its colour and its stamp are learned
 *        as the same action.
 */
function ActionButton({ icon: Icon, label, onClick, disabled, color, glow, large, fill }) {
  // Buttons with no gesture behind them (rewind) still need a motion value to read from, and
  // a hook can't be called conditionally — so the fallback is created unconditionally.
  const idle = useMotionValue(0);
  const source = glow ?? idle;
  const scale = useTransform(source, [0, 1], [1, 1.18]);
  const haloOpacity = useTransform(source, [0, 1], [0, 0.4]);

  const size = large ? 'w-14 h-14' : 'w-11 h-11';
  const iconSize = large ? 'w-6 h-6' : 'w-5 h-5';

  // The gesture-driven scale lives on the wrapper so the press-down scale can stay on the
  // button itself; nesting them lets both apply instead of one overwriting the other.
  return (
    <motion.div style={{ scale }} className="relative">
      <motion.span
        aria-hidden="true"
        className="absolute -inset-2 rounded-full pointer-events-none blur-lg"
        style={{ backgroundColor: color, opacity: haloOpacity }}
      />
      <button
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        title={label}
        // Border and icon share the colour of the stamp its swipe reveals, so the button and
        // the gesture read as the same action.
        style={{ borderColor: color }}
        className={`relative ${size} rounded-full bg-[#0E0E0E] border-2 flex items-center justify-center transition-transform active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100`}
      >
        <Icon className={iconSize} style={{ color, fill: fill ? color : 'none' }} />
      </button>
    </motion.div>
  );
}

// ── Main Bond Component ─────────────────────────────────────────────────────
export default function Dating() {
  const user = useSelector(selectUser);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const navigate = useNavigate();

  const [checkingAccess, setCheckingAccess] = useState(true);
  const [premium, setPremium] = useState(false);
  // Holds the plan id currently being started, not a boolean — the paywall needs to know
  // WHICH of the three buttons to show a spinner on.
  const [upgrading, setUpgrading] = useState(null);
  // Price list from the server. Null means "not loaded yet" so the paywall can show a
  // spinner rather than briefly rendering an empty plan list.
  const [plans, setPlans] = useState(null);

  const [deck, setDeck] = useState([]);
  const [myProfile, setMyProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSetup, setShowSetup] = useState(false);
  const [match, setMatch] = useState(null); // { profile, superLike } | null

  // The live gesture. Owned here rather than inside the card so the buttons, the card
  // underneath, and the card being dragged can all read the same values without re-rendering.
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const controls = useAnimationControls();
  // Locks input between committing to a swipe and the card leaving the screen, so a fast
  // double-tap can't fire two decisions at the same profile.
  const [busy, setBusy] = useState(false);
  const [rewinding, setRewinding] = useState(false);
  // Mirrors the top card's expanded state so the keyboard shortcuts don't swipe someone away
  // while their profile is open and being read.
  const [cardExpanded, setCardExpanded] = useState(false);

  // Drag → deck feedback. The card underneath rises into place as the top card leaves, which
  // is what stops the stack from looking like cards being deleted off a list.
  const progress = useTransform([x, y], ([lx, ly]) => Math.min(Math.hypot(lx, ly) / 150, 1));
  const nextScale = useTransform(progress, [0, 1], [0.94, 1]);
  const nextY = useTransform(progress, [0, 1], [16, 0]);
  const nextOpacity = useTransform(progress, [0, 1], [0.72, 1]);

  // Drag → button feedback.
  const likeGlow = useTransform(x, [40, SWIPE_DISTANCE], [0, 1]);
  const nopeGlow = useTransform(x, [-40, -SWIPE_DISTANCE], [0, 1]);
  const superGlow = useTransform(y, [-40, -SUPER_DISTANCE], [0, 1]);

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
      else {
        // Only needed for the paywall, so it is not fetched for subscribers. A failure
        // here leaves `plans` null and the paywall showing its spinner rather than an
        // empty, un-buyable panel.
        subscriptionsApi.plans()
          .then((r) => setPlans(r.data?.plans ?? []))
          .catch(() => setPlans(null));
      }
    } catch (e) {
      setPremium(false);
    } finally {
      setCheckingAccess(false);
    }
  };

  /**
   * Sends the buyer to Stripe Checkout for the chosen plan.
   *
   * Deliberately does NOT flip `premium` locally. Premium is granted only by Stripe's
   * signed webhook once the charge clears; setting it here would show the feature to
   * someone who abandoned the payment page, and the API would refuse them anyway.
   * On success the browser leaves this page entirely, so `upgrading` stays set —
   * clearing it would briefly re-enable the buttons mid-redirect.
   */
  const handleUpgrade = async (planId) => {
    setUpgrading(planId);
    try {
      const res = await subscriptionsApi.checkout(planId);
      const url = res.data?.checkoutUrl;
      if (!url) throw new Error('No checkout URL returned');
      window.location.assign(url);
    } catch (e) {
      dispatchToast('Could not start checkout — try again', 'error');
      setUpgrading(null);
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
      setDeck(all.filter(p => p && String(p.id) !== String(user?.id)));
      setMyProfile(myRes.data);
    } catch (e) {
      console.error(e);
      setDeck([]);
    } finally {
      setLoading(false);
    }
  };

  // Decode the next couple of photos while the current card is still being looked at, so a
  // fast swiper never sees the card underneath pop in.
  useEffect(() => {
    deck.slice(1, 3).forEach((p) => {
      if (p?.imageUrl) { const img = new Image(); img.src = p.imageUrl; }
    });
  }, [deck]);

  /**
   * Commits to a swipe: flies the card off in the direction of the gesture, drops it from the
   * deck, then tells the server. The animation is awaited but the request is not — a like that
   * takes 300ms to acknowledge should never hold up the next card.
   *
   * @param {'like'|'pass'|'superlike'} action
   */
  const decide = useCallback(async (action) => {
    const target = deck[0];
    if (!target || busy) return;
    setBusy(true);
    buzz(action === 'pass' ? 8 : [12, 40, 12]);

    const offX = (typeof window !== 'undefined' ? window.innerWidth : 900) + 240;
    const offY = (typeof window !== 'undefined' ? window.innerHeight : 900) + 240;
    // rotate is derived from x, so it is deliberately not animated here — driving it from two
    // places at once would make the card snap upright as it leaves.
    const flight =
      action === 'like' ? { x: offX, y: -60 }
        : action === 'pass' ? { x: -offX, y: -60 }
          : { x: 0, y: -offY };

    await controls.start({ ...flight, transition: { duration: 0.34, ease: [0.32, 0, 0.67, 0] } });

    setDeck((d) => d.slice(1));
    // Recentre for the card that takes its place. Framer flushes motion value writes on the
    // next frame, by which point the flown card has already unmounted.
    x.set(0);
    y.set(0);
    setBusy(false);

    if (action === 'pass') {
      datingApi.pass(target.id).catch(() => {});
      return;
    }

    const superLike = action === 'superlike';
    datingApi.like(target.id, superLike)
      .then((res) => {
        if (res.data?.matched) setMatch({ profile: target, superLike });
        else if (superLike) dispatchToast(`Super liked ${firstName(target)} — they'll know right away`, 'success');
      })
      .catch(() => dispatchToast('Swipe failed to save — check your connection', 'error'));
  }, [deck, busy, controls, x, y]);

  /** Rules on a released drag, then either commits to it or springs the card back to centre. */
  const handleDragEnd = (_event, info) => {
    const { offset, velocity } = info;

    const verticalGesture = Math.abs(offset.y) > Math.abs(offset.x);
    if (verticalGesture && (offset.y < -SUPER_DISTANCE || (offset.y < -MIN_TRAVEL && velocity.y < -SUPER_VELOCITY))) {
      decide('superlike');
      return;
    }
    if (offset.x > SWIPE_DISTANCE || (offset.x > MIN_TRAVEL && velocity.x > SWIPE_VELOCITY)) {
      decide('like');
      return;
    }
    if (offset.x < -SWIPE_DISTANCE || (offset.x < -MIN_TRAVEL && velocity.x < -SWIPE_VELOCITY)) {
      decide('pass');
      return;
    }
    controls.start({ x: 0, y: 0, transition: { type: 'spring', stiffness: 400, damping: 32 } });
  };

  /** Puts the last swipe back — the one action in the deck that undoes rather than decides. */
  const rewind = useCallback(async () => {
    if (rewinding || busy) return;
    setRewinding(true);
    try {
      const res = await datingApi.rewind();
      if (res.data?.rewound && res.data?.profile) {
        buzz(8);
        x.set(0);
        y.set(0);
        setDeck((d) => [res.data.profile, ...d]);
      } else if (res.data?.reason === 'matched') {
        dispatchToast("You can't undo a match", 'error');
      } else {
        dispatchToast('Nothing left to undo', 'info');
      }
    } catch {
      dispatchToast('Could not undo that swipe', 'error');
    } finally {
      setRewinding(false);
    }
  }, [rewinding, busy, x, y]);

  // Arrow keys mirror the gesture for anyone on a desktop or using a keyboard, and 'z' is the
  // usual undo. Bound to the window rather than the card so they work without focusing it.
  useEffect(() => {
    if (!premium || showSetup || match || cardExpanded) return;

    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // Never steal a keystroke that belongs to a field the user is typing in.
      if (e.target?.closest?.('input, textarea, select, [contenteditable="true"]')) return;

      const key = e.key.toLowerCase();
      if (e.key === 'ArrowLeft') { e.preventDefault(); decide('pass'); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); decide('like'); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); decide('superlike'); }
      else if (key === 'z') { e.preventDefault(); rewind(); }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [premium, showSetup, match, cardExpanded, decide, rewind]);

  const top = deck[0];
  const second = deck[1];
  const third = deck[2];

  // Whatever the last card did on its way out, the one taking its place starts centred.
  // useLayoutEffect rather than useEffect so this lands before the browser paints the new card.
  useLayoutEffect(() => {
    x.set(0);
    y.set(0);
    setCardExpanded(false);
  }, [top?.id, x, y]);

  if (checkingAccess) return (
    <div className="h-[calc(100vh-8.5rem-env(safe-area-inset-bottom))] md:h-[calc(100vh-4rem)] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#CDFF00]/20 border-t-[#CDFF00] rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="h-[calc(100vh-8.5rem-env(safe-area-inset-bottom))] md:h-[calc(100vh-4rem)] text-white font-sans flex flex-col overflow-hidden">
      {/* Header: your profile, the section, your matches — the three places to go from here. */}
      <header className="shrink-0 w-full max-w-sm mx-auto px-5 pt-3 pb-2.5 flex items-center justify-between">
        <button
          onClick={() => setShowSetup(true)}
          aria-label={myProfile ? 'Edit your Bond profile' : 'Create your Bond profile'}
          className="relative w-9 h-9 rounded-full overflow-hidden border-2 border-white/15 hover:border-[#CDFF00]/60 transition-colors group"
        >
          <img
            src={getAvatar(myProfile || user)}
            alt=""
            className="w-full h-full object-cover"
            onError={(e) => { e.target.onerror = null; e.target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.id}`; }}
          />
          <span className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <User className="w-4 h-4 text-[#CDFF00]" />
          </span>
        </button>

        <h1 className="flex items-center gap-2 text-lg sm:text-xl font-heading font-black text-white tracking-tight">
          <Heart className="w-4 h-4 text-[#CDFF00] fill-[#CDFF00]" />
          Bond
        </h1>

        <Link
          to="/dm"
          aria-label="Messages"
          className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-300 hover:text-[#CDFF00] hover:border-[#CDFF00]/40 transition-colors"
        >
          <MessageCircle className="w-4 h-4" />
        </Link>
      </header>

      {!premium ? (
        <div className="flex-1 min-h-0 flex items-center justify-center">
          <PremiumPaywall onUpgrade={handleUpgrade} upgrading={upgrading} plans={plans} />
        </div>
      ) : loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[#CDFF00]/20 border-t-[#CDFF00] rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col w-full max-w-sm mx-auto px-4 pb-2">
          {/* Nudge to set up a profile — you are discoverable either way, but a card with a
              photo and a bio is the difference between being swiped on and being skipped. */}
          {!myProfile && (
            <button
              onClick={() => setShowSetup(true)}
              className="shrink-0 mb-2.5 w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-[#CDFF00]/[0.07] border border-[#CDFF00]/25 hover:border-[#CDFF00]/50 transition-all text-left"
            >
              <Sparkles className="w-4 h-4 text-[#CDFF00] shrink-0" />
              <span className="text-xs font-bold text-white">Finish your profile</span>
              <span className="text-[10px] text-gray-400 ml-auto">You'll get swiped on more</span>
            </button>
          )}

          {/* ── The deck ──────────────────────────────────────────────────── */}
          <div className="relative flex-1 min-h-0">
            {deck.length === 0 ? (
              <div className="w-full h-full flex flex-col items-center justify-center bg-white/[0.02] border border-dashed border-white/10 rounded-3xl p-6 text-center">
                <div className="w-14 h-14 rounded-full bg-white/[0.04] flex items-center justify-center mb-4">
                  <Sparkles className="w-6 h-6 text-gray-600" />
                </div>
                <h3 className="text-sm font-bold text-white mb-1">You're all caught up</h3>
                <p className="text-xs text-gray-500 mb-5 max-w-[15rem] leading-relaxed">
                  No one new to show right now. Widen who you're shown, or take back your last
                  swipe with the undo button below.
                </p>
                <button
                  onClick={() => setShowSetup(true)}
                  className="px-4 py-2 rounded-xl bg-[#CDFF00] text-black text-xs font-bold hover:bg-[#d9ff33] active:scale-95 transition-all"
                >
                  {myProfile ? 'Preferences' : 'Create profile'}
                </button>
              </div>
            ) : (
              <>
                {third && (
                  <StackCard profile={third} style={{ scale: 0.88, y: 32, opacity: 0.45 }} />
                )}
                {second && (
                  <StackCard
                    profile={second}
                    style={{ scale: nextScale, y: nextY, opacity: nextOpacity }}
                  />
                )}
                {top && (
                  <BondCard
                    key={top.id}
                    profile={top}
                    x={x}
                    y={y}
                    controls={controls}
                    interactive={!busy}
                    onDragEnd={handleDragEnd}
                    onExpandChange={setCardExpanded}
                  />
                )}
              </>
            )}
          </div>

          {/* ── Controls ──────────────────────────────────────────────────── */}
          <div className="shrink-0 pt-4 flex justify-center items-center gap-3.5">
            <ActionButton
              icon={RotateCcw}
              label="Undo last swipe"
              color="#FFB800"
              onClick={rewind}
              disabled={rewinding || busy}
            />
            <ActionButton
              icon={X}
              label="Nope"
              color="#FF4458"
              glow={nopeGlow}
              onClick={() => decide('pass')}
              disabled={!top || busy}
              large
            />
            <ActionButton
              icon={Star}
              label="Super like"
              color="#00E0FF"
              glow={superGlow}
              onClick={() => decide('superlike')}
              disabled={!top || busy}
              fill
            />
            <ActionButton
              icon={Heart}
              label="Like"
              color="#CDFF00"
              glow={likeGlow}
              onClick={() => decide('like')}
              disabled={!top || busy}
              large
              fill
            />
          </div>
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

      {match && (
        <MatchCelebrationModal
          currentUser={user}
          matchedProfile={match.profile}
          superLike={match.superLike}
          onClose={() => setMatch(null)}
          onSendMessage={() => navigate(`/dm/${match.profile.id}`)}
        />
      )}
    </div>
  );
}
