import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useSelector } from 'react-redux';
import { selectUser, selectIsAuthenticated } from '../store/authSlice';
import { directMessagesApi, notificationsApi, usersApi } from '../api/client';
import {
  MessageSquareOff, User, BadgeCheck, ArrowLeft,
  Paperclip, Smile, MoreVertical, Search, Send,
  Check, CheckCheck, Tag, X, Sticker as StickerIcon, RefreshCw
} from 'lucide-react';

/* Curated emoji + sticker sets for the composer pickers (no external deps). */
const EMOJI_CATEGORIES = [
  { name: 'Smileys', list: ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','😉','😍','🥰','😘','😜','🤪','😎','🤩','🥳','😏','😒','😔','😢','😭','😤','😡','🤯','😳','🥺','😴','🤔','🙄','😬','🤗','🫠'] },
  { name: 'Gestures', list: ['👍','👎','👏','🙌','🫶','💪','🙏','✌️','🤞','🤙','👊','✊','👋','🖐️','👀','🫡','🤷','🤦','💅','🤌'] },
  { name: 'Vibes', list: ['❤️','🧡','💛','💚','💙','💜','🖤','🔥','💯','✨','⭐','💫','💥','🎉','🎊','🎁','🏆','💰','💎','🚀','⚡','🌈','🌙','☀️'] },
  { name: 'Things', list: ['☕','🍕','🍔','🍟','🌮','🍩','🍦','🍺','🥂','🎧','📸','🎨','⚽','🏀','🎮','🎵','💻','📱','🛍️','🧵','✂️','💈','🍲','🎤'] },
];

const STICKERS = ['🔥','❤️','😂','👍','🎉','😍','🥳','💯','🙏','😎','🚀','💪','🤝','👀','✨','🏆','💎','⚡','🫶','😭','🤣','🥺','😤','🤯','🎁','☕','🍕','🎧','💰','🛍️','📸','🏁'];

/* ── WhatsApp dark palette ──
   bg wallpaper #0B141A · panels #111B21 · header/bars #202C33
   my bubble #005C4B · their bubble #202C33 · accent #00A884
   text #E9EDEF · muted #8696A0 · read ticks #53BDEB          */

const getStatusLine = (person) => {
  if (!person) return '';
  if (person.online) return 'online';
  if (person.lastActive) {
    const d = new Date(person.lastActive);
    if (!isNaN(d.getTime())) return `last seen ${formatDayLabel(d).toLowerCase()} at ${formatClock(d)}`;
  }
  if (person.city) return person.city;
  return 'on HustleUp';
};

const formatClock = (dateLike) => {
  const d = new Date(dateLike);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// WhatsApp-style sidebar timestamp: clock time today, "Yesterday", weekday within a week, else date.
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
    <div className={`${px} rounded-full overflow-hidden bg-[#6A7175] flex items-center justify-center shrink-0`}>
      {person?.avatarUrl
        ? <img src={person.avatarUrl} className="w-full h-full object-cover" />
        : <User className="w-[55%] h-[55%] text-[#CFD4D6]" />}
    </div>
  );
}

