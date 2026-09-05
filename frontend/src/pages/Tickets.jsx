import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useSelector } from 'react-redux';
import { selectIsAuthenticated } from '../store/authSlice';
import { ticketsApi } from '../api/client';
import { formatPrice } from '../utils/constants';
import { Ticket, MapPin, CalendarClock, CheckCircle2, XCircle, ArrowRight } from 'lucide-react';
import SmartImage from '../components/SmartImage';
import HeroBrief from '../components/HeroBrief';
import { uploadUrl } from '../config';

/**
 * The attendee's ticket wallet — every event they've booked, in one place.
 *
 * Split into upcoming and past rather than one flat list: the only ticket that matters when
 * you open this screen is the one for the event you're walking into, so anything still to come
 * sits at the top and everything finished collapses beneath it.
 */
export default function Tickets() {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const navigate = useNavigate();

  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return; }
    ticketsApi.my()
      .then((r) => setTickets(r.data))
      .catch(() => setTickets([]))
      .finally(() => setLoading(false));
  }, [isAuthenticated, navigate]);

  // A ticket counts as "past" once it's been used, voided, or its event start has gone by.
  // Tickets with no published start date stay in upcoming — better to keep showing a ticket
  // that might still be needed than to bury a live one under a "past" heading.
  const now = Date.now();
  const isPast = (t) =>
    t.status === 'CANCELLED' ||
    t.status === 'CHECKED_IN' ||
    (t.eventStartsAt && new Date(t.eventStartsAt).getTime() < now);

  const upcoming = tickets.filter((t) => !isPast(t));
  const past = tickets.filter(isPast);

  return (
    <div className="min-h-screen text-white">
      <HeroBrief title="My Tickets" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-14">
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="glass rounded-2xl h-28 animate-pulse border border-white/5" />
            ))}
          </div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-14 glass rounded-2xl border border-white/5">
            <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4 border border-white/5">
              <Ticket className="w-6 h-6 text-white/20" />
            </div>
            <h3 className="text-lg font-black text-white tracking-[0.1em] mb-2">No tickets yet</h3>
            <p className="text-gray-500 font-bold tracking-widest text-[10px] max-w-xs mx-auto leading-relaxed mb-5">
              Book an event and your digital ticket lands here instantly.
            </p>
            <Link
              to="/explore?type=EVENT"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#CDFF00] text-black font-black tracking-widest text-[9px] hover:scale-105 transition-all"
            >
              Find an event <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {upcoming.length > 0 && (
              <section>
                <h2 className="text-[10px] font-black tracking-[0.25em] text-[#CDFF00] mb-3 opacity-60">
                  Upcoming · {upcoming.length}
                </h2>
                <div className="space-y-3">
                  {upcoming.map((t, i) => <TicketRow key={t.id} ticket={t} index={i} />)}
                </div>
              </section>
            )}

            {past.length > 0 && (
              <section>
                <h2 className="text-[10px] font-black tracking-[0.25em] text-gray-600 mb-3">
                  Past & used · {past.length}
                </h2>
                <div className="space-y-3">
                  {past.map((t, i) => <TicketRow key={t.id} ticket={t} index={i} muted />)}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** One ticket in the wallet list. Tapping it opens the full ticket with its QR code. */
function TicketRow({ ticket, index, muted = false }) {
  const startsAt = ticket.eventStartsAt ? new Date(ticket.eventStartsAt) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.25), duration: 0.3 }}
    >
      <Link
        to={`/tickets/${ticket.id}`}
        className={`group flex items-stretch gap-0 rounded-2xl overflow-hidden border transition-all ${
          muted
            ? 'border-white/5 bg-white/[0.02] opacity-70 hover:opacity-100'
            : 'border-white/10 bg-white/[0.03] hover:border-[#CDFF00]/40'
        }`}
      >
        <SmartImage
          src={uploadUrl(ticket.eventImageUrl)}
          alt={ticket.eventTitle}
          fallbackIcon={Ticket}
          className="w-24 sm:w-32 shrink-0 object-cover"
        />

        {/* Perforation: the visual seam between the stub and the body of a real ticket. */}
        <div className="w-px bg-white/10 border-l border-dashed border-white/20" />

        <div className="flex-1 min-w-0 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-sm font-black text-white tracking-tight truncate group-hover:text-[#CDFF00] transition-colors">
                {ticket.eventTitle}
              </h3>
              <p className="text-[10px] font-black tracking-widest text-gray-600 mt-0.5">
                {ticket.ticketCode}
                {ticket.ticketsInBooking > 1 && ` · ${ticket.ticketNumber} of ${ticket.ticketsInBooking}`}
              </p>
            </div>
            <TicketStatusChip status={ticket.status} />
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[9px] font-black tracking-[0.1em] text-gray-500">
            <span className="flex items-center gap-1">
              <CalendarClock className="w-3 h-3 text-[#CDFF00]" />
              {startsAt
                ? `${startsAt.toLocaleDateString()} · ${startsAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : 'Date TBC'}
            </span>
            {(ticket.eventVenue || ticket.eventCity) && (
              <span className="flex items-center gap-1 truncate">
                <MapPin className="w-3 h-3 text-[#CDFF00]" /> {ticket.eventVenue || ticket.eventCity}
              </span>
            )}
            {ticket.pricePaid != null && (
              <span className="text-gray-400">{formatPrice(ticket.pricePaid, ticket.currency)}</span>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

/** Small status pill shared by the wallet list and the ticket detail screen. */
export function TicketStatusChip({ status }) {
  const map = {
    VALID: { label: 'Valid', className: 'bg-[#CDFF00]/15 text-[#CDFF00]', Icon: Ticket },
    CHECKED_IN: { label: 'Checked in', className: 'bg-emerald-500/15 text-emerald-400', Icon: CheckCircle2 },
    CANCELLED: { label: 'Cancelled', className: 'bg-red-500/15 text-red-400', Icon: XCircle },
  };
  const { label, className, Icon } = map[status] || map.VALID;

  return (
    <span className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded-md text-[8px] font-black tracking-widest ${className}`}>
      <Icon className="w-2.5 h-2.5" /> {label}
    </span>
  );
}
