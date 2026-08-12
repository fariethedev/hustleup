import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSelector } from 'react-redux';
import { selectUser, selectIsAuthenticated } from '../store/authSlice';
import { feedApi, listingsApi } from '../api/client';
import {
  Heart, MessageCircle, Send, Bookmark, Image as ImageIcon, ShoppingBag,
  BadgeCheck, X, Film, Star, Users, Store, Sparkles,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatPrice } from '../utils/constants';
import { SHOPS } from '../utils/shopData';
import PostMediaGallery from '../components/PostMediaGallery';
import StoryBar from '../components/stories/StoryBar';
import SwapChain from '../components/SwapChain';
import HeroBrief from '../components/HeroBrief';
import ShareModal from '../components/ShareModal';
import { lockBodyScroll } from '../utils/lockBodyScroll';

const POST_FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1920&q=80';

const extractUrl = (text) => {
  if (!text) return null;
  const match = text.match(/https?:\/\/[^\s]+/);
  return match ? match[0] : null;
};

// Compact relative time ("5m", "3h", "2d") — mirrors Navbar.jsx's own helper.
function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function Avatar({ name, avatarUrl, size = 'w-9 h-9', textSize = 'text-sm' }) {
  return (
    <div className={`${size} rounded-full overflow-hidden bg-[#CDFF00] flex items-center justify-center shrink-0`}>
      {avatarUrl
        ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
        : <span className={`${textSize} font-black text-black`}>{name?.[0]?.toUpperCase() || '?'}</span>}
    </div>
  );
}

// A short-lived heart burst shown on double-tap, à la Instagram.
function HeartBurst({ show }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1.15 }}
          exit={{ opacity: 0, scale: 1.4 }}
          transition={{ duration: 0.45 }}
          className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
        >
          <Heart className="w-24 h-24 text-white fill-white drop-shadow-[0_4px_20px_rgba(0,0,0,0.5)]" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * A single feed post. Renders one of two layouts depending on whether the post has
 * media attached:
 *  - Media posts get an Instagram-style card: full-bleed media, action row, caption,
 *    inline top-comment preview, "view all comments" link.
 *  - Text-only posts get a Twitter-style timeline row instead: no card chrome, just an
 *    avatar/name/timestamp header, larger body text, and a compact action row —
 *    a big image block would be empty space for a post that's just words.
 */
