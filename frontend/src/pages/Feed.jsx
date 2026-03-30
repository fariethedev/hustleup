import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSelector } from 'react-redux';
import { selectUser, selectIsAuthenticated } from '../store/authSlice';
import { feedApi, listingsApi } from '../api/client';
import { Heart, MessageSquare, Image as ImageIcon, ShoppingBag, BadgeCheck, X, Film } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatPrice } from '../utils/constants';
import PostMediaGallery from '../components/PostMediaGallery';
import StoryBar from '../components/stories/StoryBar';

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

  const [expandedComments, setExpandedComments] = useState({});
  const [commentsData, setCommentsData] = useState({});
  const [commentInputs, setCommentInputs] = useState({});
  const [commenting, setCommenting] = useState(false);
  const [likeInProgress, setLikeInProgress] = useState({});

  useEffect(() => {
    loadFeed();
  }, []);

  const loadFeed = async () => {
    setLoading(true);
    try {
      const [postRes, listingRes] = await Promise.all([
        feedApi.getAll(),
        listingsApi.browse({})
      ]);
      
      const mixedFeed = [];
      const postsData = postRes.data || [];
      const listingsData = listingRes.data || [];
      
      let pIdx = 0, lIdx = 0;
      while (pIdx < postsData.length || lIdx < listingsData.length) {
        if (pIdx < postsData.length) mixedFeed.push({ ...postsData[pIdx++], type: 'POST' });
        if (pIdx < postsData.length) mixedFeed.push({ ...postsData[pIdx++], type: 'POST' });
        if (pIdx < postsData.length) mixedFeed.push({ ...postsData[pIdx++], type: 'POST' });
        if (lIdx < listingsData.length) mixedFeed.push({ ...listingsData[lIdx++], type: 'LISTING' });
      }
      
      setPosts(mixedFeed);
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
      setPosts([res.data, ...posts]);
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

  const toggleComments = async (postId) => {
    if (expandedComments[postId]) {
      setExpandedComments({ ...expandedComments, [postId]: false });
      return;
    }
    setExpandedComments({ ...expandedComments, [postId]: true });
    try {
      const res = await feedApi.getComments(postId);
      setCommentsData({ ...commentsData, [postId]: res.data });
    } catch {
      setCommentsData({ ...commentsData, [postId]: [] });
    }
  };

  const submitComment = async (postId) => {
    const text = commentInputs[postId];
    if (!text || !text.trim()) return;
    setCommenting(true);
    try {
      const res = await feedApi.addComment(postId, text);
      const updatedList = [...(commentsData[postId] || []), res.data];
      setCommentsData({ ...commentsData, [postId]: updatedList });
      setCommentInputs({ ...commentInputs, [postId]: '' });
      setPosts(posts.map(p => p.id === postId ? { ...p, commentsCount: p.commentsCount + 1 } : p));
    } catch (err) {
      alert("Failed to add comment.");
    } finally {
      setCommenting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <StoryBar />
      
      <div className="relative w-full h-48 sm:h-64 rounded-3xl overflow-hidden mt-10 mb-10 border border-white/10 group cursor-pointer block shadow-sm">
        <img src="https://images.unsplash.com/photo-1499951360447-b19be8fe80f5?w=1920&q=80" alt="Featured Promo" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 via-gray-900/30 to-transparent pointer-events-none" />
        <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between pointer-events-none">
          <div>
            <div className="inline-flex items-center px-3 py-1 bg-[#CDFF00] text-black text-[10px] font-black uppercase tracking-widest rounded mb-3 shadow-sm">Featured Creator</div>
            <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-white uppercase tracking-tight drop-shadow-md">Elite Dev Services</h2>
            <p className="text-gray-200 text-sm font-medium mt-1 max-w-sm drop-shadow">Get custom platforms, AI integration, and sleek designs built in 48 hours.</p>
          </div>
          <div className="hidden sm:flex items-center gap-2 px-6 py-2.5 glass bg-black/40 border border-white/10 text-white font-bold text-xs uppercase tracking-widest rounded-full shadow-lg group-hover:bg-[#CDFF00] group-hover:text-white group-hover:border-[#CDFF00] transition-all">
            Explore Shop
          </div>
        </div>
      </div>

      {isAuthenticated && (
        <form onSubmit={handlePost} className="glass bg-black/40 border border-white/10 border border-white/5 p-6 rounded-3xl mb-10 shadow-lg shadow-black/5 hover:border-white/10 transition-colors">
          <div className="flex gap-4">
            <div className="w-12 h-12 rounded-full bg-[#CDFF00] border border-[#CDFF00] flex items-center justify-center text-[#CDFF00] font-bold text-lg shrink-0">
              {user.fullName[0]}
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
                  className="px-6 py-2.5 rounded-xl bg-[#CDFF00] text-[#050505] font-bold uppercase tracking-widest text-xs hover:bg-[#CDFF00] disabled:opacity-50 transition-all shadow-md shadow-[#CDFF00]/20"
                >
                  {posting ? 'Posting...' : 'Share'}
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      <div className="space-y-6">
        {loading ? (
          [...Array(3)].map((_, i) => <div key={i} className="h-64 glass bg-black/40 border border-white/10 rounded-3xl border border-white/5 animate-pulse shadow-sm" />)
        ) : posts.length > 0 ? (
          posts.map((item, idx) => {
            if (item.type === 'LISTING') {
              return (
                <motion.div key={`list-${item.id}-${idx}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass bg-black/40 border border-white/10 border border-white/5 p-0 rounded-3xl group overflow-hidden transition-all hover:border-gray-300 hover:shadow-xl hover:shadow-black/5">
                  <div className="p-4 flex items-center justify-between border-b border-gray-50">
                    <div className="flex items-center gap-3">
                      <Link to={`/profile/${item.sellerId}`} className="relative w-10 h-10 rounded-full bg-[#CDFF00] flex items-center justify-center text-[#CDFF00] border border-[#CDFF00] font-bold group-hover:bg-[#CDFF00] transition-all">
                        {item.sellerName?.[0]}
                        {item.sellerVerified && <BadgeCheck className="absolute -bottom-1 -right-1 w-4 h-4 text-white bg-[#CDFF00] rounded-full" />}
                      </Link>
                      <div>
                        <Link to={`/profile/${item.sellerId}`} className="text-white font-bold tracking-wide hover:text-[#CDFF00] transition-colors flex items-center gap-1">
                          {item.sellerName}
                        </Link>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Sponsored Product</p>
                      </div>
                    </div>
                    <Link to={`/listing/${item.id}`} className="p-2 bg-[#121212] rounded-full hover:bg-[#CDFF00] hover:text-[#CDFF00] transition-colors text-gray-500 border border-white/5">
                      <ShoppingBag className="w-5 h-5" />
                    </Link>
                  </div>
                  
                  <Link to={`/listing/${item.id}`} className="block relative bg-[#121212] aspect-square max-h-[500px] w-full flex items-center justify-center overflow-hidden border-b border-gray-50">
                    <img src={item.mediaUrls?.[0] || LISTING_FALLBACK_IMAGE} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    <div className="absolute top-4 right-4 px-3 py-1.5 glass bg-black/40 border border-white/10 border border-white/10 rounded-full text-white font-black shadow-lg">
                      {formatPrice(item.price, item.currency)}
                    </div>
                  </Link>
                  
                  <div className="p-5">
                    <div className="flex items-center gap-4 mb-3">
                      <button className="text-gray-500 hover:text-[#CDFF00] transition-colors flex items-center gap-1.5 group">
                        <Heart className="w-6 h-6 group-hover:scale-110 transition-transform" />
                        <span className="text-xs font-bold">12</span>
                      </button>
                      <Link to={`/listing/${item.id}`} className="text-gray-500 hover:text-[#CDFF00] transition-colors"><MessageSquare className="w-6 h-6" /></Link>
                    </div>
                    <Link to={`/listing/${item.id}`} className="font-bold text-white text-lg hover:text-[#CDFF00] transition-colors line-clamp-1">{item.title}</Link>
                    <p className="text-sm text-gray-500 mt-2 line-clamp-2 leading-relaxed">{item.description}</p>
                    <Link to={`/listing/${item.id}`} className="inline-block px-4 py-2 mt-4 rounded-lg bg-[#121212] text-xs text-gray-600 font-bold uppercase tracking-widest hover:bg-[#1E1E1E] hover:text-white transition-colors border border-white/10">View fully & buy</Link>
                  </div>
                </motion.div>
              );
            }

            return (
              <motion.div key={`post-${item.id}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass bg-black/40 border border-white/10 border border-white/5 p-0 rounded-3xl group overflow-hidden transition-all hover:border-white/10 shadow-sm hover:shadow-xl hover:shadow-black/5">
                <div className="p-4 flex items-center gap-3 border-b border-gray-50">
                  <Link to={`/profile/${item.authorId}`} className="relative w-10 h-10 rounded-full bg-[#CDFF00] flex items-center justify-center text-[#CDFF00] border border-[#CDFF00] group-hover:bg-[#CDFF00] transition-all font-bold">
                    {item.authorName[0]}
                  </Link>
                  <div>
                    <Link to={`/profile/${item.authorId}`} className="text-white font-bold tracking-wide hover:text-[#CDFF00] transition-colors">
                      {item.authorName}
                    </Link>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                      {new Date(item.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                
                {item.media && item.media.length > 0 ? (
                  <PostMediaGallery media={item.media} />
                ) : (item.imageUrl || extractUrl(item.content)) && (
                  <div className="bg-[#121212] aspect-square max-h-[500px] w-full flex items-center justify-center overflow-hidden border-b border-gray-50">
                    <img src={item.imageUrl || extractUrl(item.content)} alt="Post" className="w-full h-full object-cover" />
                  </div>
                )}
                
                <div className="p-5">
                  <div className="flex items-center gap-4 mb-3">
                    <button 
                      onClick={() => handleLike(item.id)}
                      disabled={likeInProgress[item.id]}
                      className={`flex items-center gap-1.5 transition-all group ${item.likedByCurrentUser ? 'text-[#CDFF00]' : 'text-gray-500 hover:text-[#CDFF00]'}`}
                    >
                      <Heart 
                        className={`w-6 h-6 transition-all group-hover:scale-110 ${item.likedByCurrentUser ? 'fill-[#CDFF00]' : ''}`} 
                      />
                      <span className="text-xs font-black tracking-tighter">{item.likesCount || 0}</span>
                    </button>
                    <button onClick={() => toggleComments(item.id)} className="text-gray-500 hover:text-[#CDFF00] transition-colors group">
                      <MessageSquare className="w-6 h-6 group-hover:scale-110 transition-transform" />
                    </button>
                  </div>
                  <div className="text-sm leading-relaxed text-gray-300">
                    <Link to={`/profile/${item.authorId}`} className="font-bold text-white hover:text-[#CDFF00] mr-2">{item.authorName}</Link>
                    <span>{item.content}</span>
                  </div>
                  {item.commentsCount > 0 && !expandedComments[item.id] && (
                    <button onClick={() => toggleComments(item.id)} className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-4 hover:text-gray-600 transition-colors bg-[#121212] px-3 py-1.5 rounded-full">
                      View all {item.commentsCount} comments
                    </button>
                  )}
                  {expandedComments[item.id] && (
                    <div className="mt-4 border-t border-white/5 pt-4 space-y-3">
                      {(commentsData[item.id] || []).map((c) => (
                        <div key={c.id} className="text-sm">
                          <Link to={`/profile/${c.authorId}`} className="font-bold text-white hover:text-[#CDFF00] mr-2">{c.authorName}</Link>
                          <span className="text-gray-300 break-words">{c.content}</span>
                        </div>
                      ))}
                      {isAuthenticated && (
                        <div className="flex items-center gap-2 mt-2">
                          <input 
                            type="text" 
                            placeholder="Add a comment..." 
                            value={commentInputs[item.id] || ''} 
                            onChange={(e) => setCommentInputs({...commentInputs, [item.id]: e.target.value})}
                            onKeyDown={(e) => e.key === 'Enter' && submitComment(item.id)}
                            className="flex-1 bg-[#121212] rounded-full px-4 py-2 text-sm outline-none border border-transparent focus:border-[#CDFF00] focus:glass bg-black/40 border border-white/10 transition-all w-full"
                          />
                          <button onClick={() => submitComment(item.id)} disabled={commenting || !commentInputs[item.id]?.trim()} className="text-[#CDFF00] font-bold text-sm disabled:opacity-50 px-2">Post</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })
        ) : (
          <div className="text-center py-20 text-gray-500 w-full glass bg-black/40 border border-white/10 rounded-3xl border border-white/5 shadow-sm">
            <ImageIcon className="w-12 h-12 mx-auto opacity-30 mb-4 text-[#CDFF00]" />
            <h3 className="text-xl font-heading font-extrabold text-white mb-2 uppercase tracking-wide">No Posts Yet</h3>
            <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Be the first to share something!</p>
          </div>
        )}
      </div>
    </div>
  );
}

