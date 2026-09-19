import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { CalendarRange, CircleCheck, Loader, ChevronLeft, Timer } from 'lucide-react';
import { shopServicesApi, shopAppointmentsApi, dispatchToast } from '../api/client';
import { selectUser, selectIsAuthenticated } from '../store/authSlice';
import { formatPrice } from '../utils/constants';

/**
 * The real "book an appointment" widget for an appointment-based shop's storefront.
 *
 * <p>Replaces a version of this exact panel that used to live inline in {@code ShopDetail} —
 * a day/time grid built from {@code buildAvailability()}, a function whose own comment said
 * "mock" and whose confirm button called nothing but a toast. It looked identical to a real
 * booking flow and did not book anything: no slot was reserved, no owner was told, and a
 * second visitor could "book" the exact same time with no conflict, because nothing was ever
 * recorded. This is the flow that actually is one, wired to the services/slots/appointments
 * API in {@code ShopServiceController}.
 *
 * <h3>Three steps, one component</h3>
 * <p>Service → slot → confirm. Kept as internal state rather than three routes because the
 * whole point is not losing your place — going back a step should feel instant, not like a
 * page load, and the shop page underneath never needs to know which step you're on.
 */
export default function AppointmentBooking({ shop }) {
  const currentUser = useSelector(selectUser);
  const isAuthenticated = useSelector(selectIsAuthenticated);

  const [services, setServices] = useState([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [service, setService] = useState(null);
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const [slot, setSlot] = useState(null);
  const [contact, setContact] = useState({
    fullName: currentUser?.fullName || '',
    email: currentUser?.email || '',
    phone: currentUser?.phone || '',
  });
  const [notes, setNotes] = useState('');
  const [booking, setBooking] = useState(false);
  const [confirmed, setConfirmed] = useState(null);

  useEffect(() => {
    shopServicesApi.list(shop.id)
      .then((r) => setServices((r.data || []).filter((s) => s.active)))
      .catch(() => setServices([]))
      .finally(() => setLoadingServices(false));
  }, [shop.id]);

  const openService = (s) => {
    setService(s);
    setSlot(null);
    setSelectedDay(null);
    setLoadingSlots(true);
    shopServicesApi.slots(shop.id, s.id)
      .then((r) => setSlots((r.data || []).filter((sl) => !sl.booked && new Date(sl.startTime) > new Date())))
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  };

  // Grouped by calendar day so the picker reads as "which day, then which time" rather than
  // one long list a customer has to scan for a date that's convenient.
  const days = useMemo(() => {
    const byDay = new Map();
    for (const s of slots) {
      const key = new Date(s.startTime).toDateString();
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key).push(s);
    }
    return Array.from(byDay.entries())
      .map(([key, daySlots]) => ({
        key,
        date: new Date(daySlots[0].startTime),
        slots: daySlots.sort((a, b) => new Date(a.startTime) - new Date(b.startTime)),
      }))
      .sort((a, b) => a.date - b.date);
  }, [slots]);

  const activeDay = days.find((d) => d.key === selectedDay) || days[0];

  useEffect(() => {
    if (!selectedDay && days.length > 0) setSelectedDay(days[0].key);
  }, [days, selectedDay]);

  const confirm = async () => {
    if (!contact.fullName.trim() || !contact.email.trim()) {
      dispatchToast('Your name and email are needed to confirm this', 'error');
      return;
    }
    setBooking(true);
    try {
      const res = await shopAppointmentsApi.book(shop.id, { slotId: slot.id, customer: contact, notes });
      setConfirmed(res.data);
      dispatchToast('Appointment booked!', 'success');
    } catch (e) {
      dispatchToast(e.response?.data?.message || 'That slot just went — pick another', 'error');
      // The slot we thought was open wasn't — drop it and let the customer see the rest.
      setSlots((prev) => prev.filter((s) => s.id !== slot.id));
      setSlot(null);
    } finally {
      setBooking(false);
    }
  };

  const Shell = ({ children }) => (
    <div className="p-5 sm:p-6 rounded-3xl sm:rounded-[32px] bg-white/[0.03] border border-white/10">
      <h5 className="text-[10px] font-black tracking-widest text-gray-500 mb-1 flex items-center gap-2">
        <CalendarRange className="w-3.5 h-3.5 text-[#CDFF00]" /> Book an appointment
      </h5>
      {children}
    </div>
  );

  if (confirmed) {
    return (
      <Shell>
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="text-center py-2">
          <motion.div
            initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 18 }}
            className="w-12 h-12 rounded-full bg-[#CDFF00] flex items-center justify-center mx-auto mb-3"
          >
            <CircleCheck className="w-6 h-6 text-black" strokeWidth={2.5} />
          </motion.div>
          <p className="text-sm font-black text-white">You're booked</p>
          <p className="text-xs text-gray-400 mt-1">
            {confirmed.serviceName} · {new Date(confirmed.startTime).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })} at{' '}
            {new Date(confirmed.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
          <p className="text-[11px] text-gray-500 mt-3">A confirmation is on its way to {confirmed.customerEmail}.</p>
        </motion.div>
      </Shell>
    );
  }

  if (loadingServices) {
    return (
      <Shell>
        <div className="space-y-2 mt-3">
          {[...Array(2)].map((_, i) => <div key={i} className="h-12 rounded-xl bg-white/[0.03] animate-pulse" />)}
        </div>
      </Shell>
    );
  }

  if (services.length === 0) {
    return (
      <Shell>
        <p className="text-xs text-gray-500 mt-2">This shop hasn't listed anything bookable yet.</p>
      </Shell>
    );
  }

  if (!isAuthenticated) {
    return (
      <Shell>
        <p className="text-xs text-gray-400 mb-4">Sign in to book a time with {shop.name}.</p>
        <Link
          to="/login"
          className="flex items-center justify-center w-full py-3 rounded-2xl bg-[#CDFF00] text-black text-[10px] font-black tracking-widest hover:bg-[#d9ff33] transition-colors"
        >
          Log in to book
        </Link>
      </Shell>
    );
  }

  // Step 1: which service.
  if (!service) {
    return (
      <Shell>
        <p className="text-xs text-gray-400 mb-4">Pick what you'd like to book.</p>
        <div className="space-y-2">
          {services.map((s) => (
            <button
              key={s.id}
              onClick={() => openService(s)}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 hover:border-[#CDFF00]/50 transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-lg bg-[#CDFF00]/10 flex items-center justify-center shrink-0">
                <Timer className="w-4 h-4 text-[#CDFF00]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{s.name}</p>
                <p className="text-[10px] font-black tracking-widest text-gray-500">{s.durationMinutes} min</p>
              </div>
              <span className="text-sm font-black text-[#CDFF00] shrink-0">{formatPrice(s.price, s.currency)}</span>
            </button>
          ))}
        </div>
      </Shell>
    );
  }

  // Step 3: contact details, once a slot is picked.
  if (slot) {
    return (
      <Shell>
        <button onClick={() => setSlot(null)} className="flex items-center gap-1 text-[10px] font-black tracking-widest text-gray-500 hover:text-white transition-colors mb-3">
          <ChevronLeft className="w-3 h-3" /> Back
        </button>
        <div className="p-3 rounded-xl bg-[#CDFF00]/10 border border-[#CDFF00]/20 mb-4">
          <p className="text-xs font-bold text-white">{service.name}</p>
          <p className="text-[11px] text-[#CDFF00] font-bold mt-0.5">
            {new Date(slot.startTime).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })} · {new Date(slot.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <div className="space-y-2.5">
          <input
            value={contact.fullName}
            onChange={(e) => setContact((c) => ({ ...c, fullName: e.target.value }))}
            placeholder="Your name"
            className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#CDFF00]"
          />
          <input
            type="email"
            value={contact.email}
            onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))}
            placeholder="Email"
            className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#CDFF00]"
          />
          <input
            type="tel"
            value={contact.phone}
            onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))}
            placeholder="Phone (optional)"
            className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#CDFF00]"
          />
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything the seller should know (optional)"
            rows={2}
            className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#CDFF00] resize-none"
          />
        </div>
        <button
          onClick={confirm}
          disabled={booking}
          className="w-full mt-4 py-3 rounded-2xl bg-[#CDFF00] text-black text-[10px] font-black tracking-widest hover:bg-[#d9ff33] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {booking ? <><Loader className="w-3.5 h-3.5 animate-spin" /> Booking…</> : 'Confirm appointment'}
        </button>
      </Shell>
    );
  }

  // Step 2: which slot.
  return (
    <Shell>
      <button onClick={() => setService(null)} className="flex items-center gap-1 text-[10px] font-black tracking-widest text-gray-500 hover:text-white transition-colors mb-3">
        <ChevronLeft className="w-3 h-3" /> {service.name}
      </button>

      {loadingSlots ? (
        <div className="h-24 rounded-xl bg-white/[0.03] animate-pulse" />
      ) : days.length === 0 ? (
        <p className="text-xs text-gray-500">No open times right now — check back soon.</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {days.map((d) => (
              <button
                key={d.key}
                onClick={() => setSelectedDay(d.key)}
                className={`px-2 py-2 rounded-xl text-[10px] font-bold tracking-wide transition-all ${
                  activeDay?.key === d.key ? 'bg-[#CDFF00] text-black' : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                {d.date.toLocaleDateString('en-GB', { weekday: 'short' })} {d.date.getDate()}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeDay?.key}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="grid grid-cols-2 gap-2"
            >
              {activeDay?.slots.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSlot(s)}
                  className="px-3 py-2.5 rounded-xl text-xs font-bold bg-white/5 text-white hover:bg-white/10 transition-all"
                >
                  {new Date(s.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </button>
              ))}
            </motion.div>
          </AnimatePresence>
        </>
      )}
    </Shell>
  );
}
