import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { selectUser, selectIsAuthenticated, logout } from '../store/authSlice';
import { notificationsApi } from '../api/client';
import { LogOut, Home, Compass, LayoutDashboard, MessageSquare, User, Heart, Image as ImageIcon, Search } from 'lucide-react';

export default function Navbar() {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  
  const [scrolled, setScrolled] = useState(false);
  const [unread, setUnread] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      notificationsApi.unreadCount().then(r => setUnread(r.data.count)).catch(() => {});
    }
  }, [isAuthenticated, location]);

  const handleLogout = () => { dispatch(logout()); navigate('/'); };

  // Reduced nav items — Jobs & News removed
  const navItems = [
    { to: '/',        icon: Home,         label: 'Home',    always: true },
    { to: '/explore', icon: Compass,      label: 'Explore', auth: true },
    { to: '/feed',    icon: ImageIcon,    label: 'Feed',    auth: true },
    { to: '/dating',  icon: Heart,        label: 'Bond',    auth: true, accent: true },
    { to: '/dm',      icon: MessageSquare,label: 'DMs',     auth: true, badge: unread },
  ];

  const visibleItems = navItems.filter(item => item.always || (item.auth && isAuthenticated));

  // Bottom tab items (mobile) — compact 4 + profile
  const bottomTabs = [
    { to: '/',        icon: Home,          label: 'Home',     always: true },
    { to: '/explore', icon: Compass,       label: 'Explore',  auth: true },
    { to: '/feed',    icon: ImageIcon,     label: 'Feed',     auth: true },
    { to: '/dm',      icon: MessageSquare, label: 'DMs',      auth: true, badge: unread },
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

            {/* Desktop Nav — compact pills */}
            <div className="hidden md:flex flex-1 items-center justify-center">
              <div className="flex items-center gap-0.5 bg-white/5 border border-white/10 p-1 rounded-xl backdrop-blur-xl">
                {visibleItems.map(({ to, icon: Icon, label, accent, badge }) => {
                  const active = isActive(to);
                  return (
                    <Link
                      key={to}
                      to={to}
                      className={`group relative flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-200
                        ${active
                          ? 'bg-[#FF00FF] text-white shadow-md shadow-[#FF00FF]/40 scale-110'
                          : 'text-gray-500 hover:text-white hover:bg-white/5 hover:scale-105'
                        }`}
                    >
                      <Icon className={`w-4 h-4 flex-shrink-0 ${accent && !active ? 'text-[#00FFFF]' : ''}`} />
                      <span className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-[#FF00FF] text-white text-[9px] font-black px-2 py-1 rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all uppercase tracking-widest whitespace-nowrap z-50 shadow-[0_0_10px_#FF00FF]">
                        {label}
                      </span>
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
                  className="flex items-center justify-center w-9 h-9 rounded-lg text-gray-500 hover:text-[#CDFF00] hover:bg-white/5 transition-all"
                >
                  <Search className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Desktop right — user menu */}
            <div className="hidden md:flex items-center gap-2 w-[160px] justify-end">
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

            {/* Mobile right — avatar or sign-in */}
            <div className="flex md:hidden items-center gap-1.5">
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
          {visibleTabs.map(({ to, icon: Icon, badge }) => {
            const active = isActive(to);
            return (
              <Link
                key={to}
                to={to}
                className={`flex-1 flex items-center justify-center transition-all duration-200 ${
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
              </Link>
            );
          })}
          
          {/* Profile */}
          {isAuthenticated ? (
            <Link
              to={`/profile/${user?.id}`}
              className={`flex-1 flex items-center justify-center transition-all ${
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
            </Link>
          ) : (
            <Link
              to="/register"
              className="flex-1 flex items-center justify-center bg-white/5 hover:bg-white/10"
            >
              <User className="w-5 h-5 text-gray-500" />
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
