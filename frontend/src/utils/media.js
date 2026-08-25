/**
 * Helpers for dealing with listing/post media that may be an image, a video, or missing.
 *
 * Media on HustleSpace arrives from three places — files uploaded to the local `/uploads`
 * directory, S3/CDN URLs, and curated stock imagery — and any of them can be absent or dead.
 * Rather than sprinkling `?.[0] || null` and bare `<img>` tags across every page, everything
 * that renders media goes through these helpers and the `SmartImage` component.
 */

/** File extensions we render with a <video> element rather than an <img>. */
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.ogg', '.ogv', '.mov', '.m4v'];

/**
 * True when a media URL points at a video.
 *
 * Query strings are stripped first: S3 presigned URLs append `?X-Amz-Signature=…`, so a naive
 * `endsWith('.mp4')` would report every signed video as an image.
 *
 * @param {string} url
 * @returns {boolean}
 */
export function isVideoUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const withoutQuery = url.split('?')[0].toLowerCase();
  return VIDEO_EXTENSIONS.some((ext) => withoutQuery.endsWith(ext));
}

/**
 * The first usable media URL from a listing (or anything else exposing `mediaUrls`).
 *
 * Prefers a still image for card thumbnails: a card showing a video's first frame is often a
 * black rectangle, so if the listing has any image at all it leads with that and leaves the
 * video for the gallery.
 *
 * @param {{mediaUrls?: string[], image?: string}} item
 * @returns {string|null}
 */
export function coverImage(item) {
  const urls = (item?.mediaUrls || []).filter(Boolean);
  return urls.find((u) => !isVideoUrl(u)) || urls[0] || item?.image || null;
}

/**
 * Normalises whatever a listing exposes as media into a clean array.
 * Handles the empty/undefined cases so callers can map without guarding.
 *
 * @param {{mediaUrls?: string[]}} item
 * @returns {string[]}
 */
export function mediaList(item) {
  return (item?.mediaUrls || []).filter(Boolean);
}
