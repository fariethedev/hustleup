import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useSelector, useDispatch } from 'react-redux';
import { selectUser, selectIsAuthenticated, selectIsSeller, logout } from '../store/authSlice';
import { notificationsApi } from '../api/client';
import { LogOut, Home, Compass, LayoutDashboard, MessageSquare, Plus, User, Heart, Image as ImageIcon, Bell, Search, Briefcase, Newspaper } from 'lucide-react';

export default function Navbar() {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const isSeller = useSelector(selectIsSeller);
  
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

  const navItems = [
    { to: '/',        icon: Home,         label: 'Home',    always: true },
    { to: '/explore', icon: Compass,      label: 'Explore', auth: true },
    { to: '/feed',    icon: ImageIcon,    label: 'Feed',    auth: true },
    { to: '/dating',  icon: Heart,        label: 'Bond',    auth: true, accent: true },
    { to: '/news',    icon: Newspaper,    label: 'News',    auth: true },
    { to: '/dm',      icon: MessageSquare,label: 'Messages',auth: true, badge: unread },
    { to: '/jobs',    icon: Briefcase,    label: 'Jobs',    auth: true },
  ];

  const visibleItems = navItems.filter(item => item.always || (item.auth && isAuthenticated));

  // Bottom tab items (mobile) — max 5 slots + optional centre FAB
  const bottomTabs = [
    { to: '/',        icon: Home,          label: 'Home',     always: true },
    { to: '/explore', icon: Compass,       label: 'Explore',  auth: true },
    { to: '/feed',    icon: ImageIcon,     label: 'Feed',     auth: true },
    { to: '/dm',      icon: MessageSquare, label: 'Messages', auth: true, badge: unread },
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
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16 md:h-20">

              {/* Logo */}
              <Link to="/" className="flex items-center gap-3 group shrink-0 flex-nowrap" id="nav-logo">
                <div className="hidden sm:flex w-10 h-10 bg-[#CDFF00] rounded-xl items-center justify-center font-black text-black text-xl group-hover:scale-105 transition-transform shadow-[0_0_20px_#CDFF00]/20">
                  H
                </div>
                <span className="text-xl sm:text-2xl font-heading font-black text-white tracking-tighter uppercase whitespace-nowrap">
                  Hustle<span className="text-[#CDFF00]">Up</span>
                </span>
              </Link>

              {/* Desktop Nav — centered pills */}
              <div className="hidden md:flex flex-1 items-center justify-center gap-1">
                <div className="flex items-center gap-1 bg-white/5 border border-white/10 p-1.5 rounded-2xl backdrop-blur-xl">
                  {visibleItems.map(({ to, icon: Icon, label, accent, badge }) => {
                    const active = isActive(to);
                    return (
                      <Link
                        key={to}
                        to={to}
                        className={`group relative flex items-center justify-center w-11 h-11 rounded-xl transition-all duration-300
                          ${active
                            ? 'bg-[#CDFF00] text-black shadow-lg shadow-[#CDFF00]/10'
                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                          }`}
                      >
                        <Icon className={`w-5 h-5 flex-shrink-0 ${accent && !active ? 'text-[#CDFF00]' : ''}`} />
                        <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-[#CDFF00] text-black text-[10px] font-black px-2 py-1 rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all uppercase tracking-tighter whitespace-nowrap">
                          {label}
                        </span>
                        {badge > 0 && (
                          <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-black text-black bg-[#CDFF00] rounded-full ring-2 ring-black">
                            {badge > 9 ? '9+' : badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                  <div className="w-px h-6 bg-white/10 mx-2" />
                  <button
                    id="global-search-trigger"
                    className="flex items-center justify-center w-11 h-11 rounded-xl text-gray-400 hover:text-[#CDFF00] hover:bg-white/5 transition-all"
                  >
                    <Search className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Desktop right — user menu */}
              <div className="hidden md:flex items-center gap-3 w-[200px] justify-end">
                {isAuthenticated ? (
                  <div className="relative group">
                    <button
                      id="nav-user-menu"
                      className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-white/5 transition-colors border border-transparent hover:border-white/10"
                    >
                      <div className="w-9 h-9 rounded-full bg-[#CDFF00] flex items-center justify-center text-black font-black text-xs uppercase shadow-sm overflow-hidden">
                        {user?.avatarUrl
                          ? <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                          : user?.fullName?.[0] || 'U'}
                      </div>
                    </button>
                    <div className="absolute right-0 top-full mt-2 w-56 py-3 bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 translate-y-1 group-hover:translate-y-0 backdrop-blur-3xl">
                      <div className="px-4 py-2 border-b border-white/5 mb-2">
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Signed in as</p>
                        <p className="text-sm text-white font-black truncate">{user?.fullName}</p>
                      </div>
                      <Link to={`/profile/${user?.id}`} className="flex items-center px-4 py-2 text-sm text-gray-300 hover:text-[#CDFF00] hover:bg-white/5 transition-colors font-bold uppercase tracking-tighter"><User className="w-4 h-4 mr-3" /> Profile Hub</Link>
                      <Link to="/dashboard" className="flex items-center px-4 py-2 text-sm text-gray-300 hover:text-[#CDFF00] hover:bg-white/5 transition-colors font-bold uppercase tracking-tighter"><LayoutDashboard className="w-4 h-4 mr-3" /> Hustle Dash</Link>
                      <hr className="my-2 border-white/5" />
                      <button onClick={handleLogout} className="flex items-center w-full text-left px-4 py-2 text-sm text-[#CDFF00] hover:bg-[#CDFF00] hover:text-black transition-colors font-bold uppercase tracking-tighter"><LogOut className="w-4 h-4 mr-3" /> Exit System</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Link to="/login" className="px-4 py-2 text-xs font-black text-gray-400 hover:text-white uppercase tracking-widest">Sign In</Link>
                    <Link to="/register" className="px-5 py-2.5 rounded-xl bg-[#CDFF00] text-black text-xs font-black hover:bg-[#b8e600] active:scale-95 transition-all shadow-lg shadow-[#CDFF00]/10 uppercase tracking-widest">Join</Link>
                  </div>
                )}
              </div>

              {/* Mobile right — avatar or sign-in */}
              <div className="flex md:hidden items-center gap-2">
                {isAuthenticated ? (
                  <Link to={`/profile/${user?.id}`} className="w-9 h-9 rounded-full bg-[#CDFF00] flex items-center justify-center text-black font-black text-xs uppercase overflow-hidden border-2 border-white/10">
                    {user?.avatarUrl
                      ? <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                      : user?.fullName?.[0] || 'U'}
                  </Link>
                ) : (
                  <Link to="/login" className="px-4 py-2 rounded-xl bg-[#CDFF00] text-black text-xs font-black uppercase tracking-widest">
                    Sign In
                  </Link>
                )}
              </div>

            </div>
          </div>
        </nav>



      {/* ── MOBILE BOTTOM TAB BAR ── */}

      {/* ── MOBILE BOTTOM FLOATING TAB BAR ── */}
    <div className="md:hidden fixed bottom-6 left-6 right-6 z-[250]">
        <div className="flex items-stretch justify-around h-20 bg-[#0a0a0a] border border-white/10 rounded-[2.5rem] shadow-[0_25px_50px_rgba(0,0,0,0.8)] overflow-hidden">
          {visibleTabs.map(({ to, icon: Icon, badge }) => {
            const active = isActive(to);
            return (
              <Link
                key={to}
                to={to}
                className={`flex-1 flex items-center justify-center transition-all duration-300 ${
                  active ? 'bg-[#CDFF00]' : 'hover:bg-white/5'
                }`}
              >
                <div className="relative">
                  <Icon className={`w-8 h-8 transition-colors ${
                    active ? 'text-black' : 'text-gray-500'
                  }`} />
                  {badge > 0 && (
                    <span className={`absolute -top-2 -right-2 inline-flex items-center justify-center min-w-[20px] h-[20px] text-[10px] font-black rounded-full ring-2 ring-black ${
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
              <div className={`w-9 h-9 rounded-full overflow-hidden border-2 shadow-sm ${
                location.pathname.startsWith('/profile') ? 'border-black' : 'border-white/20'
              }`}>
                {user?.avatarUrl
                  ? <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full bg-gray-800 flex items-center justify-center text-[#CDFF00] font-black text-[12px]">{user?.fullName?.[0] || 'U'}</div>
                }
              </div>
            </Link>
          ) : (
            <Link
              to="/register"
              className="flex-1 flex items-center justify-center bg-white/5 hover:bg-white/10"
            >
              <User className="w-8 h-8 text-gray-500" />
            </Link>
          )}
        </div>
      </div>
    </>
  );
}






