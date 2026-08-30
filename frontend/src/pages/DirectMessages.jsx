import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useSelector } from 'react-redux';
import { selectUser, selectIsAuthenticated } from '../store/authSlice';
import { directMessagesApi, notificationsApi, usersApi, dispatchToast } from '../api/client';
import { formatPrice } from '../utils/constants';
import { uploadUrl } from '../config';
import { shortName } from '../utils/displayName';
import SmartImage from '../components/SmartImage';
import {
  MessageSquareOff, User, BadgeCheck, ArrowLeft,
  Paperclip, Smile, MoreVertical, Search, Send,
  Check, CheckCheck, Tag, X, Sticker as StickerIcon, RefreshCw, Flame, ShoppingBag, Heart, Sparkles
} from 'lucide-react';

/* Curated emoji + sticker sets for the composer pickers (no external deps). */
const EMOJI_CATEGORIES = [
  { name: 'Smileys', list: ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','😉','😍','🥰','😘','😜','🤪','😎','🤩','🥳','😏','😒','😔','😢','😭','😤','😡','🤯','😳','🥺','😴','🤔','🙄','😬','🤗','🫠'] },
  { name: 'Gestures', list: ['👍','👎','👏','🙌','🫶','💪','🙏','✌️','🤞','🤙','👊','✊','👋','🖐️','👀','🫡','🤷','🤦','💅','🤌'] },
  { name: 'Vibes', list: ['❤️','🧡','💛','💚','💙','💜','🖤','🔥','💯','✨','⭐','💫','💥','🎉','🎊','🎁','🏆','💰','💎','🚀','⚡','🌈','🌙','☀️'] },
  { name: 'Things', list: ['☕','🍕','🍔','🍟','🌮','🍩','🍦','🍺','🥂','🎧','📸','🎨','⚽','🏀','🎮','🎵','💻','📱','🛍️','🧵','✂️','💈','🍲','🎤'] },
];

const STICKERS = ['🔥','❤️','😂','👍','🎉','😍','🥳','💯','🙏','😎','🚀','💪','🤝','👀','✨','🏆','💎','⚡','🫶','😭','🤣','🥺','😤','🤯','🎁','☕','🍕','🎧','💰','🛍️','📸','🏁'];

/* ── Bond's valentine palette ─────────────────────────────────────────────────
   Every other surface in Messages is lime-on-black: marketplace negotiations,
   unread counts, verified badges. A Bond chat is the one conversation that isn't
   a transaction, so it gets rose instead — the colour is the label. Hearts carry
   the rest, from the ring around a match's avatar to the date the two of you
   matched, standing in for the day separator a thread with no messages lacks. */
const ROSE = '#FF4E8E';
const BLUSH = '#FFA6C9';

// See utils/displayName: a handle is returned whole, only a fallback real name is
// shortened to its first word.
const firstNameOf = (person) => (person ? shortName(person) : 'them');

/** The date a match happened, worded the way you'd say it out loud. */
const formatMatchDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const startOfDay = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  if (dayDiff === 0) return 'today';
  if (dayDiff === 1) return 'yesterday';
  if (dayDiff < 7) return `on ${d.toLocaleDateString([], { weekday: 'long' })}`;
  return `on ${d.toLocaleDateString([], { day: 'numeric', month: 'long' })}`;
};

/**
 * A scatter of faint hearts behind a valentine surface.
 *
 * Rose alone reads as "a pink box"; the hearts are what make it read as a match. Kept at
 * single-digit opacity and marked aria-hidden so it stays texture rather than content —
 * loud enough to notice, quiet enough to put text on top of.
 */
function HeartField({ count = 7, className = '' }) {
  return (
    <span aria-hidden="true" className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
      {[...Array(count)].map((_, i) => (
        <Heart
          key={i}
          className="absolute"
          style={{
            left: `${(i * 37 + 9) % 92}%`,
            top: `${(i * 53 + 12) % 78}%`,
            width: 10 + ((i * 7) % 14),
            height: 10 + ((i * 7) % 14),
            color: ROSE,
            fill: ROSE,
            opacity: 0.07 + (i % 3) * 0.025,
            transform: `rotate(${(i * 47) % 60 - 30}deg)`,
          }}
        />
      ))}
    </span>
  );
}

/**
 * The unopened Bond matches, dealt across the top of the chat list.
 *
 * These have no last message to sort by, so in a list ordered by recency they would sit
 * silently at the bottom under every marketplace thread — which is how a match quietly
 * becomes nothing. Giving them their own row makes the match itself the thing you act on.
 */
