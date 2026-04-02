import { useState, useRef, useEffect } from 'react';
import { Volume2, VolumeX, Play, Pause, ChevronLeft, ChevronRight } from 'lucide-react';

function VideoPlayer({ src, isMuted, onMuteToggle, isActive }) {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showControls, setShowControls] = useState(false);
  const hideTimer = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = isMuted;
  }, [isMuted]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isActive) {
      video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, [isActive]);

  const togglePlay = (e) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().then(() => setIsPlaying(true));
    } else {
      video.pause();
      setIsPlaying(false);
    }
    flashControls();
  };

  const flashControls = () => {
    setShowControls(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowControls(false), 2500);
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    setProgress((video.currentTime / video.duration) * 100);
  };

  const handleSeek = (e) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    video.currentTime = (x / rect.width) * video.duration;
  };

  return (
    <div
      className="relative w-full h-full bg-black cursor-pointer select-none"
      onClick={togglePlay}
      onMouseEnter={flashControls}
      onMouseMove={flashControls}
    >
      <video
        ref={videoRef}
        src={src}
        loop
        playsInline
        muted={isMuted}
        onTimeUpdate={handleTimeUpdate}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        className="w-full h-full object-cover"
      />

      {/* Centre play/pause icon flash */}
      <div className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        <div className="w-16 h-16 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center border border-white/20">
          {isPlaying
            ? <Pause className="w-7 h-7 text-white fill-white" />
            : <Play className="w-7 h-7 text-white fill-white ml-1" />}
        </div>
      </div>

      {/* Mute button */}
      <button
        onClick={(e) => { e.stopPropagation(); onMuteToggle(); }}
        className="absolute bottom-3 right-3 z-20 p-2 rounded-full bg-black/60 border border-white/20 backdrop-blur-sm text-white hover:bg-white/20 transition-all"
      >
        {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
      </button>

      {/* Progress bar */}
      <div
        className="absolute bottom-0 left-0 right-0 h-1 bg-white/20 cursor-pointer z-10"
        onClick={handleSeek}
      >
        <div
          className="h-full bg-[#CDFF00] transition-all duration-100"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

export default function PostMediaGallery({ media = [], className = '' }) {
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

  return (
    <div className={`relative bg-black overflow-hidden ${className}`}>
      {/* Carousel track */}
      <div
        className={`relative w-full ${media.length === 1 ? 'aspect-[4/5]' : 'aspect-square'} overflow-hidden`}
        onMouseDown={handleDragStart}
        onMouseUp={handleDragEnd}
        onTouchStart={handleDragStart}
        onTouchEnd={handleDragEnd}
      >
        <div
          className="flex h-full transition-transform duration-300 ease-in-out"
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
                />
              ) : (
                <img
                  src={item.url}
                  alt={`Post media ${index + 1}`}
                  className="w-full h-full object-cover"
                  onError={(e) => { e.target.onerror = null; e.target.style.opacity = '0.3'; }}
                  draggable={false}
                />
              )}
            </div>
          ))}
        </div>

        {/* Prev / Next arrows */}
        {media.length > 1 && current > 0 && (
          <button
            onClick={prev}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white/90 text-black flex items-center justify-center shadow-lg hover:bg-white transition-all"
          >
            <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
          </button>
        )}
        {media.length > 1 && current < media.length - 1 && (
          <button
            onClick={next}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white/90 text-black flex items-center justify-center shadow-lg hover:bg-white transition-all"
          >
            <ChevronRight className="w-5 h-5 stroke-[2.5]" />
          </button>
        )}

        {/* Counter badge */}
        {media.length > 1 && (
          <div className="absolute top-3 right-3 z-20 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-sm text-white text-[11px] font-black tracking-wider">
            {current + 1}/{media.length}
          </div>
        )}
      </div>

      {/* Dot indicators */}
      {media.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 py-2.5 bg-black">
          {media.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`rounded-full transition-all duration-200 ${
                i === current ? 'w-5 h-1.5 bg-[#CDFF00]' : 'w-1.5 h-1.5 bg-white/20 hover:bg-white/40'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
