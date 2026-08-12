import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useDispatch, useSelector } from 'react-redux';
import { useGoogleLogin } from '@react-oauth/google';
// This package's CJS build double-wraps its default export under Vite's dep
// pre-bundling (the ESM `default` ends up being the whole `exports` object, with the
// real component nested one level deeper at `.default`) — unwrap defensively so it
// works whether or not Vite's bundling behavior for this package changes later.
import FacebookLoginRaw from '@greatsumini/react-facebook-login';
const FacebookLogin = FacebookLoginRaw.default || FacebookLoginRaw;
import { loginUser, googleLogin, facebookLogin, clearError } from '../store/authSlice';
import { X } from 'lucide-react';

const GoogleIcon = (props) => <svg viewBox="0 0 24 24" {...props}><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>;
const AppleIcon = (props) => <svg viewBox="0 0 24 24" {...props}><path fill="currentColor" d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.1 1 1.12-.42 2.15-1.12 3.63-.97 1.94.12 3.41 1.02 4.13 2.62-3.83 2-3.03 7.33.69 8.65a7.18 7.18 0 0 1-3.5 1.67zm-3.16-15.01c-.13-2.68 2.24-4.8 4.67-5.27.35 2.89-2.5 5.25-4.67 5.27z"/></svg>;
const FacebookIcon = (props) => <svg viewBox="0 0 24 24" {...props}><path fill="currentColor" d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c5.05-.5 9-4.76 9-9.95z"/></svg>;

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
      navigate(resultAction.payload?.onboardingCompleted ? '/dashboard' : '/onboarding');
    }
  };

  const afterSocialLogin = (resultAction, matcher) => {
    if (matcher.match(resultAction)) {
      navigate(resultAction.payload?.onboardingCompleted ? '/dashboard' : '/onboarding');
    }
  };

  // Google returns an OAuth access token here (implicit flow) rather than an ID token —
  // simpler to wire up client-side; the backend endpoint takes whichever the client sends
  // and verifies it against Google directly.
  const handleGoogle = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      dispatch(clearError());
      const resultAction = await dispatch(googleLogin(tokenResponse.access_token));
      afterSocialLogin(resultAction, googleLogin);
    },
  });

  const handleFacebook = async (response) => {
    if (!response?.accessToken) return;
    dispatch(clearError());
    const resultAction = await dispatch(facebookLogin(response.accessToken));
    afterSocialLogin(resultAction, facebookLogin);
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] md:min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-4 overflow-hidden">
      <motion.div
        className="w-full min-w-0 max-w-md"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="text-center mb-5">
          <Link to="/" className="inline-flex mb-3 group">
            <div className="w-10 h-10 rounded-xl bg-[#CDFF00] flex items-center justify-center text-black font-heading font-extrabold text-xl group-hover:scale-105 transition-transform shadow-[0_0_20px_rgba(205,255,0,0.3)]">
              H
            </div>
          </Link>
          <h1 className="text-2xl font-heading font-black text-white">Welcome back</h1>
          <p className="text-gray-400 text-sm mt-1">Log in to your account</p>
        </div>

        <div className="glass bg-black/60 border border-white/10 rounded-3xl p-6 shadow-2xl backdrop-blur-3xl">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center flex items-center justify-center gap-2">
              <X className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
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
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-semibold text-gray-300">Password</label>
                <Link to="/forgot-password" className="text-xs font-semibold text-[#CDFF00] hover:underline">Forgot?</Link>
              </div>
              <input
                type="password"
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-[#CDFF00] focus:ring-1 focus:ring-[#CDFF00] outline-none transition-all text-sm"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-[#CDFF00] text-black font-bold text-sm hover:brightness-110 active:scale-[0.98] disabled:opacity-50 transition-all outline-none"
            >
              {loading ? 'Logging in...' : 'Log in'}
            </button>
          </form>

          <div className="relative flex items-center justify-center my-4">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10"></div></div>
            <span className="relative px-3 bg-[#0a0a0a] text-xs text-gray-500">or continue with</span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => handleGoogle()}
              aria-label="Continue with Google"
              className="flex items-center justify-center h-11 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:text-white hover:border-white/30 hover:bg-white/10 transition-all active:scale-95"
            >
              <GoogleIcon className="w-5 h-5" />
            </button>
            {/* Apple Sign-In needs a paid Apple Developer account to configure — left as a
                visual placeholder until that's set up. */}
            <button
              type="button"
              disabled
              aria-label="Continue with Apple (coming soon)"
              title="Coming soon"
              className="flex items-center justify-center h-11 rounded-xl bg-white/5 border border-white/10 text-gray-600 opacity-50 cursor-not-allowed"
            >
              <AppleIcon className="w-5 h-5" />
            </button>
            <FacebookLogin
              appId={import.meta.env.VITE_FACEBOOK_APP_ID || 'unset'}
              onSuccess={handleFacebook}
              onFail={() => {}}
              render={({ onClick }) => (
                <button
                  type="button"
                  onClick={onClick}
                  aria-label="Continue with Facebook"
                  className="w-full flex items-center justify-center h-11 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:text-white hover:border-white/30 hover:bg-white/10 transition-all active:scale-95"
                >
                  <FacebookIcon className="w-5 h-5" />
                </button>
              )}
            />
          </div>

          <p className="text-center mt-5 text-sm text-gray-400">
            Don't have an account?{' '}
            <Link to="/register" className="text-[#CDFF00] font-semibold hover:underline">
              Sign up
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