export default function DirectMessages() {
  const { partnerId } = useParams();
  const { state: navState } = useLocation();
  const user = useSelector(selectUser);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const navigate = useNavigate();

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
  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  // Scroll bookkeeping: jump instantly when a conversation opens; afterwards only
  // scroll when a genuinely new message arrives (the 5s poll returns a fresh array
  // reference even when nothing changed, and must not touch the user's position).
  const jumpOnNextDataRef = useRef(true);
  const lastMsgKeyRef = useRef('');

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
        if (!activePartner && partnerData.length > 0) setActivePartner(partnerData[0].id);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (activePartner) {
      setMessages([]);
      jumpOnNextDataRef.current = true;
      loadMessages(activePartner);
      const interval = setInterval(() => loadMessages(activePartner), 5000);
      return () => clearInterval(interval);
    }
  }, [activePartner]);

  const loadMessages = (id) => {
    directMessagesApi.getConversation(id)
      .then(res => setMessages((prev) => {
        // Keep optimistic (still-sending) messages so a poll can't wipe an in-flight upload.
        const pending = prev.filter((m) => String(m.id).startsWith('tmp-'));
        return [...(res.data || []), ...pending];
      }))
      .catch(e => console.error(e));
    notificationsApi.markAllRead().catch(() => {});
  };

  useEffect(() => {
    const last = messages[messages.length - 1];
    const lastKey = last ? `${last.id}|${messages.length}` : '';
    if (jumpOnNextDataRef.current) {
      if (messages.length === 0) return; // wait for the conversation to load
      lastMsgKeyRef.current = lastKey;
      jumpOnNextDataRef.current = false;
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      return;
    }
    if (lastKey === lastMsgKeyRef.current) return; // poll refresh, nothing new — leave scroll alone
    lastMsgKeyRef.current = lastKey;
    const el = scrollContainerRef.current;
    const nearBottom = el ? el.scrollHeight - el.scrollTop - el.clientHeight < 150 : true;
    // Follow new messages only if already at the bottom, or it's one we just sent.
    if (nearBottom || last?.senderId === user?.id) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, user?.id]);

  // Shared optimistic-send plumbing: append a temp message (single gray tick),
  // run the request, swap in the server copy or roll back on failure.
  const optimisticSend = async (optimisticFields, request, onFail) => {
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
      await optimisticSend(
        { content: caption, messageType: 'IMAGE', mediaUrl: preview },
        () => directMessagesApi.sendImage(activePartner, file, caption),
        () => { setAttachedImage(file); setAttachedPreview(preview); setNewMsg(caption); }
      );
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

  const activePartnerData = partners.find(p => p.id === activePartner)
    || allUsers.find(p => p.id === activePartner)
    || { name: 'User', fullName: 'User' };

  const combinedList = useMemo(() => {
    const partnerIds = new Set(partners.map(p => p.id));
    const otherUsers = allUsers
      .filter(u => !partnerIds.has(u.id) && u.id !== user?.id)
      .map(u => ({ ...u, name: u.name || u.fullName }));
    const combined = [...partners, ...otherUsers];
    if (!search.trim()) return combined;
    const q = search.trim().toLowerCase();
    return combined.filter(p => (p.name || p.fullName || '').toLowerCase().includes(q));
  }, [partners, allUsers, user?.id, search]);

  // Precompute grouping: day separators + whether each bubble starts a sender-run (gets the tail).
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

  return (
    <div className="h-[calc(100dvh-3.5rem)] md:h-[calc(100dvh-4rem)] overflow-hidden bg-[#0B141A] text-[#E9EDEF] font-sans flex flex-col">
      <div className="flex-1 min-h-0 w-full max-w-[1600px] mx-auto flex">

        {/* ── SIDEBAR (chat list) ── */}
        <div className={`w-full lg:w-[400px] shrink-0 min-h-0 flex flex-col bg-[#111B21] border-r border-[#222D34] ${activePartner ? 'hidden lg:flex' : 'flex'}`}>
          {/* Sidebar header */}
          <div className="h-[60px] px-4 bg-[#202C33] flex items-center justify-between shrink-0">
            <h1 className="text-lg font-bold text-[#E9EDEF]">Chats</h1>
            <button className="p-2 rounded-full hover:bg-white/5 text-[#8696A0] transition-colors">
              <MoreVertical className="w-5 h-5" />
            </button>
          </div>

          {/* Search */}
          <div className="px-3 py-2 bg-[#111B21] shrink-0">
            <div className="flex items-center gap-3 bg-[#202C33] rounded-lg px-3 py-1.5">
              <Search className="w-4 h-4 text-[#8696A0] shrink-0" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                type="text"
                placeholder="Search or start a new chat"
                className="flex-1 bg-transparent py-1 text-sm text-[#E9EDEF] placeholder-[#8696A0] outline-none"
              />
              {search && (
                <button onClick={() => setSearch('')} className="text-[#8696A0] hover:text-[#E9EDEF]">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto scrollbar-hide">
            {loading ? (
              <div className="p-3 space-y-1">
                {[...Array(6)].map((_, i) => <div key={i} className="h-[72px] rounded-lg bg-white/[0.03] animate-pulse" />)}
              </div>
            ) : combinedList.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-[#8696A0]">No chats found</div>
            ) : (
              combinedList.map((p) => {
                const isActive = p.id === activePartner;
                const displayName = p.name || p.fullName;
                return (
                  <button
                    key={p.id}
                    onClick={() => setActivePartner(p.id)}
                    className={`w-full text-left pl-3 pr-4 flex items-center gap-3 transition-colors ${isActive ? 'bg-[#2A3942]' : 'hover:bg-[#202C33]'}`}
                  >
                    <div className="relative py-3">
                      <Avatar person={p} size={12} />
                      {p.online && <span className="absolute bottom-3 right-0 w-3 h-3 rounded-full bg-[#00A884] border-2 border-[#111B21]" />}
                    </div>
                    <div className="flex-1 min-w-0 border-t border-[#222D34] py-3 self-stretch flex flex-col justify-center">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="flex items-center gap-1 min-w-0">
                          <span className="text-[15px] text-[#E9EDEF] truncate">{displayName}</span>
                          {p.verified && <BadgeCheck className="w-3.5 h-3.5 text-[#00A884] shrink-0" />}
                        </span>
                        <span className={`text-xs shrink-0 ${p.unreadCount > 0 ? 'text-[#00A884] font-semibold' : 'text-[#8696A0]'}`}>
                          {formatSidebarTime(p.lastMessageAt)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <p className="text-sm text-[#8696A0] truncate flex items-center gap-1 min-w-0">
                          {p.lastMessage
                            ? <>
                                {String(p.lastMessage).length > 0 && <CheckCheck className="w-4 h-4 shrink-0 text-[#8696A0]" />}
                                <span className="truncate">{p.lastMessage}</span>
                              </>
                            : <span className="italic truncate">{getStatusLine(p)}</span>}
                        </p>
                        {p.unreadCount > 0 && (
                          <span className="shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-[#00A884] text-[#111B21] text-xs font-bold flex items-center justify-center">
                            {p.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ── CHAT PANE ── */}
        <div className={`flex-1 flex-col min-w-0 min-h-0 ${activePartner ? 'flex' : 'hidden lg:flex'}`}>
          {activePartner ? (
            <>
              {/* Chat header */}
              <div className="h-[60px] px-4 bg-[#202C33] flex items-center gap-3 shrink-0 z-10">
                <button onClick={() => setActivePartner(null)} className="lg:hidden p-1.5 -ml-1 rounded-full hover:bg-white/5 text-[#8696A0]">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <Link to={`/profile/${activePartner}`} className="flex items-center gap-3 min-w-0 flex-1">
                  <Avatar person={activePartnerData} size={10} />
                  <div className="min-w-0">
                    <h3 className="text-[15px] text-[#E9EDEF] truncate flex items-center gap-1.5 leading-tight">
                      {activePartnerData.name || activePartnerData.fullName}
                      {activePartnerData.verified && <BadgeCheck className="w-3.5 h-3.5 text-[#00A884]" />}
                    </h3>
                    <p className="text-xs text-[#8696A0] truncate leading-tight mt-0.5">{getStatusLine(activePartnerData)}</p>
                  </div>
                </Link>
                <button
                  onClick={() => { setMsgSearchOpen((v) => { if (v) setMsgQuery(''); return !v; }); }}
                  className={`p-2 rounded-full hover:bg-white/5 transition-colors ${msgSearchOpen ? 'text-[#00A884]' : 'text-[#8696A0]'}`}
                >
                  <Search className="w-5 h-5" />
                </button>
                <div className="relative">
                  <button
                    onClick={() => setHeaderMenuOpen((v) => !v)}
                    className={`p-2 rounded-full hover:bg-white/5 transition-colors ${headerMenuOpen ? 'text-[#E9EDEF]' : 'text-[#8696A0]'}`}
                  >
                    <MoreVertical className="w-5 h-5" />
                  </button>
                  {headerMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setHeaderMenuOpen(false)} />
                      <div className="absolute right-0 top-full mt-1 w-48 py-1.5 bg-[#233138] rounded-lg shadow-[0_10px_30px_rgba(0,0,0,0.6)] z-40">
                        <Link
                          to={`/profile/${activePartner}`}
                          onClick={() => setHeaderMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#E9EDEF] hover:bg-white/5"
                        >
                          <User className="w-4 h-4 text-[#8696A0]" /> View profile
                        </Link>
                        <button
                          onClick={() => { loadMessages(activePartner); setHeaderMenuOpen(false); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#E9EDEF] hover:bg-white/5 text-left"
                        >
                          <RefreshCw className="w-4 h-4 text-[#8696A0]" /> Refresh chat
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* In-conversation message search */}
              {msgSearchOpen && (
                <div className="px-4 py-2 bg-[#182229] border-b border-[#222D34] flex items-center gap-2 shrink-0">
                  <Search className="w-4 h-4 text-[#8696A0] shrink-0" />
                  <input
                    autoFocus
                    value={msgQuery}
                    onChange={(e) => setMsgQuery(e.target.value)}
                    placeholder="Search within chat"
                    className="flex-1 bg-transparent text-sm text-[#E9EDEF] placeholder-[#8696A0] outline-none"
                  />
                  <button onClick={() => { setMsgSearchOpen(false); setMsgQuery(''); }} className="text-[#8696A0] hover:text-[#E9EDEF]">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Negotiation context strip */}
              {listingContext && (
                <div className="px-4 py-2 bg-[#182229] border-b border-[#222D34] flex items-center gap-2 shrink-0">
                  <Tag className="w-3.5 h-3.5 text-[#00A884] shrink-0" />
                  <span className="text-xs text-[#00A884] font-semibold truncate">Negotiating: {listingContext.title}</span>
                  <button onClick={() => setListingContext(null)} className="ml-auto text-[#8696A0] hover:text-[#E9EDEF]">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Messages over WhatsApp-style doodle wallpaper */}
              <div
                ref={scrollContainerRef}
                className="flex-1 min-h-0 overflow-y-auto px-4 md:px-14 py-3 scrollbar-hide"
                style={{
                  backgroundColor: '#0B141A',
                  backgroundImage: 'radial-gradient(circle at 1.5px 1.5px, rgba(134,150,160,0.14) 1.5px, transparent 0)',
                  backgroundSize: '26px 26px',
                }}
              >
                {messages.length === 0 ? (
                  <div className="h-full flex items-center justify-center">
                    <span className="px-3 py-1.5 rounded-lg bg-[#182229] text-xs text-[#8696A0] shadow">
                      No messages yet. Say hello 👋
                    </span>
                  </div>
                ) : (
                  <AnimatePresence initial={false}>
                    {timeline.map((row) => {
                      if (row.type === 'day') {
                        return (
                          <div key={row.id} className="flex justify-center my-3">
                            <span className="px-3 py-1 rounded-lg bg-[#182229] text-xs text-[#8696A0] uppercase shadow">
                              {row.label}
                            </span>
                          </div>
                        );
                      }
                      const { msg, startsRun } = row;
                      const isMe = msg.senderId === user?.id;
                      const pending = sendingIds.has(msg.id);
                      const ticks = isMe && (
                        pending
                          ? <Check className="w-4 h-4 text-[#8696A0]" />
                          : <CheckCheck className="w-4 h-4 text-[#53BDEB]" />
                      );

                      // Stickers: no bubble — big glyph with a floating time pill.
                      if (msg.messageType === 'STICKER') {
                        return (
                          <motion.div
                            key={row.id}
                            initial={{ opacity: 0, scale: 0.85 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className={`flex ${isMe ? 'justify-end' : 'justify-start'} ${startsRun ? 'mt-2.5' : 'mt-[3px]'}`}
                          >
                            <div className="flex flex-col items-end">
                              <span className="text-[64px] leading-none select-none drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]">{msg.content}</span>
                              <span className="mt-1 px-1.5 py-0.5 rounded bg-[#182229]/80 flex items-center gap-1">
                                <span className="text-[10px] text-[#8696A0] leading-none">{formatClock(msg.createdAt)}</span>
                                {ticks}
                              </span>
                            </div>
                          </motion.div>
                        );
                      }

                      const isImage = msg.messageType === 'IMAGE' && msg.mediaUrl;
                      return (
                        <motion.div
                          key={row.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`flex ${isMe ? 'justify-end' : 'justify-start'} ${startsRun ? 'mt-2.5' : 'mt-[3px]'}`}
                        >
                          <div
                            className={`relative max-w-[75%] md:max-w-[65%] rounded-lg shadow-[0_1px_1px_rgba(0,0,0,0.4)] text-[14.5px] leading-[19px] break-words ${
                              isMe ? 'bg-[#005C4B]' : 'bg-[#202C33]'
                            } ${startsRun ? (isMe ? 'rounded-tr-none' : 'rounded-tl-none') : ''} ${isImage ? 'p-1' : 'px-2.5 pt-1.5 pb-1'}`}
                          >
                            {/* Bubble tail on the first message of a run */}
                            {startsRun && (
                              <span
                                aria-hidden
                                className={`absolute top-0 w-0 h-0 border-t-8 ${
                                  isMe
                                    ? 'right-[-8px] border-t-[#005C4B] border-l-8 border-l-transparent'
                                    : 'left-[-8px] border-t-[#202C33] border-r-8 border-r-transparent'
                                }`}
                              />
                            )}
                            {isImage ? (
                              <>
                                <img
                                  src={msg.mediaUrl}
                                  alt="Photo"
                                  onClick={() => setLightboxUrl(msg.mediaUrl)}
                                  className={`rounded-md max-h-[320px] w-full min-w-[180px] object-cover cursor-pointer ${pending ? 'opacity-60' : ''}`}
                                />
                                {msg.content && (
                                  <p className="text-[#E9EDEF] whitespace-pre-wrap px-1.5 pt-1.5 pb-1">
                                    {msg.content}
                                    <span className="inline-block w-[70px] h-1" aria-hidden />
                                  </p>
                                )}
                                <span className={`absolute bottom-2 right-2.5 flex items-center gap-1 ${msg.content ? '' : 'px-1.5 py-0.5 rounded bg-black/50'}`}>
                                  <span className="text-[11px] text-[#d7dde0] leading-none">{formatClock(msg.createdAt)}</span>
                                  {ticks}
                                </span>
                              </>
                            ) : (
                              <>
                                <span className="text-[#E9EDEF] whitespace-pre-wrap">{msg.content}</span>
                                {/* inline spacer so time+ticks never overlap the last text line */}
                                <span className="inline-block w-[70px] h-1" aria-hidden />
                                <span className="absolute bottom-1 right-2 flex items-center gap-1">
                                  <span className="text-[11px] text-[#8696A0] leading-none">{formatClock(msg.createdAt)}</span>
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
                <div ref={messagesEndRef} />
              </div>

              {/* Composer */}
              <div className="relative shrink-0">
                {/* Emoji / Sticker picker */}
                {pickerOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setPickerOpen(false)} />
                    <div className="absolute bottom-full left-2 mb-2 w-[340px] max-w-[calc(100vw-16px)] bg-[#233138] rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.7)] z-40 overflow-hidden">
                      {/* Tabs */}
                      <div className="flex border-b border-[#182229]">
                        <button
                          onClick={() => setPickerTab('emoji')}
                          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold transition-colors ${pickerTab === 'emoji' ? 'text-[#00A884] border-b-2 border-[#00A884]' : 'text-[#8696A0]'}`}
                        >
                          <Smile className="w-4 h-4" /> Emoji
                        </button>
                        <button
                          onClick={() => setPickerTab('stickers')}
                          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold transition-colors ${pickerTab === 'stickers' ? 'text-[#00A884] border-b-2 border-[#00A884]' : 'text-[#8696A0]'}`}
                        >
                          <StickerIcon className="w-4 h-4" /> Stickers
                        </button>
                      </div>
                      <div className="h-[260px] overflow-y-auto p-3">
                        {pickerTab === 'emoji' ? (
                          EMOJI_CATEGORIES.map((cat) => (
                            <div key={cat.name} className="mb-2">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-[#8696A0] mb-1 px-1">{cat.name}</p>
                              <div className="grid grid-cols-8">
                                {cat.list.map((em) => (
                                  <button
                                    key={em}
                                    onClick={() => insertEmoji(em)}
                                    className="h-9 rounded-md hover:bg-white/10 text-[22px] leading-none flex items-center justify-center"
                                  >
                                    {em}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))
                        ) : (
                          <>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-[#8696A0] mb-2 px-1">Tap to send</p>
                            <div className="grid grid-cols-4 gap-2">
                              {STICKERS.map((st) => (
                                <button
                                  key={st}
                                  onClick={() => sendSticker(st)}
                                  className="h-16 rounded-lg bg-[#182229] hover:bg-[#2A3942] text-[40px] leading-none flex items-center justify-center transition-colors active:scale-90"
                                >
                                  {st}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {/* Attached image preview strip */}
                {attachedPreview && (
                  <div className="px-4 py-2 bg-[#182229] border-t border-[#222D34] flex items-center gap-3">
                    <img src={attachedPreview} alt="Attachment" className="w-14 h-14 rounded-lg object-cover" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-[#E9EDEF] font-semibold truncate">{attachedImage?.name}</p>
                      <p className="text-[11px] text-[#8696A0]">Photo — add a caption below, then hit send</p>
                    </div>
                    <button onClick={clearAttachment} className="p-2 rounded-full hover:bg-white/5 text-[#8696A0] hover:text-[#E9EDEF]">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                <form onSubmit={sendMessage} className="px-4 py-2.5 bg-[#202C33] flex items-center gap-2">
                  <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleFilePick} />
                  <button
                    type="button"
                    onClick={() => setPickerOpen((v) => !v)}
                    className={`p-2 rounded-full transition-colors shrink-0 ${pickerOpen ? 'text-[#00A884]' : 'text-[#8696A0] hover:text-[#E9EDEF]'}`}
                  >
                    <Smile className="w-6 h-6" />
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className={`p-2 rounded-full transition-colors shrink-0 ${attachedImage ? 'text-[#00A884]' : 'text-[#8696A0] hover:text-[#E9EDEF]'}`}
                  >
                    <Paperclip className="w-5.5 h-5.5" />
                  </button>
                  <input
                    ref={inputRef}
                    type="text"
                    value={newMsg}
                    onChange={(e) => setNewMsg(e.target.value)}
                    placeholder={attachedImage ? 'Add a caption…' : 'Type a message'}
                    className="flex-1 bg-[#2A3942] rounded-lg px-4 py-2.5 text-[15px] text-[#E9EDEF] placeholder-[#8696A0] outline-none"
                  />
                  <button
                    type="submit"
                    disabled={(!newMsg.trim() && !attachedImage) || uploading}
                    className="w-11 h-11 rounded-full bg-[#00A884] text-[#111B21] flex items-center justify-center shrink-0 hover:bg-[#06CF9C] active:scale-95 transition-all disabled:opacity-40"
                  >
                    {uploading
                      ? <span className="w-4 h-4 border-2 border-[#111B21]/40 border-t-[#111B21] rounded-full animate-spin" />
                      : <Send className="w-5 h-5 ml-0.5" />}
                  </button>
                </form>
              </div>
            </>
          ) : (
            /* Empty state (no chat selected) */
            <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-[#222E35] border-b-[6px] border-[#00A884]">
              <div className="w-20 h-20 rounded-full bg-[#364147] flex items-center justify-center mb-6">
                <MessageSquareOff className="w-9 h-9 text-[#8696A0]" />
              </div>
              <h3 className="text-2xl font-light text-[#E9EDEF] mb-2">HustleUp Chat</h3>
              <p className="text-sm text-[#8696A0] max-w-sm">
                Send and receive messages with creators and sellers. Select a chat on the left to get started.
              </p>
            </div>
          )}
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
            className="fixed inset-0 z-[600] bg-black/95 flex items-center justify-center p-6"
          >
            <button
              onClick={() => setLightboxUrl(null)}
              className="absolute top-4 right-4 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={lightboxUrl}
              alt="Photo"
              onClick={(e) => e.stopPropagation()}
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
