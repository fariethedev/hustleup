import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link as LinkIcon, X, Check, Send, Search } from 'lucide-react';
import { directMessagesApi, usersApi } from '../api/client';
import { useSelector } from 'react-redux';
import { selectUser } from '../store/authSlice';
import { useToast } from '../context/ToastContext';
import { formatPrice } from '../utils/constants';
import { uploadUrl } from '../config';

// In-app "share to a person" sheet — mirrors Instagram's share-to-DM pattern rather than
// only offering an OS share sheet. Defaults the pick list to people you already have a DM
// thread with; typing a name also searches everyone else on the platform.
//
// type: 'listing' | 'post' | 'story' — a marketplace listing has a real page to
// copy-link to (its own URL IS the listing's page); a feed post doesn't have a dedicated
// single-post route in this app, and a story is ephemeral with no route at all, so the
// "Copy link" option is only shown for listings.
export default function ShareModal({ type, item, onClose }) {
  const isListing = type === 'listing';
  const isStory = type === 'story';
  const currentUser = useSelector(selectUser);
  const { showToast } = useToast();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [allUsers, setAllUsers] = useState(null); // lazy-loaded only once search is used
  const [searchingAll, setSearchingAll] = useState(false);
  const [sentIds, setSentIds] = useState(new Set());
  const [busyId, setBusyId] = useState(null);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    directMessagesApi.getPartners()
      .then((res) => setContacts(res.data || []))
      .catch(() => setContacts([]))
      .finally(() => setLoading(false));
  }, []);

  const query = search.trim().toLowerCase();
  const contactMatches = query
    ? contacts.filter((c) => (c.name || '').toLowerCase().includes(query))
    : contacts;

  // Only hit /users once real search text is typed, and only if it isn't already
  // satisfied by an existing contact — avoids loading the full user list up front.
  useEffect(() => {
    if (!query || allUsers !== null) return;
    setSearchingAll(true);
    usersApi.getAll()
      .then((res) => setAllUsers(res.data || []))
      .catch(() => setAllUsers([]))
      .finally(() => setSearchingAll(false));
  }, [query, allUsers]);

  const contactIds = new Set(contacts.map((c) => c.id));
  const extraMatches = query && allUsers
    ? allUsers.filter((u) =>
        u.id !== currentUser?.id &&
        !contactIds.has(u.id) &&
        (u.fullName || '').toLowerCase().includes(query))
    : [];

  const results = [...contactMatches, ...extraMatches];

  const handleSend = async (person) => {
    setBusyId(person.id);
    try {
      if (isListing) await directMessagesApi.shareListing(person.id, item);
      else if (isStory) await directMessagesApi.shareStory(person.id, item);
      else await directMessagesApi.sharePost(person.id, item);
      setSentIds((prev) => new Set(prev).add(person.id));
      showToast(`Sent to ${person.name || person.fullName}`, 'success');
    } catch (e) {
      showToast('Could not send — try again', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setLinkCopied(true);
      showToast('Link copied!');
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      showToast('Could not copy link', 'error');
    }
  };

  const thumb = isListing
    ? (item?.mediaUrls?.[0] || item?.image)
    : isStory
      ? item?.mediaUrl                                   // null for a TEXT story
      : (item?.media?.[0]?.url || item?.imageUrl);
  const title = isListing
    ? item?.title
    : isStory
      // A TEXT story has no media, so its words are the only preview available.
      ? (item?.content || `${item?.type === 'VIDEO' ? 'Video' : 'Photo'} story`)
      : (item?.content || 'Post');
  const postByLine = !isListing && item?.authorName ? `by ${item.authorName}` : null;
  const heading = isListing ? 'Share listing' : isStory ? 'Share story' : 'Share post';
  const placeholderGlyph = isListing ? '🛍️' : isStory ? '✨' : '📤';

  return (
    <div className="fixed inset-0 z-[500] flex items-end sm:items-center justify-center">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }}
        className="relative w-full sm:max-w-md bg-[#0a0a0a] border border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[80vh]"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between shrink-0">
          <h2 className="text-base font-bold text-white">{heading}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* What you're sharing */}
        <div className="px-5 pt-4 flex items-center gap-3 shrink-0">
          <div className="w-12 h-12 rounded-xl overflow-hidden bg-white/5 border border-white/10 shrink-0 flex items-center justify-center text-2xl">
            {thumb
              ? (isStory && item?.type === 'VIDEO'
                  // A video story's mediaUrl is a video file — <img> would render broken.
                  ? <video src={thumb} className="w-full h-full object-cover" muted playsInline />
                  : <img src={thumb} alt="" className="w-full h-full object-cover" />)
              : placeholderGlyph}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-white truncate">{title}</p>
            {isListing && item?.price != null && (
              <p className="text-xs text-[#CDFF00] font-bold">{formatPrice(item.price, item.currency)}</p>
            )}
            {postByLine && <p className="text-xs text-gray-400 truncate">{postByLine}</p>}
          </div>
        </div>

        {/* Copy link — only listings have a dedicated page to link to */}
        {isListing && (
          <div className="px-5 pt-4 shrink-0">
            <button
              onClick={handleCopyLink}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-sm font-semibold text-white"
            >
              {linkCopied ? <Check className="w-4 h-4 text-[#CDFF00]" /> : <LinkIcon className="w-4 h-4 text-gray-400" />}
              {linkCopied ? 'Link copied' : 'Copy link'}
            </button>
          </div>
        )}

        {/* Search */}
        <div className="px-5 pt-4 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search people..."
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-white text-sm placeholder-gray-500 outline-none focus:border-[#CDFF00] transition-all"
            />
          </div>
        </div>

        {/* People list */}
        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3">
          {loading ? (
            <div className="space-y-2 px-2">
              {[...Array(4)].map((_, i) => <div key={i} className="h-14 rounded-xl bg-white/[0.03] animate-pulse" />)}
            </div>
          ) : results.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-500">
              {query ? (searchingAll ? 'Searching…' : 'No one found') : 'Start a chat first to share here, or search for someone.'}
            </div>
          ) : (
            results.map((person) => {
              const sent = sentIds.has(person.id);
              const busy = busyId === person.id;
              const name = person.name || person.fullName;
              return (
                <div key={person.id} className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white/5 transition-colors">
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-black border border-white/10 flex items-center justify-center shrink-0">
                    {person.avatarUrl
                      ? <img src={uploadUrl(person.avatarUrl)} alt="" className="w-full h-full object-cover" />
                      : <span className="text-[#CDFF00] font-black uppercase text-sm">{(name || 'U')[0]}</span>}
                  </div>
                  <span className="flex-1 min-w-0 text-sm font-semibold text-white truncate">{name}</span>
                  <button
                    onClick={() => handleSend(person)}
                    disabled={sent || busy}
                    className={`shrink-0 px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      sent ? 'bg-white/10 text-gray-400' : 'bg-[#CDFF00] text-black hover:brightness-110 active:scale-95 disabled:opacity-60'
                    }`}
                  >
                    {sent ? <><Check className="w-3.5 h-3.5" /> Sent</> : busy ? 'Sending…' : <><Send className="w-3.5 h-3.5" /> Send</>}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </motion.div>
    </div>
  );
}
