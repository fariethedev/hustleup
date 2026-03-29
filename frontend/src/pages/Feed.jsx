import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSelector } from 'react-redux';
import { selectUser, selectIsAuthenticated } from '../store/authSlice';
import { feedApi, listingsApi } from '../api/client';
import { Heart, MessageSquare, Image as ImageIcon, ShoppingBag, BadgeCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatPrice } from '../utils/constants';

export default function Feed() {
  const user = useSelector(selectUser);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Post creation state
  const [content, setContent] = useState('');
  const [image, setImage] = useState(null);
  const [posting, setPosting] = useState(false);

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
      
      // Interleave 1 listing for every 3 posts (approximate)
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

  const handlePost = async (e) => {
    e.preventDefault();
    if (!content.trim() && !image) return;
    if (!isAuthenticated) return;
    setPosting(true);
    
    try {
      const formData = new FormData();
      formData.append('content', content);
      formData.append('authorName', user.fullName);
      if (image) formData.append('image', image);
      
      const res = await feedApi.createPost(formData);
      setPosts([res.data, ...posts]);
      setContent('');
      setImage(null);
    } catch (err) {
      alert('Failed to post');
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 mt-10">
      <div className="relative w-full h-48 sm:h-64 rounded-3xl overflow-hidden mb-10 border border-white/10 group cursor-pointer block">
        <img src="http://localhost:8080/uploads/cyberpunk.png" alt="Featured Promo" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent pointer-events-none" />
        <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between pointer-events-none">
          <div>
            <div className="inline-flex items-center px-3 py-1 bg-[#CDFF00] text-black text-[10px] font-black uppercase tracking-widest rounded mb-3 shadow-[0_0_15px_rgba(205,255,0,0.3)]">Featured Creator</div>
            <h2 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight drop-shadow-md">Elite Dev Services</h2>
            <p className="text-gray-300 text-sm font-medium mt-1 max-w-sm drop-shadow">Get custom platforms, AI integration, and sleek designs built in 48 hours.</p>
          </div>
          <div className="hidden sm:flex items-center gap-2 px-6 py-2.5 bg-white/10 backdrop-blur-md border border-white/20 text-white font-black text-xs uppercase tracking-widest rounded-full group-hover:bg-[#CDFF00] group-hover:text-black group-hover:border-[#CDFF00] transition-all">
            Explore Shop
          </div>
        </div>
      </div>

      {isAuthenticated && (
        <form onSubmit={handlePost} className="glass border border-white/5 p-6 rounded-3xl mb-10 shadow-lg">
          <div className="flex gap-4">
            <div className="w-12 h-12 rounded-full bg-black border border-white/10 flex items-center justify-center text-white font-black text-lg shrink-0">
              {user.fullName[0]}
            </div>
            <div className="flex-1 space-y-4">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="What's your next move?"
                className="w-full bg-transparent text-white placeholder-gray-500 font-medium resize-none outline-none leading-relaxed"
                rows={3}
              />
              
              {image && (
                <div className="relative">
                  <img src={URL.createObjectURL(image)} alt="Preview" className="h-48 rounded-xl object-cover" />
                  <button type="button" onClick={() => setImage(null)} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white flex justify-center items-center">
                    &times;
                  </button>
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-white/5">
                <label className="cursor-pointer text-gray-500 hover:text-[#CDFF00] transition-colors flex items-center gap-2">
                  <ImageIcon className="w-5 h-5" />
                  <span className="text-xs font-bold uppercase tracking-widest">Photo</span>
                  <input type="file" className="hidden" accept="image/*" onChange={(e) => setImage(e.target.files[0])} />
                </label>
                <button
                  type="submit"
                  disabled={posting || (!content.trim() && !image)}
                  className="px-6 py-2 rounded-full bg-[#CDFF00] text-black font-black uppercase tracking-widest text-xs hover:bg-[#E0FF4D] disabled:opacity-50 transition-all shadow-[0_0_15px_rgba(205,255,0,0.1)]"
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
          [...Array(3)].map((_, i) => <div key={i} className="h-64 glass rounded-3xl border border-white/5 animate-pulse" />)
        ) : posts.length > 0 ? (
          posts.map((item, idx) => {
            if (item.type === 'LISTING') {
              // Instagram "Sponsored" or Product layout
              return (
                <motion.div key={`list-${item.id}-${idx}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass border border-white/5 p-0 rounded-3xl group overflow-hidden transition-all hover:border-[#CDFF00]/40">
                  <div className="p-4 flex items-center justify-between border-b border-white/5">
                    <div className="flex items-center gap-3">
                      <Link to={`/profile/${item.sellerId}`} className="relative w-10 h-10 rounded-full bg-black flex items-center justify-center text-[#CDFF00] border border-[#CDFF00] font-black group-hover:bg-[#CDFF00] group-hover:text-black transition-all">
                        {item.sellerName?.[0]}
                        {item.sellerVerified && <BadgeCheck className="absolute -bottom-1 -right-1 w-4 h-4 text-[#CDFF00] bg-black rounded-full" />}
                      </Link>
                      <div>
                        <Link to={`/profile/${item.sellerId}`} className="text-white font-bold tracking-wide hover:text-[#CDFF00] transition-colors flex items-center gap-1">
                          {item.sellerName}
                        </Link>
                        <p className="text-[10px] text-[#CDFF00] font-bold uppercase tracking-widest">Sponsored Product</p>
                      </div>
                    </div>
                    <Link to={`/listing/${item.id}`} className="p-2 bg-white/5 rounded-full hover:bg-[#CDFF00] hover:text-black transition-colors text-white">
                      <ShoppingBag className="w-5 h-5" />
                    </Link>
                  </div>
                  
                  <Link to={`/listing/${item.id}`} className="block relative bg-black aspect-square max-h-[500px] w-full flex items-center justify-center overflow-hidden">
                    {item.mediaUrls?.[0] ? (
                      <img src={item.mediaUrls[0]} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <ShoppingBag className="w-24 h-24 text-white/10" />
                    )}
                    <div className="absolute top-4 right-4 px-3 py-1 bg-black/80 backdrop-blur border border-white/10 rounded-full text-white font-black">
                      {formatPrice(item.price, item.currency)}
                    </div>
                  </Link>
                  
                  <div className="p-5">
                    <div className="flex items-center gap-4 mb-3">
                      <button className="text-white hover:text-rose-500 transition-colors"><Heart className="w-6 h-6" /></button>
                      <Link to={`/listing/${item.id}`} className="text-white hover:text-[#CDFF00] transition-colors"><MessageSquare className="w-6 h-6" /></Link>
                    </div>
                    <Link to={`/listing/${item.id}`} className="font-bold text-white hover:text-[#CDFF00] transition-colors line-clamp-1">{item.title}</Link>
                    <p className="text-sm text-gray-400 mt-1 line-clamp-2 leading-relaxed">{item.description}</p>
                    <Link to={`/listing/${item.id}`} className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-3 block hover:text-white transition-colors">View fully & buy</Link>
                  </div>
                </motion.div>
              );
            }

            // Standard Social Post layout
            return (
              <motion.div key={`post-${item.id}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass border border-white/5 p-0 rounded-3xl group overflow-hidden transition-all hover:border-white/10">
                <div className="p-4 flex items-center gap-3 border-b border-white/5">
                  <Link to={`/profile/${item.authorId}`} className="relative w-10 h-10 rounded-full bg-black flex items-center justify-center text-white border border-white/10 group-hover:border-[#CDFF00] transition-all font-black">
                    {item.authorName[0]}
                    {/* Placeholder for verification badge if we have it on posts */}
                  </Link>
                  <div>
                    <Link to={`/profile/${item.authorId}`} className="text-white font-bold tracking-wide hover:text-[#CDFF00] transition-colors">
                      {item.authorName}
                    </Link>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                      {new Date(item.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                
                {item.imageUrl && (
                  <div className="bg-black aspect-square max-h-[500px] w-full flex items-center justify-center overflow-hidden">
                    <img src={item.imageUrl} alt="Post" className="w-full h-full object-cover" />
                  </div>
                )}
                
                <div className="p-5">
                  <div className="flex items-center gap-4 mb-3">
                    <button className="text-white hover:text-rose-500 transition-colors"><Heart className="w-6 h-6" /></button>
                    <button className="text-white hover:text-[#CDFF00] transition-colors"><MessageSquare className="w-6 h-6" /></button>
                  </div>
                  <div className="text-sm leading-relaxed">
                    <Link to={`/profile/${item.authorId}`} className="font-bold text-white hover:text-[#CDFF00] mr-2">{item.authorName}</Link>
                    <span className="text-gray-200">{item.content}</span>
                  </div>
                  {item.commentsCount > 0 && <button className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-3 hover:text-white transition-colors">View all {item.commentsCount} comments</button>}
                </div>
              </motion.div>
            );
          })
        ) : (
          <div className="text-center py-20 text-gray-500 w-full glass rounded-3xl border border-white/5">
            <ImageIcon className="w-12 h-12 mx-auto opacity-50 mb-4" />
            <h3 className="text-xl font-black uppercase text-white mb-2 tracking-widest">No Posts Yet</h3>
            <p className="text-sm font-bold uppercase tracking-widest">Be the first to share something!</p>
          </div>
        )}
      </div>
    </div>
  );
}
