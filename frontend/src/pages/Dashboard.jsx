import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useSelector } from 'react-redux';
import { selectUser, selectIsAuthenticated, selectIsSeller } from '../store/authSlice';
import { bookingsApi, listingsApi, notificationsApi } from '../api/client';
import { BOOKING_STATUS_MAP, LISTING_TYPES, formatPrice } from '../utils/constants';
import { Settings2, Plus, Inbox, ClipboardList, Check, X, MessageSquare, ListTodo, PackageSearch, BellRing } from 'lucide-react';
import HeroBrief from '../components/HeroBrief';

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
    <div className="min-h-screen bg-[#050505] text-white">
      <HeroBrief 
        pillText="OPERATIONAL CONTROL CENTER"
        title="HUSTLE DASH"
        subtitle={"Manage your empire in real-time.\nTrack bookings, listings, and alerts effortlessly."}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 pb-32">
        {/* Action Bar */}
        <div className="flex justify-end gap-3 mb-12 relative z-10">
          {isSeller && (
            <Link to="/create" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#CDFF00] text-black font-black uppercase tracking-widest text-xs hover:bg-[#E0FF4D] hover:shadow-lg transition-all">
              <Plus className="w-4 h-4" /> Post New
            </Link>
          )}
          <Link to={`/profile/${user?.id}`} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl glass border border-white/10 text-white font-bold uppercase tracking-widest text-xs hover:bg-white/5 transition-all">
            <Settings2 className="w-4 h-4" /> Settings
          </Link>
        </div>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          {/* Tabs */}
          <div className="flex gap-2 mb-10 overflow-x-auto pb-4 scrollbar-hide py-2 border-b border-white/5">
            {tabs.map((t) => {
              const Icon = t.icon;
              const isActive = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-2 px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all border ${
                    isActive
                      ? 'bg-[#CDFF00] text-black border-[#CDFF00] shadow-[0_0_30px_rgba(205,255,0,0.2)]'
                      : 'bg-white/5 border-white/5 text-gray-400 hover:text-white hover:border-white/20'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {t.label}
                  {t.count > 0 && (
                    <span className={`ml-2 inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded font-black ${
                      isActive ? 'bg-black text-[#CDFF00]' : 'bg-gray-800 text-gray-300'
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
                    <EmptyState icon={Inbox} title="No Active Orders" desc="Your active purchasing or service bookings will appear here." />
                  ) : (
                    bookings.map((booking) => {
                      const status = BOOKING_STATUS_MAP[booking.status] || { label: booking.status, color: 'bg-gray-800 text-gray-400' };
                      const isBuyer = user?.id === booking.buyerId;

                      return (
                        <div key={booking.id} className="glass rounded-3xl p-6 border border-white/5 hover:border-[#CDFF00]/20 transition-all flex flex-col md:flex-row md:items-center justify-between gap-6">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3">
                              <span className={`px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-[0.2em] ${status.color}`}>
                                {status.label}
                              </span>
                              <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">
                                {new Date(booking.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                            
                            <Link to={`/listing/${booking.listingId}`} className="text-xl font-black text-white hover:text-[#CDFF00] transition-colors uppercase tracking-tight mb-2 block">
                              {booking.listingTitle || 'Project Title'}
                            </Link>
                            
                            <div className="flex flex-wrap items-center gap-4 text-[10px] font-black uppercase tracking-[0.1em] text-gray-500">
                              <span className="flex items-center gap-1">
                                <span className="text-gray-700">{isBuyer ? 'Seller:' : 'Buyer:'}</span>
                                <span className="text-gray-400">{isBuyer ? booking.sellerName : booking.buyerName}</span>
                              </span>
                              {booking.agreedPrice && <span className="text-[#CDFF00]">Fee: {formatPrice(booking.agreedPrice, booking.currency)}</span>}
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2 shrink-0">
                            <Link to={`/dm/${isBuyer ? booking.sellerId : booking.buyerId}`} className="px-5 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-black uppercase text-[10px] tracking-widest hover:bg-white/10 transition-all flex items-center gap-2">
                              <MessageSquare className="w-3.5 h-3.5" /> Wire
                            </Link>
                            
                            {booking.status === 'INQUIRED' && !isBuyer && (
                              <button onClick={() => handleBookingAction(booking.id, 'accept')} className="px-5 py-3 rounded-xl bg-[#CDFF00] text-black font-black uppercase text-[10px] tracking-widest hover:scale-105 transition-all flex items-center gap-1">
                                <Check className="w-3.5 h-3.5" /> Accept
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {listings.length === 0 ? (
                    <div className="col-span-full">
                      <EmptyState icon={PackageSearch} title="Inventory Empty" desc="You don't have any active drops right now." cta={{ label: 'New Drop', to: '/create' }} />
                    </div>
                  ) : (
                    listings.map((listing) => {
                      const typeInfo = LISTING_TYPES.find((t) => t.value === listing.listingType) || LISTING_TYPES[0];
                      const TypeIcon = typeInfo.icon;
                      return (
                        <Link key={listing.id} to={`/listing/${listing.id}`} className="glass rounded-3xl p-6 border border-white/5 hover:border-[#CDFF00]/30 transition-all flex items-center gap-6 group block">
                          <div className="w-16 h-16 rounded-2xl bg-black border border-white/5 flex items-center justify-center text-[#CDFF00] group-hover:bg-[#CDFF00] group-hover:text-black transition-all">
                            <TypeIcon className="w-6 h-6" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-black text-white group-hover:text-[#CDFF00] transition-colors truncate uppercase tracking-tight mb-1">{listing.title}</h3>
                            <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-gray-600">
                              <span>{typeInfo.label}</span>
                              <span className="text-[#CDFF00]">{formatPrice(listing.price, listing.currency)}</span>
                            </div>
                          </div>
                        </Link>
                      );
                    })
                  )}
                </div>
              )}

              {/* Notifications Tab */}
              {tab === 'notifications' && (
                <div className="max-w-3xl mx-auto space-y-4">
                  {notifications.length === 0 ? (
                    <EmptyState icon={BellRing} title="Node Silent" desc="You have no unread alerts at the moment." />
                  ) : (
                    notifications.map((notif) => (
                      <div
                        key={notif.id}
                        onClick={() => markNotifRead(notif.id)}
                        className={`glass rounded-3xl p-8 cursor-pointer border transition-all ${!notif.read ? 'border-[#CDFF00]/50 bg-[#CDFF00]/5' : 'border-white/5 bg-black/40 hover:border-white/10'}`}
                      >
                        <h4 className={`text-sm tracking-[0.1em] uppercase ${!notif.read ? 'text-[#CDFF00] font-black' : 'text-gray-400 font-bold'}`}>{notif.title}</h4>
                        <p className={`text-base mt-2 font-medium ${!notif.read ? 'text-white' : 'text-gray-500'}`}>{notif.message}</p>
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-700 mt-6">{new Date(notif.createdAt).toLocaleString()}</p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, desc, cta }) {
  return (
    <div className="text-center py-24 glass rounded-[3rem] border border-white/5 bg-white/2">
      <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-8 border border-white/5">
        <Icon className="w-8 h-8 text-white/20" />
      </div>
      <h3 className="text-2xl font-black text-white uppercase tracking-[0.1em] mb-3">{title}</h3>
      <p className="text-gray-500 mb-10 font-bold uppercase tracking-widest text-xs max-w-xs mx-auto leading-relaxed">{desc}</p>
      {cta && (
        <Link to={cta.to} className="inline-flex px-10 py-4 rounded-xl bg-[#CDFF00] text-black font-black uppercase tracking-widest hover:scale-105 transition-all text-[10px]">
          {cta.label}
        </Link>
      )}
    </div>
  );
}
