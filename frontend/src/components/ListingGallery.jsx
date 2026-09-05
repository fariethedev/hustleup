import { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Package, Play, Zap, ChevronLeft, ChevronRight } from 'lucide-react';
import SmartImage from './SmartImage';
import { isVideoUrl } from '../utils/media';

/**
 * The media gallery on a listing's detail page: a swipeable carousel plus a thumbnail strip.
 *
 * Handles images and videos in the same list — every listing carries at least five supporting
 * items (topped up server-side by `ListingMediaLibrary`), and sellers can upload short clips
 * alongside photos, so the carousel can't assume everything is an `<img>`.
 *
 * <h3>Why CSS scroll-snap rather than a drag gesture</h3>
 * The obvious approach is framer-motion `drag="x"`, but a draggable track fights the native
 * `<video controls>` on a video slide: dragging the scrubber would pan the carousel instead of
 * seeking. Scroll-snap sidesteps that entirely — the browser owns the gesture, so video
 * controls keep working, touch gets real momentum and rubber-banding for free, and trackpad
 * swipe works on desktop without any extra code. The arrows and thumbnails just drive
 * `scrollTo`, so every input path ends up in the same place.
 *
 * Videos are shown muted with native controls and are never autoplayed: a listing page that
 * starts making noise the moment it opens is hostile, and a muted autoplay still burns
 * bandwidth on a phone for a video most visitors won't watch.
 *
 * @param {string[]} media     ordered media URLs; the seller's own uploads come first
 * @param {string}   title     listing title, used for alt text
 * @param {string}   typeLabel human-readable category shown as a badge over the stage
 */
