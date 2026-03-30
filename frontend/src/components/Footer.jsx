import { Link } from 'react-router-dom';
import { LISTING_TYPES } from '../utils/constants';

export default function Footer() {
  return (
    <footer className="border-t border-white/5 mt-auto bg-[#121212]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 rounded-xl bg-[#CDFF00] flex items-center justify-center text-white font-heading font-extrabold text-base">
                H
              </div>
              <span className="text-lg font-heading font-bold text-white">HustleUp</span>
            </Link>
            <p className="text-sm text-gray-500 leading-relaxed">
              The marketplace for hustlers. Buy, sell, trade, and connect with independent creators and service providers.
            </p>
          </div>

          {/* Categories */}
          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Categories</h4>
            <ul className="space-y-2">
              {LISTING_TYPES.map((t) => (
                <li key={t.value}>
                  <Link
                    to={`/explore?type=${t.value}`}
                    className="text-sm text-gray-500 hover:text-[#CDFF00] transition-colors"
                  >
                    {t.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Platform */}
          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Platform</h4>
            <ul className="space-y-2">
              <li><Link to="/explore" className="text-sm text-gray-500 hover:text-[#CDFF00] transition-colors">Browse Listings</Link></li>
              <li><Link to="/register" className="text-sm text-gray-500 hover:text-[#CDFF00] transition-colors">Become a Seller</Link></li>
              <li><Link to="/dashboard" className="text-sm text-gray-500 hover:text-[#CDFF00] transition-colors">Dashboard</Link></li>
            </ul>
          </div>

          {/* Connect */}
          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Connect</h4>
            <ul className="space-y-2">
              <li><a href="#" className="text-sm text-gray-500 hover:text-[#CDFF00] transition-colors">Twitter / X</a></li>
              <li><a href="#" className="text-sm text-gray-500 hover:text-[#CDFF00] transition-colors">Instagram</a></li>
              <li><a href="#" className="text-sm text-gray-500 hover:text-[#CDFF00] transition-colors">Discord</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-400">© {new Date().getFullYear()} HustleUp. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="#" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Privacy Policy</a>
            <a href="#" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Terms of Service</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
