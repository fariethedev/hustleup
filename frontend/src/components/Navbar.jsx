import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useSelector, useDispatch } from 'react-redux';
import { selectUser, selectIsAuthenticated, logout } from '../store/authSlice';
import { notificationsApi, directMessagesApi } from '../api/client';
import { selectCartCount, openCart } from '../store/cartSlice';
import GlobalSearch from './GlobalSearch';
import { timeAgo } from '../utils/time';
import { displayName } from '../utils/displayName';
import PendingSalesButton from './PendingSalesButton';
import { LogOut, Home, Compass, LayoutDashboard, Send, User, Heart, Layers, Search, ShoppingBag, Bell, CheckCheck, MoreHorizontal, Briefcase, Newspaper, Repeat, Trophy, Ticket } from 'lucide-react';
import { uploadUrl } from '../config';

// Secondary links that don't get their own pill/tab (to avoid crowding the main
// nav) but still need to be reachable from anywhere via the "More" menu.
// Secondary links reachable from the "More" menu. On mobile this menu is the ONLY route to
// Dashboard: the bottom bar holds five icons and adding a sixth makes the pill too wide for
// a small phone, so Dashboard lives here rather than being unreachable (which is what it was
// before — it had no mobile entry point at all).
const MORE_LINKS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', auth: true },
  { to: '/swaps', icon: Repeat, label: 'Swaps' },
  { to: '/leaderboard', icon: Trophy, label: 'Leaderboard' },
  { to: '/jobs', icon: Briefcase, label: 'Jobs & Gigs' },
  { to: '/news', icon: Newspaper, label: 'Campus News' },
];

