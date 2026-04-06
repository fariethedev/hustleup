import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useSelector } from 'react-redux';
import { selectUser } from '../store/authSlice';
import { usersApi, reviewsApi, listingsApi, feedApi } from '../api/client';
import ReviewStars from '../components/ReviewStars';
import ListingCard from '../components/ListingCard';
import { MapPin, BadgeCheck, FileText, Star, User2, MessageCircle, Settings, Camera, Image as ImageIcon, Check, X, Phone, AtSign, Hash, Briefcase, Clock, Globe } from 'lucide-react';

export default function Profile() {
  const { id } = useParams();
  const currentUser = useSelector(selectUser);
  const [profile, setProfile] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [listings, setListings] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('listings');
  
  // Settings / Edit State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editData, setEditData] = useState({
    fullName: '',
    bio: '',
    city: '',
    address: '',
    phone: '',
    instagram: '',
    twitter: '',
    linkedin: '',
    website: '',
    businessHours: '',
  });
  
  // Image states for local file handling
  const [avatarFile, setAvatarFile] = useState(null);
  const [bannerFile, setBannerFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [bannerPreview, setBannerPreview] = useState('');
  
  const [isUpdating, setIsUpdating] = useState(false);

  const isOwn = currentUser?.id === id;

  useEffect(() => {
    if (!id) return;
    loadProfile();
  }, [id]);

  const loadProfile = () => {
    setLoading(true);
    Promise.allSettled([
      usersApi.getProfile(id),
      reviewsApi.getForUser(id),
      feedApi.getAll()
    ]).then(([profRes, revRes, feedRes]) => {
      if (profRes.status === 'rejected') { setLoading(false); return; }
      const p = profRes.value.data;
      setProfile(p);
      setEditData({
        fullName: p.fullName || '',
        bio: p.bio || '',
        city: p.city || '',
        address: p.address || '',
        phone: p.phone || '',
        instagram: p.instagram || '',
        twitter: p.twitter || '',
        linkedin: p.linkedin || '',
        website: p.website || '',
        businessHours: p.businessHours || '',
      });
      setAvatarPreview(p.avatarUrl || '');
      setBannerPreview(p.shopBannerUrl || '');
      
      setReviews(revRes.status === 'fulfilled' ? revRes.value.data : []);
      setPosts((feedRes.status === 'fulfilled' ? feedRes.value.data : []).filter((p) => p.authorId === id));
      if (p.role === 'SELLER') {
        listingsApi.browse({}).then((r) => {
          setListings(r.data.filter((l) => l.sellerId === id));
        }).catch(() => {});
      }
    }).catch(() => {}).finally(() => setLoading(false));
  };

  const handleUpdateProfile = async () => {
    setIsUpdating(true);
    try {
      const formData = new FormData();
      Object.keys(editData).forEach(key => {
        formData.append(key, editData[key]);
      });
      if (avatarFile) formData.append('avatar', avatarFile);
      if (bannerFile) formData.append('shopBanner', bannerFile);

      await usersApi.updateProfile(formData);
      setIsModalOpen(false);
      loadProfile();
    } catch (e) {
      alert("Failed to update profile");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleFileChange = (e, type) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const preview = URL.createObjectURL(file);
    if (type === 'avatar') {
      setAvatarFile(file);
      setAvatarPreview(preview);
    } else {
      setBannerFile(file);
      setBannerPreview(preview);
    }
  };

  const handleDeleteListing = async (listingId) => {
    try {
      await listingsApi.delete(listingId);
      setListings(listings.filter(l => l.id !== listingId));
    } catch (e) {
      alert("Failed to delete listing.");
    }
  };

  if (loading) return <div className="max-w-4xl mx-auto px-4 py-32 animate-pulse flex flex-col items-center gap-10">
    <div className="w-full h-64 bg-white/5 rounded-[3rem]" />
    <div className="w-48 h-48 rounded-[3rem] bg-white/5 -mt-24" />
  </div>;

  if (!profile) return <div className="text-center py-32 text-gray-500 font-black uppercase tracking-widest"><User2 className="w-16 h-16 mx-auto mb-4 opacity-50" /> Profile not found</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 mt-6 font-medium">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        
        {/* Profile header */}
        <div className="glass rounded-[2.5rem] mb-10 border border-white/5 relative overflow-hidden bg-black/40 shadow-2xl">
          
          {/* Banner */}
          <div className="h-64 sm:h-96 w-full relative group">
            {profile.shopBannerUrl ? (
              <img src={profile.shopBannerUrl} alt="Banner" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-[#1a1a1a] via-[#121212] to-black" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent/20 to-transparent" />
            
            {isOwn && (
              <button 
                onClick={() => setIsModalOpen(true)}
                className="absolute top-8 right-8 p-4 rounded-2xl glass bg-black/40 border border-white/10 text-white hover:scale-110 transition-all z-20 flex items-center gap-3 group"
              >
                <Settings className="w-5 h-5 group-hover:rotate-90 transition-transform duration-500" />
                <span className="text-[10px] font-black uppercase tracking-widest hidden sm:block">Update Profile</span>
              </button>
            )}
          </div>

          <div className="px-8 sm:px-16 pb-12 relative -mt-32 z-10">
            <div className="flex flex-col lg:flex-row items-center lg:items-end gap-10">
              
              {/* Avatar section */}
              <div className="relative group">
                <div className="w-48 h-48 rounded-[3rem] bg-black border-[6px] border-[#121212] overflow-hidden shadow-2xl flex items-center justify-center">
                  {profile.avatarUrl ? (
                    <img src={profile.avatarUrl} className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-[#CDFF00] font-heading font-black text-7xl uppercase">
                      {profile.fullName?.[0]}
                    </div>
                  )}
                </div>
                
                {profile.idVerified && (
                  <div className="absolute -bottom-2 -right-2 w-12 h-12 rounded-2xl bg-[#CDFF00] text-black flex items-center justify-center border-[4px] border-[#121212] shadow-xl">
                    <BadgeCheck className="w-6 h-6 fill-black" />
                  </div>
                )}
              </div>

              {/* Identity & Headline Stats */}
              <div className="flex-1 text-center lg:text-left">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-12">
                  <div>
                    <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 mb-6">
                      <span className="px-5 py-2 rounded-full bg-[#CDFF00] text-black text-[10px] font-black uppercase tracking-[0.2em] shadow-[0_5px_20px_rgba(205,255,0,0.3)]">
                        {profile.role}
                      </span>
                      {profile.city && (
                        <span className="flex items-center gap-2 text-[10px] font-black text-white/40 uppercase tracking-[0.25em]">
                          <MapPin className="w-3.5 h-3.5 text-[#CDFF00]" /> {profile.city}
                        </span>
                      )}
                    </div>
                    <h1 className="text-6xl sm:text-8xl font-heading font-black text-white uppercase tracking-tighter leading-[0.85] mb-6 drop-shadow-2xl">
                      {profile.fullName || profile.username}
                    </h1>
                    <p className="text-sm font-black text-[#CDFF00]/60 uppercase tracking-[0.3em] lg:text-left text-center">Protocol: {profile.idVerified ? 'VERIFIED_SYNDICATE' : 'STANDARD_HUSTLE'}</p>
                  </div>

                  {/* Headline Stats: FOLLOWING & FOLLOWERS */}
                  <div className="flex items-center justify-center gap-12 sm:gap-20 bg-white/[0.03] border border-white/5 p-8 rounded-[3rem] backdrop-blur-xl">
                    <div className="text-center">
                      <p className="text-5xl sm:text-7xl font-heading font-black text-[#CDFF00] leading-none mb-3 drop-shadow-[0_0_20px_rgba(205,255,0,0.4)]">
                        {profile.followersCount || 0}
                      </p>
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em]">Amplifiers</p>
                    </div>
                    <div className="text-center">
                      <p className="text-5xl sm:text-7xl font-heading font-black text-white leading-none mb-3">
                        {profile.followingCount || 0}
                      </p>
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em]">Network</p>
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex flex-wrap items-center justify-center lg:justify-start gap-4">
                  {!isOwn && (
                    <>
                      <button 
                        onClick={() => {
                          if (profile.following) {
                             usersApi.unfollowUser(profile.id).then(res => setProfile(res.data));
                          } else {
                             usersApi.followUser(profile.id).then(res => setProfile(res.data));
                          }
                        }}
                        className={`px-10 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-xl ${profile.following ? 'bg-white/5 text-white border border-white/10' : 'bg-[#CDFF00] text-black hover:scale-105'}`}>
                        {profile.following ? 'Following' : 'Follow User'}
                      </button>
                      <Link to={`/dm/${profile.id}`} className="p-4 bg-white/5 border border-white/10 rounded-2xl text-white hover:text-[#CDFF00] transition-all">
                        <MessageCircle className="w-5 h-5" />
                      </Link>
                    </>
                  )}
                  {profile.website && (
                    <a href={profile.website} target="_blank" className="p-4 bg-white/5 border border-white/10 rounded-2xl text-white hover:text-[#CDFF00] transition-all">
                      <Globe className="w-5 h-5" />
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Expanded Information Display */}
            <div className="mt-12 grid grid-cols-1 lg:grid-cols-3 gap-12 pt-12 border-t border-white/10">
              <div className="lg:col-span-2">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em] mb-4">Masterpiece Narrative</p>
                <p className="text-gray-300 text-lg leading-relaxed mb-8">{profile.bio || "No hustle story shared yet."}</p>
                
                {/* Social Badges */}
                <div className="flex flex-wrap gap-4">
                  {profile.instagram && (
                    <a href={`https://instagram.com/${profile.instagram}`} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/5 text-xs text-gray-400 hover:text-white transition-colors">
                      <AtSign className="w-4 h-4" /> @{profile.instagram}
                    </a>
                  )}
                  {profile.twitter && (
                    <a href={`https://twitter.com/${profile.twitter}`} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/5 text-xs text-gray-400 hover:text-white transition-colors">
                      <Hash className="w-4 h-4" /> @{profile.twitter}
                    </a>
                  )}
                  {profile.linkedin && (
                    <a href={profile.linkedin} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/5 text-xs text-gray-400 hover:text-white transition-colors">
                      <Briefcase className="w-4 h-4" /> Experience
                    </a>
                  )}
                </div>
              </div>

              <div className="space-y-6">
                <div className="glass p-6 rounded-3xl border border-white/5 bg-white/[0.02]">
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-4">Operations Hub</p>
                  <div className="space-y-4">
                    <div className="flex items-start gap-4">
                      <MapPin className="w-5 h-5 text-[#CDFF00] shrink-0" />
                      <div>
                        <p className="text-white text-sm font-bold uppercase tracking-tight">{profile.city}</p>
                        <p className="text-gray-500 text-xs mt-1 leading-relaxed">{profile.address || 'Address withheld'}</p>
                      </div>
                    </div>
                    {profile.phone && (
                      <div className="flex items-center gap-4">
                        <Phone className="w-5 h-5 text-[#CDFF00] shrink-0" />
                        <p className="text-white text-sm font-bold">{profile.phone}</p>
                      </div>
                    )}
                    {profile.businessHours && (
                      <div className="flex items-center gap-4">
                        <Clock className="w-5 h-5 text-[#CDFF00] shrink-0" />
                        <p className="text-white text-xs font-bold uppercase">{profile.businessHours}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-1 text-center px-6 py-4 glass rounded-2xl border border-white/5">
                    <p className="text-xs font-black text-gray-500 uppercase mb-2">Vouches</p>
                    <p className="text-2xl font-black text-white">{profile.vouchCount || 0}</p>
                  </div>
                  <div className="flex-1 text-center px-6 py-4 glass rounded-2xl border border-white/5">
                    <p className="text-xs font-black text-gray-500 uppercase mb-2">Rating</p>
                    <p className="text-2xl font-black text-[#CDFF00]">{profile.avgRating ? profile.avgRating.toFixed(1) : '—'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-10 overflow-x-auto pb-2 scrollbar-hide py-2 px-1">
          {['listings', 'posts', 'reviews'].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-10 py-5 shrink-0 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
                tab === t ? 'bg-[#CDFF00] text-black shadow-xl shadow-[#CDFF00]/10' : 'bg-black/50 glass border border-white/5 text-gray-500 hover:text-white'
              }`}
            >
              {t === 'listings' && <><FileText className="inline w-4 h-4 mr-2" /> Listings ({listings.length})</>}
              {t === 'posts' && <><MessageCircle className="inline w-4 h-4 mr-2" /> Updates ({posts.length})</>}
              {t === 'reviews' && <><Star className="inline w-4 h-4 mr-2" /> Reviews ({reviews.length})</>}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="min-h-[400px]">
          {tab === 'listings' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {listings.length > 0 ? listings.map((l, i) => (
                <ListingCard key={l.id} listing={l} index={i} onDelete={handleDeleteListing} />
              )) : (
                <div className="col-span-full py-32 text-center glass border border-white/5 rounded-[3rem]">
                  <p className="text-gray-500 font-black uppercase tracking-widest">No active business drops</p>
                </div>
              )}
            </div>
          )}

          {tab === 'posts' && (
            <div className="max-w-3xl mx-auto space-y-8">
              {posts.length > 0 ? posts.map((item) => (
                <div key={item.id} className="glass rounded-[2rem] p-8 border border-white/5">
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest">{new Date(item.createdAt).toDateString()}</span>
                  </div>
                  {item.imageUrl && <img src={item.imageUrl} className="w-full h-80 object-cover rounded-2xl mb-6 shadow-2xl" />}
                  <p className="text-white text-lg font-medium leading-relaxed">{item.content}</p>
                </div>
              )) : (
                <div className="py-32 text-center glass border border-white/5 rounded-[3rem]">
                  <p className="text-gray-500 font-black uppercase tracking-widest">No updates posted yet</p>
                </div>
              )}
            </div>
          )}

          {tab === 'reviews' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {reviews.length > 0 ? reviews.map((r) => (
                <div key={r.id} className="glass rounded-[2rem] p-8 border border-white/5">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-black border border-[#CDFF00]/20 flex items-center justify-center text-[#CDFF00] font-black uppercase">
                      {r.reviewerName?.[0]}
                    </div>
                    <div>
                      <p className="text-white font-black uppercase tracking-wider text-sm">{r.reviewerName}</p>
                      <ReviewStars rating={r.rating} size="sm" />
                    </div>
                  </div>
                  <p className="text-gray-300 font-medium leading-relaxed">{r.comment}</p>
                </div>
              )) : (
                <div className="col-span-full py-32 text-center glass border border-white/5 rounded-[3rem]">
                  <p className="text-gray-500 font-black uppercase tracking-widest">No client reviews yet</p>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>

      {/* Structured Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center px-4 overflow-y-auto py-10">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="fixed inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-5xl bg-[#0a0a0a] border border-white/10 rounded-[3rem] overflow-hidden shadow-[0_0_100px_rgba(205,255,0,0.1)] flex flex-col"
            >
              {/* Modal Header */}
              <div className="p-8 border-b border-white/5 flex items-center justify-between bg-black/40">
                <div>
                  <h2 className="text-2xl font-black text-white uppercase tracking-widest flex items-center gap-3">
                    <Settings className="w-6 h-6 text-[#CDFF00]" /> Configuration Hub
                  </h2>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Refine your public operation profile</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-4 hover:bg-white/5 rounded-2xl transition-colors">
                  <X className="w-6 h-6 text-gray-400" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-8 sm:p-12 space-y-12">
                
                {/* 📸 Visual Assets Section */}
                <section className="space-y-8">
                  <h3 className="text-[10px] font-black text-white uppercase tracking-[0.4em] bg-white/5 py-3 px-6 rounded-full inline-block">01. Visual Assets</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-4">
                      <p className="text-[10px] font-black text-[#CDFF00] uppercase tracking-widest">Avatar Selection</p>
                      <div 
                        onClick={() => document.getElementById('avatar-input').click()}
                        className="group relative h-48 rounded-[2rem] border-2 border-dashed border-white/10 hover:border-[#CDFF00]/50 transition-all cursor-pointer overflow-hidden flex items-center justify-center bg-white/[0.02]"
                      >
                        {avatarPreview ? (
                          <img src={avatarPreview} className="w-full h-full object-cover group-hover:blur-sm transition-all" />
                        ) : (
                          <Camera className="w-10 h-10 text-gray-600 group-hover:text-[#CDFF00] transition-colors" />
                        )}
                        <input id="avatar-input" type="file" hidden onChange={(e) => handleFileChange(e, 'avatar')} />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                          <p className="text-[10px] font-black text-white uppercase tracking-widest">Change Photo</p>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <p className="text-[10px] font-black text-[#CDFF00] uppercase tracking-widest">Operation Banner</p>
                      <div 
                        onClick={() => document.getElementById('banner-input').click()}
                        className="group relative h-48 rounded-[2rem] border-2 border-dashed border-white/10 hover:border-[#CDFF00]/50 transition-all cursor-pointer overflow-hidden flex items-center justify-center bg-white/[0.02]"
                      >
                        {bannerPreview ? (
                          <img src={bannerPreview} className="w-full h-full object-cover group-hover:blur-sm transition-all" />
                        ) : (
                          <ImageIcon className="w-10 h-10 text-gray-600 group-hover:text-[#CDFF00] transition-colors" />
                        )}
                        <input id="banner-input" type="file" hidden onChange={(e) => handleFileChange(e, 'banner')} />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                          <p className="text-[10px] font-black text-white uppercase tracking-widest">Change Banner</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                {/* 👤 Identity Section */}
                <section className="space-y-8">
                  <h3 className="text-[10px] font-black text-white uppercase tracking-[0.4em] bg-white/5 py-3 px-6 rounded-full inline-block">02. Persona & Story</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Operational Name</label>
                      <input 
                        type="text" 
                        value={editData.fullName}
                        onChange={(e) => setEditData({...editData, fullName: e.target.value})}
                        className="w-full bg-white/[0.03] border border-white/5 rounded-2xl p-4 text-white text-sm outline-none focus:border-[#CDFF00] transition-colors"
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Business Narrative (Bio)</label>
                      <textarea 
                        value={editData.bio}
                        onChange={(e) => setEditData({...editData, bio: e.target.value})}
                        className="w-full h-40 bg-white/[0.03] border border-white/5 rounded-[2rem] p-5 text-white text-sm leading-relaxed outline-none focus:border-[#CDFF00] transition-colors resize-none"
                        placeholder="Tell the world your hustle..."
                      />
                    </div>
                  </div>
                </section>

                {/* 📍 Location & Contact Section */}
                <section className="space-y-8">
                  <h3 className="text-[10px] font-black text-white uppercase tracking-[0.4em] bg-white/5 py-3 px-6 rounded-full inline-block">03. Logistics & Contact</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Base City</label>
                        <input 
                          type="text" 
                          value={editData.city}
                          onChange={(e) => setEditData({...editData, city: e.target.value})}
                          className="w-full bg-white/[0.03] border border-white/5 rounded-2xl p-4 text-white text-sm outline-none focus:border-[#CDFF00]"
                          placeholder="e.g. Lagos, Nigeria"
                        />
                      </div>
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Operational Address</label>
                        <input 
                          type="text" 
                          value={editData.address}
                          onChange={(e) => setEditData({...editData, address: e.target.value})}
                          className="w-full bg-white/[0.03] border border-white/5 rounded-2xl p-4 text-white text-sm outline-none focus:border-[#CDFF00]"
                          placeholder="Full address for client logistics"
                        />
                      </div>
                    </div>
                    <div className="space-y-6">
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Secure Contact (Phone)</label>
                        <input 
                          type="text" 
                          value={editData.phone}
                          onChange={(e) => setEditData({...editData, phone: e.target.value})}
                          className="w-full bg-white/[0.03] border border-white/5 rounded-2xl p-4 text-white text-sm outline-none focus:border-[#CDFF00]"
                          placeholder="+234..."
                        />
                      </div>
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Operational Hours</label>
                        <input 
                          type="text" 
                          value={editData.businessHours}
                          onChange={(e) => setEditData({...editData, businessHours: e.target.value})}
                          className="w-full bg-white/[0.03] border border-white/5 rounded-2xl p-4 text-white text-sm outline-none focus:border-[#CDFF00]"
                          placeholder="e.g. MON-FRI 9AM-6PM"
                        />
                      </div>
                    </div>
                  </div>
                </section>

                {/* 🔗 Social Connection Section */}
                <section className="space-y-8">
                  <h3 className="text-[10px] font-black text-white uppercase tracking-[0.4em] bg-white/5 py-3 px-6 rounded-full inline-block">04. Network Connect</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                       <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest flex items-center gap-2"><AtSign className="w-3 h-3" /> Instagram</p>
                       <input type="text" value={editData.instagram} onChange={e => setEditData({...editData, instagram: e.target.value})} className="w-full bg-white/[0.03] border border-white/5 rounded-xl p-3 text-white text-xs outline-none focus:border-[#CDFF00]" placeholder="@username" />
                    </div>
                    <div className="space-y-2">
                       <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest flex items-center gap-2"><Hash className="w-3 h-3" /> X / Twitter</p>
                       <input type="text" value={editData.twitter} onChange={e => setEditData({...editData, twitter: e.target.value})} className="w-full bg-white/[0.03] border border-white/5 rounded-xl p-3 text-white text-xs outline-none focus:border-[#CDFF00]" placeholder="@username" />
                    </div>
                    <div className="space-y-2">
                       <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest flex items-center gap-2"><Briefcase className="w-3 h-3" /> LinkedIn</p>
                       <input type="text" value={editData.linkedin} onChange={e => setEditData({...editData, linkedin: e.target.value})} className="w-full bg-white/[0.03] border border-white/5 rounded-xl p-3 text-white text-xs outline-none focus:border-[#CDFF00]" placeholder="Profile URL" />
                    </div>
                    <div className="sm:col-span-2 md:col-span-3 space-y-2">
                       <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest flex items-center gap-2"><Globe className="w-3 h-3" /> External Website</p>
                       <input type="text" value={editData.website} onChange={e => setEditData({...editData, website: e.target.value})} className="w-full bg-white/[0.03] border border-white/5 rounded-xl p-3 text-white text-xs outline-none focus:border-[#CDFF00]" placeholder="https://..." />
                    </div>
                  </div>
                </section>

              </div>

              {/* Modal Footer */}
              <div className="p-8 bg-black border-t border-white/5 flex items-center justify-end gap-6">
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="px-8 py-4 rounded-2xl text-gray-500 font-black uppercase tracking-widest text-[10px] hover:text-white transition-colors"
                >
                  Cancel Changes
                </button>
                <button 
                  onClick={handleUpdateProfile}
                  disabled={isUpdating}
                  className="px-12 py-5 rounded-2xl bg-[#CDFF00] text-black font-black uppercase tracking-widest text-[12px] shadow-[0_0_40px_rgba(205,255,0,0.2)] hover:scale-105 active:scale-95 transition-all flex items-center gap-3"
                >
                  {isUpdating ? 'Synchronizing...' : <>Consolidate Changes <Check className="w-5 h-5 stroke-[4px]" /></>}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
