import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useSelector } from 'react-redux';
import { selectIsAuthenticated } from '../store/authSlice';
import { listingsApi } from '../api/client';
import { LISTING_TYPES, CURRENCIES, POLISH_CITIES, formatPrice } from '../utils/constants';
import { SHIPPING_METHODS, defaultMethodFor, getMethod } from '../utils/shipping';
import { useSellerAccess } from '../hooks/useSellerAccess';
import SellerUpgrade from '../components/SellerUpgrade';
import { LockKeyhole, Images as ImageIcon, CircleCheck, CircleX, MoveRight, MoveLeft, CirclePlay, CalendarRange, Forklift, Grid2x2, PiggyBank, ClipboardCheck, PartyPopper, UploadCloud, Luggage, Building2 } from 'lucide-react';
import { isVideoUrl } from '../utils/media';

/**
 * How many photos/clips a listing should carry. Listings with a full gallery convert better,
 * so the form asks for this many — but it isn't a hard gate: the backend tops any listing
 * short of five up with category-matched supporting shots, so a seller with two good photos
 * still gets a complete-looking page instead of being blocked from posting.
 */
const TARGET_MEDIA = 5;

/** Hard cap on uploads, to keep a single listing from becoming a photo dump. */
const MAX_MEDIA = 10;

/**
 * Horizontal slide for the step panels.
 *
 * `custom` carries the direction, so going back travels back rather than repeating the
 * forward motion — an animation that plays the same way regardless of direction actively
 * misleads about where you are in a sequence.
 */
