import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LISTING_TYPES, formatPrice, convertToPLN } from '../utils/constants';
import {
  MapPin, BadgeCheck, MessageSquare, ShieldCheck, ShoppingCart,
  ArrowLeft, Star, Heart, Share2, Package, Check,
  HandCoins, Plus, CalendarClock, Ticket, Minus, Image as ImageIcon, Send, Repeat, ScanLine
} from 'lucide-react';
import SwapOfferModal from '../components/SwapOfferModal';
import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { listingsApi, usersApi, bookingsApi, availabilityApi, feedApi, ticketsApi } from '../api/client';
import { addToCart, selectCartItems } from '../store/cartSlice';
import { selectUser } from '../store/authSlice';
import { useToast } from '../context/ToastContext';
import ShareModal from '../components/ShareModal';
import DistanceBadge from '../components/DistanceBadge';
import ListingGallery from '../components/ListingGallery';
import SmartImage from '../components/SmartImage';
import { coverImage, mediaList } from '../utils/media';
import { getMethod } from '../utils/shipping';
import { uploadUrl } from '../config';

const SERVICE_TYPES = ['HAIR_BEAUTY', 'SKILL'];

export default function ListingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const currentUser = useSelector(selectUser);
  const cartItems = useSelector(selectCartItems);
  const { showToast: globalToast } = useToast();

  const [listing, setListing] = useState(null);
  const [seller, setSeller] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [addedToCart, setAddedToCart] = useState(false);
  const [saved, setSaved] = useState(() => {
    try { return (JSON.parse(localStorage.getItem('hustleup_saved')) || []).includes(id); }
    catch { return false; }
  });

  // HAIR_BEAUTY/SKILL: seller-defined appointment slots
  const [slots, setSlots] = useState([]);
  const [selectedSlotId, setSelectedSlotId] = useState(null);
  const [slotBooking, setSlotBooking] = useState(false);
  const [swapOpen, setSwapOpen] = useState(false);

  // EVENT: ticket purchase + event update posts
  const [ticketQty, setTicketQty] = useState(1);
  const [ticketLoading, setTicketLoading] = useState(false);
  // Tickets the viewer already holds for this event. Drives the "you're going" panel, so a
  // buyer who has already booked sees their ticket instead of being sold to again.
  const [myTickets, setMyTickets] = useState([]);
  const [eventUpdates, setEventUpdates] = useState([]);
  const [updateText, setUpdateText] = useState('');
  const [updateImage, setUpdateImage] = useState(null);
  const [updateImagePreview, setUpdateImagePreview] = useState('');
  const [postingUpdate, setPostingUpdate] = useState(false);

  const inCart = cartItems.some((i) => i.listingId === id);

  useEffect(() => {
    setLoading(true);
    try { setSaved((JSON.parse(localStorage.getItem('hustleup_saved')) || []).includes(id)); } catch {}
    listingsApi.getById(id)
      .then((r) => {
        const data = r.data;
        setListing(data);
        if (data.sellerId) {
          usersApi.getProfile(data.sellerId).then((u) => setSeller(u.data)).catch(() => {});
        }
        if (SERVICE_TYPES.includes(data.listingType)) {
          availabilityApi.listByListing(id).then((r2) => setSlots(r2.data)).catch(() => setSlots([]));
        } else if (data.listingType === 'EVENT') {
          feedApi.getByListing(id).then((r2) => setEventUpdates(r2.data)).catch(() => setEventUpdates([]));
          // 401s for a logged-out visitor, which is fine — they have no tickets to show.
          ticketsApi.forEventMine(id).then((r2) => setMyTickets(r2.data)).catch(() => setMyTickets([]));
        }
      })
      .catch(() => setError('Listing not found or unavailable.'))
      .finally(() => setLoading(false));
  }, [id]);

  // Delegates to the shared app-wide toast (bottom-of-screen, always above the navbar)
  // instead of a local page toast — the old local one rendered at the top of the page
  // with a lower z-index than the navbar, so it was invisible behind the nav bar.
  const showToast = (msg, type = 'success') => globalToast(msg, type);

  const toggleSave = () => {
    let ids;
    try { ids = JSON.parse(localStorage.getItem('hustleup_saved')) || []; } catch { ids = []; }
    const next = saved ? ids.filter((x) => x !== id) : [...new Set([...ids, id])];
    localStorage.setItem('hustleup_saved', JSON.stringify(next));
    setSaved(!saved);
    showToast(saved ? 'Removed from saved' : 'Saved!');
  };

  const [shareOpen, setShareOpen] = useState(false);

  const handleAddToCart = () => {
    if (!listing) return;
    dispatch(addToCart({
      listingId: listing.id,
      title: listing.title,
      price: convertToPLN(listing.price, listing.currency || 'PLN'),
      currency: 'PLN',
      // coverImage, not mediaUrls[0]: if the seller led with a video clip the cart row would
      // otherwise try to render it as an <img> and show nothing.
      image: coverImage(listing),
      sellerId: listing.sellerId,
      sellerName: listing.sellerName || seller?.fullName || 'Seller',
      // Delivery travels with the line, converted to PLN like the price above, so the cart
      // can show postage before checkout rather than after payment.
      shippingMethod: listing.shippingMethod,
      shippingPrice: convertToPLN(listing.shippingPrice || 0, listing.currency || 'PLN'),
    }));
    setAddedToCart(true);
    showToast('Added to cart!');
    setTimeout(() => setAddedToCart(false), 2000);
  };

  const handleNegotiate = () => {
    if (!listing) return;
    // The actual Booking isn't created until the buyer names a price in the DM's offer
    // strip (see submitOffer in DirectMessages.jsx) — this just hands that strip the
    // listing to negotiate over.
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
  };

  const handleBookSlot = async () => {
    if (!selectedSlotId) return;
    setSlotBooking(true);
    try {
      // Booking the slot and paying for it are one action to the buyer, so they are one
      // action here. This used to stop at "Slot booked — check your dashboard", which asked
      // someone who had just decided to buy to go and find the thing they had decided to buy
      // in a list, and press a second button. Every step between deciding and paying is a
      // step a buyer can leave through, and the seller carries the cost of that.
      const booking = await bookingsApi.create({
        listingId: listing.id,
        availabilitySlotId: selectedSlotId,
      });
      setSlots((prev) => prev.map((s) => (s.id === selectedSlotId ? { ...s, booked: true } : s)));
      setSelectedSlotId(null);

      const bookingId = booking.data?.id;
      if (bookingId) {
        const session = await bookingsApi.checkoutSession(bookingId);
        const url = session.data?.checkoutUrl || session.data?.url;
        if (url) {
          window.location.href = url;  // hand off to Stripe
          return;
        }
      }
      // The slot is genuinely held either way, so the fallback says so rather than implying
      // the booking failed — the buyer can still pay from the dashboard.
      showToast('Slot booked — finish payment from your dashboard.');
    } catch (e) {
      showToast(e.response?.data?.error || 'Could not book that slot', 'error');
    } finally {
      setSlotBooking(false);
    }
  };

  const handleBuyTickets = async () => {
    if (!listing) return;
    setTicketLoading(true);
    try {
      const booking = await bookingsApi.create({ listingId: listing.id, quantity: ticketQty });

      // Straight to payment. Tickets are minted when the money lands, not when the booking
      // is made — a ticket that admits someone at the door has to mean they paid, and this
      // used to hand one over the instant they clicked buy.
      const bookingId = booking.data?.id;
      if (bookingId) {
        const session = await bookingsApi.checkoutSession(bookingId);
        const url = session.data?.checkoutUrl || session.data?.url;
        if (url) {
          window.location.href = url;
          return;
        }
      }

      // A free event has nothing to charge, so it arrives paid and the tickets already exist.
      const res = await ticketsApi.forEventMine(listing.id);
      setMyTickets(res.data);
      if (res.data?.length) {
        showToast(`${ticketQty} ticket${ticketQty > 1 ? 's' : ''} confirmed — your QR is ready.`);
      } else {
        showToast('Reserved — finish payment from your dashboard to get your tickets.');
      }
      setTicketQty(1);
    } catch (e) {
      showToast(e.response?.data?.error || 'Could not complete ticket purchase', 'error');
    } finally {
      setTicketLoading(false);
    }
  };

  const handleUpdateImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUpdateImage(file);
    setUpdateImagePreview(URL.createObjectURL(file));
  };

  const handlePostUpdate = async () => {
    if (!updateText.trim() && !updateImage) return;
    setPostingUpdate(true);
    try {
      const fd = new FormData();
      fd.append('content', updateText.trim());
      fd.append('linkedListingId', listing.id);
      if (updateImage) fd.append('media', updateImage);
      const res = await feedApi.createPost(fd);
      setEventUpdates((prev) => [res.data, ...prev]);
      setUpdateText('');
      setUpdateImage(null);
      setUpdateImagePreview('');
      showToast('Update posted!');
    } catch (e) {
      showToast('Could not post update', 'error');
    } finally {
      setPostingUpdate(false);
    }
  };

  const handleBuyNow = () => {
    if (!listing) return;
    dispatch(addToCart({
      listingId: listing.id,
      title: listing.title,
      price: convertToPLN(listing.price, listing.currency || 'PLN'),
      currency: 'PLN',
      // coverImage, not mediaUrls[0]: if the seller led with a video clip the cart row would
      // otherwise try to render it as an <img> and show nothing.
      image: coverImage(listing),
      sellerId: listing.sellerId,
      sellerName: listing.sellerName || seller?.fullName || 'Seller',
      // Delivery travels with the line, converted to PLN like the price above, so the cart
      // can show postage before checkout rather than after payment.
      shippingMethod: listing.shippingMethod,
      shippingPrice: convertToPLN(listing.shippingPrice || 0, listing.currency || 'PLN'),
    }));
    navigate('/checkout');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-[#CDFF00]/20 border-t-[#CDFF00] rounded-full animate-spin mx-auto" />
          <p className="text-gray-500 font-bold text-sm uppercase tracking-widest">Loading listing…</p>
        </div>
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
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
  const isEventType = listing.listingType === 'EVENT';
  const openSlots = slots.filter((s) => !s.booked);
  const showSlotPicker = SERVICE_TYPES.includes(listing.listingType) && openSlots.length > 0;
  // Cancelled tickets stay in the API response so the wallet can show them, but they're not
  // a way into this event — only valid and already-admitted ones count as "you're going".
  const liveTickets = myTickets.filter((t) => t.status !== 'CANCELLED');
  const eventStart = listing.eventStartsAt ? new Date(listing.eventStartsAt) : null;

  return (
    <div className="min-h-screen text-white pt-3 pb-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Header Row */}
        <div className="flex items-center justify-between mb-4">
          <Link
            to="/explore"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass-strong text-[9px] font-black uppercase tracking-widest hover:text-[#CDFF00] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Explore
          </Link>
          <div className="flex gap-2">
            <button
              onClick={toggleSave}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass-strong text-[9px] font-black uppercase tracking-widest transition-all hover:bg-white/5 active:scale-95 ${
                saved ? 'text-[#FF00FF]' : 'text-[#CDFF00]'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${saved ? 'fill-[#FF00FF]' : ''}`} /> {saved ? 'Saved' : 'Save'}
            </button>
            <button
              onClick={() => setShareOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass-strong text-[9px] font-black uppercase tracking-widest text-white hover:bg-white/5 active:scale-95 transition-all"
            >
              <Share2 className="w-3.5 h-3.5" /> Share
            </button>
          </div>
        </div>

        {/* 2-Column Layout */}
        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-6 lg:gap-8 items-start">
          {/* Left: Media — images and video clips in one gallery, with a resilient
              placeholder for anything that fails to load. */}
          <ListingGallery
            media={mediaList(listing)}
            title={listing.title}
            typeLabel={typeInfo.label}
          />

          {/* Right: Info & Actions */}
          <div className="flex flex-col gap-4">
            {/* Title */}
            <div>
              <motion.h1
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-xl sm:text-2xl font-black text-white mb-2 uppercase tracking-tighter leading-tight"
              >
                {listing.title}
              </motion.h1>
              <div className="flex flex-wrap items-center gap-3">
                {listing.avgRating > 0 && (
                  <div className="flex items-center gap-1.5 bg-[#CDFF00] text-black px-2 py-0.5 rounded-lg text-xs font-black">
                    <Star className="w-3 h-3 fill-black" /> {Number(listing.avgRating).toFixed(1)}
                  </div>
                )}
                {listing.locationCity && (
                  <div className="flex items-center gap-1.5 text-gray-500 text-[9px] font-black uppercase tracking-widest">
                    <MapPin className="w-3 h-3 text-[#CDFF00]" /> {listing.locationCity}
                  </div>
                )}
                {listing.sellerVerified && (
                  <div className="flex items-center gap-1.5 text-[#A855F7] text-[9px] font-black uppercase tracking-widest">
                    <ShieldCheck className="w-3 h-3" /> Trusted Merchant
                  </div>
                )}
              </div>

              {/* When and where — only events publish these, and a ticket is worthless
                  without them, so they sit right under the title rather than in the body. */}
              {isEventType && (eventStart || listing.eventVenue) && (
                <div className="flex flex-wrap items-center gap-3 mt-2.5">
                  {eventStart && (
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#CDFF00]/10 border border-[#CDFF00]/25 text-[#CDFF00] text-[10px] font-black uppercase tracking-widest">
                      <CalendarClock className="w-3 h-3" />
                      {eventStart.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
                      {' · '}
                      {eventStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                  {listing.eventVenue && (
                    <span className="flex items-center gap-1.5 text-gray-400 text-[10px] font-bold">
                      <MapPin className="w-3 h-3 text-[#CDFF00]" /> {listing.eventVenue}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Price & Actions */}
            <div className="p-4 rounded-2xl glass-strong border border-white/10 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-violet-600/10 blur-[80px]" />
              <div className="relative z-10">
                <div className="flex items-baseline gap-2 mb-3">
                  <span className="text-2xl sm:text-3xl font-black text-white tracking-wider">
                    {formatPrice(listing.price, listing.currency)}
                  </span>
                  {listing.negotiable && (
                    <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 bg-white/5 border border-white/10 text-[#CDFF00] rounded-md">
                      Negotiable
                    </span>
                  )}
                </div>

                {/* Delivery terms sit with the price, not in the description: they are part
                    of what this costs and part of what the seller is promising, and finding
                    them out at checkout is finding them out too late. Hidden for listings
                    with nothing to send. */}
                {(() => {
                  const method = getMethod(listing.shippingMethod);
                  if (!method || listing.shippingMethod === 'NONE') return null;
                  const postage = Number(listing.shippingPrice) || 0;
                  const Icon = method.icon;
                  return (
                    <div className="flex items-center gap-2 mb-3 text-[10px] font-black uppercase tracking-widest text-gray-400">
                      <Icon className="w-3.5 h-3.5 text-[#CDFF00]" />
                      <span>{method.label}</span>
                      <span className={postage > 0 ? 'text-white' : 'text-[#CDFF00]'}>
                        {postage > 0 ? `+ ${formatPrice(postage, listing.currency)}` : 'Free'}
                      </span>
                    </div>
                  );
                })()}

                {!isSeller && showSlotPicker && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {openSlots.map((s) => {
                        const active = selectedSlotId === s.id;
                        const start = new Date(s.startTime);
                        const end = new Date(s.endTime);
                        return (
                          <button
                            key={s.id}
                            onClick={() => setSelectedSlotId(s.id)}
                            className={`px-3 py-2 rounded-xl border text-left transition-all ${
                              active ? 'bg-[#CDFF00] border-[#CDFF00] text-black' : 'bg-white/5 border-white/10 text-white hover:border-white/25'
                            }`}
                          >
                            <span className="block text-[10px] font-black uppercase tracking-widest">{start.toLocaleDateString()}</span>
                            <span className="block text-xs font-bold">
                              {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}–{end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <button
                      onClick={handleBookSlot}
                      disabled={!selectedSlotId || slotBooking}
                      className="w-full py-2.5 rounded-xl bg-[#CDFF00] text-black font-black text-[11px] uppercase tracking-[0.2em] shadow-[0_10px_25px_rgba(205,255,0,0.25)] hover:scale-[1.01] transition-transform active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:hover:scale-100"
                    >
                      {slotBooking ? (
                        <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                      ) : (
                        <CalendarClock className="w-4 h-4" />
                      )}
                      Book this slot
                    </button>
                  </div>
                )}

                {!isSeller && isEventType && liveTickets.length > 0 && (
                  // Already holding tickets for this event: lead with the way in, not another
                  // sale. Buying more is still possible from the block underneath.
                  <div className="mb-3 p-3 rounded-xl bg-[#CDFF00]/10 border border-[#CDFF00]/30 space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#CDFF00] flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5" /> You're going
                    </p>
                    <p className="text-xs text-gray-300">
                      {liveTickets.length} ticket{liveTickets.length > 1 ? 's' : ''} in your wallet.
                      Show the QR at the door.
                    </p>
                    <Link
                      to={`/tickets/${liveTickets[0].id}`}
                      className="w-full py-2 rounded-lg bg-[#CDFF00] text-black font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 hover:bg-[#d9ff33] transition-colors"
                    >
                      <Ticket className="w-3.5 h-3.5" /> Open my ticket
                    </Link>
                  </div>
                )}

                {!isSeller && isEventType && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                        {liveTickets.length > 0 ? 'Buy more' : 'Tickets'}
                      </span>
                      <div className="flex items-center gap-3">
                        <button onClick={() => setTicketQty((q) => Math.max(1, q - 1))} className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/15 transition-colors">
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-sm font-black text-white w-5 text-center">{ticketQty}</span>
                        <button onClick={() => setTicketQty((q) => q + 1)} className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/15 transition-colors">
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <button
                      onClick={handleBuyTickets}
                      disabled={ticketLoading}
                      className="w-full py-2.5 rounded-xl bg-[#CDFF00] text-black font-black text-[11px] uppercase tracking-[0.2em] shadow-[0_10px_25px_rgba(205,255,0,0.25)] hover:scale-[1.01] transition-transform active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {ticketLoading ? (
                        <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                      ) : (
                        <Ticket className="w-4 h-4" />
                      )}
                      Buy {ticketQty > 1 ? `${ticketQty} Tickets` : 'Ticket'} — {formatPrice(listing.price * ticketQty, listing.currency)}
                    </button>
                  </div>
                )}

                {!isSeller && !showSlotPicker && !isEventType && (
                  <div className="space-y-2">
                    {/* Add to Cart */}
                    <button
                      onClick={handleAddToCart}
                      className={`w-full py-2.5 rounded-xl font-black text-[11px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-95 ${
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
                      className="w-full py-2.5 rounded-xl bg-[#CDFF00] text-black font-black text-[11px] uppercase tracking-[0.2em] shadow-[0_10px_25px_rgba(205,255,0,0.25)] hover:scale-[1.01] transition-transform active:scale-95 flex items-center justify-center gap-2 group"
                    >
                      <ShoppingCart className="w-4 h-4 group-hover:rotate-12 transition-transform" /> Buy Now
                    </button>

                    {/* Negotiate (only for negotiable listings) */}
                    {listing.negotiable && (
                      <button
                        onClick={handleNegotiate}
                        className="w-full py-2.5 rounded-xl border border-[#CDFF00]/40 text-[#CDFF00] font-black text-[11px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 hover:bg-[#CDFF00]/10 transition-all"
                      >
                        <HandCoins className="w-4 h-4" />
                        Negotiate via DM
                      </button>
                    )}

                    {/* Swap Mode — only when the seller opted this listing in to barter */}
                    {listing.swapEnabled && (
                      <button
                        onClick={() => (currentUser ? setSwapOpen(true) : navigate('/login'))}
                        className="w-full py-2.5 rounded-xl border border-[#FF00FF]/40 text-white font-black text-[11px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 bg-gradient-to-r from-[#FF00FF]/10 to-[#00FFFF]/10 hover:from-[#FF00FF]/20 hover:to-[#00FFFF]/20 transition-all"
                      >
                        <Repeat className="w-4 h-4" /> Offer a swap
                      </button>
                    )}
                  </div>
                )}

                {isSeller && isEventType && (
                  // The organiser's own view of their event: the useful action here isn't
                  // buying a ticket, it's working the door.
                  <Link
                    to={`/events/${listing.id}/door`}
                    className="w-full py-2.5 rounded-xl bg-[#CDFF00] text-black font-black text-[11px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-95 transition-transform"
                  >
                    <ScanLine className="w-4 h-4" /> Door & guest list
                  </Link>
                )}

                {isSeller && !isEventType && (
                  <div className="text-center py-2 text-gray-500 text-xs font-bold uppercase tracking-widest">
                    This is your listing
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
            <div>
              <h4 className="text-[9px] font-black uppercase tracking-widest text-[#CDFF00] mb-1.5 opacity-40">About</h4>
              <p className="text-sm text-gray-300 leading-relaxed font-medium opacity-90">
                {listing.description}
              </p>
            </div>

            {/* Event Updates */}
            {isEventType && (
              <div>
                <h4 className="text-[9px] font-black uppercase tracking-widest text-[#CDFF00] mb-2.5 opacity-40">Event Updates</h4>

                {isSeller && (
                  <div className="mb-3 p-3 rounded-2xl border border-white/10 bg-white/[0.03]">
                    <textarea
                      value={updateText}
                      onChange={(e) => setUpdateText(e.target.value)}
                      placeholder="Post an update about your event…"
                      rows={2}
                      className="w-full bg-transparent text-sm text-white placeholder-gray-500 outline-none resize-none"
                    />
                    {updateImagePreview && (
                      <img src={updateImagePreview} alt="" className="mt-2 max-h-32 rounded-xl object-cover" />
                    )}
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
                      <label className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white cursor-pointer transition-colors">
                        <ImageIcon className="w-4 h-4" />
                        <input type="file" accept="image/*" hidden onChange={handleUpdateImage} />
                      </label>
                      <button
                        onClick={handlePostUpdate}
                        disabled={postingUpdate || (!updateText.trim() && !updateImage)}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#CDFF00] text-black text-[10px] font-black uppercase tracking-widest hover:bg-[#d9ff33] transition-all disabled:opacity-50"
                      >
                        <Send className="w-3 h-3" /> Post
                      </button>
                    </div>
                  </div>
                )}

                {eventUpdates.length === 0 ? (
                  <p className="text-xs text-gray-500">No updates posted yet.</p>
                ) : (
                  <div className="space-y-2.5">
                    {eventUpdates.map((post) => (
                      <div key={post.id} className="p-3 rounded-2xl border border-white/10 bg-white/[0.02]">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-xs font-bold text-white">{post.authorName}</span>
                          <span className="text-[10px] text-gray-600">{new Date(post.createdAt).toLocaleDateString()}</span>
                        </div>
                        {post.content && <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{post.content}</p>}
                        {post.media?.[0]?.url && (
                          <SmartImage src={post.media[0].url} alt="" className="mt-2 max-h-56 w-full h-56 rounded-xl object-cover" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Seller Card */}
            <div className="pt-3 border-t border-white/5">
              <div
                onClick={() => listing.sellerId && navigate(`/profile/${listing.sellerId}`)}
                className="flex items-center gap-3 p-3 rounded-2xl glass-violet border border-white/10 hover:border-white/20 transition-all cursor-pointer group"
              >
                <div className="w-11 h-11 rounded-full overflow-hidden bg-gray-800 border border-white/10 shrink-0">
                  {(listing.sellerAvatarUrl || seller?.avatarUrl) ? (
                    <img src={uploadUrl(listing.sellerAvatarUrl || seller.avatarUrl)} alt={listing.sellerName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-lg font-black text-[#CDFF00]">
                      {(listing.sellerName || 'S')[0].toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h5 className="text-sm font-black text-white uppercase tracking-tight group-hover:text-[#CDFF00] transition-colors truncate">
                      {listing.sellerName || seller?.fullName || 'Seller'}
                    </h5>
                    {listing.sellerVerified && <BadgeCheck className="w-3.5 h-3.5 text-[#CDFF00] shrink-0" />}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">
                      {listing.reviewCount > 0 ? `${listing.reviewCount} reviews` : 'Seller on HustleSpace'}
                    </span>
                    <DistanceBadge lat={seller?.latitude} lng={seller?.longitude} />
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (listing.sellerId) navigate(`/dm/${listing.sellerId}`);
                  }}
                  className="w-9 h-9 rounded-xl glass-strong flex items-center justify-center group-hover:bg-[#CDFF00]/10 transition-colors shrink-0"
                >
                  <MessageSquare className="w-4 h-4 text-white group-hover:text-[#CDFF00]" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {shareOpen && <ShareModal type="listing" item={listing} onClose={() => setShareOpen(false)} />}
      {swapOpen && (
        <SwapOfferModal
          listing={listing}
          onClose={() => setSwapOpen(false)}
        />
      )}
    </div>
  );
}
