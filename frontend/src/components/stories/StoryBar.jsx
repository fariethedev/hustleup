import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, ChevronLeft, ChevronRight, Eye, PlusCircle } from 'lucide-react';
import { useSelector } from 'react-redux';
import { authApi, storiesApi, usersApi } from '../../api/client';
import { selectUser } from '../../store/authSlice';
import StoryViewer from './StoryViewer';
import StoryCreator from './StoryCreator';
import { displayName as getDisplayName, shortName } from '../../utils/displayName';

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
  // Open when you tap your own ring and you already have a story running. Tapping it used
  // to go straight to the viewer, which meant the only way to add a second story was the
  // small + badge — easy to miss, and easy to hit by accident when you meant to watch.
  // Asking once is the only way a single target can honestly serve both intents.
  const [ownStoryChoiceOpen, setOwnStoryChoiceOpen] = useState(false);
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

  /** How many of your own stories are still live — the subtitle on the view option. */
  const ownStoryCount = (groupedStories[currentUserId] || []).length;

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
        {/* The + is a button in its own right rather than decoration inside the avatar
            button. Previously the avatar handled both jobs and could only do one: with no
            story it opened the creator, but the moment you had one it always opened the
            viewer — so the + stayed on screen looking like "add" while doing nothing, and
            there was no way to post a second story at all.
            A nested <button> is invalid HTML, so this is a positioned sibling. */}
        <div className="relative w-16 h-16">
          <button
            type="button"
            onClick={() => {
              // Your own ring with something on it is ambiguous — watch it, or add to it?
              // Everyone else's has only one meaning, so it still opens straight away.
              if (isCurrentUser && hasStories) setOwnStoryChoiceOpen(true);
              else if (hasStories) setSelectedUserIndex(globalIndex);
              else if (isCurrentUser) setIsCreatorOpen(true);
            }}
            aria-haspopup={isCurrentUser && hasStories ? 'menu' : undefined}
            aria-expanded={isCurrentUser && hasStories ? ownStoryChoiceOpen : undefined}
            aria-label={
              isCurrentUser && hasStories
                ? 'Your story — view it or add to it'
                : hasStories
                  ? `View ${getDisplayName(person)}'s story`
                  : 'Add to your story'
            }
            className={`w-full h-full rounded-full p-[2px] transition-transform active:scale-95 ${
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
          </button>

          {isCurrentUser && (
            <button
              type="button"
              onClick={() => setIsCreatorOpen(true)}
              aria-label="Add to your story"
              title="Add to your story"
              className="absolute -bottom-0.5 -right-0.5 w-6 h-6 bg-[#CDFF00] rounded-full border-2 border-[#050505] flex items-center justify-center z-10 transition-transform hover:scale-110 active:scale-95"
            >
              <Plus className="w-3.5 h-3.5 text-black stroke-[3px]" />
            </button>
          )}
        </div>

        <Link to={`/profile/${person.id}`} className="max-w-full">
          <p className={`text-[11px] font-semibold truncate text-center hover:text-white transition-colors ${
            isCurrentUser ? 'text-white' : hasUnseenStories ? 'text-white' : 'text-gray-400'
          }`}>
            {isCurrentUser ? 'Your story' : shortName(person)}
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
          className="w-full flex items-start gap-3 overflow-x-auto overscroll-x-contain scroll-smooth px-3 py-3 scrollbar-hide"
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
        {/* Two doors behind one ring. Deliberately a sheet rather than a hover menu: the
            story tray is a touch target first, and a hover-only affordance would be
            unreachable on the phones most stories are posted from. */}
        {ownStoryChoiceOpen && (
          <>
            <motion.div
              key="own-story-scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOwnStoryChoiceOpen(false)}
              className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              key="own-story-choice"
              role="menu"
              aria-label="Your story"
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 320, damping: 26 }}
              className="fixed z-[201] left-1/2 -translate-x-1/2 bottom-6 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 w-[min(22rem,calc(100vw-2rem))] rounded-3xl border border-white/10 bg-[#0A0A0A] p-2 shadow-[0_28px_80px_-24px_rgba(0,0,0,0.95)]"
            >
              <p className="px-4 pt-3 pb-2 text-[10px] font-black uppercase tracking-[0.24em] text-gray-500">
                Your story
              </p>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOwnStoryChoiceOpen(false);
                  // The current user is always sorted to index 0 of peopleWithStories, but
                  // find it rather than assume — the sort is a detail this shouldn't depend on.
                  const index = peopleWithStories.findIndex((p) => p.id === currentUserId);
                  setSelectedUserIndex(index >= 0 ? index : 0);
                }}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left hover:bg-white/5 transition-colors"
              >
                <span className="w-10 h-10 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center shrink-0">
                  <Eye className="w-4.5 h-4.5 text-white" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-white">View your story</span>
                  <span className="block text-[11px] text-gray-500">
                    {ownStoryCount === 1 ? '1 story live' : `${ownStoryCount} stories live`}
                  </span>
                </span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => { setOwnStoryChoiceOpen(false); setIsCreatorOpen(true); }}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left hover:bg-white/5 transition-colors"
              >
                <span className="w-10 h-10 rounded-full bg-[#CDFF00]/15 border border-[#CDFF00]/30 flex items-center justify-center shrink-0">
                  <PlusCircle className="w-4.5 h-4.5 text-[#CDFF00]" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-white">Add to your story</span>
                  <span className="block text-[11px] text-gray-500">Post a new photo or clip</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setOwnStoryChoiceOpen(false)}
                className="w-full mt-1 px-4 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
            </motion.div>
          </>
        )}

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
