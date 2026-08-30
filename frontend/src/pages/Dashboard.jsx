import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useSelector } from 'react-redux';
import { selectUser, selectIsAuthenticated, selectIsSeller } from '../store/authSlice';
import { bookingsApi, listingsApi, notificationsApi, availabilityApi, payoutsApi, ticketsApi, reviewsApi, shopsApi, dispatchToast } from '../api/client';
import { BOOKING_STATUS_MAP, LISTING_TYPES, formatPrice } from '../utils/constants';
import {
  Settings2, Plus, Inbox, ClipboardList, Check, X, MessageSquare, ListTodo, PackageSearch,
  BellRing, TrendingUp, CalendarClock, Pencil, Store, Trash2, Ban, Landmark, CreditCard, ShieldCheck,
  Ticket, ScanLine, ArrowRight, Star, Truck, Package, Megaphone
} from 'lucide-react';
import HeroBrief from '../components/HeroBrief';
import ShopManager from '../components/ShopManager';
import ReviewModal from '../components/ReviewModal';
import OrderTracker from '../components/OrderTracker';
import PublishingPanel from '../components/PublishingPanel';
import TrackingUpdateModal from '../components/TrackingUpdateModal';
import SmartImage from '../components/SmartImage';
import { isComplete } from '../utils/shipping';

// Listing categories with bespoke dashboard functionality beyond the standard buy/negotiate flow.
const SERVICE_TYPES = ['HAIR_BEAUTY', 'SKILL'];

