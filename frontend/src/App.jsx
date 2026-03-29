import { Routes, Route } from 'react-router-dom';
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

export default function App() {
  return (
    <>
      <Navbar />
      <main className="flex-1 pt-20">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/listing/:id" element={<ListingDetail />} />
          <Route path="/create" element={<CreateListing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/messages/:bookingId" element={<Messages />} />
          <Route path="/dm" element={<DirectMessages />} />
          <Route path="/dm/:partnerId" element={<DirectMessages />} />
          <Route path="/profile/:id" element={<Profile />} />
          <Route path="/feed" element={<Feed />} />
          <Route path="/dating" element={<Dating />} />
        </Routes>
      </main>
      <Footer />
    </>
  );
}
