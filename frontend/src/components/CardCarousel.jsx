import { useCallback, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Play } from 'lucide-react';
import SmartImage from './SmartImage';
import { isVideoUrl } from '../utils/media';

/**
 * A swipeable media track sized to fill a card's image area.
 *
 * This is the card-sized sibling of `ListingGallery`. Both use CSS scroll-snap for the same
 * reason — the browser owns the gesture, so touch gets real momentum and rubber-banding for
 * free and a trackpad swipe works on desktop without any extra code — but a card is a much
 * more hostile place to put a carousel than a detail page, and the differences are all
 * consequences of that:
 *
 * <h3>It lives inside a `<Link>`</h3>
 * Every control here stops propagation and prevents the default, or tapping an arrow would
 * navigate to the listing instead of advancing the slide. Swipes are handled too: a
 * horizontal drag normally suppresses the click on its own, but not reliably across mobile
 * browsers, so a recent scroll swallows the next click outright (see `scrolledRef`). Without
 * that, a swipe on the feed occasionally opens whatever card you swiped.
 *
 * <h3>There may be dozens of them on screen</h3>
 * A single-item card renders a plain image and no scroll container at all, so the common case
 * costs nothing. Images rely on `SmartImage`'s native lazy-loading rather than being unmounted
 * by index — gating `src` the way the detail gallery does would flash a placeholder mid-swipe.
 * Videos *are* gated, because an ungated one opens a media pipeline per slide.
 *
 * <h3>Vertical scrolling still has to work</h3>
 * `touch-action: pan-x` keeps a slightly-diagonal swipe from trapping the gesture and locking
 * the page — the failure mode here is worse than on a detail page, since the carousel covers
 * most of a feed card and there is little neutral space left to scroll from.
 *
 * Videos render their poster frame with a play badge rather than native `controls`: controls
 * inside a link are a hit-target minefield, and the card is a doorway to the detail page where
 * the real player lives.
 *
 * @param {string[]} media              ordered media URLs
 * @param {string}   title              used for alt text and the accessible carousel label
 * @param {Function} fallbackIcon       lucide icon for the empty/broken placeholder
 * @param {string}   fallbackClassName  extra placeholder classes, e.g. a category gradient
 * @param {string}   imageClassName     classes for each slide's image
 */
