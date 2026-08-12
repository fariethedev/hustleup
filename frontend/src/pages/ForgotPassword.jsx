import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { authApi } from '../api/client';
import { Mail, ArrowLeft } from 'lucide-react';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      // Always succeeds regardless of whether the email is registered — the backend
      // deliberately doesn't reveal which addresses have accounts.
      await authApi.forgotPassword(email);
    } finally {
      setSending(false);
      setSent(true);
    }
  };

  return (
    <div className="min-h-[calc(100vh-7.5rem)] md:min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-4">
      <motion.div className="w-full max-w-sm" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="text-center mb-5">
          <Link to="/" className="inline-flex mb-3 group">
            <div className="w-10 h-10 rounded-xl bg-[#CDFF00] flex items-center justify-center text-black font-heading font-extrabold text-xl group-hover:scale-105 transition-transform shadow-[0_0_20px_rgba(205,255,0,0.3)]">H</div>
          </Link>
          <h1 className="text-2xl font-heading font-black text-white">Reset your password</h1>
          <p className="text-gray-400 text-sm mt-1">We'll email you a reset link</p>
        </div>

        <div className="glass bg-black/60 border border-white/10 rounded-3xl p-6 shadow-2xl backdrop-blur-3xl">
          {sent ? (
            <div className="text-center py-2">
              <div className="w-12 h-12 rounded-full bg-[#CDFF00]/10 flex items-center justify-center mx-auto mb-4">
                <Mail className="w-5 h-5 text-[#CDFF00]" />
              </div>
              <p className="text-white font-semibold mb-1">Check your inbox</p>
              <p className="text-gray-400 text-sm">If that email is registered, a reset link is on its way.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-1.5">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-[#CDFF00] focus:ring-1 focus:ring-[#CDFF00] outline-none transition-all text-sm"
                  placeholder="you@example.com"
                />
              </div>
              <button
                type="submit"
                disabled={sending}
                className="w-full py-3 rounded-xl bg-[#CDFF00] text-black font-bold text-sm hover:brightness-110 active:scale-[0.98] disabled:opacity-50 transition-all outline-none"
              >
                {sending ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
          )}

          <Link to="/login" className="flex items-center justify-center gap-1.5 mt-5 text-sm text-gray-400 hover:text-white transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to log in
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
