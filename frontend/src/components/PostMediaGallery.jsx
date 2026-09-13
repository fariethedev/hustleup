import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume1, VolumeOff, CirclePlay, CirclePause, CircleChevronLeft, CircleChevronRight, CameraOff, Undo } from 'lucide-react';

/**
 * Video in the feed.
 *
 * <h3>What this is not</h3>
 * The previous player was a desktop media player dropped into a scrolling feed: an author
 * pill, a like button, a share button, ±5s skip buttons, a 56px transport control and two
 * timestamps, all stacked over a clip you are scrolling past. Three of those were duplicates
 * — the post already draws the author above the video and a like/comment/repost/share row
 * below it — so a video post showed the author twice and offered two different like buttons,
 * only one of which ran the feed's heart animation. Skip buttons are furniture on a looping
 * fifteen-second clip.
 *
 * So the chrome is now split by how often it is wanted. Always on screen: a hairline progress
 * bar and the mute toggle, because "how long is this" and "why is there no sound" are the two
 * questions someone always has. Everything else — the play/pause button, the remaining time —
 * appears on interaction and fades again, and the play button stays put while paused because
 * then it is the way back in.
 *
 * <h3>Bugs this replaces, not just a restyle</h3>
 * <ul>
 *   <li><b>Controls never auto-hid.</b> `showControls` began true and the hide timer read
 *       `isPlaying` from the closure it was created in. Pressing play scheduled a timer that
 *       still saw `isPlaying === false`, decided the video was paused and kept the overlay up
 *       — so the gradient, the buttons and the timestamps sat over every playing video
 *       permanently. The timer now reads a ref, which is current.</li>
 *   <li><b>The error state was unreachable.</b> `setHasError` was never called: there was no
 *       `onError` on the element. A video that failed to load showed a black rectangle
 *       forever, with a written-but-dead "unavailable" screen behind it.</li>
 *   <li><b>Double-tap to like did nothing on videos.</b> The container's click handler called
 *       `stopPropagation`, so the feed's `onDoubleClick` never fired — the gesture worked on
 *       image posts and silently did not on video ones. Clicks bubble now, and the second tap
 *       of a double undoes its own play toggle so the video is left exactly as it was.</li>
 *   <li><b>Every video in the feed downloaded in full.</b> `preload="auto"` on each mounted
 *       player, whether or not it was anywhere near the viewport. Now `metadata` — enough for
 *       duration and a first frame.</li>
 *   <li><b>Buffering was invisible.</b> The spinner was nested inside the controls overlay, so
 *       it only rendered when the controls happened to be up, and it was driven by
 *       `loadedmetadata` rather than by stalling. It now tracks `waiting`/`playing`.</li>
 *   <li><b>The seek bar could not be dragged</b> and was a 1px click target. It is a pointer
 *       drag with a 16px invisible hit area.</li>
 * </ul>
 *
 * Autoplay still requires the slide to be active AND the element to be 60% on screen, and
 * still never overrides an explicit pause — that part was right and is kept.
 */
