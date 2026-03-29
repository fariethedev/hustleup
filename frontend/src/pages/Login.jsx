import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useDispatch, useSelector } from 'react-redux';
import { loginUser, clearError } from '../store/authSlice';
import { LogIn, ArrowRight, X } from 'lucide-react';

export default function Login() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, error } = useSelector((state) => state.auth);
  const [form, setForm] = useState({ email: '', password: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    dispatch(clearError());
    
    const resultAction = await dispatch(loginUser(form));
    if (loginUser.fulfilled.match(resultAction)) {
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 mt-10">
      <motion.div
        className="w-full max-w-md"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="text-center mb-10">
          <Link to="/" className="inline-flex items-center gap-2 mb-6 group">
            <div className="w-12 h-12 rounded-2xl bg-black border border-[#CDFF00]/30 flex items-center justify-center text-[#CDFF00] font-heading font-extrabold text-2xl group-hover:bg-[#CDFF00] group-hover:text-black transition-all">
              H
            </div>
          </Link>
          <h1 className="text-3xl font-heading font-extrabold text-white mb-2 uppercase tracking-tight">Welcome back</h1>
          <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Sign in to your account</p>
        </div>

        <div className="glass rounded-3xl p-8 border border-white/5">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm font-bold uppercase tracking-wider text-center flex items-center justify-center gap-2">
              <X className="w-4 h-4" /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Email</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-5 py-4 rounded-xl bg-black border border-white/10 text-white placeholder-gray-600 focus:border-[#CDFF00] focus:ring-1 focus:ring-[#CDFF00] outline-none transition-all font-bold"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Password</label>
              <input
                type="password"
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full px-5 py-4 rounded-xl bg-black border border-white/10 text-white placeholder-gray-600 focus:border-[#CDFF00] focus:ring-1 focus:ring-[#CDFF00] outline-none transition-all font-bold"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-xl bg-[#CDFF00] text-black font-black uppercase tracking-widest hover:bg-[#E0FF4D] disabled:opacity-50 transition-all shadow-lg hover:shadow-[#CDFF00]/20 flex items-center justify-center gap-2 outline-none mt-2"
            >
              {loading ? 'Signing in...' : <><LogIn className="w-5 h-5" /> Sign In</>}
            </button>
          </form>

          <p className="text-center mt-8 text-xs font-bold text-gray-500 uppercase tracking-widest">
            Don't have an account?{' '}
            <Link to="/register" className="text-[#CDFF00] hover:text-[#E0FF4D] inline-flex items-center gap-1">
              Sign up <ArrowRight className="w-3 h-3" />
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
