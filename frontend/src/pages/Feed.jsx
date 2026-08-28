import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSelector } from 'react-redux';
import { selectUser, selectIsAuthenticated } from '../store/authSlice';
import { feedApi, listingsApi, subscriptionsApi, dispatchToast } from '../api/client';
import { isPremiumActive, isPremiumRequiredError } from '../utils/premium';
import {
  Heart, MessageCircle, Send, Bookmark, Image as ImageIcon, ShoppingBag,
  BadgeCheck, X, Film, Star, Users, Store, Sparkles, Package, VenetianMask, Lock, Crown, Crop,
  MoreHorizontal, Pencil, Trash2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatPrice } from '../utils/constants';
import { useShops } from '../hooks/useShops';
import PostMediaGallery from '../components/PostMediaGallery';
import StoryBar from '../components/stories/StoryBar';
import HeroBrief from '../components/HeroBrief';
import ShareModal from '../components/ShareModal';
import SmartImage from '../components/SmartImage';
import ImageCropper from '../components/ImageCropper';
import { lockBodyScroll } from '../utils/lockBodyScroll';
import { timeAgo } from '../utils/time';

const POST_FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1920&q=80';

const extractUrl = (text) => {
  if (!text) return null;
  const match = text.match(/https?:\/\/[^\s]+/);
  return match ? match[0] : null;
};

