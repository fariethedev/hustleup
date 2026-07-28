import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useDispatch, useSelector } from 'react-redux';
import { registerUser, clearError } from '../store/authSlice';
import { X, Briefcase, ShoppingBag } from 'lucide-react';

const socialProviders = [
  { name: 'Google', icon: (props) => <svg viewBox="0 0 24 24" {...props}><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg> },
  { name: 'Apple', icon: (props) => <svg viewBox="0 0 24 24" {...props}><path fill="currentColor" d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.1 1 1.12-.42 2.15-1.12 3.63-.97 1.94.12 3.41 1.02 4.13 2.62-3.83 2-3.03 7.33.69 8.65a7.18 7.18 0 0 1-3.5 1.67zm-3.16-15.01c-.13-2.68 2.24-4.8 4.67-5.27.35 2.89-2.5 5.25-4.67 5.27z"/></svg> },
  { name: 'Facebook', icon: (props) => <svg viewBox="0 0 24 24" {...props}><path fill="currentColor" d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c5.05-.5 9-4.76 9-9.95z"/></svg> },
];

const roles = [
  { value: 'BUYER', label: 'Buyer', hint: 'I want to shop & hire', icon: ShoppingBag },
  { value: 'SELLER', label: 'Seller', hint: 'I want to sell & earn', icon: Briefcase },
];

export default function Register() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, error } = useSelector((state) => state.auth);
  const [form, setForm] = useState({ fullName: '', email: '', password: '', phone: '', role: 'BUYER' });
  const [localError, setLocalError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    dispatch(clearError());

    if (form.password.length < 6) {
      setLocalError('Password must be at least 6 characters');
      return;
    }

    const resultAction = await dispatch(registerUser(form));
    if (registerUser.fulfilled.match(resultAction)) {
      navigate('/onboarding');
    }
  };

  const displayError = localError || error;

  return (
    <div className="min-h-[calc(100vh-7.5rem)] md:min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-4">
      <motion.div
        className="w-full max-w-sm"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="text-center mb-4">
          <Link to="/" className="inline-flex mb-2 group">
            <div className="w-10 h-10 rounded-xl bg-[#CDFF00] flex items-center justify-center text-black font-heading font-extrabold text-xl group-hover:scale-105 transition-transform shadow-[0_0_20px_rgba(205,255,0,0.3)]">
              H
            </div>
          </Link>
          <h1 className="text-2xl font-heading font-black text-white">Create your account</h1>
          <p className="text-gray-400 text-sm mt-1">It only takes a minute</p>
        </div>

        <div className="glass bg-black/60 border border-white/10 rounded-3xl p-6 shadow-2xl backdrop-blur-3xl">
          {displayError && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center flex items-center justify-center gap-2">
              <X className="w-4 h-4 shrink-0" /> {displayError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-1.5">I want to join as</label>
              <div className="grid grid-cols-2 gap-3">
                {roles.map((role) => (
                  <button
                    key={role.value}
                    type="button"
                    onClick={() => setForm({ ...form, role: role.value })}
                    className={`p-3 rounded-xl border text-left transition-all flex items-center gap-2.5 outline-none ${
                      form.role === role.value
                        ? 'border-[#CDFF00] bg-[#CDFF00]/10 text-white'
                        : 'border-white/10 bg-white/5 text-gray-400 hover:border-white/25'
                    }`}
                  >
                    <role.icon className={`w-5 h-5 shrink-0 ${form.role === role.value ? 'text-[#CDFF00]' : 'text-gray-500'}`} />
                    <span className="min-w-0">
                      <span className="block text-sm font-bold leading-tight">{role.label}</span>
                      <span className="block text-[11px] text-gray-500 leading-tight">{role.hint}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-1.5">Full name</label>
              <input
                type="text"
                required
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-[#CDFF00] focus:ring-1 focus:ring-[#CDFF00] outline-none transition-all text-sm"
                placeholder="Your name"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-1.5">Email</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-[#CDFF00] focus:ring-1 focus:ring-[#CDFF00] outline-none transition-all text-sm"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-1.5">Password</label>
              <input
                type="password"
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-[#CDFF00] focus:ring-1 focus:ring-[#CDFF00] outline-none transition-all text-sm"
                placeholder="At least 6 characters"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-[#CDFF00] text-black font-bold text-sm hover:brightness-110 active:scale-[0.98] disabled:opacity-50 transition-all outline-none"
            >
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          <div className="relative flex items-center justify-center my-4">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10"></div></div>
            <span className="relative px-3 bg-[#0a0a0a] text-xs text-gray-500">or continue with</span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {socialProviders.map((provider) => (
              <button
                key={provider.name}
                type="button"
                aria-label={`Continue with ${provider.name}`}
                className="flex items-center justify-center h-11 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:text-white hover:border-white/30 hover:bg-white/10 transition-all active:scale-95"
              >
                <provider.icon className="w-5 h-5" />
              </button>
            ))}
          </div>

          <p className="text-center mt-4 text-sm text-gray-400">
            Already have an account?{' '}
            <Link to="/login" className="text-[#CDFF00] font-semibold hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