export default function Navbar() {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const cartCount = useSelector(selectCartCount);

  const [scrolled, setScrolled] = useState(false);
  const [unread, setUnread] = useState(0);
  const [dmUnread, setDmUnread] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  // Mobile account menu. The desktop equivalent opens on hover, which touch devices do not
  // have — so on a phone there was no way to reach Sign Out at all.
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef(null);
  const [notifications, setNotifications] = useState([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Ctrl+K / Cmd+K opens global search from anywhere
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      notificationsApi.unreadCount().then(r => setUnread(r.data.count)).catch(() => {});
    }
  }, [isAuthenticated, location]);

  // Unopened DMs, shown as the badge on the DMs tab. Refetched on navigation (so it
  // clears as soon as you leave a chat you just read) and polled on a slow timer so
  // a message arriving while you sit on another page still surfaces.
  // Reset on sign-out is handled in handleLogout rather than with an early
  // setDmUnread(0) here — setting state synchronously in an effect body triggers
  // a cascading re-render (and trips react-hooks/set-state-in-effect).
  useEffect(() => {
    if (!isAuthenticated) return;
    const load = () => directMessagesApi.unreadCount()
      .then(r => setDmUnread(r.data.count))
      .catch(() => {});
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated, location]);

  // Close the mobile account menu on an outside tap or Escape.
  useEffect(() => {
    if (!accountOpen) return undefined;
    const onPointer = (e) => {
      if (accountRef.current && !accountRef.current.contains(e.target)) setAccountOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setAccountOpen(false); };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [accountOpen]);

  // Navigating away should never leave the sheet hanging open behind the new page.
  useEffect(() => { setAccountOpen(false); }, [location]);

  const handleLogout = () => {
    setAccountOpen(false);
    // Clear the badge counts so the next account to sign in on this device never
    // sees the previous user's unread numbers, even for a frame.
    setDmUnread(0);
    setUnread(0);
    dispatch(logout());
    navigate('/');
  };

  const openNotifications = () => {
    if (notifOpen) { setNotifOpen(false); return; }
    setNotifOpen(true);
    setNotifLoading(true);
    notificationsApi.getAll()
      .then((r) => setNotifications((r.data || []).slice(0, 20)))
      .catch(() => setNotifications([]))
      .finally(() => setNotifLoading(false));
  };

  const markAllRead = () => {
    notificationsApi.markAllRead().catch(() => {});
    setNotifications((list) => list.map((n) => ({ ...n, read: true })));
    setUnread(0);
  };

  const markOneRead = (n) => {
    if (n.read) return;
    notificationsApi.markRead(n.id).catch(() => {});
    setNotifications((list) => list.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    setUnread((u) => Math.max(0, u - 1));
  };

  /**
   * The notifications list, shared by the desktop dropdown and the mobile sheet.
   *
   * Only the wrapper differs between them — a 320px dropdown anchored to the bell on
   * desktop, a full-width sheet under the bar on mobile — so the contents live here once
   * rather than being duplicated and drifting apart.
   *
   * An element, not a nested component: a component declared inside another is a fresh type
   * on every render, so React would tear down and rebuild the list whenever anything else in
   * the navbar changed. It also has to be declared AFTER markAllRead and markOneRead —
   * `onClick={markAllRead}` is evaluated when this element is created, so referencing a
   * `const` defined further down throws on first render.
   */
  const notifPanelBody = (
    <>
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <p className="text-xs text-white font-black uppercase tracking-widest">Notifications</p>
        {notifications.some((n) => !n.read) && (
          <button onClick={markAllRead} className="flex items-center gap-1 text-[10px] font-bold text-[#CDFF00] hover:underline">
            <CheckCheck className="w-3 h-3" /> Mark all read
          </button>
        )}
      </div>
      <div className="max-h-[380px] overflow-y-auto">
        {notifLoading ? (
          <div className="py-10 text-center">
            <div className="w-6 h-6 border-2 border-[#CDFF00]/20 border-t-[#CDFF00] rounded-full animate-spin mx-auto" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-10 text-center">
            <Bell className="w-8 h-8 text-gray-700 mx-auto mb-2" />
            <p className="text-xs text-gray-500 font-semibold">No notifications yet</p>
          </div>
        ) : (
          notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => markOneRead(n)}
              // Unread rows carry a tinted background and a lime left edge, so the ones
              // that need attention are visible at a glance rather than differing from
              // read ones only by opacity.
              className={`w-full text-left px-4 py-3 flex gap-3 border-b border-white/5 last:border-0 transition-colors ${
                n.read
                  ? 'opacity-60 hover:bg-white/[0.04]'
                  : 'bg-[#CDFF00]/[0.06] border-l-2 border-l-[#CDFF00] hover:bg-[#CDFF00]/10'
              }`}
            >
              <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${n.read ? 'bg-transparent' : 'bg-[#CDFF00] shadow-[0_0_6px_rgba(205,255,0,0.8)]'}`} />
              <span className="flex-1 min-w-0">
                <span className={`block text-xs font-bold truncate ${n.read ? 'text-gray-300' : 'text-white'}`}>{n.title}</span>
                {n.message && <span className="block text-[11px] text-gray-400 leading-snug line-clamp-2 mt-0.5">{n.message}</span>}
              </span>
              <span className="text-[10px] text-gray-600 font-bold shrink-0">{timeAgo(n.createdAt)}</span>
            </button>
          ))
        )}
      </div>
    </>
  );

  // Reduced nav items — Jobs & News removed
  const navItems = [
    { to: '/',        icon: Home,         label: 'Home',    always: true },
    { to: '/explore', icon: Compass,      label: 'Explore', auth: true },
    { to: '/feed',    icon: Layers,       label: 'Feed',    auth: true },
    { to: '/dating',  icon: Heart,        label: 'Bond',    auth: true, accent: true },
    { to: '/dm',      icon: Send,         label: 'DMs',     auth: true, badge: dmUnread },
  ];

  const visibleItems = navItems.filter(item => item.always || (item.auth && isAuthenticated));

  // Bottom tab items (mobile). Bond is here rather than behind "More" because it is a
  // primary destination on desktop — it was in neither this list nor MORE_LINKS, which made
  // it reachable on a phone only by typing the URL.
  const bottomTabs = [
    { to: '/',        icon: Home,          label: 'Home',     always: true },
    { to: '/explore', icon: Compass,       label: 'Explore',  auth: true },
    { to: '/feed',    icon: Layers,        label: 'Feed',     auth: true },
    { to: '/dating',  icon: Heart,         label: 'Bond',     auth: true, accent: true },
    { to: '/dm',      icon: Send,          label: 'DMs',      auth: true, badge: dmUnread },
  ];
  const visibleTabs = bottomTabs.filter(item => item.always || (item.auth && isAuthenticated));

  const isActive = (to) => to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);

  return (
    <>
      {/* ── TOP NAV BAR ── */}
      <nav
        id="main-navbar"
        className={`fixed top-0 left-0 right-0 z-[200] transition-all duration-300 ${
          scrolled ? 'glass bg-black/60 border-b border-white/5 shadow-sm backdrop-blur-2xl' : 'bg-transparent'
        }`}
      >
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">

            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 group shrink-0" id="nav-logo">
              <div className="hidden sm:flex w-8 h-8 bg-[#CDFF00] rounded-lg items-center justify-center font-black text-black text-sm group-hover:scale-105 transition-transform shadow-[0_0_15px_#CDFF00]/15">
                H
              </div>
              <span className="text-lg font-black text-white tracking-tighter uppercase whitespace-nowrap">
                Hustle<span className="text-[#CDFF00]">Space</span>
              </span>
            </Link>

            {/* Desktop Nav — icon + word label so the active section is never a guess */}
            <div className="hidden md:flex flex-1 items-center justify-center">
              <div className="flex items-center gap-0.5 bg-white/5 border border-white/10 p-1 rounded-xl backdrop-blur-xl">
                {visibleItems.map(({ to, icon: Icon, label, accent, badge }) => {
                  const active = isActive(to);
                  return (
                    <Link
                      key={to}
                      to={to}
                      className={`relative flex items-center gap-1.5 px-3 h-9 rounded-lg transition-all duration-200
                        ${active
                          ? 'bg-[#FF00FF] text-white shadow-md shadow-[#FF00FF]/40'
                          : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                    >
                      <Icon className={`w-4 h-4 flex-shrink-0 ${accent && !active ? 'text-[#00FFFF]' : ''}`} />
                      <span className="text-[11px] font-black uppercase tracking-wide whitespace-nowrap">{label}</span>
                      {badge > 0 && (
                        <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[14px] h-[14px] px-0.5 text-[8px] font-black text-black bg-[#00FFFF] rounded-full ring-2 ring-black">
                          {badge > 9 ? '9+' : badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
                <div className="w-px h-5 bg-white/10 mx-1" />
                <button
                  id="global-search-trigger"
                  onClick={() => setSearchOpen(true)}
                  className="flex items-center justify-center w-9 h-9 rounded-lg text-gray-500 hover:text-[#CDFF00] hover:bg-white/5 transition-all"
                >
                  <Search className="w-4 h-4" />
                </button>
                <div className="relative">
                  <button
                    onClick={() => setMoreOpen((v) => !v)}
                    className={`flex items-center justify-center w-9 h-9 rounded-lg transition-all ${
                      moreOpen ? 'text-[#CDFF00] bg-white/5' : 'text-gray-500 hover:text-[#CDFF00] hover:bg-white/5'
                    }`}
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                  {moreOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setMoreOpen(false)} />
                      <div className="absolute right-0 top-full mt-2 w-48 py-1.5 bg-[#0a0a0a] border border-white/10 rounded-xl shadow-2xl z-50 backdrop-blur-3xl">
                        {MORE_LINKS.map(({ to, icon: Icon, label }) => (
                          <Link
                            key={to}
                            to={to}
                            onClick={() => setMoreOpen(false)}
                            className="flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-gray-300 hover:text-[#CDFF00] hover:bg-white/5 transition-colors font-bold"
                          >
                            <Icon className="w-4 h-4" /> {label}
                          </Link>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Desktop right — notifications + cart + user menu */}
            <div className="hidden md:flex items-center gap-2 w-[200px] justify-end">
              {isAuthenticated && (
                <div className="relative">
                  <button
                    id="nav-notif-trigger"
                    onClick={openNotifications}
                    className={`relative flex items-center justify-center w-9 h-9 rounded-lg transition-all ${
                      notifOpen ? 'text-[#CDFF00] bg-white/5' : 'text-gray-500 hover:text-[#CDFF00] hover:bg-white/5'
                    }`}
                  >
                    <Bell className="w-4 h-4" />
                    {unread > 0 && (
                      <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[14px] h-[14px] px-0.5 text-[8px] font-black text-black bg-[#FF00FF] rounded-full ring-2 ring-black">
                        {unread > 9 ? '9+' : unread}
                      </span>
                    )}
                  </button>
                  {notifOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
                      <div className="absolute right-0 top-full mt-2 w-80 bg-[#0a0a0a] border border-[#CDFF00]/20 rounded-2xl shadow-2xl shadow-black/60 z-50 overflow-hidden backdrop-blur-3xl">
                        {notifPanelBody}
                      </div>
                    </>
                  )}
                </div>
              )}
              <button
                id="nav-cart-trigger"
                onClick={() => dispatch(openCart())}
                className="relative flex items-center justify-center w-9 h-9 rounded-lg text-gray-500 hover:text-[#CDFF00] hover:bg-white/5 transition-all"
              >
                <ShoppingBag className="w-4 h-4" />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[14px] h-[14px] px-0.5 text-[8px] font-black text-black bg-[#CDFF00] rounded-full ring-2 ring-black">
                    {cartCount > 9 ? '9+' : cartCount}
                  </span>
                )}
              </button>
              {/* Seller's outstanding orders. Renders nothing for buyers, or for a seller
                  with an empty queue, so it never shows a permanent zero. */}
              {isAuthenticated && <PendingSalesButton />}
              {isAuthenticated ? (
                <div className="relative group">
                  <button
                    id="nav-user-menu"
                    className="flex items-center gap-1.5 p-1 rounded-lg hover:bg-white/5 transition-colors border border-transparent hover:border-white/10"
                  >
                    <div className="w-7 h-7 rounded-full bg-[#CDFF00] flex items-center justify-center text-black font-black text-[10px] uppercase shadow-sm overflow-hidden">
                      {user?.avatarUrl
                        ? <img src={uploadUrl(user.avatarUrl)} alt="" className="w-full h-full object-cover" />
                        : displayName(user)[0]?.toUpperCase() || 'U'}
                    </div>
                  </button>
                  <div className="absolute right-0 top-full mt-1.5 w-48 py-2 bg-[#0a0a0a] border border-white/10 rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 translate-y-1 group-hover:translate-y-0 backdrop-blur-3xl">
                    <div className="px-3 py-1.5 border-b border-white/5 mb-1.5">
                      <p className="text-[8px] text-gray-500 font-bold uppercase tracking-widest">Signed in as</p>
                      <p className="text-xs text-[#CDFF00] font-black truncate">{displayName(user)}</p>
                      {/* Real name under the handle. Rendered only when it is not already
                          what is shown above — for an account with no username,
                          displayName() has fallen back to the full name, and repeating it
                          would just print the same string twice. */}
                      {user?.username && user?.fullName && (
                        <p className="text-[10px] text-gray-400 font-semibold truncate">{user.fullName}</p>
                      )}
                    </div>
                    <Link to={`/profile/${user?.id}`} className="flex items-center px-3 py-1.5 text-xs text-gray-300 hover:text-[#CDFF00] hover:bg-white/5 transition-colors font-bold"><User className="w-3.5 h-3.5 mr-2" /> Profile</Link>
                    <Link to="/dashboard" className="flex items-center px-3 py-1.5 text-xs text-gray-300 hover:text-[#CDFF00] hover:bg-white/5 transition-colors font-bold"><LayoutDashboard className="w-3.5 h-3.5 mr-2" /> Dashboard</Link>
                    <Link to="/tickets" className="flex items-center px-3 py-1.5 text-xs text-gray-300 hover:text-[#CDFF00] hover:bg-white/5 transition-colors font-bold"><Ticket className="w-3.5 h-3.5 mr-2" /> My Tickets</Link>
                    <hr className="my-1.5 border-white/5" />
                    <button onClick={handleLogout} className="flex items-center w-full text-left px-3 py-1.5 text-xs text-[#CDFF00] hover:bg-[#CDFF00] hover:text-black transition-colors font-bold"><LogOut className="w-3.5 h-3.5 mr-2" /> Sign Out</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <Link to="/login" className="px-3 py-1.5 text-[10px] font-black text-gray-400 hover:text-white uppercase tracking-widest">Login</Link>
                  <Link to="/register" className="px-4 py-1.5 rounded-lg bg-[#CDFF00] text-black text-[10px] font-black hover:bg-[#b8e600] active:scale-95 transition-all shadow-md shadow-[#CDFF00]/10 uppercase tracking-widest">Join</Link>
                </div>
              )}
            </div>

            {/* Mobile right — search + notifications + cart + avatar or sign-in */}
            <div className="flex md:hidden items-center gap-1.5">
              <button
                onClick={() => setSearchOpen(true)}
                className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-[#CDFF00] hover:bg-white/5 transition-all"
              >
                <Search className="w-4.5 h-4.5" />
              </button>
              {/* Notifications had no mobile entry point at all: the bell was inside the
                  `hidden md:flex` desktop cluster, so on a phone there was no way to see
                  that anything had happened — a sold item, a booking request, a match — short
                  of opening the dashboard and finding the Alerts tab.
                  The panel is a full-width sheet here rather than the desktop's 320px
                  dropdown, which would overflow a small screen anchored to this button. */}
              {isAuthenticated && (
                <>
                  <button
                    onClick={openNotifications}
                    aria-label="Notifications"
                    aria-expanded={notifOpen}
                    className={`relative flex items-center justify-center w-8 h-8 rounded-lg transition-all ${
                      notifOpen ? 'text-[#CDFF00] bg-[#CDFF00]/10' : 'text-gray-400 hover:text-[#CDFF00] hover:bg-white/5'
                    }`}
                  >
                    <Bell className="w-4.5 h-4.5" />
                    {unread > 0 && (
                      <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[14px] h-[14px] px-0.5 text-[8px] font-black text-white bg-[#FF00FF] rounded-full ring-2 ring-black shadow-[0_0_8px_rgba(255,0,255,0.6)]">
                        {unread > 9 ? '9+' : unread}
                      </span>
                    )}
                  </button>
                  {notifOpen && (
                    <>
                      <div className="fixed inset-0 z-[240] bg-black/40" onClick={() => setNotifOpen(false)} />
                      <div className="fixed left-2 right-2 top-[calc(3.5rem+env(safe-area-inset-top))] z-[250] bg-[#0a0a0a] border border-[#CDFF00]/20 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden backdrop-blur-3xl">
                        {notifPanelBody}
                      </div>
                    </>
                  )}
                </>
              )}
              <button
                onClick={() => dispatch(openCart())}
                className="relative flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-[#CDFF00] hover:bg-white/5 transition-all"
              >
                <ShoppingBag className="w-4.5 h-4.5" />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[14px] h-[14px] px-0.5 text-[8px] font-black text-black bg-[#CDFF00] rounded-full ring-2 ring-black">
                    {cartCount > 9 ? '9+' : cartCount}
                  </span>
                )}
              </button>
              {isAuthenticated ? (
                // Tap-to-open menu rather than a straight link to the profile: the desktop
                // account dropdown is hover-only, so Sign Out was unreachable on a phone.
                <div className="relative" ref={accountRef}>
                  <button
                    onClick={() => setAccountOpen((v) => !v)}
                    aria-label="Account menu"
                    aria-expanded={accountOpen}
                    className="w-7 h-7 rounded-full bg-[#CDFF00] flex items-center justify-center text-black font-black text-[10px] uppercase overflow-hidden border border-white/10"
                  >
                    {user?.avatarUrl
                      ? <img src={uploadUrl(user.avatarUrl)} alt="" className="w-full h-full object-cover" />
                      : displayName(user)[0]?.toUpperCase() || 'U'}
                  </button>

                  <AnimatePresence>
                    {accountOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -6, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.97 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-full mt-2 w-52 py-2 bg-[#0a0a0a] border border-white/10 rounded-xl shadow-2xl z-[300] backdrop-blur-3xl"
                      >
                        <div className="px-3 py-1.5 border-b border-white/5 mb-1.5">
                          <p className="text-[8px] text-gray-500 font-bold uppercase tracking-widest">Signed in as</p>
                          <p className="text-xs text-[#CDFF00] font-black truncate">{displayName(user)}</p>
                          {user?.username && user?.fullName && (
                            <p className="text-[10px] text-gray-400 font-semibold truncate">{user.fullName}</p>
                          )}
                        </div>
                        <Link to={`/profile/${user?.id}`} className="flex items-center px-3 py-2 text-xs text-gray-300 hover:text-[#CDFF00] hover:bg-white/5 transition-colors font-bold">
                          <User className="w-3.5 h-3.5 mr-2" /> Profile
                        </Link>
                        <Link to="/dashboard" className="flex items-center px-3 py-2 text-xs text-gray-300 hover:text-[#CDFF00] hover:bg-white/5 transition-colors font-bold">
                          <LayoutDashboard className="w-3.5 h-3.5 mr-2" /> Dashboard
                        </Link>
                        <Link to="/tickets" className="flex items-center px-3 py-2 text-xs text-gray-300 hover:text-[#CDFF00] hover:bg-white/5 transition-colors font-bold">
                          <Ticket className="w-3.5 h-3.5 mr-2" /> My Tickets
                        </Link>
                        <hr className="my-1.5 border-white/5" />
                        <button
                          onClick={handleLogout}
                          className="flex items-center w-full text-left px-3 py-2 text-xs text-[#CDFF00] hover:bg-[#CDFF00] hover:text-black transition-colors font-bold"
                        >
                          <LogOut className="w-3.5 h-3.5 mr-2" /> Sign Out
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <Link to="/login" className="px-3 py-1.5 rounded-lg bg-[#CDFF00] text-black text-[10px] font-black uppercase tracking-widest">
                  Sign In
                </Link>
              )}
            </div>

          </div>
        </div>
      </nav>

      {/* ── MOBILE BOTTOM TAB BAR ── */}
      {/* Floating rounded island centred above the safe area (Instagram-style)
          rather than a full-bleed bar welded to the screen edge. Icon-only so the
          pill stays narrow enough to sit centred on small phones. */}
      <div className="md:hidden fixed left-1/2 -translate-x-1/2 bottom-[calc(0.875rem+env(safe-area-inset-bottom))] z-[250]">
        {moreOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMoreOpen(false)} />
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-48 py-1.5 bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl z-50 backdrop-blur-3xl">
              {MORE_LINKS.filter((l) => !l.auth || isAuthenticated).map(({ to, icon: Icon, label }) => (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setMoreOpen(false)}
                  className="flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-gray-300 hover:text-[#CDFF00] hover:bg-white/5 transition-colors font-bold"
                >
                  <Icon className="w-4 h-4" /> {label}
                </Link>
              ))}
              {/* Profile, alongside Dashboard, so both account destinations are in one
                  predictable place rather than only behind the avatar at the bar's edge. */}
              {isAuthenticated && (
                <Link
                  to={`/profile/${user?.id}`}
                  onClick={() => setMoreOpen(false)}
                  className="flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-gray-300 hover:text-[#CDFF00] hover:bg-white/5 transition-colors font-bold"
                >
                  <User className="w-4 h-4" /> My profile
                </Link>
              )}
            </div>
          </>
        )}
        <div className="flex items-center gap-0.5 h-[58px] px-2 rounded-full bg-[#0a0a0a]/85 border border-white/15 shadow-[0_8px_32px_rgba(0,0,0,0.65)] backdrop-blur-2xl">
          {visibleTabs.map(({ to, icon: Icon, label, badge, accent }) => {
            const active = isActive(to);
            return (
              <Link
                key={to}
                to={to}
                aria-label={label}
                aria-current={active ? 'page' : undefined}
                className={`relative flex items-center justify-center w-[46px] h-[46px] rounded-full transition-colors active:scale-90 ${
                  active ? 'bg-white/10' : ''
                }`}
              >
                <Icon
                  className={`w-[22px] h-[22px] ${
                    active ? 'text-[#CDFF00]' : accent ? 'text-[#FF00FF]' : 'text-gray-400'
                  }`}
                  strokeWidth={active ? 2.5 : 1.9}
                />
                {badge > 0 && (
                  <span className="absolute top-1.5 right-1.5 inline-flex items-center justify-center min-w-[15px] h-[15px] px-0.5 text-[8px] font-black rounded-full ring-2 ring-[#0a0a0a] bg-[#FF00FF] text-white">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </Link>
            );
          })}

          {/* More — Jobs & Gigs, Campus News */}
          <button
            onClick={() => setMoreOpen((v) => !v)}
            aria-label="More"
            aria-expanded={moreOpen}
            className={`flex items-center justify-center w-[46px] h-[46px] rounded-full transition-colors active:scale-90 ${
              moreOpen ? 'bg-white/10' : ''
            }`}
          >
            <MoreHorizontal className={`w-[22px] h-[22px] ${moreOpen ? 'text-[#CDFF00]' : 'text-gray-400'}`} strokeWidth={moreOpen ? 2.5 : 1.9} />
          </button>

          {/* Seller's outstanding orders — same component, sized for the tab island. */}
          {isAuthenticated && <PendingSalesButton compact />}

          {/* Profile */}
          {isAuthenticated ? (
            <Link
              to={`/profile/${user?.id}`}
              aria-label="Profile"
              className="flex items-center justify-center w-[46px] h-[46px] rounded-full transition-transform active:scale-90"
            >
              <div className={`w-[26px] h-[26px] rounded-full overflow-hidden ${
                location.pathname.startsWith('/profile') ? 'ring-2 ring-[#CDFF00]' : 'ring-1 ring-white/25'
              }`}>
                {user?.avatarUrl
                  ? <img src={uploadUrl(user.avatarUrl)} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full bg-gray-800 flex items-center justify-center text-[#CDFF00] font-black text-[9px]">{displayName(user)[0]?.toUpperCase() || 'U'}</div>
                }
              </div>
            </Link>
          ) : (
            <Link
              to="/register"
              aria-label="Join"
              className="flex items-center justify-center w-[46px] h-[46px] rounded-full transition-transform active:scale-90"
            >
              <User className="w-[22px] h-[22px] text-gray-400" strokeWidth={1.9} />
            </Link>
          )}
        </div>
      </div>

      {/* ── GLOBAL SEARCH OVERLAY ── */}
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
