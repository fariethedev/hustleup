import { useRef, useState } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { MapPin, Info, ChevronDown, Star, Quote, Sparkles } from 'lucide-react';
import { uploadUrl } from '../config';

/**
 * The top, interactive card of the Hustle Bond deck.
 *
 * <h3>Why the motion values come from the parent</h3>
 * `x` and `y` are owned by the page rather than by this component, and the drag gesture writes
 * straight into them. That single detail is what makes the deck feel like a native app instead
 * of a web page: the card position never passes through React state, so a drag repaints on the
 * compositor at 60fps rather than re-rendering the tree on every pointer move. It also lets the
 * page derive things from the same gesture — the action buttons light up as you drag toward
 * them, and the card underneath grows into place — without any of them talking to each other.
 *
 * @param {object}   profile     the card's profile: fullName, age, bio, location, lookingFor,
 *                               interests (comma-separated), imageUrl, likedYou
 * @param {MotionValue} x        horizontal drag offset, owned by the page
 * @param {MotionValue} y        vertical drag offset, owned by the page
 * @param {AnimationControls} controls  used by the page to fly the card off on a decision
 * @param {boolean}  interactive false while a decision is animating out, to lock the gesture
 * @param {Function} onDragEnd   receives framer's (event, info) so the page can rule on the swipe
 * @param {Function} onExpandChange  told when the full profile opens or closes, so the page can
 *                                   stand its keyboard shortcuts down while it is being read
 */