const slide = {
  enter: (dir) => ({ x: dir > 0 ? 48 : -48, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  // No absolute positioning on exit: that is for mode="sync", where both panels are
  // mounted at once. Under mode="wait" the old panel is gone before the new one mounts,
  // so taking it out of flow only makes the card collapse during the handover.
  exit: (dir) => ({ x: dir > 0 ? -48 : 48, opacity: 0 }),
};

export default function CreateListing() {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  // Mirrors the server's own `canSell` rule rather than the account's role — see
  // useSellerAccess. Gating on the role here is what refused the form to subscribers the
  // API would have accepted a listing from.
  const { canSell, loading: checkingAccess } = useSellerAccess();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1); // 1 = forward, -1 = back
  const [form, setForm] = useState({
    title: '', description: '', listingType: '', price: '', currency: 'PLN',
    negotiable: false, swapEnabled: false, city: '', meta: '',
    eventStartsAt: '', eventVenue: '',
    // The door. Blank capacity means uncapped, which is the honest default for a
    // free-standing gig; blank sales dates mean on sale from posting until it starts.
    eventCapacity: '', salesOpenAt: '', salesCloseAt: '',
    // LUGGAGE only. Where the bags are headed — locationCity (the `city` field above) is
    // where they're collected from, and can name more than one city as plain comma-
    // separated text. Blank capacity means uncapped, same convention as eventCapacity.
    destinationCity: '', luggageCapacityKg: '',
    // RENTAL only. Deposit, the agent's own fee, and an informational monthly bills
    // estimate — none of these are the recurring rent itself, which is just `price`.
    // payOnPlatform false (the default) keeps the listing in the standard enquiry flow.
    depositAmount: '', agentFeeAmount: '', billsAmount: '', payOnPlatform: false,
    // What this seller needs from a buyer before they can start the order — one prompt
    // per line, asked at checkout. Blank for most listings, which need nothing beyond
    // the standard contact details.
    checkoutFields: '',
    // Preselected from the category in step 1 rather than left blank — every listing needs
    // an answer, and "collection" for goods / "no shipping" for a service is right often
    // enough that most sellers only have to confirm it.
    shippingMethod: '', shippingPrice: '',
  });
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Held true for a beat after the server confirms the listing, before the redirect fires —
  // otherwise the publish reads as a plain page navigation instead of the thing it actually
  // is, the end of a three-step form.
  const [published, setPublished] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  if (!isAuthenticated) { navigate('/login'); return null; }
  // Still asking whether this account can sell. Rendering the upgrade panel during the
  // lookup would flash a paywall over the screen of someone who already pays for Premium.
  if (checkingAccess) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <span className="w-6 h-6 border-2 border-white/20 border-t-[#CDFF00] rounded-full animate-spin" />
      </div>
    );
  }

  /**
   * No selling rights yet, so this offers the subscription that grants them.
   *
   * This screen used to say buying and selling were separate accounts and offer to sign the
   * user out so they could register again on another email — and it did sign them out. That
   * was already untrue: the server grants selling to any active subscriber and stopped
   * assigning the SELLER role to new accounts, so the advice cost people their session and
   * sent them to build a duplicate account they did not need.
   */
  if (!canSell) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4 py-10">
        <SellerUpgrade
          title="Listing needs Premium"
          blurb="Posting a listing is part of Premium. It upgrades the account you are already signed in to — your orders, saved items and messages stay exactly where they are."
          onCancel={() => navigate(-1)}
        />
      </div>
    );
  }

  const handleSubmit = async () => {
    setError('');
    if (!form.title || !form.listingType || !form.price) {
      setError('Title, category, and price are required');
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('title', form.title);
      formData.append('description', form.description);
      formData.append('listingType', form.listingType);
      formData.append('price', form.price);
      formData.append('currency', form.currency);
      formData.append('negotiable', form.negotiable);
      formData.append('swapEnabled', form.swapEnabled);
      formData.append('city', form.city);
      // Delivery terms. Sent on every listing, including services, so "no shipping" is a
      // recorded choice rather than a blank the buyer has to interpret.
      formData.append('shippingMethod', form.shippingMethod || defaultMethodFor(form.listingType));
      formData.append('shippingPrice', chargesPostage ? (form.shippingPrice || '0') : '0');
      // EVENT-only. Sent as plain strings and parsed leniently server-side, so a blank
      // value from a non-event listing is simply ignored rather than rejected.
      if (form.listingType === 'EVENT') {
        formData.append('eventStartsAt', form.eventStartsAt || '');
        formData.append('eventVenue', form.eventVenue || '');
        formData.append('eventCapacity', form.eventCapacity || '');
        formData.append('salesOpenAt', form.salesOpenAt || '');
        formData.append('salesCloseAt', form.salesCloseAt || '');
      }
      // LUGGAGE- and RENTAL-only, same lenient-blank-string contract as the EVENT fields
      // above — a value from the wrong category is simply ignored server-side.
      if (form.listingType === 'LUGGAGE') {
        formData.append('destinationCity', form.destinationCity || '');
        formData.append('luggageCapacityKg', form.luggageCapacityKg || '');
      }
      if (form.listingType === 'RENTAL') {
        formData.append('depositAmount', form.depositAmount || '0');
        formData.append('agentFeeAmount', form.agentFeeAmount || '0');
        formData.append('billsAmount', form.billsAmount || '0');
        formData.append('payOnPlatform', form.payOnPlatform);
      }
      formData.append('checkoutFields', form.checkoutFields || '');
      if (form.meta) formData.append('meta', form.meta);
      images.forEach((img) => formData.append('images', img));
      
      const res = await listingsApi.create(formData);
      // The celebration is the point of this pause — navigating instantly would cut it off
      // before it played at all. loading stays true for the same stretch so the button
      // can't be hit again while the redirect is pending.
      setPublished(true);
      setTimeout(() => navigate(`/listing/${res.data.id}`), 1100);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create listing');
      setLoading(false);
    }
  };

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  /**
   * Picking a category also picks the delivery default, because the honest default differs
   * per category: goods can always be collected, a haircut is never posted. The seller can
   * still change it in step 2 — this only saves them from starting on a blank.
   */
  const setCategory = (value) =>
    setForm((prev) => ({ ...prev, listingType: value, shippingMethod: defaultMethodFor(value) }));

  // Collection, digital delivery and services have nothing to charge postage for, so the
  // price field is hidden rather than shown at zero for the seller to wonder about.
  const shippingMeta = getMethod(form.shippingMethod);
  const chargesPostage = !!shippingMeta && !['PICKUP', 'DIGITAL', 'NONE'].includes(form.shippingMethod);

  // Which way the next step should come in from. Sliding both directions the same way makes
  // going back feel like going forward, which is the one thing a stepped form has to keep
  // straight.
  const goTo = (next) => { setDirection(next > step ? 1 : -1); setStep(next); };

  // What the footer can do from here. Kept as data rather than three hand-written pairs of
  // buttons: the old form repeated Back/Next in every step with its own disabled rule, so the
  // rules drifted and step 3 could be reached with a price the previous step had rejected.
  const STEP_META = {
    1: { label: 'Basics', blurb: 'Category and title', icon: Grid2x2, canAdvance: !!(form.title && form.listingType) },
    2: { label: 'Price', blurb: 'Price and delivery', icon: PiggyBank, canAdvance: !!form.price },
    3: { label: 'Details', blurb: 'Photos and the rest', icon: ImageIcon, canAdvance: true },
  };
  const meta = STEP_META[step];
  const isLast = step === 3;

  return (
    // Centred, and only as wide as the form needs. A single card the eye can rest on is the
    // point — the page used to be a left-aligned column that grew and shrank under the
    // heading as steps changed height.
    // Mobile first: top-aligned with phone-sized padding, growing into a centred card only
    // once there is room. Vertically centring on a phone put the first field under the fold
    // whenever the keyboard opened, and py-10 on a 375px screen is a tenth of the viewport
    // spent on nothing.
    <div className="relative min-h-[calc(100dvh-3.5rem)] flex items-start sm:items-center justify-center px-3 sm:px-4 pt-4 pb-10 sm:py-10 overflow-hidden">
      {/* Two slow-drifting glows rather than a static page — fixed so they don't scroll
          with a tall step 3, and pointer-events-none so they never steal a tap meant for
          the form sitting on top of them. */}
      <motion.div
        aria-hidden="true"
        className="fixed -z-10 top-[-10%] left-[-10%] w-[55vmax] h-[55vmax] rounded-full bg-[#CDFF00]/10 blur-3xl pointer-events-none"
        animate={{ x: [0, 40, 0], y: [0, 30, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden="true"
        className="fixed -z-10 bottom-[-15%] right-[-10%] w-[50vmax] h-[50vmax] rounded-full bg-[#7D39EB]/10 blur-3xl pointer-events-none"
        animate={{ x: [0, -30, 0], y: [0, -40, 0] }}
        transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut' }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-xl"
      >
        <motion.h1
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="text-2xl sm:text-4xl font-heading font-extrabold text-white mb-1 sm:mb-2 tracking-wide text-center"
        >
          Post <span className="text-[#CDFF00]">Listing</span>
        </motion.h1>
        <AnimatePresence mode="wait">
          <motion.p
            key={step}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="text-gray-400 mb-5 sm:mb-8 font-bold tracking-wider text-xs sm:text-sm text-center"
          >
            {meta.blurb}
          </motion.p>
        </AnimatePresence>

        {/* The same rail as sign-up: icon, label, and completed steps tappable so a
            correction does not mean walking forward through the whole form again. Labels
            hide below sm — three of them do not fit a phone beside the connectors. */}
        <div className="flex items-center gap-2 mb-5 sm:mb-8">
          {[1, 2, 3].map((n) => {
            const done = step > n;
            const active = step === n;
            const Icon = STEP_META[n].icon;
            return (
              <div key={n} className="flex items-center gap-2 flex-1 min-w-0">
                <button
                  type="button"
                  onClick={() => done && goTo(n)}
                  disabled={!done && !active}
                  aria-current={active ? 'step' : undefined}
                  className={`flex items-center gap-2 min-w-0 ${done ? 'cursor-pointer hover:opacity-80' : 'cursor-default'} ${
                    !done && !active ? 'opacity-40' : ''
                  }`}
                >
                  <span className="relative shrink-0">
                    {/* A breathing ring behind the live step only — it's what makes "you are
                        here" readable at a glance instead of just a colour difference. */}
                    {active && (
                      <motion.span
                        aria-hidden="true"
                        className="absolute inset-0 rounded-xl bg-[#CDFF00]/40"
                        animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                      />
                    )}
                    <motion.span
                      initial={false}
                      animate={{ scale: active ? 1.08 : 1, rotate: done ? [0, -12, 0] : 0 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                      className={`relative w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                        done
                          ? 'bg-[#CDFF00] border-[#CDFF00] text-black'
                          : active
                            ? 'bg-[#CDFF00]/15 border-[#CDFF00]/50 text-[#CDFF00]'
                            : 'bg-white/5 border-white/10 text-gray-500'
                      }`}
                    >
                      <AnimatePresence mode="wait" initial={false}>
                        {done ? (
                          <motion.span key="done" initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 20 }}>
                            <CircleCheck className="w-4 h-4" strokeWidth={3} />
                          </motion.span>
                        ) : (
                          <motion.span key="pending" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                            <Icon className="w-4 h-4" />
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </motion.span>
                  </span>
                  <span className={`text-[11px] font-black tracking-widest truncate hidden sm:block ${
                    active ? 'text-white' : 'text-gray-500'
                  }`}>
                    {STEP_META[n].label}
                  </span>
                </button>
                {n < 3 && (
                  <div className="flex-1 h-0.5 rounded-full bg-white/10 overflow-hidden">
                    <motion.div
                      initial={false}
                      animate={{ scaleX: step > n ? 1 : 0 }}
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

        <div className="relative glass rounded-2xl sm:rounded-3xl p-4 sm:p-8 border border-white/5 overflow-hidden">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-[#CDFF00]/10 border border-[#CDFF00]/20 text-[#CDFF00] text-sm font-bold tracking-wider text-center flex items-center justify-center gap-2">
              <CircleX className="w-4 h-4" /> {error}
            </div>
          )}

          {/* One step on screen at a time, sliding in the direction of travel. */}
          {/* min-height so the card does not shrink to the footer in the beat between one
              panel leaving and the next arriving. */}
          <div className="min-h-[340px] sm:min-h-[420px]">
          <AnimatePresence mode="wait" custom={direction} initial={false}>
          {/* Step 1: Core Details */}
          {step === 1 && (
            <motion.div
              key="step-1"
              custom={direction}
              variants={slide}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-6"
            >
              <div>
                <label className="block text-xs font-black text-gray-500 tracking-widest mb-3">Category *</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {LISTING_TYPES.map((type) => {
                    const Icon = type.icon;
                    const isActive = form.listingType === type.value;
                    return (
                      <motion.button
                        key={type.value}
                        type="button"
                        onClick={() => setCategory(type.value)}
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.95 }}
                        className={`relative p-4 rounded-xl border text-center transition-colors flex flex-col items-center gap-2 overflow-hidden ${
                          isActive
                            ? 'border-[#CDFF00] text-[#CDFF00]'
                            : 'bg-black/50 border-white/10 text-gray-400 hover:border-white/30 hover:text-white'
                        }`}
                      >
                        {/* One shared fill that slides between cards rather than each one
                            fading in and out on its own — a single element in motion reads
                            as a choice moving, where independent fades on every card just
                            reads as flicker. */}
                        {isActive && (
                          <motion.span
                            layoutId="categoryHighlight"
                            className="absolute inset-0 bg-[#CDFF00]/10"
                            transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                          />
                        )}
                        <motion.span
                          animate={isActive ? { scale: [1, 1.25, 1] } : { scale: 1 }}
                          transition={{ duration: 0.35 }}
                          className="relative"
                        >
                          <Icon className="w-6 h-6" />
                        </motion.span>
                        <span className="relative text-[10px] font-bold tracking-widest">{type.label}</span>
                        <AnimatePresence>
                          {isActive && (
                            <motion.span
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0, opacity: 0 }}
                              transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                              className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[#CDFF00] text-black flex items-center justify-center"
                            >
                              <CircleCheck className="w-3 h-3" strokeWidth={3} />
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-gray-500 tracking-widest mb-2">Listing Title *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => set('title', e.target.value)}
                  className="w-full px-5 py-4 rounded-xl bg-black border border-white/10 text-white focus:border-[#CDFF00] focus:ring-1 focus:ring-[#CDFF00] outline-none transition-all font-bold"
                  placeholder="e.g. Professional Hair Braiding"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-gray-500 tracking-widest mb-2">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => set('description', e.target.value)}
                  rows={4}
                  className="w-full px-5 py-4 rounded-xl bg-black border border-white/10 text-white focus:border-[#CDFF00] focus:ring-1 focus:ring-[#CDFF00] outline-none transition-all font-medium resize-vertical"
                  placeholder="Describe your offer in detail..."
                />
              </div>

            </motion.div>
          )}

          {/* Step 2: Pricing */}
          {step === 2 && (
            <motion.div
              key="step-2"
              custom={direction}
              variants={slide}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-6"
            >
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-black text-gray-500 tracking-widest">
                      {form.listingType === 'LUGGAGE' ? 'Price per kg *'
                        : form.listingType === 'RENTAL' ? 'Monthly rent *'
                        : 'Price *'}
                    </label>
                    {/* What the buyer actually sees, spelled out as you type — the field
                        below takes a bare number, and this is the one place a seller can
                        confirm "20" became twenty złoty and not twenty of the wrong thing. */}
                    <AnimatePresence>
                      {Number(form.price) > 0 && (
                        <motion.span
                          initial={{ opacity: 0, scale: 0.8, y: -4 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                          className="text-[11px] font-black text-[#CDFF00] tracking-wide"
                        >
                          {formatPrice(Number(form.price), form.currency)}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.price}
                    onChange={(e) => set('price', e.target.value)}
                    className="w-full px-5 py-4 rounded-xl bg-black border border-white/10 text-white focus:border-[#CDFF00] focus:ring-1 focus:ring-[#CDFF00] outline-none transition-all font-black text-xl"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-gray-500 tracking-widest mb-2">Currency</label>
                  <select
                    value={form.currency}
                    onChange={(e) => set('currency', e.target.value)}
                    className="w-full px-4 py-4 rounded-xl bg-black border border-white/10 text-white focus:border-[#CDFF00] font-black outline-none transition-all"
                  >
                    {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <motion.button
                type="button"
                whileTap={{ scale: 0.98 }}
                onClick={() => set('negotiable', !form.negotiable)}
                className={`w-full p-5 rounded-xl border text-left flex items-center gap-4 transition-colors outline-none ${
                  form.negotiable ? 'bg-[#CDFF00]/10 border-[#CDFF00]' : 'bg-black/50 border-white/10 hover:border-white/30'
                }`}
              >
                <motion.div
                  animate={{ backgroundColor: form.negotiable ? '#CDFF00' : 'rgba(0,0,0,0)', borderColor: form.negotiable ? '#CDFF00' : '#4B5563' }}
                  className="w-6 h-6 rounded flex items-center justify-center border shrink-0"
                >
                  <AnimatePresence>
                    {form.negotiable && (
                      <motion.span initial={{ scale: 0, rotate: -45 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 22 }}>
                        <CircleCheck className="w-4 h-4 text-black" />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.div>
                <div>
                  <span className={`block font-black tracking-widest text-sm mb-1 ${form.negotiable ? 'text-[#CDFF00]' : 'text-gray-400'}`}>Price Negotiable</span>
                  <p className="text-xs text-gray-500 font-medium">Allow buyers to submit counter-offers</p>
                </div>
              </motion.button>

              {/* Swap Mode opt-in — off by default, because a seller who only wants cash
                  shouldn't have to field trade offers. */}
              <motion.button
                type="button"
                whileTap={{ scale: 0.98 }}
                onClick={() => set('swapEnabled', !form.swapEnabled)}
                className={`w-full p-5 rounded-xl border text-left flex items-center gap-4 transition-colors outline-none ${
                  form.swapEnabled ? 'bg-[#FF00FF]/10 border-[#FF00FF]' : 'bg-black/50 border-white/10 hover:border-white/30'
                }`}
              >
                <motion.div
                  animate={{ backgroundColor: form.swapEnabled ? '#FF00FF' : 'rgba(0,0,0,0)', borderColor: form.swapEnabled ? '#FF00FF' : '#4B5563' }}
                  className="w-6 h-6 rounded flex items-center justify-center border shrink-0"
                >
                  <AnimatePresence>
                    {form.swapEnabled && (
                      <motion.span initial={{ scale: 0, rotate: -45 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 22 }}>
                        <CircleCheck className="w-4 h-4 text-black" />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.div>
                <div>
                  <span className={`block font-black tracking-widest text-sm mb-1 ${form.swapEnabled ? 'text-[#FF00FF]' : 'text-gray-400'}`}>Open to swaps</span>
                  <p className="text-xs text-gray-500 font-medium">Let people trade an item or a skill for this instead of cash</p>
                </div>
              </motion.button>

              {/* Delivery. Asked here, next to the price, because it is part of what the buyer
                  pays and part of what the seller is promising — not an afterthought to sort
                  out in DMs once money has changed hands. The choice also decides which
                  tracking steps the seller is offered after the sale. */}
              <div>
                <label className="block text-xs font-black text-gray-500 tracking-widest mb-3 flex items-center gap-2">
                  <Forklift className="w-3.5 h-3.5" /> How do you deliver this? *
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {SHIPPING_METHODS.map((m) => {
                    const Icon = m.icon;
                    const isActive = form.shippingMethod === m.value;
                    return (
                      <motion.button
                        key={m.value}
                        type="button"
                        whileTap={{ scale: 0.96 }}
                        onClick={() => set('shippingMethod', m.value)}
                        className={`relative overflow-hidden p-3.5 rounded-xl border text-left transition-colors flex items-start gap-2.5 ${
                          isActive
                            ? 'border-[#CDFF00] text-[#CDFF00]'
                            : 'bg-black/50 border-white/10 text-gray-400 hover:border-white/30 hover:text-white'
                        }`}
                      >
                        {isActive && (
                          <motion.span
                            layoutId="shippingHighlight"
                            className="absolute inset-0 bg-[#CDFF00]/10"
                            transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                          />
                        )}
                        <Icon className="relative w-4 h-4 mt-0.5 shrink-0" />
                        <span className="relative min-w-0">
                          <span className="block text-[10px] font-black tracking-widest leading-tight">{m.label}</span>
                          <span className="block text-[10px] text-gray-500 font-medium mt-1 leading-snug">{m.hint}</span>
                        </span>
                      </motion.button>
                    );
                  })}
                </div>

                {chargesPostage && (
                  <div className="mt-3">
                    <label className="block text-[10px] font-black text-gray-500 tracking-widest mb-2">
                      Delivery cost
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.shippingPrice}
                      onChange={(e) => set('shippingPrice', e.target.value)}
                      className="w-full px-5 py-3.5 rounded-xl bg-black border border-white/10 text-white focus:border-[#CDFF00] focus:ring-1 focus:ring-[#CDFF00] outline-none transition-all font-black"
                      placeholder="0.00 — leave at 0 for free delivery"
                    />
                    {/* Says plainly what the buyer will be charged, so nobody discovers the
                        postage on Stripe's page. Postage is charged once per order, not per
                        unit, and passes to the seller in full with no platform fee on it. */}
                    <p className="mt-2 text-[10px] text-gray-500 font-medium leading-relaxed">
                      Buyers pay{' '}
                      <span className="text-[#CDFF00] font-black">
                        {formatPrice(Number(form.shippingPrice) || 0, form.currency)}
                      </span>{' '}
                      on top of the price, charged once per order. It reaches you in full.
                    </p>
                  </div>
                )}
              </div>

              {/* City picker rather than free text: browse filters everything by Polish city,
                  so a typo'd or blank city quietly drops the listing out of every city view. */}
              <div>
                <label className="block text-xs font-black text-gray-500 tracking-widest mb-2">
                  {form.listingType === 'LUGGAGE' ? 'Collection city (or cities)' : 'City / Location'}
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {POLISH_CITIES.slice(0, 6).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => set('city', c)}
                      className={`px-3.5 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all active:scale-95 ${
                        form.city === c
                          ? 'bg-[#CDFF00] text-black'
                          : 'bg-black border border-white/10 text-gray-400 hover:text-white hover:border-white/30'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  list="polish-cities"
                  value={form.city}
                  onChange={(e) => set('city', e.target.value)}
                  className="w-full px-5 py-4 rounded-xl bg-black border border-white/10 text-white focus:border-[#CDFF00] focus:ring-1 focus:ring-[#CDFF00] outline-none transition-all font-bold"
                  placeholder={form.listingType === 'LUGGAGE'
                    ? 'e.g. Warszawa, Kraków — separate more than one with a comma'
                    : 'Pick or type a city, e.g. Warszawa'}
                />
                <datalist id="polish-cities">
                  {POLISH_CITIES.map((c) => <option key={c} value={c} />)}
                </datalist>
                {form.listingType === 'LUGGAGE' && (
                  <p className="mt-1.5 text-[10px] text-gray-500 leading-relaxed">
                    Everywhere you can pick items up from before you fly. Buyers search by
                    city, so listing more than one gets you found by more of them.
                  </p>
                )}
              </div>

            </motion.div>
          )}

          {/* Step 3: Images & Summary */}
          {step === 3 && (
            <motion.div
              key="step-3"
              custom={direction}
              variants={slide}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-6"
            >
              {/* EVENT-only: a ticket has to print a date and a venue, so these are asked
                  for here rather than buried in the free-text description. */}
              {form.listingType === 'EVENT' && (
                <div className="p-5 rounded-xl bg-[#CDFF00]/5 border border-[#CDFF00]/25 space-y-4">
                  <h3 className="text-xs font-black text-[#CDFF00] tracking-widest flex items-center gap-2">
                    <CalendarRange className="w-4 h-4" /> Event details
                  </h3>
                  <div>
                    <label className="block text-[10px] font-black text-gray-500 tracking-widest mb-2">Starts</label>
                    <input
                      type="datetime-local"
                      value={form.eventStartsAt}
                      onChange={(e) => set('eventStartsAt', e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-black border border-white/10 text-white focus:border-[#CDFF00] outline-none transition-all font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-500 tracking-widest mb-2">Venue / address</label>
                    <input
                      type="text"
                      value={form.eventVenue}
                      onChange={(e) => set('eventVenue', e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-black border border-white/10 text-white focus:border-[#CDFF00] outline-none transition-all font-bold"
                      placeholder="e.g. Klub Hybrydy, ul. Złota 7/9"
                    />
                  </div>
                  {/* Capacity is what makes this a ticketed event rather than an open
                      invitation. Left blank it stays uncapped, so an organiser who does not
                      have a door limit is not forced to invent one. */}
                  <div>
                    <label className="block text-[10px] font-black text-gray-500 tracking-widest mb-2">
                      Capacity
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={form.eventCapacity}
                      onChange={(e) => set('eventCapacity', e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-black border border-white/10 text-white focus:border-[#CDFF00] outline-none transition-all font-bold"
                      placeholder="Leave blank for no limit"
                    />
                    <p className="mt-1.5 text-[10px] text-gray-500 leading-relaxed">
                      Once this many tickets are sold the event shows as sold out and stops
                      taking money. Tickets being paid for right now count towards it, so the
                      last few seats can't be sold twice.
                    </p>
                  </div>

                  {/* Both optional. Most events want neither — they go on sale immediately and
                      stop when the doors open, which is what blank means. */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-gray-500 tracking-widest mb-2">
                        Sales open
                      </label>
                      <input
                        type="datetime-local"
                        value={form.salesOpenAt}
                        onChange={(e) => set('salesOpenAt', e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-black border border-white/10 text-white focus:border-[#CDFF00] outline-none transition-all font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-gray-500 tracking-widest mb-2">
                        Sales close
                      </label>
                      <input
                        type="datetime-local"
                        value={form.salesCloseAt}
                        onChange={(e) => set('salesCloseAt', e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-black border border-white/10 text-white focus:border-[#CDFF00] outline-none transition-all font-bold"
                      />
                    </div>
                  </div>

                  <p className="text-[10px] text-gray-500 leading-relaxed">
                    Date and venue appear on every ticket, and buyers get a scannable QR code
                    once their payment clears. You scan them in from the listing's Door screen.
                    Leave the sales dates blank to sell from now until the event starts.
                  </p>
                </div>
              )}

              {/* LUGGAGE-only: where it's going, and how much weight is on offer. Price per
                  kg was already asked for in step 2 — this is the rest of what makes a bare
                  "spare luggage space" into something a buyer can actually book kilograms
                  against. */}
              {form.listingType === 'LUGGAGE' && (
                <div className="p-5 rounded-xl bg-[#CDFF00]/5 border border-[#CDFF00]/25 space-y-4">
                  <h3 className="text-xs font-black text-[#CDFF00] tracking-widest flex items-center gap-2">
                    <Luggage className="w-4 h-4" /> Trip details
                  </h3>
                  <div>
                    <label className="block text-[10px] font-black text-gray-500 tracking-widest mb-2">Destination</label>
                    <input
                      type="text"
                      value={form.destinationCity}
                      onChange={(e) => set('destinationCity', e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-black border border-white/10 text-white focus:border-[#CDFF00] outline-none transition-all font-bold"
                      placeholder="e.g. Lagos, Nigeria"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-500 tracking-widest mb-2">
                      Total space (kg)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={form.luggageCapacityKg}
                      onChange={(e) => set('luggageCapacityKg', e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-black border border-white/10 text-white focus:border-[#CDFF00] outline-none transition-all font-bold"
                      placeholder="e.g. 46 for two 23kg bags"
                    />
                    <p className="mt-1.5 text-[10px] text-gray-500 leading-relaxed">
                      Once this much has been bought the listing shows as full and stops
                      taking bookings — kg being paid for right now count towards it too, so
                      the last few can't be sold twice over. Leave blank if you'd rather not
                      set a limit yet.
                    </p>
                  </div>
                </div>
              )}

              {/* RENTAL-only: the real cost of moving in, and how a buyer gets in touch. Rent
                  itself was already asked for in step 2 — this is the deposit, the agent's
                  own fee, and an informational bills estimate, plus the one choice that
                  decides whether this listing behaves like a purchase or like a contact
                  form. */}
              {form.listingType === 'RENTAL' && (
                <div className="p-5 rounded-xl bg-[#CDFF00]/5 border border-[#CDFF00]/25 space-y-4">
                  <h3 className="text-xs font-black text-[#CDFF00] tracking-widest flex items-center gap-2">
                    <Building2 className="w-4 h-4" /> Rental terms
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-gray-500 tracking-widest mb-2">Deposit</label>
                      <input
                        type="number" min="0" step="0.01"
                        value={form.depositAmount}
                        onChange={(e) => set('depositAmount', e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-black border border-white/10 text-white focus:border-[#CDFF00] outline-none transition-all font-bold"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-gray-500 tracking-widest mb-2">Agent fee</label>
                      <input
                        type="number" min="0" step="0.01"
                        value={form.agentFeeAmount}
                        onChange={(e) => set('agentFeeAmount', e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-black border border-white/10 text-white focus:border-[#CDFF00] outline-none transition-all font-bold"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-gray-500 tracking-widest mb-2">Bills / mo</label>
                      <input
                        type="number" min="0" step="0.01"
                        value={form.billsAmount}
                        onChange={(e) => set('billsAmount', e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-black border border-white/10 text-white focus:border-[#CDFF00] outline-none transition-all font-bold"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-500 leading-relaxed">
                    Leave any of these at 0 if they don't apply. Bills are shown to buyers so
                    they can see the real monthly cost, but aren't collected by HustleSpace —
                    they're paid to you or the utility company directly.
                  </p>

                  <div>
                    <label className="block text-[10px] font-black text-gray-500 tracking-widest mb-2">
                      How buyers get in touch
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.98 }}
                        onClick={() => set('payOnPlatform', false)}
                        className={`p-3.5 rounded-xl border text-left transition-colors ${
                          !form.payOnPlatform
                            ? 'border-[#CDFF00] text-[#CDFF00] bg-[#CDFF00]/10'
                            : 'bg-black/50 border-white/10 text-gray-400 hover:border-white/30'
                        }`}
                      >
                        <span className="block text-[10px] font-black tracking-widest">Send an enquiry</span>
                        <span className="block text-[10px] mt-1 leading-snug opacity-80">
                          Nothing is charged. You accept or decline each request yourself.
                        </span>
                      </motion.button>
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.98 }}
                        onClick={() => set('payOnPlatform', true)}
                        className={`p-3.5 rounded-xl border text-left transition-colors ${
                          form.payOnPlatform
                            ? 'border-[#CDFF00] text-[#CDFF00] bg-[#CDFF00]/10'
                            : 'bg-black/50 border-white/10 text-gray-400 hover:border-white/30'
                        }`}
                      >
                        <span className="block text-[10px] font-black tracking-widest">Buyers pay online</span>
                        <span className="block text-[10px] mt-1 leading-snug opacity-80">
                          Rent, deposit and agent fee are charged immediately at booking.
                        </span>
                      </motion.button>
                    </div>
                  </div>
                </div>
              )}

              {/* What the seller needs back. Asked for here, at the point they are describing
                  the listing, because it is part of what they are selling — not an
                  afterthought to chase in DMs once someone has already paid. */}
              <div>
                <label className="block text-xs font-black text-gray-500 tracking-widest mb-2 flex items-center gap-2">
                  <ClipboardCheck className="w-3.5 h-3.5" /> What you need from the buyer
                </label>
                <textarea
                  rows={3}
                  value={form.checkoutFields}
                  onChange={(e) => set('checkoutFields', e.target.value)}
                  placeholder={['One per line, e.g.', 'Your shoe size', 'Name to print on the cake', 'Gate code for delivery'].join('\n')}
                  className="w-full px-4 py-3 rounded-xl bg-black border border-white/10 text-white placeholder-gray-600 focus:border-[#CDFF00] focus:ring-1 focus:ring-[#CDFF00] outline-none transition-all text-sm resize-none"
                />
                <p className="mt-1.5 text-[10px] text-gray-500 leading-relaxed">
                  Each line becomes a question the buyer must answer before they can pay, and
                  the answers arrive with the order. Leave blank if you only need their name,
                  email and phone — those are always collected.
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-black text-gray-500 tracking-widest">
                    Photos & video
                  </label>
                  <span className={`text-[10px] font-black tracking-widest ${
                    images.length >= TARGET_MEDIA ? 'text-[#CDFF00]' : 'text-gray-600'
                  }`}>
                    {images.length} / {TARGET_MEDIA}
                  </span>
                </div>

                <motion.label
                  animate={{ scale: dragActive ? 1.015 : 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  onDragOver={(e) => { e.preventDefault(); if (images.length < MAX_MEDIA) setDragActive(true); }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragActive(false);
                    if (images.length >= MAX_MEDIA) return;
                    const dropped = Array.from(e.dataTransfer.files).filter((f) => /^(image|video)\//.test(f.type));
                    if (dropped.length) setImages((prev) => [...prev, ...dropped].slice(0, MAX_MEDIA));
                  }}
                  className={`block w-full p-10 rounded-xl border-2 border-dashed text-center transition-colors outline-none ${
                    images.length >= MAX_MEDIA
                      ? 'border-white/10 opacity-40 cursor-not-allowed'
                      : dragActive
                        ? 'border-[#CDFF00] bg-[#CDFF00]/10'
                        : 'border-white/20 cursor-pointer hover:border-[#CDFF00]/50 hover:bg-[#CDFF00]/5'
                  }`}
                >
                  <motion.span
                    className="block"
                    animate={{ y: dragActive ? -4 : 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                  >
                    {dragActive
                      ? <UploadCloud className="w-10 h-10 mx-auto text-[#CDFF00] mb-3" />
                      : <ImageIcon className="w-10 h-10 mx-auto text-gray-500 mb-3" />}
                  </motion.span>
                  <p className="text-sm font-bold text-gray-300 tracking-widest mb-1">
                    {dragActive ? 'Drop it here' : 'Upload Media'}
                  </p>
                  <p className="text-xs text-gray-600 font-medium">
                    {images.length >= MAX_MEDIA
                      ? `Maximum ${MAX_MEDIA} items reached`
                      : `Images or short clips — aim for ${TARGET_MEDIA}`}
                  </p>
                  <input
                    type="file"
                    multiple
                    accept="image/*,video/*"
                    className="hidden"
                    disabled={images.length >= MAX_MEDIA}
                    // slice() enforces the cap even when someone multi-selects past it in the
                    // file picker, where the disabled attribute can't help.
                    onChange={(e) => {
                      setImages([...images, ...Array.from(e.target.files)].slice(0, MAX_MEDIA));
                      // Clearing the input lets the same file be re-picked after a removal;
                      // otherwise the browser suppresses the change event as a no-op.
                      e.target.value = '';
                    }}
                  />
                </motion.label>

                {/* Honest about what happens with a thin gallery, rather than blocking the
                    seller or quietly padding without telling them. */}
                <p className={`text-[10px] mt-2 leading-relaxed ${
                  images.length >= TARGET_MEDIA ? 'text-[#CDFF00]' : 'text-gray-500'
                }`}>
                  {images.length >= TARGET_MEDIA
                    ? 'Great — your listing will show a full gallery of your own media.'
                    : `Listings with ${TARGET_MEDIA}+ photos get noticed. Post fewer and we'll fill the rest of the gallery with ${
                        LISTING_TYPES.find((t) => t.value === form.listingType)?.label.toLowerCase() || 'category'
                      } stock shots behind yours.`}
                </p>

                {images.length > 0 && (
                  <div className="flex flex-wrap gap-3 mt-4">
                    <AnimatePresence>
                      {images.map((file, i) => (
                        <MediaThumb
                          key={`${file.name}-${file.lastModified}-${i}`}
                          file={file}
                          isLead={i === 0}
                          onRemove={() => setImages(images.filter((_, idx) => idx !== i))}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </div>

              {/* Summary */}
              <div className="p-6 rounded-xl bg-black border border-white/10 space-y-3">
                <h3 className="text-xs font-black text-[#CDFF00] tracking-widest mb-4">Summary</h3>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500 font-bold tracking-widest text-[10px]">Category</span>
                  <span className="text-white font-bold">{LISTING_TYPES.find(t => t.value === form.listingType)?.label}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500 font-bold tracking-widest text-[10px]">Title</span>
                  <span className="text-white font-bold">{form.title}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500 font-bold tracking-widest text-[10px]">Price</span>
                  <span className="text-white font-black">{form.price} {form.currency} {form.negotiable && <span className="text-[#CDFF00] ml-1">(OBO)</span>}</span>
                </div>
                {form.listingType === 'EVENT' && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500 font-bold tracking-widest text-[10px]">Starts</span>
                    <span className="text-white font-bold">
                      {form.eventStartsAt ? new Date(form.eventStartsAt).toLocaleString() : 'Not set'}
                    </span>
                  </div>
                )}
                {form.listingType === 'LUGGAGE' && (
                  <>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500 font-bold tracking-widest text-[10px]">Route</span>
                      <span className="text-white font-bold text-right">
                        {form.city || 'Not set'} → {form.destinationCity || 'Not set'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500 font-bold tracking-widest text-[10px]">Space</span>
                      <span className="text-white font-bold">
                        {form.luggageCapacityKg ? `${form.luggageCapacityKg}kg` : 'No limit set'}
                      </span>
                    </div>
                  </>
                )}
                {form.listingType === 'RENTAL' && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500 font-bold tracking-widest text-[10px]">Buyers</span>
                    <span className="text-white font-bold">
                      {form.payOnPlatform ? 'Pay online' : 'Send an enquiry'}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500 font-bold tracking-widest text-[10px]">Media</span>
                  <span className="text-white font-bold">
                    {images.length > 0 ? `${images.length} uploaded` : 'None — gallery will be filled for you'}
                  </span>
                </div>
              </div>

            </motion.div>
          )}
          </AnimatePresence>
          </div>

          {/* One footer for the whole card.
              Every step used to end in its own pair of buttons, which meant the same Back/Next
              written three times with three separate disabled rules — and they had drifted, so
              step 3 was reachable with a price step 2 would have refused. Deriving both the
              label and the guard from STEP_META means a step cannot be advanced past its own
              requirements, and the last step is the only one that submits. */}
          <div className="flex gap-3 pt-8">
            {step > 1 && (
              <button
                onClick={() => goTo(step - 1)}
                disabled={loading}
                className="flex-1 py-4 rounded-xl glass bg-black/40 border border-white/10 text-white font-bold tracking-widest hover:bg-white/5 transition-all flex items-center justify-center gap-2 outline-none disabled:opacity-50"
              >
                <MoveLeft className="w-4 h-4" /> Back
              </button>
            )}
            <motion.button
              whileTap={meta.canAdvance && !loading ? { scale: 0.97 } : {}}
              onClick={() => (isLast ? handleSubmit() : goTo(step + 1))}
              disabled={loading || !meta.canAdvance}
              className={`${step > 1 ? 'flex-[2]' : 'w-full'} py-4 rounded-xl bg-[#CDFF00] text-black font-black tracking-widest hover:bg-[#E0FF4D] shadow-lg hover:shadow-[#CDFF00]/20 transition-all flex items-center justify-center gap-2 outline-none disabled:opacity-50 disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed`}
            >
              {loading
                ? <><span className="w-4 h-4 border-2 border-black/25 border-t-black rounded-full animate-spin" /> Publishing…</>
                : isLast
                  ? 'Publish Listing'
                  : <>Next <MoveRight className="w-5 h-5" /></>}
            </motion.button>
          </div>

          {/* The moment the whole form was building to — held on screen just long enough to
              register before the redirect takes over, so publishing reads as an event rather
              than a page load. A child of the card itself (not a sibling after it), so
              `absolute inset-0` covers exactly the card's own rounded box. */}
          <AnimatePresence>
          {published && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 rounded-2xl sm:rounded-3xl bg-black/90 backdrop-blur-md flex flex-col items-center justify-center gap-4 z-20"
            >
              {/* A handful of specks thrown outward from behind the badge — cheap in code,
                  reads as confetti. Randomised once via index rather than on every render, or
                  the burst would silently reset itself on each of this overlay's re-renders. */}
              {Array.from({ length: 14 }).map((_, i) => {
                const angle = (i / 14) * Math.PI * 2;
                const distance = 90 + (i % 3) * 30;
                const colour = [ '#CDFF00', '#FF00FF', '#00FFFF' ][i % 3];
                return (
                  <motion.span
                    key={i}
                    initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                    animate={{ x: Math.cos(angle) * distance, y: Math.sin(angle) * distance, opacity: 0, scale: 0 }}
                    transition={{ duration: 0.9, ease: 'easeOut' }}
                    style={{ background: colour }}
                    className="absolute w-2 h-2 rounded-full"
                  />
                );
              })}
              <motion.div
                initial={{ scale: 0, rotate: -30 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 15, delay: 0.1 }}
                className="w-16 h-16 rounded-full bg-[#CDFF00] flex items-center justify-center"
              >
                <PartyPopper className="w-8 h-8 text-black" />
              </motion.div>
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="text-lg font-heading font-black text-white tracking-tight"
              >
                Listing published!
              </motion.p>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.35 }}
                className="text-xs text-gray-400 font-bold tracking-widest"
              >
                Taking you there now…
              </motion.p>
            </motion.div>
          )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

/**
 * Preview tile for one file queued for upload — a still for images, a poster-less <video>
 * for clips so the seller can confirm they picked the right take.
 *
 * The object URL is created in an effect and revoked on unmount. Calling
 * `URL.createObjectURL` inline during render (as this form used to) allocates a fresh blob
 * URL on every re-render and never releases any of them, which leaks the whole file in memory
 * each time — noticeable fast when the files are video.
 */
function MediaThumb({ file, isLead, onRemove }) {
  const [url, setUrl] = useState('');
  const isVideo = file.type ? file.type.startsWith('video/') : isVideoUrl(file.name);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  return (
    <motion.div
      layout
      initial={{ scale: 0, rotate: -8, opacity: 0 }}
      animate={{ scale: 1, rotate: 0, opacity: 1 }}
      exit={{ scale: 0, rotate: 8, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 500, damping: 28 }}
      className="relative group"
    >
      {isVideo ? (
        <video src={url} muted className="w-24 h-24 rounded-lg object-cover bg-black" />
      ) : (
        <img src={url} alt="" className="w-24 h-24 rounded-lg object-cover" />
      )}

      {isVideo && (
        <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/80 text-[8px] font-black tracking-widest text-white flex items-center gap-1">
          <CirclePlay className="w-2 h-2 fill-white" /> Clip
        </span>
      )}

      {/* The first item is the one that shows on browse cards and shares, so it's worth
          calling out which photo the seller is actually leading with. */}
      {isLead && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 20, delay: 0.1 }}
          className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-[#CDFF00] text-[8px] font-black tracking-widest text-black"
        >
          Cover
        </motion.span>
      )}

      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove this file"
        className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-[#CDFF00] text-black flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
      >
        <CircleX className="w-3 h-3" />
      </button>
    </motion.div>
  );
}
