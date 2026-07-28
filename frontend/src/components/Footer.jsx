import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Globe, Camera, MessageCircle, Code } from 'lucide-react';
import { LISTING_TYPES } from '../utils/constants';

export default function Footer() {
  return (
    <footer className="py-24 bg-black border-t border-white/5 relative overflow-hidden">
      {/* Background Glows */}
      <div className="ambient-glow ambient-glow-purple bottom-[-10%] right-[-10%] opacity-10" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-16">
          {/* Brand & Description */}
          <div className="lg:col-span-2">
            <Link to="/" className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-xl bg-[#D3FF37] flex items-center justify-center text-black font-heading font-black text-xl">
                H
              </div>
              <span className="text-2xl font-heading font-black text-white tracking-tighter">HustleUp.</span>
            </Link>
            <p className="text-gray-500 leading-relaxed max-w-sm mb-10 text-lg font-medium">
              The all-in-one platform where students buy, sell, find gigs and grow their hustle — built by students, for students.
            </p>
            <div className="flex gap-5">
              {[Globe, Camera, MessageCircle, Code].map((Icon, i) => (
                <motion.div key={i} className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center text-gray-400 hover:text-[#D3FF37] hover:border-[#D3FF37] transition-all cursor-pointer group">
                  <Icon className="w-5 h-5 group-hover:scale-110 transition-transform" />
                </motion.div>
              ))}
            </div>
          </div>

          {/* Nav Columns */}
          <div>
            <h4 className="text-white font-black text-sm mb-8 uppercase tracking-[0.2em]">Explore</h4>
            <ul className="space-y-4 text-gray-500 font-bold">
              {LISTING_TYPES.map((type) => (
                <li key={type.value}>
                  <Link to={`/explore?type=${type.value}`} className="hover:text-white transition-colors">
                    {type.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-white font-black text-sm mb-8 uppercase tracking-[0.2em]">Platform</h4>
            <ul className="space-y-4 text-gray-500 font-bold">
              <li><Link to="/jobs" className="hover:text-white transition-colors">Jobs &amp; Gigs</Link></li>
              <li><Link to="/feed" className="hover:text-white transition-colors">Community Feed</Link></li>
              <li><Link to="/news" className="hover:text-white transition-colors">Campus News</Link></li>
              <li><Link to="/dashboard" className="hover:text-white transition-colors">Dashboard</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-black text-sm mb-8 uppercase tracking-[0.2em]">Company</h4>
            <ul className="space-y-4 text-gray-500 font-bold">
              <li><Link to="/#about" className="hover:text-white transition-colors">About Us</Link></li>
              <li><Link to="/" className="hover:text-white transition-colors">Help Center</Link></li>
              <li><Link to="/" className="hover:text-white transition-colors">Blog</Link></li>
            </ul>
          </div>
        </div>

        {/* Copyright Line */}
        <div className="mt-24 pt-10 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-6 text-gray-600 font-bold text-sm">
          <p>© {new Date().getFullYear()} HustleUp. All rights reserved.</p>
          <div className="flex gap-8">
            <Link to="/" className="hover:text-gray-400">Privacy Policy</Link>
            <Link to="/" className="hover:text-gray-400">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

// Simple wrapper since motion might not be imported or used for simple hover here

