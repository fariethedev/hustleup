import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { useSelector } from 'react-redux';
import { authApi, storiesApi, usersApi } from '../../api/client';
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
      const scrollAmount = clientWidth * 0.7;
      const scrollTo = direction === 'left' ? scrollLeft - scrollAmount : scrollLeft + scrollAmount;
      scrollRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
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
      <div key={person.id} className="flex flex-col items-center gap-1.5 shrink-0 w-[72px]">
        <button
          type="button"
          onClick={() => {
            if (isCurrentUser && !hasStories) {
              setIsCreatorOpen(true);
              return;
            }
            if (hasStories) setSelectedUserIndex(globalIndex);
          }}
          className={`relative w-16 h-16 rounded-full p-[2px] transition-transform active:scale-95 ${
            hasUnseenStories
              ? 'bg-gradient-to-tr from-[#FF00FF] to-[#00FFFF]'
              : hasStories
                ? 'bg-white/15'
                : 'bg-white/5'
          } ${clickable ? 'cursor-pointer hover:scale-105' : 'cursor-default opacity-50'}`}
        >
          <div className="w-full h-full rounded-full bg-black overflow-hidden border-2 border-[#050505]">
            <img
              src={getAvatarUrl(person)}
              alt={getDisplayName(person)}
              onError={(e) => fallbackAvatar(e, person)}
              className="w-full h-full object-cover"
            />
          </div>

          {isCurrentUser && (
            <div className="absolute bottom-0 right-0 w-5 h-5 bg-[#CDFF00] rounded-full border-2 border-[#050505] flex items-center justify-center">
              <Plus className="w-3 h-3 text-black stroke-[3px]" />
            </div>
          )}
        </button>

        <Link to={`/profile/${person.id}`} className="max-w-full">
          <p className={`text-[11px] font-semibold truncate text-center hover:text-white transition-colors ${
            isCurrentUser ? 'text-white' : hasUnseenStories ? 'text-white' : 'text-gray-400'
          }`}>
            {isCurrentUser ? 'Your story' : getDisplayName(person).split(' ')[0]}
          </p>
        </Link>
      </div>
    );
  };

  return (
    <div className="relative w-full group/bar border-b border-white/5">
      <div className="relative overflow-hidden">
        {/* Edge fades hint that the tray scrolls */}
        <div className="absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-[#050505] to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-[#050505] to-transparent z-10 pointer-events-none" />

        {/* Scroll arrows — small and only shown when there's more to scroll */}
        <AnimatePresence>
          {canScrollLeft && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => scroll('left')}
              aria-label="Scroll left"
              className="absolute left-1 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-black/80 border border-white/10 text-white shadow-lg flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
            >
              <ChevronLeft className="w-4 h-4" />
            </motion.button>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {canScrollRight && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => scroll('right')}
              aria-label="Scroll right"
              className="absolute right-1 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-black/80 border border-white/10 text-white shadow-lg flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
            >
              <ChevronRight className="w-4 h-4" />
            </motion.button>
          )}
        </AnimatePresence>

        <div
          ref={scrollRef}
          onScroll={checkScroll}
          className="w-full flex items-start gap-3 overflow-x-auto scroll-smooth px-3 py-3 scrollbar-hide"
        >
          {peopleWithStories.map((person, index) => renderStoryCard(person, index))}

          {loading && [...Array(8)].map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5 shrink-0 w-[72px] animate-pulse">
              <div className="w-16 h-16 rounded-full bg-white/5" />
              <div className="w-10 h-2 bg-white/10 rounded-full" />
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
