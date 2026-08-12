import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { authApi } from '../api/client';
import { X, Check } from 'lucide-react';

// Mirrors the backend's password policy (AuthController.PASSWORD_POLICY / AuthDtos.java).
const PASSWORD_POLICY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
const PASSWORD_POLICY_MESSAGE = 'Password must be at least 8 characters and include an uppercase letter, a lowercase letter, and a number';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!PASSWORD_POLICY.test(password)) {
      setError(PASSWORD_POLICY_MESSAGE);
      return;
    }
    setSaving(true);
    try {
      await authApi.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.error || 'This reset link is invalid or has expired');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-7.5rem)] md:min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-4">
      <motion.div className="w-full max-w-sm" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="text-center mb-5">
          <Link to="/" className="inline-flex mb-3 group">
            <div className="w-10 h-10 rounded-xl bg-[#CDFF00] flex items-center justify-center text-black font-heading font-extrabold text-xl group-hover:scale-105 transition-transform shadow-[0_0_20px_rgba(205,255,0,0.3)]">H</div>
          </Link>
          <h1 className="text-2xl font-heading font-black text-white">Set a new password</h1>
        </div>

        <div className="glass bg-black/60 border border-white/10 rounded-3xl p-6 shadow-2xl backdrop-blur-3xl">
          {!token ? (
            <p className="text-center text-sm text-red-400">This link is missing its reset token.</p>
          ) : done ? (
            <div className="text-center py-2">
              <div className="w-12 h-12 rounded-full bg-[#CDFF00]/10 flex items-center justify-center mx-auto mb-4">
                <Check className="w-5 h-5 text-[#CDFF00]" />
              </div>
              <p className="text-white font-semibold mb-4">Password updated</p>
              <button
                onClick={() => navigate('/login')}
                className="w-full py-3 rounded-xl bg-[#CDFF00] text-black font-bold text-sm hover:brightness-110 active:scale-[0.98] transition-all"
              >
                Log in
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center flex items-center justify-center gap-2">
                  <X className="w-4 h-4 shrink-0" /> {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-1.5">New password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-[#CDFF00] focus:ring-1 focus:ring-[#CDFF00] outline-none transition-all text-sm"
                  placeholder="8+ characters, upper/lowercase & a number"
                />
                {password.length > 0 && !PASSWORD_POLICY.test(password) && (
                  <p className="mt-1 text-[11px] text-gray-500">{PASSWORD_POLICY_MESSAGE}</p>
                )}
              </div>
              <button
                type="submit"
                disabled={saving}
                className="w-full py-3 rounded-xl bg-[#CDFF00] text-black font-bold text-sm hover:brightness-110 active:scale-[0.98] disabled:opacity-50 transition-all outline-none"
              >
                {saving ? 'Saving…' : 'Update password'}
              </button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}
