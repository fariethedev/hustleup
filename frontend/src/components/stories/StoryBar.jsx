import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { useSelector } from 'react-redux';
import { authApi, storiesApi, usersApi, dispatchToast } from '../../api/client';
import { selectUser } from '../../store/authSlice';
import StoryViewer from './StoryViewer';
import StoryCreator from './StoryCreator';

const getDisplayName = (person) => person?.fullName || person?.name || 'User';

const getAvatarUrl = (person) => {
  if (person?.avatarUrl) return person.avatarUrl;
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(getDisplayName(person))}`;
};

const fallbackAvatar = (e, person) => {
  e.target.onerror = null;
  e.target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(getDisplayName(person))}`;
};

const getStatusLine = (person, hasStories) => {
  if (hasStories) {
    if (person?.role === 'SELLER') return 'hustler';
    if (person?.role === 'BUYER') return 'buyer';
    return 'Tap to view';
  }
  if (person?.online === true || person?.online === 'true') return 'online now';
  if (person?.bio) return person.bio.length > 26 ? `${person.bio.slice(0, 26)}...` : person.bio;
  if (person?.role) return person.role.toLowerCase();
  return 'No story yet';
};

export default function StoryBar() {
  const currentUser = useSelector(selectUser);
  const [stories, setStories] = useState([]);
  const [users, setUsers] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedUserIndex, setSelectedUserIndex] = useState(null);
  const [isCreatorOpen, setIsCreatorOpen] = useState(false);
  const scrollRef = useRef(null);

  const fetchStories = async () => {
    try {
      const [storiesRes, usersRes, meRes] = await Promise.all([
        storiesApi.getAll(),
        usersApi.getAll(),
        authApi.me().catch(() => ({ data: currentUser })),
      ]);

      setStories(storiesRes.data || []);
      setUsers(usersRes.data || []);
      setProfile(meRes.data || currentUser || null);
    } catch (err) {
      console.error('Failed to fetch stories:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStories();
  }, []);

  const groupedStories = useMemo(() => (
    stories.reduce((acc, story) => {
      if (!acc[story.authorId]) {
        acc[story.authorId] = [];
      }
      acc[story.authorId].push(story);
      acc[story.authorId].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      return acc;
    }, {})
  ), [stories]);

  const currentProfile = profile || currentUser;
  const currentUserId = currentProfile?.id;
  
  const peopleWithStories = useMemo(() => {
    const deduped = new Map();
    // Add current user first
    if (currentProfile?.id) {
      deduped.set(currentProfile.id, { ...currentProfile, stories: groupedStories[currentProfile.id] || [] });
    }
    // Add others
    users.forEach((person) => {
      if (person?.id && !deduped.has(person.id)) {
        deduped.set(person.id, { ...person, stories: groupedStories[person.id] || [] });
      }
    });

    // Sort: current user first, then those with stories, then alphabetical
    return Array.from(deduped.values()).sort((a, b) => {
      if (a.id === currentUserId) return -1;
      if (b.id === currentUserId) return 1;
      const aHas = a.stories.length > 0;
      const bHas = b.stories.length > 0;
      if (aHas !== bHas) return aHas ? -1 : 1;
      return getDisplayName(a).localeCompare(getDisplayName(b));
    });
  }, [currentProfile, users, groupedStories, currentUserId]);

  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [peopleWithStories]);

  const scroll = (direction) => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const scrollAmount = clientWidth * 0.7; // Scroll by 70% of viewport
      const scrollTo = direction === 'left' ? scrollLeft - scrollAmount : scrollLeft + scrollAmount;
      scrollRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
      // Minor delay to check scroll after animation
      setTimeout(checkScroll, 400);
    }
  };

  const renderStoryCard = (person, globalIndex) => {
    const isCurrentUser = person.id === currentUserId;
    const personStories = person.stories;
    const hasStories = personStories.length > 0;
    const hasUnseenStories = hasStories && personStories.some(s => !s.viewedByCurrentUser);
    const clickable = isCurrentUser || hasStories;

    return (
      <div key={person.id} className="flex flex-col items-center gap-4 flex-shrink-0 w-[120px] group transition-all duration-500">
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              if (isCurrentUser && !hasStories) {
                setIsCreatorOpen(true);
                return;
              }
              if (hasStories) setSelectedUserIndex(globalIndex);
            }}
            className={`relative w-24 h-24 rounded-full p-[4px] transition-all duration-500 transform group-hover:scale-110 active:scale-90 ${
            hasUnseenStories
              ? 'bg-[#CDFF00] shadow-[0_0_30px_rgba(205,255,0,0.4)]'
              : hasStories
                ? 'bg-gradient-to-tr from-white/80 to-violet-400 border border-white/20 shadow-[0_0_20px_rgba(255,255,255,0.2)]'
                : 'bg-white/5 border border-white/5'
            } ${clickable ? 'cursor-pointer' : 'cursor-default opacity-40'}`}
          >
            <div className={`w-full h-full rounded-full bg-black flex items-center justify-center overflow-hidden border-[4px] border-black`}>
              <img
                src={getAvatarUrl(person)}
                alt={getDisplayName(person)}
                onError={(e) => fallbackAvatar(e, person)}
                className={`w-full h-full object-cover transition-all duration-700 ${hasStories ? 'scale-110 group-hover:scale-125' : 'grayscale group-hover:grayscale-0 opacity-60 group-hover:opacity-100'}`}
              />
            </div>
            
            {/* Visual enhancements for special cases */}
            {isCurrentUser && (
              <div className="absolute bottom-1 right-1 w-8 h-8 bg-[#CDFF00] rounded-full border-[5px] border-black flex items-center justify-center shadow-xl z-10 transition-transform group-hover:rotate-90">
                <Plus className="w-5 h-5 text-black stroke-[4px]" />
              </div>
            )}
          </button>
        </div>
        
        <div className="text-center px-2">
          <Link to={`/profile/${person.id}`}>
            <h4 className={`text-[12px] font-black uppercase tracking-[0.2em] truncate mb-1 transition-colors hover:text-[#CDFF00] cursor-pointer ${hasUnseenStories ? 'text-[#CDFF00]' : hasStories ? 'text-[#e9d5ff]' : 'text-gray-400 group-hover:text-white'}`}>
              {isCurrentUser ? 'Your Story' : getDisplayName(person).split(' ')[0]}
            </h4>
          </Link>
          <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest truncate opacity-60 group-hover:opacity-100 transition-opacity">
            {getStatusLine(person, hasStories)}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="relative w-full">
      <div className="w-screen relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] py-14 group/bar border-y border-white/5 bg-[#050505]/40 backdrop-blur-3xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]">
        {/* Side Masks for indications */}
        <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-[#000] to-transparent z-10 pointer-events-none opacity-90" />
        <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-[#000] to-transparent z-10 pointer-events-none opacity-90" />

        {/* Navigation Arrows */}
        <AnimatePresence>
          {canScrollLeft && (
            <motion.button 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={() => scroll('left')}
              className="absolute left-8 top-1/2 -translate-y-1/2 z-20 p-5 rounded-full bg-black/80 border border-white/10 text-white shadow-2xl hover:bg-[#CDFF00] hover:text-black hover:scale-110 active:scale-90 transition-all backdrop-blur-xl"
            >
              <ChevronLeft className="w-8 h-8 stroke-[3px]" />
            </motion.button>
          )}
        </AnimatePresence>
        
        <AnimatePresence>
          {canScrollRight && (
            <motion.button 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={() => scroll('right')}
              className="absolute right-8 top-1/2 -translate-y-1/2 z-20 p-5 rounded-full bg-black/80 border border-white/10 text-white shadow-2xl hover:bg-[#CDFF00] hover:text-black hover:scale-110 active:scale-90 transition-all backdrop-blur-xl"
            >
              <ChevronRight className="w-8 h-8 stroke-[3px]" />
            </motion.button>
          )}
        </AnimatePresence>

        <div 
          ref={scrollRef}
          onScroll={checkScroll}
          className="w-full flex items-start gap-10 overflow-x-hidden scroll-smooth px-[max(2rem,calc((100vw-1280px)/2+2rem))] scrollbar-hide"
        >
          {peopleWithStories.map((person, index) => renderStoryCard(person, index))}

          {loading && [...Array(10)].map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-4 flex-shrink-0 animate-pulse w-[120px]">
              <div className="w-24 h-24 rounded-full bg-white/5" />
              <div className="w-20 h-2.5 bg-white/10 rounded-full" />
              <div className="w-14 h-2 bg-white/5 rounded-full opacity-50" />
            </div>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {selectedUserIndex !== null && (
          <StoryViewer
            users={peopleWithStories}
            initialUserIndex={selectedUserIndex}
            onClose={() => setSelectedUserIndex(null)}
            onViewed={(storyId) => {
              setStories(prev => prev.map(s => 
                s.id === storyId ? { ...s, viewedByCurrentUser: true } : s
              ));
            }}
            onCreateStory={() => setIsCreatorOpen(true)}
          />
        )}
        {isCreatorOpen && (
          <StoryCreator
            onClose={() => setIsCreatorOpen(false)}
            onSuccess={() => {
              setIsCreatorOpen(false);
              fetchStories();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
