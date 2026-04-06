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
      navigate('/onboarding');
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
            <div className="w-12 h-12 rounded-2xl bg-[#CDFF00] border border-[#CDFF00] flex items-center justify-center text-black font-heading font-extrabold text-2xl group-hover:scale-105 transition-all shadow-[0_0_20px_rgba(205,255,0,0.3)]">
              H
            </div>
          </Link>
          <h1 className="text-3xl font-heading font-black text-white mb-2 uppercase tracking-tight">Join the Syndicate</h1>
          <p className="text-gray-500 font-bold uppercase tracking-[0.3em] text-[10px]">Create your global account</p>
        </div>

        <div className="glass bg-black/60 border border-white/10 rounded-[2.5rem] p-10 shadow-2xl backdrop-blur-3xl">
          {displayError && (
            <div className="mb-8 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-black uppercase tracking-widest text-center flex items-center justify-center gap-3">
              <X className="w-4 h-4" /> {displayError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Role Selection */}
            <div className="mb-10">
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-4 ml-1">Account Type</label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, role: 'BUYER' })}
                  className={`p-5 rounded-2xl border text-center transition-all flex flex-col items-center gap-3 outline-none ${
                    form.role === 'BUYER'
                      ? 'border-[#CDFF00] bg-[#CDFF00] text-black shadow-[0_10px_20px_rgba(205,255,0,0.2)]'
                      : 'border-white/10 bg-white/5 text-gray-500 hover:border-white/20'
                  }`}
                >
                  <ShoppingBag className={`w-6 h-6 ${form.role === 'BUYER' ? 'text-black' : 'text-gray-600'}`} />
                  <span className="text-[10px] font-black uppercase tracking-[0.1em]">Buyer / Client</span>
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, role: 'SELLER' })}
                  className={`p-5 rounded-2xl border text-center transition-all flex flex-col items-center gap-3 outline-none ${
                    form.role === 'SELLER'
                      ? 'border-[#CDFF00] bg-[#CDFF00] text-black shadow-[0_10px_20px_rgba(205,255,0,0.2)]'
                      : 'border-white/10 bg-white/5 text-gray-500 hover:border-white/20'
                  }`}
                >
                  <Briefcase className={`w-6 h-6 ${form.role === 'SELLER' ? 'text-black' : 'text-gray-600'}`} />
                  <span className="text-[10px] font-black uppercase tracking-[0.1em]">Hustler / Seller</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-3 ml-1">Full Name</label>
              <input
                type="text"
                required
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                className="w-full px-6 py-5 rounded-2xl bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:border-[#CDFF00] focus:ring-1 focus:ring-[#CDFF00] outline-none transition-all font-bold text-sm"
                placeholder="Your name"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-3 ml-1">Email</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-6 py-5 rounded-2xl bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:border-[#CDFF00] focus:ring-1 focus:ring-[#CDFF00] outline-none transition-all font-bold text-sm"
                placeholder="email@example.com"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-3 ml-1">Password</label>
              <input
                type="password"
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full px-6 py-5 rounded-2xl bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:border-[#CDFF00] focus:ring-1 focus:ring-[#CDFF00] outline-none transition-all font-bold text-sm"
                placeholder="Min. 6 characters"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-5 rounded-2xl bg-[#CDFF00] text-black font-black uppercase tracking-[0.2em] text-[11px] hover:scale-[1.02] active:scale-95 disabled:opacity-50 transition-all shadow-[0_20px_40px_rgba(205,255,0,0.15)] flex items-center justify-center gap-3 outline-none mt-6"
            >
              {loading ? 'Processing...' : <><UserPlus className="w-5 h-5" /> Create Account</>}
            </button>
          </form>

          <div className="mt-10">
            <div className="relative flex items-center justify-center mb-8">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
              <span className="relative px-6 bg-[#050505] text-[9px] font-black text-gray-600 uppercase tracking-[0.4em]">External Nodes</span>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {[
                { name: 'Google', icon: (props) => <svg viewBox="0 0 24 24" {...props}><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg> },
                { name: 'Apple', icon: (props) => <svg viewBox="0 0 24 24" {...props}><path fill="currentColor" d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.1 1 1.12-.42 2.15-1.12 3.63-.97 1.94.12 3.41 1.02 4.13 2.62-3.83 2-3.03 7.33.69 8.65a7.18 7.18 0 0 1-3.5 1.67zm-3.16-15.01c-.13-2.68 2.24-4.8 4.67-5.27.35 2.89-2.5 5.25-4.67 5.27z"/></svg> },
                { name: 'Facebook', icon: (props) => <svg viewBox="0 0 24 24" {...props}><path fill="currentColor" d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c5.05-.5 9-4.76 9-9.95z"/></svg> }
              ].map((provider) => (
                <button
                  key={provider.name}
                  className="flex flex-col items-center justify-center p-5 rounded-[2rem] bg-white/5 border border-white/10 hover:border-white/30 hover:bg-white/10 transition-all group active:scale-95 shadow-lg"
                >
                  <div className="text-gray-400 group-hover:text-white transition-colors mb-3">
                    <provider.icon className="w-6 h-6" />
                  </div>
                  <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest group-hover:text-gray-300 transition-colors">{provider.name}</span>
                </button>
              ))}
            </div>
          </div>

          <p className="text-center mt-10 text-[10px] font-black text-gray-600 uppercase tracking-[0.2em]">
            Already have an account?{' '}
            <Link to="/login" className="text-[#CDFF00] hover:scale-105 inline-flex items-center gap-2 transition-transform">
              Sign In <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
