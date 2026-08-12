import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Package, Play, Zap } from 'lucide-react';
import SmartImage from './SmartImage';
import { isVideoUrl } from '../utils/media';

/**
 * The media gallery on a listing's detail page: one large stage plus a thumbnail strip.
 *
 * Handles images and videos in the same list — every listing carries at least five supporting
 * items (topped up server-side by `ListingMediaLibrary`), and sellers can upload short clips
 * alongside photos, so the gallery can't assume everything is an `<img>`.
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
  const [active, setActive] = useState(0);

  // A listing whose media list shrinks (an edit, or navigating to a different listing while the
  // component stays mounted) would otherwise leave `active` pointing past the end and blank the
  // stage. Clamping on change keeps a valid item selected.
  useEffect(() => {
    if (active > media.length - 1) setActive(0);
  }, [media.length, active]);

  if (media.length === 0) {
    return (
      <div className="relative aspect-[4/3] max-h-[380px] w-full rounded-2xl overflow-hidden glass-strong border border-white/10">
        <div className="w-full h-full flex items-center justify-center bg-gray-900">
          <Package className="w-20 h-20 text-gray-700" />
        </div>
      </div>
    );
  }

  const current = media[active] ?? media[0];
  const currentIsVideo = isVideoUrl(current);

  return (
    <div className="space-y-3">
      {/* Stage */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative aspect-[4/3] max-h-[380px] w-full rounded-2xl overflow-hidden glass-strong border border-white/10 bg-black"
      >
        {currentIsVideo ? (
          <video
            // key forces React to build a fresh <video> when the selection changes; reusing the
            // element leaves the previous clip's playback position and buffered data in place.
            key={current}
            src={current}
            controls
            muted
            playsInline
            className="w-full h-full object-contain bg-black"
          />
        ) : (
          <SmartImage src={current} alt={title} className="w-full h-full object-cover" />
        )}

        {/* The gradient scrim would swallow clicks on the video's controls, so it's only drawn
            over stills. pointer-events-none covers the rest. */}
        {!currentIsVideo && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
        )}

        {typeLabel && (
          <div className="absolute top-4 left-4 pointer-events-none">
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass-violet text-[#CDFF00] font-black text-[9px] uppercase tracking-widest border border-white/10">
              <Zap className="w-3 h-3 fill-[#CDFF00]" /> {typeLabel}
            </span>
          </div>
        )}

        <div className="absolute bottom-3 right-3 px-2 py-1 rounded-lg bg-black/70 text-white text-[9px] font-black uppercase tracking-widest pointer-events-none">
          {active + 1} / {media.length}
        </div>
      </motion.div>

      {/* Thumbnail strip */}
      {media.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {media.map((url, i) => {
            const isVideo = isVideoUrl(url);
            return (
              <button
                key={`${url}-${i}`}
                onClick={() => setActive(i)}
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
