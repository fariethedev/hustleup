import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useSelector, useDispatch } from 'react-redux';
import { selectUser, loadUserProfile } from '../store/authSlice';
import { usersApi, reviewsApi, listingsApi, feedApi, followsApi } from '../api/client';
import { useToast } from '../context/ToastContext';
import ReviewStars from '../components/ReviewStars';
import ListingCard from '../components/ListingCard';
import DistanceBadge from '../components/DistanceBadge';
import { timeAgo } from '../utils/time';
import { uploadUrl } from '../config';
import {
  MapPin, BadgeCheck, User2, MessageCircle, Settings, Camera,
  Image as ImageIcon, Check, X, AtSign, Globe,
  Grid3X3, Star, Heart, MoreHorizontal, Ban, Flag, ShieldOff, FileText, Plus
} from 'lucide-react';

export default function Profile() {
  const { id } = useParams();
  const dispatch = useDispatch();
  const currentUser = useSelector(selectUser);
  const { showToast } = useToast();
  const [profile, setProfile] = useState(null);
  const [rel, setRel] = useState({ followers: 0, following: 0, isFollowing: false, blocked: false, blockedBy: false });
  const [reviews, setReviews] = useState([]);
  const [listings, setListings] = useState([]);
  const [posts, setPosts] = useState([]);
  // The post opened from a grid tile. Tiles used to be inert divs, so tapping your
  // own post from your profile did nothing at all.
  const [viewingPost, setViewingPost] = useState(null);
  const [likedPosts, setLikedPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('listings');
  const [followBusy, setFollowBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportBusy, setReportBusy] = useState(false);

  // Edit modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editData, setEditData] = useState({
    fullName: '', bio: '', city: '', addressLine1: '', phone: '', website: '',
  });
  const [avatarFile, setAvatarFile] = useState(null);
  const [bannerFile, setBannerFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [bannerPreview, setBannerPreview] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const isOwn = currentUser?.id === id;

  useEffect(() => {
    if (!id) return;
    setTab('listings');
    loadProfile();
  }, [id]);

  const loadProfile = () => {
    setLoading(true);
    Promise.allSettled([
      usersApi.getProfile(id),
      reviewsApi.getForUser(id),
      // Query by author rather than pulling the whole feed and filtering it here: the feed
      // is a bounded page, so anyone whose posts had scrolled out of it showed an empty
      // Posts tab even though the posts existed.
      feedApi.getByAuthor(id),
      followsApi.relationship(id),
    ]).then(([profRes, revRes, feedRes, relRes]) => {
      if (profRes.status === 'rejected') { setLoading(false); return; }
      const p = profRes.value.data;
      setProfile(p);
      setEditData({
        fullName: p.fullName || '', bio: p.bio || '', city: p.city || '',
        addressLine1: p.addressLine1 || '', phone: p.phone || '', website: p.website || '',
      });
      setAvatarPreview(p.avatarUrl || '');
      setBannerPreview(p.shopBannerUrl || '');

      setReviews(revRes.status === 'fulfilled' ? revRes.value.data : []);
      setPosts(feedRes.status === 'fulfilled' ? (feedRes.value.data || []) : []);
      if (relRes.status === 'fulfilled') setRel(relRes.value.data);

      if (p.role === 'SELLER') {
        listingsApi.browse({}).then((r) => {
          setListings(r.data.filter((l) => l.sellerId === id));
        }).catch(() => {});
      } else {
        setListings([]);
      }
    }).catch(() => {}).finally(() => setLoading(false));
  };

  // Own profile: load like activity lazily when the tab is first opened.
  useEffect(() => {
    if (tab === 'likes' && isOwn) {
      feedApi.myLiked().then((r) => setLikedPosts(r.data || [])).catch(() => setLikedPosts([]));
    }
  }, [tab, isOwn]);

  const toggleFollow = async () => {
    if (followBusy || !currentUser) return;
    setFollowBusy(true);
    const wasFollowing = rel.isFollowing;
    // Optimistic flip
    setRel((r) => ({ ...r, isFollowing: !wasFollowing, followers: r.followers + (wasFollowing ? -1 : 1) }));
    try {
      if (wasFollowing) await followsApi.unfollow(id);
      else await followsApi.follow(id);
    } catch (e) {
      setRel((r) => ({ ...r, isFollowing: wasFollowing, followers: r.followers + (wasFollowing ? 1 : -1) }));
      showToast('Could not update follow — try again', 'error');
    } finally {
      setFollowBusy(false);
    }
  };

  const toggleBlock = async () => {
    setMenuOpen(false);
    try {
      if (rel.blocked) {
        await followsApi.unblock(id);
        setRel((r) => ({ ...r, blocked: false }));
        showToast(`${profile.fullName} unblocked`, 'success');
      } else {
        await followsApi.block(id);
        setRel((r) => ({ ...r, blocked: true, isFollowing: false }));
        showToast(`${profile.fullName} blocked`, 'success');
      }
    } catch (e) {
      showToast('Action failed — try again', 'error');
    }
  };

  const submitReport = async () => {
    if (reportBusy) return;
    setReportBusy(true);
    try {
      await followsApi.report(id, reportReason.trim());
      setReportOpen(false);
      setReportReason('');
      showToast('Report submitted — thank you', 'success');
    } catch (e) {
      showToast('Could not submit report', 'error');
    } finally {
      setReportBusy(false);
    }
  };

  const handleUpdateProfile = async () => {
    setIsUpdating(true);
    try {
      // Images first (dedicated multipart endpoints), then the JSON field patch.
      if (avatarFile) await usersApi.uploadAvatar(avatarFile);
      if (bannerFile) await usersApi.uploadBanner(bannerFile);
      await usersApi.updateProfile(editData);
      setIsModalOpen(false);
      setAvatarFile(null);
      setBannerFile(null);
      loadProfile();
      dispatch(loadUserProfile()); // refresh navbar avatar/name
      showToast('Profile updated', 'success');
    } catch (e) {
      showToast('Failed to update profile', 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleFileChange = (e, type) => {
    const file = e.target.files[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    if (type === 'avatar') { setAvatarFile(file); setAvatarPreview(preview); }
    else { setBannerFile(file); setBannerPreview(preview); }
  };

  const handleDeleteListing = async (listingId) => {
    try {
      await listingsApi.delete(listingId);
      setListings(listings.filter((l) => l.id !== listingId));
    } catch (e) {
      showToast('Failed to delete listing', 'error');
    }
  };

  if (loading) return (
    <div className="max-w-4xl mx-auto px-4 py-10 animate-pulse">
      <div className="flex items-center gap-8">
        <div className="w-24 h-24 sm:w-36 sm:h-36 rounded-full bg-white/5 shrink-0" />
        <div className="flex-1 space-y-4">
          <div className="h-6 w-48 bg-white/5 rounded" />
          <div className="h-4 w-72 bg-white/5 rounded" />
          <div className="h-4 w-40 bg-white/5 rounded" />
        </div>
      </div>
    </div>
  );

  if (!profile) return (
    <div className="text-center py-32 text-gray-500 font-bold">
      <User2 className="w-16 h-16 mx-auto mb-4 opacity-50" /> Profile not found
    </div>
  );

  const tabs = [
    { key: 'listings', label: 'Listings', icon: Grid3X3, count: listings.length },
    { key: 'posts', label: 'Posts', icon: ImageIcon, count: posts.length },
    { key: 'reviews', label: 'Reviews', icon: Star, count: reviews.length },
    ...(isOwn ? [{ key: 'likes', label: 'Likes', icon: Heart, count: null }] : []),
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 pt-4 pb-16">
      {/* Slim banner, only when the user set one */}
      {profile.shopBannerUrl && (
        <div className="h-28 sm:h-36 rounded-2xl overflow-hidden mb-4 relative">
          <img src={profile.shopBannerUrl} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        </div>
      )}

      {/* ── HEADER (Instagram layout: avatar left, info right) ── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex gap-5 sm:gap-10 items-start">
        {/* Avatar */}
        <div className="relative shrink-0">
          <div className="w-20 h-20 sm:w-36 sm:h-36 rounded-full overflow-hidden bg-black border-2 border-white/10 flex items-center justify-center">
            {profile.avatarUrl
              ? <img src={uploadUrl(profile.avatarUrl)} className="w-full h-full object-cover" />
              : <span className="text-[#CDFF00] font-black text-3xl sm:text-5xl uppercase">{profile.fullName?.[0]}</span>}
          </div>
          {profile.idVerified && (
            <div className="absolute bottom-0 right-0 sm:bottom-1 sm:right-1 w-7 h-7 rounded-full bg-[#CDFF00] text-black flex items-center justify-center border-[3px] border-[#050505]">
              <BadgeCheck className="w-4 h-4" />
            </div>
          )}
        </div>

        {/* Info column */}
        <div className="flex-1 min-w-0">
          {/* Row 1: name + actions.
              On mobile the name gets its own line and the buttons form an even full-width
              row beneath it. Previously everything shared one flex-wrap line, so a long
              name pushed the buttons onto a second row at ragged widths — and because the
              h1 had `truncate` without `min-w-0`, it refused to shrink and squeezed the
              actions off the edge on narrow screens. */}
          <h1 className="text-xl sm:text-2xl font-bold text-white truncate min-w-0 sm:hidden">
            {profile.fullName || profile.username}
          </h1>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-3 sm:mt-0 [&>a]:flex-1 [&>button]:flex-1 sm:[&>a]:flex-none sm:[&>button]:flex-none">
            <h1 className="hidden sm:block text-xl sm:text-2xl font-bold text-white truncate min-w-0 flex-none">
              {profile.fullName || profile.username}
            </h1>

            {isOwn ? (
              <>
                <Link
                  to="/create"
                  className="px-4 py-2 rounded-lg bg-[#CDFF00] hover:bg-[#d9ff33] text-black text-sm font-semibold transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" /> Add listing
                </Link>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <Settings className="w-4 h-4" /> Edit profile
                </button>
              </>
            ) : rel.blocked ? (
              <button
                onClick={toggleBlock}
                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
              >
                <ShieldOff className="w-4 h-4" /> Unblock
              </button>
            ) : (
              <>
                <button
                  onClick={toggleFollow}
                  disabled={followBusy || !currentUser}
                  className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-60 whitespace-nowrap ${
                    rel.isFollowing
                      ? 'bg-white/10 hover:bg-white/15 text-white'
                      : 'bg-[#CDFF00] hover:bg-[#d9ff33] text-black'
                  }`}
                >
                  {rel.isFollowing ? 'Following' : 'Follow'}
                </button>
                <Link
                  to={`/dm/${profile.id}`}
                  className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <MessageCircle className="w-4 h-4" /> Message
                </Link>
              </>
            )}

            {!isOwn && (
              <div className="relative flex-none">
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  className="p-2 rounded-lg hover:bg-white/10 text-white transition-colors"
                >
                  <MoreHorizontal className="w-5 h-5" />
                </button>
                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 w-44 py-1.5 bg-[#141414] border border-white/10 rounded-xl shadow-2xl z-40">
                      <button
                        onClick={toggleBlock}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-white/5 text-left font-semibold"
                      >
                        <Ban className="w-4 h-4" /> {rel.blocked ? 'Unblock' : 'Block'}
                      </button>
                      <button
                        onClick={() => { setMenuOpen(false); setReportOpen(true); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-white/5 text-left font-semibold"
                      >
                        <Flag className="w-4 h-4" /> Report
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Row 2: stats.
              Followers and following are the numbers people actually come here to read, so
              they are pulled out as chips in the brand colour instead of sitting in the same
              grey run-on line as everything else. */}
          <div className="flex flex-wrap items-center gap-2 mt-3 text-sm">
            <span className="inline-flex items-baseline gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10">
              <b className="text-white font-bold">{listings.length}</b>
              <span className="text-gray-400 text-xs font-medium">listings</span>
            </span>
            <span className="inline-flex items-baseline gap-1.5 px-3 py-1.5 rounded-xl bg-[#CDFF00]/10 border border-[#CDFF00]/30">
              <b className="text-[#CDFF00] font-extrabold">{rel.followers}</b>
              <span className="text-[#CDFF00]/70 text-xs font-semibold">followers</span>
            </span>
            <span className="inline-flex items-baseline gap-1.5 px-3 py-1.5 rounded-xl bg-[#00FFFF]/10 border border-[#00FFFF]/30">
              <b className="text-[#00FFFF] font-extrabold">{rel.following}</b>
              <span className="text-[#00FFFF]/70 text-xs font-semibold">following</span>
            </span>
          </div>

          {/* Row 3: role + bio + meta (hidden on very small screens, shown below) */}
          <div className="hidden sm:block mt-3">
            <ProfileBio profile={profile} />
          </div>
        </div>
      </motion.div>

      {/* Bio on mobile (full width under avatar) */}
      <div className="sm:hidden mt-3">
        <ProfileBio profile={profile} />
      </div>

      {rel.blockedBy && (
        <div className="mt-4 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm text-gray-400">
          This user has limited who can interact with them.
        </div>
      )}

      {/* ── TABS (Instagram-style top-border indicator) ── */}
      <div className="flex justify-center gap-10 sm:gap-16 border-t border-white/10 mt-6">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 pt-3 pb-2.5 -mt-px border-t text-xs font-bold uppercase tracking-widest transition-colors ${
              tab === t.key ? 'border-[#CDFF00] text-white' : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            <t.icon className="w-4 h-4" /> <span className="hidden sm:inline">{t.label}</span>
            {t.count != null && t.count > 0 && <span className="text-gray-500">{t.count}</span>}
          </button>
        ))}
      </div>

      {/* ── CONTENT ── */}
      <div className="mt-5 min-h-[300px]">
        {tab === 'listings' && (
          listings.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {listings.map((l, i) => (
                <ListingCard key={l.id} listing={l} index={i} onDelete={isOwn ? handleDeleteListing : undefined} />
              ))}
            </div>
          ) : <EmptyTab icon={FileText} text="No listings yet" />
        )}

        {tab === 'posts' && (
          posts.length > 0 ? (
            <div className="grid grid-cols-3 gap-1 sm:gap-2">
              {posts.map((post) => <PostTile key={post.id} post={post} onOpen={setViewingPost} />)}
            </div>
          ) : <EmptyTab icon={ImageIcon} text="No posts yet" />
        )}

        {tab === 'reviews' && (
          reviews.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {reviews.map((r) => (
                <div key={r.id} className="rounded-2xl p-5 border border-white/10 bg-white/[0.02]">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-black border border-[#CDFF00]/30 flex items-center justify-center text-[#CDFF00] font-black uppercase text-sm">
                      {r.reviewerName?.[0]}
                    </div>
                    <div>
                      <p className="text-white font-bold text-sm">{r.reviewerName}</p>
                      <ReviewStars rating={r.rating} size="sm" />
                    </div>
                  </div>
                  <p className="text-gray-300 text-sm leading-relaxed">{r.comment}</p>
                </div>
              ))}
            </div>
          ) : <EmptyTab icon={Star} text="No reviews yet" />
        )}

        {tab === 'likes' && isOwn && (
          likedPosts.length > 0 ? (
            <>
              <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-3">
                Posts you've liked · {likedPosts.length}
              </p>
              <div className="grid grid-cols-3 gap-1 sm:gap-2">
                {likedPosts.map((post) => <PostTile key={post.id} post={post} showAuthor onOpen={setViewingPost} />)}
              </div>
            </>
          ) : <EmptyTab icon={Heart} text="Posts you like will appear here" />
        )}
      </div>

      {/* ── REPORT MODAL ── */}
      <AnimatePresence>
        {/* Post viewer — opened from any grid tile. */}
      <AnimatePresence>
        {viewingPost && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setViewingPost(null)}
            className="fixed inset-0 z-[700] bg-black/90 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto"
          >
            <motion.div
              initial={{ opacity: 0, y: 28, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 28, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-lg bg-[#0a0a0a] border border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl my-0 sm:my-8 overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-full overflow-hidden bg-[#CDFF00] flex items-center justify-center shrink-0">
                    {(viewingPost.authorAvatarUrl || profile.avatarUrl)
                      ? <img src={uploadUrl(viewingPost.authorAvatarUrl || profile.avatarUrl)} alt="" className="w-full h-full object-cover" />
                      : <span className="text-sm font-black text-black">
                          {(viewingPost.authorName || profile.fullName || '?')[0]?.toUpperCase()}
                        </span>}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">
                      {viewingPost.authorName || profile.fullName}
                    </p>
                    <p className="text-[10px] text-gray-500 font-bold">{timeAgo(viewingPost.createdAt)}</p>
                  </div>
                </div>
                <button
                  onClick={() => setViewingPost(null)}
                  className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {(viewingPost.media?.[0]?.url || viewingPost.imageUrl) && (
                <img
                  src={uploadUrl(viewingPost.media?.[0]?.url || viewingPost.imageUrl)}
                  alt=""
                  className="w-full max-h-[60vh] object-contain bg-black"
                />
              )}

              {viewingPost.content && (
                <p className="px-4 py-4 text-[15px] text-white leading-relaxed whitespace-pre-wrap break-words">
                  {viewingPost.content}
                </p>
              )}

              <div className="px-4 py-3 border-t border-white/10 flex items-center gap-5 text-sm font-bold text-gray-400">
                <span className="flex items-center gap-1.5">
                  <Heart className="w-4 h-4" /> {viewingPost.likesCount || 0}
                </span>
                <span className="flex items-center gap-1.5">
                  <MessageCircle className="w-4 h-4" /> {viewingPost.commentsCount || 0}
                </span>
                <Link
                  to="/feed"
                  onClick={() => setViewingPost(null)}
                  className="ml-auto text-[10px] font-black uppercase tracking-widest text-[#CDFF00] hover:brightness-110"
                >
                  Open in feed
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {reportOpen && (
          <div className="fixed inset-0 z-[400] flex items-center justify-center px-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setReportOpen(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 16 }}
              className="relative w-full max-w-md bg-[#141414] border border-white/10 rounded-2xl p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-bold flex items-center gap-2"><Flag className="w-4 h-4 text-red-400" /> Report {profile.fullName}</h3>
                <button onClick={() => setReportOpen(false)} className="p-1.5 rounded-full hover:bg-white/10 text-gray-500"><X className="w-4 h-4" /></button>
              </div>
              <textarea
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                rows={4}
                placeholder="Tell us what's wrong (spam, scam, harassment, fake account…)"
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white placeholder-gray-500 outline-none focus:border-red-400/50 resize-none"
              />
              <button
                onClick={submitReport}
                disabled={reportBusy || !reportReason.trim()}
                className="mt-4 w-full py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold transition-colors disabled:opacity-40"
              >
                {reportBusy ? 'Submitting…' : 'Submit report'}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── EDIT PROFILE MODAL ── */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center px-4 overflow-y-auto py-10">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)} className="fixed inset-0 bg-black/90 backdrop-blur-md" />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-[#0a0a0a] border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-black/40 shrink-0">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Settings className="w-5 h-5 text-[#CDFF00]" /> Edit profile
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-7">
                {/* Photos */}
                <section>
                  <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Photos</h3>
                  <div className="flex items-center gap-5">
                    <div
                      onClick={() => document.getElementById('avatar-input').click()}
                      className="group relative w-20 h-20 rounded-full border-2 border-dashed border-white/15 hover:border-[#CDFF00]/60 transition-all cursor-pointer overflow-hidden flex items-center justify-center bg-white/[0.03] shrink-0"
                    >
                      {avatarPreview
                        ? <img src={avatarPreview} className="w-full h-full object-cover" />
                        : <Camera className="w-6 h-6 text-gray-600 group-hover:text-[#CDFF00]" />}
                      <input id="avatar-input" type="file" accept="image/*" hidden onChange={(e) => handleFileChange(e, 'avatar')} />
                    </div>
                    <div
                      onClick={() => document.getElementById('banner-input').click()}
                      className="group relative flex-1 h-20 rounded-xl border-2 border-dashed border-white/15 hover:border-[#CDFF00]/60 transition-all cursor-pointer overflow-hidden flex items-center justify-center bg-white/[0.03]"
                    >
                      {bannerPreview
                        ? <img src={bannerPreview} className="w-full h-full object-cover" />
                        : <span className="text-xs text-gray-600 group-hover:text-[#CDFF00] flex items-center gap-2"><ImageIcon className="w-4 h-4" /> Banner</span>}
                      <input id="banner-input" type="file" accept="image/*" hidden onChange={(e) => handleFileChange(e, 'banner')} />
                    </div>
                  </div>
                </section>

                {/* Identity */}
                <section className="space-y-3">
                  <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">About you</h3>
                  <input
                    type="text" value={editData.fullName}
                    onChange={(e) => setEditData({ ...editData, fullName: e.target.value })}
                    placeholder="Display name"
                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-[#CDFF00] transition-colors"
                  />
                  <textarea
                    value={editData.bio}
                    onChange={(e) => setEditData({ ...editData, bio: e.target.value })}
                    rows={3}
                    placeholder="Bio — tell people what you do"
                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-[#CDFF00] transition-colors resize-none"
                  />
                </section>

                {/* Contact & location */}
                <section className="space-y-3">
                  <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Location & contact</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input type="text" value={editData.city} onChange={(e) => setEditData({ ...editData, city: e.target.value })}
                      placeholder="City" className="bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-[#CDFF00]" />
                    <input type="text" value={editData.phone} onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                      placeholder="Phone" className="bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-[#CDFF00]" />
                    <input type="text" value={editData.addressLine1} onChange={(e) => setEditData({ ...editData, addressLine1: e.target.value })}
                      placeholder="Business address" className="bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-[#CDFF00]" />
                    <div className="relative">
                      <Globe className="w-4 h-4 text-gray-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input type="text" value={editData.website} onChange={(e) => setEditData({ ...editData, website: e.target.value })}
                        placeholder="Website" className="w-full bg-white/[0.04] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-white text-sm outline-none focus:border-[#CDFF00]" />
                    </div>
                  </div>
                </section>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-black border-t border-white/10 flex items-center justify-end gap-3 shrink-0">
                <button onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 rounded-xl text-gray-400 text-sm font-semibold hover:text-white transition-colors">
                  Cancel
                </button>
                <button
                  onClick={handleUpdateProfile}
                  disabled={isUpdating}
                  className="px-6 py-2.5 rounded-xl bg-[#CDFF00] text-black text-sm font-bold hover:bg-[#d9ff33] active:scale-95 transition-all flex items-center gap-2 disabled:opacity-60"
                >
                  {isUpdating ? 'Saving…' : <>Save <Check className="w-4 h-4" /></>}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* Bio block shared between the desktop (beside avatar) and mobile (below) positions. */
function ProfileBio({ profile }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="px-2 py-0.5 rounded-md bg-[#CDFF00]/15 text-[#CDFF00] text-[10px] font-bold uppercase tracking-widest">{profile.role}</span>
        {profile.city && (
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <MapPin className="w-3 h-3 text-[#CDFF00]" /> {profile.city}
          </span>
        )}
        <DistanceBadge lat={profile.latitude} lng={profile.longitude} />
      </div>
      {profile.bio && <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{profile.bio}</p>}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        {profile.website && (
          <a href={profile.website} target="_blank" rel="noreferrer" className="text-[#00FFFF] hover:underline flex items-center gap-1">
            <Globe className="w-3 h-3" /> {profile.website.replace(/^https?:\/\//, '')}
          </a>
        )}
        {profile.instagram && (
          <a href={`https://instagram.com/${profile.instagram.replace(/^@/, '')}`} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-white flex items-center gap-1">
            <AtSign className="w-3 h-3" /> {profile.instagram.replace(/^@/, '')}
          </a>
        )}
      </div>
    </div>
  );
}

/* Instagram-style square tile for a feed post (image or text). */
function PostTile({ post, showAuthor = false, onOpen }) {
  const image = post.media?.[0]?.url || post.imageUrl;
  return (
    <button
      type="button"
      onClick={() => onOpen?.(post)}
      aria-label={post.content ? `Open post: ${String(post.content).slice(0, 60)}` : 'Open post'}
      className="relative aspect-square w-full text-left bg-white/[0.03] border border-white/5 rounded-md sm:rounded-xl overflow-hidden group cursor-pointer focus-visible:ring-2 focus-visible:ring-[#CDFF00]/60 outline-none"
    >
      {image ? (
        <img src={image} className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
      ) : (
        <div className="w-full h-full p-3 flex items-center justify-center">
          <p className="text-[11px] sm:text-sm text-gray-400 line-clamp-4 text-center leading-snug">{post.content}</p>
        </div>
      )}
      {/* Hover overlay with like/comment counts */}
      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5">
        <div className="flex items-center gap-4 text-white text-sm font-bold">
          <span className="flex items-center gap-1.5"><Heart className="w-4 h-4 fill-white" /> {post.likesCount || 0}</span>
          <span className="flex items-center gap-1.5"><MessageCircle className="w-4 h-4 fill-white" /> {post.commentsCount || 0}</span>
        </div>
        {showAuthor && post.authorName && (
          <span className="text-[11px] text-gray-300">by {post.authorName}</span>
        )}
      </div>
    </button>
  );
}

function EmptyTab({ icon: Icon, text }) {
  return (
    <div className="py-20 text-center border border-dashed border-white/10 rounded-2xl">
      <Icon className="w-10 h-10 mx-auto text-gray-700 mb-3" />
      <p className="text-sm text-gray-500 font-semibold">{text}</p>
    </div>
  );
}