export default function ListingGallery({ media = [], title = '', typeLabel }) {
  const [activeRaw, setActive] = useState(0);
  const trackRef = useRef(null);
  // Set while an arrow/thumbnail scroll is animating, so the scroll handler doesn't fight
  // the programmatic scroll by recomputing the index from intermediate positions.
  const snappingRef = useRef(false);

  // A listing whose media list shrinks (an edit, or navigating to a different listing while the
  // component stays mounted) would otherwise leave the stored index pointing past the end and
  // blank the stage. Clamped on read rather than corrected by an effect: writing state from an
  // effect costs an extra render pass and trips react-hooks/set-state-in-effect, and there is
  // nothing here that a plain derived value cannot express.
  const active = Math.min(activeRaw, Math.max(0, media.length - 1));

  /** Scrolls the track to a slide, clamped to the ends. */
  const goTo = useCallback((index) => {
    const track = trackRef.current;
    if (!track) return;
    const clamped = Math.max(0, Math.min(index, media.length - 1));
    snappingRef.current = true;
    setActive(clamped);
    track.scrollTo({ left: clamped * track.clientWidth, behavior: 'smooth' });
    // Release once the smooth scroll has settled; the exact duration isn't observable, so
    // this is a comfortable upper bound rather than a guess at the easing curve.
    window.setTimeout(() => { snappingRef.current = false; }, 400);
  }, [media.length]);

  /** Derives the active slide from scroll position as the user swipes. */
  const onScroll = () => {
    const track = trackRef.current;
    if (!track || snappingRef.current || track.clientWidth === 0) return;
    const index = Math.round(track.scrollLeft / track.clientWidth);
    setActive((prev) => (prev === index ? prev : Math.max(0, Math.min(index, media.length - 1))));
  };

  // Arrow keys move the carousel when it has focus. Scoped to the gallery rather than the
  // window so it can't hijack arrow keys meant for the page or a form field.
  const onKeyDown = (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); goTo(active + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(active - 1); }
  };

  if (media.length === 0) {
    return (
      <div className="relative aspect-[4/3] max-h-[380px] w-full rounded-2xl overflow-hidden glass-strong border border-white/10">
        <div className="w-full h-full flex items-center justify-center bg-gray-900">
          <Package className="w-20 h-20 text-gray-700" />
        </div>
      </div>
    );
  }

  const hasMultiple = media.length > 1;

  return (
    <div className="space-y-3">
      {/* Stage — a horizontally snapping track, one slide per item */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative aspect-[4/3] max-h-[380px] w-full rounded-2xl overflow-hidden glass-strong border border-white/10 bg-black group"
      >
        <div
          ref={trackRef}
          onScroll={onScroll}
          onKeyDown={onKeyDown}
          tabIndex={0}
          role="region"
          aria-roledescription="carousel"
          aria-label={`${title} media, ${media.length} items`}
          className="flex h-full w-full overflow-x-auto overscroll-x-contain overflow-y-hidden snap-x snap-mandatory scrollbar-hide outline-none focus-visible:ring-2 focus-visible:ring-[#CDFF00]/60"
          // `touch-action: pan-x` keeps vertical page scrolling working over the carousel —
          // without it a slightly-diagonal swipe can trap the gesture and lock the page.
          style={{ touchAction: 'pan-x', scrollbarWidth: 'none' }}
        >
          {media.map((url, i) => {
            const isVideo = isVideoUrl(url);
            return (
              <div
                key={`${url}-${i}`}
                className="relative w-full h-full shrink-0 snap-center"
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} of ${media.length}`}
              >
                {isVideo ? (
                  <video
                    // Only mount the source for the slide in view and its neighbours: a
                    // listing with five clips would otherwise have the browser open five
                    // media pipelines at once on page load.
                    key={url}
                    src={Math.abs(i - active) <= 1 ? url : undefined}
                    controls
                    muted
                    playsInline
                    preload="metadata"
                    className="w-full h-full object-contain bg-black"
                  />
                ) : (
                  <>
                    {/* A blurred, over-scaled copy of the same photo fills the space that
                        object-contain leaves. Letterboxing a portrait shot against flat black
                        reads as a broken image; against its own colours it reads as framing. */}
                    <SmartImage
                      src={url}
                      alt=""
                      aria-hidden="true"
                      className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-40"
                    />
                    {/* object-contain, not object-cover: the whole photo is shown. Cropping to
                        fill cut the top and bottom off anything portrait — which is most phone
                        photographs — and on a marketplace the part cropped away is routinely
                        the part the buyer needed to see. */}
                    <SmartImage
                      src={url}
                      alt={i === 0 ? title : `${title} — item ${i + 1}`}
                      className="relative w-full h-full object-contain"
                    />
                  </>
                )}

                {/* The gradient scrim would swallow clicks on the video's controls, so it's
                    only drawn over stills. */}
                {!isVideo && (
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
                )}
              </div>
            );
          })}
        </div>

        {/* Prev / next. Touch users swipe; these are for mouse and keyboard. Hidden at the
            ends so there is never a control that visibly does nothing. */}
        {hasMultiple && active > 0 && (
          <button
            type="button"
            onClick={() => goTo(active - 1)}
            aria-label="Previous item"
            className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-black/60 backdrop-blur border border-white/10 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-[#CDFF00] hover:text-black transition-all active:scale-90"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        {hasMultiple && active < media.length - 1 && (
          <button
            type="button"
            onClick={() => goTo(active + 1)}
            aria-label="Next item"
            className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-black/60 backdrop-blur border border-white/10 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-[#CDFF00] hover:text-black transition-all active:scale-90"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}

        <div className="absolute bottom-3 right-3 px-2 py-1 rounded-lg bg-black/70 text-white text-[9px] font-black tracking-widest pointer-events-none z-10">
          {active + 1} / {media.length}
        </div>

        {/* Dots — the at-a-glance "there is more here", and the affordance that tells a
            first-time visitor the stage is swipeable at all. */}
        {hasMultiple && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10">
            {media.map((url, i) => (
              <button
                key={`dot-${url}-${i}`}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Go to item ${i + 1}`}
                className={`rounded-full transition-all duration-300 ${
                  active === i
                    ? 'w-5 h-1.5 bg-[#CDFF00]'
                    : 'w-1.5 h-1.5 bg-white/50 hover:bg-white/80'
                }`}
              />
            ))}
          </div>
        )}
      </motion.div>

      {/* The category sits under the photograph rather than on top of it. Laid over the
          image it covered part of what the buyer came to look at, and on a pale shot it was
          barely legible anyway — a label about the item does not need to be inside it. */}
      {typeLabel && (
        <div className="mt-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass-violet text-[#CDFF00] font-black text-[9px] tracking-widest border border-white/10">
            <Zap className="w-3 h-3 fill-[#CDFF00]" /> {typeLabel}
          </span>
        </div>
      )}

      {/* Thumbnail strip */}
      {hasMultiple && (
        <div className="flex gap-2 overflow-x-auto overscroll-x-contain pb-2 scrollbar-hide">
          {media.map((url, i) => {
            const isVideo = isVideoUrl(url);
            return (
              <button
                key={`${url}-${i}`}
                onClick={() => goTo(i)}
                aria-label={`View item ${i + 1} of ${media.length}`}
                aria-current={active === i}
                className={`relative w-16 h-16 rounded-xl overflow-hidden shrink-0 transition-all duration-300 ${
                  active === i
                    ? 'ring-2 ring-[#CDFF00] scale-105'
                    : 'opacity-40 grayscale hover:opacity-100 hover:grayscale-0'
                }`}
              >
                {isVideo ? (
                  // Videos get a static tile rather than a decoded first frame — generating
                  // real thumbnails would mean loading every clip just to render the strip.
                  <div className="w-full h-full bg-white/5 flex items-center justify-center">
                    <Play className="w-5 h-5 text-white/70 fill-white/70" />
                  </div>
                ) : (
                  <SmartImage src={url} alt="" className="w-full h-full object-cover" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
