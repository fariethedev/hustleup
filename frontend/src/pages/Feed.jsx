import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSelector } from 'react-redux';
import { selectUser, selectIsAuthenticated } from '../store/authSlice';
import { feedApi } from '../api/client';
import { Heart, MessageSquare, Image as ImageIcon, ShoppingBag, BadgeCheck, X, Film, Check, Send } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatPrice } from '../utils/constants';
import PostMediaGallery from '../components/PostMediaGallery';
import StoryBar from '../components/stories/StoryBar';
import HeroBrief from '../components/HeroBrief';
import { lockBodyScroll } from '../utils/lockBodyScroll';

const POST_FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1920&q=80';
const LISTING_FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=1920&q=80';

const extractUrl = (text) => {
  if (!text) return null;
  const match = text.match(/https?:\/\/[^\s]+/);
  return match ? match[0] : null;
};

export default function Feed() {
  const user = useSelector(selectUser);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  
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

  useEffect(() => {
    loadFeed();
  }, []);

  const loadFeed = async () => {
    setLoading(true);
    try {
      const postRes = await feedApi.getAll();
      setPosts(postRes.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
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
      setPosts([{...res.data, type: 'POST'}, ...posts]);
      setContent('');
      setMediaFiles([]);
    } catch (err) {
      alert('Failed to post');
    } finally {
      setPosting(false);
    }
  };

  const handleLike = async (postId) => {
    if (!isAuthenticated || likeInProgress[postId]) return;
    
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    setLikeInProgress({ ...likeInProgress, [postId]: true });
    
    try {
      if (post.likedByCurrentUser) {
        await feedApi.unlikePost(postId);
        setPosts(posts.map(p => 
          p.id === postId 
            ? { ...p, likedByCurrentUser: false, likesCount: Math.max(0, p.likesCount - 1) } 
            : p
        ));
      } else {
        await feedApi.likePost(postId);
        setPosts(posts.map(p => 
          p.id === postId 
            ? { ...p, likedByCurrentUser: true, likesCount: p.likesCount + 1 } 
            : p
        ));
      }
    } catch (err) {
      console.error('Failed to toggle like', err);
    } finally {
      setLikeInProgress({ ...likeInProgress, [postId]: false });
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
      setCommentInput('');
      setPosts(prev => prev.map(p => p.id === selectedPost.id ? { ...p, commentsCount: (p.commentsCount || 0) + 1 } : p));
    } catch (err) {
      alert("Failed to post comment");
    } finally {
      setCommenting(false);
    }
  };

  useEffect(() => {
    if (!selectedPost && !likersPost) return;
    const unlock = lockBodyScroll();
    return () => unlock();
  }, [selectedPost, likersPost]);

  return (
    <div className="min-h-screen bg-[#050505] font-sans pb-24">
      {/* ── HEADER ── */}
      <div className="relative overflow-hidden bg-[#0A0A0A] pt-14 pb-4 border-b-2 border-[#FF00FF]/30 shadow-[0_5px_30px_rgba(255,0,255,0.1)] mb-5">
        <div className="absolute inset-0 z-0 flex opacity-[0.15] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 10px 10px, #FF00FF 2px, transparent 0), radial-gradient(circle at 30px 30px, #00FFFF 2px, transparent 0)', backgroundSize: '40px 40px' }}></div>
        <div className="absolute inset-0 bg-gradient-to-b from-[#00FFFF]/10 via-transparent to-[#0A0A0A] z-0" />
        <div className="px-4 max-w-xl mx-auto relative z-10">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ type: 'spring' }}>
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-[#00FFFF] mb-1 block drop-shadow-[0_0_5px_#00FFFF]">Community Pulse</span>
            <h1 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tighter leading-none drop-shadow-[3px_3px_0_#FF00FF]">Creator <span className="text-[#00FFFF]">Feed</span></h1>
            <p className="text-[#FF00FF] text-xs font-bold uppercase tracking-widest mt-2 drop-shadow-[1px_1px_0_#000]">Your window into the movement.</p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4">
        <StoryBar />

        {isAuthenticated && (
          <form onSubmit={handlePost} className="bg-[#0A0A0A] border-2 border-[#00FFFF]/30 p-5 rounded-[2rem] mb-6 shadow-[0_5px_20px_rgba(0,255,255,0.1)] hover:border-[#00FFFF] transition-all relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#FF00FF]/5 rounded-full blur-3xl pointer-events-none" />
            <div className="flex gap-4 relative z-10">
              <div className="w-12 h-12 rounded-full bg-[#FF00FF] border-2 border-[#FF00FF] flex items-center justify-center text-white font-black text-lg shrink-0 shadow-[0_0_15px_#FF00FF]">
                {user?.fullName?.[0] || '?'}
              </div>
              <div className="flex-1 space-y-3">
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Share your creative vision..."
                  className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white placeholder-[#00FFFF]/50 font-bold resize-none outline-none leading-relaxed focus:border-[#FF00FF] focus:shadow-[0_0_10px_#FF00FF] transition-all"
                  rows={2}
                />
                
                {mediaFiles.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {mediaFiles.map((file, idx) => (
                      <div key={idx} className="relative shrink-0">
                        {file.type.startsWith('video/') ? (
                          <div className="w-24 h-24 rounded-xl bg-black flex items-center justify-center border-2 border-[#00FFFF]/50 group">
                            <Film className="w-8 h-8 text-[#00FFFF]" />
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-xl">
                              <span className="text-[10px] font-black text-[#00FFFF] uppercase">Video</span>
                            </div>
                          </div>
                        ) : (
                          <img 
                            src={URL.createObjectURL(file)} 
                            alt="Preview" 
                            className="w-24 h-24 rounded-xl object-cover border-2 border-[#FF00FF]/50" 
                          />
                        )}
                        <button 
                          type="button" 
                          onClick={() => removeMedia(idx)} 
                          className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-[#FF00FF] text-white flex justify-center items-center hover:scale-110 transition-transform shadow-[0_0_10px_#FF00FF] z-10"
                        >
                          <X className="w-4 h-4 font-black" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between pt-4 border-t border-white/10">
                  <label className="cursor-pointer text-[#00FFFF] hover:text-[#FF00FF] transition-colors flex items-center gap-2 bg-black px-4 py-2.5 rounded-full border border-[#00FFFF]/30 hover:border-[#FF00FF] hover:shadow-[0_0_10px_#FF00FF]">
                    <ImageIcon className="w-5 h-5" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Attach Media ({mediaFiles.length}/15)</span>
                    <input 
                      type="file" 
                      className="hidden" 
                      accept="image/*,video/*" 
                      multiple 
                      onChange={handleMediaChange} 
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={posting || (!content.trim() && mediaFiles.length === 0)}
                    className="px-8 py-3 rounded-full bg-[#FF00FF] text-white font-black uppercase tracking-widest text-[11px] shadow-[0_0_15px_#FF00FF] disabled:opacity-50 disabled:shadow-none hover:scale-105 transition-all"
                  >
                    {posting ? 'POSTING...' : 'POST'}
                  </button>
                </div>
              </div>
            </div>
          </form>
        )}

        <div className="space-y-6">
          {loading ? (
            [...Array(3)].map((_, i) => <div key={i} className="h-64 bg-gradient-to-b from-[#00FFFF]/10 to-transparent border-2 border-[#FF00FF]/20 rounded-[2rem] animate-pulse shadow-sm" />)
          ) : posts.length > 0 ? (
            posts.map((item, idx) => {
              if (item.type === 'LISTING') {
                return (
                  <motion.div key={`list-${item.id}-${idx}`} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-50px" }} transition={{ type: "spring", bounce: 0.4 }} className="bg-[#0A0A0A] border-2 border-[#00FFFF]/30 p-0 rounded-[2.5rem] group overflow-hidden transition-all hover:border-[#00FFFF] shadow-[0_5px_20px_rgba(0,255,255,0.05)] hover:shadow-[0_10px_30px_rgba(0,255,255,0.2)] relative">
                    <div className="p-5 flex items-center justify-between border-b-2 border-white/5 relative z-10 bg-black/50 backdrop-blur-md">
                      <div className="flex items-center gap-4">
                        <Link to={`/profile/${item.sellerId}`} className="relative w-12 h-12 rounded-full bg-[#FF00FF] border-2 border-[#FF00FF] shadow-[0_0_10px_#FF00FF] flex items-center justify-center text-white font-black text-lg">
                          {item.sellerName?.[0]}
                          {item.sellerVerified && <BadgeCheck className="absolute -bottom-1 -right-1 w-5 h-5 text-black bg-[#CDFF00] rounded-full" />}
                        </Link>
                        <div>
                          <Link to={`/profile/${item.sellerId}`} className="text-white font-black text-sm tracking-wide hover:text-[#00FFFF] transition-colors drop-shadow-[1px_1px_0_#FF00FF]">
                            {item.sellerName}
                          </Link>
                          <p className="text-[9px] text-[#00FFFF] font-black uppercase tracking-[0.2em] mt-0.5">Marketplace Drop</p>
                        </div>
                      </div>
                    </div>
                    
                    <Link to={`/listing/${item.id}`} className="block relative bg-black aspect-[4/5] max-h-[500px] w-full flex items-center justify-center overflow-hidden border-b-2 border-white/5">
                      <img src={item.mediaUrls?.[0] || LISTING_FALLBACK_IMAGE} alt={item.title} className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-700 opacity-90 group-hover:opacity-100" />
                      <div className="absolute top-4 right-4 px-5 py-2 bg-black/80 border-2 border-[#CDFF00] rounded-full text-[#CDFF00] font-black text-sm shadow-[0_0_15px_#CDFF00] backdrop-blur-xl">
                        {formatPrice(item.price, item.currency)}
                      </div>
                    </Link>

                    <div className="p-5 relative z-10 bg-[#0A0A0A]">
                      <h3 className="font-black text-white text-xl uppercase tracking-tighter group-hover:text-[#FF00FF] transition-colors drop-shadow-[2px_2px_0_rgba(0,0,0,1)]">{item.title}</h3>
                      <p className="text-sm text-gray-400 mt-2 line-clamp-2 leading-relaxed font-bold">{item.description}</p>
                      <Link to={`/listing/${item.id}`} className="mt-4 flex items-center justify-center gap-2 w-full py-3 rounded-full bg-transparent border-2 border-[#00FFFF] text-[10px] font-black uppercase tracking-[0.2em] text-[#00FFFF] hover:bg-[#00FFFF] hover:text-black hover:shadow-[0_0_20px_#00FFFF] transition-all">
                        CHECK IT OUT <ShoppingBag className="w-4 h-4" />
                      </Link>
                    </div>
                  </motion.div>
                );
              }

              return (
                <motion.div key={`post-${item.id}-${idx}`} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-50px" }} transition={{ type: "spring", bounce: 0.4 }} className="bg-[#0A0A0A] border-2 border-[#FF00FF]/30 p-0 rounded-[2.5rem] group overflow-hidden transition-all hover:border-[#FF00FF] shadow-[0_5px_20px_rgba(255,0,255,0.05)] hover:shadow-[0_10px_30px_rgba(255,0,255,0.2)]">
                  <div className="p-4 flex items-center gap-3 border-b-2 border-white/5 bg-black/50 backdrop-blur-md">
                    <Link to={`/profile/${item.authorId}`} className="relative w-10 h-10 rounded-full bg-[#00FFFF] border-2 border-[#00FFFF] shadow-[0_0_10px_#00FFFF] flex items-center justify-center text-black font-black text-lg">
                      {item.authorName?.[0] || '?'}
                    </Link>
                    <div>
                      <Link to={`/profile/${item.authorId}`} className="text-white font-black text-sm tracking-wide hover:text-[#FF00FF] transition-colors drop-shadow-[1px_1px_0_#00FFFF]">
                        {item.authorName}
                      </Link>
                      <p className="text-[9px] text-gray-400 font-bold uppercase tracking-[0.2em] mt-0.5">
                        {item.createdAt ? new Date(item.createdAt).toLocaleString() : 'System Log'}
                      </p>
                    </div>
                  </div>

                  {item.media && item.media.length > 0 ? (
                    <div className="border-b-2 border-white/5 relative bg-black">
                      <PostMediaGallery
                        media={item.media}
                        author={{
                          name: item.authorName,
                          avatar: item.authorAvatar,
                          id: item.authorId
                        }}
                      />
                    </div>
                  ) : (item.imageUrl || extractUrl(item.content)) && (
                    <div className="relative w-full aspect-[4/5] max-h-[600px] bg-black overflow-hidden border-b-2 border-white/5">
                      <img src={item.imageUrl || extractUrl(item.content)} alt="Post" className="w-full h-full object-contain opacity-90 hover:opacity-100 transition-opacity" />
                    </div>
                  )}

                  <div className="p-4 bg-[#0A0A0A]">
                    <div className="flex items-center gap-6 mb-2">
                      <div className={`flex items-center gap-2 ${item.likedByCurrentUser ? 'text-[#FF00FF]' : 'text-gray-500'}`}>
                        <button
                          onClick={() => handleLike(item.id)}
                          disabled={likeInProgress[item.id]}
                          className="transition-all hover:scale-110 hover:text-[#FF00FF]"
                        >
                          <Heart className={`w-6 h-6 ${item.likedByCurrentUser ? 'fill-[#FF00FF] stroke-none drop-shadow-[0_0_10px_#FF00FF]' : ''}`} />
                        </button>
                        <button
                          onClick={() => openLikers(item)}
                          className="text-sm font-black tracking-tighter hover:text-white transition-colors"
                          title="See who liked this"
                        >
                          {item.likesCount || 0}
                        </button>
                      </div>
                      <button onClick={() => openComments(item)} className="flex items-center gap-2 text-gray-500 hover:text-[#00FFFF] transition-all group">
                        <MessageSquare className="w-6 h-6 group-hover:scale-110" />
                        <span className="text-sm font-black tracking-tighter">{item.commentsCount || 0}</span>
                      </button>
                    </div>
                    {(item.likesCount || 0) > 0 && (
                      <button onClick={() => openLikers(item)} className="text-xs text-gray-400 hover:text-white transition-colors mb-3 block">
                        Liked by <b className="text-white">{item.likesCount}</b> {item.likesCount === 1 ? 'person' : 'people'} — see who
                      </button>
                    )}
                    <div className="text-sm leading-relaxed text-gray-300 font-bold">
                      <Link to={`/profile/${item.authorId}`} className="font-black text-white hover:text-[#00FFFF] mr-3 uppercase tracking-widest text-[10px] drop-shadow-[1px_1px_0_#FF00FF] bg-black px-2 py-1 rounded-md">{item.authorName || 'User'}</Link>
                      <span>{item.content}</span>
                    </div>
                    <button onClick={() => openComments(item)} className="text-[10px] text-[#00FFFF] font-black uppercase tracking-[0.3em] mt-4 hover:text-white transition-colors py-2 border-t-2 border-white/5 w-full text-left flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" /> {item.commentsCount > 0 ? `VIEW ALL ${item.commentsCount} COMMENTS` : 'JOIN THE CONVERSATION'}
                    </button>
                  </div>
                </motion.div>
              );
            })
          ) : (
            <div className="text-center py-32 bg-[#0A0A0A] border-2 border-dashed border-[#00FFFF]/30 rounded-[3rem] shadow-[0_0_30px_rgba(0,255,255,0.1)]">
              <ImageIcon className="w-20 h-20 mx-auto opacity-50 mb-6 text-[#00FFFF] drop-shadow-[0_0_15px_#00FFFF]" />
              <h3 className="text-3xl font-black text-white mb-3 uppercase tracking-tighter drop-shadow-[2px_2px_0_#FF00FF]">Timeline Empty</h3>
              <p className="text-[10px] font-black text-[#CDFF00] uppercase tracking-[0.4em]">Be the first to post</p>
            </div>
          )}
        </div>

        {/* Global Comments Modal */}
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
                initial={{ opacity: 0, scale: 0.9, y: 50 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 50 }}
                className="relative w-full max-w-2xl bg-[#0A0A0A] border-4 border-[#FF00FF] rounded-[2.5rem] shadow-[0_0_50px_rgba(255,0,255,0.3)] flex flex-col max-h-[85vh] overflow-hidden"
              >
                {/* Modal Header */}
                <div className="p-6 border-b-2 border-white/10 bg-black flex items-center justify-between">
                  <div>
                    <h3 className="text-[#00FFFF] font-black uppercase tracking-[0.3em] text-sm flex items-center gap-3 drop-shadow-[0_0_5px_#00FFFF]">
                      <MessageSquare className="w-5 h-5" /> COMMENTS
                    </h3>
                    <p className="text-[9px] text-[#FF00FF] font-black uppercase tracking-widest mt-1">
                      CREATOR: {selectedPost.authorName}
                    </p>
                  </div>
                  <button onClick={() => setSelectedPost(null)} className="p-2 bg-white/10 hover:bg-[#FF00FF] rounded-full transition-colors text-white group">
                    <X className="w-6 h-6 group-hover:rotate-90 transition-transform" />
                  </button>
                </div>

                {/* Comments List */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {commentsLoading ? (
                    <div className="space-y-4">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="flex gap-4 animate-pulse">
                          <div className="w-12 h-12 rounded-full bg-[#00FFFF]/20 border border-[#00FFFF]/50" />
                          <div className="flex-1 space-y-2">
                            <div className="h-3 w-32 bg-[#FF00FF]/20 rounded" />
                            <div className="h-12 bg-white/5 rounded-xl border border-white/10" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : comments.length === 0 ? (
                    <div className="py-24 text-center flex flex-col items-center gap-4">
                      <div className="w-20 h-20 rounded-full bg-black border-2 border-[#00FFFF]/30 flex items-center justify-center shadow-[0_0_15px_rgba(0,255,255,0.2)]">
                        <MessageSquare className="w-10 h-10 text-[#00FFFF]/50" />
                      </div>
                      <p className="text-[10px] font-black text-[#FF00FF] uppercase tracking-[0.4em]">NO COMMENTS YET</p>
                    </div>
                  ) : (
                    comments.map((c, idx) => (
                      <motion.div 
                        key={c.id || idx}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex gap-4 items-start group"
                      >
                        <Link to={`/profile/${c.authorId}`} className="w-12 h-12 rounded-full bg-black border-2 border-[#00FFFF] flex items-center justify-center text-[#00FFFF] font-black text-sm shrink-0 shadow-[0_0_10px_rgba(0,255,255,0.3)] hover:scale-110 transition-transform">
                          {c.authorName?.[0]}
                        </Link>
                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-4 mb-2">
                            <Link to={`/profile/${c.authorId}`} className="text-white font-black text-[10px] uppercase tracking-widest hover:text-[#FF00FF] transition-colors drop-shadow-[1px_1px_0_#00FFFF]">{c.authorName}</Link>
                            <span className="text-[8px] text-[#CDFF00] font-black uppercase tracking-[0.2em]">{new Date(c.createdAt || Date.now()).toLocaleTimeString()}</span>
                          </div>
                          <div className="bg-black/80 border border-white/20 rounded-2xl rounded-tl-none p-5 text-white font-bold text-sm leading-relaxed backdrop-blur-sm shadow-[0_4px_10px_rgba(0,0,0,0.5)]">
                            {c.content}
                          </div>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>

                {/* Comment Input */}
                {isAuthenticated ? (
                  <div className="p-6 bg-black border-t-2 border-[#FF00FF]/50">
                    <div className="relative group">
                      <input 
                        type="text" 
                        placeholder="ADD A COMMENT..." 
                        value={commentInput}
                        onChange={(e) => setCommentInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && submitComment()}
                        className="w-full bg-[#0A0A0A] border-2 border-[#00FFFF]/30 rounded-full px-8 py-5 text-sm font-black text-white placeholder-[#00FFFF]/40 outline-none focus:border-[#00FFFF] focus:shadow-[0_0_15px_rgba(0,255,255,0.3)] transition-all pr-20 uppercase tracking-widest"
                      />
                      <button 
                        onClick={submitComment}
                        disabled={commenting || !commentInput.trim()}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-[#FF00FF] text-white flex items-center justify-center hover:scale-110 active:scale-95 disabled:opacity-30 disabled:hover:scale-100 transition-all shadow-[0_0_15px_#FF00FF]"
                      >
                        {commenting ? (
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Send className="w-5 h-5 -ml-1 mt-1" />
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center bg-black border-t-2 border-[#FF00FF]/50">
                    <Link to="/login" className="text-[#00FFFF] font-black uppercase tracking-[0.3em] text-[11px] hover:text-[#FF00FF] transition-colors drop-shadow-[0_0_5px_#00FFFF]">SIGN IN TO COMMENT</Link>
                  </div>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Likers Modal — exactly who liked a post */}
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
                className="relative w-full max-w-sm bg-[#0A0A0A] border-2 border-[#FF00FF]/60 rounded-3xl shadow-[0_0_50px_rgba(255,0,255,0.2)] flex flex-col max-h-[70vh] overflow-hidden"
              >
                <div className="px-5 py-4 border-b border-white/10 bg-black flex items-center justify-between shrink-0">
                  <h3 className="text-white font-black text-sm flex items-center gap-2">
                    <Heart className="w-4 h-4 text-[#FF00FF] fill-[#FF00FF]" />
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
                    <p className="py-12 text-center text-xs text-gray-500 font-bold uppercase tracking-widest">No likes yet</p>
                  ) : (
                    likers.map((u) => (
                      <Link
                        key={u.id}
                        to={`/profile/${u.id}`}
                        onClick={() => setLikersPost(null)}
                        className="flex items-center gap-3 px-5 py-2.5 hover:bg-white/5 transition-colors"
                      >
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-black border border-[#FF00FF]/40 flex items-center justify-center shrink-0">
                          {u.avatarUrl
                            ? <img src={u.avatarUrl} className="w-full h-full object-cover" />
                            : <span className="text-[#FF00FF] font-black text-sm">{u.name?.[0] || '?'}</span>}
                        </div>
                        <span className="text-sm font-bold text-white flex items-center gap-1.5 min-w-0">
                          <span className="truncate">{u.name}</span>
                          {u.verified && <BadgeCheck className="w-3.5 h-3.5 text-[#00FFFF] shrink-0" />}
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
    </div>
  );
}
