import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LISTING_TYPES, formatPrice } from '../utils/constants';
import {
  MapPin, BadgeCheck, MessageSquare, ShieldCheck, ShoppingCart,
  ArrowLeft, Star, Heart, Share2, Zap, Package, Check,
  HandCoins, Plus
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { listingsApi, usersApi, bookingsApi } from '../api/client';
import { addToCart, selectCartItems } from '../store/cartSlice';
import { selectUser } from '../store/authSlice';

export default function ListingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const currentUser = useSelector(selectUser);
  const cartItems = useSelector(selectCartItems);

  const [listing, setListing] = useState(null);
  const [seller, setSeller] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeMedia, setActiveMedia] = useState(0);
  const [addedToCart, setAddedToCart] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const inCart = cartItems.some((i) => i.listingId === id);

  useEffect(() => {
    setLoading(true);
    listingsApi.getById(id)
      .then((r) => {
        const data = r.data;
        setListing(data);
        if (data.sellerId) {
          usersApi.getProfile(data.sellerId).then((u) => setSeller(u.data)).catch(() => {});
        }
      })
      .catch(() => setError('Listing not found or unavailable.'))
      .finally(() => setLoading(false));
  }, [id]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAddToCart = () => {
    if (!listing) return;
    dispatch(addToCart({
      listingId: listing.id,
      title: listing.title,
      price: Number(listing.price),
      currency: listing.currency || 'GBP',
      image: listing.mediaUrls?.[0] || null,
      sellerId: listing.sellerId,
      sellerName: listing.sellerName || seller?.fullName || 'Seller',
    }));
    setAddedToCart(true);
    showToast('Added to cart!');
    setTimeout(() => setAddedToCart(false), 2000);
  };

  const handleNegotiate = async () => {
    if (!listing) return;
    // Create an inquiry booking then open DM with seller
    setBookingLoading(true);
    try {
      await bookingsApi.create({ listingId: listing.id });
      navigate(`/dm/${listing.sellerId}`, {
        state: {
          listing: {
            id: listing.id,
            title: listing.title,
            price: listing.price,
            currency: listing.currency,
          },
          prefillMessage: `Hi! I'm interested in "${listing.title}" (${formatPrice(listing.price, listing.currency)}). Can we negotiate?`,
        },
      });
    } catch {
      showToast('Could not start negotiation. Try messaging the seller directly.', 'error');
    } finally {
      setBookingLoading(false);
    }
  };

  const handleBuyNow = () => {
    if (!listing) return;
    dispatch(addToCart({
      listingId: listing.id,
      title: listing.title,
      price: Number(listing.price),
      currency: listing.currency || 'GBP',
      image: listing.mediaUrls?.[0] || null,
      sellerId: listing.sellerId,
      sellerName: listing.sellerName || seller?.fullName || 'Seller',
    }));
    navigate('/checkout');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-[#CDFF00]/20 border-t-[#CDFF00] rounded-full animate-spin mx-auto" />
          <p className="text-gray-500 font-bold text-sm uppercase tracking-widest">Loading listing…</p>
        </div>
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center px-4">
        <div className="text-center space-y-4">
          <Package className="w-16 h-16 mx-auto text-gray-700" />
          <h2 className="text-2xl font-black text-white uppercase tracking-tight">{error || 'Not found'}</h2>
          <Link to="/explore" className="px-8 py-3 rounded-2xl bg-[#CDFF00] text-black font-black text-sm uppercase tracking-widest inline-block">
            Back to Explore
          </Link>
        </div>
      </div>
    );
  }

  const typeInfo = LISTING_TYPES.find((t) => t.value === listing.listingType) || LISTING_TYPES[0];
  const isSeller = currentUser?.id === listing.sellerId;

  return (
    <div className="min-h-screen bg-[#050505] text-white pt-24 pb-20">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-2xl font-black text-sm uppercase tracking-widest shadow-2xl ${
              toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-[#CDFF00] text-black'
            }`}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto px-6 sm:px-12">
        {/* Header Row */}
        <div className="flex items-center justify-between mb-12">
          <Link
            to="/explore"
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl glass-strong text-[10px] font-black uppercase tracking-widest hover:text-[#CDFF00] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Explore
          </Link>
          <div className="flex gap-3">
            <button className="flex items-center gap-2 px-6 py-2.5 rounded-2xl glass-strong text-[10px] font-black uppercase tracking-widest text-[#CDFF00] hover:bg-white/5 transition-all">
              <Heart className="w-4 h-4" /> Save
            </button>
            <button className="flex items-center gap-2 px-6 py-2.5 rounded-2xl glass-strong text-[10px] font-black uppercase tracking-widest text-white hover:bg-white/5 transition-all">
              <Share2 className="w-4 h-4" /> Share
            </button>
          </div>
        </div>

        {/* 2-Column Layout */}
        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-16 items-start">
          {/* Left: Media */}
          <div className="space-y-8">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative aspect-[4/3] rounded-[48px] overflow-hidden glass-strong border border-white/10"
            >
              {listing.mediaUrls?.length > 0 ? (
                <img
                  src={listing.mediaUrls[activeMedia]}
                  alt={listing.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-900">
                  <Package className="w-20 h-20 text-gray-700" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              <div className="absolute top-8 left-8">
                <span className="flex items-center gap-2 px-5 py-2 rounded-2xl glass-violet text-[#CDFF00] font-black text-[10px] uppercase tracking-widest border border-white/10">
                  <Zap className="w-4 h-4 fill-[#CDFF00]" /> {typeInfo.label}
                </span>
              </div>
            </motion.div>

            {listing.mediaUrls?.length > 1 && (
              <div className="flex gap-4 overflow-x-auto pb-4">
                {listing.mediaUrls.map((url, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveMedia(i)}
                    className={`w-24 h-24 rounded-2xl overflow-hidden shrink-0 transition-all duration-300 ${
                      activeMedia === i
                        ? 'ring-2 ring-[#CDFF00] scale-105'
                        : 'opacity-40 grayscale hover:opacity-100 hover:grayscale-0'
                    }`}
                  >
                    <img src={url} alt="Variant" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: Info & Actions */}
          <div className="flex flex-col gap-10">
            {/* Title */}
            <div>
              <motion.h1
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-5xl sm:text-6xl font-black text-white mb-6 uppercase tracking-tighter leading-tight"
              >
                {listing.title}
              </motion.h1>
              <div className="flex flex-wrap items-center gap-6">
                {listing.avgRating > 0 && (
                  <div className="flex items-center gap-2 bg-[#CDFF00] text-black px-3 py-1 rounded-xl text-sm font-black">
                    <Star className="w-4 h-4 fill-black" /> {Number(listing.avgRating).toFixed(1)}
                  </div>
                )}
                {listing.locationCity && (
                  <div className="flex items-center gap-2 text-gray-500 text-[10px] font-black uppercase tracking-widest">
                    <MapPin className="w-4 h-4 text-[#CDFF00]" /> {listing.locationCity}
                  </div>
                )}
                {listing.sellerVerified && (
                  <div className="flex items-center gap-2 text-[#A855F7] text-[10px] font-black uppercase tracking-widest">
                    <ShieldCheck className="w-4 h-4" /> Trusted Merchant
                  </div>
                )}
              </div>
            </div>

            {/* Price & Actions */}
            <div className="p-8 rounded-[40px] glass-strong border border-white/10 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-violet-600/10 blur-[80px]" />
              <div className="relative z-10">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2 block">Price</span>
                <div className="flex items-baseline gap-3 mb-8">
                  <span className="text-5xl font-black text-white tracking-widest">
                    {formatPrice(listing.price, listing.currency)}
                  </span>
                  {listing.negotiable && (
                    <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 bg-white/5 border border-white/10 text-[#CDFF00] rounded-lg">
                      Negotiable
                    </span>
                  )}
                </div>

                {!isSeller && (
                  <div className="space-y-3">
                    {/* Add to Cart */}
                    <button
                      onClick={handleAddToCart}
                      className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-95 ${
                        inCart || addedToCart
                          ? 'bg-green-500/20 border border-green-500/40 text-green-400'
                          : 'bg-white/10 border border-white/20 text-white hover:bg-white/15'
                      }`}
                    >
                      {inCart || addedToCart ? (
                        <><Check className="w-4 h-4" /> In Cart</>
                      ) : (
                        <><Plus className="w-4 h-4" /> Add to Cart</>
                      )}
                    </button>

                    {/* Buy Now */}
                    <button
                      onClick={handleBuyNow}
                      className="w-full py-4 rounded-2xl bg-[#CDFF00] text-black font-black text-xs uppercase tracking-[0.2em] shadow-[0_15px_35px_rgba(205,255,0,0.3)] hover:scale-[1.02] transition-transform active:scale-95 flex items-center justify-center gap-3 group"
                    >
                      <ShoppingCart className="w-4 h-4 group-hover:rotate-12 transition-transform" /> Buy Now
                    </button>

                    {/* Negotiate (only for negotiable listings) */}
                    {listing.negotiable && (
                      <button
                        onClick={handleNegotiate}
                        disabled={bookingLoading}
                        className="w-full py-4 rounded-2xl border border-[#CDFF00]/40 text-[#CDFF00] font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-[#CDFF00]/10 transition-all disabled:opacity-50"
                      >
                        {bookingLoading ? (
                          <span className="w-4 h-4 border-2 border-[#CDFF00]/40 border-t-[#CDFF00] rounded-full animate-spin" />
                        ) : (
                          <HandCoins className="w-4 h-4" />
                        )}
                        Negotiate via DM
                      </button>
                    )}
                  </div>
                )}

                {isSeller && (
                  <div className="text-center py-3 text-gray-500 text-xs font-bold uppercase tracking-widest">
                    This is your listing
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
            <div>
              <h4 className="text-[10px] font-black uppercase tracking-widest text-[#CDFF00] mb-4 opacity-40">About</h4>
              <p className="text-lg text-gray-300 leading-relaxed font-medium opacity-90">
                {listing.description}
              </p>
            </div>

            {/* Seller Card */}
            <div className="pt-8 border-t border-white/5">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-6">Seller</h4>
              <div
                onClick={() => listing.sellerId && navigate(`/profile/${listing.sellerId}`)}
                className="flex items-center gap-5 p-6 rounded-3xl glass-violet border border-white/10 hover:border-white/20 transition-all cursor-pointer group"
              >
                <div className="w-16 h-16 rounded-[24px] overflow-hidden bg-gray-800 border border-white/10 shrink-0">
                  {(listing.sellerAvatarUrl || seller?.avatarUrl) ? (
                    <img src={listing.sellerAvatarUrl || seller.avatarUrl} alt={listing.sellerName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl font-black text-[#CDFF00]">
                      {(listing.sellerName || 'S')[0].toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h5 className="text-lg font-black text-white uppercase tracking-tight group-hover:text-[#CDFF00] transition-colors truncate">
                      {listing.sellerName || seller?.fullName || 'Seller'}
                    </h5>
                    {listing.sellerVerified && <BadgeCheck className="w-4 h-4 text-[#CDFF00] shrink-0" />}
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                    {listing.reviewCount > 0 ? `${listing.reviewCount} reviews` : 'Seller on HustleUp'}
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (listing.sellerId) navigate(`/dm/${listing.sellerId}`);
                  }}
                  className="w-12 h-12 rounded-2xl glass-strong flex items-center justify-center group-hover:bg-[#CDFF00]/10 transition-colors shrink-0"
                >
                  <MessageSquare className="w-5 h-5 text-white group-hover:text-[#CDFF00]" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
