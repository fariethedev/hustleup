import { useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { selectUser, loadUserProfile } from '../store/authSlice';
import { usersApi, shopsApi, dispatchToast } from '../api/client';
import { LISTING_TYPES, POLISH_CITIES } from '../utils/constants';
import { invalidateShops } from '../hooks/useShops';
import { Camera, Check, ArrowRight, ArrowLeft, Store, MapPin, Sparkles, X } from 'lucide-react';

/**
 * Seller shop-setup, shown right after registering (and reachable again from the
 * Dashboard prompt for sellers who skipped it). Buyers never see it — they have nothing
 * to configure, so registration routes them straight to the dashboard.
 *
 * <h3>Why this is a three-step flow rather than one form</h3>
 * It used to present name, city, banner and six category tiles as a single scrolling
 * page. Everything was equally weighted, so the one field that actually gates submission —
 * the shop name — had no more prominence than an optional banner, and the page opened on a
 * wall of inputs before the seller had done anything. Splitting it means each screen asks
 * one thing, and the Continue button can say whether that thing is done.
 *
 * The live preview is the point of the redesign: a seller is building something buyers
 * will see, and previously they built it blind and only met the result on Explore. Now the
 * card assembles as they type.
 */

/** The steps, in order. Kept as data so the progress bar and validation read from one place. */
const STEPS = [
  { id: 'identity', label: 'Identity', hint: 'What your shop is called and where it trades' },
  { id: 'look', label: 'Look', hint: 'The banner buyers see first' },
  { id: 'category', label: 'Category', hint: 'How buyers find you when browsing' },
];

/** Extra context for the categories whose choice changes how selling actually works. */
const CATEGORY_NOTES = {
  HAIR_BEAUTY: "You'll set open appointment slots from your dashboard, and buyers book a specific time rather than negotiating one.",
  SKILL: "You'll set open appointment slots from your dashboard, and buyers book a specific time rather than negotiating one.",
  EVENT: "Buyers can buy tickets directly, and you get a composer for posting updates about your event.",
};

export default function Onboarding() {
  const user = useSelector(selectUser);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const bannerInputRef = useRef(null);

  // Onboarding used to write shopCategory onto the USER and stop there, so a seller could
  // finish this screen and still have no storefront — nothing on Explore, nothing to attach
  // products to. These fields create the real Shop record.
  const [shopName, setShopName] = useState('');
  const [city, setCity] = useState('');
  const [category, setCategory] = useState('');
  const [bannerFile, setBannerFile] = useState(null);
  const [bannerPreview, setBannerPreview] = useState('');
  const [saving, setSaving] = useState(false);

  const [step, setStep] = useState(0);
  // Which way the next screen should travel. Sliding both directions the same way makes
  // Back feel like another Continue.
  const [direction, setDirection] = useState(1);

  const selected = useMemo(() => LISTING_TYPES.find((t) => t.value === category), [category]);
  const categoryLabel = selected?.label || '';
  const effectiveCity = city || user?.city || '';

  /** Only the name is required; the rest of the flow is skippable without breaking a shop. */
  const canAdvance = step === 0 ? shopName.trim().length > 0 : true;
  const isLast = step === STEPS.length - 1;

  const go = (delta) => {
    setDirection(delta);
    setStep((s) => Math.min(STEPS.length - 1, Math.max(0, s + delta)));
  };

  const finish = async () => {
    if (!shopName.trim()) { dispatchToast('Give your shop a name', 'error'); setStep(0); return; }
    setSaving(true);
    try {
      // Keep the user-level fields — the dashboard and profile still read them.
      if (bannerFile) await usersApi.uploadBanner(bannerFile);
      if (category) await usersApi.updateProfile({ shopCategory: category });

      // Then create (or update) the actual storefront, which is what Explore lists and what
      // products hang off. A seller may already have one if they reach this screen again
      // from the dashboard prompt, so this upserts rather than assuming a clean slate.
      const existing = await shopsApi.mine().then((r) => r.data).catch(() => null);
      const payload = {
        name: shopName.trim(),
        category: categoryLabel,
        city: effectiveCity,
      };
      const shop = existing
        ? (await shopsApi.update(existing.id, payload)).data
        : (await shopsApi.create(payload)).data;

      // The banner has to be uploaded against the shop, since shop media is ownership-scoped
      // to that record — the user-level upload above only covers the profile banner.
      if (bannerFile && shop?.id) {
        try {
          const media = await shopsApi.uploadMedia(shop.id, bannerFile);
          await shopsApi.update(shop.id, { bannerUrl: media.data.url });
        } catch { /* banner is optional — a shop without one still works */ }
      }

      invalidateShops();
      dispatch(loadUserProfile());
      dispatchToast('Your shop is live', 'success');
      navigate('/dashboard');
    } catch (e) {
      dispatchToast(e.response?.data?.message || 'Could not save shop setup', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleBanner = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBannerFile(file);
    setBannerPreview(URL.createObjectURL(file));
  };

  const clearBanner = () => {
    // Revoking matters here: the object URL survives the component otherwise, and a seller
    // trying banners repeatedly leaks one blob per attempt.
    if (bannerPreview) URL.revokeObjectURL(bannerPreview);
    setBannerFile(null);
    setBannerPreview('');
  };

  if (user?.role !== 'SELLER') {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', bounce: 0.35, duration: 0.6 }}
        >
          <div className="w-16 h-16 rounded-2xl bg-[#CDFF00]/10 border border-[#CDFF00]/30 flex items-center justify-center mx-auto mb-5">
            <Sparkles className="w-8 h-8 text-[#CDFF00]" />
          </div>
          <h1 className="text-2xl font-black text-white mb-2">You're all set!</h1>
          <p className="text-gray-400 text-sm mb-6">Jump in and start exploring HustleSpace.</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-8 py-3 rounded-xl bg-[#CDFF00] text-black font-bold text-sm hover:bg-[#d9ff33] active:scale-95 transition-all"
          >
            Go to Dashboard
          </button>
        </motion.div>
      </div>
    );
  }

  // Slide the outgoing screen out the way the new one is arriving from. Reduced motion
  // gets a plain cross-fade — the flow still reads as steps without the travel.
  const slide = {
    enter: (dir) => (reduceMotion ? { opacity: 0 } : { opacity: 0, x: dir > 0 ? 40 : -40 }),
    center: { opacity: 1, x: 0 },
    exit: (dir) => (reduceMotion ? { opacity: 0 } : { opacity: 0, x: dir > 0 ? -40 : 40 }),
  };

  // Fields arrive one after another rather than all at once, which gives the eye an order
  // to read them in.
  const stagger = {
    hidden: {},
    show: { transition: { staggerChildren: reduceMotion ? 0 : 0.07, delayChildren: 0.05 } },
  };
  const item = {
    hidden: reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0, transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] } },
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 sm:py-14">
      {/* ── Header + progress ─────────────────────────────────────────────── */}
      <div className="mb-8">
        <span className="text-[10px] font-black uppercase tracking-[0.35em] text-[#CDFF00] mb-2 block">
          Welcome, seller
        </span>
        <h1 className="text-2xl sm:text-3xl font-black text-white mb-1.5">Set up your shop</h1>
        <p className="text-sm text-gray-400">
          Three quick steps. You can change any of it later from your dashboard.
        </p>

        <div className="mt-6">
          <div className="flex items-center gap-2 mb-2.5">
            {STEPS.map((s, i) => {
              const done = i < step;
              const active = i === step;
              return (
                <div key={s.id} className="flex items-center gap-2 flex-1 last:flex-none">
                  <motion.button
                    type="button"
                    // Only backwards: skipping ahead past an unfilled name would land on a
                    // Continue that cannot submit, with nothing saying why.
                    onClick={() => { if (i < step) { setDirection(-1); setStep(i); } }}
                    disabled={i > step}
                    animate={{ scale: active && !reduceMotion ? 1.08 : 1 }}
                    transition={{ type: 'spring', bounce: 0.5, duration: 0.4 }}
                    className={`shrink-0 w-7 h-7 rounded-full grid place-items-center text-[10px] font-black border transition-colors ${
                      done
                        ? 'bg-[#CDFF00] text-black border-[#CDFF00] cursor-pointer'
                        : active
                          ? 'bg-[#CDFF00]/15 text-[#CDFF00] border-[#CDFF00]'
                          : 'bg-white/5 text-gray-600 border-white/10 cursor-default'
                    }`}
                    aria-label={`Step ${i + 1}: ${s.label}`}
                    aria-current={active ? 'step' : undefined}
                  >
                    {done ? <Check className="w-3.5 h-3.5" /> : i + 1}
                  </motion.button>
                  {i < STEPS.length - 1 && (
                    <div className="h-[2px] flex-1 rounded-full bg-white/10 overflow-hidden">
                      <motion.div
                        className="h-full bg-[#CDFF00]"
                        initial={false}
                        animate={{ width: i < step ? '100%' : '0%' }}
                        transition={{ duration: reduceMotion ? 0 : 0.4, ease: 'easeOut' }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <AnimatePresence mode="wait">
            <motion.p
              key={STEPS[step].id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="text-[11px] text-gray-500"
            >
              Step {step + 1} of {STEPS.length} · {STEPS[step].hint}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>

      {/* ── Live preview ──────────────────────────────────────────────────────
          The card buyers will see, assembling as the form is filled in. Previously a
          seller built their storefront blind and first met the result on Explore. */}
      <motion.div
        layout
        className="mb-8 rounded-2xl border border-white/10 overflow-hidden bg-white/[0.02]"
      >
        <div className="relative h-28 sm:h-32 overflow-hidden">
          <AnimatePresence mode="wait">
            {bannerPreview ? (
              <motion.img
                key="banner"
                src={bannerPreview}
                alt=""
                initial={{ opacity: 0, scale: 1.06 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.45, ease: 'easeOut' }}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <motion.div
                // Keyed on the category so switching category cross-fades the gradient.
                key={category || 'empty'}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                className={`absolute inset-0 bg-gradient-to-br ${selected?.color || 'from-white/10 to-white/5'}`}
              />
            )}
          </AnimatePresence>
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
          <span className="absolute top-2.5 left-3 text-[9px] font-black uppercase tracking-[0.2em] text-white/60">
            Preview
          </span>
        </div>

        <div className="px-4 py-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#CDFF00] grid place-items-center shrink-0">
            {selected ? <selected.icon className="w-5 h-5 text-black" /> : <Store className="w-5 h-5 text-black" />}
          </div>
          <div className="min-w-0">
            <motion.p
              layout
              className={`text-sm font-black truncate ${shopName.trim() ? 'text-white' : 'text-gray-600'}`}
            >
              {shopName.trim() || 'Your shop name'}
            </motion.p>
            <p className="text-[11px] text-gray-500 flex items-center gap-1.5 truncate">
              {categoryLabel || 'Uncategorised'}
              {effectiveCity && <><span className="text-gray-700">·</span><MapPin className="w-3 h-3 shrink-0" />{effectiveCity}</>}
            </p>
          </div>
        </div>
      </motion.div>

      {/* ── Step body ─────────────────────────────────────────────────────── */}
      <div className="min-h-[280px]">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={STEPS[step].id}
            custom={direction}
            variants={slide}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          >
            <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-5">

              {step === 0 && (
                <>
                  <motion.div variants={item}>
                    <label htmlFor="shop-name" className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2.5">
                      Shop name
                    </label>
                    <input
                      id="shop-name"
                      type="text"
                      autoFocus
                      value={shopName}
                      onChange={(e) => setShopName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && canAdvance) go(1); }}
                      maxLength={80}
                      placeholder="e.g. Piękna Moda"
                      className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#CDFF00] focus:ring-1 focus:ring-[#CDFF00] transition-all"
                    />
                    <div className="flex justify-between mt-1.5">
                      <p className="text-[11px] text-gray-500">This is the only thing you have to fill in.</p>
                      <span className={`text-[11px] tabular-nums ${shopName.length > 70 ? 'text-amber-400' : 'text-gray-600'}`}>
                        {shopName.length}/80
                      </span>
                    </div>
                  </motion.div>

                  <motion.div variants={item}>
                    <label htmlFor="shop-city" className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2.5">
                      City
                    </label>
                    <select
                      id="shop-city"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#CDFF00] focus:ring-1 focus:ring-[#CDFF00] transition-all cursor-pointer"
                    >
                      <option value="">{user?.city ? `Use my profile city (${user.city})` : 'Pick a city'}</option>
                      {POLISH_CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <p className="text-[11px] text-gray-500 mt-1.5">
                      Buyers filter Explore by city, so this is how people nearby find you.
                    </p>
                  </motion.div>
                </>
              )}

              {step === 1 && (
                <motion.div variants={item}>
                  <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2.5">
                    Shop banner
                  </label>
                  <motion.div
                    whileHover={reduceMotion ? undefined : { scale: 1.006 }}
                    whileTap={reduceMotion ? undefined : { scale: 0.994 }}
                    onClick={() => bannerInputRef.current?.click()}
                    className="group relative h-44 rounded-2xl border-2 border-dashed border-white/15 hover:border-[#CDFF00]/60 transition-colors cursor-pointer overflow-hidden grid place-items-center bg-white/[0.03]"
                  >
                    {bannerPreview ? (
                      <>
                        <img src={bannerPreview} className="w-full h-full object-cover" alt="Banner preview" />
                        <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity grid place-items-center">
                          <span className="text-xs font-bold uppercase tracking-widest text-white">Replace</span>
                        </div>
                      </>
                    ) : (
                      <motion.span
                        initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex flex-col items-center gap-2 text-gray-600 group-hover:text-[#CDFF00] transition-colors"
                      >
                        <Camera className="w-7 h-7" />
                        <span className="text-xs font-bold uppercase tracking-widest">Upload a banner</span>
                        <span className="text-[10px] text-gray-600 normal-case tracking-normal font-medium">
                          Wide images look best — around 1200×400
                        </span>
                      </motion.span>
                    )}
                    <input ref={bannerInputRef} type="file" accept="image/*" hidden onChange={handleBanner} />
                  </motion.div>

                  <div className="flex items-center justify-between mt-2.5">
                    <p className="text-[11px] text-gray-500">
                      Optional — a category colour is used until you add one.
                    </p>
                    <AnimatePresence>
                      {bannerPreview && (
                        <motion.button
                          type="button"
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          onClick={clearBanner}
                          className="flex items-center gap-1 text-[11px] font-semibold text-gray-500 hover:text-red-400 transition-colors"
                        >
                          <X className="w-3 h-3" /> Remove
                        </motion.button>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div variants={item}>
                  <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2.5">
                    What kind of shop is this?
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {LISTING_TYPES.map((cat) => {
                      const active = category === cat.value;
                      return (
                        <motion.button
                          key={cat.value}
                          type="button"
                          onClick={() => setCategory(active ? '' : cat.value)}
                          whileHover={reduceMotion ? undefined : { y: -2 }}
                          whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                          aria-pressed={active}
                          className={`relative flex flex-col items-center gap-2 p-4 rounded-2xl border transition-colors ${
                            active
                              ? 'bg-[#CDFF00]/10 border-[#CDFF00] text-white'
                              : 'bg-white/[0.03] border-white/10 text-gray-400 hover:border-white/25 hover:text-white'
                          }`}
                        >
                          <AnimatePresence>
                            {active && (
                              <motion.span
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0, opacity: 0 }}
                                transition={{ type: 'spring', bounce: 0.6, duration: 0.4 }}
                                className="absolute top-2 right-2"
                              >
                                <Check className="w-4 h-4 text-[#CDFF00]" />
                              </motion.span>
                            )}
                          </AnimatePresence>
                          <cat.icon className={`w-6 h-6 transition-colors ${active ? 'text-[#CDFF00]' : ''}`} />
                          <span className="text-[11px] font-bold text-center leading-tight">{cat.label}</span>
                        </motion.button>
                      );
                    })}
                  </div>

                  {/* Choosing one of these changes how selling actually works, so it is
                      worth saying before they commit rather than in the dashboard later. */}
                  <AnimatePresence mode="wait">
                    {CATEGORY_NOTES[category] && (
                      <motion.p
                        key={category}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25 }}
                        className="text-[11px] text-gray-500 mt-3 overflow-hidden"
                      >
                        {CATEGORY_NOTES[category]}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}

            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Navigation ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 mt-8 pt-5 border-t border-white/5">
        {step === 0 ? (
          <button
            /* Skipping means nothing was set up, so there is nothing to manage — the
               dashboard would be an empty admin panel. The feed is where the app is. */
            onClick={() => navigate('/feed')}
            className="text-sm font-semibold text-gray-500 hover:text-white transition-colors"
          >
            Skip for now
          </button>
        ) : (
          <button
            onClick={() => go(-1)}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        )}

        <motion.button
          onClick={() => (isLast ? finish() : go(1))}
          disabled={!canAdvance || saving}
          whileTap={reduceMotion || !canAdvance ? undefined : { scale: 0.97 }}
          className="px-7 py-3 rounded-xl bg-[#CDFF00] text-black font-bold text-sm hover:bg-[#d9ff33] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {saving ? (
            <>
              <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              Creating…
            </>
          ) : isLast ? (
            <>Create my shop <Sparkles className="w-4 h-4" /></>
          ) : (
            <>Continue <ArrowRight className="w-4 h-4" /></>
          )}
        </motion.button>
      </div>
    </div>
  );
}
