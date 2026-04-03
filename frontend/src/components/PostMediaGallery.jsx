import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, VolumeX, Play, Pause, ChevronLeft, ChevronRight, Share, Heart, SkipBack, SkipForward, User } from 'lucide-react';

function VideoPlayer({ src, isMuted, onMuteToggle, isActive, author }) {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const controlsTimer = useRef(null);

  // Sync mute
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = isMuted;
  }, [isMuted]);

  // Auto-play/pause
  useEffect(() => {
    const video = videoRef.current;
    if (!video || hasError) return;
    if (isActive) {
      video.muted = isMuted;
      const tryPlay = () => video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
      if (video.readyState >= 2) tryPlay();
      else video.addEventListener('canplay', tryPlay, { once: true });
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, [isActive, hasError, isMuted]);

  const togglePlay = useCallback((e) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video || hasError) return;
    if (video.paused) {
      video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    } else {
      video.pause();
      setIsPlaying(false);
    }
    triggerControls();
  }, [hasError]);

  const triggerControls = () => {
    setShowControls(true);
    clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 2500);
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    setCurrentTime(video.currentTime);
    setProgress((video.currentTime / video.duration) * 100);
  };

  const handleSeek = (e) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video || !video.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX || (e.touches && e.touches[0].clientX);
    if (!x) return;
    video.currentTime = ((x - rect.left) / rect.width) * video.duration;
  };

  const skipForward = (e) => { e.stopPropagation(); if (videoRef.current) videoRef.current.currentTime += 5; triggerControls(); };
  const skipBackward = (e) => { e.stopPropagation(); if (videoRef.current) videoRef.current.currentTime -= 5; triggerControls(); };

  const fmt = (s) => {
    if (isNaN(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const remaining = duration - currentTime;

  if (hasError) {
    return (
      <div className="relative w-full h-full bg-black flex items-center justify-center rounded-[2.5rem] border border-white/5">
        <div className="text-center">
          <Play className="w-12 h-12 text-white/20 mx-auto mb-2" />
          <p className="text-white/40 text-xs font-black uppercase tracking-widest">Feed unavailable</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="relative w-full h-full bg-black select-none overflow-hidden rounded-[2.5rem]" 
      onClick={togglePlay}
      onMouseMove={triggerControls}
      onTouchStart={triggerControls}
    >
      <video
        ref={videoRef}
        src={src}
        loop
        playsInline
        preload="auto"
        muted={isMuted}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={() => { setDuration(videoRef.current?.duration || 0); setIsLoading(false); }}
        className="w-full h-full object-cover"
      />

      {/* Floating Overlays */}
      <AnimatePresence>
        {showControls && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-10"
          >
            {/* Dark gradient for readability */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60 pointer-events-none" />

            {/* TOP BAR: Author Pill + Actions */}
            <div className="absolute top-6 left-6 right-6 flex items-center justify-between pointer-events-auto">
              <div className="flex items-center gap-2 bg-black/40 backdrop-blur-xl border border-white/10 px-3 py-1.5 rounded-full pr-6 shadow-2xl">
                <div className="w-8 h-8 rounded-full bg-[#CDFF00] border border-black/20 flex items-center justify-center overflow-hidden">
                  {author?.avatar ? <img src={author.avatar} alt="" className="w-full h-full object-cover" /> : <User className="w-4 h-4 text-black" />}
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-white uppercase tracking-tight leading-none mb-0.5">{author?.name || 'Hustler'}</span>
                  <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest leading-none">@hustleup</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={(e) => { e.stopPropagation(); /* share logic */ }}
                  className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 flex items-center justify-center text-white hover:bg-[#CDFF00] hover:text-black transition-all shadow-2xl"
                >
                  <Share className="w-4 h-4" />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); /* like logic */ }}
                  className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 flex items-center justify-center text-white hover:bg-red-500 hover:border-red-500 transition-all shadow-2xl"
                >
                  <Heart className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* CENTER: Play Animation / Loading */}
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-12 h-12 border-2 border-white/20 border-t-[#CDFF00] rounded-full animate-spin" />
              </div>
            )}

            {/* BOTTOM BAR: Progress & Modern Controls */}
            <div className="absolute bottom-6 left-6 right-6 flex flex-col items-center pointer-events-auto">
              {/* Timestamps */}
              <div className="w-full flex justify-between mb-3 px-1">
                <span className="text-[10px] font-black text-white/70 uppercase tracking-widest">{fmt(currentTime)}</span>
                <span className="text-[10px] font-black text-white/50 uppercase tracking-widest">-{fmt(remaining)}</span>
              </div>

              {/* Progress Seeker */}
              <div 
                className="w-full h-1 bg-white/10 rounded-full mb-6 cursor-pointer group relative overflow-hidden"
                onClick={handleSeek}
              >
                <div 
                  className="absolute inset-y-0 left-0 bg-white rounded-full transition-all duration-100" 
                  style={{ width: `${progress}%` }} 
                />
              </div>

              {/* Main Controls Row */}
              <div className="flex items-center gap-8">
                <button onClick={skipBackward} className="text-white/60 hover:text-white transition-colors">
                  <SkipBack className="w-6 h-6 fill-current" />
                </button>
                <button 
                  onClick={togglePlay}
                  className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-all"
                >
                  {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-1" />}
                </button>
                <button onClick={skipForward} className="text-white/60 hover:text-white transition-colors">
                  <SkipForward className="w-6 h-6 fill-current" />
                </button>
              </div>
            </div>

            {/* Mute Toggle - Side Button */}
            <div className="absolute right-6 bottom-[110px]">
              <button
                onClick={(e) => { e.stopPropagation(); onMuteToggle(); }}
                className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all shadow-2xl"
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function PostMediaGallery({ media = [], className = '', author }) {
  const [current, setCurrent] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const dragStartX = useRef(0);
  const [isDragging, setIsDragging] = useState(false);

  if (!media.length) return null;

  const prev = (e) => { e?.stopPropagation(); setCurrent(c => Math.max(0, c - 1)); };
  const next = (e) => { e?.stopPropagation(); setCurrent(c => Math.min(media.length - 1, c + 1)); };

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

  const isVideo = media[current]?.type === 'VIDEO';

  return (
    <div className={`relative bg-[#0a0a0a] overflow-hidden rounded-[2.5rem] shadow-2xl border border-white/5 ${className}`}>
      {/* Carousel track */}
      <div
        className={`relative w-full ${media.length === 1 ? 'aspect-[4/5]' : 'aspect-square'} overflow-hidden`}
        onMouseDown={handleDragStart}
        onMouseUp={handleDragEnd}
        onTouchStart={handleDragStart}
        onTouchEnd={handleDragEnd}
      >
        <div
          className="flex h-full transition-transform duration-500 ease-[0.16,1,0.3,1]"
          style={{ transform: `translateX(-${current * 100}%)`, width: `${media.length * 100}%` }}
        >
          {media.map((item, index) => (
            <div
              key={`${item.url}-${index}`}
              className="relative h-full flex-shrink-0"
              style={{ width: `${100 / media.length}%` }}
            >
              {item.type === 'VIDEO' ? (
                <VideoPlayer
                  src={item.url}
                  isMuted={isMuted}
                  onMuteToggle={() => setIsMuted(m => !m)}
                  isActive={index === current}
                  author={author}
                />
              ) : (
                <div className="w-full h-full">
                  <img
                    src={item.url}
                    alt={`Post media ${index + 1}`}
                    className="w-full h-full object-cover rounded-[2.5rem]"
                    onError={(e) => { e.target.onerror = null; e.target.src = 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&q=60'; }}
                    draggable={false}
                  />
                  {/* Subtle Top Overlay for Images too */}
                  {!isVideo && (
                    <div className="absolute top-6 left-6 right-6 flex items-center justify-between">
                      <div className="flex items-center gap-2 bg-black/40 backdrop-blur-xl border border-white/10 px-3 py-1.5 rounded-full pr-6">
                        <div className="w-7 h-7 rounded-full bg-[#CDFF00] border border-black/20 flex items-center justify-center overflow-hidden">
                          {author?.avatar ? <img src={author.avatar} alt="" className="w-full h-full object-cover" /> : <User className="w-4 h-4 text-black" />}
                        </div>
                        <span className="text-[9px] font-black text-white uppercase tracking-tight">{author?.name || 'Hustler'}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Prev / Next arrows - Modern Glassy style */}
        {media.length > 1 && current > 0 && (
          <button
            onClick={prev}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white flex items-center justify-center shadow-2xl hover:bg-white hover:text-black transition-all"
          >
            <ChevronLeft className="w-6 h-6 stroke-[2.5]" />
          </button>
        )}
        {media.length > 1 && current < media.length - 1 && (
          <button
            onClick={next}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white flex items-center justify-center shadow-2xl hover:bg-white hover:text-black transition-all"
          >
            <ChevronRight className="w-6 h-6 stroke-[2.5]" />
          </button>
        )}

        {/* Counter badge */}
        {media.length > 1 && (
          <div className="absolute top-6 right-6 z-20 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-xl border border-white/10 text-white text-[10px] font-black tracking-widest shadow-2xl">
            {current + 1} / {media.length}
          </div>
        )}
      </div>

      {/* Dot indicators - Premium Line Style */}
      {media.length > 1 && (
        <div className="flex items-center justify-center gap-2 py-4 bg-[#0a0a0a]/80 backdrop-blur-sm">
          {media.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
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
