import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useSelector } from 'react-redux';
import { selectUser } from '../store/authSlice';
import { usersApi, reviewsApi, listingsApi, feedApi } from '../api/client';
import { LISTING_TYPES } from '../utils/constants';
import ReviewStars from '../components/ReviewStars';
import ListingCard from '../components/ListingCard';
import { MapPin, BadgeCheck, FileText, Star, User2, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Profile() {
  const { id } = useParams();
  const currentUser = useSelector(selectUser);
  const [profile, setProfile] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [listings, setListings] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('listings');

  const isOwn = currentUser?.id === id;

  const handleDeleteListing = async (listingId) => {
    try {
      await listingsApi.delete(listingId);
      setListings(listings.filter(l => l.id !== listingId));
    } catch (e) {
      alert("Failed to delete listing.");
    }
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([
      usersApi.getProfile(id),
      reviewsApi.getForUser(id),
      feedApi.getAll()
    ]).then(([profRes, revRes, feedRes]) => {
      setProfile(profRes.data);
      setReviews(revRes.data);
      setPosts(feedRes.data.filter((p) => p.authorId === id));
      if (profRes.data.role === 'SELLER') {
        listingsApi.browse({}).then((r) => {
          setListings(r.data.filter((l) => l.sellerId === id));
        }).catch(() => {});
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10 mt-10 animate-pulse">
        <div className="flex gap-8 mb-8">
          <div className="w-32 h-32 rounded-3xl bg-surface-50" />
          <div className="flex-1 space-y-4">
            <div className="h-8 bg-surface-50 rounded w-1/3" />
            <div className="h-4 bg-surface-50 rounded w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  if (!profile) return <div className="text-center py-32 text-gray-500 font-bold uppercase tracking-widest flex flex-col items-center"><User2 className="w-16 h-16 mb-4 opacity-50" /> Profile not found</div>;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 mt-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        {/* Profile header */}
        <div className="glass rounded-3xl p-0 mb-10 border border-white/5 relative overflow-hidden">
          {profile.shopBannerUrl ? (
            <div className="h-48 sm:h-64 w-full relative">
              <img src={profile.shopBannerUrl} alt="Shop Banner" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
            </div>
          ) : (
            <div className="h-32 w-full bg-gradient-to-r from-surface-50 to-black relative" />
          )}

          <div className="p-8 sm:p-12 relative -mt-16 sm:-mt-24 z-10 w-full">
            {!isOwn && (
            <div className="absolute top-6 right-6 flex items-center gap-3">
              <button 
                onClick={() => {
                  if (profile.following) {
                     usersApi.unfollowUser(profile.id).then(res => setProfile(res.data));
                  } else {
                     usersApi.followUser(profile.id).then(res => setProfile(res.data));
                  }
                }}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold tracking-widest uppercase text-xs transition-all shadow-lg backdrop-blur border ${profile.following ? 'bg-black/50 text-white border-white/20 hover:glass bg-black/40 border border-white/10' : 'bg-[#CDFF00] text-black border-[#CDFF00] hover:bg-[#E0FF4D]'}`}>
                {profile.following ? 'Unfollow' : 'Follow'}
              </button>
              <Link to={`/dm/${profile.id}`} className="flex items-center gap-2 px-5 py-2.5 bg-black/50 border border-white/10 hover:border-[#CDFF00]/50 rounded-full text-white font-bold tracking-widest uppercase text-xs hover:text-[#CDFF00] transition-all shadow-lg backdrop-blur">
                <MessageCircle className="w-4 h-4" /> Message
              </Link>
            </div>
          )}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-8 text-center sm:text-left">
            <div className="relative">
              <div className="w-32 h-32 rounded-3xl bg-black border border-[#CDFF00]/50 flex items-center justify-center text-[#CDFF00] font-heading font-black text-5xl shrink-0 shadow-[0_0_30px_rgba(205,255,0,0.1)]">
                {profile.fullName?.[0] || 'U'}
              </div>
              {profile.idVerified && (
                <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-full bg-gradient-to-r from-[#CDFF00] to-[#E0FF4D] text-black flex items-center justify-center border-4 border-black shadow-[0_0_15px_rgba(205,255,0,0.4)]" title="Verified User">
                  <BadgeCheck className="w-6 h-6 fill-black text-[#CDFF00]" />
                </div>
              )}
              {profile.online && (
                <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-green-500 border-4 border-[#121212]" title="Online now">
                  <div className="w-full h-full rounded-full bg-green-400 animate-ping opacity-75" />
                </div>
              )}
            </div>
            
            <div className="flex-1 mt-4 sm:mt-0">
              <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 mb-4">
                <h1 className="text-4xl sm:text-5xl font-heading font-black text-white uppercase tracking-tight">{profile.fullName}</h1>
              </div>
              
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mb-6">
                <span className="inline-flex items-center px-4 py-1.5 rounded-sm text-[10px] font-black bg-[#CDFF00] text-black uppercase tracking-widest">
                  {profile.role}
                </span>
                {profile.city && (
                  <span className="flex items-center gap-1.5 text-xs font-bold text-gray-400 uppercase tracking-widest border border-white/10 px-3 py-1 rounded bg-black/50">
                    <MapPin className="w-3.5 h-3.5" /> {profile.city}
                  </span>
                )}
              </div>

              {profile.bio ? (
                <p className="text-gray-300 text-sm leading-relaxed max-w-2xl">{profile.bio}</p>
              ) : (
                <p className="text-gray-500 text-sm italic font-medium">No bio provided.</p>
              )}

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-6 mt-6 pt-6 border-t border-white/10">
                <div className="flex flex-col items-center sm:items-start gap-1">
                  <span className="text-xs font-black text-gray-500 uppercase tracking-widest">Trust Score</span>
                  <div className="flex items-center gap-2">
                    <ReviewStars rating={profile.avgRating || 0} size="sm" />
                    <span className="text-white font-bold">{profile.avgRating > 0 ? profile.avgRating.toFixed(1) : 'New'}</span>
                    <span className="text-gray-500 text-xs">({reviews.length})</span>
                  </div>
                </div>
                <div className="w-px h-8 glass bg-black/40 border border-white/10 hidden sm:block" />
                <div className="flex flex-col items-center sm:items-start gap-1">
                  <span className="text-xs font-black text-gray-500 uppercase tracking-widest">Community</span>
                  <span className="text-white font-bold flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-[#CDFF00]/20 flex items-center justify-center">
                      <Star className="w-3 h-3 text-[#CDFF00]" />
                    </div>
                    {profile.vouchCount} Vouches
                  </span>
                </div>
                <div className="w-px h-8 glass bg-black/40 border border-white/10 hidden sm:block" />
                <div className="flex flex-col items-center sm:items-start gap-1">
                  <span className="text-xs font-black text-gray-500 uppercase tracking-widest">Network</span>
                  <span className="text-white font-bold flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-[#CDFF00]/20 flex items-center justify-center">
                      <User2 className="w-3 h-3 text-[#CDFF00]" />
                    </div>
                    {profile.followersCount || 0} Followers
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2 scrollbar-hide py-2 px-1">
          <button
            onClick={() => setTab('listings')}
            className={`flex items-center gap-2 px-5 sm:px-8 py-3 sm:py-4 shrink-0 whitespace-nowrap rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              tab === 'listings' ? 'bg-[#CDFF00] text-black shadow-lg shadow-[#CDFF00]/10' : 'bg-black/50 glass border border-white/10 text-gray-400 hover:text-white hover:border-white/30'
            }`}
          >
            <FileText className="w-4 h-4" /> Listings ({listings.length})
          </button>
          <button
            onClick={() => setTab('posts')}
            className={`flex items-center gap-2 px-5 sm:px-8 py-3 sm:py-4 shrink-0 whitespace-nowrap rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              tab === 'posts' ? 'bg-[#CDFF00] text-black shadow-lg shadow-[#CDFF00]/10' : 'bg-black/50 glass border border-white/10 text-gray-400 hover:text-white hover:border-white/30'
            }`}
          >
            <MessageCircle className="w-4 h-4" /> Updates ({posts.length})
          </button>
          <button
            onClick={() => setTab('reviews')}
            className={`flex items-center gap-2 px-5 sm:px-8 py-3 sm:py-4 shrink-0 whitespace-nowrap rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              tab === 'reviews' ? 'bg-[#CDFF00] text-black shadow-lg shadow-[#CDFF00]/10' : 'bg-black/50 glass border border-white/10 text-gray-400 hover:text-white hover:border-white/30'
            }`}
          >
            <Star className="w-4 h-4" /> Reviews ({reviews.length})
          </button>
        </div>

        {/* Content */}
        <div className="min-h-[400px]">
          {tab === 'listings' && (
            <div>
              {listings.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {listings.map((listing, i) => (
                    <ListingCard key={listing.id} listing={listing} index={i} onDelete={handleDeleteListing} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-20 border border-white/5 rounded-3xl glass">
                  <FileText className="w-16 h-16 mx-auto text-gray-600 mb-6" />
                  <p className="text-gray-400 font-black uppercase tracking-widest text-lg">No active listings</p>
                </div>
              )}
            </div>
          )}

          {tab === 'posts' && (
            <div className="space-y-6">
              {posts.length > 0 ? posts.map((item) => (
                <div key={item.id} className="glass rounded-3xl p-6 border border-white/5">
                  <div className="flex items-center gap-3 mb-4">
                     <span className="text-xs text-gray-400 font-bold uppercase tracking-widest">{new Date(item.createdAt).toLocaleDateString()}</span>
                  </div>
                  {item.imageUrl && (
                    <img src={item.imageUrl} alt="Post Update" className="w-full h-64 object-cover rounded-2xl mb-4" />
                  )}
                  <p className="text-white text-sm leading-relaxed">{item.content}</p>
                </div>
              )) : (
                <div className="text-center py-20 border border-white/5 rounded-3xl glass">
                  <MessageCircle className="w-16 h-16 mx-auto text-gray-600 mb-6" />
                  <p className="text-gray-400 font-black uppercase tracking-widest text-lg">No updates yet</p>
                </div>
              )}
            </div>
          )}

          {tab === 'reviews' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {reviews.length > 0 ? reviews.map((review) => (
                <div key={review.id} className="glass rounded-3xl p-6 sm:p-8 border border-white/5">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-black border border-[#CDFF00]/30 flex items-center justify-center text-[#CDFF00] text-sm font-black uppercase">
                      {review.reviewerName?.[0] || 'R'}
                    </div>
                    <div>
                      <span className="text-sm font-black text-white uppercase tracking-wider">{review.reviewerName || 'Customer'}</span>
                      <div className="mt-1"><ReviewStars rating={review.rating} size="sm" /></div>
                    </div>
                  </div>
                  {review.comment && <p className="text-gray-300 text-sm font-medium leading-relaxed">{review.comment}</p>}
                </div>
              )) : (
                <div className="sm:col-span-2 text-center py-20 border border-white/5 rounded-3xl glass">
                  <Star className="w-16 h-16 mx-auto text-gray-600 mb-6" />
                  <p className="text-gray-400 font-black uppercase tracking-widest text-lg">No reviews yet</p>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
