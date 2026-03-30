import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useSelector } from 'react-redux';
import { selectUser, selectIsAuthenticated, selectIsSeller } from '../store/authSlice';
import { bookingsApi, listingsApi, notificationsApi } from '../api/client';
import { BOOKING_STATUS_MAP, LISTING_TYPES, formatPrice } from '../utils/constants';
import { Settings2, Plus, Inbox, ClipboardList, Check, X, MessageSquare, ListTodo, PackageSearch, BellRing } from 'lucide-react';

export default function Dashboard() {
  const user = useSelector(selectUser);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const isSeller = useSelector(selectIsSeller);
  const navigate = useNavigate();
  
  const [tab, setTab] = useState('bookings');
  const [bookings, setBookings] = useState([]);
  const [listings, setListings] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return; }
    loadData();
  }, [isAuthenticated, navigate]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [bookRes, notifRes] = await Promise.all([
        bookingsApi.my(),
        notificationsApi.getAll(),
      ]);
      setBookings(bookRes.data);
      setNotifications(notifRes.data);
      if (isSeller) {
        const listRes = await listingsApi.my();
        setListings(listRes.data);
      }
    } catch { /* fail silently */ }
    setLoading(false);
  };

  const handleBookingAction = async (id, action) => {
    try {
      if (action === 'accept') await bookingsApi.accept(id);
      else if (action === 'cancel') await bookingsApi.cancel(id, 'Cancelled by user');
      else if (action === 'complete') await bookingsApi.complete(id);
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Action failed');
    }
  };

  const markNotifRead = async (id) => {
    await notificationsApi.markRead(id).catch(() => {});
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const tabs = [
    { id: 'bookings', label: 'Bookings', icon: ListTodo, count: bookings.length },
    ...(isSeller ? [{ id: 'listings', label: 'Listings', icon: ClipboardList, count: listings.length }] : []),
    { id: 'notifications', label: 'Alerts', icon: BellRing, count: notifications.filter((n) => !n.read).length },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 mt-6">
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-10 pb-6 border-b border-white/5">
          <div>
            <h1 className="text-4xl font-heading font-black text-white uppercase tracking-wider">Dashboard</h1>
            <p className="text-[#CDFF00] font-bold text-sm uppercase tracking-widest mt-2">Welcome back, {user?.fullName}</p>
          </div>
          <div className="flex items-center gap-3">
            {isSeller && (
              <Link to="/create" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#CDFF00] text-black font-black uppercase tracking-widest text-xs hover:bg-[#E0FF4D] hover:shadow-lg transition-all">
                <Plus className="w-4 h-4" /> Post
              </Link>
            )}
            <Link to={`/profile/${user?.id}`} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl glass bg-black/40 border border-white/10 border border-white/10 text-white font-bold uppercase tracking-widest text-xs hover:glass bg-black/40 border border-white/10 transition-all">
              <Settings2 className="w-4 h-4" /> Profile
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2 scrollbar-hide py-2">
          {tabs.map((t) => {
            const Icon = t.icon;
            const isActive = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all border ${
                  isActive
                    ? 'bg-[#CDFF00]/10 border-[#CDFF00] text-[#CDFF00] shadow-[0_0_15px_rgba(205,255,0,0.1)]'
                    : 'bg-black/50 border-white/5 text-gray-500 hover:text-white hover:border-white/20'
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
                {t.count > 0 && (
                  <span className={`ml-2 inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded text-[10px] ${
                    isActive ? 'bg-[#CDFF00] text-black' : 'bg-gray-800 text-gray-300'
                  }`}>
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="glass rounded-3xl p-6 animate-pulse border border-white/5">
                <div className="h-5 bg-surface-50 rounded w-1/3 mb-3" />
                <div className="h-4 bg-surface-50 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Bookings Tab */}
            {tab === 'bookings' && (
              <div className="space-y-4">
                {bookings.length === 0 ? (
                  <EmptyState icon={Inbox} title="No Orders Yet" desc="Your active purchasing or service bookings will appear here." />
                ) : (
                  bookings.map((booking) => {
                    const status = BOOKING_STATUS_MAP[booking.status] || { label: booking.status, color: 'bg-[#121212]0/15 text-gray-400' };
                    const isBuyer = user?.id === booking.buyerId;

                    return (
                      <div key={booking.id} className="glass rounded-3xl p-6 border border-white/10 hover:border-[#CDFF00]/30 transition-all flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <span className={`px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-widest ${status.color}`}>
                              {status.label}
                            </span>
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                              {new Date(booking.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          
                          <Link to={`/listing/${booking.listingId}`} className="text-xl font-bold text-white hover:text-[#CDFF00] transition-colors line-clamp-1 mb-2">
                            {booking.listingTitle || 'Listing Title'}
                          </Link>
                          
                          <div className="flex flex-wrap items-center gap-4 text-xs font-bold uppercase tracking-wider text-gray-400">
                            <span className="flex items-center gap-1 border border-white/10 px-2 py-1 rounded bg-black/50">
                              <span className="text-gray-500">{isBuyer ? 'Seller:' : 'Buyer:'}</span>
                              <span className="text-white">{isBuyer ? booking.sellerName : booking.buyerName}</span>
                            </span>
                            {booking.agreedPrice && <span className="text-[#CDFF00]">Price: {formatPrice(booking.agreedPrice, booking.currency)}</span>}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0 border-t border-white/5 pt-4 md:border-none md:pt-0">
                          <Link to={`/messages/${booking.id}`} className="px-5 py-2.5 rounded-lg glass bg-black/40 border border-white/10 text-white font-bold uppercase text-[10px] tracking-widest hover:glass bg-black/40 border border-white/10 transition-all flex items-center gap-2">
                            <MessageSquare className="w-3.5 h-3.5" /> Chat
                          </Link>
                          
                          {booking.status === 'INQUIRED' && !isBuyer && (
                            <button onClick={() => handleBookingAction(booking.id, 'accept')} className="px-4 py-2.5 rounded-lg bg-[#CDFF00]/10 border border-[#CDFF00]/30 text-[#CDFF00] font-bold uppercase text-[10px] tracking-widest hover:bg-[#CDFF00]/20 transition-all flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" /> Accept
                            </button>
                          )}
                          {booking.status === 'NEGOTIATING' && (
                            <button onClick={() => handleBookingAction(booking.id, 'accept')} className="px-4 py-2.5 rounded-lg bg-[#CDFF00]/10 border border-[#CDFF00]/30 text-[#CDFF00] font-bold uppercase text-[10px] tracking-widest hover:bg-[#CDFF00]/20 transition-all flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" /> Accept
                            </button>
                          )}
                          {booking.status === 'BOOKED' && !isBuyer && (
                            <button onClick={() => handleBookingAction(booking.id, 'complete')} className="px-4 py-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold uppercase text-[10px] tracking-widest hover:bg-emerald-500/20 transition-all flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" /> Finish
                            </button>
                          )}
                          {['INQUIRED', 'NEGOTIATING', 'BOOKED'].includes(booking.status) && (
                            <button onClick={() => handleBookingAction(booking.id, 'cancel')} className="px-4 py-2.5 rounded-lg bg-[#CDFF00]/10 border border-[#CDFF00]/30 text-[#CDFF00] font-bold uppercase text-[10px] tracking-widest hover:bg-[#CDFF00]/20 transition-all text-center">
                              Cancel
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Listings Tab */}
            {tab === 'listings' && (
              <div className="space-y-4">
                {listings.length === 0 ? (
                  <EmptyState icon={PackageSearch} title="Empty Inventory" desc="You don't have any active listings right now." cta={{ label: 'Post a Service', to: '/create' }} />
                ) : (
                  listings.map((listing) => {
                    const typeInfo = LISTING_TYPES.find((t) => t.value === listing.listingType) || LISTING_TYPES[0];
                    const TypeIcon = typeInfo.icon;
                    return (
                      <Link key={listing.id} to={`/listing/${listing.id}`} className="glass rounded-3xl p-5 border border-white/5 hover:border-[#CDFF00]/30 transition-all flex items-center gap-5 group block">
                        <div className="w-16 h-16 rounded-2xl bg-black border border-white/10 flex items-center justify-center text-[#CDFF00] text-xl shrink-0 group-hover:bg-[#CDFF00] group-hover:text-black transition-colors">
                          <TypeIcon className="w-6 h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-bold text-white group-hover:text-[#CDFF00] transition-colors truncate mb-1">{listing.title}</h3>
                          <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                            <span>{typeInfo.label}</span>
                            <span className="w-1 h-1 rounded-full glass bg-black/40 border border-white/10" />
                            <span className="text-gray-300">{formatPrice(listing.price, listing.currency)}</span>
                          </div>
                        </div>
                        <span className={`hidden sm:inline-flex px-3 py-1 rounded text-[10px] font-black uppercase tracking-widest ${
                          listing.status === 'ACTIVE' ? 'bg-[#CDFF00]/10 text-[#CDFF00]' : 'bg-gray-800 text-gray-400'
                        }`}>
                          {listing.status}
                        </span>
                      </Link>
                    );
                  })
                )}
              </div>
            )}

            {/* Notifications Tab */}
            {tab === 'notifications' && (
              <div className="space-y-3">
                {notifications.length === 0 ? (
                  <EmptyState icon={BellRing} title="All Caught Up" desc="You have no unread alerts at the moment." />
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => markNotifRead(notif.id)}
                      className={`glass rounded-2xl p-6 cursor-pointer border transition-all ${!notif.read ? 'border-l-4 border-l-[#CDFF00] border-white/10 bg-[#CDFF00]/5' : 'border-transparent border-b-white/5 hover:glass bg-black/40 border border-white/10'}`}
                    >
                      <div className="flex gap-4">
                        <div className={`mt-1 flex-1`}>
                          <h4 className={`text-sm tracking-wide ${!notif.read ? 'text-[#CDFF00] font-bold' : 'text-gray-300 font-semibold'}`}>{notif.title}</h4>
                          <p className={`text-sm mt-1 ${!notif.read ? 'text-white' : 'text-gray-500'}`}>{notif.message}</p>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600 mt-3">{new Date(notif.createdAt).toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, desc, cta }) {
  return (
    <div className="text-center py-20 glass rounded-3xl border border-white/5">
      <Icon className="w-12 h-12 mx-auto text-gray-600 mb-4" />
      <h3 className="text-xl font-black text-white uppercase tracking-wider mb-2">{title}</h3>
      <p className="text-gray-400 mb-6 font-medium text-sm">{desc}</p>
      {cta && (
        <Link to={cta.to} className="inline-flex px-8 py-4 rounded-xl bg-[#CDFF00] text-black font-black uppercase tracking-widest hover:bg-[#E0FF4D] transition-all text-xs">
          {cta.label}
        </Link>
      )}
    </div>
  );
}
