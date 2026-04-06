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

  const [likeInProgress, setLikeInProgress] = useState({});

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
    if (!selectedPost) return;
    const unlock = lockBodyScroll();
    return () => unlock();
  }, [selectedPost]);

  return (
    <div className="max-w-4xl mx-auto px-4 pb-24">
      <HeroBrief 
        pillText="REAL-TIME SYNDICATION"
        title="HUSTLE FLOW"
        subtitle={"Your window into the global pulse.\nEngagement, interaction, and growth in every scroll."}
      />
      <StoryBar />
      


      {isAuthenticated && (
        <form onSubmit={handlePost} className="glass bg-black/40 border border-white/10 p-6 rounded-3xl mb-10 shadow-lg hover:border-white/10 transition-colors">
          <div className="flex gap-4">
            <div className="w-12 h-12 rounded-full bg-[#CDFF00] border border-[#CDFF00] flex items-center justify-center text-black font-bold text-lg shrink-0">
              {user?.fullName?.[0] || '?'}
            </div>
            <div className="flex-1 space-y-4">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="What's your next move?"
                className="w-full bg-transparent text-white placeholder-gray-400 font-medium resize-none outline-none leading-relaxed"
                rows={3}
              />
              
              {mediaFiles.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  {mediaFiles.map((file, idx) => (
                    <div key={idx} className="relative shrink-0">
                      {file.type.startsWith('video/') ? (
                        <div className="w-24 h-24 rounded-xl bg-[#121212] flex items-center justify-center border border-white/10 group">
                          <Film className="w-8 h-8 text-white/50" />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-xl">
                            <span className="text-[10px] font-bold text-white uppercase">Video</span>
                          </div>
                        </div>
                      ) : (
                        <img 
                          src={URL.createObjectURL(file)} 
                          alt="Preview" 
                          className="w-24 h-24 rounded-xl object-cover border border-white/10" 
                        />
                      )}
                      <button 
                        type="button" 
                        onClick={() => removeMedia(idx)} 
                        className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex justify-center items-center hover:bg-red-600 transition-colors shadow-lg z-10"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-white/5">
                <label className="cursor-pointer text-gray-500 hover:text-[#CDFF00] transition-colors flex items-center gap-2 bg-[#121212] px-3 py-2 rounded-xl border border-white/5 hover:border-[#CDFF00]">
                  <ImageIcon className="w-5 h-5" />
                  <span className="text-xs font-bold uppercase tracking-widest">Add Media ({mediaFiles.length}/15)</span>
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
                  className="px-6 py-2.5 rounded-xl bg-[#CDFF00] text-black font-bold uppercase tracking-widest text-xs hover:bg-[#CDFF00] disabled:opacity-50 transition-all shadow-md shadow-[#CDFF00]/20"
                >
                  {posting ? 'Posting...' : 'Share'}
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      <div className="space-y-10">
        {loading ? (
          [...Array(3)].map((_, i) => <div key={i} className="h-64 glass bg-black/40 border border-white/10 rounded-3xl animate-pulse shadow-sm" />)
        ) : posts.length > 0 ? (
          posts.map((item, idx) => {
            if (item.type === 'LISTING') {
              return (
                <motion.div key={`list-${item.id}-${idx}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass bg-black/40 border border-white/10 p-0 rounded-3xl group overflow-hidden transition-all hover:border-white/20 shadow-xl">
                  <div className="p-4 flex items-center justify-between border-b border-white/5">
                    <div className="flex items-center gap-3">
                      <Link to={`/profile/${item.sellerId}`} className="relative w-10 h-10 rounded-full bg-black border border-[#CDFF00]/20 flex items-center justify-center text-[#CDFF00] font-black tracking-tighter">
                        {item.sellerName?.[0]}
                        {item.sellerVerified && <BadgeCheck className="absolute -bottom-1 -right-1 w-4 h-4 text-black bg-[#CDFF00] rounded-full" />}
                      </Link>
                      <div>
                        <Link to={`/profile/${item.sellerId}`} className="text-white font-bold tracking-wide hover:text-[#CDFF00] transition-colors flex items-center gap-1">
                          {item.sellerName}
                        </Link>
                        <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Marketplace Drop</p>
                      </div>
                    </div>
                  </div>
                  
                  <Link to={`/listing/${item.id}`} className="block relative bg-[#121212] aspect-square max-h-[500px] w-full flex items-center justify-center overflow-hidden border-b border-white/5">
                    <img src={item.mediaUrls?.[0] || LISTING_FALLBACK_IMAGE} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                    <div className="absolute top-4 right-4 px-4 py-2 glass bg-black/60 border border-[#CDFF00]/20 rounded-full text-[#CDFF00] font-black text-sm shadow-xl backdrop-blur-xl">
                      {formatPrice(item.price, item.currency)}
                    </div>
                  </Link>
                  
                  <div className="p-6">
                    <h3 className="font-heading font-black text-white text-xl uppercase tracking-tight group-hover:text-[#CDFF00] transition-colors">{item.title}</h3>
                    <p className="text-sm text-gray-400 mt-2 line-clamp-2 leading-relaxed">{item.description}</p>
                    <Link to={`/listing/${item.id}`} className="mt-6 flex items-center justify-center gap-2 w-full py-4 rounded-2xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-[0.2em] text-white hover:bg-[#CDFF00] hover:text-black hover:border-transparent transition-all">
                      Secure this drop <ShoppingBag className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </motion.div>
              );
            }

            return (
              <motion.div key={`post-${item.id}-${idx}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass bg-black/40 border border-white/10 p-0 rounded-3xl group overflow-hidden transition-all hover:border-white/20 shadow-xl">
                <div className="p-4 flex items-center gap-3 border-b border-white/5">
                  <Link to={`/profile/${item.authorId}`} className="relative w-10 h-10 rounded-full bg-black border border-[#CDFF00]/20 flex items-center justify-center text-[#CDFF00] font-black tracking-tighter">
                    {item.authorName?.[0] || '?'}
                  </Link>
                  <div>
                    <Link to={`/profile/${item.authorId}`} className="text-white font-bold tracking-wide hover:text-[#CDFF00] transition-colors">
                      {item.authorName}
                    </Link>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">
                      {item.createdAt ? new Date(item.createdAt).toLocaleString() : 'Just now'}
                    </p>
                  </div>
                </div>
                
                {item.media && item.media.length > 0 ? (
                  <PostMediaGallery 
                    media={item.media} 
                    author={{ 
                      name: item.authorName, 
                      avatar: item.authorAvatar,
                      id: item.authorId 
                    }} 
                  />
                ) : (item.imageUrl || extractUrl(item.content)) && (
                  <div className="relative w-full aspect-[4/5] bg-black overflow-hidden">
                    <img src={item.imageUrl || extractUrl(item.content)} alt="Post" className="w-full h-full object-cover" />
                  </div>
                )}
                
                <div className="p-6">
                  <div className="flex items-center gap-6 mb-4">
                    <button 
                      onClick={() => handleLike(item.id)}
                      disabled={likeInProgress[item.id]}
                      className={`flex items-center gap-2.5 transition-all group ${item.likedByCurrentUser ? 'text-[#CDFF00]' : 'text-gray-500 hover:text-[#CDFF00]'}`}
                    >
                      <Heart className={`w-7 h-7 transition-all group-hover:scale-110 ${item.likedByCurrentUser ? 'fill-[#CDFF00] stroke-none' : ''}`} />
                      <span className="text-sm font-black tracking-tighter">{item.likesCount || 0}</span>
                    </button>
                    <button onClick={() => openComments(item)} className="flex items-center gap-2.5 text-gray-500 hover:text-[#CDFF00] transition-all group">
                      <MessageSquare className="w-7 h-7 group-hover:scale-110" />
                      <span className="text-sm font-black tracking-tighter">{item.commentsCount || 0}</span>
                    </button>
                  </div>
                  <div className="text-sm leading-relaxed text-gray-300">
                    <Link to={`/profile/${item.authorId}`} className="font-bold text-white hover:text-[#CDFF00] mr-2 uppercase tracking-wide text-xs">{item.authorName || 'User'}</Link>
                    <span className="font-medium">{item.content}</span>
                  </div>
                  <button onClick={() => openComments(item)} className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em] mt-6 hover:text-[#CDFF00] transition-colors py-2 border-t border-white/5 w-full text-left">
                    {item.commentsCount > 0 ? `Show all ${item.commentsCount} comments` : 'Leave a comment'}
                  </button>
                </div>
              </motion.div>
            );
          })
        ) : (
          <div className="text-center py-24 glass bg-black/40 border border-white/10 rounded-[3rem] shadow-sm">
            <ImageIcon className="w-16 h-16 mx-auto opacity-30 mb-6 text-[#CDFF00]" />
            <h3 className="text-2xl font-heading font-black text-white mb-2 uppercase tracking-tight">Quiet on the front</h3>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em]">Ignite your own hustle story</p>
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
              className="absolute inset-0 bg-black/95 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-[#0a0a0a] border border-white/10 rounded-[2.5rem] shadow-[0_0_80px_rgba(205,255,0,0.1)] flex flex-col max-h-[85vh] overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <div>
                  <h3 className="text-white font-black uppercase tracking-widest text-sm flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-[#CDFF00]" /> Conversations
                  </h3>
                  <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mt-1">
                    On {selectedPost.authorName}'s Drop
                  </p>
                </div>
                <button onClick={() => setSelectedPost(null)} className="p-3 hover:bg-white/5 rounded-xl transition-colors">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* Comments List */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {commentsLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="flex gap-4 animate-pulse">
                        <div className="w-10 h-10 rounded-full bg-white/5" />
                        <div className="flex-1 space-y-2">
                          <div className="h-3 w-24 bg-white/5 rounded" />
                          <div className="h-10 bg-white/5 rounded-xl" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : comments.length === 0 ? (
                  <div className="py-20 text-center flex flex-col items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                      <MessageSquare className="w-8 h-8 text-gray-700" />
                    </div>
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">No moves reported here yet.</p>
                  </div>
                ) : (
                  comments.map((c, idx) => (
                    <motion.div 
                      key={c.id || idx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex gap-4 items-start group"
                    >
                      <Link to={`/profile/${c.authorId}`} className="w-10 h-10 rounded-full bg-black border border-white/10 flex items-center justify-center text-[#CDFF00] font-black text-xs shrink-0 bg-white/[0.02]">
                        {c.authorName?.[0]}
                      </Link>
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-4 mb-1">
                          <Link to={`/profile/${c.authorId}`} className="text-white font-black text-[10px] uppercase tracking-wider hover:text-[#CDFF00] transition-colors">{c.authorName}</Link>
                          <span className="text-[8px] text-gray-600 font-bold uppercase tracking-widest">{new Date(c.createdAt || Date.now()).toLocaleTimeString()}</span>
                        </div>
                        <div className="bg-white/5 border border-white/5 rounded-2xl rounded-tl-none p-4 text-gray-300 text-sm leading-relaxed">
                          {c.content}
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>

              {/* Comment Input */}
              {isAuthenticated ? (
                <div className="p-6 bg-black/40 border-t border-white/5">
                  <div className="relative group">
                    <input 
                      type="text" 
                      placeholder="Contribute to the conversation..." 
                      value={commentInput}
                      onChange={(e) => setCommentInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && submitComment()}
                      className="w-full bg-[#121212] border border-white/10 rounded-2xl px-6 py-5 text-sm text-white placeholder-gray-500 outline-none focus:border-[#CDFF00] transition-all pr-16 shadow-2xl"
                    />
                    <button 
                      onClick={submitComment}
                      disabled={commenting || !commentInput.trim()}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-3 rounded-xl bg-[#CDFF00] text-black hover:scale-105 active:scale-95 disabled:opacity-30 disabled:hover:scale-100 transition-all shadow-xl"
                    >
                      {commenting ? (
                        <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Send className="w-5 h-5 stroke-[2.5px]" />
                      )}
                    </button>
                  </div>
                  <p className="text-[8px] text-gray-600 font-black uppercase tracking-[0.3em] mt-4 text-center">Press Enter to drop your thought</p>
                </div>
              ) : (
                <div className="p-8 text-center bg-black/40 border-t border-white/5">
                  <Link to="/login" className="text-[#CDFF00] font-black uppercase tracking-widest text-[10px] hover:underline underline-offset-4">Authenticate to contribute</Link>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
