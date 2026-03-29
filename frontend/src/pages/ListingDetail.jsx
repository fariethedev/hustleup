import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useSelector } from 'react-redux';
import { selectUser, selectIsAuthenticated } from '../store/authSlice';
import { listingsApi, bookingsApi, reviewsApi } from '../api/client';
import { LISTING_TYPES, formatPrice } from '../utils/constants';
import ReviewStars from '../components/ReviewStars';
import { MapPin, ChevronRight, BadgeCheck, ShieldAlert, CheckCircle2 } from 'lucide-react';

export default function ListingDetail() {
  const { id } = useParams();
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const user = useSelector(selectUser);
  const navigate = useNavigate();
  
  const [listing, setListing] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showBooking, setShowBooking] = useState(false);
  const [offerPrice, setOfferPrice] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);

  useEffect(() => {
    setLoading(true);
    listingsApi.getById(id)
      .then((r) => {
        setListing(r.data);
        if (r.data.sellerId) {
          reviewsApi.getForUser(r.data.sellerId).then((rev) => setReviews(rev.data)).catch(() => {});
        }
      })
      .catch(() => navigate('/explore'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const handleBook = async () => {
    if (!isAuthenticated) { navigate('/login'); return; }
    setBookingLoading(true);
    try {
      const data = { listingId: id };
      if (offerPrice) data.offeredPrice = parseFloat(offerPrice);
      await bookingsApi.create(data);
      setBookingSuccess(true);
      setShowBooking(false);
    } catch (err) {
      alert(err.response?.data?.error || 'Booking failed');
    } finally {
      setBookingLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 mt-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 animate-pulse">
          <div className="lg:col-span-2 space-y-6">
            <div className="h-96 rounded-2xl bg-surface-50" />
            <div className="h-8 bg-surface-50 rounded w-3/4" />
            <div className="h-4 bg-surface-50 rounded w-1/2" />
          </div>
          <div className="h-96 rounded-2xl bg-surface-50" />
        </div>
      </div>
    );
  }

  if (!listing) return null;

  const typeInfo = LISTING_TYPES.find((t) => t.value === listing.listingType) || LISTING_TYPES[0];
  const TypeIcon = typeInfo.icon;
  const isOwner = user?.id === listing.sellerId;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 mt-10">
      {/* Breadcrumb */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-widest mb-8">
        <Link to="/explore" className="hover:text-white transition-colors">Explore</Link>
        <ChevronRight className="w-4 h-4" />
        <Link to={`/explore?type=${listing.listingType}`} className="hover:text-white transition-colors flex items-center gap-1">
          <TypeIcon className="w-3.5 h-3.5" />
          {typeInfo.label}
        </Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-[#CDFF00] truncate max-w-[200px]">{listing.title}</span>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Left: Main content */}
        <motion.div className="lg:col-span-2 space-y-10" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {/* Image */}
          <div className="relative rounded-3xl overflow-hidden bg-black h-[400px] sm:h-[500px] border border-white/10 group">
            {listing.mediaUrls?.[0] ? (
              <img src={listing.mediaUrls[0]} alt={listing.title} className="w-full h-full object-cover opacity-90 transition-opacity" />
            ) : (
              <div className={`w-full h-full bg-gradient-to-br ${typeInfo.color} opacity-10 flex items-center justify-center`}>
                <TypeIcon className="w-32 h-32 text-white opacity-40" />
              </div>
            )}
            <div className="absolute top-6 left-6">
              <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-black/80 backdrop-blur-md text-[#CDFF00] border border-white/20 uppercase tracking-widest">
                <TypeIcon className="w-4 h-4" />
                {typeInfo.label}
              </span>
            </div>
          </div>

          {/* Details */}
          <div>
            <div className="flex flex-wrap items-center gap-4 mb-4">
              <h1 className="text-3xl sm:text-5xl font-heading font-extrabold text-white uppercase tracking-tight">{listing.title}</h1>
              {listing.negotiable && (
                <span className="px-3 py-1 rounded-sm text-xs font-bold bg-[#CDFF00] text-black uppercase tracking-widest">Negotiable</span>
              )}
            </div>
            
            {listing.locationCity && (
              <p className="text-gray-400 flex items-center gap-2 text-sm font-bold uppercase tracking-wider mb-8">
                <MapPin className="w-4 h-4 text-[#CDFF00]" />
                {listing.locationCity}
              </p>
            )}

            <div className="prose prose-invert max-w-none prose-p:leading-relaxed prose-p:text-gray-300">
              <p className="whitespace-pre-wrap">{listing.description || 'No description provided.'}</p>
            </div>
          </div>

          {/* Reviews */}
          <div className="border-t border-white/10 pt-10">
            <h2 className="text-2xl font-heading font-black text-white uppercase tracking-wide mb-8 flex items-center justify-between">
              Seller Reviews 
              <span className="text-sm font-bold text-gray-500 bg-white/5 px-3 py-1 rounded-full">{reviews.length}</span>
            </h2>
            
            {reviews.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {reviews.map((review) => (
                  <div key={review.id} className="glass border border-white/5 rounded-2xl p-6">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-10 h-10 rounded-full bg-black border border-[#CDFF00]/30 flex items-center justify-center text-[#CDFF00] text-sm font-bold">
                        {review.reviewerName?.[0] || 'R'}
                      </div>
                      <div>
                        <span className="text-sm font-bold text-white tracking-wide">{review.reviewerName || 'Customer'}</span>
                        <div className="mt-1"><ReviewStars rating={review.rating} size="sm" /></div>
                      </div>
                    </div>
                    {review.comment && <p className="text-gray-400 text-sm leading-relaxed">{review.comment}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 glass border border-white/5 rounded-2xl">
                <ShieldAlert className="w-10 h-10 mx-auto text-gray-600 mb-3" />
                <p className="text-gray-400 font-bold tracking-widest uppercase">No Reviews Yet</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Right: Sidebar */}
        <motion.div className="space-y-6" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          {/* Booking Card */}
          <div className="glass-strong rounded-3xl p-8 sticky top-28 border border-white/10">
            <div className="mb-8 border-b border-white/10 pb-6">
              <span className="block text-sm font-bold text-gray-500 uppercase tracking-widest mb-1">Price / Cost</span>
              <span className="text-4xl font-heading font-black text-white">
                {formatPrice(listing.price, listing.currency)}
              </span>
              {listing.negotiable && <span className="block mt-2 text-xs font-bold text-[#CDFF00] uppercase tracking-widest">• Offers Accepted</span>}
            </div>

            {bookingSuccess ? (
              <div className="p-6 rounded-2xl bg-[#CDFF00]/10 border border-[#CDFF00]/20 text-center">
                <CheckCircle2 className="w-10 h-10 mx-auto text-[#CDFF00] mb-3" />
                <h4 className="text-[#CDFF00] font-bold uppercase tracking-wider mb-1">Request Sent!</h4>
                <p className="text-sm text-[#CDFF00]/80">Check your dashboard for seller updates.</p>
              </div>
            ) : (
              <>
                {!isOwner && (
                  <>
                    {showBooking ? (
                      <div className="space-y-4">
                        {listing.negotiable && (
                          <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Your Offer (Optional)</label>
                            <input
                              type="number"
                              step="0.01"
                              value={offerPrice}
                              onChange={(e) => setOfferPrice(e.target.value)}
                              placeholder={listing.price}
                              className="w-full px-5 py-4 rounded-xl bg-black border border-white/10 text-white focus:border-[#CDFF00] focus:ring-1 focus:ring-[#CDFF00] outline-none transition-all font-bold"
                            />
                          </div>
                        )}
                        <button
                          onClick={handleBook}
                          disabled={bookingLoading}
                          className="w-full py-4 rounded-xl bg-[#CDFF00] text-black font-black uppercase tracking-widest hover:bg-[#E0FF4D] disabled:opacity-50 transition-all flex justify-center"
                        >
                          {bookingLoading ? 'Sending...' : 'Confirm Request'}
                        </button>
                        <button
                          onClick={() => setShowBooking(false)}
                          className="w-full py-4 rounded-xl text-gray-400 font-bold uppercase tracking-widest hover:text-white hover:bg-white/5 transition-all outline-none"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowBooking(true)}
                        className="w-full py-4 rounded-xl bg-[#CDFF00] text-black font-black uppercase tracking-widest hover:bg-[#E0FF4D] transition-all shadow-lg hover:shadow-[#CDFF00]/20 shadow-[#CDFF00]/10"
                      >
                        Book / Make Offer
                      </button>
                    )}
                  </>
                )}
                {isOwner && (
                  <Link to="/dashboard" className="block w-full py-4 rounded-xl bg-white/10 text-center text-white font-black uppercase tracking-widest hover:bg-white/20 transition-all">
                    Manage Listing
                  </Link>
                )}
              </>
            )}
          </div>

          {/* Seller Card */}
          <div className="glass rounded-3xl p-6 border border-white/5">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">About Seller</h3>
            <Link to={`/profile/${listing.sellerId}`} className="flex items-center gap-4 group">
              <div className="w-14 h-14 rounded-full bg-black border border-white/10 flex items-center justify-center text-[#CDFF00] font-black text-xl shrink-0 group-hover:border-[#CDFF00] transition-colors">
                {listing.sellerName?.[0] || 'S'}
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-white font-bold tracking-wide group-hover:text-[#CDFF00] transition-colors">{listing.sellerName || 'Seller'}</span>
                  {listing.sellerVerified && (
                    <BadgeCheck className="w-4 h-4 text-[#CDFF00]" />
                  )}
                </div>
                {listing.avgRating > 0 ? (
                  <ReviewStars rating={listing.avgRating} size="sm" showValue />
                ) : (
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">New Seller</span>
                )}
              </div>
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
