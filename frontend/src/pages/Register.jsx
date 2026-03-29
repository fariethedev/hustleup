import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useDispatch, useSelector } from 'react-redux';
import { registerUser, clearError } from '../store/authSlice';
import { UserPlus, ArrowRight, X, Briefcase, ShoppingBag } from 'lucide-react';

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
      navigate('/dashboard');
    }
  };

  const displayError = localError || error;

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-10 mt-10">
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
          <h1 className="text-3xl font-heading font-extrabold text-white mb-2 uppercase tracking-tight">Join HustleUp</h1>
          <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Create your account</p>
        </div>

        <div className="glass rounded-3xl p-8 border border-white/5">
          {displayError && (
            <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm font-bold uppercase tracking-wider text-center flex items-center justify-center gap-2">
              <X className="w-4 h-4" /> {displayError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Role Selection */}
            <div className="mb-8">
              <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-3">I want to</label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, role: 'BUYER' })}
                  className={`p-4 rounded-xl border text-center transition-all flex flex-col items-center gap-2 outline-none ${
                    form.role === 'BUYER'
                      ? 'border-[#CDFF00] bg-[#CDFF00]/10 text-[#CDFF00] shadow-[0_0_15px_rgba(205,255,0,0.1)]'
                      : 'border-white/10 bg-black/50 text-gray-400 hover:border-white/30 hover:text-white'
                  }`}
                >
                  <ShoppingBag className={`w-6 h-6 ${form.role === 'BUYER' ? 'text-[#CDFF00]' : 'text-gray-500'}`} />
                  <span className="text-[10px] font-black uppercase tracking-widest">Buy & Hire</span>
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, role: 'SELLER' })}
                  className={`p-4 rounded-xl border text-center transition-all flex flex-col items-center gap-2 outline-none ${
                    form.role === 'SELLER'
                      ? 'border-[#CDFF00] bg-[#CDFF00]/10 text-[#CDFF00] shadow-[0_0_15px_rgba(205,255,0,0.1)]'
                      : 'border-white/10 bg-black/50 text-gray-400 hover:border-white/30 hover:text-white'
                  }`}
                >
                  <Briefcase className={`w-6 h-6 ${form.role === 'SELLER' ? 'text-[#CDFF00]' : 'text-gray-500'}`} />
                  <span className="text-[10px] font-black uppercase tracking-widest">Sell & Offer</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Full Name</label>
              <input
                type="text"
                required
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                className="w-full px-5 py-4 rounded-xl bg-black border border-white/10 text-white placeholder-gray-600 focus:border-[#CDFF00] focus:ring-1 focus:ring-[#CDFF00] outline-none transition-all font-bold"
                placeholder="Your name"
              />
            </div>

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
                placeholder="At least 6 characters"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-xl bg-[#CDFF00] text-black font-black uppercase tracking-widest hover:bg-[#E0FF4D] disabled:opacity-50 transition-all shadow-lg hover:shadow-[#CDFF00]/20 flex items-center justify-center gap-2 outline-none mt-4"
            >
              {loading ? 'Creating account...' : <><UserPlus className="w-5 h-5" /> Create Account</>}
            </button>
          </form>

          <p className="text-center mt-8 text-xs font-bold text-gray-500 uppercase tracking-widest">
            Already have an account?{' '}
            <Link to="/login" className="text-[#CDFF00] hover:text-[#E0FF4D] inline-flex items-center gap-1">
              Sign in <ArrowRight className="w-3 h-3" />
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
