import { useEffect, useState } from 'react';

/**
 * The shape a piece of feed media actually is, so the card can be that shape too.
 *
 * <h3>Why this exists</h3>
 * Feed cards used to force every post into a fixed box — square for a single image, 4:5 for
 * a gallery — and fill it with `object-cover`. Anything that was not already that shape got
 * cropped, and the crop fell wherever the middle of the picture happened to be: a portrait
 * photo lost its top and bottom, a wide shot lost its sides. The card was a fixed frame that
 * the picture had to fit, rather than the other way round.
 *
 * <h3>Why it is measured in the browser</h3>
 * Nothing stores the dimensions. `Post` keeps media as a list of URLs and a matching list of
 * types, so the only place the size of an image is known is after it has been decoded. The
 * measurement is started on mount against the same URL the card is about to render, so it is
 * normally answered from cache at about the moment the visible image paints.
 *
 * <p>That still means one reflow per card, from the placeholder ratio to the real one, early
 * enough that it usually happens while the area is blank rather than under something already
 * being read. Removing it entirely means storing width and height at upload and sending them
 * with the post — worth doing, and a bigger change than this.
 */

/**
 * Tallest a card may be, as width ÷ height.
 *
 * 9:16 is the tallest thing a phone camera or screen produces, so it covers the portrait
 * photos that were being cropped worst. Past that an image is a deliberately elongated
 * graphic, and a feed of them would be a feed nobody can scroll.
 */
export const TALLEST = 9 / 16;

/** Widest a card may be. Beyond roughly this a panorama is a letterbox slit. */
export const WIDEST = 3;

/**
 * Used until the real shape is known.
 *
 * Portrait-leaning on purpose: most feed photos are, so this is the assumption that moves
 * least when the measurement lands.
 */
export const DEFAULT_ASPECT = 4 / 5;

/** width ÷ height, held inside the bounds above. Null when the dimensions are unusable. */
export function clampAspect(width, height) {
  if (!width || !height) return null;
  return Math.min(WIDEST, Math.max(TALLEST, width / height));
}

/**
 * The aspect ratio to give a card for this piece of media.
 *
 * @param {string}  url        the media to measure; the first item of a gallery
 * @param {boolean} isVideo    read videoWidth/videoHeight instead of decoding an image
 * @returns {number} width ÷ height, clamped. {@link DEFAULT_ASPECT} until known.
 */
export function useMediaAspect(url, isVideo = false) {
  const [aspect, setAspect] = useState(DEFAULT_ASPECT);

  useEffect(() => {
    if (!url) return undefined;
    let cancelled = false;

    // Only ever set from a load callback, never synchronously here. A URL change keeps the
    // previous ratio until the new one is known, which is one reflow rather than two — going
    // back to the default first would visibly collapse the card on the way past.
    const settle = (w, h) => {
      const next = clampAspect(w, h);
      if (!cancelled && next) setAspect(next);
    };

    if (isVideo) {
      const el = document.createElement('video');
      const onMeta = () => settle(el.videoWidth, el.videoHeight);
      el.addEventListener('loadedmetadata', onMeta);
      el.preload = 'metadata';
      el.muted = true;
      el.src = url;
      return () => {
        cancelled = true;
        el.removeEventListener('loadedmetadata', onMeta);
        // Detach the source so a card scrolled past does not keep fetching.
        el.removeAttribute('src');
        el.load();
      };
    }

    const img = new Image();
    const onLoad = () => settle(img.naturalWidth, img.naturalHeight);
    img.addEventListener('load', onLoad);
    img.src = url;
    return () => {
      cancelled = true;
      img.removeEventListener('load', onLoad);
    };
  }, [url, isVideo]);

  return aspect;
}