export default function BondCard({
  profile, x, y, controls, interactive = true, onDragEnd, onExpandChange,
}) {
  const [expanded, setExpanded] = useState(false);

  // A drag that ends over the info button would otherwise register as a click on it.
  const dragged = useRef(false);

  const setSheet = (open) => {
    setExpanded(open);
    onExpandChange?.(open);
  };

  // Which way the card tilts depends on where it was grabbed: +1 for the top half, -1 for the
  // bottom. Push a real photo across a table by its top edge and the top leads while the bottom
  // trails; push it by the bottom edge and it swings the other way. Rotating one fixed
  // direction regardless of grab point is the tell that a deck was built from a tutorial.
  const tilt = useMotionValue(1);
  const rotate = useTransform(
    [x, tilt],
    ([lx, dir]) => Math.max(-22, Math.min(22, (lx / 320) * 22)) * dir
  );

  // Which stamp shows is decided by the dominant axis, not by each axis independently:
  // without this, a swipe up and slightly right would light up SUPER LIKE and LIKE at once.
  const horizontal = useTransform([x, y], ([lx, ly]) => (ly < 0 && Math.abs(ly) > Math.abs(lx) ? 0 : lx));
  const vertical = useTransform([x, y], ([lx, ly]) => (Math.abs(ly) > Math.abs(lx) ? ly : 0));

  const likeOpacity = useTransform(horizontal, [25, 120], [0, 1]);
  const nopeOpacity = useTransform(horizontal, [-25, -120], [0, 1]);
  const superOpacity = useTransform(vertical, [-40, -130], [0, 1]);

  const likeScale = useTransform(likeOpacity, [0, 1], [0.75, 1]);
  const nopeScale = useTransform(nopeOpacity, [0, 1], [0.75, 1]);
  const superScale = useTransform(superOpacity, [0, 1], [0.75, 1]);

  const interests = (profile.interests || '')
    .split(',')
    .map((i) => i.trim())
    .filter(Boolean);

  const fallback = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(profile.fullName || profile.id)}`;

  return (
    <motion.div
      className="absolute inset-0 touch-none cursor-grab active:cursor-grabbing"
      style={{ x, y, rotate }}
      animate={controls}
      // Dragging is off while the full profile is open: the sheet needs those same touch moves
      // to scroll, and nobody wants to swipe someone away mid-read.
      drag={interactive && !expanded}
      // No dragConstraints, so the card tracks the pointer 1:1 in every direction — a card
      // that lags behind your thumb is the single thing that most makes a deck feel fake.
      // Framer's own momentum is off because it would keep the card gliding after release and
      // fight the spring that snaps a non-committal drag back to centre.
      dragMomentum={false}
      onPointerDown={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        tilt.set(e.clientY - rect.top > rect.height / 2 ? -1 : 1);
      }}
      onDragStart={() => { dragged.current = true; }}
      onDragEnd={(event, info) => {
        // Cleared on a later tick than the click that follows the pointer release.
        setTimeout(() => { dragged.current = false; }, 80);
        onDragEnd(event, info);
      }}
    >
      <div className="relative w-full h-full rounded-3xl overflow-hidden bg-[#0A0A0A] border border-white/10 shadow-2xl shadow-black/70 select-none">
        <img
          src={uploadUrl(profile.imageUrl || fallback)}
          alt={profile.fullName}
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          draggable={false}
          onError={(e) => { e.target.onerror = null; e.target.src = fallback; }}
        />

        {/* Scrim: heavy at the bottom so the name always reads, light at the top so the
            badge does, and nearly clear across the middle so the photo stays the subject. */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-black/40 pointer-events-none" />

        {/* ── Swipe stamps ────────────────────────────────────────────────────── */}
        <motion.div
          style={{ opacity: likeOpacity, scale: likeScale }}
          className="absolute top-10 left-6 -rotate-[18deg] rounded-xl border-[3px] border-[#CDFF00] px-4 py-1.5 pointer-events-none"
        >
          <span className="text-2xl font-heading font-black tracking-wider text-[#CDFF00] drop-shadow-[0_0_12px_rgba(205,255,0,0.5)]">
            Like
          </span>
        </motion.div>

        <motion.div
          style={{ opacity: nopeOpacity, scale: nopeScale }}
          className="absolute top-10 right-6 rotate-[18deg] rounded-xl border-[3px] border-[#FF4458] px-4 py-1.5 pointer-events-none"
        >
          <span className="text-2xl font-heading font-black tracking-wider text-[#FF4458] drop-shadow-[0_0_12px_rgba(255,68,88,0.5)]">
            Nope
          </span>
        </motion.div>

        <motion.div
          style={{ opacity: superOpacity, scale: superScale }}
          className="absolute inset-x-0 bottom-28 flex justify-center pointer-events-none"
        >
          <div className="-rotate-[8deg] rounded-xl border-[3px] border-[#00E0FF] px-4 py-1.5 bg-black/30 backdrop-blur-sm">
            <span className="text-xl font-heading font-black tracking-wider text-[#00E0FF] drop-shadow-[0_0_12px_rgba(0,224,255,0.6)]">
              Super like
            </span>
          </div>
        </motion.div>

        {/* ── Top badges ──────────────────────────────────────────────────────── */}
        <div className="absolute top-4 inset-x-4 flex items-start justify-between gap-2 pointer-events-none">
          <span className="px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-white text-[10px] font-bold tracking-widest">
            {profile.lookingFor || 'Networking'}
          </span>
          {profile.likedYou && (
            <motion.span
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.15, type: 'spring', bounce: 0.5 }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#CDFF00] text-black text-[10px] font-black tracking-widest shadow-lg shadow-[#CDFF00]/25"
            >
              <Star className="w-3 h-3 fill-black" /> Likes you
            </motion.span>
          )}
        </div>

        {/* ── Name plate ──────────────────────────────────────────────────────── */}
        <div className="absolute inset-x-0 bottom-0 p-5">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-[26px] leading-none font-heading font-black text-white tracking-tight truncate">
                {profile.fullName}
                {profile.age > 0 && <span className="ml-2 font-light text-white/80">{profile.age}</span>}
              </h2>

              {profile.location && (
                <p className="flex items-center gap-1.5 text-xs font-semibold text-white/70 mt-2">
                  <MapPin className="w-3.5 h-3.5 text-[#CDFF00] shrink-0" /> {profile.location}
                </p>
              )}

              {interests.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {interests.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="px-2.5 py-1 rounded-full border border-white/25 bg-white/10 backdrop-blur-sm text-[10px] font-bold text-white"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {profile.bio && (
                <p className="text-xs text-white/70 mt-2.5 line-clamp-2 leading-relaxed">{profile.bio}</p>
              )}
            </div>

            <button
              onClick={() => { if (!dragged.current) setSheet(true); }}
              aria-label={`More about ${profile.fullName}`}
              className="shrink-0 w-9 h-9 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center text-white/80 hover:text-white hover:border-white/40 active:scale-90 transition-all"
            >
              <Info className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>

        {/* ── Full profile sheet ──────────────────────────────────────────────── */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 38 }}
              // touch-auto undoes the card's touch-none, which would otherwise swallow the
              // touch-scroll of a long bio.
              className="absolute inset-0 bg-black/94 backdrop-blur-xl overflow-y-auto overscroll-contain touch-auto"
            >
              <div className="p-5 pb-8">
                <div className="flex items-start justify-between gap-3 mb-5">
                  <div className="min-w-0">
                    <h2 className="text-2xl font-heading font-black text-white tracking-tight truncate">
                      {profile.fullName}
                      {profile.age > 0 && <span className="ml-2 font-light text-white/70">{profile.age}</span>}
                    </h2>
                    <p className="text-[11px] font-bold tracking-widest text-[#CDFF00] mt-1.5">
                      {profile.lookingFor || 'Networking'}
                    </p>
                  </div>
                  <button
                    onClick={() => setSheet(false)}
                    aria-label="Close profile"
                    className="shrink-0 w-9 h-9 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-white/80 hover:text-white active:scale-90 transition-all"
                  >
                    <ChevronDown className="w-5 h-5" />
                  </button>
                </div>

                {profile.bio && (
                  <div className="mb-5">
                    <p className="text-[10px] font-bold tracking-widest text-white/40 mb-2">About</p>
                    <p className="flex gap-2 text-sm text-white/85 leading-relaxed">
                      <Quote className="w-3.5 h-3.5 text-white/25 shrink-0 mt-1" />
                      {profile.bio}
                    </p>
                  </div>
                )}

                {interests.length > 0 && (
                  <div className="mb-5">
                    <p className="text-[10px] font-bold tracking-widest text-white/40 mb-2">Interests</p>
                    <div className="flex flex-wrap gap-2">
                      {interests.map((tag) => (
                        <span
                          key={tag}
                          className="px-3 py-1.5 rounded-full border border-[#CDFF00]/30 bg-[#CDFF00]/10 text-xs font-bold text-[#CDFF00]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2.5">
                  {profile.location && (
                    <div className="flex items-center gap-2.5 text-sm text-white/75">
                      <MapPin className="w-4 h-4 text-white/35 shrink-0" /> {profile.location}
                    </div>
                  )}
                  {profile.gender && (
                    <div className="flex items-center gap-2.5 text-sm text-white/75">
                      <Sparkles className="w-4 h-4 text-white/35 shrink-0" /> {profile.gender}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