function NewMatchesStrip({ matches, onOpen, reduceMotion }) {
  return (
    <div className="px-3 pb-2 shrink-0">
      <div className="relative rounded-2xl border border-[#FF4E8E]/30 bg-gradient-to-b from-[#FF4E8E]/[0.12] via-[#FF4E8E]/[0.04] to-transparent p-3 overflow-hidden">
        <HeartField count={9} />

        <div className="relative flex items-center gap-1.5 mb-2.5">
          <motion.span
            animate={reduceMotion ? {} : { scale: [1, 1.18, 1] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            className="flex"
          >
            <Heart className="w-3.5 h-3.5" style={{ color: ROSE, fill: ROSE }} />
          </motion.span>
          <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: BLUSH }}>
            New matches
          </span>
          <span
            className="ml-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-black text-black tabular-nums"
            style={{ backgroundColor: ROSE }}
          >
            {matches.length}
          </span>
        </div>

        <div className="relative flex gap-3 overflow-x-auto scrollbar-hide">
          {matches.map((m) => (
            <motion.button
              key={m.id}
              onClick={() => onOpen(m.id)}
              whileHover={reduceMotion ? {} : { y: -2 }}
              whileTap={{ scale: 0.94 }}
              transition={SOFT_SPRING}
              className="shrink-0 w-[58px] flex flex-col items-center gap-1.5"
              aria-label={`Open your match with ${m.name || m.fullName}`}
            >
              <span
                className="relative w-[54px] h-[54px] rounded-full p-[2px]"
                style={{ background: `linear-gradient(135deg, ${ROSE}, ${BLUSH})` }}
              >
                <span className="block w-full h-full rounded-full overflow-hidden border-2 border-[#0A0A0A] bg-black">
                  {m.avatarUrl
                    ? <img src={uploadUrl(m.avatarUrl)} alt="" className="w-full h-full object-cover" />
                    : <span className="w-full h-full flex items-center justify-center text-sm font-black uppercase" style={{ color: ROSE }}>
                        {(m.name || m.fullName || 'U')[0]}
                      </span>}
                </span>
                <span
                  className="absolute -bottom-0.5 -right-0.5 w-[18px] h-[18px] rounded-full border-2 border-[#0A0A0A] flex items-center justify-center"
                  style={{ backgroundColor: ROSE }}
                >
                  <Heart className="w-2.5 h-2.5 text-white fill-white" />
                </span>
              </span>
              <span className="text-[10px] font-bold text-white/85 truncate w-full text-center">
                {firstNameOf(m)}
              </span>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Motion vocabulary ────────────────────────────────────────────────────────
   One shared set of transitions so every surface in this page moves with the
   same physics. Panels use a spring (they carry weight and travel distance);
   small strips and menus use a short eased tween so they feel instant. */
const PANEL_SPRING = { type: 'spring', stiffness: 260, damping: 30, mass: 0.9 };
const SOFT_SPRING = { type: 'spring', stiffness: 400, damping: 32 };
const QUICK_TWEEN = { duration: 0.18, ease: [0.22, 1, 0.36, 1] };

/* Collapsing strips (in-chat search, negotiation banner, attachment preview) all
   grow and shrink the same way, so the chat body never jumps. */
const STRIP_MOTION = {
  initial: { height: 0, opacity: 0 },
  animate: { height: 'auto', opacity: 1 },
  exit: { height: 0, opacity: 0 },
  transition: QUICK_TWEEN,
};

const getStatusLine = (person) => {
  if (!person) return '';
  if (person.online) return 'online';
  if (person.lastActive) {
    const d = new Date(person.lastActive);
    if (!isNaN(d.getTime())) return `last seen ${formatDayLabel(d).toLowerCase()} at ${formatClock(d)}`;
  }
  if (person.city) return person.city;
  return 'on HustleSpace';
};

const formatClock = (dateLike) => {
  const d = new Date(dateLike);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// Sidebar timestamp: clock time today, "Yesterday", weekday within a week, else date.
const formatSidebarTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const startOfDay = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  if (dayDiff === 0) return formatClock(d);
  if (dayDiff === 1) return 'Yesterday';
  if (dayDiff < 7) return d.toLocaleDateString([], { weekday: 'long' });
  return d.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const formatDayLabel = (dateLike) => {
  const d = new Date(dateLike);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const startOfDay = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  if (dayDiff === 0) return 'Today';
  if (dayDiff === 1) return 'Yesterday';
  if (dayDiff < 7) return d.toLocaleDateString([], { weekday: 'long' });
  return d.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' });
};

const dayKey = (iso) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'unknown';
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

function Avatar({ person, size = 12 }) {
  const px = { 10: 'w-10 h-10', 12: 'w-12 h-12' }[size] || 'w-12 h-12';
  return (
    <div className={`${px} rounded-full overflow-hidden bg-black border border-white/10 flex items-center justify-center shrink-0`}>
      {person?.avatarUrl
        ? <img src={uploadUrl(person.avatarUrl)} className="w-full h-full object-cover" />
        : <span className="text-[#CDFF00] font-black uppercase text-sm">{(person?.name || person?.fullName || 'U')[0]}</span>}
    </div>
  );
}

export default function DirectMessages() {
  const { partnerId } = useParams();
  const { state: navState } = useLocation();
  const user = useSelector(selectUser);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();

  const [partners, setPartners] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState(navState?.prefillMessage || '');
  const [activePartner, setActivePartner] = useState(partnerId || null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sendingIds, setSendingIds] = useState(new Set());
  const [listingContext, setListingContext] = useState(navState?.listing || null);
  // Composer extras: emoji/sticker picker, image attachment, in-chat search, header menu, lightbox
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTab, setPickerTab] = useState('emoji');
  const [attachedImage, setAttachedImage] = useState(null);
  const [attachedPreview, setAttachedPreview] = useState('');
  const [uploading, setUploading] = useState(false);
  const [msgSearchOpen, setMsgSearchOpen] = useState(false);
  const [msgQuery, setMsgQuery] = useState('');
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState(null);
  // Whether the open conversation started from a mutual Bond match — drives the valentine
  // treatment on the header and the thread. Checked via a dedicated endpoint (not just the
  // partners list' own isBondMatch field) so it's correct the moment a match is navigated to
  // from the swipe deck, before the 8s /partners poll has caught up.
  const [activeIsBondMatch, setActiveIsBondMatch] = useState(false);
  const [activeMatchedAt, setActiveMatchedAt] = useState(null);
  const scrollContainerRef = useRef(null);
  // Mirrors activePartner synchronously so an in-flight poll can tell whether the
  // conversation it was fetching is still the one on screen.
  const activePartnerRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  // Scroll bookkeeping: jump instantly when a conversation opens; afterwards only
  // scroll when a genuinely new message arrives (the 5s poll returns a fresh array
  // reference even when nothing changed, and must not touch the user's position).
  const jumpOnNextDataRef = useRef(true);
  const lastMsgKeyRef = useRef('');
  // The chat panel is now closable, and the partner list reloads every 8s. Without
  // this latch the "open the first conversation" convenience would re-fire on the
  // next poll and yank the panel back open a few seconds after the user closed it.
  const didAutoOpenRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return; }
    loadPartners();
    const partnerInterval = setInterval(loadPartners, 8000);
    return () => clearInterval(partnerInterval);
  }, [isAuthenticated, navigate]);

  const loadPartners = () => {
    Promise.allSettled([directMessagesApi.getPartners(), usersApi.getAll()])
      .then(([partnersRes, usersRes]) => {
        const partnerData = partnersRes.status === 'fulfilled' ? (partnersRes.value.data || []) : [];
        const userData = usersRes.status === 'fulfilled' ? (usersRes.value.data || []) : [];
        setPartners(partnerData);
        setAllUsers(userData);
        if (!didAutoOpenRef.current && !activePartner && partnerData.length > 0) {
          didAutoOpenRef.current = true;
          const first = partnerData[0].id;
          setActivePartner(first);
          // Auto-opening counts as opening: clear its badge like a real click would,
          // otherwise the first row shows a stale unread count it no longer has.
          setPartners((prev) => prev.map((p) => (p.id === first ? { ...p, unreadCount: 0 } : p)));
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    activePartnerRef.current = activePartner;
    if (activePartner) {
      setMessages([]);
      jumpOnNextDataRef.current = true;
      stickToBottomRef.current = true;
      loadMessages(activePartner);
      // Clear the notification bell once per conversation opened. This used to sit
      // inside loadMessages, which the 5s poll re-runs — so simply having a chat
      // open re-marked every notification read every five seconds, and the bell
      // could never accumulate a count while you were reading messages.
      notificationsApi.markAllRead().catch(() => {});
      const interval = setInterval(() => loadMessages(activePartner), 5000);
      return () => clearInterval(interval);
    }
  }, [activePartner]);

  useEffect(() => {
    if (!activePartner) { setActiveIsBondMatch(false); setActiveMatchedAt(null); return; }
    directMessagesApi.checkBondMatch(activePartner)
      .then((res) => {
        setActiveIsBondMatch(!!res.data?.isBondMatch);
        setActiveMatchedAt(res.data?.matchedAt || null);
      })
      .catch(() => { setActiveIsBondMatch(false); setActiveMatchedAt(null); });
  }, [activePartner]);

  const loadMessages = (id) => {
    directMessagesApi.getConversation(id)
      .then(res => {
        // Clearing the interval on close does not cancel a request already in flight. Without
        // this the response still arrived and repopulated a thread the user had just left,
        // which re-ran the scroll effect against a closing panel.
        if (activePartnerRef.current !== id) return;
        setMessages((prev) => {
          // Keep optimistic (still-sending) messages so a poll can't wipe an in-flight upload.
          const pending = prev.filter((m) => String(m.id).startsWith('tmp-'));
          return [...(res.data || []), ...pending];
        });
      })
      .catch(e => console.error(e));
  };

  // Scroll the message list itself, never scrollIntoView.
  //
  // scrollIntoView walks up the tree and scrolls EVERY scrollable ancestor to bring the
  // element into view, the page included. Tapping back to the chat list closes the thread
  // while a poll may still be in flight; when that response landed it changed `messages`,
  // re-ran this effect, and scrolled the document to chase an element inside a panel that
  // was already animating away — the thread lurching around under the user's finger as they
  // tried to leave it. Setting scrollTop on the container moves that one element and nothing
  // else, whatever is happening around it.
  const scrollToLatest = (smooth) => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  };

  /**
   * Keeps the thread pinned to the bottom while its own height is still settling.
   *
   * Opening a chat scrolled to scrollHeight once, on the render that first had messages —
   * but at that instant no photo in the thread had loaded, so scrollHeight was measured
   * against bubbles that were still nearly empty. Every image that decoded afterwards grew
   * the content below the fixed scrollTop, which reads on screen as the conversation
   * drifting upward on its own and leaving you parked somewhere in the middle of it.
   *
   * A ResizeObserver on the scrolling element re-pins on each of those growth steps, so the
   * bottom stays the bottom until the layout stops moving. `stickToBottomRef` is what makes
   * that safe: the moment the reader scrolls up to look at something, it goes false and
   * nothing drags them back down.
   */
  const stickToBottomRef = useRef(true);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el || !activePartner) return;
    const observer = new ResizeObserver(() => {
      if (stickToBottomRef.current) scrollToLatest(false);
    });
    observer.observe(el);
    // Also watch the content itself: the container is flex-sized and may never change size
    // while everything inside it does.
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => observer.disconnect();
  }, [activePartner]);

  /** Reader's intent, sampled on every scroll: are they still following the live end? */
  const handleThreadScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  useEffect(() => {
    // No open conversation means the panel is closing or gone; there is nothing to follow.
    if (!activePartner) return;

    const last = messages[messages.length - 1];
    const lastKey = last ? `${last.id}|${messages.length}` : '';
    if (jumpOnNextDataRef.current) {
      if (messages.length === 0) return; // wait for the conversation to load
      lastMsgKeyRef.current = lastKey;
      jumpOnNextDataRef.current = false;
      // Opening a chat always starts at the live end, and stays there while the photos in
      // it load — the ResizeObserver above does the staying.
      stickToBottomRef.current = true;
      scrollToLatest(false);
      return;
    }
    if (lastKey === lastMsgKeyRef.current) return; // poll refresh, nothing new — leave scroll alone
    lastMsgKeyRef.current = lastKey;
    const el = scrollContainerRef.current;
    const nearBottom = el ? el.scrollHeight - el.scrollTop - el.clientHeight < 150 : true;
    // Follow new messages only if already at the bottom, or it's one we just sent.
    if (nearBottom || last?.senderId === user?.id) {
      scrollToLatest(true);
    }
  }, [messages, user?.id, activePartner]); // eslint-disable-line react-hooks/exhaustive-deps

  // Shared optimistic-send plumbing: append a temp message (single gray tick),
  // run the request, swap in the server copy or roll back on failure.
  const optimisticSend = async (optimisticFields, request, onFail, failMessage) => {
    const tempId = `tmp-${Date.now()}`;
    const optimistic = { id: tempId, senderId: user?.id, receiverId: activePartner, createdAt: new Date().toISOString(), ...optimisticFields };
    setMessages((prev) => [...prev, optimistic]);
    setSendingIds((prev) => new Set(prev).add(tempId));
    try {
      const res = await request();
      setMessages((prev) => prev.map((m) => (m.id === tempId ? res.data : m)));
      return true;
    } catch (err) {
      console.error(err);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      onFail?.();
      // A rejected send used to vanish in silence: the bubble was pulled and nothing was
      // said, so a photo the server refused looked exactly like a photo that "didn't show".
      // 413 is the one worth naming, since the fix is the sender's to make.
      const status = err.response?.status;
      dispatchToast(
        err.response?.data?.error
        || (status === 413 ? 'That photo is too large to send.' : null)
        || failMessage
        || 'Could not send that. Check your connection and try again.',
        'error'
      );
      return false;
    } finally {
      setSendingIds((prev) => { const s = new Set(prev); s.delete(tempId); return s; });
    }
  };

  const sendMessage = async (e) => {
    e?.preventDefault();
    if (!activePartner || uploading) return;

    // Image branch: attached photo goes out as multipart, input text becomes the caption.
    if (attachedImage) {
      const file = attachedImage;
      const preview = attachedPreview;
      const caption = newMsg.trim();
      setUploading(true);
      setAttachedImage(null);
      setAttachedPreview('');
      setNewMsg('');
      const sent = await optimisticSend(
        { content: caption, messageType: 'IMAGE', mediaUrl: preview },
        () => directMessagesApi.sendImage(activePartner, file, caption),
        () => { setAttachedImage(file); setAttachedPreview(preview); setNewMsg(caption); },
        'Could not send that photo.'
      );
      // The optimistic bubble held this blob; once the server copy has replaced it (or the
      // send failed and the attachment was restored under a fresh preview) it is dead weight.
      if (sent) URL.revokeObjectURL(preview);
      setUploading(false);
      inputRef.current?.focus();
      return;
    }

    if (!newMsg.trim()) return;
    let content = newMsg;
    if (listingContext) content = `[Negotiation for: ${listingContext.title}] ${newMsg}`;
    setNewMsg('');
    setListingContext(null);
    inputRef.current?.focus();
    await optimisticSend(
      { content, messageType: 'TEXT' },
      () => directMessagesApi.sendMessage(activePartner, content),
      () => setNewMsg(content)
    );
  };

  // Stickers send immediately on tap — no input round-trip, like WhatsApp.
  const sendSticker = (glyph) => {
    if (!activePartner) return;
    setPickerOpen(false);
    optimisticSend(
      { content: glyph, messageType: 'STICKER' },
      () => directMessagesApi.sendMessage(activePartner, glyph, 'STICKER')
    );
  };

  // Insert an emoji at the caret position and restore focus.
  const insertEmoji = (emoji) => {
    const el = inputRef.current;
    const start = el?.selectionStart ?? newMsg.length;
    const end = el?.selectionEnd ?? newMsg.length;
    const next = newMsg.slice(0, start) + emoji + newMsg.slice(end);
    setNewMsg(next);
    requestAnimationFrame(() => {
      el?.focus();
      const pos = start + emoji.length;
      el?.setSelectionRange(pos, pos);
    });
  };

  const handleFilePick = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (attachedPreview) URL.revokeObjectURL(attachedPreview);
    setAttachedImage(file);
    setAttachedPreview(URL.createObjectURL(file));
    inputRef.current?.focus();
  };

  const clearAttachment = () => {
    if (attachedPreview) URL.revokeObjectURL(attachedPreview);
    setAttachedImage(null);
    setAttachedPreview('');
  };

  // Open a conversation. GET /direct-messages/:id marks it read server-side, but
  // that truth only reaches the list on the next 8s partner poll — so zero the
  // badge locally right away and the row stops looking unread the instant it's
  // clicked, rather than sitting bold for several seconds after being opened.
  const openChat = (id) => {
    setActivePartner(id);
    setPartners((prev) => prev.map((p) => (p.id === id ? { ...p, unreadCount: 0 } : p)));
  };

  // Dismiss the pop-out. Also drops the /dm/:partnerId segment so a refresh (or a
  // back/forward step) doesn't immediately reopen the chat the user just closed.
  const closeChat = () => {
    setActivePartner(null);
    if (partnerId) navigate('/dm', { replace: true });
  };

  // Esc closes the pop-out — but only once the lighter overlays it sits behind
  // (lightbox, picker, header menu, in-chat search) have had their turn.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      if (lightboxUrl) { setLightboxUrl(null); return; }
      if (pickerOpen) { setPickerOpen(false); return; }
      if (headerMenuOpen) { setHeaderMenuOpen(false); return; }
      if (msgSearchOpen) { setMsgSearchOpen(false); setMsgQuery(''); return; }
      if (activePartner) closeChat();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightboxUrl, pickerOpen, headerMenuOpen, msgSearchOpen, activePartner, partnerId]);

  const activePartnerData = partners.find(p => p.id === activePartner)
    || allUsers.find(p => p.id === activePartner)
    || { name: 'User', fullName: 'User' };

  // The dedicated bond-match check answers first for a match opened straight off the swipe
  // deck; the partners row catches up on the next poll. Either source will do.
  const matchedAtLabel = formatMatchDate(activeMatchedAt || activePartnerData.matchedAt);

  // Total unopened messages across every conversation, for the header pill.
  // Summed from the partner list we already poll rather than hitting
  // /unread-count separately — same number, one fewer request, and it stays in
  // step with the per-row badges instead of racing them.
  const totalUnread = useMemo(
    () => partners.reduce((sum, p) => sum + (p.unreadCount || 0), 0),
    [partners]
  );

  // Bond matches nobody has said anything in yet — the strip above the list owns these.
  const newMatches = useMemo(
    () => partners.filter((p) => p.isNewMatch),
    [partners]
  );

  const combinedList = useMemo(() => {
    const q = search.trim().toLowerCase();
    // Unopened matches are shown as faces in the strip, so listing them again below would
    // put the same people on screen twice. While searching the strip is hidden and they
    // come back into the list — a search that can't find someone you matched with is a
    // search that's lying about what's in your messages.
    const conversations = q ? partners : partners.filter((p) => !p.isNewMatch);

    const partnerIds = new Set(partners.map(p => p.id));
    const otherUsers = allUsers
      .filter(u => !partnerIds.has(u.id) && u.id !== user?.id)
      .map(u => ({ ...u, name: u.name || u.fullName }));
    const combined = [...conversations, ...otherUsers];
    if (!q) return combined;
    return combined.filter(p => (p.name || p.fullName || '').toLowerCase().includes(q));
  }, [partners, allUsers, user?.id, search]);

  // Precompute grouping: day separators + whether each bubble starts a sender-run.
  const timeline = useMemo(() => {
    const mq = msgQuery.trim().toLowerCase();
    const visible = mq
      ? messages.filter((m) => (m.content || '').toLowerCase().includes(mq))
      : messages;
    const rows = [];
    let prevDay = null;
    let prevSender = null;
    for (const msg of visible) {
      const key = dayKey(msg.createdAt);
      if (key !== prevDay) {
        rows.push({ type: 'day', id: `day-${key}`, label: formatDayLabel(msg.createdAt) });
        prevDay = key;
        prevSender = null;
      }
      rows.push({ type: 'msg', id: msg.id, msg, startsRun: msg.senderId !== prevSender });
      prevSender = msg.senderId;
    }
    return rows;
  }, [messages, msgQuery]);

  // Reset per-conversation UI (pickers, search, attachment) when switching chats.
  useEffect(() => {
    setPickerOpen(false);
    setMsgSearchOpen(false);
    setMsgQuery('');
    setHeaderMenuOpen(false);
    clearAttachment();
  }, [activePartner]); // eslint-disable-line react-hooks/exhaustive-deps

  // Shared card chrome: both floating panels read as the same physical object.
  const cardClass = 'rounded-[28px] border border-white/10 bg-[#0A0A0A]/80 backdrop-blur-2xl shadow-[0_28px_80px_-24px_rgba(0,0,0,0.95)] overflow-hidden';

  // Panels slide in from the side; with reduced motion they simply fade.
  const popOut = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, x: 56, scale: 0.96 },
        animate: { opacity: 1, x: 0, scale: 1 },
        exit: { opacity: 0, x: 56, scale: 0.96 },
      };

  return (
    <div className="h-[calc(100dvh-8.5rem-env(safe-area-inset-bottom))] md:h-[calc(100dvh-4rem)] overflow-hidden text-white font-sans">
      <div className="h-full max-w-[1600px] mx-auto px-3 sm:px-5 lg:px-8 py-3 sm:py-5">
        {/* Both panels float inside this row. `relative` anchors the mobile overlay. */}
        <div className="relative h-full flex items-stretch justify-center gap-4 lg:gap-6">

          {/* ── FLOATING CHAT LIST ──────────────────────────────────────────
              Widens to a centred card when nothing is open, then makes room as
              the conversation pops out beside it. `layout` tweens that width
              change for us, so the two panels settle together. */}
          <motion.aside
            layout={!reduceMotion}
            transition={PANEL_SPRING}
            className={`relative min-h-0 flex flex-col shrink-0 w-full ${cardClass} ${
              activePartner ? 'lg:w-[360px]' : 'lg:w-[460px]'
            }`}
          >
            {/* Header */}
            <div className="px-4 h-[60px] flex items-center justify-between shrink-0 border-b border-white/[0.07]">
              <h1 className="text-base font-black text-white uppercase tracking-tight flex items-center gap-2.5">
                <motion.span
                  className="w-2 h-2 rounded-full bg-[#CDFF00] shadow-[0_0_10px_#CDFF00]"
                  animate={reduceMotion ? {} : { opacity: [1, 0.35, 1], scale: [1, 0.82, 1] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                />
                Chats
                {/* Unread total. Keyed on the number so a change re-runs the pop
                    animation — the count visibly reacts when a message lands. */}
                <AnimatePresence mode="popLayout">
                  {totalUnread > 0 && (
                    <motion.span
                      key={totalUnread}
                      initial={{ opacity: 0, scale: 0.5, y: -4 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.5 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                      title={`${totalUnread} unread message${totalUnread === 1 ? '' : 's'}`}
                      className="px-2 py-0.5 rounded-full bg-[#CDFF00] text-black text-[10px] font-black tabular-nums shadow-[0_0_14px_-2px_#CDFF00]"
                    >
                      {totalUnread > 99 ? '99+' : totalUnread}
                    </motion.span>
                  )}
                </AnimatePresence>
              </h1>
              <motion.button
                whileHover={{ scale: 1.08, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                transition={SOFT_SPRING}
                className="p-2 rounded-xl hover:bg-white/[0.07] text-gray-500 hover:text-[#CDFF00] transition-colors"
              >
                <MoreVertical className="w-4 h-4" />
              </motion.button>
            </div>

            {/* Search */}
            <div className="px-3 py-3 shrink-0">
              {/* Focus styling is CSS-only here: Framer has no "while focus-within"
                  variant, and scaling a text field while typing fights the caret. */}
              <div className="flex items-center gap-2.5 bg-white/[0.04] border border-white/10 focus-within:border-[#CDFF00]/50 focus-within:bg-white/[0.06] rounded-2xl px-3.5 py-2.5 transition-colors">
                <Search className="w-4 h-4 text-gray-500 shrink-0" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  type="text"
                  placeholder="Search or start a new chat"
                  className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 outline-none"
                />
                <AnimatePresence>
                  {search && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.6, rotate: -90 }}
                      animate={{ opacity: 1, scale: 1, rotate: 0 }}
                      exit={{ opacity: 0, scale: 0.6, rotate: -90 }}
                      transition={SOFT_SPRING}
                      onClick={() => setSearch('')}
                      className="text-gray-500 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* New Bond matches. Hidden while searching — the search box filters
                conversations, and leaving a fixed row of faces above the results would
                contradict what the query says is on screen. */}
            <AnimatePresence initial={false}>
              {!loading && !search.trim() && newMatches.length > 0 && (
                <motion.div
                  key="new-matches"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={QUICK_TWEEN}
                  className="overflow-hidden shrink-0"
                >
                  <NewMatchesStrip matches={newMatches} onOpen={openChat} reduceMotion={reduceMotion} />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Conversation list */}
            <div className="flex-1 overflow-y-auto scrollbar-hide px-2.5 pb-3">
              {loading ? (
                <div className="space-y-2 px-0.5">
                  {[...Array(6)].map((_, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: [0.35, 0.7, 0.35] }}
                      transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.12 }}
                      className="h-[72px] rounded-2xl bg-white/[0.035]"
                    />
                  ))}
                </div>
              ) : combinedList.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="h-full flex flex-col items-center justify-center gap-3 text-center px-8"
                >
                  <Search className="w-7 h-7 text-gray-700" />
                  <p className="text-sm text-gray-500">No chats found</p>
                </motion.div>
              ) : (
                <AnimatePresence initial={false}>
                  {combinedList.map((p, i) => {
                    const isActive = p.id === activePartner;
                    const displayName = p.name || p.fullName;
                    // An unread row is styled like an unopened envelope: brighter
                    // surface, heavier name, full-strength preview text and a count
                    // badge. A read row stays muted. The open conversation is never
                    // "unread" — opening it is what clears the flag.
                    const unread = (p.unreadCount || 0) > 0 && !isActive;
                    // A Bond chat is the one conversation here that isn't a transaction, so
                    // it gets rose where every other row gets lime. Ranked above `unread`
                    // because a match you haven't replied to is still, first, a match.
                    const bond = !!p.isBondMatch;
                    // No `layout` prop here on purpose: a layout animation and the
                    // whileHover x-offset drive the same transform and visibly fight
                    // when the pointer rests on a row mid-reflow.
                    return (
                      <motion.button
                        key={p.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -16 }}
                        transition={{ ...SOFT_SPRING, delay: reduceMotion ? 0 : Math.min(i * 0.028, 0.32) }}
                        whileHover={reduceMotion ? {} : { x: 3 }}
                        whileTap={{ scale: 0.985 }}
                        onClick={() => openChat(p.id)}
                        aria-label={
                          bond
                            ? `${displayName}, matched on Bond${unread ? `, ${p.unreadCount} unread` : ''}`
                            : unread ? `${displayName}, ${p.unreadCount} unread` : displayName
                        }
                        // Deliberately not overflow-hidden: the shared activeChatGlow travels
                        // between rows, and clipping each row would hide it in transit. The
                        // heart texture clips itself instead.
                        className={`relative w-full text-left px-3 py-3 rounded-2xl flex items-center gap-3 mb-1 border transition-colors ${
                          isActive
                            ? bond
                              ? 'bg-[#FF4E8E]/[0.14] border-[#FF4E8E]/45'
                              : 'bg-[#FF00FF]/10 border-[#FF00FF]/30'
                            : bond
                              ? 'bg-[#FF4E8E]/[0.06] border-[#FF4E8E]/25 hover:bg-[#FF4E8E]/[0.11]'
                              : unread
                                ? 'bg-[#CDFF00]/[0.055] border-[#CDFF00]/20 hover:bg-[#CDFF00]/[0.09]'
                                : 'border-transparent hover:bg-white/[0.05]'
                        }`}
                      >
                        {bond && <HeartField count={5} className="rounded-2xl" />}

                        {/* Shared highlight that glides between rows as the selection moves. */}
                        {isActive && !reduceMotion && (
                          <motion.span
                            layoutId="activeChatGlow"
                            transition={PANEL_SPRING}
                            className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-8 rounded-r-full"
                            style={{
                              backgroundColor: bond ? ROSE : '#CDFF00',
                              boxShadow: `0 0 12px ${bond ? ROSE : '#CDFF00'}`,
                            }}
                          />
                        )}
                        <div className="relative shrink-0">
                          {/* Matches wear a rose ring, so a Bond chat is identifiable from
                              the avatar alone before any text is read. */}
                          {bond ? (
                            <span
                              className="block rounded-full p-[2px]"
                              style={{ background: `linear-gradient(135deg, ${ROSE}, ${BLUSH})` }}
                            >
                              <span className="block rounded-full border-2 border-[#0A0A0A]">
                                <Avatar person={p} size={10} />
                              </span>
                            </span>
                          ) : (
                            <Avatar person={p} size={12} />
                          )}
                          {p.online && (
                            <motion.span
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={SOFT_SPRING}
                              className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#00FFFF] border-2 border-[#0A0A0A]"
                            />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="flex items-center gap-1 min-w-0">
                              {/* Unread dot — the at-a-glance read/unread marker,
                                  readable even before the name weight registers. */}
                              {unread && (
                                <motion.span
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  transition={SOFT_SPRING}
                                  className="w-1.5 h-1.5 rounded-full bg-[#CDFF00] shrink-0 shadow-[0_0_6px_#CDFF00]"
                                />
                              )}
                              <span className={`text-sm truncate ${unread ? 'text-white font-black' : 'text-white font-bold'}`}>
                                {displayName}
                              </span>
                              {p.verified && <BadgeCheck className="w-3.5 h-3.5 text-[#CDFF00] shrink-0" />}
                              {bond && (
                                <motion.span
                                  animate={p.isNewMatch && !reduceMotion ? { scale: [1, 1.25, 1] } : {}}
                                  transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                                  className="flex shrink-0"
                                  title={p.matchedAt ? `Matched on Bond ${formatMatchDate(p.matchedAt)}` : 'Matched on Bond — not a sale'}
                                >
                                  <Heart className="w-3.5 h-3.5" style={{ color: ROSE, fill: ROSE }} />
                                </motion.span>
                              )}
                              {p.streak > 1 && (
                                <span className="flex items-center gap-0.5 text-[10px] font-bold text-orange-400 shrink-0" title={`${p.streak}-day streak`}>
                                  <Flame className="w-3 h-3 fill-orange-400" />{p.streak}
                                </span>
                              )}
                            </span>
                            <span
                              className={`text-[10px] shrink-0 font-bold ${unread ? 'text-[#CDFF00]' : 'text-gray-500'}`}
                              style={p.isNewMatch ? { color: BLUSH } : undefined}
                            >
                              {p.isNewMatch ? 'New match' : formatSidebarTime(p.lastMessageAt)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2 mt-0.5">
                            <p className={`text-xs truncate flex items-center gap-1 min-w-0 ${unread ? 'text-white font-semibold' : 'text-gray-400'}`}>
                              {p.lastMessage
                                ? <>
                                    {/* Double-tick only on a read row: on an unread one
                                        it would contradict the badge sitting next to it. */}
                                    {!unread && String(p.lastMessage).length > 0 && (
                                      <CheckCheck className="w-3.5 h-3.5 shrink-0 text-gray-600" />
                                    )}
                                    <span className="truncate">{p.lastMessage}</span>
                                  </>
                                : bond
                                  // A match with nothing said in it has no preview to show, and
                                  // "last seen Tuesday" is the wrong thing to say about one.
                                  ? <span className="truncate font-semibold" style={{ color: BLUSH }}>
                                      You matched {formatMatchDate(p.matchedAt)} — say hi 💗
                                    </span>
                                  : <span className="italic truncate text-gray-600">{getStatusLine(p)}</span>}
                            </p>
                            {/* The count of unopened messages from this person. */}
                            <AnimatePresence>
                              {unread && (
                                <motion.span
                                  initial={{ scale: 0, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  exit={{ scale: 0, opacity: 0 }}
                                  transition={{ type: 'spring', stiffness: 500, damping: 18 }}
                                  className="shrink-0 min-w-[20px] h-[20px] px-1.5 rounded-full bg-[#CDFF00] text-black text-[10px] font-black flex items-center justify-center tabular-nums shadow-[0_0_12px_-2px_#CDFF00]"
                                >
                                  {p.unreadCount > 99 ? '99+' : p.unreadCount}
                                </motion.span>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                      </motion.button>
                    );
                  })}
                </AnimatePresence>
              )}
            </div>
          </motion.aside>

          {/* ── CHAT POP-OUT ────────────────────────────────────────────────
              Slides in beside the list on desktop; on small screens it covers
              the list as a full overlay. Either way the ✕ dismisses it. */}
          <AnimatePresence mode="popLayout">
            {activePartner && (
              <motion.section
                key="chat-panel"
                layout={!reduceMotion}
                {...popOut}
                transition={PANEL_SPRING}
                className={`absolute inset-0 z-30 lg:static lg:z-auto lg:flex-1 min-w-0 min-h-0 flex flex-col ${cardClass}`}
              >
                {/* Chat header */}
                <div className="h-[60px] px-3 sm:px-4 border-b border-white/[0.07] flex items-center gap-2 sm:gap-3 shrink-0">
                  <motion.button
                    whileHover={{ scale: 1.08, x: -2 }}
                    whileTap={{ scale: 0.9 }}
                    transition={SOFT_SPRING}
                    onClick={closeChat}
                    className="lg:hidden p-1.5 -ml-1 rounded-xl hover:bg-white/[0.07] text-gray-400 hover:text-white"
                    aria-label="Back to chats"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </motion.button>

                  <Link to={`/profile/${activePartner}`} className="flex items-center gap-3 min-w-0 flex-1 group">
                    <motion.div whileHover={reduceMotion ? {} : { scale: 1.07 }} transition={SOFT_SPRING}>
                      {activeIsBondMatch ? (
                        <span
                          className="block rounded-full p-[2px]"
                          style={{ background: `linear-gradient(135deg, ${ROSE}, ${BLUSH})` }}
                        >
                          <span className="block rounded-full border-2 border-[#0A0A0A]">
                            <Avatar person={activePartnerData} size={10} />
                          </span>
                        </span>
                      ) : (
                        <Avatar person={activePartnerData} size={10} />
                      )}
                    </motion.div>
                    <div className="min-w-0">
                      <h3 className={`text-sm font-bold text-white truncate flex items-center gap-1.5 leading-tight transition-colors ${
                        activeIsBondMatch ? 'group-hover:text-[#FFA6C9]' : 'group-hover:text-[#CDFF00]'
                      }`}>
                        {activePartnerData.name || activePartnerData.fullName}
                        {activePartnerData.verified && <BadgeCheck className="w-3.5 h-3.5 text-[#CDFF00]" />}
                        {activeIsBondMatch && (
                          <Heart
                            className="w-3.5 h-3.5 shrink-0"
                            style={{ color: ROSE, fill: ROSE }}
                            title="Matched on Bond — not a sale"
                          />
                        )}
                        {activePartnerData.streak > 1 && (
                          <span className="flex items-center gap-0.5 text-[11px] font-bold text-orange-400 shrink-0">
                            <Flame className="w-3.5 h-3.5 fill-orange-400" />{activePartnerData.streak}
                          </span>
                        )}
                      </h3>
                      <p className="text-[11px] truncate leading-tight mt-0.5 flex items-center gap-1">
                        {activeIsBondMatch ? (
                          <span className="font-semibold" style={{ color: BLUSH }}>
                            Matched on Bond{matchedAtLabel && ` ${matchedAtLabel}`}
                          </span>
                        ) : (
                          <span className="text-gray-500">{getStatusLine(activePartnerData)}</span>
                        )}
                      </p>
                    </div>
                  </Link>

                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    transition={SOFT_SPRING}
                    onClick={() => { setMsgSearchOpen((v) => { if (v) setMsgQuery(''); return !v; }); }}
                    className={`p-2 rounded-xl hover:bg-white/[0.07] transition-colors ${msgSearchOpen ? 'text-[#CDFF00]' : 'text-gray-500'}`}
                    aria-label="Search in conversation"
                  >
                    <Search className="w-[18px] h-[18px]" />
                  </motion.button>

                  <div className="relative">
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      transition={SOFT_SPRING}
                      onClick={() => setHeaderMenuOpen((v) => !v)}
                      className={`p-2 rounded-xl hover:bg-white/[0.07] transition-colors ${headerMenuOpen ? 'text-white' : 'text-gray-500'}`}
                      aria-label="Conversation menu"
                    >
                      <MoreVertical className="w-[18px] h-[18px]" />
                    </motion.button>
                    <AnimatePresence>
                      {headerMenuOpen && (
                        <>
                          <div className="fixed inset-0 z-30" onClick={() => setHeaderMenuOpen(false)} />
                          <motion.div
                            initial={{ opacity: 0, scale: 0.92, y: -6 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.92, y: -6 }}
                            transition={QUICK_TWEEN}
                            style={{ transformOrigin: 'top right' }}
                            className="absolute right-0 top-full mt-2 w-48 py-1.5 bg-[#111] border border-white/10 rounded-2xl shadow-2xl z-40 overflow-hidden"
                          >
                            <Link
                              to={`/profile/${activePartner}`}
                              onClick={() => setHeaderMenuOpen(false)}
                              className="flex items-center gap-3 px-4 py-2.5 text-sm text-white hover:bg-white/[0.07] font-semibold transition-colors"
                            >
                              <User className="w-4 h-4 text-gray-500" /> View profile
                            </Link>
                            <button
                              onClick={() => { loadMessages(activePartner); setHeaderMenuOpen(false); }}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white hover:bg-white/[0.07] text-left font-semibold transition-colors"
                            >
                              <RefreshCw className="w-4 h-4 text-gray-500" /> Refresh chat
                            </button>
                            <button
                              onClick={() => { setHeaderMenuOpen(false); closeChat(); }}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white hover:bg-white/[0.07] text-left font-semibold transition-colors"
                            >
                              <X className="w-4 h-4 text-gray-500" /> Close chat
                            </button>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Dismiss the pop-out (desktop — mobile uses the back arrow) */}
                  <motion.button
                    whileHover={{ scale: 1.12, rotate: 90 }}
                    whileTap={{ scale: 0.9 }}
                    transition={SOFT_SPRING}
                    onClick={closeChat}
                    className="hidden lg:flex p-2 rounded-xl bg-white/[0.04] border border-white/10 text-gray-400 hover:text-black hover:bg-[#CDFF00] hover:border-[#CDFF00] transition-colors"
                    aria-label="Close conversation"
                  >
                    <X className="w-[18px] h-[18px]" />
                  </motion.button>
                </div>

                {/* In-conversation message search */}
                <AnimatePresence initial={false}>
                  {msgSearchOpen && (
                    <motion.div {...STRIP_MOTION} className="shrink-0 overflow-hidden border-b border-white/5 bg-black/40">
                      <div className="px-4 py-2.5 flex items-center gap-2">
                        <Search className="w-4 h-4 text-gray-500 shrink-0" />
                        <input
                          autoFocus
                          value={msgQuery}
                          onChange={(e) => setMsgQuery(e.target.value)}
                          placeholder="Search within chat"
                          className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 outline-none"
                        />
                        <motion.button
                          whileHover={{ scale: 1.15, rotate: 90 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => { setMsgSearchOpen(false); setMsgQuery(''); }}
                          className="text-gray-500 hover:text-white"
                        >
                          <X className="w-4 h-4" />
                        </motion.button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Negotiation context strip */}
                <AnimatePresence initial={false}>
                  {listingContext && (
                    <motion.div {...STRIP_MOTION} className="shrink-0 overflow-hidden border-b border-white/5 bg-black/40">
                      <div className="px-4 py-2.5 flex items-center gap-2">
                        <Tag className="w-3.5 h-3.5 text-[#CDFF00] shrink-0" />
                        <span className="text-xs text-[#CDFF00] font-bold truncate">Negotiating: {listingContext.title}</span>
                        <motion.button
                          whileHover={{ scale: 1.15, rotate: 90 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => setListingContext(null)}
                          className="ml-auto text-gray-500 hover:text-white"
                        >
                          <X className="w-3.5 h-3.5" />
                        </motion.button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Messages */}
                <div
                  ref={scrollContainerRef}
                  onScroll={handleThreadScroll}
                  className="flex-1 min-h-0 overflow-y-auto px-4 md:px-10 py-4 scrollbar-hide"
                >
                  {messages.length === 0 && activeIsBondMatch ? (
                    /* A matched thread with nothing in it yet opens on the match itself,
                       standing in for the day separator a thread with no messages lacks —
                       so the first thing in the conversation is the reason there is one. */
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={SOFT_SPRING}
                      className="h-full flex items-center justify-center px-4"
                    >
                      <div
                        className="relative w-full max-w-xs rounded-3xl border p-6 text-center overflow-hidden"
                        style={{ borderColor: `${ROSE}55`, backgroundColor: `${ROSE}12` }}
                      >
                        <HeartField count={11} />
                        <motion.div
                          animate={reduceMotion ? {} : { scale: [1, 1.12, 1] }}
                          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                          className="relative flex justify-center mb-3"
                        >
                          <Heart className="w-10 h-10" style={{ color: ROSE, fill: ROSE }} />
                        </motion.div>
                        <p className="relative text-base font-black text-white uppercase tracking-tight">
                          It's a match
                        </p>
                        <p className="relative text-xs mt-1.5 font-semibold" style={{ color: BLUSH }}>
                          You and {firstNameOf(activePartnerData)} liked each other
                          {matchedAtLabel && ` ${matchedAtLabel}`}
                        </p>
                        <p className="relative text-[11px] text-gray-400 mt-3 leading-relaxed">
                          Nobody's said anything yet. Break the ice 💗
                        </p>
                      </div>
                    </motion.div>
                  ) : messages.length === 0 ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={SOFT_SPRING}
                      className="h-full flex items-center justify-center"
                    >
                      <span className="px-3.5 py-2 rounded-xl bg-black/60 border border-white/10 text-xs text-gray-400">
                        No messages yet. Say hello 👋
                      </span>
                    </motion.div>
                  ) : (
                    <AnimatePresence initial={false}>
                      {/* Once the thread has messages, the match becomes its opening line —
                          the same role a day separator plays for everything below it. */}
                      {activeIsBondMatch && (
                        <motion.div
                          key="bond-origin"
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={QUICK_TWEEN}
                          className="flex justify-center mb-3"
                        >
                          <span
                            className="flex items-center gap-1.5 px-3 py-1 rounded-lg border text-[10px] uppercase font-bold tracking-widest"
                            style={{ borderColor: `${ROSE}55`, backgroundColor: `${ROSE}14`, color: BLUSH }}
                          >
                            <Heart className="w-3 h-3" style={{ color: ROSE, fill: ROSE }} />
                            Matched on Bond{matchedAtLabel && ` ${matchedAtLabel}`}
                          </span>
                        </motion.div>
                      )}
                      {timeline.map((row) => {
                        if (row.type === 'day') {
                          return (
                            <motion.div
                              key={row.id}
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.9 }}
                              transition={QUICK_TWEEN}
                              className="flex justify-center my-3"
                            >
                              <span className="px-3 py-1 rounded-lg bg-black/60 border border-white/10 text-[10px] text-gray-400 uppercase font-bold tracking-widest">
                                {row.label}
                              </span>
                            </motion.div>
                          );
                        }
                        const { msg, startsRun } = row;
                        const isMe = msg.senderId === user?.id;
                        const pending = sendingIds.has(msg.id);
                        const ticks = isMe && (
                          pending
                            ? <Check className="w-3.5 h-3.5 text-gray-500" />
                            : <CheckCheck className="w-3.5 h-3.5 text-[#00FFFF]" />
                        );
                        // Bubbles enter from their own side of the thread.
                        const bubbleIn = reduceMotion
                          ? { initial: { opacity: 0 }, animate: { opacity: 1 } }
                          : {
                              initial: { opacity: 0, y: 12, scale: 0.96, x: isMe ? 12 : -12 },
                              animate: { opacity: 1, y: 0, scale: 1, x: 0 },
                            };

                        // Stickers: no bubble — big glyph with a floating time pill.
                        if (msg.messageType === 'STICKER') {
                          return (
                            <motion.div
                              key={row.id}
                              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.5, rotate: isMe ? 8 : -8 }}
                              animate={{ opacity: 1, scale: 1, rotate: 0 }}
                              transition={{ type: 'spring', stiffness: 320, damping: 18 }}
                              className={`flex ${isMe ? 'justify-end' : 'justify-start'} ${startsRun ? 'mt-2.5' : 'mt-[3px]'}`}
                            >
                              <div className="flex flex-col items-end">
                                <span className="text-[64px] leading-none select-none drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]">{msg.content}</span>
                                <span className="mt-1 px-1.5 py-0.5 rounded bg-black/60 flex items-center gap-1">
                                  <span className="text-[10px] text-gray-400 leading-none">{formatClock(msg.createdAt)}</span>
                                  {ticks}
                                </span>
                              </div>
                            </motion.div>
                          );
                        }

                        // Shared listing: a compact card (thumbnail/title/price) instead of a
                        // text bubble, tapping through to the live listing.
                        if (msg.messageType === 'LISTING' && msg.sharedListingId) {
                          return (
                            <motion.div
                              key={row.id}
                              {...bubbleIn}
                              transition={SOFT_SPRING}
                              className={`flex ${isMe ? 'justify-end' : 'justify-start'} ${startsRun ? 'mt-2.5' : 'mt-[3px]'}`}
                            >
                              <div className="max-w-[75%] md:max-w-[65%] space-y-1">
                                <motion.div whileHover={reduceMotion ? {} : { scale: 1.02 }} whileTap={{ scale: 0.98 }} transition={SOFT_SPRING}>
                                  <Link
                                    to={`/listing/${msg.sharedListingId}`}
                                    className={`flex items-center gap-3 p-2.5 rounded-2xl border transition-colors ${
                                      isMe ? 'bg-gradient-to-br from-[#FF00FF]/25 to-[#7D39EB]/25 border-[#FF00FF]/30' : 'bg-white/[0.06] border-white/10 hover:bg-white/10'
                                    }`}
                                  >
                                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-black/40 border border-white/10 shrink-0 flex items-center justify-center">
                                      {msg.sharedListingImage
                                        ? <img src={uploadUrl(msg.sharedListingImage)} alt="" className="w-full h-full object-cover" />
                                        : <ShoppingBag className="w-5 h-5 text-gray-500" />}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm font-bold text-white truncate">{msg.sharedListingTitle || 'Listing'}</p>
                                      {msg.sharedListingPrice != null && (
                                        <p className="text-xs text-[#CDFF00] font-bold">{formatPrice(msg.sharedListingPrice, msg.sharedListingCurrency)}</p>
                                      )}
                                    </div>
                                  </Link>
                                </motion.div>
                                {msg.content && (
                                  <p className={`text-[14.5px] leading-[19px] break-words px-1 ${isMe ? 'text-right' : ''} text-white`}>{msg.content}</p>
                                )}
                                <div className={`flex items-center gap-1 px-1 ${isMe ? 'justify-end' : ''}`}>
                                  <span className="text-[11px] text-gray-500 leading-none">{formatClock(msg.createdAt)}</span>
                                  {ticks}
                                </div>
                              </div>
                            </motion.div>
                          );
                        }

                        // Shared feed post: same card treatment as a shared listing, but links
                        // to the author's profile since there's no dedicated single-post page.
                        if (msg.messageType === 'POST' && msg.sharedPostId) {
                          return (
                            <motion.div
                              key={row.id}
                              {...bubbleIn}
                              transition={SOFT_SPRING}
                              className={`flex ${isMe ? 'justify-end' : 'justify-start'} ${startsRun ? 'mt-2.5' : 'mt-[3px]'}`}
                            >
                              <div className="max-w-[75%] md:max-w-[65%] space-y-1">
                                <motion.div whileHover={reduceMotion ? {} : { scale: 1.02 }} whileTap={{ scale: 0.98 }} transition={SOFT_SPRING}>
                                  <Link
                                    to={msg.sharedPostAuthorId ? `/profile/${msg.sharedPostAuthorId}` : '#'}
                                    className={`flex items-center gap-3 p-2.5 rounded-2xl border transition-colors ${
                                      isMe ? 'bg-gradient-to-br from-[#FF00FF]/25 to-[#7D39EB]/25 border-[#FF00FF]/30' : 'bg-white/[0.06] border-white/10 hover:bg-white/10'
                                    }`}
                                  >
                                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-black/40 border border-white/10 shrink-0 flex items-center justify-center">
                                      {msg.sharedPostImage
                                        ? <img src={uploadUrl(msg.sharedPostImage)} alt="" className="w-full h-full object-cover" />
                                        : <Send className="w-5 h-5 text-gray-500" />}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm font-bold text-white truncate">{msg.sharedPostContent || 'Post'}</p>
                                      {msg.sharedPostAuthorName && (
                                        <p className="text-xs text-gray-400 truncate">by {msg.sharedPostAuthorName}</p>
                                      )}
                                    </div>
                                  </Link>
                                </motion.div>
                                {msg.content && (
                                  <p className={`text-[14.5px] leading-[19px] break-words px-1 ${isMe ? 'text-right' : ''} text-white`}>{msg.content}</p>
                                )}
                                <div className={`flex items-center gap-1 px-1 ${isMe ? 'justify-end' : ''}`}>
                                  <span className="text-[11px] text-gray-500 leading-none">{formatClock(msg.createdAt)}</span>
                                  {ticks}
                                </div>
                              </div>
                            </motion.div>
                          );
                        }

                        // Shared story: a portrait thumbnail card. Stories expire after
                        // 24h, so this renders from the snapshot the server stored at
                        // share time rather than looking the story up — the card still
                        // works long after the story itself is gone.
                        if (msg.messageType === 'STORY' && msg.sharedStoryId) {
                          return (
                            <motion.div
                              key={row.id}
                              {...bubbleIn}
                              transition={SOFT_SPRING}
                              className={`flex ${isMe ? 'justify-end' : 'justify-start'} ${startsRun ? 'mt-2.5' : 'mt-[3px]'}`}
                            >
                              <div className="max-w-[75%] md:max-w-[65%] space-y-1">
                                <motion.div whileHover={reduceMotion ? {} : { scale: 1.02 }} whileTap={{ scale: 0.98 }} transition={SOFT_SPRING}>
                                  <Link
                                    to={msg.sharedStoryAuthorId ? `/profile/${msg.sharedStoryAuthorId}` : '#'}
                                    className={`flex items-center gap-3 p-2.5 rounded-2xl border transition-colors ${
                                      isMe ? 'bg-gradient-to-br from-[#FF00FF]/25 to-[#7D39EB]/25 border-[#FF00FF]/30' : 'bg-white/[0.06] border-white/10 hover:bg-white/10'
                                    }`}
                                  >
                                    <div className="w-12 h-16 rounded-xl overflow-hidden bg-black/40 border border-white/10 shrink-0 flex items-center justify-center">
                                      {msg.sharedStoryImage
                                        ? (msg.sharedStoryType === 'VIDEO'
                                            ? <video src={uploadUrl(msg.sharedStoryImage)} className="w-full h-full object-cover" muted playsInline />
                                            : <img src={uploadUrl(msg.sharedStoryImage)} alt="" className="w-full h-full object-cover" />)
                                        : <Sparkles className="w-5 h-5 text-[#CDFF00]" />}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="text-[10px] font-black uppercase tracking-widest text-[#CDFF00]">Story</p>
                                      <p className="text-sm font-bold text-white truncate">
                                        {msg.sharedStoryAuthorName || 'A story'}
                                      </p>
                                    </div>
                                  </Link>
                                </motion.div>
                                {msg.content && (
                                  <p className={`text-[14.5px] leading-[19px] break-words px-1 ${isMe ? 'text-right' : ''} text-white`}>{msg.content}</p>
                                )}
                                <div className={`flex items-center gap-1 px-1 ${isMe ? 'justify-end' : ''}`}>
                                  <span className="text-[11px] text-gray-500 leading-none">{formatClock(msg.createdAt)}</span>
                                  {ticks}
                                </div>
                              </div>
                            </motion.div>
                          );
                        }

                        const isImage = msg.messageType === 'IMAGE' && msg.mediaUrl;
                        return (
                          <motion.div
                            key={row.id}
                            {...bubbleIn}
                            transition={SOFT_SPRING}
                            className={`flex ${isMe ? 'justify-end' : 'justify-start'} ${startsRun ? 'mt-2.5' : 'mt-[3px]'}`}
                          >
                            <div
                              className={`relative max-w-[75%] md:max-w-[65%] rounded-2xl text-[14.5px] leading-[19px] break-words border ${
                                isMe
                                  ? 'bg-gradient-to-br from-[#FF00FF]/25 to-[#7D39EB]/25 border-[#FF00FF]/30'
                                  : 'bg-white/[0.06] border-white/10'
                              } ${isImage ? 'p-1' : 'px-3 pt-1.5 pb-1'}`}
                            >
                              {isImage ? (
                                <>
                                  {/* SmartImage, not a bare <img>: it resolves the server-relative
                                      "/uploads/…" the API returns, passes the blob: preview of an
                                      in-flight upload through untouched, and draws a placeholder
                                      when the file is missing. A raw <img> gave a silent empty
                                      bubble for all three of those. */}
                                  <SmartImage
                                    src={msg.mediaUrl}
                                    alt="Photo"
                                    onClick={() => setLightboxUrl(msg.mediaUrl)}
                                    className={`rounded-xl max-h-[320px] w-full min-w-[180px] aspect-[4/3] object-cover cursor-pointer ${pending ? 'opacity-60' : ''}`}
                                  />
                                  {msg.content && (
                                    <p className="text-white whitespace-pre-wrap px-1.5 pt-1.5 pb-1">
                                      {msg.content}
                                      <span className="inline-block w-[70px] h-1" aria-hidden />
                                    </p>
                                  )}
                                  <span className={`absolute bottom-2 right-2.5 flex items-center gap-1 ${msg.content ? '' : 'px-1.5 py-0.5 rounded bg-black/50'}`}>
                                    <span className="text-[11px] text-gray-300 leading-none">{formatClock(msg.createdAt)}</span>
                                    {ticks}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <span className="text-white whitespace-pre-wrap">{msg.content}</span>
                                  {/* inline spacer so time+ticks never overlap the last text line */}
                                  <span className="inline-block w-[70px] h-1" aria-hidden />
                                  <span className="absolute bottom-1 right-2.5 flex items-center gap-1">
                                    <span className="text-[11px] text-gray-400 leading-none">{formatClock(msg.createdAt)}</span>
                                    {ticks}
                                  </span>
                                </>
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  )}
                </div>

                {/* Composer */}
                <div className="relative shrink-0">
                  {/* Emoji / Sticker picker */}
                  <AnimatePresence>
                    {pickerOpen && (
                      <>
                        <div className="fixed inset-0 z-30" onClick={() => setPickerOpen(false)} />
                        <motion.div
                          initial={{ opacity: 0, y: 12, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 12, scale: 0.95 }}
                          transition={QUICK_TWEEN}
                          style={{ transformOrigin: 'bottom left' }}
                          className="absolute bottom-full left-2 mb-2 w-[340px] max-w-[calc(100vw-32px)] bg-[#111] border border-white/10 rounded-2xl shadow-2xl z-40 overflow-hidden"
                        >
                          {/* Tabs */}
                          <div className="relative flex border-b border-white/5">
                            {[
                              { id: 'emoji', label: 'Emoji', Icon: Smile },
                              { id: 'stickers', label: 'Stickers', Icon: StickerIcon },
                            ].map((tab) => (
                              <button
                                key={tab.id}
                                onClick={() => setPickerTab(tab.id)}
                                className={`relative flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold transition-colors ${
                                  pickerTab === tab.id ? 'text-[#CDFF00]' : 'text-gray-500 hover:text-gray-300'
                                }`}
                              >
                                <tab.Icon className="w-4 h-4" /> {tab.label}
                                {pickerTab === tab.id && (
                                  <motion.span
                                    layoutId="pickerTabUnderline"
                                    transition={SOFT_SPRING}
                                    className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#CDFF00]"
                                  />
                                )}
                              </button>
                            ))}
                          </div>
                          <div className="h-[260px] overflow-y-auto p-3 scrollbar-hide">
                            <AnimatePresence mode="wait">
                              <motion.div
                                key={pickerTab}
                                initial={{ opacity: 0, x: pickerTab === 'emoji' ? -12 : 12 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: pickerTab === 'emoji' ? 12 : -12 }}
                                transition={QUICK_TWEEN}
                              >
                                {pickerTab === 'emoji' ? (
                                  EMOJI_CATEGORIES.map((cat) => (
                                    <div key={cat.name} className="mb-2">
                                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1 px-1">{cat.name}</p>
                                      <div className="grid grid-cols-8">
                                        {cat.list.map((em) => (
                                          <motion.button
                                            key={em}
                                            whileHover={{ scale: 1.28 }}
                                            whileTap={{ scale: 0.85 }}
                                            transition={SOFT_SPRING}
                                            onClick={() => insertEmoji(em)}
                                            className="h-9 rounded-md hover:bg-white/10 text-[22px] leading-none flex items-center justify-center"
                                          >
                                            {em}
                                          </motion.button>
                                        ))}
                                      </div>
                                    </div>
                                  ))
                                ) : (
                                  <>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2 px-1">Tap to send</p>
                                    <div className="grid grid-cols-4 gap-2">
                                      {STICKERS.map((st, i) => (
                                        <motion.button
                                          key={st}
                                          initial={{ opacity: 0, scale: 0.7 }}
                                          animate={{ opacity: 1, scale: 1 }}
                                          transition={{ ...SOFT_SPRING, delay: Math.min(i * 0.012, 0.2) }}
                                          whileHover={{ scale: 1.12 }}
                                          whileTap={{ scale: 0.85 }}
                                          onClick={() => sendSticker(st)}
                                          className="h-16 rounded-xl bg-white/5 hover:bg-white/10 text-[40px] leading-none flex items-center justify-center transition-colors"
                                        >
                                          {st}
                                        </motion.button>
                                      ))}
                                    </div>
                                  </>
                                )}
                              </motion.div>
                            </AnimatePresence>
                          </div>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>

                  {/* Attached image preview strip */}
                  <AnimatePresence initial={false}>
                    {attachedPreview && (
                      <motion.div {...STRIP_MOTION} className="overflow-hidden bg-black/40 border-t border-white/5">
                        <div className="px-4 py-2.5 flex items-center gap-3">
                          <motion.img
                            initial={{ scale: 0.7, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={SOFT_SPRING}
                            src={attachedPreview}
                            alt="Attachment"
                            className="w-14 h-14 rounded-xl object-cover"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-white font-semibold truncate">{attachedImage?.name}</p>
                            <p className="text-[11px] text-gray-500">Photo — add a caption below, then hit send</p>
                          </div>
                          <motion.button
                            whileHover={{ scale: 1.15, rotate: 90 }}
                            whileTap={{ scale: 0.9 }}
                            transition={SOFT_SPRING}
                            onClick={clearAttachment}
                            className="p-2 rounded-full hover:bg-white/[0.07] text-gray-500 hover:text-white"
                          >
                            <X className="w-4 h-4" />
                          </motion.button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <form onSubmit={sendMessage} className="px-3 sm:px-4 py-3 border-t border-white/[0.07] flex items-center gap-2">
                    {/* Positioned off-screen rather than `hidden`: display:none stops iOS
                        Safari opening the picker at all when .click() is called on it, which
                        left the paperclip doing nothing on a phone. */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFilePick}
                      tabIndex={-1}
                      aria-hidden="true"
                      className="absolute w-px h-px opacity-0 pointer-events-none -z-10"
                    />
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.12 }}
                      whileTap={{ scale: 0.88 }}
                      animate={{ rotate: pickerOpen ? 18 : 0 }}
                      transition={SOFT_SPRING}
                      onClick={() => setPickerOpen((v) => !v)}
                      className={`p-2 rounded-full transition-colors shrink-0 ${pickerOpen ? 'text-[#CDFF00]' : 'text-gray-500 hover:text-white'}`}
                      aria-label="Emoji and stickers"
                    >
                      <Smile className="w-6 h-6" />
                    </motion.button>
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.12, rotate: -12 }}
                      whileTap={{ scale: 0.88 }}
                      transition={SOFT_SPRING}
                      onClick={() => fileInputRef.current?.click()}
                      className={`p-2 rounded-full transition-colors shrink-0 ${attachedImage ? 'text-[#CDFF00]' : 'text-gray-500 hover:text-white'}`}
                      aria-label="Attach a photo"
                    >
                      <Paperclip className="w-5 h-5" />
                    </motion.button>
                    <input
                      ref={inputRef}
                      type="text"
                      value={newMsg}
                      onChange={(e) => setNewMsg(e.target.value)}
                      placeholder={attachedImage ? 'Add a caption…' : 'Type a message'}
                      className="flex-1 min-w-0 bg-white/[0.05] border border-white/10 focus:border-[#CDFF00]/50 focus:bg-white/[0.07] rounded-full px-4 py-2.5 text-[15px] text-white placeholder-gray-500 outline-none transition-colors"
                    />
                    <motion.button
                      type="submit"
                      disabled={(!newMsg.trim() && !attachedImage) || uploading}
                      whileHover={{ scale: 1.08 }}
                      whileTap={{ scale: 0.88 }}
                      transition={SOFT_SPRING}
                      className="w-11 h-11 rounded-full bg-[#CDFF00] text-black flex items-center justify-center shrink-0 shadow-[0_6px_20px_-6px_rgba(205,255,0,0.7)] hover:bg-[#d9ff33] transition-colors disabled:opacity-40 disabled:shadow-none"
                      aria-label="Send message"
                    >
                      {uploading
                        ? <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                        : <Send className="w-5 h-5 ml-0.5" />}
                    </motion.button>
                  </form>
                </div>
              </motion.section>
            )}
          </AnimatePresence>

          {/* Resting state beside the list once every chat is closed (desktop only). */}
          <AnimatePresence>
            {!activePartner && (
              <motion.div
                key="chat-placeholder"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="hidden xl:flex flex-1 min-w-0 flex-col items-center justify-center text-center gap-4 px-10 rounded-[28px] border border-dashed border-white/10"
              >
                <motion.div
                  animate={reduceMotion ? {} : { y: [0, -9, 0] }}
                  transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
                  className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center"
                >
                  <MessageSquareOff className="w-7 h-7 text-gray-600" />
                </motion.div>
                <div>
                  <h3 className="text-lg font-black text-white uppercase tracking-tight">HustleSpace Chat</h3>
                  <p className="text-sm text-gray-500 max-w-xs mt-1.5">
                    Pick someone from the list — the conversation opens right here.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Full-screen image lightbox */}
      <AnimatePresence>
        {lightboxUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightboxUrl(null)}
            className="fixed inset-0 z-[600] bg-black/95 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.button
              whileHover={{ scale: 1.12, rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              transition={SOFT_SPRING}
              onClick={() => setLightboxUrl(null)}
              className="absolute top-4 right-4 p-2.5 rounded-full bg-white/10 hover:bg-[#CDFF00] hover:text-black text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </motion.button>
            <motion.img
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={PANEL_SPRING}
              src={uploadUrl(lightboxUrl)}
              alt="Photo"
              onClick={(e) => e.stopPropagation()}
              className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
