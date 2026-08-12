import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useSelector } from 'react-redux';
import { selectUser, selectIsAuthenticated } from '../store/authSlice';
import { ticketsApi } from '../api/client';
import { formatPrice } from '../utils/constants';
import { useToast } from '../context/ToastContext';
import {
  ArrowLeft, CalendarClock, MapPin, Ticket as TicketIcon, CheckCircle2,
  XCircle, User as UserIcon, ScanLine, DoorOpen,
} from 'lucide-react';
import SmartImage from '../components/SmartImage';
import TicketQr from '../components/TicketQr';
import { TicketStatusChip } from './Tickets';

/**
 * A single digital ticket — the screen the holder actually shows at the door.
 *
 * Everything on it is arranged around that one moment: the QR fills the top of the viewport,
 * the printed admission code sits directly under it for when a scanner won't cooperate, and
 * the event details are pushed below the fold. Once a ticket is used or cancelled the QR is
 * dimmed and captioned, so nobody stands at a door holding up a code that was never going to
 * work.
 */
export default function TicketDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useSelector(selectUser);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const { showToast } = useToast();

  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [checkingIn, setCheckingIn] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return; }
    setLoading(true);
    ticketsApi.getById(id)
      .then((r) => setTicket(r.data))
      .catch((e) => setError(e.response?.data?.error || 'That ticket could not be found.'))
      .finally(() => setLoading(false));
  }, [id, isAuthenticated, navigate]);

  const handleSelfCheckIn = async () => {
    setCheckingIn(true);
    try {
      const res = await ticketsApi.checkInSelf(id);
      setTicket(res.data);
      showToast("You're in — enjoy the event!", 'success');
    } catch (e) {
      showToast(e.response?.data?.error || 'Could not check in', 'error');
    } finally {
      setCheckingIn(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#CDFF00]/20 border-t-[#CDFF00] rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center space-y-4">
          <TicketIcon className="w-16 h-16 mx-auto text-gray-700" />
          <h2 className="text-2xl font-black text-white uppercase tracking-tight">{error || 'Not found'}</h2>
          <Link to="/tickets" className="px-8 py-3 rounded-2xl bg-[#CDFF00] text-black font-black text-sm uppercase tracking-widest inline-block">
            My tickets
          </Link>
        </div>
      </div>
    );
  }

  const startsAt = ticket.eventStartsAt ? new Date(ticket.eventStartsAt) : null;
  const isOwner = user?.id === ticket.ownerId;
  const isOrganiser = user?.id === ticket.organiserId;
  const usable = ticket.status === 'VALID';

  return (
    <div className="min-h-screen text-white pt-3 pb-14">
      <div className="max-w-md mx-auto px-4">
        <div className="flex items-center justify-between mb-4">
          <Link
            to="/tickets"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass-strong text-[9px] font-black uppercase tracking-widest hover:text-[#CDFF00] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Tickets
          </Link>
          <TicketStatusChip status={ticket.status} />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl overflow-hidden border border-white/10 bg-[#0A0A0A]"
        >
          {/* ── Stub: the scannable half ─────────────────────────────────── */}
          <div className="p-6 flex flex-col items-center text-center bg-gradient-to-b from-[#CDFF00]/[0.06] to-transparent">
            {isOwner && ticket.qrPayload ? (
              <TicketQr value={ticket.qrPayload} size={230} dimmed={!usable} />
            ) : (
              // Organisers reading an attendee's ticket deliberately don't receive the QR
              // payload from the API, so there is nothing to draw here — and nothing they
              // could accidentally hand to someone else.
              <div className="w-[230px] h-[230px] rounded-2xl bg-white/5 border border-white/10 flex flex-col items-center justify-center gap-2 px-6 text-center">
                <ScanLine className="w-7 h-7 text-gray-600" />
                <p className="text-[10px] font-bold text-gray-500 leading-snug">
                  Only the ticket holder can display the QR code. Scan it from their device at the door.
                </p>
              </div>
            )}

            {!usable && (
              <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-gray-500">
                {ticket.status === 'CHECKED_IN'
                  ? `Admitted${ticket.checkedInAt ? ` · ${new Date(ticket.checkedInAt).toLocaleString()}` : ''}`
                  : 'This ticket was cancelled or refunded'}
              </p>
            )}

            <div className="mt-4">
              <p className="text-[8px] font-black uppercase tracking-[0.3em] text-gray-600 mb-1">Ticket code</p>
              {/* Wide letter-spacing and a mono face so an organiser can read this out or key
                  it in without confusing similar-looking characters. */}
              <p className="font-mono text-lg font-black text-white tracking-[0.2em]">{ticket.ticketCode}</p>
              {ticket.ticketsInBooking > 1 && (
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mt-1">
                  Ticket {ticket.ticketNumber} of {ticket.ticketsInBooking}
                </p>
              )}
            </div>
          </div>

          {/* Perforation between stub and body */}
          <div className="relative h-6 flex items-center">
            <div className="absolute -left-3 w-6 h-6 rounded-full bg-black border border-white/10" />
            <div className="flex-1 border-t border-dashed border-white/15 mx-4" />
            <div className="absolute -right-3 w-6 h-6 rounded-full bg-black border border-white/10" />
          </div>

          {/* ── Body: what, when, where ──────────────────────────────────── */}
          <div className="p-5 space-y-4">
            <div className="flex gap-3">
              <SmartImage
                src={ticket.eventImageUrl}
                alt={ticket.eventTitle}
                fallbackIcon={TicketIcon}
                className="w-16 h-16 rounded-xl object-cover shrink-0"
              />
              <div className="min-w-0">
                <Link
                  to={`/listing/${ticket.listingId}`}
                  className="text-base font-black text-white uppercase tracking-tight leading-tight hover:text-[#CDFF00] transition-colors block"
                >
                  {ticket.eventTitle}
                </Link>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mt-1">
                  Hosted by {ticket.organiserName}
                </p>
              </div>
            </div>

            <dl className="grid grid-cols-1 gap-2.5 pt-1">
              <DetailRow
                icon={CalendarClock}
                label="When"
                value={startsAt
                  ? `${startsAt.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })} · ${startsAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                  : 'To be announced'}
              />
              <DetailRow
                icon={MapPin}
                label="Where"
                value={ticket.eventVenue || ticket.eventCity || 'To be announced'}
              />
              <DetailRow icon={UserIcon} label="Admits" value={ticket.ownerName} />
              {ticket.pricePaid != null && (
                <DetailRow
                  icon={TicketIcon}
                  label="Paid"
                  value={`${formatPrice(ticket.pricePaid, ticket.currency)}${
                    ticket.paymentStatus && ticket.paymentStatus !== 'PENDING'
                      ? ` · ${ticket.paymentStatus.replace('_', ' ').toLowerCase()}`
                      : ''
                  }`}
                />
              )}
            </dl>

            {/* Self-admission, for events with nobody working a door. */}
            {isOwner && usable && (
              <button
                onClick={handleSelfCheckIn}
                disabled={checkingIn}
                className="w-full py-3 rounded-xl bg-[#CDFF00] text-black font-black text-[11px] uppercase tracking-[0.2em] hover:scale-[1.01] active:scale-95 transition-transform flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {checkingIn
                  ? <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  : <DoorOpen className="w-4 h-4" />}
                Join the event
              </button>
            )}

            {isOwner && ticket.status === 'CHECKED_IN' && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <p className="text-xs font-bold text-emerald-400">You're in. Have a good one.</p>
              </div>
            )}

            {ticket.status === 'CANCELLED' && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/25">
                <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                <p className="text-xs font-bold text-red-400">
                  This ticket is void. If that's wrong, message the organiser.
                </p>
              </div>
            )}

            {isOrganiser && (
              <Link
                to={`/events/${ticket.listingId}/door`}
                className="w-full py-3 rounded-xl border border-[#CDFF00]/40 text-[#CDFF00] font-black text-[11px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 hover:bg-[#CDFF00]/10 transition-all"
              >
                <ScanLine className="w-4 h-4" /> Open door scanner
              </Link>
            )}

            <p className="text-[9px] text-gray-600 leading-relaxed text-center pt-1">
              Keep this code to yourself — anyone who scans it can take your place.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
        <Icon className="w-3.5 h-3.5 text-[#CDFF00]" />
      </div>
      <div className="min-w-0">
        <dt className="text-[8px] font-black uppercase tracking-[0.2em] text-gray-600">{label}</dt>
        <dd className="text-sm font-bold text-white truncate">{value}</dd>
      </div>
    </div>
  );
}
