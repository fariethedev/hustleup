import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Volume2, VolumeX, ChevronLeft, ChevronRight, Heart } from 'lucide-react';
import { lockBodyScroll } from '../../utils/lockBodyScroll';
import { storiesApi } from '../../api/client';

const formatAge = (createdAt) => {
  if (!createdAt) return 'Just now';
  const diffMs = Date.now() - new Date(createdAt).getTime();
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};

export default function StoryViewer({ users, initialUserIndex, onClose, onCreateStory }) {
  const [userIndex, setUserIndex] = useState(initialUserIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [likeInProgress, setLikeInProgress] = useState(false);

  const currentUser = users[userIndex];
  const stories = currentUser?.stories || [];
  const currentStory = stories[storyIndex];

  useEffect(() => lockBodyScroll(), []);

  const nextUser = () => {
    if (userIndex < users.length - 1) {
      const nextIdx = users.slice(userIndex + 1).findIndex(u => u.stories.length > 0);
      if (nextIdx !== -1) {
        setUserIndex(userIndex + 1 + nextIdx);
        setStoryIndex(0);
        setProgress(0);
      } else {
        onClose();
      }
    } else {
      onClose();
    }
  };

  const prevUser = () => {
    if (userIndex > 0) {
      const prevIdx = users.slice(0, userIndex).reverse().findIndex(u => u.stories.length > 0);
      if (prevIdx !== -1) {
        setUserIndex(userIndex - 1 - prevIdx);
        setStoryIndex(0);
        setProgress(0);
      }
    }
  };

  const nextStory = () => {
    if (storyIndex < stories.length - 1) {
      setStoryIndex(storyIndex + 1);
      setProgress(0);
    } else {
      nextUser();
    }
  };

  const [storiesLocal, setStoriesLocal] = useState(stories);

  useEffect(() => {
    setStoriesLocal(stories);
  }, [stories]);

  const toggleLike = async (e) => {
    e.stopPropagation();
    if (likeInProgress) return;
    
    setLikeInProgress(true);
    try {
      const story = storiesLocal[storyIndex];
      if (story.likedByCurrentUser) {
        const res = await storiesApi.unlike(story.id);
        const updated = res.data;
        setStoriesLocal(prev => prev.map((s, i) => i === storyIndex ? updated : s));
      } else {
        const res = await storiesApi.like(story.id);
        const updated = res.data;
        setStoriesLocal(prev => prev.map((s, i) => i === storyIndex ? updated : s));
      }
    } catch (err) {
      console.error('Failed to toggle like:', err);
    } finally {
      setLikeInProgress(false);
    }
  };

  const currentStoryLocal = storiesLocal[storyIndex] || currentStory;

  const prevStory = () => {
    if (storyIndex > 0) {
      setStoryIndex(storyIndex - 1);
      setProgress(0);
    } else {
      prevUser();
    }
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          nextStory();
          return 0;
        }
        return prev + 1.25; 
      });
    }, 50);

    return () => clearInterval(timer);
  }, [userIndex, storyIndex]);

  if (!currentStory) return null;

  const isOwnStory = currentUser.id === users[0]?.id;

  return createPortal(
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-[1000] bg-black flex items-center justify-center overflow-hidden"
    >
      {/* Background Atmosphere */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none bg-[#050505]">
         <img 
           src={currentStory.mediaUrl || currentStory.media}
           className="w-full h-full object-cover blur-[100px] opacity-20 scale-125"
           alt=""
         />
      </div>

      {/* Safety Gradients */}
      <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-black/80 to-transparent z-10 pointer-events-none" />
      <div className="absolute bottom-0 inset-x-0 h-40 bg-gradient-to-t from-black/80 to-transparent z-10 pointer-events-none" />

      {/* Close Button */}
      <button 
        onClick={onClose}
        className="absolute top-10 right-10 z-[120] p-4 rounded-full bg-white/10 hover:bg-[#CDFF00] hover:text-black transition-all group scale-125 backdrop-blur-2xl border border-white/20 shadow-2xl"
      >
        <X className="w-8 h-8" />
      </button>

      {/* Viewport Navigation Arrows */}
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between px-8 sm:px-16 z-[110] pointer-events-none">
        <button 
          onClick={prevStory}
          className={`p-6 sm:p-8 rounded-full bg-black/50 border border-white/10 text-white pointer-events-auto hover:bg-[#CDFF00] hover:text-black transition-all transform hover:scale-110 active:scale-95 backdrop-blur-xl shadow-2xl ${userIndex === 0 && storyIndex === 0 ? 'opacity-0 cursor-default' : 'opacity-100'}`}
        >
          <ChevronLeft className="w-10 h-10" />
        </button>
        <button 
          onClick={nextStory}
          className="p-6 sm:p-8 rounded-full bg-black/50 border border-white/10 text-white pointer-events-auto hover:bg-[#CDFF00] hover:text-black transition-all transform hover:scale-110 active:scale-95 backdrop-blur-xl shadow-2xl"
        >
          <ChevronRight className="w-10 h-10" />
        </button>
      </div>

      {/* Main Container */}
      <div className="relative w-full max-w-[480px] aspect-[9/16] bg-black overflow-hidden shadow-[0_0_150px_rgba(0,0,0,1)] z-10 sm:rounded-[3.5rem] border border-white/10 flex flex-col mx-4 sm:mx-0 translate-y-0">
        
        {/* Progress Bars */}
        <div className="absolute top-8 left-8 right-8 flex gap-2 z-30">
          {stories.map((_, i) => (
            <div key={i} className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#CDFF00] transition-all duration-100 ease-linear shadow-[0_0_15px_#CDFF00]"
                style={{ width: i === storyIndex ? `${progress}%` : i < storyIndex ? '100%' : '0%' }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-12 left-8 right-8 flex items-center justify-between z-30">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-full border-2 border-[#CDFF00] p-0.5 shadow-lg bg-black/40">
              <img 
                src={currentUser.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser.fullName || currentUser.name}`} 
                alt="Author" 
                className="w-full h-full rounded-full object-cover" 
              />
            </div>
            <div>
              <p className="text-white text-sm font-black uppercase tracking-[0.2em]">{currentUser.fullName || currentUser.name}</p>
              <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest mt-1 opacity-80">{formatAge(currentStoryLocal.createdAt)}</p>
            </div>
          </div>
          <button 
            onClick={() => setIsMuted(!isMuted)}
            className="p-3 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white hover:bg-[#CDFF00] hover:text-black transition-all shadow-xl"
          >
            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
        </div>

        {/* Media Content */}
        <div className="flex-1 flex items-center justify-center relative bg-black">
          {currentStoryLocal.type === 'TEXT' ? (
            <div className="p-12 text-center w-full z-20">
               <motion.h3 
                 key={currentStoryLocal.id}
                 initial={{ scale: 0.9, opacity: 0 }}
                 animate={{ scale: 1, opacity: 1 }}
                 className="text-4xl sm:text-5xl text-white font-black leading-tight tracking-tight uppercase italic"
               >
                 <span className="bg-[#CDFF00] text-black px-4 py-2 inline-block">
                   "{currentStoryLocal.content}"
                 </span>
               </motion.h3>
            </div>
          ) : currentStoryLocal.type === 'VIDEO' ? (
            <video 
              key={currentStoryLocal.mediaUrl || currentStoryLocal.media}
              src={currentStoryLocal.mediaUrl || currentStoryLocal.media} 
              autoPlay 
              muted={isMuted}
              loop
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <img 
              key={currentStoryLocal.mediaUrl || currentStoryLocal.media}
              src={currentStoryLocal.mediaUrl || currentStoryLocal.media} 
              alt="Story Content" 
              className="w-full h-full object-cover"
            />
          )}
        </div>

        {/* Hidden Tap Zones (Mobile) */}
        <div className="absolute inset-0 flex sm:hidden z-10 pointer-events-none">
          <div onClick={prevStory} className="w-[30%] h-full cursor-pointer pointer-events-auto" />
          <div onClick={nextStory} className="w-[70%] h-full cursor-pointer pointer-events-auto" />
        </div>

        {/* Footer Actions */}
        <div className="absolute bottom-10 left-8 right-8 flex items-center justify-center z-30">
          {isOwnStory ? (
            <button
              type="button"
              onClick={onCreateStory}
              className="px-10 py-4 rounded-full bg-[#CDFF00] text-black font-black text-xs uppercase tracking-[0.2em] hover:scale-105 active:scale-95 transition-all shadow-2xl flex items-center gap-3"
            >
              <Plus className="w-5 h-5 stroke-[4px]" />
              Add to Story
            </button>
          ) : (
            <div className="w-full flex gap-3 items-center">
              <div className="flex-1 relative">
                <input 
                  type="text" 
                  placeholder="Reply to story..." 
                  className="w-full bg-white/10 border border-white/20 rounded-full px-8 py-4 text-white text-xs font-bold placeholder:text-gray-500 focus:outline-none focus:border-[#CDFF00]/50 transition-all backdrop-blur-2xl"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              
              <button 
                onClick={toggleLike}
                disabled={likeInProgress}
                className={`p-4 rounded-full backdrop-blur-2xl border transition-all flex items-center gap-2 group ${currentStoryLocal.likedByCurrentUser ? 'bg-[#CDFF00] border-[#CDFF00] text-black shadow-[0_0_20px_rgba(205,255,0,0.4)]' : 'bg-white/10 border-white/20 text-white hover:border-[#CDFF00]/50'}`}
              >
                <Heart className={`w-6 h-6 transition-transform group-hover:scale-110 ${currentStoryLocal.likedByCurrentUser ? 'fill-black' : ''}`} />
                {currentStoryLocal.likesCount > 0 && (
                  <span className={`text-[10px] font-black ${currentStoryLocal.likedByCurrentUser ? 'text-black' : 'text-white'}`}>
                    {currentStoryLocal.likesCount}
                  </span>
                )}
              </button>

              <button className="p-4 rounded-full bg-[#CDFF00] text-black hover:scale-105 active:scale-95 transition-all shadow-xl">
                <ChevronRight className="w-6 h-6 stroke-[4px]" />
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>,
    document.body
  );
}
