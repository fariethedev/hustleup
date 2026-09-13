import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, useAnimationControls } from 'framer-motion';
import { useSelector } from 'react-redux';
import { selectUser, selectIsAuthenticated } from '../store/authSlice';
import { datingApi, subscriptionsApi, dispatchToast } from '../api/client';
import { isPremiumActive } from '../utils/premium';
import {
  ThumbsUp, CircleX, WandSparkles, MessageCircleMore, CircleUserRound, Aperture, Gem, UserRound,
  Rocket, Sparkle, Undo, Timer, BadgeInfo, ChartLine, CircleCheck, MoveLeft, MoveRight,
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
            <ThumbsUp className="w-5 h-5" style={{ color: accent, fill: accent, opacity: 0.5 }} />
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
            <Sparkle
              className="w-14 h-14 mx-auto mb-3"
              style={{ color: accent, fill: accent, filter: `drop-shadow(0 0 20px ${accent}66)` }}
            />
          ) : (
            <ThumbsUp
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
          <MessageCircleMore className="w-4 h-4" /> Send a message
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
// The deck pairs people by gender, so these are the two values it can act on. A profile
// without one used to be shown to everybody, which is how "Show me: Women" ended up not
// meaning it.
const GENDER_OPTIONS = ['Male', 'Female'];
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

// Three short steps rather than one long form — the same step-rail convention Register.jsx
// already established, so "animated setup" reads as a pattern the app already uses rather
// than a new one invented just for Bond.
const SETUP_STEPS = [
  { id: 1, label: 'Photo', icon: Aperture, blurb: 'A face for the deck' },
  { id: 2, label: 'About you', icon: BadgeInfo, blurb: 'The basics' },
  { id: 3, label: 'Vibe', icon: WandSparkles, blurb: "What you're into" },
];

/**
 * @param {boolean} mandatory  true for the first-run gate: no close button, and nothing
 *   underneath it can be reached until a profile is saved. false when opened to edit an
 *   existing one, where it behaves like the ordinary dismissible dialog it always was.
 */
function ProfileSetupModal({ currentUser, existing, mandatory = false, onClose, onSaved }) {
  const [step, setStep] = useState(1);
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

  // Required by the server too, which refuses the save — checked on step 1 so it explains
  // itself before the round trip rather than after it, same reasoning as before the wizard.
  const genderMissing = !gender;

  const next = () => {
    if (step === 1 && genderMissing) {
      dispatchToast('Choose Male or Female — Bond matches on it', 'error');
      return;
    }
    setStep((s) => Math.min(SETUP_STEPS.length, s + 1));
  };
  const back = () => setStep((s) => Math.max(1, s - 1));

  const handleSave = async () => {
    if (genderMissing) {
      setStep(1);
      dispatchToast('Choose Male or Female — Bond matches on it', 'error');
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      if (bio) fd.append('bio', bio);
      if (age) fd.append('age', String(age));
      if (location) fd.append('location', location);
      if (lookingFor) fd.append('lookingFor', lookingFor);
      fd.append('gender', gender);
      if (showMe) fd.append('showMe', showMe);
      // Always sent, including when empty — that is how a user clears every interest.
      fd.append('interests', interests.join(','));
      if (imageFile) fd.append('image', imageFile);
      await datingApi.saveProfile(fd);
      dispatchToast(mandatory ? "You're in — welcome to Bond!" : 'Profile saved!', 'success');
      onSaved();
      onClose();
    } catch (e) {
      // The server says which field it rejected and why; repeating "Failed to save profile"
      // over the top of that leaves someone re-pressing a button with nothing to go on.
      dispatchToast(e.response?.data?.error || 'Failed to save profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  const current = SETUP_STEPS[step - 1];
  const onFinalStep = step === SETUP_STEPS.length;

  return (
    <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md bg-[#0A0A0A] border border-white/10 rounded-2xl p-6 overflow-y-auto max-h-[90vh]"
      >
        <div className="flex items-start justify-between mb-1">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-white">
              {mandatory ? 'Set up your Bond profile' : 'Your Bond profile'}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">{current.blurb}</p>
          </div>
          {/* No way out while it's mandatory — that is the entire point of the gate. Only
              editing an already-saved profile is dismissible, since that path is never
              onboarding and closing it loses nothing the deck depends on. */}
          {!mandatory && (
            <button onClick={onClose} className="p-2 -mt-1 -mr-1 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors shrink-0">
              <CircleX className="w-4.5 h-4.5" />
            </button>
          )}
        </div>

        {/* ── Step rail ──────────────────────────────────────────────────────
            Identical mechanic to account creation's: a completed step is tappable, so
            fixing an earlier answer never means starting over. */}
        <div className="flex items-center gap-2 my-5">
          {SETUP_STEPS.map((s, i) => {
            const done = step > s.id;
            const active = step === s.id;
            const Icon = s.icon;
            return (
              <div key={s.id} className="flex items-center gap-2 flex-1 min-w-0">
                <button
                  type="button"
                  onClick={() => done && setStep(s.id)}
                  disabled={!done && !active}
                  aria-current={active ? 'step' : undefined}
                  className={`flex items-center gap-1.5 min-w-0 transition-opacity ${
                    done ? 'cursor-pointer hover:opacity-80' : 'cursor-default'
                  } ${!done && !active ? 'opacity-40' : ''}`}
                >
                  <motion.span
                    initial={false}
                    animate={{ scale: active ? 1.08 : 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${
                      done
                        ? 'bg-[#CDFF00] border-[#CDFF00] text-black'
                        : active
                          ? 'bg-[#CDFF00]/15 border-[#CDFF00]/50 text-[#CDFF00]'
                          : 'bg-white/5 border-white/10 text-gray-500'
                    }`}
                  >
                    {done ? <CircleCheck className="w-3.5 h-3.5" strokeWidth={3} /> : <Icon className="w-3.5 h-3.5" />}
                  </motion.span>
                  <span className={`text-[10px] font-black tracking-widest truncate hidden sm:block ${
                    active ? 'text-white' : 'text-gray-500'
                  }`}>
                    {s.label}
                  </span>
                </button>
                {i < SETUP_STEPS.length - 1 && (
                  <div className="flex-1 h-0.5 rounded-full bg-white/10 overflow-hidden">
                    <motion.div
                      initial={false}
                      animate={{ scaleX: step > s.id ? 1 : 0 }}
                      style={{ originX: 0 }}
                      transition={{ duration: 0.3 }}
                      className="h-full w-full bg-[#CDFF00]"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Steps slide rather than cut, so it reads as one form moving along instead of three
            unrelated screens — same treatment, same timing, as account creation. */}
        <AnimatePresence mode="wait" initial={false}>
          {step === 1 && (
            <motion.div
              key="step-1"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.2 }}
              className="space-y-5"
            >
              <div className="flex justify-center">
                <div className="relative w-28 h-28 rounded-full overflow-hidden border-2 border-white/10 bg-black">
                  <img
                    src={imagePreview || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser?.id}`}
                    className="w-full h-full object-cover"
                    alt=""
                  />
                  <button onClick={() => fileRef.current?.click()} className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                    <Aperture className="w-5 h-5 text-[#CDFF00] mb-1" />
                    <span className="text-[9px] font-bold text-[#CDFF00]">Upload</span>
                  </button>
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImage} />
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-400 tracking-widest mb-2 block">
                  I am <span className="text-[#FF4E8E]">*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {GENDER_OPTIONS.map((o) => (
                    <Chip key={o} label={o} selected={gender === o} onClick={() => setGender(o)} />
                  ))}
                </div>
                {/* Says why rather than just refusing. A required field on a dating profile
                    reads as nosy unless it is clear what it is for. */}
                <p className={`mt-2 text-[11px] leading-relaxed ${genderMissing ? 'text-[#FF4E8E]' : 'text-gray-500'}`}>
                  {genderMissing
                    ? 'Pick one to continue — Bond builds your deck from it.'
                    : 'Bond matches on this, and pairs it with your "Show me" preference on the last step.'}
                </p>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step-2"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.2 }}
              className="space-y-5"
            >
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
                <label className="text-[11px] font-bold text-gray-400 tracking-widest mb-1.5 block">Bio</label>
                <textarea
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  placeholder="Tell people what you do..."
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-white text-sm resize-none h-20 focus:outline-none focus:border-[#CDFF00] transition-colors"
                />
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step-3"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.2 }}
              className="space-y-5"
            >
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
                <label className="text-[11px] font-bold text-gray-400 tracking-widest mb-2 block">Show me</label>
                <div className="flex flex-wrap gap-2">
                  {SHOW_ME_OPTIONS.map((o) => (
                    <Chip key={o} label={o} selected={showMe === o} onClick={() => setShowMe(o)} />
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Navigation ─────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mt-7">
          {step > 1 && (
            <button
              type="button"
              onClick={back}
              className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-bold text-sm hover:bg-white/10 transition-colors flex items-center gap-1.5 shrink-0"
            >
              <MoveLeft className="w-4 h-4" /> Back
            </button>
          )}
          <button
            onClick={onFinalStep ? handleSave : next}
            disabled={saving || (step === 1 && genderMissing)}
            className="flex-1 py-3 rounded-xl bg-[#CDFF00] text-black font-bold text-sm hover:bg-[#d9ff33] active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 flex items-center justify-center gap-2"
          >
            {saving
              ? 'Saving…'
              : onFinalStep
                ? (mandatory ? 'Start swiping' : 'Save profile')
                : <>Continue <MoveRight className="w-4 h-4" /></>}
          </button>
        </div>
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
    { icon: ThumbsUp, text: 'Unlimited swipes on creatives near you' },
    { icon: UserRound, text: 'See mutual matches and message instantly' },
    { icon: Rocket, text: 'Priority placement in other members’ stacks' },
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
          <Gem className="w-5 h-5 text-[#CDFF00]" />
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

// ── Speed Round ──────────────────────────────────────────────────────────────
// A short, timed batch of the same deck, played as its own game rather than the ordinary
// browse. Nothing here is a new kind of decision — every card still resolves through
// datingApi.like/pass, so a match made in a round is exactly as real as one made outside it,
// and the server's own dedupe (see getProfiles) means nobody swiped in a round can reappear
// afterward without a separate action on the parent's part.

const SPEED_ROUND_SIZE = 8;
const SPEED_CARD_MS = 6000; // 6s to decide, or the card counts as a pass

/** In place, so calling it twice on the same array never hands back the same order. */
function shuffled(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * @param {object[]} initialDeck  the parent's current deck; a shuffled slice becomes the round
 * @param {object}   currentUser  for refetching a fresh batch on "Play again"
 * @param {Function} onFinish     called once, when leaving the game for good — the parent
 *                                closes the overlay and reloads its own deck, which by then
 *                                already excludes everyone this round decided on
 */
function SpeedDateGame({ initialDeck, currentUser, onFinish }) {
  const navigate = useNavigate();

  const [roundDeck, setRoundDeck] = useState(() => shuffled(initialDeck).slice(0, SPEED_ROUND_SIZE));
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0); // 0-100 within the current card's time budget
  const [streak, setStreak] = useState(0);     // consecutive cards decided before time ran out
  const [bestStreak, setBestStreak] = useState(0);
  const [stats, setStats] = useState({ decisions: 0, likes: 0, matches: 0, timeouts: 0 });
  const [matchesWon, setMatchesWon] = useState([]);
  const [matchFlash, setMatchFlash] = useState(null); // the profile just matched, or null
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const controls = useAnimationControls();

  const top = roundDeck[index];
  const nextProfile = roundDeck[index + 1];
  const finished = index >= roundDeck.length;
  const score = stats.decisions * 10 + stats.matches * 100 + bestStreak * 15;

  const advance = useCallback(() => {
    x.set(0);
    y.set(0);
    setBusy(false);
    setIndex((i) => i + 1);
  }, [x, y]);

  /**
   * The one thing every decision funnels through, timeout included — a card that runs out
   * the clock is scored exactly like a deliberate pass, because that is what it is: the
   * player was shown someone and, in the time given, did not choose them.
   */
  const commit = useCallback((action) => {
    if (busy || !top) return;
    setBusy(true);

    if (action === 'timeout') {
      buzz(6);
      setStreak(0);
      setStats((s) => ({ ...s, timeouts: s.timeouts + 1 }));
      datingApi.pass(top.id).catch(() => {});
      advance();
      return;
    }

    buzz(action === 'pass' ? 8 : [12, 40, 12]);
    const offX = (typeof window !== 'undefined' ? window.innerWidth : 900) + 240;
    const offY = (typeof window !== 'undefined' ? window.innerHeight : 900) + 240;
    const flight =
      action === 'like' ? { x: offX, y: -60 }
        : action === 'pass' ? { x: -offX, y: -60 }
          : { x: 0, y: -offY };

    controls.start({ ...flight, transition: { duration: 0.28, ease: [0.32, 0, 0.67, 0] } }).then(() => {
      setStreak((s) => {
        const nextStreak = s + 1;
        setBestStreak((b) => Math.max(b, nextStreak));
        return nextStreak;
      });

      if (action === 'pass') {
        setStats((s) => ({ ...s, decisions: s.decisions + 1 }));
        datingApi.pass(top.id).catch(() => {});
        advance();
        return;
      }

      const superLike = action === 'superlike';
      setStats((s) => ({ ...s, decisions: s.decisions + 1, likes: s.likes + 1 }));
      datingApi.like(top.id, superLike)
        .then((res) => {
          if (res.data?.matched) {
            setStats((s) => ({ ...s, matches: s.matches + 1 }));
            setMatchesWon((m) => [...m, top]);
            setMatchFlash(top); // advance() runs once the flash dismisses itself, below
          } else {
            advance();
          }
        })
        .catch(() => {
          dispatchToast("That one didn't save — moving on", 'error');
          advance();
        });
    });
  }, [busy, top, controls, advance]);

  /** Rules on a released drag — identical thresholds to the main deck, so the gesture that
   *  works out there works the same way in here. */
  const handleDragEnd = (_event, info) => {
    const { offset, velocity } = info;
    const verticalGesture = Math.abs(offset.y) > Math.abs(offset.x);
    if (verticalGesture && (offset.y < -SUPER_DISTANCE || (offset.y < -MIN_TRAVEL && velocity.y < -SUPER_VELOCITY))) {
      commit('superlike'); return;
    }
    if (offset.x > SWIPE_DISTANCE || (offset.x > MIN_TRAVEL && velocity.x > SWIPE_VELOCITY)) {
      commit('like'); return;
    }
    if (offset.x < -SWIPE_DISTANCE || (offset.x < -MIN_TRAVEL && velocity.x < -SWIPE_VELOCITY)) {
      commit('pass'); return;
    }
    controls.start({ x: 0, y: 0, transition: { type: 'spring', stiffness: 400, damping: 32 } });
  };

  // The per-card clock. Elapsed time rather than a fixed per-tick increment, so an
  // occasionally-late interval callback (a busy tab, a slow device) never drifts the
  // deadline itself — only how often the bar is redrawn moving toward it.
  useEffect(() => {
    setProgress(0);
    if (expanded || matchFlash || finished || !top) return undefined;
    const started = Date.now();
    const id = setInterval(() => {
      const pct = Math.min(100, ((Date.now() - started) / SPEED_CARD_MS) * 100);
      setProgress(pct);
      if (pct >= 100) {
        clearInterval(id);
        commit('timeout');
      }
    }, 100);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, expanded, matchFlash, finished]);

  // The celebration is a pause, not a checkpoint — it clears itself and the round carries on
  // without anyone having to tap through it, which is the whole point of playing this fast.
  useEffect(() => {
    if (!matchFlash) return undefined;
    const t = setTimeout(() => { setMatchFlash(null); advance(); }, 1200);
    return () => clearTimeout(t);
  }, [matchFlash, advance]);

  // Arrow keys mirror the gesture here too, same as the main deck — just without the undo,
  // which has no meaning scoped to a round that is itself disposable.
  useEffect(() => {
    if (expanded || matchFlash || finished) return undefined;
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); commit('pass'); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); commit('like'); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); commit('superlike'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded, matchFlash, finished, commit]);

  /** A fresh batch from the server, so "Play again" never replays someone just swiped on —
   *  the round that just ended has already told the server about every one of them. */
  const playAgain = async () => {
    setRefreshing(true);
    try {
      const res = await datingApi.getProfiles();
      const fresh = (res.data || []).filter((p) => p && String(p.id) !== String(currentUser?.id));
      if (fresh.length === 0) {
        dispatchToast('No one new left right now — check back later', 'info');
        return;
      }
      setRoundDeck(shuffled(fresh).slice(0, SPEED_ROUND_SIZE));
      setIndex(0);
      setStreak(0);
      setBestStreak(0);
      setStats({ decisions: 0, likes: 0, matches: 0, timeouts: 0 });
      setMatchesWon([]);
      x.set(0);
      y.set(0);
    } catch {
      dispatchToast('Could not start another round', 'error');
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[250] bg-black flex flex-col">
      <div className="shrink-0 px-4 pt-4 pb-3 flex items-center justify-between max-w-sm w-full mx-auto">
        <button
          onClick={onFinish}
          aria-label="Exit speed round"
          className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-300 hover:text-white transition-colors"
        >
          <CircleX className="w-4 h-4" />
        </button>
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-1.5 text-xs font-black tracking-widest text-white">
            <Timer className="w-3.5 h-3.5 text-[#CDFF00]" /> Speed Round
          </div>
          {!finished && (
            <span className="text-[10px] text-gray-500 font-bold mt-0.5">{index + 1} / {roundDeck.length}</span>
          )}
        </div>
        <div className={`flex items-center gap-1 text-xs font-black ${streak > 1 ? 'text-[#CDFF00]' : 'text-gray-500'}`}>
          <ChartLine className="w-3.5 h-3.5" /> {streak}
        </div>
      </div>

      {!finished ? (
        <>
          <div className="flex-1 min-h-0 max-w-sm w-full mx-auto px-4 flex flex-col">
            {/* Same live-progress technique as the Stories viewer's per-story bar. */}
            <div className="shrink-0 h-1 rounded-full bg-white/10 overflow-hidden mb-3">
              <div
                className={`h-full rounded-full transition-[width] duration-100 ease-linear ${progress > 70 ? 'bg-[#FF4458]' : 'bg-[#CDFF00]'}`}
                style={{ width: top && !matchFlash ? `${progress}%` : '0%' }}
              />
            </div>

            <div className="relative flex-1 min-h-0">
              {nextProfile && (
                <StackCard profile={nextProfile} style={{ scale: 0.94, y: 16, opacity: 0.6 }} />
              )}
              {top && (
                <BondCard
                  key={top.id}
                  profile={top}
                  x={x}
                  y={y}
                  controls={controls}
                  interactive={!busy && !matchFlash}
                  onDragEnd={handleDragEnd}
                  onExpandChange={setExpanded}
                />
              )}
              {matchFlash && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="absolute inset-0 rounded-3xl bg-black/92 backdrop-blur-md border-2 border-[#CDFF00] flex flex-col items-center justify-center text-center p-6"
                >
                  <Sparkle className="w-10 h-10 text-[#CDFF00] mb-3" style={{ filter: 'drop-shadow(0 0 16px rgba(205,255,0,0.6))' }} />
                  <p className="text-xl font-heading font-black text-white">It's a match!</p>
                  <p className="text-xs text-gray-400 mt-1">{firstName(matchFlash)} — saved for after the round</p>
                </motion.div>
              )}
            </div>
          </div>

          <div className="shrink-0 py-5 flex justify-center items-center gap-4">
            <ActionButton icon={CircleX} label="Skip" color="#FF4458" onClick={() => commit('pass')} disabled={!top || busy || !!matchFlash} large />
            <ActionButton icon={Sparkle} label="Super like" color="#00E0FF" onClick={() => commit('superlike')} disabled={!top || busy || !!matchFlash} fill />
            <ActionButton icon={ThumbsUp} label="Like" color="#CDFF00" onClick={() => commit('like')} disabled={!top || busy || !!matchFlash} large fill />
          </div>
        </>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto max-w-sm w-full mx-auto px-4 pb-6">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="pt-4 text-center">
            <div className="w-16 h-16 rounded-full bg-[#CDFF00]/10 border border-[#CDFF00]/30 flex items-center justify-center mx-auto mb-4">
              <Timer className="w-7 h-7 text-[#CDFF00]" />
            </div>
            <h2 className="text-2xl font-heading font-black text-white">Round complete</h2>
            <p className="text-sm text-gray-400 mt-1">{stats.decisions} of {roundDeck.length} decided in time</p>

            <div className="mt-6 p-5 rounded-2xl bg-white/[0.03] border border-white/10">
              <p className="text-[10px] font-black tracking-widest text-gray-500">Score</p>
              <p className="text-4xl font-heading font-black text-[#CDFF00] mt-1">{score}</p>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-4">
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10">
                <p className="text-lg font-black text-white">{stats.likes}</p>
                <p className="text-[9px] font-bold tracking-widest text-gray-500 mt-0.5">Liked</p>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10">
                <p className="text-lg font-black text-white">{stats.matches}</p>
                <p className="text-[9px] font-bold tracking-widest text-gray-500 mt-0.5">Matches</p>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10">
                <p className="text-lg font-black text-white">{bestStreak}</p>
                <p className="text-[9px] font-bold tracking-widest text-gray-500 mt-0.5">Best streak</p>
              </div>
            </div>

            {matchesWon.length > 0 && (
              <div className="mt-5 text-left">
                <p className="text-[10px] font-black tracking-widest text-gray-500 mb-2">New matches</p>
                <div className="space-y-2">
                  {matchesWon.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => navigate(`/dm/${m.id}`)}
                      className="w-full flex items-center gap-2.5 p-2.5 rounded-xl bg-white/[0.03] border border-white/10 hover:border-[#CDFF00]/40 transition-colors"
                    >
                      <img src={getAvatar(m)} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
                      <span className="text-sm font-bold text-white flex-1 text-left truncate">{m.fullName}</span>
                      <MessageCircleMore className="w-4 h-4 text-[#CDFF00] shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 mt-6">
              <button
                onClick={onFinish}
                className="flex-1 py-3 rounded-xl border border-white/15 text-white font-bold text-sm hover:bg-white/5 transition-colors"
              >
                Back to Bond
              </button>
              <button
                onClick={playAgain}
                disabled={refreshing}
                className="flex-1 py-3 rounded-xl bg-[#CDFF00] text-black font-bold text-sm hover:bg-[#d9ff33] active:scale-[0.99] transition-all disabled:opacity-50"
              >
                {refreshing ? 'Loading…' : 'Play again'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
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
  // undefined = not resolved yet; null = the server has confirmed there is none; an object =
  // the saved profile. The gate below only ever fires on the strict `null`, so a fetch that
  // merely failed (a network blip, a 500) can never lock an existing member out of Bond
  // behind a wizard they have already completed.
  const [myProfile, setMyProfile] = useState(undefined);
  const [loading, setLoading] = useState(true);
  const [showSetup, setShowSetup] = useState(false);
  const [match, setMatch] = useState(null); // { profile, superLike } | null
  // A timed, gamified batch of the same deck — see SpeedDateGame.
  const [speedMode, setSpeedMode] = useState(false);

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
        // undefined, not null, on failure — see the state comment above. A genuine "no
        // profile" response from the server is `{ data: null }`, which this never produces.
        datingApi.getMyProfile().catch(() => ({ data: undefined })),
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

  /**
   * Bond only ever shows a deck to someone with a profile of their own. Swiping on other
   * people before you are swipeable yourself is exactly the free-riding the premium gate
   * above already exists to stop — this is that same idea one step earlier, since a profile
   * costs nothing and premium alone was never what made someone worth matching with.
   */
  const needsSetup = premium && !loading && myProfile === null;

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
    if (!premium || showSetup || needsSetup || match || cardExpanded || speedMode) return;

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
  }, [premium, showSetup, needsSetup, match, cardExpanded, speedMode, decide, rewind]);

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
            <CircleUserRound className="w-4 h-4 text-[#CDFF00]" />
          </span>
        </button>

        <h1 className="flex items-center gap-2 text-lg sm:text-xl font-heading font-black text-white tracking-tight">
          <ThumbsUp className="w-4 h-4 text-[#CDFF00] fill-[#CDFF00]" />
          Bond
        </h1>

        <Link
          to="/dm"
          aria-label="Messages"
          className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-300 hover:text-[#CDFF00] hover:border-[#CDFF00]/40 transition-colors"
        >
          <MessageCircleMore className="w-4 h-4" />
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
          {/* A profile is no longer optional to reach here at all — see needsSetup below —
              so the old nudge banner has nothing left to nudge. This is its replacement: a
              faster, gamified way through the same deck, for whenever the slow one drags. */}
          {deck.length > 0 && (
            <button
              onClick={() => setSpeedMode(true)}
              className="shrink-0 mb-2.5 w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-[#CDFF00]/[0.07] border border-[#CDFF00]/25 hover:border-[#CDFF00]/50 transition-all text-left"
            >
              <Timer className="w-4 h-4 text-[#CDFF00] shrink-0" />
              <span className="text-xs font-bold text-white">Speed Round</span>
              <span className="text-[10px] text-gray-400 ml-auto">{Math.min(SPEED_ROUND_SIZE, deck.length)} faces, 6s each</span>
            </button>
          )}

          {/* ── The deck ──────────────────────────────────────────────────── */}
          <div className="relative flex-1 min-h-0">
            {deck.length === 0 ? (
              <div className="w-full h-full flex flex-col items-center justify-center bg-white/[0.02] border border-dashed border-white/10 rounded-3xl p-6 text-center">
                <div className="w-14 h-14 rounded-full bg-white/[0.04] flex items-center justify-center mb-4">
                  <WandSparkles className="w-6 h-6 text-gray-600" />
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
                  Preferences
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
              icon={Undo}
              label="Undo last swipe"
              color="#FFB800"
              onClick={rewind}
              disabled={rewinding || busy}
            />
            <ActionButton
              icon={CircleX}
              label="Nope"
              color="#FF4458"
              glow={nopeGlow}
              onClick={() => decide('pass')}
              disabled={!top || busy}
              large
            />
            <ActionButton
              icon={Sparkle}
              label="Super like"
              color="#00E0FF"
              glow={superGlow}
              onClick={() => decide('superlike')}
              disabled={!top || busy}
              fill
            />
            <ActionButton
              icon={ThumbsUp}
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

      {(showSetup || needsSetup) && (
        <ProfileSetupModal
          currentUser={user}
          existing={myProfile}
          mandatory={needsSetup}
          onClose={() => setShowSetup(false)}
          onSaved={loadData}
        />
      )}

      {speedMode && (
        <SpeedDateGame
          initialDeck={deck}
          currentUser={user}
          onFinish={() => { setSpeedMode(false); loadData(); }}
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
