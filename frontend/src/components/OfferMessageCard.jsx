import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { bookingsApi, listingsApi } from '../api/client';
import { selectUser } from '../store/authSlice';
import { addToCart, closeCart } from '../store/cartSlice';
import { formatPrice } from '../utils/constants';

export default function OfferMessageCard({ bookingId }) {
  const user = useSelector(selectUser), dispatch = useDispatch(), navigate = useNavigate();
  const [booking, setBooking] = useState(null), [error, setError] = useState('');
  const [countering, setCountering] = useState(false), [price, setPrice] = useState('');
  const [busy, setBusy] = useState(false), [retry, setRetry] = useState(0);
  const pending = useRef(false);
  useEffect(() => {
    let active = true;
    const load = async () => {
      if (pending.current) return;
      try { const { data } = await bookingsApi.getById(bookingId); if (active && !pending.current) { setBooking(current => current && (current.version ?? 0) > (data.version ?? 0) ? current : data); setError(''); } }
      catch { if (active) setError('Could not refresh this offer. Retry before responding.'); }
    };
    load(); const timer = setInterval(load, 6000);
    return () => { active = false; clearInterval(timer); };
  }, [bookingId, retry]);
  const act = async action => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true); setError('');
    try { const { data } = await action(); setBooking(data); setCountering(false); setPrice(''); }
    catch (e) { setError(e.response?.data?.message || e.response?.data?.error || 'The offer may have changed. Refresh and retry.'); }
    finally { pending.current = false; setBusy(false); }
  };
  const addAgreement = async checkout => {
    setBusy(true);
    try {
      const { data: fresh } = await bookingsApi.getById(bookingId);
      if (fresh.status !== 'BOOKED' || ['PAID','TRANSFERRED','REFUNDED'].includes(fresh.paymentStatus)) throw new Error('This agreement is no longer awaiting payment.');
      const { data: listing } = await listingsApi.getById(fresh.listingId);
      dispatch(addToCart({ listingId: fresh.listingId, bookingId, quantity: 1, title: fresh.listingTitle, price: Number(fresh.agreedPrice), currency: fresh.currency, sellerId: fresh.sellerId, sellerName: fresh.sellerName, image: listing.mediaUrls?.[0], shippingMethod: listing.shippingMethod, shippingPrice: Number(listing.shippingPrice) || 0, checkoutFields: listing.checkoutFields }));
      if (checkout) { dispatch(closeCart()); navigate('/checkout'); }
    } catch (e) { setError(e.message || 'Could not open this agreement.'); }
    finally { setBusy(false); }
  };
  const open = ['INQUIRED', 'NEGOTIATING'].includes(booking?.status);
  const lastBy = booking?.lastOfferBy || (booking?.status === 'NEGOTIATING' ? booking?.sellerId : booking?.buyerId);
  const myTurn = open && lastBy !== user?.id;
  const value = booking?.agreedPrice ?? booking?.counterPrice ?? booking?.offeredPrice;
  const validPrice = /^\d+(\.\d{1,2})?$/.test(price) && Number(price) > 0 && Number(price) <= 1000000;
  return <article className={'w-[min(320px,75vw)] rounded-2xl border p-4 space-y-4 ' + (open ? 'border-green-500/40 bg-green-500/10' : 'border-white/15 bg-white/5')} aria-label="Price negotiation">
    <div><p className="text-xs font-semibold text-green-400 mb-1">{open ? 'NEGOTIATION' : booking?.status === 'BOOKED' ? 'DEAL AGREED' : booking?.status || 'Loading offer…'}</p><h3 className="font-bold text-sm">{booking?.listingTitle || 'Your offer'}</h3></div>
    {error && <p role="alert" className="text-xs text-red-400">{error} <button className="underline min-h-11" onClick={() => setRetry(n => n + 1)}>Refresh</button></p>}
    {booking && <>
      <div><p className="text-2xl font-bold">{formatPrice(value, booking.currency)}</p><p className="text-xs text-gray-400 mt-1">{open ? myTurn ? 'Their offer · your turn to respond' : 'Your offer · waiting for their reply' : booking.status === 'BOOKED' ? 'Both sides agreed. Payment is separate.' : 'This negotiation is closed.'}</p></div>
      {!!booking.negotiationHistory?.length && <details className="text-xs text-gray-400"><summary className="cursor-pointer min-h-8">Offer history ({booking.negotiationHistory.length})</summary><ol className="space-y-2 max-h-40 overflow-y-auto">{booking.negotiationHistory.map((round, i) => <li key={i} className="flex justify-between gap-2"><span>{round.offeredBy === user?.id ? 'You' : 'Them'}</span><span>{formatPrice(round.price, booking.currency)}</span></li>)}</ol></details>}
      {myTurn && <div className="grid grid-cols-2 gap-2"><button disabled={busy || !!error} onClick={() => act(() => bookingsApi.accept(bookingId, booking.version))} className="min-h-11 rounded-xl bg-green-500 text-black text-sm font-semibold disabled:opacity-50">Accept price</button><button disabled={busy || !!error} onClick={() => { setCountering(v => !v); setPrice(String(value)); }} className="min-h-11 rounded-xl border border-white/20 text-sm">Counter offer</button></div>}
      {myTurn && countering && <form onSubmit={e => { e.preventDefault(); if (validPrice) act(() => bookingsApi.counterOffer(bookingId, Number(price), booking.version)); }} className="space-y-2"><label className="text-xs block">Your counter ({booking.currency})<input autoFocus type="number" min="0.01" max="1000000" step="0.01" value={price} onChange={e => setPrice(e.target.value)} className="mt-2 w-full min-h-11 px-3 rounded-xl border border-white/20 bg-white/5" /></label><button disabled={busy || !validPrice} className="min-h-11 w-full bg-green-500 text-black rounded-xl text-sm font-semibold disabled:opacity-40">Send counter offer</button></form>}
      {open && <button disabled={busy} onClick={() => { if (window.confirm('Close this negotiation?')) act(() => bookingsApi.cancel(bookingId, 'Closed in chat')); }} className="min-h-11 text-xs text-gray-400 underline">{myTurn ? 'Decline negotiation' : 'Withdraw offer'}</button>}
      {booking.status === 'BOOKED' && booking.buyerId === user?.id && !['PAID','TRANSFERRED','REFUNDED'].includes(booking.paymentStatus) && <div className="space-y-2"><button disabled={busy} onClick={() => addAgreement(true)} className="w-full min-h-11 rounded-xl bg-[#CDFF00] text-black font-semibold text-sm">Continue to payment</button><button disabled={busy} onClick={() => addAgreement(false)} className="w-full min-h-11 rounded-xl border border-white/20 text-sm">Add agreed deal to cart</button></div>}
    </>}
  </article>;
}
