import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useSelector } from 'react-redux';
import { selectIsAuthenticated } from '../store/authSlice';
import { ticketsApi, listingsApi } from '../api/client';
import {
  ArrowLeft, ScanLine, CheckCircle2, XCircle, Camera, CameraOff,
  Search, Users, DoorOpen, RefreshCw, AlertTriangle,
} from 'lucide-react';
import HeroBrief from '../components/HeroBrief';

/**
 * The organiser's door screen for one event: scan people in, and see who's arrived.
 *
 * Two ways to admit someone, because a door is not a controlled environment:
 *
 *  1. **Camera scan** — uses the browser's built-in `BarcodeDetector`. It is feature-detected
 *     rather than assumed: the API ships in Chrome and Edge but not in Safari or Firefox, and
 *     it also requires a secure context, so the camera button simply doesn't appear where it
 *     wouldn't work instead of failing when pressed.
 *  2. **Typing the code** — always available, works on every browser, and is what gets used
 *     when the attendee's screen is cracked, their battery is dead, or the light is wrong.
 *
 * Both routes hit the same endpoint and render the same result, so there's one behaviour to
 * reason about rather than two.
 */
export default function EventDoor() {
  const { listingId } = useParams();
  const navigate = useNavigate();
  const isAuthenticated = useSelector(selectIsAuthenticated);

  const [listing, setListing] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState('');

  const [manualCode, setManualCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [filter, setFilter] = useState('');

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  // Guards against the detector firing on the same QR frame after frame while the code is
  // still in front of the lens — without it a single ticket would be submitted dozens of
  // times a second and the door would flash "already checked in" at a valid attendee.
  const lastScannedRef = useRef({ value: '', at: 0 });

  const cameraSupported = typeof window !== 'undefined' && 'BarcodeDetector' in window;

  const loadDoor = useCallback(async () => {
    try {
      const [ticketsRes, summaryRes] = await Promise.all([
        ticketsApi.forEvent(listingId),
        ticketsApi.doorSummary(listingId),
      ]);
      setTickets(ticketsRes.data);
      setSummary(summaryRes.data);
      setDenied('');
    } catch (e) {
      setDenied(e.response?.data?.error || "You don't run this event.");
    }
  }, [listingId]);

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return; }
    setLoading(true);
    listingsApi.getById(listingId).then((r) => setListing(r.data)).catch(() => {});
    loadDoor().finally(() => setLoading(false));
  }, [listingId, isAuthenticated, navigate, loadDoor]);

  /** Submits a code (scanned or typed) and folds the answer back into the door state. */
  const submitCode = useCallback(async (code) => {
    const trimmed = (code || '').trim();
    if (!trimmed || scanning) return;

    setScanning(true);
    try {
      const res = await ticketsApi.scan(listingId, trimmed);
      setLastResult(res.data);
      setSummary((prev) => ({
        ...(prev || {}),
        checkedIn: res.data.checkedInCount,
        issued: res.data.totalTickets,
        expected: Math.max(0, res.data.totalTickets - res.data.checkedInCount),
      }));
      // Refresh the attendee list so the row for the person who just walked in flips over.
      if (res.data.admitted) loadDoor();
    } catch (e) {
      setLastResult({
        admitted: false,
        outcome: 'ERROR',
        reason: e.response?.data?.error || 'Could not reach the door service',
      });
    } finally {
      setScanning(false);
    }
  }, [listingId, scanning, loadDoor]);

  // ── Camera scanning ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!cameraOn || !cameraSupported) return;

    let stopped = false;
    let timer;
    // eslint-disable-next-line no-undef
    const detector = new window.BarcodeDetector({ formats: ['qr_code'] });

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          // facingMode "environment" asks for the rear camera — the one actually pointed at
          // the queue. Browsers fall back to whatever camera exists if there's no rear one.
          video: { facingMode: 'environment' },
        });
        if (stopped) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        tick();
      } catch {
        setCameraError('Camera unavailable — check permissions, or type the code instead.');
        setCameraOn(false);
      }
    };

    const tick = async () => {
      if (stopped || !videoRef.current) return;
      try {
        const codes = await detector.detect(videoRef.current);
        if (codes.length > 0) {
          const value = codes[0].rawValue;
          const now = Date.now();
          // Same code within 3s is the same physical ticket still in frame — ignore it.
          const isRepeat = value === lastScannedRef.current.value && now - lastScannedRef.current.at < 3000;
          if (!isRepeat) {
            lastScannedRef.current = { value, at: now };
            submitCode(value);
          }
        }
      } catch {
        // A dropped frame isn't worth surfacing — the next poll will pick the code up.
      }
      // Polling at ~4/s rather than every animation frame: fast enough that a code held up to
      // the lens is read instantly, slow enough not to pin the CPU on an organiser's phone.
      timer = setTimeout(tick, 250);
    };

    start();

    return () => {
      stopped = true;
      clearTimeout(timer);
      // Releasing the tracks is what actually turns the camera light off. Skipping this leaves
      // the camera running in the background after the organiser closes the scanner.
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [cameraOn, cameraSupported, submitCode]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#CDFF00]/20 border-t-[#CDFF00] rounded-full animate-spin" />
      </div>
    );
  }

  if (denied) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center space-y-4 max-w-sm">
          <AlertTriangle className="w-14 h-14 mx-auto text-gray-700" />
          <h2 className="text-xl font-black text-white uppercase tracking-tight">{denied}</h2>
          <p className="text-xs text-gray-500">Only the organiser who posted an event can work its door.</p>
          <Link to="/dashboard" className="px-8 py-3 rounded-2xl bg-[#CDFF00] text-black font-black text-sm uppercase tracking-widest inline-block">
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  const visible = tickets.filter((t) => {
    if (!filter.trim()) return true;
    const q = filter.trim().toLowerCase();
    return (t.ownerName || '').toLowerCase().includes(q) || (t.ticketCode || '').toLowerCase().includes(q);
  });

  return (
    <div className="min-h-screen text-white">
      <HeroBrief title="Door" />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-14">
        <div className="flex items-center justify-between mb-4">
          <Link
            to={`/listing/${listingId}`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass-strong text-[9px] font-black uppercase tracking-widest hover:text-[#CDFF00] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Event
          </Link>
          <button
            onClick={loadDoor}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass-strong text-[9px] font-black uppercase tracking-widest text-gray-400 hover:text-white transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>

        {listing && (
          <h2 className="text-lg font-black text-white uppercase tracking-tight mb-4 truncate">{listing.title}</h2>
        )}

        {/* Head count */}
        <div className="grid grid-cols-3 gap-2.5 mb-5">
          <Stat label="Checked in" value={summary?.checkedIn ?? 0} accent />
          <Stat label="Expected" value={summary?.expected ?? 0} />
          <Stat label="Issued" value={summary?.issued ?? 0} />
        </div>

        {/* Scanner */}
        <div className="glass rounded-2xl p-4 border border-white/5 mb-5">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3 flex items-center gap-1.5">
            <ScanLine className="w-3.5 h-3.5 text-[#CDFF00]" /> Admit a guest
          </h3>

          {cameraOn && (
            <div className="relative rounded-xl overflow-hidden border border-[#CDFF00]/30 mb-3 bg-black">
              <video ref={videoRef} muted playsInline className="w-full max-h-64 object-cover" />
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-40 h-40 border-2 border-[#CDFF00]/70 rounded-2xl" />
              </div>
            </div>
          )}

          {cameraError && (
            <p className="text-[10px] font-bold text-red-400 mb-2">{cameraError}</p>
          )}

          <div className="flex flex-col sm:flex-row gap-2.5">
            <input
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { submitCode(manualCode); setManualCode(''); }
              }}
              placeholder="HU-XXXX-XXXX"
              // Uppercase + wide tracking so a typed code visually matches the printed ticket.
              className="flex-1 bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-sm font-mono tracking-[0.15em] text-white placeholder-gray-600 outline-none focus:border-[#CDFF00]"
            />
            <button
              onClick={() => { submitCode(manualCode); setManualCode(''); }}
              disabled={scanning || !manualCode.trim()}
              className="px-5 py-3 rounded-xl bg-[#CDFF00] text-black font-black text-[11px] uppercase tracking-[0.2em] hover:scale-[1.01] active:scale-95 transition-transform disabled:opacity-40 disabled:hover:scale-100 flex items-center justify-center gap-2"
            >
              <DoorOpen className="w-4 h-4" /> Admit
            </button>
            {cameraSupported && (
              <button
                onClick={() => { setCameraError(''); setCameraOn((on) => !on); }}
                className={`px-5 py-3 rounded-xl border font-black text-[11px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 ${
                  cameraOn
                    ? 'border-red-500/40 text-red-400 hover:bg-red-500/10'
                    : 'border-[#CDFF00]/40 text-[#CDFF00] hover:bg-[#CDFF00]/10'
                }`}
              >
                {cameraOn ? <><CameraOff className="w-4 h-4" /> Stop</> : <><Camera className="w-4 h-4" /> Scan</>}
              </button>
            )}
          </div>

          {!cameraSupported && (
            <p className="text-[9px] text-gray-600 mt-2 leading-relaxed">
              This browser can't scan QR codes directly. Type the code printed on the guest's ticket —
              it admits them exactly the same way. (Chrome or Edge enable the camera scanner.)
            </p>
          )}

          {/* Scan result */}
          <AnimatePresence mode="wait">
            {lastResult && (
              <motion.div
                key={`${lastResult.outcome}-${lastResult.ticket?.id || 'none'}-${lastResult.checkedInCount}`}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`mt-3 flex items-center gap-3 px-4 py-3 rounded-xl border ${
                  lastResult.admitted
                    ? 'bg-emerald-500/10 border-emerald-500/30'
                    : 'bg-red-500/10 border-red-500/30'
                }`}
              >
                {lastResult.admitted
                  ? <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                  : <XCircle className="w-6 h-6 text-red-400 shrink-0" />}
                <div className="min-w-0">
                  <p className={`text-sm font-black uppercase tracking-tight ${lastResult.admitted ? 'text-emerald-400' : 'text-red-400'}`}>
                    {lastResult.ticket?.ownerName || lastResult.reason}
                  </p>
                  <p className="text-[10px] font-bold text-gray-400">
                    {lastResult.ticket?.ownerName ? lastResult.reason : lastResult.outcome.replace(/_/g, ' ').toLowerCase()}
                    {lastResult.ticket?.ticketCode && ` · ${lastResult.ticket.ticketCode}`}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Guest list */}
        <div className="glass rounded-2xl p-4 border border-white/5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-[#CDFF00]" /> Guest list
            </h3>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-600 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Name or code"
                className="bg-white/[0.04] border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-600 outline-none focus:border-[#CDFF00] w-40"
              />
            </div>
          </div>

          {visible.length === 0 ? (
            <p className="text-xs text-gray-600 py-6 text-center">
              {tickets.length === 0 ? 'No tickets issued for this event yet.' : 'Nobody matches that search.'}
            </p>
          ) : (
            <div className="divide-y divide-white/5">
              {visible.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className={`text-sm font-bold truncate ${t.status === 'CANCELLED' ? 'text-gray-600 line-through' : 'text-white'}`}>
                      {t.ownerName}
                    </p>
                    <p className="text-[9px] font-mono tracking-widest text-gray-600">
                      {t.ticketCode}
                      {t.ticketsInBooking > 1 && ` · ${t.ticketNumber}/${t.ticketsInBooking}`}
                    </p>
                  </div>
                  <span className={`shrink-0 px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${
                    t.status === 'CHECKED_IN' ? 'bg-emerald-500/15 text-emerald-400'
                      : t.status === 'CANCELLED' ? 'bg-red-500/15 text-red-400'
                      : 'bg-white/5 text-gray-400'
                  }`}>
                    {t.status === 'CHECKED_IN'
                      ? `In · ${t.checkedInAt ? new Date(t.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}`
                      : t.status === 'CANCELLED' ? 'Void' : 'Expected'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent = false }) {
  return (
    <div className={`rounded-2xl p-3 text-center border ${accent ? 'bg-[#CDFF00]/10 border-[#CDFF00]/30' : 'bg-white/[0.03] border-white/5'}`}>
      <p className={`text-2xl font-black leading-none ${accent ? 'text-[#CDFF00]' : 'text-white'}`}>{value}</p>
      <p className="text-[8px] font-black uppercase tracking-[0.2em] text-gray-500 mt-1.5">{label}</p>
    </div>
  );
}