// Compact relative time ("5m", "3h", "2d") — mirrors Navbar.jsx's own helper.
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
function PostCard({ post, isAuthenticated, likeInProgress, onLike, onSave, onOpenComments, onOpenLikers, onShare, isOwn, onEdit, onDelete }) {
  const [burst, setBurst] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  /**
   * The ⋯ menu, shown only on your own posts.
   *
   * Held as an element rather than a nested component function: a component declared
   * inside another component is a fresh type on every render, so React tears down and
   * rebuilds the subtree each time — which closes the open menu as you click it.
   *
   * Ownership is also enforced by the API, which returns 403 for someone else's post —
   * this only decides what is offered.
   */
  const ownerMenu = !isOwn ? null : (
      <div className="relative ml-auto shrink-0">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Post options"
          aria-expanded={menuOpen}
          className="p-1.5 -mr-1 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
        {menuOpen && (
          <>
            {/* Click-away layer, so the menu closes without needing a document listener. */}
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 top-8 z-50 w-36 rounded-xl border border-white/10 bg-[#0a0a0a] shadow-xl overflow-hidden">
              <button
                type="button"
                onClick={() => { setMenuOpen(false); onEdit?.(post); }}
                className="w-full px-3 py-2.5 text-left text-xs font-semibold text-gray-200 hover:bg-white/5 flex items-center gap-2"
              >
                <Pencil className="w-3.5 h-3.5" /> Edit
              </button>
              <button
                type="button"
                onClick={() => { setMenuOpen(false); onDelete?.(post); }}
                className="w-full px-3 py-2.5 text-left text-xs font-semibold text-red-400 hover:bg-red-500/10 flex items-center gap-2"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            </div>
          </>
        )}
      </div>
  );

  /** "· edited" after the age, so a changed post is not passed off as the original. */
  const editedMark = post.editedAt
    ? <span className="text-gray-600 shrink-0" title={`Edited ${timeAgo(post.editedAt)} ago`}>· edited</span>
    : null;
  const hasMedia = post.media && post.media.length > 0;
  const singleImage = !hasMedia && (post.imageUrl || extractUrl(post.content));

  // The server sends anonymous posts with authorId/authorName/avatar stripped. Rendering
  // them through the normal header would link to /profile/null, so the author block becomes
  // a non-interactive mask instead — and the badge tells readers the anonymity is a real
  // platform feature rather than someone calling themselves "Anonymous".
  const anon = post.anonymous;

  const AuthorAvatar = ({ size = 'w-9 h-9', iconSize = 'w-4 h-4' }) => (
    anon ? (
      <div className={`${size} rounded-full bg-white/10 border border-white/20 flex items-center justify-center shrink-0`}>
        <VenetianMask className={`${iconSize} text-gray-300`} />
      </div>
    ) : (
      <Avatar name={post.authorName} avatarUrl={post.authorAvatarUrl} size={size} />
    )
  );

  /** Author name — a profile link normally, plain text when anonymous. */
  const AuthorName = ({ className = '' }) => (
    anon ? (
      <span className={`flex items-center gap-1.5 ${className}`}>
        <span className="truncate">Anonymous</span>
        <span className="shrink-0 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-white/10 text-gray-400 border border-white/10">
          Hidden
        </span>
      </span>
    ) : (
      <Link to={`/profile/${post.authorId}`} className={`hover:underline truncate ${className}`}>
        {post.authorName || 'User'}
      </Link>
    )
  );

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
          {anon ? <AuthorAvatar /> : (
            <Link to={`/profile/${post.authorId}`}>
              <AuthorAvatar />
            </Link>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-sm">
              <AuthorName className="font-bold text-white" />
              <span className="text-gray-500 shrink-0">· {timeAgo(post.createdAt)}</span>
              {editedMark}
              {ownerMenu}
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
        {anon ? <AuthorAvatar /> : (
          <Link to={`/profile/${post.authorId}`}>
            <AuthorAvatar />
          </Link>
        )}
        <div className="min-w-0">
          <AuthorName className="text-sm font-bold text-white block" />
          <span className="text-xs text-gray-500">
            {timeAgo(post.createdAt)} ago {post.editedAt ? '· edited' : ''}
          </span>
        </div>
        {ownerMenu}
      </div>

      <div className="relative" onDoubleClick={doubleTapLike}>
        {hasMedia ? (
          <PostMediaGallery
            media={post.media}
            // Anonymous posts pass no author through to the fullscreen viewer either — it
            // renders its own overlay header from this object.
            author={anon
              ? { name: 'Anonymous', avatar: null, id: null }
              : { name: post.authorName, avatar: post.authorAvatarUrl, id: post.authorId }}
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
        to={`/shop/${shop.slug || shop.id}`}
        className="group flex items-center gap-4 p-3.5 rounded-2xl border border-white/10 bg-white/[0.02] hover:border-[#CDFF00]/40 transition-all"
      >
        <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-gray-800">
          <SmartImage
            src={shop.bannerUrl}
            alt={shop.name}
            fallbackIcon={Store}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold text-[#CDFF00] uppercase tracking-widest mb-0.5 flex items-center gap-1">
            <Store className="w-3 h-3" /> Suggested shop
          </p>
          <p className="text-sm font-bold text-white truncate">{shop.name}</p>
          <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
            <span className="flex items-center gap-1"><Package className="w-3 h-3" /> {shop.productCount ?? 0}</span>
            <span className="flex items-center gap-1"><Star className="w-3 h-3 fill-[#CDFF00] text-[#CDFF00]" /> {shop.rating > 0 ? shop.rating.toFixed(1) : 'New'}</span>
            <span className="truncate">{[shop.category, shop.city].filter(Boolean).join(' · ')}</span>
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
  const { shops: allShops } = useShops();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('foryou'); // 'foryou' | 'saved'
  const [savedLoading, setSavedLoading] = useState(false);
  const [savedPosts, setSavedPosts] = useState(null);
  const [savedListings, setSavedListings] = useState(null);

  // Post creation state
  const [content, setContent] = useState('');
  const [mediaFiles, setMediaFiles] = useState([]);
  const [posting, setPosting] = useState(false);
  // Anonymous posting — a Premium capability. `premium` starts null ("not known yet") so the
  // toggle can stay quiet until the subscription lookup lands, rather than flashing "locked"
  // at a paying subscriber on every page load.
  const [anonymous, setAnonymous] = useState(false);
  const [premium, setPremium] = useState(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  // Post being edited, plus its working text. Held separately from the post so cancelling
  // discards the draft rather than mutating what is on screen.
  const [editingPost, setEditingPost] = useState(null);
  const [editDraft, setEditDraft] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

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
  const shopSample = useMemo(() => [...allShops].sort(() => 0.5 - Math.random()).slice(0, 4), [allShops]);

  useEffect(() => {
    loadFeed();
  }, []);

  // Subscription status drives whether the composer offers the anonymous toggle or the
  // upgrade prompt. A failed lookup resolves to "not premium" so the toggle stays locked
  // rather than promising something the server will refuse.
  useEffect(() => {
    if (!isAuthenticated) { setPremium(false); return; }
    subscriptionsApi.my()
      .then((r) => setPremium(isPremiumActive(r.data)))
      .catch(() => setPremium(false));
  }, [isAuthenticated]);

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

  // Index into mediaFiles currently being framed, or null. Held by index rather than by
  // File so the cropped result can be swapped straight back into the same slot.
  const [cropIndex, setCropIndex] = useState(null);

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
    setCropIndex(null);
  };

  /** Swap the framed result back into the slot it came from. */
  const applyCrop = (croppedFile) => {
    setMediaFiles((files) => files.map((f, i) => (i === cropIndex ? croppedFile : f)));
    setCropIndex(null);
  };

  const handlePost = async (e) => {
    e.preventDefault();
    if (!content.trim() && mediaFiles.length === 0) return;
    if (!isAuthenticated) return;
    // Guard the obvious case client-side so a non-subscriber gets the upgrade sheet instead
    // of a rejected request — but the server refuses it either way.
    if (anonymous && !premium) { setShowUpgrade(true); return; }
    setPosting(true);

    try {
      const formData = new FormData();
      formData.append('content', content);
      formData.append('authorName', user.fullName);
      if (anonymous) formData.append('anonymous', 'true');
      mediaFiles.forEach(file => {
        formData.append('media', file);
      });

      const res = await feedApi.createPost(formData);
      setPosts([res.data, ...posts]);
      setContent('');
      setMediaFiles([]);
      setAnonymous(false);
    } catch (err) {
      // The server rejects an ungated anonymous post rather than publishing it under the
      // author's name, so this branch means nothing was posted — say so, and offer the fix.
      if (isPremiumRequiredError(err)) {
        setPremium(false);
        setShowUpgrade(true);
      } else {
        dispatchToast('Failed to post', 'error');
      }
    } finally {
      setPosting(false);
    }
  };

  /**
   * Sends the buyer to Stripe Checkout.
   *
   * Previously this called an endpoint that granted Premium outright with no payment, so
   * it could optimistically flip `premium` and carry on. Now the account is upgraded only
   * once Stripe's signed webhook confirms the charge, so this must not claim success —
   * it hands off to the payment page and the browser leaves.
   *
   * Defaults to the monthly plan: this sheet interrupts someone mid-post, and offering a
   * price list here would bury the thing they were actually trying to do. The full choice
   * of terms lives on the Bond paywall.
   */
  const startUpgrade = async (plan = 'MONTHLY') => {
    setUpgrading(true);
    try {
      const res = await subscriptionsApi.checkout(plan);
      const url = res.data?.checkoutUrl;
      if (!url) throw new Error('No checkout URL returned');
      window.location.assign(url);
    } catch {
      dispatchToast('Could not start checkout — try again', 'error');
      setUpgrading(false);
    }
  };

  /** Saves an edit, then patches the post in place so the feed does not have to reload. */
  const handleSaveEdit = async () => {
    if (!editingPost) return;
    const text = editDraft.trim();
    if (!text) { dispatchToast('Post cannot be empty', 'error'); return; }
    if (text === (editingPost.content || '')) { setEditingPost(null); return; }

    setSavingEdit(true);
    try {
      const res = await feedApi.updatePost(editingPost.id, text);
      patchPost(editingPost.id, (p) => ({
        ...p,
        content: res.data?.content ?? text,
        editedAt: res.data?.editedAt ?? new Date().toISOString(),
      }));
      setEditingPost(null);
      dispatchToast('Post updated', 'success');
    } catch (e) {
      dispatchToast(e.response?.data?.error || 'Could not update post', 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  /**
   * Deletes a post after confirming.
   *
   * Removed from view only once the server confirms: an optimistic removal that then
   * failed would leave the post looking deleted until the next reload.
   */
  const handleDeletePost = async (post) => {
    if (!window.confirm('Delete this post? This cannot be undone.')) return;
    try {
      await feedApi.deletePost(post.id);
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
      setSavedPosts((prev) => (prev ? prev.filter((p) => p.id !== post.id) : prev));
      dispatchToast('Post deleted', 'success');
    } catch (e) {
      dispatchToast(e.response?.data?.error || 'Could not delete post', 'error');
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
              {/* The avatar previews what the post will actually look like: switch anonymity
                  on and your face is replaced by the mask, before you commit to posting. */}
              {anonymous ? (
                <div className="w-11 h-11 rounded-full bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
                  <VenetianMask className="w-5 h-5 text-white" />
                </div>
              ) : (
                <Avatar name={user?.fullName} avatarUrl={user?.avatarUrl} size="w-11 h-11" />
              )}
              <div className="flex-1 space-y-3">
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={anonymous ? 'Post anonymously — your name and avatar stay hidden' : "What's on your mind?"}
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
                          // Tapping the thumbnail opens the cropper — the thumbnail is a
                          // centre-cropped preview, so it is exactly the thing you want to
                          // correct when the subject isn't centred.
                          <button
                            type="button"
                            onClick={() => setCropIndex(idx)}
                            title="Crop & adjust"
                            className="group relative w-20 h-20 rounded-xl overflow-hidden border border-white/10 block"
                          >
                            <img src={URL.createObjectURL(file)} alt="Preview" className="w-full h-full object-cover" />
                            <span className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-0.5">
                              <Crop className="w-4 h-4 text-[#CDFF00]" />
                              <span className="text-[8px] font-black uppercase tracking-widest text-white">Adjust</span>
                            </span>
                          </button>
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

                {anonymous && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="flex items-start gap-2 text-[11px] text-gray-400 leading-relaxed bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2"
                  >
                    <VenetianMask className="w-3.5 h-3.5 text-[#CDFF00] shrink-0 mt-0.5" />
                    {/* Say plainly what anonymity does and does not cover. Someone choosing it
                        is making a judgement about exposure and deserves the real boundary. */}
                    <span>
                      Your name and avatar won't be shown, and your followers won't be notified.
                      HustleSpace still records who posted, so it can act on abuse.
                    </span>
                  </motion.p>
                )}

                <div className="flex items-center justify-between gap-2 pt-3 border-t border-white/10">
                  <div className="flex items-center gap-3 min-w-0">
                    <label className="cursor-pointer text-gray-400 hover:text-[#CDFF00] transition-colors flex items-center gap-2 shrink-0">
                      <ImageIcon className="w-5 h-5" />
                      <span className="text-xs font-bold">{mediaFiles.length > 0 ? `${mediaFiles.length}/15` : 'Photo/video'}</span>
                      <input type="file" className="hidden" accept="image/*,video/*" multiple onChange={handleMediaChange} />
                    </label>

                    {/* Shown to everyone, not just subscribers — a feature nobody can see is a
                        feature nobody upgrades for. Non-subscribers get the lock and the sheet. */}
                    <button
                      type="button"
                      onClick={() => (premium ? setAnonymous((v) => !v) : setShowUpgrade(true))}
                      aria-pressed={anonymous}
                      title={premium ? 'Post without showing your name' : 'Anonymous posting is a Premium feature'}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all active:scale-95 shrink-0 ${
                        anonymous
                          ? 'bg-[#CDFF00] text-black border-[#CDFF00]'
                          : 'bg-transparent text-gray-400 border-white/15 hover:text-white hover:border-white/35'
                      }`}
                    >
                      <VenetianMask className="w-4 h-4" />
                      <span className="hidden xs:inline sm:inline">Anonymous</span>
                      {premium === false && <Lock className="w-3 h-3 opacity-70" />}
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={posting || (!content.trim() && mediaFiles.length === 0)}
                    className="px-6 py-2.5 rounded-full bg-[#CDFF00] text-black font-bold text-sm disabled:opacity-40 hover:brightness-110 active:scale-95 transition-all shrink-0"
                  >
                    {posting ? 'Posting…' : anonymous ? 'Post anonymously' : 'Post'}
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
                  // Anonymous posts come back with authorId stripped, so they never match
                  // and correctly show no owner menu — editing one in place would let the
                  // author rewrite a post nobody can attribute to them.
                  isOwn={!!user?.id && item.data.authorId === user.id}
                  onEdit={(p) => { setEditingPost(p); setEditDraft(p.content || ''); }}
                  onDelete={handleDeletePost}
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

      {cropIndex !== null && mediaFiles[cropIndex] && (
        <ImageCropper
          file={mediaFiles[cropIndex]}
          onCancel={() => setCropIndex(null)}
          onApply={applyCrop}
        />
      )}

      <AnimatePresence>
        {editingPost && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center px-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => !savingEdit && setEditingPost(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-[#0a0a0a] border border-white/10 rounded-2xl p-5"
            >
              <h3 className="text-base font-bold text-white mb-1">Edit post</h3>
              {/* Set expectations before they look for a way to change the photo. */}
              <p className="text-[11px] text-gray-500 mb-3">
                Only the text can be changed. Photos and videos stay as posted.
              </p>
              <textarea
                value={editDraft}
                onChange={(e) => setEditDraft(e.target.value)}
                rows={5}
                autoFocus
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:border-[#CDFF00] focus:ring-1 focus:ring-[#CDFF00] outline-none resize-none"
                placeholder="What's on your mind?"
              />
              <div className="flex gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setEditingPost(null)}
                  disabled={savingEdit}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-bold text-sm hover:bg-white/10 transition-colors disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={savingEdit || !editDraft.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-[#CDFF00] text-black font-bold text-sm hover:brightness-110 transition-all disabled:opacity-60"
                >
                  {savingEdit ? 'Saving…' : 'Save'}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showUpgrade && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center px-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowUpgrade(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 text-center"
            >
              <button
                onClick={() => setShowUpgrade(false)}
                className="absolute top-3 right-3 p-1.5 rounded-lg text-gray-500 hover:bg-white/10 hover:text-white transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="w-14 h-14 rounded-full bg-[#CDFF00]/10 border border-[#CDFF00]/30 flex items-center justify-center mx-auto mb-4">
                <VenetianMask className="w-7 h-7 text-[#CDFF00]" />
              </div>
              <h3 className="text-lg font-black text-white uppercase tracking-tight mb-2">Post anonymously</h3>
              <p className="text-sm text-gray-400 leading-relaxed mb-5">
                Share something without your name or avatar attached. Ask the awkward question,
                tell the honest story — Premium members post to the feed anonymously.
              </p>

              <ul className="text-left space-y-2 mb-6">
                {[
                  'Your name and avatar stay hidden on the post',
                  'Followers aren\'t notified, so nothing points back to you',
                  'Everything else in Premium, including Hustle Bond',
                ].map((line) => (
                  <li key={line} className="flex items-start gap-2 text-xs text-gray-300">
                    <Crown className="w-3.5 h-3.5 text-[#CDFF00] shrink-0 mt-0.5" />
                    {line}
                  </li>
                ))}
              </ul>

              <button
                onClick={startUpgrade}
                disabled={upgrading}
                className="w-full py-3 rounded-xl bg-[#CDFF00] text-black font-black text-xs uppercase tracking-widest hover:bg-[#d9ff33] active:scale-[0.99] transition-all disabled:opacity-60"
              >
                {upgrading ? 'Upgrading…' : 'Go Premium'}
              </button>
              <button
                onClick={() => setShowUpgrade(false)}
                className="w-full mt-2 py-2 text-[11px] font-bold uppercase tracking-widest text-gray-500 hover:text-white transition-colors"
              >
                Not now
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