export default function Dashboard() {
  const user = useSelector(selectUser);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const isSeller = useSelector(selectIsSeller);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Deep-linkable tab. Stripe returns a buyer here after a storefront purchase with
  // ?tab=orders, so the first thing they see is the order they just paid for rather than a
  // dashboard they have to go looking through.
  const [tab, setTab] = useState(() => searchParams.get('tab') || 'bookings');
  const [bookings, setBookings] = useState([]);
  const [listings, setListings] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingListing, setEditingListing] = useState(null); // listing being price-edited, or null
  const [payoutStatus, setPayoutStatus] = useState(null); // { connected, payoutsEnabled, chargesEnabled, detailsSubmitted }
  const [payoutBusy, setPayoutBusy] = useState(false);
  const [payingBookingId, setPayingBookingId] = useState(null);
  const [counteringId, setCounteringId] = useState(null); // booking currently showing its counter-price input, or null
  const [counterValue, setCounterValue] = useState('');
  const [counterBusy, setCounterBusy] = useState(false);
  const [tickets, setTickets] = useState([]); // digital event tickets the user holds
  // Booking whose review dialog is open — either the seller completing it, or a buyer
  // clearing a review they still owe.
  const [reviewing, setReviewing] = useState(null);
  const [shopOrders, setShopOrders] = useState([]);   // storefront purchases the user made
  const [shopSales, setShopSales] = useState([]);     // storefront orders placed with their shop
  // The order whose delivery-update dialog is open: { order, title, kind: 'booking' | 'shop' }.
  const [tracking, setTracking] = useState(null);

  const hasServiceListing = listings.some((l) => SERVICE_TYPES.includes(l.listingType));
  const hasEventListing = listings.some((l) => l.listingType === 'EVENT');
  const eventListings = listings.filter((l) => l.listingType === 'EVENT');

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return; }
    loadData();
  }, [isAuthenticated, navigate]);

  // Stripe sends the buyer back here after paying for a single booking. The webhook is the
  // authority on payment, but it is not something this page can wait for — locally it never
  // arrives at all — so the order would still read "awaiting payment" with a Pay now button
  // in front of someone who has just paid. Verify the session, then reload.
  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    if (!isAuthenticated || searchParams.get('payment') !== 'success' || !sessionId) return;
    let cancelled = false;
    bookingsApi.confirmPayment(sessionId)
      .then(() => { if (!cancelled) { dispatchToast('Payment confirmed', 'success'); loadData(); } })
      .catch(() => { if (!cancelled) dispatchToast('Paid, but we could not confirm it yet — it will update shortly', 'error'); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, searchParams]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [bookRes, notifRes] = await Promise.all([
        bookingsApi.my(),
        notificationsApi.getAll(),
      ]);
      setBookings(bookRes.data);
      setNotifications(notifRes.data);
      // Non-blocking: someone who's never booked an event just gets an empty wallet.
      ticketsApi.my().then((r) => setTickets(r.data)).catch(() => setTickets([]));
      // Same treatment for storefront orders — a buyer who has never bought from a shop
      // simply has none, which is not an error worth failing the whole dashboard over.
      shopsApi.myOrders().then((r) => setShopOrders(r.data || [])).catch(() => setShopOrders([]));
      if (isSeller) {
        const listRes = await listingsApi.my();
        setListings(listRes.data);
        if (listRes.data.some((l) => SERVICE_TYPES.includes(l.listingType))) {
          availabilityApi.my().then((r) => setSlots(r.data)).catch(() => setSlots([]));
        }
        payoutsApi.status().then((r) => setPayoutStatus(r.data)).catch(() => setPayoutStatus({ connected: false }));
        shopsApi.receivedOrders().then((r) => setShopSales(r.data || [])).catch(() => setShopSales([]));
      }
    } catch { /* fail silently */ }
    setLoading(false);
  };

  const handleConnectPayouts = async () => {
    setPayoutBusy(true);
    try {
      const res = await payoutsApi.connect();
      window.location.href = res.data.url;
    } catch (e) {
      dispatchToast(e.response?.data?.error || 'Could not start payout setup', 'error');
    } finally {
      setPayoutBusy(false);
    }
  };

  const handlePayNow = async (bookingId) => {
    setPayingBookingId(bookingId);
    try {
      const res = await bookingsApi.checkoutSession(bookingId);
      window.location.href = res.data.url;
    } catch (e) {
      dispatchToast(e.response?.data?.error || 'Could not start payment', 'error');
      setPayingBookingId(null);
    }
  };

  /**
   * Saves a delivery update. The caller picks the endpoint by order kind — bookings and
   * storefront orders are different entities but take an identical update body, which is
   * what lets one dialog drive both.
   */
  const submitTracking = (update) => (
    tracking.kind === 'booking'
      ? bookingsApi.updateFulfilment(tracking.order.id, update)
      : shopsApi.updateFulfilment(tracking.order.id, update)
  );

  /**
   * Folds the server's version of the updated order back into state rather than reloading
   * the dashboard: the response already carries the new fulfilment, and a full reload would
   * throw away the tab and scroll position a seller was working a queue from.
   */
  const applyTracked = (updated) => {
    if (!updated) return;
    const swap = (list) => list.map((o) => (o.id === updated.id ? updated : o));
    if (tracking?.kind === 'booking') setBookings(swap);
    else setShopSales(swap);
  };

  const handleBookingAction = async (id, action) => {
    try {
      if (action === 'accept') await bookingsApi.accept(id);
      else if (action === 'cancel') await bookingsApi.cancel(id, 'Cancelled by user');
      // 'complete' no longer routes through here — it opens the review dialog first.
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Action failed');
    }
  };

  const submitCounter = async (id) => {
    const price = parseFloat(counterValue);
    if (!price || price <= 0) return;
    setCounterBusy(true);
    try {
      await bookingsApi.counterOffer(id, price);
      setCounteringId(null);
      setCounterValue('');
      loadData();
    } catch (err) {
      dispatchToast(err.response?.data?.error || 'Could not send counter-offer', 'error');
    } finally {
      setCounterBusy(false);
    }
  };

  const markNotifRead = async (id) => {
    await notificationsApi.markRead(id).catch(() => {});
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const salesBookings = bookings.filter((b) => b.role === 'seller' && b.status === 'COMPLETED');
  // Completed transactions this user still owes a review on. A seller's review is taken
  // during completion, so in practice these are the buyer's side of the deal.
  const awaitingReview = bookings.filter((b) => b.status === 'COMPLETED' && b.reviewedByMe === false);
  const totalRevenue = salesBookings.reduce((sum, b) => sum + (b.agreedPrice || 0), 0);

  // Storefront orders still owing somebody something. Counts work outstanding rather than
  // orders in total: an order the buyer already has needs nothing from either side, and
  // counting it would leave the tab badge permanently lit.
  const openShopOrders = [...shopOrders, ...shopSales]
    .filter((o) => o.status === 'PAID' && !isComplete(o.fulfilment?.fulfilmentStatus)).length;

  /** Requests from buyers a seller has not yet accepted or declined — their real to-do list. */
  const pendingRequests = bookings.filter((b) => b.role === 'seller' && b.status === 'INQUIRED');
  /** Sold and paid for, but not yet delivered and marked complete. */
  const inProgress = bookings.filter((b) => b.role === 'seller' && b.status === 'BOOKED');

  /**
   * Tabs, grouped rather than presented as one flat row.
   *
   * A seller with events and services saw nine equally-weighted tabs in a single centered
   * line, with their own storefront sitting between "Door" and "Sales" and the buyer-side
   * tabs mixed in among them. Splitting by who the tab is for gives the row a shape: what
   * you sell, what you bought, and your account.
   */
  const tabGroups = [
    ...(isSeller ? [{
      key: 'selling',
      label: 'Selling',
      tabs: [
        { id: 'listings', label: 'Listings', icon: ClipboardList, count: listings.length },
        { id: 'shop', label: 'Shop', icon: Store, count: 0 },
        { id: 'sales', label: 'Sales', icon: TrendingUp, count: salesBookings.length },
        ...(hasServiceListing ? [{ id: 'availability', label: 'Availability', icon: CalendarClock, count: slots.length }] : []),
        ...(hasEventListing ? [{ id: 'door', label: 'Door', icon: ScanLine, count: eventListings.length }] : []),
      ],
    }] : []),
    {
      key: 'activity',
      label: isSeller ? 'Orders' : 'Your activity',
      tabs: [
        { id: 'bookings', label: 'Bookings', icon: ListTodo, count: bookings.length },
        // Storefront orders are a separate entity from bookings, so they get their own tab
        // rather than being merged into one list of two different shapes. Hidden until
        // there is one, on the same reasoning as Tickets below.
        ...(shopOrders.length > 0 || shopSales.length > 0
          ? [{ id: 'orders', label: 'Shop orders', icon: Package, count: openShopOrders }]
          : []),
        // Only surfaced once there's something in the wallet — an empty tab is noise.
        ...(tickets.length > 0 ? [{ id: 'tickets', label: 'Tickets', icon: Ticket, count: tickets.filter((t) => t.status === 'VALID').length }] : []),
      ],
    },
    {
      key: 'publishing',
      label: 'Publishing',
      // Always shown, to everyone. Someone who has not been approved yet still needs to
      // find out that publishing exists and how to apply — hiding the tab until they are
      // approved would mean the only people who can see the route are the ones who no
      // longer need it.
      tabs: [
        { id: 'publishing', label: 'News & Jobs', icon: Megaphone, count: 0 },
      ],
    },
    {
      key: 'account',
      label: 'Account',
      tabs: [
        ...(isSeller ? [{ id: 'payouts', label: 'Payouts', icon: Landmark, count: payoutStatus?.payoutsEnabled ? 0 : 1 }] : []),
        { id: 'notifications', label: 'Alerts', icon: BellRing, count: notifications.filter((n) => !n.read).length },
      ],
    },
  ];

  return (
    <div className="min-h-screen text-white">
      <HeroBrief title="Hustle Dash" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-10">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          {/* Seller summary. Revenue was only visible after opening the Sales tab, and the
              two numbers that actually need acting on — unanswered requests, and whether
              payouts are even set up — were not shown anywhere. A dashboard should answer
              "what needs me?" before it offers navigation. */}
          {isSeller && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-5">
              <button onClick={() => setTab('sales')} className="text-left rounded-2xl border border-[#CDFF00]/25 bg-[#CDFF00]/[0.06] p-3.5 hover:bg-[#CDFF00]/10 transition-colors">
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#CDFF00]/70">Revenue</p>
                <p className="text-lg font-black text-[#CDFF00] mt-0.5 truncate">{formatPrice(totalRevenue, 'PLN')}</p>
              </button>
              <button onClick={() => setTab('bookings')} className={`text-left rounded-2xl border p-3.5 transition-colors ${
                pendingRequests.length > 0
                  ? 'border-amber-400/40 bg-amber-400/10 hover:bg-amber-400/15'
                  : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
              }`}>
                <p className={`text-[9px] font-black uppercase tracking-[0.18em] ${pendingRequests.length > 0 ? 'text-amber-300/80' : 'text-gray-500'}`}>Needs reply</p>
                <p className={`text-lg font-black mt-0.5 ${pendingRequests.length > 0 ? 'text-amber-300' : 'text-white'}`}>{pendingRequests.length}</p>
              </button>
              <button onClick={() => setTab('bookings')} className="text-left rounded-2xl border border-white/10 bg-white/[0.03] p-3.5 hover:bg-white/[0.06] transition-colors">
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-gray-500">In progress</p>
                <p className="text-lg font-black text-white mt-0.5">{inProgress.length}</p>
              </button>
              <button onClick={() => setTab('payouts')} className={`text-left rounded-2xl border p-3.5 transition-colors ${
                payoutStatus?.payoutsEnabled
                  ? 'border-emerald-400/30 bg-emerald-400/[0.07] hover:bg-emerald-400/10'
                  : 'border-red-400/40 bg-red-400/10 hover:bg-red-400/15'
              }`}>
                <p className={`text-[9px] font-black uppercase tracking-[0.18em] ${payoutStatus?.payoutsEnabled ? 'text-emerald-300/80' : 'text-red-300/80'}`}>Payouts</p>
                <p className={`text-sm font-black mt-1 ${payoutStatus?.payoutsEnabled ? 'text-emerald-300' : 'text-red-300'}`}>
                  {payoutStatus?.payoutsEnabled ? 'Active' : payoutStatus?.connected ? 'Finish setup' : 'Not set up'}
                </p>
              </button>
            </div>
          )}

          {/* Control row: tabs grouped by who they serve, plus actions */}
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2.5 mb-5 pb-4 border-b border-white/5">
            {tabGroups.filter((g) => g.tabs.length > 0).map((group, gi) => (
              <div key={group.key} className="flex items-center gap-2">
                {gi > 0 && <div className="w-px h-5 bg-white/10 mr-1" />}
                {/* Only worth labelling once there is more than one group to tell apart. */}
                {tabGroups.filter((g) => g.tabs.length > 0).length > 1 && (
                  <span className="hidden sm:inline text-[8px] font-black uppercase tracking-[0.18em] text-gray-600 mr-0.5">
                    {group.label}
                  </span>
                )}
                {group.tabs.map((t) => {
                  const Icon = t.icon;
                  const isActive = tab === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setTab(t.id)}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-[0.2em] transition-all border ${
                        isActive
                          ? 'bg-[#CDFF00] text-black border-[#CDFF00] shadow-[0_0_20px_rgba(205,255,0,0.15)]'
                          : 'bg-white/5 border-white/5 text-gray-400 hover:text-white hover:border-white/20'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {t.label}
                      {t.count > 0 && (
                        <span className={`ml-1 inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded font-black text-[8px] ${
                          isActive ? 'bg-black text-[#CDFF00]' : 'bg-gray-800 text-gray-300'
                        }`}>
                          {t.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
            <div className="w-px h-5 bg-white/10 mx-1.5" />
            {isSeller && (
              <Link to="/create" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#CDFF00] text-black font-black uppercase tracking-widest text-[9px] hover:bg-[#E0FF4D] transition-all">
                <Plus className="w-3.5 h-3.5" /> Post New
              </Link>
            )}
            <Link to={`/profile/${user?.id}`} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg glass border border-white/10 text-white font-bold uppercase tracking-widest text-[9px] hover:bg-white/5 transition-all">
              <Settings2 className="w-3.5 h-3.5" /> Settings
            </Link>
          </div>

          {/* Points at the Shop tab rather than onboarding — that's where a storefront is
              actually created and edited now. */}
          {/* Outstanding reviews sit above everything else: a rating is only useful if it is
              actually left, and a completed transaction is the moment someone can give one. */}
          {awaitingReview.length > 0 && (
            <div className="mb-5 space-y-2">
              {awaitingReview.slice(0, 3).map((b) => (
                <button
                  key={b.id}
                  onClick={() => setReviewing({ booking: b, mode: 'review' })}
                  className="w-full flex items-center justify-between gap-3 px-5 py-3.5 rounded-2xl bg-[#CDFF00]/5 border border-[#CDFF00]/30 hover:border-[#CDFF00]/60 transition-all group text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-[#CDFF00]/15 flex items-center justify-center shrink-0">
                      <Star className="w-4.5 h-4.5 text-[#CDFF00]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white truncate">
                        How was {b.role === 'seller' ? b.buyerName : b.sellerName}?
                      </p>
                      <p className="text-xs text-gray-500 truncate">{b.listingTitle}</p>
                    </div>
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-[#CDFF00] group-hover:translate-x-0.5 transition-transform shrink-0">
                    Rate →
                  </span>
                </button>
              ))}
            </div>
          )}

          {isSeller && tab !== 'shop' && (
            <button
              onClick={() => setTab('shop')}
              className="w-full flex items-center justify-between gap-3 px-5 py-3.5 rounded-2xl bg-[#CDFF00]/5 border border-[#CDFF00]/30 hover:border-[#CDFF00]/60 transition-all mb-5 group text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#CDFF00]/15 flex items-center justify-center shrink-0">
                  <Store className="w-4.5 h-4.5 text-[#CDFF00]" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Your shop</p>
                  <p className="text-xs text-gray-500">Name, banner, colour, city and products — all editable by you</p>
                </div>
              </div>
              <span className="text-[9px] font-black uppercase tracking-widest text-[#CDFF00] group-hover:translate-x-0.5 transition-transform shrink-0">Manage →</span>
            </button>
          )}

          {loading ? (
            <div className="space-y-2.5">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="glass rounded-2xl p-4 animate-pulse border border-white/5">
                  <div className="h-4 bg-surface-50 rounded w-1/3 mb-2" />
                  <div className="h-3 bg-surface-50 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* Bookings Tab */}
              {tab === 'bookings' && (
                <div className="space-y-2.5">
                  {bookings.length === 0 ? (
                    <EmptyState icon={Inbox} title="No Active Orders" desc="Your active purchasing or service bookings will appear here." />
                  ) : (
                    bookings.map((booking) => {
                      const status = BOOKING_STATUS_MAP[booking.status] || { label: booking.status, color: 'bg-gray-800 text-gray-400' };
                      const isBuyer = user?.id === booking.buyerId;

                      return (
                        <div key={booking.id} className="glass rounded-2xl p-4 border border-white/5 hover:border-[#CDFF00]/20 transition-all">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-[0.15em] ${status.color}`}>
                                {status.label}
                              </span>
                              <span className="text-[9px] font-bold text-gray-600 uppercase tracking-widest">
                                {new Date(booking.createdAt).toLocaleDateString()}
                              </span>
                            </div>

                            <Link to={`/listing/${booking.listingId}`} className="text-sm font-black text-white hover:text-[#CDFF00] transition-colors uppercase tracking-tight block truncate">
                              {booking.listingTitle || 'Project Title'}
                            </Link>

                            <div className="flex flex-wrap items-center gap-3 mt-1 text-[9px] font-black uppercase tracking-[0.1em] text-gray-500">
                              <span className="flex items-center gap-1">
                                <span className="text-gray-700">{isBuyer ? 'Seller:' : 'Buyer:'}</span>
                                <span className="text-gray-400">{isBuyer ? booking.sellerName : booking.buyerName}</span>
                              </span>
                              {booking.agreedPrice && <span className="text-[#CDFF00]">Fee: {formatPrice(booking.agreedPrice, booking.currency)}</span>}
                              {!booking.agreedPrice && booking.status === 'NEGOTIATING' && booking.counterPrice && (
                                <span className="text-[#CDFF00]">
                                  Countered: {formatPrice(booking.counterPrice, booking.currency)}
                                  <span className="text-gray-600 normal-case"> (was {formatPrice(booking.offeredPrice, booking.currency)})</span>
                                </span>
                              )}
                              {!booking.agreedPrice && booking.status === 'INQUIRED' && booking.offeredPrice && (
                                <span className="text-gray-400">Offered: {formatPrice(booking.offeredPrice, booking.currency)}</span>
                              )}
                              {booking.paymentStatus && booking.paymentStatus !== 'PENDING' && (
                                <span className={booking.paymentStatus === 'TRANSFERRED' || booking.paymentStatus === 'PAID' ? 'text-[#CDFF00]' : 'text-gray-500'}>
                                  Payment: {booking.paymentStatus.replace('_', ' ').toLowerCase()}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2 shrink-0">
                            <Link to={`/dm/${isBuyer ? booking.sellerId : booking.buyerId}`} className="px-3.5 py-2 rounded-lg bg-white/5 border border-white/10 text-white font-black uppercase text-[9px] tracking-widest hover:bg-white/10 transition-all flex items-center gap-1.5">
                              <MessageSquare className="w-3 h-3" /> Wire
                            </Link>

                            {booking.status === 'INQUIRED' && !isBuyer && (
                              <>
                                <button onClick={() => handleBookingAction(booking.id, 'accept')} className="px-3.5 py-2 rounded-lg bg-[#CDFF00] text-black font-black uppercase text-[9px] tracking-widest hover:scale-105 transition-all flex items-center gap-1">
                                  <Check className="w-3 h-3" /> Approve
                                </button>
                                <button
                                  onClick={() => { setCounteringId(counteringId === booking.id ? null : booking.id); setCounterValue(''); }}
                                  className="px-3.5 py-2 rounded-lg bg-white/5 border border-white/10 text-white font-black uppercase text-[9px] tracking-widest hover:bg-white/10 transition-all flex items-center gap-1"
                                >
                                  <Pencil className="w-3 h-3" /> Counter
                                </button>
                              </>
                            )}

                            {/* Buyer accepting the seller's counter-offer */}
                            {booking.status === 'NEGOTIATING' && isBuyer && (
                              <button onClick={() => handleBookingAction(booking.id, 'accept')} className="px-3.5 py-2 rounded-lg bg-[#CDFF00] text-black font-black uppercase text-[9px] tracking-widest hover:scale-105 transition-all flex items-center gap-1">
                                <Check className="w-3 h-3" /> Accept {formatPrice(booking.counterPrice, booking.currency)}
                              </button>
                            )}

                            {booking.status === 'BOOKED' && isBuyer && !['PAID', 'TRANSFERRED'].includes(booking.paymentStatus) && (
                              <button
                                onClick={() => handlePayNow(booking.id)}
                                disabled={payingBookingId === booking.id}
                                className="px-3.5 py-2 rounded-lg bg-[#CDFF00] text-black font-black uppercase text-[9px] tracking-widest hover:scale-105 transition-all flex items-center gap-1 disabled:opacity-60"
                              >
                                <CreditCard className="w-3 h-3" /> {payingBookingId === booking.id ? 'Redirecting…' : 'Pay Now'}
                              </button>
                            )}

                            {/* Only once money has arrived: there is nothing to track on an
                                order nobody has paid for, and offering the control anyway
                                invites a seller to tell a buyer their unpaid parcel shipped. */}
                            {!isBuyer && ['PAID', 'TRANSFERRED'].includes(booking.paymentStatus) && (
                              <button
                                onClick={() => setTracking({ order: booking, kind: 'booking', title: booking.listingTitle })}
                                className="px-3.5 py-2 rounded-lg bg-white/5 border border-white/10 text-white font-black uppercase text-[9px] tracking-widest hover:bg-white/10 transition-all flex items-center gap-1.5"
                              >
                                <Truck className="w-3 h-3" /> Delivery
                              </button>
                            )}

                            {booking.status === 'BOOKED' && !isBuyer && (
                              <button onClick={() => setReviewing({ booking, mode: 'complete' })} className="px-3.5 py-2 rounded-lg bg-[#CDFF00] text-black font-black uppercase text-[9px] tracking-widest hover:scale-105 transition-all flex items-center gap-1">
                                <Check className="w-3 h-3" /> Complete
                              </button>
                            )}

                            {!['COMPLETED', 'CANCELLED'].includes(booking.status) && (() => {
                              // A pending INQUIRED request seen by the seller (e.g. an event
                              // "request to join") hasn't been confirmed yet, so rejecting it
                              // reads as "Decline" rather than "Cancel" — same cancel() call either way.
                              const isPendingRequest = booking.status === 'INQUIRED' && !isBuyer;
                              return (
                                <button
                                  onClick={() => { if (confirm(isPendingRequest ? 'Decline this request?' : 'Cancel this booking?')) handleBookingAction(booking.id, 'cancel'); }}
                                  className="px-3.5 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 font-black uppercase text-[9px] tracking-widest hover:bg-red-500/20 transition-all flex items-center gap-1"
                                >
                                  <Ban className="w-3 h-3" /> {isPendingRequest ? 'Decline' : 'Cancel'}
                                </button>
                              );
                            })()}
                          </div>
                        </div>

                        {/* Renders itself away for anything with no delivery track — an
                            unpaid order, or a service that was never going to be shipped. */}
                        <OrderTracker fulfilment={booking.fulfilment} />

                        {counteringId === booking.id && (
                          <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-2">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              autoFocus
                              value={counterValue}
                              onChange={(e) => setCounterValue(e.target.value)}
                              placeholder={`Your counter price (${booking.currency})`}
                              className="flex-1 bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-[#CDFF00] transition-colors"
                            />
                            <button
                              onClick={() => submitCounter(booking.id)}
                              disabled={counterBusy || !counterValue}
                              className="px-3.5 py-2 rounded-lg bg-[#CDFF00] text-black font-black uppercase text-[9px] tracking-widest hover:scale-105 transition-all disabled:opacity-40"
                            >
                              {counterBusy ? '…' : 'Send'}
                            </button>
                            <button
                              onClick={() => { setCounteringId(null); setCounterValue(''); }}
                              className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* Shop Orders Tab — the two halves of the same list: what the user bought
                  from other people's storefronts, and what has been bought from theirs. Kept
                  in one tab because a seller who also shops should not have to remember
                  which of two places their own parcel is tracked in. */}
              {tab === 'orders' && (
                <div className="space-y-6">
                  {shopOrders.length > 0 && (
                    <div>
                      <h3 className="text-[9px] font-black uppercase tracking-[0.24em] text-gray-500 mb-2.5">
                        Your purchases
                      </h3>
                      <div className="space-y-2.5">
                        {shopOrders.map((order) => (
                          <ShopOrderCard key={order.id} order={order} />
                        ))}
                      </div>
                    </div>
                  )}

                  {shopSales.length > 0 && (
                    <div>
                      <h3 className="text-[9px] font-black uppercase tracking-[0.24em] text-gray-500 mb-2.5">
                        Orders to fulfil
                      </h3>
                      <div className="space-y-2.5">
                        {shopSales.map((order) => (
                          <ShopOrderCard
                            key={order.id}
                            order={order}
                            // Only a paid order can be sent, so the control appears with the
                            // money rather than with the order.
                            onTrack={order.status === 'PAID' || order.status === 'FULFILLED'
                              ? () => setTracking({ order, kind: 'shop', title: order.productName })
                              : null}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {shopOrders.length === 0 && shopSales.length === 0 && (
                    <EmptyState icon={Package} title="No Shop Orders" desc="Storefront purchases and the orders placed with your shop will appear here." />
                  )}
                </div>
              )}

              {/* Tickets Tab — the holder's side: every event they're going to. */}
              {tab === 'tickets' && (
                <div className="space-y-2.5">
                  {tickets.map((t) => (
                    <Link
                      key={t.id}
                      to={`/tickets/${t.id}`}
                      className="glass rounded-2xl p-4 border border-white/5 hover:border-[#CDFF00]/30 transition-all flex items-center justify-between gap-3 group"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-black text-white uppercase tracking-tight truncate group-hover:text-[#CDFF00] transition-colors">
                          {t.eventTitle}
                        </p>
                        <p className="text-[9px] font-black uppercase tracking-widest text-gray-600 mt-0.5">
                          {t.ticketCode}
                          {t.eventStartsAt && ` · ${new Date(t.eventStartsAt).toLocaleDateString()}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${
                          t.status === 'CHECKED_IN' ? 'bg-emerald-500/15 text-emerald-400'
                            : t.status === 'CANCELLED' ? 'bg-red-500/15 text-red-400'
                            : 'bg-[#CDFF00]/15 text-[#CDFF00]'
                        }`}>
                          {t.status === 'CHECKED_IN' ? 'Checked in' : t.status === 'CANCELLED' ? 'Void' : 'Valid'}
                        </span>
                        <ArrowRight className="w-4 h-4 text-gray-600 group-hover:text-[#CDFF00] transition-colors" />
                      </div>
                    </Link>
                  ))}
                  <Link
                    to="/tickets"
                    className="block text-center text-[9px] font-black uppercase tracking-widest text-gray-500 hover:text-[#CDFF00] transition-colors pt-1"
                  >
                    Open full ticket wallet →
                  </Link>
                </div>
              )}

              {/* Door Tab — the organiser's side: one entry per event they're running. */}
              {tab === 'door' && (
                <div className="space-y-2.5">
                  <p className="text-xs text-gray-500 px-1">
                    Scan guests in from here — or type their ticket code if their screen won't cooperate.
                  </p>
                  {eventListings.map((l) => (
                    <Link
                      key={l.id}
                      to={`/events/${l.id}/door`}
                      className="glass rounded-2xl p-4 border border-white/5 hover:border-[#CDFF00]/30 transition-all flex items-center justify-between gap-3 group"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-black text-white uppercase tracking-tight truncate group-hover:text-[#CDFF00] transition-colors">
                          {l.title}
                        </p>
                        <p className="text-[9px] font-black uppercase tracking-widest text-gray-600 mt-0.5">
                          {l.eventStartsAt ? new Date(l.eventStartsAt).toLocaleString() : 'Date TBC'}
                          {l.eventVenue && ` · ${l.eventVenue}`}
                        </p>
                      </div>
                      <span className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#CDFF00] text-black text-[9px] font-black uppercase tracking-widest">
                        <ScanLine className="w-3 h-3" /> Open door
                      </span>
                    </Link>
                  ))}
                </div>
              )}

              {/* Shop Tab — every field on the seller's shop card and shop page. */}
              {tab === 'shop' && <ShopManager user={user} />}

              {/* Writing an article and posting a vacancy, plus what you've already put out.
                  Both composers existed but were only reachable from /news and /jobs, which
                  nothing on the dashboard linked to. */}
              {tab === 'publishing' && <PublishingPanel />}

              {/* Listings Tab */}
              {tab === 'listings' && (
                <div className="space-y-3">
                  {hasEventListing && (
                    <p className="text-xs text-gray-500 px-1">
                      Running an event? Open the listing itself to buy tickets, or post updates about it.
                    </p>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {listings.length === 0 ? (
                    <div className="col-span-full">
                      <EmptyState icon={PackageSearch} title="Inventory Empty" desc="You don't have any active drops right now." cta={{ label: 'New Drop', to: '/create' }} />
                    </div>
                  ) : (
                    listings.map((listing) => {
                      const typeInfo = LISTING_TYPES.find((t) => t.value === listing.listingType) || LISTING_TYPES[0];
                      const TypeIcon = typeInfo.icon;
                      return (
                        <div key={listing.id} className="glass rounded-2xl p-3.5 border border-white/5 hover:border-[#CDFF00]/30 transition-all flex items-center gap-3.5 group">
                          <Link to={`/listing/${listing.id}`} className="w-11 h-11 rounded-xl bg-black border border-white/5 flex items-center justify-center text-[#CDFF00] group-hover:bg-[#CDFF00] group-hover:text-black transition-all shrink-0">
                            <TypeIcon className="w-5 h-5" />
                          </Link>
                          <Link to={`/listing/${listing.id}`} className="flex-1 min-w-0">
                            <h3 className="text-sm font-black text-white group-hover:text-[#CDFF00] transition-colors truncate uppercase tracking-tight">{listing.title}</h3>
                            <div className="flex items-center gap-2.5 mt-0.5 text-[9px] font-black uppercase tracking-widest text-gray-600">
                              <span>{typeInfo.label}</span>
                              <span className="text-[#CDFF00]">{formatPrice(listing.price, listing.currency)}</span>
                            </div>
                          </Link>
                          <button
                            onClick={() => setEditingListing(listing)}
                            className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:border-white/20 transition-all shrink-0"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })
                  )}
                  </div>
                </div>
              )}

              {/* Sales Tab */}
              {tab === 'sales' && (
                <div className="space-y-4">
                  <div className="glass rounded-2xl p-5 border border-[#CDFF00]/20 flex items-center justify-between">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Total revenue</p>
                      <p className="text-2xl font-black text-[#CDFF00] mt-1">{formatPrice(totalRevenue, 'PLN')}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Completed sales</p>
                      <p className="text-2xl font-black text-white mt-1">{salesBookings.length}</p>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    {salesBookings.length === 0 ? (
                      <EmptyState icon={TrendingUp} title="No Sales Yet" desc="Completed bookings will show up here as sales once you mark them complete." />
                    ) : (
                      salesBookings.map((b) => (
                        <div key={b.id} className="glass rounded-2xl p-4 border border-white/5 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <Link to={`/listing/${b.listingId}`} className="text-sm font-black text-white hover:text-[#CDFF00] transition-colors truncate block">
                              {b.listingTitle || 'Listing'}
                            </Link>
                            <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mt-0.5">
                              {b.buyerName} · {new Date(b.createdAt).toLocaleDateString()}
                              {b.quantity > 1 && ` · ${b.quantity}x`}
                            </p>
                          </div>
                          <span className="text-sm font-black text-[#CDFF00] shrink-0">{formatPrice(b.agreedPrice, b.currency)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Availability Tab */}
              {tab === 'availability' && (
                <AvailabilityTab listings={listings.filter((l) => SERVICE_TYPES.includes(l.listingType))} slots={slots} onChange={loadData} />
              )}

              {/* Payouts Tab */}
              {tab === 'payouts' && (
                <div className="max-w-lg mx-auto space-y-4">
                  <div className="glass rounded-2xl p-5 border border-white/5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl bg-[#CDFF00]/10 flex items-center justify-center shrink-0">
                        <Landmark className="w-5 h-5 text-[#CDFF00]" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">Bank account</p>
                        <p className="text-xs text-gray-500">Payouts are handled securely by Stripe — we never see or store your bank details.</p>
                      </div>
                    </div>

                    {payoutStatus?.payoutsEnabled ? (
                      <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[#CDFF00]/10 border border-[#CDFF00]/20">
                        <ShieldCheck className="w-4 h-4 text-[#CDFF00] shrink-0" />
                        <p className="text-xs font-bold text-[#CDFF00]">Connected — you'll be paid out automatically when bookings are completed.</p>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white/5 border border-white/10 mb-3">
                          <span className="text-xs text-gray-400">
                            {payoutStatus?.connected
                              ? "You've started setup but Stripe still needs a bit more information before payouts can begin."
                              : "You haven't connected a payout account yet — do this before your bookings can be paid out."}
                          </span>
                        </div>
                        <button
                          onClick={handleConnectPayouts}
                          disabled={payoutBusy}
                          className="w-full py-2.5 rounded-xl bg-[#CDFF00] text-black font-bold text-sm hover:bg-[#d9ff33] active:scale-[0.99] transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                        >
                          {payoutBusy ? 'Redirecting…' : payoutStatus?.connected ? 'Finish setup with Stripe' : 'Connect bank account'}
                        </button>
                      </>
                    )}
                  </div>

                  <div className="glass rounded-2xl p-4 border border-white/5">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">How payouts work</p>
                    <ul className="text-xs text-gray-400 space-y-1.5 leading-relaxed list-disc list-inside">
                      <li>Buyers pay when a booking is confirmed.</li>
                      <li>You get paid automatically once you mark the booking Complete.</li>
                      <li>HustleSpace keeps a small platform fee — you receive the rest.</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* Notifications Tab */}
              {tab === 'notifications' && (
                <div className="max-w-3xl mx-auto space-y-2.5">
                  {notifications.length === 0 ? (
                    <EmptyState icon={BellRing} title="Node Silent" desc="You have no unread alerts at the moment." />
                  ) : (
                    notifications.map((notif) => (
                      <div
                        key={notif.id}
                        onClick={() => markNotifRead(notif.id)}
                        className={`glass rounded-2xl px-4 py-3 cursor-pointer border transition-all ${!notif.read ? 'border-[#CDFF00]/50 bg-[#CDFF00]/5' : 'border-white/5 bg-black/40 hover:border-white/10'}`}
                      >
                        <div className="flex items-baseline justify-between gap-3">
                          <h4 className={`text-xs tracking-[0.1em] uppercase truncate ${!notif.read ? 'text-[#CDFF00] font-black' : 'text-gray-400 font-bold'}`}>{notif.title}</h4>
                          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-700 shrink-0">{new Date(notif.createdAt).toLocaleDateString()}</span>
                        </div>
                        <p className={`text-sm mt-1 font-medium ${!notif.read ? 'text-white' : 'text-gray-500'}`}>{notif.message}</p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </motion.div>
      </div>

      {reviewing && (
        <ReviewModal
          title={reviewing.mode === 'complete' ? 'Complete booking' : 'Rate this transaction'}
          subjectName={reviewing.booking.role === 'seller' ? reviewing.booking.buyerName : reviewing.booking.sellerName}
          context={reviewing.booking.listingTitle}
          note={reviewing.mode === 'complete'
            ? 'Marking this complete releases payment to the seller. Your rating is saved with it.'
            : undefined}
          submitLabel={reviewing.mode === 'complete' ? 'Complete & submit' : 'Submit review'}
          onClose={() => setReviewing(null)}
          onSubmit={async ({ rating, comment }) => {
            if (reviewing.mode === 'complete') {
              await bookingsApi.complete(reviewing.booking.id, { rating, comment });
            } else {
              await reviewsApi.create({ bookingId: reviewing.booking.id, rating, comment });
            }
            setReviewing(null);
            loadData();
          }}
        />
      )}

      {tracking && (
        <TrackingUpdateModal
          order={tracking.order}
          title={tracking.title}
          onSubmit={submitTracking}
          onDone={applyTracked}
          onClose={() => setTracking(null)}
        />
      )}

      {editingListing && (
        <EditPriceModal
          listing={editingListing}
          onClose={() => setEditingListing(null)}
          onSaved={(updated) => {
            setListings((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
            setEditingListing(null);
          }}
        />
      )}
    </div>
  );
}

/* Compact modal for updating a listing's price / negotiable flag from the dashboard. */
function EditPriceModal({ listing, onClose, onSaved }) {
  const [price, setPrice] = useState(listing.price);
  const [negotiable, setNegotiable] = useState(listing.negotiable);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const res = await listingsApi.update(listing.id, { price: Number(price), negotiable });
      dispatchToast('Listing updated', 'success');
      onSaved(res.data);
    } catch (e) {
      dispatchToast('Failed to update listing', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center px-4">
      <div onClick={onClose} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <div className="relative w-full max-w-sm bg-[#0a0a0a] border border-white/10 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white truncate pr-2">{listing.title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-500 shrink-0"><X className="w-4 h-4" /></button>
        </div>
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 block">Price ({listing.currency})</label>
        <input
          type="number" value={price} onChange={(e) => setPrice(e.target.value)}
          className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-[#CDFF00] mb-3"
        />
        <label className="flex items-center gap-2 text-sm text-gray-300 mb-5 cursor-pointer">
          <input type="checkbox" checked={negotiable} onChange={(e) => setNegotiable(e.target.checked)} className="accent-[#CDFF00] w-4 h-4" />
          Open to negotiation
        </label>
        <button
          onClick={save} disabled={saving}
          className="w-full py-2.5 rounded-xl bg-[#CDFF00] text-black font-bold text-sm hover:bg-[#d9ff33] active:scale-[0.99] transition-all disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}

/* Seller's slot calendar: add an open slot for one of their service listings, see status. */
function AvailabilityTab({ listings, slots, onChange }) {
  const [listingId, setListingId] = useState(listings[0]?.id || '');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [saving, setSaving] = useState(false);

  const addSlot = async () => {
    if (!listingId || !date || !startTime || !endTime) {
      dispatchToast('Fill in the listing, date, and both times', 'error');
      return;
    }
    setSaving(true);
    try {
      await availabilityApi.create(listingId, `${date}T${startTime}:00`, `${date}T${endTime}:00`);
      dispatchToast('Slot added', 'success');
      setStartTime(''); setEndTime('');
      onChange();
    } catch (e) {
      dispatchToast(e.response?.data?.error || 'Failed to add slot', 'error');
    } finally {
      setSaving(false);
    }
  };

  const removeSlot = async (id) => {
    try {
      await availabilityApi.remove(id);
      onChange();
    } catch (e) {
      dispatchToast('Could not remove slot', 'error');
    }
  };

  return (
    <div className="space-y-5">
      {/* Add slot form */}
      <div className="glass rounded-2xl p-4 border border-white/5">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3">Open a new slot</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-2.5">
          <select
            value={listingId} onChange={(e) => setListingId(e.target.value)}
            className="bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#CDFF00] sm:col-span-2"
          >
            {listings.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
          </select>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#CDFF00]" />
          <div className="grid grid-cols-2 gap-2.5">
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
              className="bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-[#CDFF00]" />
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)}
              className="bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-[#CDFF00]" />
          </div>
        </div>
        <button
          onClick={addSlot} disabled={saving}
          className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#CDFF00] text-black font-bold text-xs hover:bg-[#d9ff33] active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" /> Add slot
        </button>
      </div>

      {/* Slot list */}
      <div className="space-y-2.5">
        {slots.length === 0 ? (
          <EmptyState icon={CalendarClock} title="No Slots Yet" desc="Open a slot above so buyers can book a specific appointment time." />
        ) : (
          slots.map((s) => (
            <div key={s.id} className="glass rounded-2xl p-4 border border-white/5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-white truncate">{s.listingTitle}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {new Date(s.startTime).toLocaleDateString()} · {new Date(s.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}–{new Date(s.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${s.booked ? 'bg-[#CDFF00]/15 text-[#CDFF00]' : 'bg-white/5 text-gray-400'}`}>
                  {s.booked ? 'Booked' : 'Open'}
                </span>
                {!s.booked && (
                  <button onClick={() => removeSlot(s.id)} className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-all">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/**
 * One storefront order, from either side.
 *
 * The same card serves the buyer and the seller: both need to see what was bought, what it
 * cost, and where it is. The only difference is the seller's update control, which is
 * passed in rather than decided here — the parent knows which orders are theirs to fulfil.
 */
function ShopOrderCard({ order, onTrack }) {
  const shipping = Number(order.fulfilment?.shippingPrice) || 0;
  const goods = Number(order.totalPrice) || 0;
  const paidState = SHOP_ORDER_STATES[order.status] || { label: order.status, color: 'bg-gray-800 text-gray-400' };

  return (
    <div className="glass rounded-2xl p-4 border border-white/5 hover:border-[#CDFF00]/20 transition-all">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-lg overflow-hidden bg-black border border-white/10 shrink-0">
          <SmartImage src={order.productImageUrl} alt="" fallbackIcon={Package} className="w-full h-full object-cover" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-[0.15em] ${paidState.color}`}>
              {paidState.label}
            </span>
            <span className="text-[9px] font-bold text-gray-600 uppercase tracking-widest">
              {new Date(order.createdAt).toLocaleDateString()}
            </span>
          </div>

          <p className="text-sm font-black text-white uppercase tracking-tight truncate">{order.productName}</p>

          <div className="flex flex-wrap items-center gap-3 mt-1 text-[9px] font-black uppercase tracking-[0.1em] text-gray-500">
            <span>Qty {order.quantity}</span>
            <span className="text-[#CDFF00]">{formatPrice(goods + shipping, order.currency)}</span>
            {/* Postage is named separately rather than folded into the total: it is what the
                seller charged to send it, and the buyer is entitled to see it as its own number. */}
            {shipping > 0 && (
              <span className="text-gray-600 normal-case font-bold">
                incl. {formatPrice(shipping, order.currency)} delivery
              </span>
            )}
          </div>
        </div>

        {onTrack && (
          <button
            onClick={onTrack}
            className="px-3.5 py-2 rounded-lg bg-white/5 border border-white/10 text-white font-black uppercase text-[9px] tracking-widest hover:bg-white/10 transition-all flex items-center gap-1.5 shrink-0"
          >
            <Truck className="w-3 h-3" /> Delivery
          </button>
        )}
      </div>

      <OrderTracker fulfilment={order.fulfilment} />
    </div>
  );
}

/** Commercial state of a storefront order — separate from where the parcel is. */
const SHOP_ORDER_STATES = {
  AWAITING_PAYMENT: { label: 'Awaiting payment', color: 'bg-gray-800 text-gray-400' },
  PAID: { label: 'Paid', color: 'bg-emerald-500/15 text-emerald-400' },
  FULFILLED: { label: 'Fulfilled', color: 'bg-green-500/15 text-green-400' },
  CANCELLED: { label: 'Cancelled', color: 'bg-red-500/15 text-red-400' },
  REFUNDED: { label: 'Refunded', color: 'bg-amber-500/15 text-amber-400' },
};

function EmptyState({ icon: Icon, title, desc, cta }) {
  return (
    <div className="text-center py-10 glass rounded-2xl border border-white/5 bg-white/2">
      <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-3 border border-white/5">
        <Icon className="w-5 h-5 text-white/20" />
      </div>
      <h3 className="text-base font-black text-white uppercase tracking-[0.1em] mb-1.5">{title}</h3>
      <p className="text-gray-500 mb-4 font-bold uppercase tracking-widest text-[10px] max-w-xs mx-auto leading-relaxed">{desc}</p>
      {cta && (
        <Link to={cta.to} className="inline-flex px-6 py-2.5 rounded-lg bg-[#CDFF00] text-black font-black uppercase tracking-widest hover:scale-105 transition-all text-[9px]">
          {cta.label}
        </Link>
      )}
    </div>
  );
}
