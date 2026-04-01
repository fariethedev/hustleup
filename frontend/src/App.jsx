import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import Explore from './pages/Explore';
import ListingDetail from './pages/ListingDetail';
import CreateListing from './pages/CreateListing';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Messages from './pages/Messages';
import Profile from './pages/Profile';
import Feed from './pages/Feed';
import Dating from './pages/Dating';
import DirectMessages from './pages/DirectMessages';
import ShopDetail from './pages/ShopDetail';
import ShopNegotiation from './pages/ShopNegotiation';
import ShopCheckout from './pages/ShopCheckout';
import ShopConfirmation from './pages/ShopConfirmation';
import Onboarding from './pages/Onboarding';
import { selectHasCompletedOnboarding, selectIsAuthenticated } from './store/authSlice';
import { ToastProvider } from './context/ToastContext';
import ErrorBoundary from './components/ErrorBoundary';

export default function App() {
  const location = useLocation();
  const hideNavbar = location.pathname === '/onboarding';

  return (
    <>
    <ToastProvider>
      {!hideNavbar && <Navbar />}
      <main className={`flex-1 ${hideNavbar ? '' : 'pt-20'}`}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route element={<GuestOnlyRoute />}>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
          </Route>
          <Route path="/onboarding" element={<OnboardingRoute />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/shop/:id" element={<ShopDetail />} />
            <Route path="/shop/:id/product/:productId/negotiate" element={<ShopNegotiation />} />
            <Route path="/shop/:id/product/:productId/checkout" element={<ShopCheckout />} />
            <Route path="/shop/:id/product/:productId/confirmation" element={<ShopConfirmation />} />
            <Route path="/explore" element={<Explore />} />
            <Route path="/listing/:id" element={<ListingDetail />} />
            <Route path="/create" element={<CreateListing />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/messages/:bookingId" element={<Messages />} />
            <Route path="/dm" element={<DirectMessages />} />
            <Route path="/dm/:partnerId" element={<DirectMessages />} />
            <Route path="/profile/:id" element={<Profile />} />
            <Route path="/feed" element={<ErrorBoundary><Feed /></ErrorBoundary>} />
            <Route path="/dating" element={<Dating />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Footer />
    </ToastProvider>
    </>
  );
}

function GuestOnlyRoute() {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const hasCompletedOnboarding = useSelector(selectHasCompletedOnboarding);

  if (!isAuthenticated) {
    return <Outlet />;
  }

  return <Navigate to={hasCompletedOnboarding ? '/dashboard' : '/onboarding'} replace />;
}

function ProtectedRoute() {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const hasCompletedOnboarding = useSelector(selectHasCompletedOnboarding);
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/register" replace state={{ from: location.pathname }} />;
  }

  if (!hasCompletedOnboarding) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
}

function OnboardingRoute() {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const hasCompletedOnboarding = useSelector(selectHasCompletedOnboarding);

  if (!isAuthenticated) {
    return <Navigate to="/register" replace />;
  }

  if (hasCompletedOnboarding) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Onboarding />;
}
