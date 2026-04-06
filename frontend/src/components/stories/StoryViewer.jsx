import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Volume2, VolumeX, ChevronLeft, ChevronRight, Heart, Share, Play, Pause, SkipBack, SkipForward, Send, User, BadgeCheck, Trash2 } from 'lucide-react';
import { lockBodyScroll } from '../../utils/lockBodyScroll';
import { storiesApi, dispatchToast } from '../../api/client';
import { useSelector } from 'react-redux';
import { selectUser } from '../../store/authSlice';

const formatAge = (createdAt) => {
  if (!createdAt) return 'Just now';
  const diffMs = Date.now() - new Date(createdAt).getTime();
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));
  if (diffMinutes < 60) return `${diffMinutes}m`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h`;
  return `${Math.floor(diffHours / 24)}d`;
};

export default function StoryViewer({ users, initialUserIndex, onClose, onCreateStory, onViewed, onDeleted }) {
  const [userIndex, setUserIndex] = useState(initialUserIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [storiesLocal, setStoriesLocal] = useState([]);
  const [likeInProgress, setLikeInProgress] = useState(false);
  const [deleteInProgress, setDeleteInProgress] = useState(false);
  const [viewedIds, setViewedIds] = useState(new Set());
  const videoRef = useRef(null);
  const controlsTimer = useRef(null);
  const loggedInUser = useSelector(selectUser);

  const currentUser = users[userIndex];
  const stories = currentUser?.stories || [];

  useEffect(() => {
    setStoriesLocal(stories);
    setStoryIndex(0);
    setProgress(0);
  }, [userIndex]);

  const currentStory = storiesLocal[storyIndex] || stories[storyIndex];

  const nextUser = useCallback(() => {
    if (userIndex < users.length - 1) {
      setUserIndex(userIndex + 1);
    } else {
      onClose();
    }
  }, [userIndex, users.length, onClose]);

  const prevUser = useCallback(() => {
    if (userIndex > 0) {
      setUserIndex(userIndex - 1);
    }
  }, [userIndex]);

  const nextStory = useCallback(() => {
    if (storyIndex < storiesLocal.length - 1) {
      setStoryIndex(storyIndex + 1);
      setProgress(0);
    } else {
      nextUser();
    }
  }, [storyIndex, storiesLocal.length, nextUser]);

  const prevStory = useCallback(() => {
    if (storyIndex > 0) {
      setStoryIndex(storyIndex - 1);
      setProgress(0);
    } else {
      prevUser();
    }
  }, [storyIndex, prevUser]);

  // Progress logic
  useEffect(() => {
    if (!isPlaying) return;
    const duration = 5000; // 5s per story
    const interval = 50;
    const step = (interval / duration) * 100;

    const timer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(timer);
          nextStory();
          return 0;
        }
        return prev + step;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [isPlaying, storyIndex, userIndex, nextStory]);

  const triggerControls = () => {
    setShowControls(true);
    clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  };

  const toggleLike = async (e) => {
    e.stopPropagation();
    if (likeInProgress || !currentStory) return;
    setLikeInProgress(true);
    try {
      if (currentStory.likedByCurrentUser) {
        const res = await storiesApi.unlike(currentStory.id);
        setStoriesLocal(prev => prev.map(s => s.id === currentStory.id ? res.data : s));
      } else {
        const res = await storiesApi.like(currentStory.id);
        setStoriesLocal(prev => prev.map(s => s.id === currentStory.id ? res.data : s));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLikeInProgress(false);
    }
  };

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (deleteInProgress || !currentStory) return;
    if (!window.confirm('Delete this story?')) return;
    setDeleteInProgress(true);
    try {
      await storiesApi.delete(currentStory.id);
      dispatchToast('Story deleted', 'success');
      const remaining = storiesLocal.filter(s => s.id !== currentStory.id);
      if (remaining.length === 0) {
        nextUser();
      } else {
        setStoriesLocal(remaining);
        setStoryIndex(Math.min(storyIndex, remaining.length - 1));
      }
      if (onDeleted) onDeleted(currentStory.id);
    } catch (err) {
      dispatchToast('Failed to delete story', 'error');
    } finally {
      setDeleteInProgress(false);
    }
  };

  useEffect(() => {
    if (!currentStory) return;
    const unlock = lockBodyScroll();
    return () => unlock();
  }, [currentStory]);

  if (!currentStory) return null;

  return createPortal(
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[1000] bg-black/95 backdrop-blur-3xl flex items-center justify-center overflow-hidden p-0 sm:p-4"
    >
      {/* Background Ambience */}
      <div className="absolute inset-0 z-0 opacity-20 blur-[100px] pointer-events-none">
        <img src={currentStory.mediaUrl || currentStory.media} alt="" className="w-full h-full object-cover scale-150" />
      </div>

      {/* Main Premium Card Player */}
      <motion.div 
        layoutId={`story-${currentUser.id}`}
        className="relative w-full max-w-[440px] aspect-[9/16] bg-[#050505] shadow-[0_50px_150px_rgba(0,0,0,0.8)] z-10 sm:rounded-[3rem] border border-white/10 overflow-hidden flex flex-col"
        onMouseMove={triggerControls}
        onTouchStart={triggerControls}
      >
        {/* Media Block */}
        <div className="absolute inset-0 z-0" onClick={() => setIsPlaying(!isPlaying)}>
          {currentStory.type === 'VIDEO' ? (
            <video 
              ref={videoRef}
              src={currentStory.mediaUrl || currentStory.media} 
              autoPlay 
              muted={isMuted} 
              playsInline 
              className="w-full h-full object-cover" 
              onEnded={nextStory}
            />
          ) : (
            <img src={currentStory.mediaUrl || currentStory.media} alt="" className="w-full h-full object-cover" />
          )}
        </div>

        {/* Floating Overlays */}
        <div className={`absolute inset-0 z-10 transition-opacity duration-500 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80 pointer-events-none" />

          {/* TOP: Progress + Author Pill */}
          <div className="absolute top-6 inset-x-6 pointer-events-auto">
            {/* Multi-segment progress */}
            <div className="flex gap-1.5 mb-6">
              {storiesLocal.map((_, i) => (
                <div key={i} className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden backdrop-blur-2xl">
                  <div 
                    className="h-full bg-white rounded-full transition-all duration-100 ease-linear shadow-[0_0_10px_white]"
                    style={{ width: i === storyIndex ? `${progress}%` : i < storyIndex ? '100%' : '0%' }}
                  />
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 bg-black/40 backdrop-blur-xl border border-white/10 px-3 py-1.5 rounded-full pr-6 shadow-2xl">
                <div className="w-9 h-9 rounded-full bg-[#CDFF00] border border-black/20 flex items-center justify-center overflow-hidden">
                  {currentUser.avatarUrl ? <img src={currentUser.avatarUrl} alt="" className="w-full h-full object-cover" /> : <User className="w-5 h-5 text-black" />}
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-white uppercase tracking-tight leading-none mb-0.5">{currentUser.fullName}</span>
                  <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest leading-none">@{formatAge(currentStory.createdAt)}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }}
                  className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 flex items-center justify-center text-white"
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
                {loggedInUser && currentStory?.authorId === String(loggedInUser.id) && (
                  <button
                    onClick={handleDelete}
                    disabled={deleteInProgress}
                    className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 flex items-center justify-center text-white hover:bg-red-500/80 hover:border-red-400 transition-all"
                    title="Delete story"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Persistent Exit Button (Always Visible) */}
          <button 
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="absolute top-12 right-6 z-[100] w-12 h-12 rounded-full bg-black/40 backdrop-blur-3xl border border-white/10 flex items-center justify-center text-white hover:bg-[#CDFF00] hover:text-black hover:border-transparent transition-all shadow-2xl active:scale-95"
            title="Close Story"
          >
            <X className="w-6 h-6" />
          </button>

          {/* CENTER: Play/Pause Big Icon (on hover/tap) */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {!isPlaying && (
              <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-20 h-20 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 flex items-center justify-center text-white">
                <Play className="w-8 h-8 fill-current ml-1" />
              </motion.div>
            )}
          </div>

          {/* BOTTOM: Reply + Actions */}
          <div className="absolute bottom-8 inset-x-6 flex items-center gap-3 pointer-events-auto">
            <div className="flex-1 relative group">
              <input 
                type="text" 
                placeholder="Reply to story..." 
                className="w-full bg-black/40 backdrop-blur-2xl border border-white/10 rounded-full px-6 py-4 text-xs font-bold text-white placeholder-gray-500 outline-none focus:border-[#CDFF00] transition-all"
                onClick={(e) => e.stopPropagation()}
              />
              <button className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-gray-500 hover:text-[#CDFF00] transition-colors">
                <Send className="w-4 h-4" />
              </button>
            </div>

            <button 
              onClick={toggleLike}
              className={`w-12 h-12 rounded-full backdrop-blur-xl border border-white/10 flex items-center justify-center transition-all ${currentStory.likedByCurrentUser ? 'bg-red-500/20 border-red-500/40 text-red-500' : 'bg-black/40 text-white hover:bg-white/10'}`}
            >
              <Heart className={`w-5 h-5 ${currentStory.likedByCurrentUser ? 'fill-current' : ''}`} />
            </button>
            
            <button className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 flex items-center justify-center text-white hover:bg-white/10 transition-all">
              <Share className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Side Tap Regions */}
        <div className="absolute inset-y-0 left-0 w-20 z-20 cursor-pointer" onClick={(e) => { e.stopPropagation(); prevStory(); }} />
        <div className="absolute inset-y-0 right-0 w-20 z-20 cursor-pointer" onClick={(e) => { e.stopPropagation(); nextStory(); }} />
      </motion.div>

      {/* Large Navigation Arrows (Desktop) */}
      <div className="hidden lg:flex absolute inset-x-20 justify-between pointer-events-none items-center">
        <button 
          onClick={prevUser} 
          className={`w-16 h-16 rounded-full bg-white/5 border border-white/10 text-white flex items-center justify-center pointer-events-auto hover:bg-[#CDFF00] hover:text-black transition-all ${userIndex === 0 ? 'opacity-0' : 'opacity-100'}`}
        >
          <ChevronLeft className="w-8 h-8" />
        </button>
        <button 
          onClick={nextUser} 
          className="w-16 h-16 rounded-full bg-white/5 border border-white/10 text-white flex items-center justify-center pointer-events-auto hover:bg-[#CDFF00] hover:text-black transition-all"
        >
          <ChevronRight className="w-8 h-8" />
        </button>
      </div>
    </motion.div>,
    document.body
  );
}