function VideoPlayer({ src, isMuted, onMuteToggle, isActive }) {
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const trackRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [errored, setErrored] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [showChrome, setShowChrome] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);
  const [inView, setInView] = useState(false);

  // The hide timer used to close over `isPlaying` and so always saw its value from the render
  // that scheduled it. A ref is read at fire time, which is the whole point.
  const isPlayingRef = useRef(false);
  const userPausedRef = useRef(false);
  const chromeTimer = useRef(null);
  const lastTapRef = useRef(0);

  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = isMuted;
  }, [isMuted]);

  // Only the video actually scrolled into view counts as on screen, so mounted-but-offscreen
  // players do not all race to autoplay.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting && entry.intersectionRatio >= 0.6),
      { threshold: [0, 0.6, 1] },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || errored) return;
    // No setState here: the element reports play state through onPlaying/onPause, so this
    // only ever drives the element and lets those events be the single source of truth.
    // Setting it here as well meant two writers for one fact, and tripped
    // react-hooks/set-state-in-effect for exactly that reason.
    if (isActive && inView && !userPausedRef.current) {
      video.muted = isMuted;
      const tryPlay = () => video.play().catch(() => {});
      if (video.readyState >= 2) tryPlay();
      else video.addEventListener('canplay', tryPlay, { once: true });
    } else {
      video.pause();
    }
  }, [isActive, inView, errored, isMuted]);

  useEffect(() => () => clearTimeout(chromeTimer.current), []);

  /** Show the transient chrome, then hide it again only if the video is still playing. */
  const flashChrome = useCallback(() => {
    setShowChrome(true);
    clearTimeout(chromeTimer.current);
    chromeTimer.current = setTimeout(() => {
      if (isPlayingRef.current) setShowChrome(false);
    }, 2200);
  }, []);

  const play = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    userPausedRef.current = false;
    // Rejection is normal (autoplay policy); onPlaying reports success, onPause the rest.
    video.play().catch(() => {});
  }, []);

  const pause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    userPausedRef.current = true;
    video.pause();
  }, []);

  const toggle = useCallback(() => {
    const video = videoRef.current;
    if (!video || errored) return;
    if (video.paused) play(); else pause();
    flashChrome();
  }, [errored, play, pause, flashChrome]);

  /**
   * Tap handling.
   *
   * Deliberately does NOT stop propagation: the feed listens for `onDoubleClick` on the media
   * wrapper to like a post, and swallowing the event here is why that gesture worked on images
   * and did nothing on videos. The second tap of a double undoes the play toggle the first one
   * caused, so liking a video leaves it playing if it was playing.
   */
  const onTap = useCallback(() => {
    const now = Date.now();
    const isSecondTap = now - lastTapRef.current < 300;
    lastTapRef.current = now;
    toggle();
    if (isSecondTap) clearTimeout(chromeTimer.current);
  }, [toggle]);

  const onKeyDown = (e) => {
    const video = videoRef.current;
    if (!video) return;
    if (e.key === ' ' || e.key === 'k') { e.preventDefault(); toggle(); }
    else if (e.key === 'm') { e.preventDefault(); onMuteToggle(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); video.currentTime += 5; flashChrome(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); video.currentTime -= 5; flashChrome(); }
  };

  // ── Scrubbing ──────────────────────────────────────────────────────────────
  const seekToClientX = useCallback((clientX) => {
    const video = videoRef.current;
    const track = trackRef.current;
    if (!video || !track || !video.duration) return;
    const rect = track.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    video.currentTime = ratio * video.duration;
    setCurrentTime(video.currentTime);
  }, []);

  const onScrubStart = (e) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setScrubbing(true);
    setShowChrome(true);
    seekToClientX(e.clientX);
  };
  const onScrubMove = (e) => {
    if (!scrubbing) return;
    e.stopPropagation();
    seekToClientX(e.clientX);
  };
  const onScrubEnd = (e) => {
    if (!scrubbing) return;
    e.stopPropagation();
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    setScrubbing(false);
    flashChrome();
  };

  const fmt = (s) => {
    if (!Number.isFinite(s) || s < 0) return '0:00';
    const m = Math.floor(s / 60);
    return `${m}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
  };

  const pct = duration ? (currentTime / duration) * 100 : 0;

  if (errored) {
    return (
      <div className="relative w-full h-full bg-black flex items-center justify-center px-6">
        <div className="text-center">
          <CameraOff className="w-10 h-10 text-white/25 mx-auto mb-3" />
          <p className="text-white/70 text-sm font-bold">This video won&apos;t play</p>
          <p className="text-white/35 text-xs mt-1">It may have been removed, or the upload didn&apos;t finish.</p>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setErrored(false);
              // Force the element to re-request the source rather than trusting a cached failure.
              const v = videoRef.current;
              if (v) { v.load(); v.play().catch(() => {}); }
            }}
            className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white/10 border border-white/15 text-white text-[11px] font-bold hover:bg-white/15 transition-colors"
          >
            <Undo className="w-3.5 h-3.5" /> Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      role="button"
      tabIndex={0}
      aria-label={isPlaying ? 'Pause video' : 'Play video'}
      className="group relative w-full h-full bg-black select-none overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-[#CDFF00]/70 focus-visible:ring-inset"
      onClick={onTap}
      onKeyDown={onKeyDown}
      onMouseMove={flashChrome}
      onMouseLeave={() => { if (isPlayingRef.current) setShowChrome(false); }}
      onTouchStart={flashChrome}
    >
      <video
        ref={videoRef}
        src={src}
        loop
        playsInline
        // metadata, not auto: a feed can hold a dozen mounted players, and `auto` had every
        // one of them pulling its whole file down whether or not it was near the viewport.
        preload="metadata"
        muted={isMuted}
        onTimeUpdate={() => {
          const v = videoRef.current;
          if (v && !scrubbing) setCurrentTime(v.currentTime);
        }}
        onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => { setBuffering(false); setIsPlaying(true); }}
        onPause={() => setIsPlaying(false)}
        onError={() => { setErrored(true); setBuffering(false); }}
        className="w-full h-full object-contain"
      />

      {/* Buffering. Outside the chrome overlay on purpose — the old spinner lived inside it,
          so a video that stalled while the controls were hidden showed nothing at all. */}
      {buffering && !errored && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div className="w-10 h-10 rounded-full border-2 border-white/15 border-t-[#CDFF00] animate-spin" />
        </div>
      )}

      {/* ── Transient chrome: play/pause and the remaining time ── */}
      <AnimatePresence>
        {(showChrome || !isPlaying) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0 z-10 pointer-events-none"
          >
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/55 to-transparent" />

            {!buffering && (
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.span
                  key={isPlaying ? 'pause' : 'play'}
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 26 }}
                  className="w-16 h-16 rounded-full bg-black/45 backdrop-blur-md border border-white/20 flex items-center justify-center"
                >
                  {isPlaying
                    ? <CirclePause className="w-7 h-7 text-white fill-white" />
                    : <CirclePlay className="w-7 h-7 text-white fill-white ml-0.5" />}
                </motion.span>
              </div>
            )}

            {duration > 0 && (
              <span className="absolute bottom-6 left-4 text-[11px] font-bold text-white/85 tabular-nums drop-shadow">
                {fmt(currentTime)} / {fmt(duration)}
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Persistent: mute. Always visible, because a silently-muted video is the single
             most common thing people are confused by in a feed. ── */}
      <button
        onClick={(e) => { e.stopPropagation(); onMuteToggle(); flashChrome(); }}
        aria-label={isMuted ? 'Unmute' : 'Mute'}
        className="absolute bottom-5 right-4 z-30 w-9 h-9 rounded-full bg-black/50 backdrop-blur-md border border-white/15 flex items-center justify-center text-white hover:bg-black/70 transition-colors"
      >
        {isMuted ? <VolumeOff className="w-4 h-4" /> : <Volume1 className="w-4 h-4" />}
      </button>

      {/* ── Persistent: progress. A hairline normally, thicker while pointed at or dragged.
             The wrapper is 16px tall and transparent so the drag target is a finger, not a
             hairline; the old bar was a 1px click-only strip. ── */}
      <div
        ref={trackRef}
        onPointerDown={onScrubStart}
        onPointerMove={onScrubMove}
        onPointerUp={onScrubEnd}
        onPointerCancel={onScrubEnd}
        onClick={(e) => e.stopPropagation()}
        role="slider"
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration) || 0}
        aria-valuenow={Math.round(currentTime) || 0}
        aria-valuetext={`${fmt(currentTime)} of ${fmt(duration)}`}
        tabIndex={-1}
        className="absolute inset-x-0 bottom-0 z-30 h-4 flex items-end cursor-pointer touch-none"
      >
        <div className={`relative w-full transition-all duration-150 ${scrubbing ? 'h-[5px]' : 'h-[2.5px] group-hover:h-[4px]'} bg-white/20`}>
          <div className="absolute inset-y-0 left-0 bg-[#CDFF00]" style={{ width: `${pct}%` }} />
          <span
            className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full bg-[#CDFF00] shadow transition-all ${
              scrubbing ? 'w-3.5 h-3.5 opacity-100' : 'w-2.5 h-2.5 opacity-0 group-hover:opacity-100'
            }`}
            style={{ left: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export default function PostMediaGallery({ media = [], className = '' }) {
  const [current, setCurrent] = useState(0);
  // Shared across slides on purpose: unmuting one video in a post and swiping to the next
  // should not silently re-mute it.
  const [isMuted, setIsMuted] = useState(true);
  const dragStartX = useRef(0);
  const [isDragging, setIsDragging] = useState(false);

  if (!media.length) return null;

  const prev = (e) => { e?.stopPropagation(); setCurrent((c) => Math.max(0, c - 1)); };
  const next = (e) => { e?.stopPropagation(); setCurrent((c) => Math.min(media.length - 1, c + 1)); };

  const handleDragStart = (e) => {
    dragStartX.current = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
    setIsDragging(true);
  };
  const handleDragEnd = (e) => {
    if (!isDragging) return;
    setIsDragging(false);
    const endX = e.type === 'touchend' ? e.changedTouches[0].clientX : e.clientX;
    const diff = dragStartX.current - endX;
    if (diff > 50) next();
    else if (diff < -50) prev();
  };

  return (
    <div className={`relative bg-[#0a0a0a] overflow-hidden ${className}`}>
      <div
        className="relative w-full aspect-[4/5] max-h-[600px] bg-black overflow-hidden"
        onMouseDown={handleDragStart}
        onMouseUp={handleDragEnd}
        onTouchStart={handleDragStart}
        onTouchEnd={handleDragEnd}
      >
        {/* The track stays exactly one viewport wide and its slides overflow it.
            translateX(%) resolves against the transformed element's OWN border box, so a
            track sized to `media.length * 100%` moved by `current * 100%` jumped a full
            track-width per step — three images meant slide 2 landed three viewports away
            and every slide after the first showed blank black. Keeping the track at 100%
            makes one step exactly one slide, whatever the count. */}
        <div
          className="flex h-full w-full transition-transform duration-500 ease-[0.16,1,0.3,1]"
          style={{ transform: `translateX(-${current * 100}%)` }}
        >
          {media.map((item, index) => (
            <div key={`${item.url}-${index}`} className="relative h-full w-full flex-shrink-0">
              {item.type === 'VIDEO' ? (
                <VideoPlayer
                  src={item.url}
                  isMuted={isMuted}
                  onMuteToggle={() => setIsMuted((m) => !m)}
                  isActive={index === current}
                />
              ) : (
                <div className="w-full h-full bg-black">
                  <img
                    src={item.url}
                    alt={`Post media ${index + 1}`}
                    className="w-full h-full object-cover"
                    onError={(e) => { e.target.onerror = null; e.target.src = 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&q=60'; }}
                    draggable={false}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {media.length > 1 && current > 0 && (
          <button
            onClick={prev}
            aria-label="Previous"
            className="absolute left-4 top-1/2 -translate-y-1/2 z-40 w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white flex items-center justify-center shadow-2xl hover:bg-white hover:text-black transition-all"
          >
            <CircleChevronLeft className="w-6 h-6 stroke-[2.5]" />
          </button>
        )}
        {media.length > 1 && current < media.length - 1 && (
          <button
            onClick={next}
            aria-label="Next"
            className="absolute right-4 top-1/2 -translate-y-1/2 z-40 w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white flex items-center justify-center shadow-2xl hover:bg-white hover:text-black transition-all"
          >
            <CircleChevronRight className="w-6 h-6 stroke-[2.5]" />
          </button>
        )}

        {media.length > 1 && (
          <div className="absolute top-4 right-4 z-40 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-xl border border-white/10 text-white text-[10px] font-black tabular-nums">
            {current + 1} / {media.length}
          </div>
        )}
      </div>

      {media.length > 1 && (
        <div className="flex items-center justify-center gap-2 py-4 bg-[#0a0a0a]/80 backdrop-blur-sm">
          {media.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              aria-label={`Go to item ${i + 1}`}
              aria-current={i === current}
              className={`transition-all duration-500 rounded-full ${
                i === current ? 'w-8 h-1 bg-[#CDFF00]' : 'w-2 h-1 bg-white/10 hover:bg-white/20'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