function PostCard({ post, isAuthenticated, likeInProgress, onLike, onSave, onOpenComments, onOpenLikers, onShare }) {
  const [burst, setBurst] = useState(false);
  const hasMedia = post.media && post.media.length > 0;
  const singleImage = !hasMedia && (post.imageUrl || extractUrl(post.content));

  const doubleTapLike = () => {
    if (!post.likedByCurrentUser) onLike(post.id);
    setBurst(true);
    setTimeout(() => setBurst(false), 500);
  };

  const ActionRow = ({ compact }) => (
    <div className={`flex items-center gap-4 ${compact ? '' : 'mb-1'}`}>
      <button
        onClick={() => onLike(post.id)}
        disabled={likeInProgress[post.id]}
        className={`transition-all hover:scale-110 ${post.likedByCurrentUser ? 'text-red-500' : 'text-gray-400 hover:text-white'}`}
      >
        <Heart className={`w-6 h-6 ${post.likedByCurrentUser ? 'fill-current' : ''}`} />
      </button>
      <button onClick={() => onOpenComments(post)} className="text-gray-400 hover:text-white transition-all hover:scale-110">
        <MessageCircle className="w-6 h-6" />
      </button>
      <button onClick={() => onShare(post)} className="text-gray-400 hover:text-white transition-all hover:scale-110">
        <Send className="w-5 h-5" />
      </button>
      <button
        onClick={() => onSave(post.id)}
        className={`ml-auto transition-all hover:scale-110 ${post.savedByCurrentUser ? 'text-[#CDFF00]' : 'text-gray-400 hover:text-white'}`}
      >
        <Bookmark className={`w-6 h-6 ${post.savedByCurrentUser ? 'fill-current' : ''}`} />
      </button>
    </div>
  );

  const CommentPreview = () => (
    <>
      {post.topComment && (
        <button onClick={() => onOpenComments(post)} className="block text-left text-sm text-gray-400 truncate w-full hover:text-gray-300 transition-colors">
          <span className="font-bold text-gray-300 mr-1.5">{post.topComment.authorName}</span>
          {post.topComment.content}
        </button>
      )}
      {(post.commentsCount || 0) > (post.topComment ? 1 : 0) && (
        <button onClick={() => onOpenComments(post)} className="text-sm text-gray-500 hover:text-gray-300 transition-colors mt-0.5">
          {post.commentsCount === 1 ? 'View comment' : `View all ${post.commentsCount} comments`}
        </button>
      )}
    </>
  );

  // ── Twitter-style: text-only post, no media block ──────────────────────────
  if (!hasMedia && !singleImage) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        className="py-4 border-b border-white/10"
      >
        <div className="flex gap-3">
          <Link to={`/profile/${post.authorId}`}>
            <Avatar name={post.authorName} avatarUrl={post.authorAvatarUrl} />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-sm">
              <Link to={`/profile/${post.authorId}`} className="font-bold text-white hover:underline truncate">
                {post.authorName || 'User'}
              </Link>
              <span className="text-gray-500 shrink-0">· {timeAgo(post.createdAt)}</span>
            </div>
            <p className="text-white text-[15px] leading-relaxed mt-0.5 whitespace-pre-wrap break-words">{post.content}</p>
            <div className="mt-3 max-w-sm">
              <ActionRow compact />
            </div>
            {post.commentsCount > 0 && (
              <div className="mt-2">
                <CommentPreview />
              </div>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  // ── Instagram-style: media post ─────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden"
    >
      <div className="px-3.5 py-3 flex items-center gap-2.5">
        <Link to={`/profile/${post.authorId}`}>
          <Avatar name={post.authorName} avatarUrl={post.authorAvatarUrl} />
        </Link>
        <div className="min-w-0">
          <Link to={`/profile/${post.authorId}`} className="text-sm font-bold text-white hover:underline block truncate">
            {post.authorName || 'User'}
          </Link>
          <span className="text-xs text-gray-500">{timeAgo(post.createdAt)} ago</span>
        </div>
      </div>

      <div className="relative" onDoubleClick={doubleTapLike}>
        {hasMedia ? (
          <PostMediaGallery
            media={post.media}
            author={{ name: post.authorName, avatar: post.authorAvatarUrl, id: post.authorId }}
            onLike={() => onLike(post.id)}
            onShare={() => onShare(post)}
            liked={post.likedByCurrentUser}
          />
        ) : (
          <div className="relative w-full aspect-square bg-black">
            <img
              src={singleImage}
              alt="Post"
              className="w-full h-full object-cover"
              onError={(e) => { e.target.onerror = null; e.target.src = POST_FALLBACK_IMAGE; }}
            />
          </div>
        )}
        <HeartBurst show={burst} />
      </div>

      <div className="p-3.5">
        <ActionRow />

        {(post.likesCount || 0) > 0 && (
          <button onClick={() => onOpenLikers(post)} className="text-sm font-bold text-white hover:underline mb-1.5 block">
            {post.likesCount} {post.likesCount === 1 ? 'like' : 'likes'}
          </button>
        )}

        {post.content && (
          <p className="text-sm text-gray-200 leading-snug mb-1">
            <Link to={`/profile/${post.authorId}`} className="font-bold text-white hover:underline mr-1.5">
              {post.authorName || 'User'}
            </Link>
            {post.content}
          </p>
        )}

        <CommentPreview />
      </div>
    </motion.div>
  );
}

/** A listing interleaved into the feed — Instagram-Shopping-style promo card. */
function ListingPromoCard({ listing, onSave, onShare }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      className="rounded-2xl border border-[#CDFF00]/20 bg-white/[0.02] overflow-hidden"
    >
      <div className="px-3.5 py-3 flex items-center justify-between">
        <Link to={`/profile/${listing.sellerId}`} className="flex items-center gap-2.5 min-w-0">
          <Avatar name={listing.sellerName} avatarUrl={listing.sellerAvatarUrl} />
          <div className="min-w-0">
            <span className="text-sm font-bold text-white hover:underline flex items-center gap-1 truncate">
              {listing.sellerName}
              {listing.sellerVerified && <BadgeCheck className="w-3.5 h-3.5 text-[#CDFF00] shrink-0" />}
            </span>
            <span className="text-[10px] font-bold text-[#CDFF00] uppercase tracking-widest">Marketplace</span>
          </div>
        </Link>
      </div>

      <Link to={`/listing/${listing.id}`} className="block relative aspect-square bg-black group overflow-hidden">
        <img
          src={listing.mediaUrls?.[0] || POST_FALLBACK_IMAGE}
          alt={listing.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          onError={(e) => { e.target.onerror = null; e.target.src = POST_FALLBACK_IMAGE; }}
        />
        <div className="absolute top-3 right-3 px-3 py-1.5 rounded-full bg-black/80 backdrop-blur-xl border border-[#CDFF00]/40 text-[#CDFF00] font-bold text-sm">
          {formatPrice(listing.price, listing.currency)}
        </div>
      </Link>

      <div className="p-3.5">
        <div className="flex items-center gap-4 mb-2">
          <button onClick={() => onShare(listing)} className="text-gray-400 hover:text-white transition-all hover:scale-110">
            <Send className="w-5 h-5" />
          </button>
          <button
            onClick={() => onSave(listing.id)}
            className={`ml-auto transition-all hover:scale-110 ${listing.savedByCurrentUser ? 'text-[#CDFF00]' : 'text-gray-400 hover:text-white'}`}
          >
            <Bookmark className={`w-6 h-6 ${listing.savedByCurrentUser ? 'fill-current' : ''}`} />
          </button>
        </div>
        <p className="text-sm text-gray-200">
          <Link to={`/listing/${listing.id}`} className="font-bold text-white hover:underline mr-1.5">{listing.title}</Link>
          {listing.description && <span className="line-clamp-1">{listing.description}</span>}
        </p>
        <Link
          to={`/listing/${listing.id}`}
          className="mt-3 flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-[#CDFF00]/10 border border-[#CDFF00]/30 text-xs font-bold uppercase tracking-widest text-[#CDFF00] hover:bg-[#CDFF00] hover:text-black transition-all"
        >
          View listing <ShoppingBag className="w-3.5 h-3.5" />
        </Link>
      </div>
    </motion.div>
  );
}

/** A shop interleaved into the feed — a compact discovery/promo card. */
function ShopPromoCard({ shop }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
    >
      <Link
        to={`/shop/${shop.id}`}
        className="group flex items-center gap-4 p-3.5 rounded-2xl border border-white/10 bg-white/[0.02] hover:border-[#CDFF00]/40 transition-all"
      >
        <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-gray-800">
          <img src={shop.image} alt={shop.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold text-[#CDFF00] uppercase tracking-widest mb-0.5 flex items-center gap-1">
            <Store className="w-3 h-3" /> Suggested shop
          </p>
          <p className="text-sm font-bold text-white truncate">{shop.name}</p>
          <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
            <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {shop.followers >= 1000 ? `${(shop.followers / 1000).toFixed(1)}K` : shop.followers}</span>
            <span className="flex items-center gap-1"><Star className="w-3 h-3 fill-[#CDFF00] text-[#CDFF00]" /> {shop.rating || '—'}</span>
            <span className="truncate">{shop.category}</span>
          </div>
        </div>
        <span className="shrink-0 px-4 py-2 rounded-full border border-white/15 text-white text-xs font-bold group-hover:bg-[#CDFF00] group-hover:text-black group-hover:border-[#CDFF00] transition-all">
          Visit
        </span>
      </Link>
    </motion.div>
  );
}

export default function Feed() {
  const user = useSelector(selectUser);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const [posts, setPosts] = useState([]);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('foryou'); // 'foryou' | 'saved'
  const [savedLoading, setSavedLoading] = useState(false);
  const [savedPosts, setSavedPosts] = useState(null);
  const [savedListings, setSavedListings] = useState(null);

  // Post creation state
  const [content, setContent] = useState('');
  const [mediaFiles, setMediaFiles] = useState([]);
  const [posting, setPosting] = useState(false);

  // Comment Modal State
  const [selectedPost, setSelectedPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentInput, setCommentInput] = useState('');
  const [commenting, setCommenting] = useState(false);

  // Likers Modal State ("who liked this")
  const [likersPost, setLikersPost] = useState(null);
  const [likers, setLikers] = useState([]);
  const [likersLoading, setLikersLoading] = useState(false);

  const [likeInProgress, setLikeInProgress] = useState({});

  // In-app "share post/listing to a person" sheet.
  const [shareItem, setShareItem] = useState(null);
  const [shareType, setShareType] = useState('post');

  // A handful of shops sampled once per visit to interleave into the feed.
  const shopSample = useMemo(() => [...SHOPS].sort(() => 0.5 - Math.random()).slice(0, 4), []);

  useEffect(() => {
    loadFeed();
  }, []);

  const loadFeed = async () => {
    setLoading(true);
    try {
      const [postRes, listingRes] = await Promise.allSettled([
        feedApi.getAll(),
        listingsApi.recommended(),
      ]);
      setPosts(postRes.status === 'fulfilled' ? (postRes.value.data || []) : []);
      setListings(listingRes.status === 'fulfilled' ? (listingRes.value.data || []).slice(0, 8) : []);
    } finally {
      setLoading(false);
    }
  };

  const loadSaved = async () => {
    setSavedLoading(true);
    try {
      const [postRes, listingRes] = await Promise.allSettled([
        feedApi.mySaved(),
        listingsApi.mySaved(),
      ]);
      setSavedPosts(postRes.status === 'fulfilled' ? (postRes.value.data || []) : []);
      setSavedListings(listingRes.status === 'fulfilled' ? (listingRes.value.data || []) : []);
    } finally {
      setSavedLoading(false);
    }
  };

  const switchTab = (next) => {
    setTab(next);
    if (next === 'saved' && savedPosts === null) loadSaved();
  };

  // Interleave a listing or shop card after every 4th post — alternating between the
  // two promo types so neither dominates. Falls back to whichever list still has items.
  const feedItems = useMemo(() => {
    const items = posts.map((post) => ({ kind: 'post', key: `post-${post.id}`, data: post }));
    let li = 0;
    let si = 0;
    let insertedSoFar = 0;
    for (let i = 3; i < items.length; i += 4) {
      const wantListing = insertedSoFar % 2 === 0;
      let promo = null;
      if (wantListing && li < listings.length) { promo = { kind: 'listing', key: `listing-${listings[li].id}`, data: listings[li] }; li++; }
      else if (si < shopSample.length) { promo = { kind: 'shop', key: `shop-${shopSample[si].id}`, data: shopSample[si] }; si++; }
      else if (li < listings.length) { promo = { kind: 'listing', key: `listing-${listings[li].id}`, data: listings[li] }; li++; }
      if (promo) {
        items.splice(i + insertedSoFar, 0, promo);
        insertedSoFar++;
      }
    }
    return items;
  }, [posts, listings, shopSample]);

  const openLikers = async (post) => {
    setLikersPost(post);
    setLikers([]);
    setLikersLoading(true);
    try {
      const res = await feedApi.getLikers(post.id);
      setLikers(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to load likers:', err);
    } finally {
      setLikersLoading(false);
    }
  };

  const handleMediaChange = (e) => {
    const files = Array.from(e.target.files);
    if (mediaFiles.length + files.length > 15) {
      alert('You can only upload up to 15 items per post.');
      return;
    }
    setMediaFiles([...mediaFiles, ...files]);
  };

  const removeMedia = (index) => {
    setMediaFiles(mediaFiles.filter((_, i) => i !== index));
  };

  const handlePost = async (e) => {
    e.preventDefault();
    if (!content.trim() && mediaFiles.length === 0) return;
    if (!isAuthenticated) return;
    setPosting(true);

    try {
      const formData = new FormData();
      formData.append('content', content);
      formData.append('authorName', user.fullName);
      mediaFiles.forEach(file => {
        formData.append('media', file);
      });

      const res = await feedApi.createPost(formData);
      setPosts([res.data, ...posts]);
      setContent('');
      setMediaFiles([]);
    } catch (err) {
      alert('Failed to post');
    } finally {
      setPosting(false);
    }
  };

  // Applies an updater to a post wherever it currently lives (main feed and/or the
  // saved-posts list) — likes/saves toggled from either tab stay in sync with the other.
  const patchPost = (postId, updater) => {
    setPosts((prev) => prev.map((p) => (p.id === postId ? updater(p) : p)));
    setSavedPosts((prev) => (prev ? prev.map((p) => (p.id === postId ? updater(p) : p)) : prev));
  };

  const handleLike = async (postId) => {
    if (!isAuthenticated || likeInProgress[postId]) return;
    const post = posts.find((p) => p.id === postId) || (savedPosts || []).find((p) => p.id === postId);
    if (!post) return;

    setLikeInProgress((prev) => ({ ...prev, [postId]: true }));
    try {
      if (post.likedByCurrentUser) {
        await feedApi.unlikePost(postId);
        patchPost(postId, (p) => ({ ...p, likedByCurrentUser: false, likesCount: Math.max(0, p.likesCount - 1) }));
      } else {
        await feedApi.likePost(postId);
        patchPost(postId, (p) => ({ ...p, likedByCurrentUser: true, likesCount: p.likesCount + 1 }));
      }
    } catch (err) {
      console.error('Failed to toggle like', err);
    } finally {
      setLikeInProgress((prev) => ({ ...prev, [postId]: false }));
    }
  };

  const handleSavePost = async (postId) => {
    if (!isAuthenticated) return;
    const post = posts.find((p) => p.id === postId) || (savedPosts || []).find((p) => p.id === postId);
    if (!post) return;

    // Optimistic toggle.
    patchPost(postId, (p) => ({ ...p, savedByCurrentUser: !p.savedByCurrentUser }));
    try {
      if (post.savedByCurrentUser) await feedApi.unsavePost(postId);
      else await feedApi.savePost(postId);
    } catch (err) {
      // Revert on failure.
      patchPost(postId, (p) => ({ ...p, savedByCurrentUser: post.savedByCurrentUser }));
      console.error('Failed to toggle save', err);
    }
  };

  const handleSaveListing = async (listingId) => {
    if (!isAuthenticated) return;
    const listing = listings.find((l) => l.id === listingId) || (savedListings || []).find((l) => l.id === listingId);
    if (!listing) return;

    const patch = (updater) => {
      setListings((prev) => prev.map((l) => (l.id === listingId ? updater(l) : l)));
      setSavedListings((prev) => (prev ? prev.map((l) => (l.id === listingId ? updater(l) : l)) : prev));
    };

    patch((l) => ({ ...l, savedByCurrentUser: !l.savedByCurrentUser }));
    try {
      if (listing.savedByCurrentUser) await listingsApi.unsave(listingId);
      else await listingsApi.save(listingId);
    } catch (err) {
      patch((l) => ({ ...l, savedByCurrentUser: listing.savedByCurrentUser }));
      console.error('Failed to toggle listing save', err);
    }
  };

  // Comments Logic
  const openComments = async (post) => {
    setSelectedPost(post);
    setComments([]);
    setCommentsLoading(true);
    try {
      const res = await feedApi.getComments(post.id);
      setComments(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to load comments:', err);
    } finally {
      setCommentsLoading(false);
    }
  };

  const submitComment = async () => {
    if (!commentInput.trim() || !selectedPost) return;
    setCommenting(true);
    try {
      const res = await feedApi.addComment(selectedPost.id, commentInput.trim());
      setComments([...comments, res.data]);
      const preview = { authorName: res.data.authorName, content: res.data.content };
      patchPost(selectedPost.id, (p) => ({ ...p, commentsCount: (p.commentsCount || 0) + 1, topComment: preview }));
      setCommentInput('');
    } catch (err) {
      alert('Failed to post comment');
    } finally {
      setCommenting(false);
    }
  };

  useEffect(() => {
    if (!selectedPost && !likersPost) return;
    const unlock = lockBodyScroll();
    return () => unlock();
  }, [selectedPost, likersPost]);

  const showingSaved = tab === 'saved';
  const savedItems = showingSaved
    ? [
        ...(savedPosts || []).map((post) => ({ kind: 'post', key: `saved-post-${post.id}`, data: post })),
        ...(savedListings || []).map((listing) => ({ kind: 'listing', key: `saved-listing-${listing.id}`, data: listing })),
      ]
    : [];

  const visibleItems = showingSaved ? savedItems : feedItems;
  const isLoadingCurrentTab = showingSaved ? savedLoading : loading;

  return (
    <div className="min-h-screen font-sans pb-24">
      <HeroBrief title="Feed" />

      <div className="max-w-xl mx-auto px-4">
        <StoryBar />
        <SwapChain />

        {/* For You / Saved tabs */}
        {isAuthenticated && (
          <div className="flex items-center gap-2 mb-5 p-1 rounded-full bg-white/5 border border-white/10 w-fit mx-auto">
            <button
              onClick={() => switchTab('foryou')}
              className={`px-5 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all ${
                tab === 'foryou' ? 'bg-[#CDFF00] text-black' : 'text-gray-400 hover:text-white'
              }`}
            >
              For you
            </button>
            <button
              onClick={() => switchTab('saved')}
              className={`px-5 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-1.5 ${
                tab === 'saved' ? 'bg-[#CDFF00] text-black' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" /> Saved
            </button>
          </div>
        )}

        {!showingSaved && isAuthenticated && (
          <form onSubmit={handlePost} className="bg-white/[0.02] border border-white/10 p-4 rounded-2xl mb-6">
            <div className="flex gap-3">
              <Avatar name={user?.fullName} avatarUrl={user?.avatarUrl} size="w-11 h-11" />
              <div className="flex-1 space-y-3">
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="What's on your mind?"
                  className="w-full bg-transparent text-white placeholder-gray-500 resize-none outline-none leading-relaxed text-[15px]"
                  rows={2}
                />

                {mediaFiles.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {mediaFiles.map((file, idx) => (
                      <div key={idx} className="relative shrink-0">
                        {file.type.startsWith('video/') ? (
                          <div className="w-20 h-20 rounded-xl bg-black flex items-center justify-center border border-white/10">
                            <Film className="w-7 h-7 text-gray-400" />
                          </div>
                        ) : (
                          <img src={URL.createObjectURL(file)} alt="Preview" className="w-20 h-20 rounded-xl object-cover border border-white/10" />
                        )}
                        <button
                          type="button"
                          onClick={() => removeMedia(idx)}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-black border border-white/20 text-white flex justify-center items-center hover:bg-red-500 hover:border-red-500 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-white/10">
                  <label className="cursor-pointer text-gray-400 hover:text-[#CDFF00] transition-colors flex items-center gap-2">
                    <ImageIcon className="w-5 h-5" />
                    <span className="text-xs font-bold">{mediaFiles.length > 0 ? `${mediaFiles.length}/15` : 'Photo/video'}</span>
                    <input type="file" className="hidden" accept="image/*,video/*" multiple onChange={handleMediaChange} />
                  </label>
                  <button
                    type="submit"
                    disabled={posting || (!content.trim() && mediaFiles.length === 0)}
                    className="px-6 py-2.5 rounded-full bg-[#CDFF00] text-black font-bold text-sm disabled:opacity-40 hover:brightness-110 active:scale-95 transition-all"
                  >
                    {posting ? 'Posting…' : 'Post'}
                  </button>
                </div>
              </div>
            </div>
          </form>
        )}

        <div className="space-y-5">
          {isLoadingCurrentTab ? (
            [...Array(3)].map((_, i) => <div key={i} className="h-64 bg-white/[0.02] border border-white/10 rounded-2xl animate-pulse" />)
          ) : visibleItems.length > 0 ? (
            visibleItems.map((item) => {
              if (item.kind === 'listing') {
                return <ListingPromoCard key={item.key} listing={item.data} onSave={handleSaveListing} onShare={(l) => { setShareType('listing'); setShareItem(l); }} />;
              }
              if (item.kind === 'shop') {
                return <ShopPromoCard key={item.key} shop={item.data} />;
              }
              return (
                <PostCard
                  key={item.key}
                  post={item.data}
                  isAuthenticated={isAuthenticated}
                  likeInProgress={likeInProgress}
                  onLike={handleLike}
                  onSave={handleSavePost}
                  onOpenComments={openComments}
                  onOpenLikers={openLikers}
                  onShare={(p) => { setShareType('post'); setShareItem(p); }}
                />
              );
            })
          ) : showingSaved ? (
            <div className="text-center py-24 bg-white/[0.02] border border-dashed border-white/10 rounded-2xl">
              <Bookmark className="w-12 h-12 mx-auto text-gray-600 mb-4" />
              <h3 className="text-white font-bold mb-1">Nothing saved yet</h3>
              <p className="text-sm text-gray-500">Tap the bookmark icon on any post or listing to save it here.</p>
            </div>
          ) : (
            <div className="text-center py-24 bg-white/[0.02] border border-dashed border-white/10 rounded-2xl">
              <Sparkles className="w-12 h-12 mx-auto text-gray-600 mb-4" />
              <h3 className="text-white font-bold mb-1">Your feed is empty</h3>
              <p className="text-sm text-gray-500">Be the first to share something.</p>
            </div>
          )}
        </div>

        {/* Comments Modal */}
        <AnimatePresence>
          {selectedPost && (
            <div className="fixed inset-0 z-[400] flex items-center justify-center px-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedPost(null)}
                className="absolute inset-0 bg-black/80 backdrop-blur-md"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 30 }}
                className="relative w-full max-w-lg bg-[#0A0A0A] border border-white/10 rounded-3xl shadow-2xl flex flex-col max-h-[80vh] overflow-hidden"
              >
                <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between shrink-0">
                  <h3 className="text-white font-bold text-sm flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 text-[#CDFF00]" /> Comments
                  </h3>
                  <button onClick={() => setSelectedPost(null)} className="p-1.5 rounded-full hover:bg-white/10 text-gray-500 hover:text-white transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                  {commentsLoading ? (
                    <div className="space-y-4">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex gap-3 animate-pulse">
                          <div className="w-9 h-9 rounded-full bg-white/10" />
                          <div className="flex-1 space-y-2">
                            <div className="h-3 w-24 bg-white/10 rounded" />
                            <div className="h-8 bg-white/5 rounded-xl" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : comments.length === 0 ? (
                    <div className="py-20 text-center flex flex-col items-center gap-3">
                      <MessageCircle className="w-10 h-10 text-gray-700" />
                      <p className="text-sm text-gray-500">No comments yet — be the first.</p>
                    </div>
                  ) : (
                    comments.map((c, idx) => (
                      <motion.div key={c.id || idx} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} className="flex gap-3 items-start">
                        <Link to={`/profile/${c.authorId}`} className="shrink-0">
                          <Avatar name={c.authorName} size="w-9 h-9" textSize="text-xs" />
                        </Link>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Link to={`/profile/${c.authorId}`} className="text-sm font-bold text-white hover:underline">{c.authorName}</Link>
                            <span className="text-xs text-gray-500">{timeAgo(c.createdAt)}</span>
                          </div>
                          <p className="text-sm text-gray-300 leading-relaxed break-words">{c.content}</p>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>

                {isAuthenticated ? (
                  <div className="p-4 border-t border-white/10 shrink-0">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Add a comment…"
                        value={commentInput}
                        onChange={(e) => setCommentInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && submitComment()}
                        className="w-full bg-white/5 border border-white/10 rounded-full pl-4 pr-12 py-3 text-sm text-white placeholder-gray-500 outline-none focus:border-[#CDFF00] transition-all"
                      />
                      <button
                        onClick={submitComment}
                        disabled={commenting || !commentInput.trim()}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-[#CDFF00] text-black flex items-center justify-center disabled:opacity-30 hover:brightness-110 active:scale-95 transition-all"
                      >
                        {commenting ? <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-5 text-center border-t border-white/10 shrink-0">
                    <Link to="/login" className="text-[#CDFF00] font-bold text-sm hover:underline">Sign in to comment</Link>
                  </div>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Likers Modal */}
        <AnimatePresence>
          {likersPost && (
            <div className="fixed inset-0 z-[400] flex items-center justify-center px-4">
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setLikersPost(null)}
                className="absolute inset-0 bg-black/80 backdrop-blur-md"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 24 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 24 }}
                className="relative w-full max-w-sm bg-[#0A0A0A] border border-white/10 rounded-3xl shadow-2xl flex flex-col max-h-[70vh] overflow-hidden"
              >
                <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between shrink-0">
                  <h3 className="text-white font-bold text-sm flex items-center gap-2">
                    <Heart className="w-4 h-4 text-red-500 fill-red-500" />
                    Likes · {likersPost.likesCount || likers.length}
                  </h3>
                  <button onClick={() => setLikersPost(null)} className="p-1.5 rounded-full hover:bg-white/10 text-gray-500 hover:text-white transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto py-2">
                  {likersLoading ? (
                    <div className="p-4 space-y-3">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center gap-3 animate-pulse">
                          <div className="w-10 h-10 rounded-full bg-white/5" />
                          <div className="h-3 w-32 bg-white/5 rounded" />
                        </div>
                      ))}
                    </div>
                  ) : likers.length === 0 ? (
                    <p className="py-12 text-center text-sm text-gray-500">No likes yet</p>
                  ) : (
                    likers.map((u) => (
                      <Link
                        key={u.id}
                        to={`/profile/${u.id}`}
                        onClick={() => setLikersPost(null)}
                        className="flex items-center gap-3 px-5 py-2.5 hover:bg-white/5 transition-colors"
                      >
                        <Avatar name={u.name} avatarUrl={u.avatarUrl} size="w-10 h-10" />
                        <span className="text-sm font-bold text-white flex items-center gap-1.5 min-w-0">
                          <span className="truncate">{u.name}</span>
                          {u.verified && <BadgeCheck className="w-3.5 h-3.5 text-[#CDFF00] shrink-0" />}
                        </span>
                      </Link>
                    ))
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>

      {shareItem && <ShareModal type={shareType} item={shareItem} onClose={() => setShareItem(null)} />}
    </div>
  );
}
