import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import CartDrawer from './components/CartDrawer';
import Home from './pages/Home';
import Explore from './pages/Explore';
import ExploreListings from './pages/ExploreListings';
import ExploreShops from './pages/ExploreShops';
import ExploreCreators from './pages/ExploreCreators';
import ListingDetail from './pages/ListingDetail';
import CreateListing from './pages/CreateListing';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import VerifyEmail from './pages/VerifyEmail';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import Dashboard from './pages/Dashboard';
import Onboarding from './pages/Onboarding';
import Messages from './pages/Messages';
import Profile from './pages/Profile';
import Feed from './pages/Feed';
import Dating from './pages/Dating';
import DirectMessages from './pages/DirectMessages';
import Jobs from './pages/Jobs';
import News from './pages/News';
import PublisherApply from './pages/PublisherApply';
import Admin from './pages/Admin';
import Swaps from './pages/Swaps';
import Leaderboard from './pages/Leaderboard';
import ShopDetail from './pages/ShopDetail';
import ShopNegotiation from './pages/ShopNegotiation';
import ShopCheckout from './pages/ShopCheckout';
import ShopConfirmation from './pages/ShopConfirmation';
import Checkout from './pages/Checkout';
import CheckoutConfirmation from './pages/CheckoutConfirmation';
import Tickets from './pages/Tickets';
import TicketDetail from './pages/TicketDetail';
import EventDoor from './pages/EventDoor';
import { selectIsAuthenticated } from './store/authSlice';
import { ToastProvider } from './context/ToastContext';
import ErrorBoundary from './components/ErrorBoundary';
import CrispChat from './components/CrispChat';
import BookingAlertListener from './components/BookingAlertListener';

import ScrollToTop from './components/ScrollToTop';

const NO_FOOTER_PATHS = ['/dm', '/login', '/register'];

export default function App() {
  const location = useLocation();
  const noFooter = NO_FOOTER_PATHS.some((p) => location.pathname.startsWith(p));

  return (
    <>
    <ToastProvider>
      <ScrollToTop />
      <CrispChat />
      <BookingAlertListener />
      <Navbar />
      <CartDrawer />
      <main className={`flex-1 ${location.pathname === '/' ? 'pt-0 pb-0' : noFooter ? 'pt-14 md:pt-16 pb-0' : 'pt-14 md:pt-16 pb-16 md:pb-0'}`}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route element={<GuestOnlyRoute />}>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
          </Route>
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />

          {/* Publicly Browseable */}
          <Route path="/explore" element={<Explore />} />
          {/* Full collections behind each "View all" on the Explore overview. */}
          <Route path="/explore/listings" element={<ExploreListings />} />
          <Route path="/explore/shops" element={<ExploreShops />} />
          <Route path="/explore/creators" element={<ExploreCreators />} />
          <Route path="/listing/:id" element={<ListingDetail />} />
          <Route path="/profile/:id" element={<Profile />} />
          <Route path="/feed" element={<ErrorBoundary><Feed /></ErrorBoundary>} />
          {/* Public on purpose — rankings are social proof, so a logged-out visitor
              needs to be able to see them. */}
          <Route path="/leaderboard" element={<Leaderboard />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/shop/:id" element={<ShopDetail />} />
            <Route path="/shop/:id/product/:productId/negotiate" element={<ShopNegotiation />} />
            <Route path="/shop/:id/product/:productId/checkout" element={<ShopCheckout />} />
            <Route path="/shop/:id/product/:productId/confirmation" element={<ShopConfirmation />} />
            <Route path="/create" element={<CreateListing />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/checkout/confirmation" element={<CheckoutConfirmation />} />
            {/* Digital event tickets: the holder's wallet and a single scannable ticket,
                plus the organiser-only door scanner for one of their own events. */}
            <Route path="/tickets" element={<Tickets />} />
            <Route path="/tickets/:id" element={<TicketDetail />} />
            <Route path="/events/:listingId/door" element={<EventDoor />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/messages/:bookingId" element={<Messages />} />
            <Route path="/dm" element={<DirectMessages />} />
            <Route path="/dm/:partnerId" element={<DirectMessages />} />
            <Route path="/dating" element={<Dating />} />
            <Route path="/jobs" element={<Jobs />} />
            <Route path="/news" element={<News />} />
            {/* Apply to become a verified hiring company or news outlet. */}
            <Route path="/publisher/apply" element={<PublisherApply />} />
            {/* Admin console. The component redirects a non-admin, but the real gate is
                server-side: /api/v1/admin/** requires ROLE_ADMIN. */}
            <Route path="/admin" element={<Admin />} />
            <Route path="/swaps" element={<Swaps />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {!noFooter && <Footer />}
    </ToastProvider>
    </>
  );
}

function GuestOnlyRoute() {
  const isAuthenticated = useSelector(selectIsAuthenticated);

  if (!isAuthenticated) return <Outlet />;
  return <Navigate to="/dashboard" replace />;
}

function ProtectedRoute() {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/register" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
