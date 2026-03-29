import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useSelector, useDispatch } from 'react-redux';
import { selectUser, selectIsAuthenticated, selectIsSeller, logout } from '../store/authSlice';
import { notificationsApi } from '../api/client';
import { LogOut, Home, Compass, LayoutDashboard, MessageSquare, Plus, Menu, X, User, Heart, Image as ImageIcon } from 'lucide-react';

export default function Navbar() {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const isSeller = useSelector(selectIsSeller);
  
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => { setMenuOpen(false); }, [location]);

  useEffect(() => {
    if (isAuthenticated) {
      notificationsApi.unreadCount().then(r => setUnread(r.data.count)).catch(() => {});
    }
  }, [isAuthenticated, location]);

  const handleLogout = () => { dispatch(logout()); navigate('/'); };

  return (
    <nav
      id="main-navbar"
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'glass-strong shadow-lg shadow-black/40' : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group" id="nav-logo">
            <HustleUpLogo className="h-9 w-auto group-hover:scale-105 transition-transform" />
            <span className="text-xl font-heading font-extrabold text-white tracking-tight uppercase">
              Hustle<span className="text-[#CDFF00]"> Up</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            <NavLink to="/" current={location.pathname}><Home className="w-4 h-4 mr-2" /> Home</NavLink>
            <NavLink to="/explore" current={location.pathname}><Compass className="w-4 h-4 mr-2" /> Explore</NavLink>
            <NavLink to="/feed" current={location.pathname}><ImageIcon className="w-4 h-4 mr-2" /> Feed</NavLink>
            {isAuthenticated && (
              <>
                <NavLink to="/dating" current={location.pathname}><Heart className="w-4 h-4 mr-2 text-rose-500" /> Matches</NavLink>
                <NavLink to="/dashboard" current={location.pathname}>
                  <LayoutDashboard className="w-4 h-4 mr-2" /> Dashboard
                  {unread > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-black bg-[#CDFF00] rounded-full">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </NavLink>
                <NavLink to="/dm" current={location.pathname}><MessageSquare className="w-4 h-4 mr-2" /> DMs</NavLink>
                <NavLink to="/messages" current={location.pathname}><MessageSquare className="w-4 h-4 mr-2" /> Bookings</NavLink>
              </>
            )}
          </div>

          {/* Right side */}
          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated ? (
              <>
                {isSeller && (
                  <Link
                    to="/create"
                    id="nav-create-listing"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#CDFF00] text-black font-bold text-sm hover:bg-[#E0FF4D] active:scale-95 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    New Listing
                  </Link>
                )}
                <div className="relative group">
                  <button
                    id="nav-user-menu"
                    className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-white/5 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-black border border-[#CDFF00]/30 flex items-center justify-center text-[#CDFF00] font-bold text-sm">
                      {user?.fullName?.[0] || 'U'}
                    </div>
                    <span className="text-sm text-gray-300 max-w-[100px] truncate">{user?.fullName}</span>
                  </button>
                  <div className="absolute right-0 top-full mt-2 w-48 py-2 glass-strong rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 translate-y-1 group-hover:translate-y-0">
                    <Link to={`/profile/${user?.id}`} className="flex items-center px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5"><User className="w-4 h-4 mr-2" /> My Profile</Link>
                    <Link to="/dashboard" className="flex items-center px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5"><LayoutDashboard className="w-4 h-4 mr-2" /> Dashboard</Link>
                    <hr className="my-1 border-white/5" />
                    <button onClick={handleLogout} className="flex items-center w-full text-left px-4 py-2 text-sm text-rose-400 hover:bg-white/5"><LogOut className="w-4 h-4 mr-2" /> Sign Out</button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <Link to="/login" id="nav-login" className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all">
                  Sign In
                </Link>
                <Link to="/register" id="nav-register" className="px-5 py-2.5 rounded-xl bg-[#CDFF00] text-black text-sm font-bold hover:bg-[#E0FF4D] active:scale-95 transition-all">
                  Get Started
                </Link>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden glass-strong border-t border-white/5 overflow-hidden"
          >
            <div className="px-4 py-4 space-y-1">
              <MobileLink to="/"><Home className="w-4 h-4 mr-2" /> Home</MobileLink>
              <MobileLink to="/explore"><Compass className="w-4 h-4 mr-2" /> Explore</MobileLink>
              <MobileLink to="/feed"><ImageIcon className="w-4 h-4 mr-2" /> Feed</MobileLink>
              {isAuthenticated && (
                <>
                  <MobileLink to="/dating"><Heart className="w-4 h-4 mr-2 text-rose-500" /> Matches</MobileLink>
                  <MobileLink to="/dashboard"><LayoutDashboard className="w-4 h-4 mr-2" /> Dashboard</MobileLink>
                  <MobileLink to="/dm"><MessageSquare className="w-4 h-4 mr-2" /> DMs</MobileLink>
                  <MobileLink to="/messages"><MessageSquare className="w-4 h-4 mr-2" /> Bookings</MobileLink>
                  {isSeller && <MobileLink to="/create"><Plus className="w-4 h-4 mr-2" /> New Listing</MobileLink>}
                  <hr className="border-white/5 my-2" />
                  <button onClick={handleLogout} className="flex items-center w-full text-left px-4 py-3 rounded-lg text-rose-400 hover:bg-white/5 text-sm"><LogOut className="w-4 h-4 mr-2" /> Sign Out</button>
                </>
              )}
              {!isAuthenticated && (
                <>
                  <MobileLink to="/login">Sign In</MobileLink>
                  <MobileLink to="/register">Get Started</MobileLink>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

function HustleUpLogo({ className }) {
  return (
    <svg className={className} viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 4h16v20h12V4h16v52H36V36H24v20H8V4z" fill="white" />
      <path d="M30 28l3.09 6.26L40 35.27l-5 4.87 1.18 6.86L30 43.77l-6.18 3.23L25 40.14l-5-4.87 6.91-1.01L30 28z" fill="black" />
    </svg>
  );
}

function NavLink({ to, current, children }) {
  const active = current === to || (to !== '/' && current.startsWith(to));
  return (
    <Link
      to={to}
      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center ${
        active ? 'text-[#CDFF00] bg-[#CDFF00]/10' : 'text-gray-400 hover:text-white hover:bg-white/5'
      }`}
    >
      {children}
    </Link>
  );
}

function MobileLink({ to, children }) {
  return (
    <Link to={to} className="flex items-center px-4 py-3 rounded-lg text-gray-300 hover:text-white hover:bg-white/5 text-sm font-medium">
      {children}
    </Link>
  );
}
