import { useState, useEffect } from 'react';
import { Image as ImageIcon } from 'lucide-react';

/**
 * An <img> that never renders as a broken image.
 *
 * Media on HustleUp can go missing for reasons outside the app's control — an upload that
 * didn't survive a server move, an S3 object whose presigned URL expired, a stock photo pulled
 * upstream. A plain `<img>` handles all of those the same way: the browser's broken-image
 * glyph, or (where a page hides the element on error) an unexplained empty hole in the layout.
 *
 * This component substitutes a branded placeholder instead, so a missing image looks like part
 * of the design rather than a bug. It covers the two failure modes together — no `src` at all,
 * and a `src` that fails to load — because to the person looking at the page they're identical.
 *
 * @param {string}   src        image URL; a falsy value renders the placeholder immediately
 * @param {string}   alt        alt text, also used as the placeholder's accessible label
 * @param {string}   className  classes for the <img>; the placeholder reuses them so the
 *                              element keeps its size and rounding either way
 * @param {Function} fallbackIcon  lucide icon component drawn in the placeholder
 * @param {string}   fallbackClassName  extra classes for the placeholder, e.g. a category gradient
 */
export default function SmartImage({
  src,
  alt = '',
  className = '',
  fallbackIcon: FallbackIcon = ImageIcon,
  fallbackClassName = '',
  ...rest
}) {
  const [failed, setFailed] = useState(false);

  // Reset when the source changes. Without this a gallery that reuses one <SmartImage> for the
  // selected item would stay stuck on the placeholder after a single bad image, because the
  // failed flag from the previous src would carry over to the next one.
  useEffect(() => { setFailed(false); }, [src]);

  if (!src || failed) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`flex items-center justify-center bg-gradient-to-br from-white/[0.06] to-white/[0.02] ${className} ${fallbackClassName}`}
      >
        <FallbackIcon className="w-1/4 h-1/4 max-w-10 max-h-10 min-w-4 min-h-4 text-white/15" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      // loading="lazy" keeps long browse grids from firing dozens of parallel image requests.
      loading="lazy"
      onError={() => setFailed(true)}
      {...rest}
    />
  );
}