export default function CardCarousel({
  media = [],
  title = '',
  fallbackIcon,
  fallbackClassName = '',
  imageClassName = 'w-full h-full object-cover',
}) {
  const [activeRaw, setActive] = useState(0);
  const trackRef = useRef(null);
  // Set while an arrow tap is animating, so the scroll handler doesn't fight the programmatic
  // scroll by recomputing the index from intermediate positions.
  const snappingRef = useRef(false);
  // Set by any scroll, cleared shortly after it settles. Used only to swallow the click that
  // some mobile browsers still fire at the end of a swipe.
  const scrolledRef = useRef(false);
  const scrollEndTimer = useRef(null);

  // Clamped on read rather than corrected by an effect: writing state from an effect costs an
  // extra render and trips react-hooks/set-state-in-effect, and nothing here needs more than a
  // derived value.
  const active = Math.min(activeRaw, Math.max(0, media.length - 1));

  const goTo = useCallback((index, e) => {
    // Inside a <Link>, so the navigation has to be cancelled before anything else.
    e?.preventDefault();
    e?.stopPropagation();
    const track = trackRef.current;
    if (!track) return;
    const clamped = Math.max(0, Math.min(index, media.length - 1));
    snappingRef.current = true;
    setActive(clamped);
    track.scrollTo({ left: clamped * track.clientWidth, behavior: 'smooth' });
    // The smooth-scroll duration isn't observable; this is a comfortable upper bound rather
    // than a guess at the easing curve.
    window.setTimeout(() => { snappingRef.current = false; }, 400);
  }, [media.length]);

  const onScroll = () => {
    const track = trackRef.current;
    if (!track || track.clientWidth === 0) return;

    scrolledRef.current = true;
    window.clearTimeout(scrollEndTimer.current);
    scrollEndTimer.current = window.setTimeout(() => { scrolledRef.current = false; }, 120);

    if (snappingRef.current) return;
    const index = Math.round(track.scrollLeft / track.clientWidth);
    setActive((prev) => (prev === index ? prev : Math.max(0, Math.min(index, media.length - 1))));
  };

  // Capture phase: the click has to die before it reaches the <Link> wrapping the card.
  const onClickCapture = (e) => {
    if (!scrolledRef.current) return;
    e.preventDefault();
    e.stopPropagation();
  };

  const placeholder = (
    <SmartImage
      src={media[0]}
      alt={title}
      fallbackIcon={fallbackIcon}
      fallbackClassName={fallbackClassName}
      className={imageClassName}
    />
  );

  // One image needs no scroll container, no listeners and no dots. Most cards in a grid take
  // this path.
  if (media.length <= 1) return placeholder;

  return (
    <>
      <div
        ref={trackRef}
        onScroll={onScroll}
        onClickCapture={onClickCapture}
        role="region"
        aria-roledescription="carousel"
        aria-label={`${title} media, ${media.length} items`}
        className="flex h-full w-full overflow-x-auto overflow-y-hidden snap-x snap-mandatory scrollbar-hide"
        style={{ touchAction: 'pan-x', scrollbarWidth: 'none' }}
        // Without this a mouse drag inside the <a> starts a native link drag — the ghost
        // image follows the cursor and the track never scrolls.
        draggable={false}
      >
        {media.map((url, i) => (
          <div
            key={`${url}-${i}`}
            className="relative w-full h-full shrink-0 snap-start overflow-hidden"
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${media.length}`}
          >
            {isVideoUrl(url) ? (
              <>
                <video
                  // Only the slide in view and its neighbours get a source; a listing with
                  // five clips would otherwise open five media pipelines while the card is
                  // still scrolling past.
                  src={Math.abs(i - active) <= 1 ? url : undefined}
                  muted
                  playsInline
                  preload="metadata"
                  className="w-full h-full object-cover bg-black"
                />
                <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="w-10 h-10 rounded-full bg-black/60 backdrop-blur flex items-center justify-center">
                    <Play className="w-4 h-4 text-white fill-white" />
                  </span>
                </span>
              </>
            ) : (
              <SmartImage
                src={url}
                alt={i === 0 ? title : `${title} — item ${i + 1}`}
                fallbackIcon={fallbackIcon}
                fallbackClassName={fallbackClassName}
                className={imageClassName}
                draggable={false}
              />
            )}
          </div>
        ))}
      </div>

      {/* Arrows are for mouse and keyboard; touch swipes. Hidden at the ends so there is never
          a visible control that does nothing. */}
      {active > 0 && (
        <button
          type="button"
          onClick={(e) => goTo(active - 1, e)}
          aria-label="Previous image"
          className="absolute left-1.5 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-black/60 backdrop-blur border border-white/15 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-[#CDFF00] hover:text-black transition-all active:scale-90"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}
      {active < media.length - 1 && (
        <button
          type="button"
          onClick={(e) => goTo(active + 1, e)}
          aria-label="Next image"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-black/60 backdrop-blur border border-white/15 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-[#CDFF00] hover:text-black transition-all active:scale-90"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}

      {/* Position indicator, centred so it clears the cart button in the corner. Dots become
          unreadable confetti past a handful of slides, so a long set gets a counter instead —
          both answer "how much more is there", which is the only question being asked. */}
      {media.length <= 6 ? (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1">
          {media.map((url, i) => (
            <button
              key={`dot-${url}-${i}`}
              type="button"
              onClick={(e) => goTo(i, e)}
              aria-label={`Go to image ${i + 1}`}
              aria-current={active === i}
              className={`rounded-full transition-all duration-300 ${
                active === i ? 'w-4 h-1.5 bg-[#CDFF00]' : 'w-1.5 h-1.5 bg-white/60 hover:bg-white'
              }`}
            />
          ))}
        </div>
      ) : (
        <span className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-sm text-[8px] font-black text-white/90 tabular-nums pointer-events-none">
          {active + 1} / {media.length}
        </span>
      )}
    </>
  );
}
