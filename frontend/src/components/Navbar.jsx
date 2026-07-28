import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { selectUser, selectIsAuthenticated, logout } from '../store/authSlice';
import { notificationsApi } from '../api/client';
import { selectCartCount, openCart } from '../store/cartSlice';
import GlobalSearch from './GlobalSearch';
import { LogOut, Home, Compass, LayoutDashboard, MessageSquare, User, Heart, Image as ImageIcon, Search, ShoppingBag, Bell, CheckCheck } from 'lucide-react';

// Compact relative time for the notification dropdown ("5m", "3h", "2d").
function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function Navbar() {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const cartCount = useSelector(selectCartCount);

  const [scrolled, setScrolled] = useState(false);
  const [unread, setUnread] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
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

  const handleLogout = () => { dispatch(logout()); navigate('/'); };

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

  // Reduced nav items — Jobs & News removed
  const navItems = [
    { to: '/',        icon: Home,         label: 'Home',    always: true },
    { to: '/explore', icon: Compass,      label: 'Explore', auth: true },
    { to: '/feed',    icon: ImageIcon,    label: 'Feed',    auth: true },
    { to: '/dating',  icon: Heart,        label: 'Bond',    auth: true, accent: true },
    { to: '/dm',      icon: MessageSquare,label: 'DMs',     auth: true },
  ];

  const visibleItems = navItems.filter(item => item.always || (item.auth && isAuthenticated));

  // Bottom tab items (mobile) — compact 4 + profile
  const bottomTabs = [
    { to: '/',        icon: Home,          label: 'Home',     always: true },
    { to: '/explore', icon: Compass,       label: 'Explore',  auth: true },
    { to: '/feed',    icon: ImageIcon,     label: 'Feed',     auth: true },
    { to: '/dm',      icon: MessageSquare, label: 'DMs',      auth: true },
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
                Hustle<span className="text-[#CDFF00]">Up</span>
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
                      <div className="absolute right-0 top-full mt-2 w-80 bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden backdrop-blur-3xl">
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
                                className={`w-full text-left px-4 py-3 flex gap-3 border-b border-white/5 last:border-0 transition-colors hover:bg-white/[0.04] ${
                                  n.read ? 'opacity-60' : ''
                                }`}
                              >
                                <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${n.read ? 'bg-transparent' : 'bg-[#CDFF00]'}`} />
                                <span className="flex-1 min-w-0">
                                  <span className="block text-xs text-white font-bold truncate">{n.title}</span>
                                  {n.message && <span className="block text-[11px] text-gray-400 leading-snug line-clamp-2 mt-0.5">{n.message}</span>}
                                </span>
                                <span className="text-[10px] text-gray-600 font-bold shrink-0">{timeAgo(n.createdAt)}</span>
                              </button>
                            ))
                          )}
                        </div>
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
              {isAuthenticated ? (
                <div className="relative group">
                  <button
                    id="nav-user-menu"
                    className="flex items-center gap-1.5 p-1 rounded-lg hover:bg-white/5 transition-colors border border-transparent hover:border-white/10"
                  >
                    <div className="w-7 h-7 rounded-full bg-[#CDFF00] flex items-center justify-center text-black font-black text-[10px] uppercase shadow-sm overflow-hidden">
                      {user?.avatarUrl
                        ? <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                        : user?.fullName?.[0] || 'U'}
                    </div>
                  </button>
                  <div className="absolute right-0 top-full mt-1.5 w-48 py-2 bg-[#0a0a0a] border border-white/10 rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 translate-y-1 group-hover:translate-y-0 backdrop-blur-3xl">
                    <div className="px-3 py-1.5 border-b border-white/5 mb-1.5">
                      <p className="text-[8px] text-gray-500 font-bold uppercase tracking-widest">Signed in as</p>
                      <p className="text-xs text-white font-black truncate">{user?.fullName}</p>
                    </div>
                    <Link to={`/profile/${user?.id}`} className="flex items-center px-3 py-1.5 text-xs text-gray-300 hover:text-[#CDFF00] hover:bg-white/5 transition-colors font-bold"><User className="w-3.5 h-3.5 mr-2" /> Profile</Link>
                    <Link to="/dashboard" className="flex items-center px-3 py-1.5 text-xs text-gray-300 hover:text-[#CDFF00] hover:bg-white/5 transition-colors font-bold"><LayoutDashboard className="w-3.5 h-3.5 mr-2" /> Dashboard</Link>
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

            {/* Mobile right — search + cart + avatar or sign-in */}
            <div className="flex md:hidden items-center gap-1.5">
              <button
                onClick={() => setSearchOpen(true)}
                className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-[#CDFF00] hover:bg-white/5 transition-all"
              >
                <Search className="w-4.5 h-4.5" />
              </button>
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
                <Link to={`/profile/${user?.id}`} className="w-7 h-7 rounded-full bg-[#CDFF00] flex items-center justify-center text-black font-black text-[10px] uppercase overflow-hidden border border-white/10">
                  {user?.avatarUrl
                    ? <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                    : user?.fullName?.[0] || 'U'}
                </Link>
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
      <div className="md:hidden fixed bottom-4 left-4 right-4 z-[250]">
        <div className="flex items-stretch justify-around h-14 bg-[#0a0a0a]/95 border border-white/10 rounded-2xl shadow-[0_15px_40px_rgba(0,0,0,0.8)] overflow-hidden backdrop-blur-xl">
          {visibleTabs.map(({ to, icon: Icon, label, badge }) => {
            const active = isActive(to);
            return (
              <Link
                key={to}
                to={to}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-all duration-200 ${
                  active ? 'bg-[#CDFF00]' : 'hover:bg-white/5'
                }`}
              >
                <div className="relative">
                  <Icon className={`w-5 h-5 transition-colors ${
                    active ? 'text-black' : 'text-gray-500'
                  }`} />
                  {badge > 0 && (
                    <span className={`absolute -top-1.5 -right-1.5 inline-flex items-center justify-center min-w-[14px] h-[14px] text-[8px] font-black rounded-full ring-1 ring-black ${
                      active ? 'bg-black text-[#CDFF00]' : 'bg-[#CDFF00] text-black'
                    }`}>
                      {badge > 9 ? '9+' : badge}
                    </span>
                  )}
                </div>
                <span className={`text-[8px] font-black uppercase tracking-wide ${active ? 'text-black' : 'text-gray-500'}`}>
                  {label}
                </span>
              </Link>
            );
          })}

          {/* Profile */}
          {isAuthenticated ? (
            <Link
              to={`/profile/${user?.id}`}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-all ${
                location.pathname.startsWith('/profile') ? 'bg-[#CDFF00]' : 'hover:bg-white/5'
              }`}
            >
              <div className={`w-6 h-6 rounded-full overflow-hidden border ${
                location.pathname.startsWith('/profile') ? 'border-black' : 'border-white/20'
              }`}>
                {user?.avatarUrl
                  ? <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full bg-gray-800 flex items-center justify-center text-[#CDFF00] font-black text-[8px]">{user?.fullName?.[0] || 'U'}</div>
                }
              </div>
              <span className={`text-[8px] font-black uppercase tracking-wide ${location.pathname.startsWith('/profile') ? 'text-black' : 'text-gray-500'}`}>
                Profile
              </span>
            </Link>
          ) : (
            <Link
              to="/register"
              className="flex-1 flex flex-col items-center justify-center gap-0.5 bg-white/5 hover:bg-white/10"
            >
              <User className="w-5 h-5 text-gray-500" />
              <span className="text-[8px] font-black uppercase tracking-wide text-gray-500">Join</span>
            </Link>
          )}
        </div>
      </div>

      {/* ── GLOBAL SEARCH OVERLAY ── */}
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
