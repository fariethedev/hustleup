import { useState, useEffect } from 'react';
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
import { Turnstile } from '@marsidev/react-turnstile';
import { registerUser, googleLogin, facebookLogin, clearError, selectFieldErrors } from '../store/authSlice';
import { X, Briefcase, ShoppingBag, AtSign, Check, Loader2, Eye, EyeOff } from 'lucide-react';
import { authApi } from '../api/client';

const GoogleIcon = (props) => <svg viewBox="0 0 24 24" {...props}><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>;
const AppleIcon = (props) => <svg viewBox="0 0 24 24" {...props}><path fill="currentColor" d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.1 1 1.12-.42 2.15-1.12 3.63-.97 1.94.12 3.41 1.02 4.13 2.62-3.83 2-3.03 7.33.69 8.65a7.18 7.18 0 0 1-3.5 1.67zm-3.16-15.01c-.13-2.68 2.24-4.8 4.67-5.27.35 2.89-2.5 5.25-4.67 5.27z"/></svg>;
const FacebookIcon = (props) => <svg viewBox="0 0 24 24" {...props}><path fill="currentColor" d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c5.05-.5 9-4.76 9-9.95z"/></svg>;

// Mirrors the backend's @Pattern on RegisterRequest.password (AuthDtos.java) — kept in
// sync manually since one lives in a regex annotation and the other in JS.
const PASSWORD_POLICY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
const PASSWORD_POLICY_MESSAGE = 'Password must be at least 8 characters and include an uppercase letter, a lowercase letter, and a number';

const roles = [
  { value: 'BUYER', label: 'Buyer', hint: 'I want to shop & hire', icon: ShoppingBag },
  { value: 'SELLER', label: 'Seller', hint: 'I want to sell & earn', icon: Briefcase },
];

export default function Register() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, error } = useSelector((state) => state.auth);
  const [form, setForm] = useState({ fullName: '', username: '', email: '', password: '', phone: '', role: 'BUYER' });
  // null = not checked yet; otherwise { available, wellFormed } from the server.
  const [usernameState, setUsernameState] = useState(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [localError, setLocalError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  // Which specific inputs the server rejected, so the message sits next to the field
  // that caused it rather than only in the banner at the top of the form.
  const fieldErrors = useSelector(selectFieldErrors);
  const [captchaToken, setCaptchaToken] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;

  // Debounced so typing a handle doesn't fire a request per keystroke. The check is a
  // convenience only — registration re-validates format and uniqueness server-side.
  useEffect(() => {
    const candidate = form.username.trim();
    if (!candidate) { setUsernameState(null); return; }
    setCheckingUsername(true);
    const t = setTimeout(() => {
      authApi.usernameAvailable(candidate)
        .then((r) => setUsernameState(r.data))
        .catch(() => setUsernameState(null))
        .finally(() => setCheckingUsername(false));
    }, 400);
    return () => { clearTimeout(t); setCheckingUsername(false); };
  }, [form.username]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    dispatch(clearError());

    if (!PASSWORD_POLICY.test(form.password)) {
      setLocalError(PASSWORD_POLICY_MESSAGE);
      return;
    }
    if (!termsAccepted) {
      setLocalError('You must accept the Terms & Conditions to sign up');
      return;
    }
    if (usernameState && !usernameState.available) {
      setLocalError(usernameState.wellFormed
        ? 'That username is already taken'
        : 'Username must be 3–20 characters: letters, numbers, dots or underscores');
      return;
    }

    const resultAction = await dispatch(registerUser({ ...form, captchaToken, termsAccepted }));
    if (registerUser.fulfilled.match(resultAction)) {
      // Straight to the code screen — the account exists and is signed in, but the address
      // is unconfirmed, and confirming it is far more likely to happen now than later.
      navigate('/verify-code', { state: { email: form.email } });
    }
  };

  // OAuth sign-up and sign-in are the same request — the backend finds-or-creates the
  // account, so there's no separate "register with Google" endpoint to call.
  const afterSocialAuth = (resultAction, matcher) => {
    if (matcher.match(resultAction)) navigate('/onboarding');
  };

  const handleGoogle = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      dispatch(clearError());
      const resultAction = await dispatch(googleLogin(tokenResponse.access_token));
      afterSocialAuth(resultAction, googleLogin);
    },
  });

  const handleFacebook = async (response) => {
    if (!response?.accessToken) return;
    dispatch(clearError());
    const resultAction = await dispatch(facebookLogin(response.accessToken));
    afterSocialAuth(resultAction, facebookLogin);
  };

  const displayError = localError || error;

  return (
    <div className="min-h-[calc(100vh-3.5rem)] md:min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-4 overflow-hidden">
      <motion.div
        className="w-full min-w-0 max-w-xl"
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
                    className={`p-3 rounded-xl border text-left transition-all flex items-center gap-2.5 outline-none min-w-0 ${
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-1.5">Full name</label>
                <input
                  type="text"
                  required
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  className={`w-full px-4 py-2.5 rounded-xl bg-white/5 border text-white placeholder-gray-500 focus:ring-1 outline-none transition-all text-sm ${
                    fieldErrors?.fullName
                      ? 'border-red-500/60 focus:border-red-500 focus:ring-red-500'
                      : 'border-white/10 focus:border-[#CDFF00] focus:ring-[#CDFF00]'
                  }`}
                  placeholder="Your name"
                />
                {fieldErrors?.fullName && (
                  <p className="mt-1.5 text-[11px] text-red-400 font-medium">{fieldErrors.fullName}</p>
                )}
              </div>

              {/* Public handle. Availability is checked as you type so a clash surfaces
                  before submitting rather than as a rejected form. */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-1.5">Username</label>
                <div className="relative">
                  <AtSign className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value.replace(/\s/g, '') })}
                    autoComplete="username"
                    maxLength={20}
                    className={`w-full pl-9 pr-10 py-2.5 rounded-xl bg-white/5 border text-white placeholder-gray-500 outline-none transition-all text-sm focus:ring-1 ${
                      usernameState && !usernameState.available
                        ? 'border-red-500/60 focus:border-red-500 focus:ring-red-500'
                        : usernameState?.available
                          ? 'border-[#CDFF00]/60 focus:border-[#CDFF00] focus:ring-[#CDFF00]'
                          : 'border-white/10 focus:border-[#CDFF00] focus:ring-[#CDFF00]'
                    }`}
                    placeholder="yourhandle"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2">
                    {checkingUsername && <Loader2 className="w-4 h-4 text-gray-500 animate-spin" />}
                    {!checkingUsername && usernameState?.available && <Check className="w-4 h-4 text-[#CDFF00]" />}
                    {!checkingUsername && usernameState && !usernameState.available && <X className="w-4 h-4 text-red-400" />}
                  </span>
                </div>
                {/* The server's verdict wins over the as-you-type check: it is the one
                    that actually rejected the submission. */}
                {fieldErrors?.username ? (
                  <p className="mt-1.5 text-[11px] text-red-400 font-medium">{fieldErrors.username}</p>
                ) : !checkingUsername && usernameState && !usernameState.available ? (
                  <p className="mt-1.5 text-[11px] text-red-400 font-medium">
                    {usernameState.wellFormed
                      ? 'That username is taken'
                      : '3–20 characters: letters, numbers, dots or underscores'}
                  </p>
                ) : null}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-1.5">Email</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className={`w-full px-4 py-2.5 rounded-xl bg-white/5 border text-white placeholder-gray-500 focus:ring-1 outline-none transition-all text-sm ${
                    fieldErrors?.email
                      ? 'border-red-500/60 focus:border-red-500 focus:ring-red-500'
                      : 'border-white/10 focus:border-[#CDFF00] focus:ring-[#CDFF00]'
                  }`}
                  placeholder="you@example.com"
                />
                {fieldErrors?.email && (
                  <p className="mt-1.5 text-[11px] text-red-400 font-medium">{fieldErrors.email}</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className={`w-full px-4 pr-11 py-2.5 rounded-xl bg-white/5 border text-white placeholder-gray-500 focus:ring-1 outline-none transition-all text-sm ${
                    fieldErrors?.password
                      ? 'border-red-500/60 focus:border-red-500 focus:ring-red-500'
                      : 'border-white/10 focus:border-[#CDFF00] focus:ring-[#CDFF00]'
                  }`}
                  placeholder="8+ characters, upper/lowercase & a number"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  // Not in the tab order: keyboard users tabbing from password to Sign up
                  // should not have to step through a visibility control.
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors p-0.5"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {fieldErrors?.password ? (
                <p className="mt-1.5 text-[11px] text-red-400 font-medium">{fieldErrors.password}</p>
              ) : form.password.length > 0 && !PASSWORD_POLICY.test(form.password) ? (
                <p className="mt-1 text-[11px] text-gray-500">{PASSWORD_POLICY_MESSAGE}</p>
              ) : null}
            </div>

            <label className="flex items-start gap-2.5 text-xs text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-0.5 accent-[#CDFF00] w-4 h-4 shrink-0"
              />
              <span className="min-w-0">
                I agree to HustleSpace's{' '}
                <Link to="/terms" target="_blank" className="text-[#CDFF00] hover:underline">Terms &amp; Conditions</Link>{' '}
                and{' '}
                <Link to="/privacy" target="_blank" className="text-[#CDFF00] hover:underline">Privacy Policy</Link>.
              </span>
            </label>

            {/* Only rendered once a real site key is configured — a blank key would
                render a broken widget, so this stays invisible (and non-blocking,
                since the backend's TurnstileService no-ops without a secret key too). */}
            {turnstileSiteKey && (
              <Turnstile siteKey={turnstileSiteKey} onSuccess={setCaptchaToken} className="mx-auto" />
            )}

            <button
              type="submit"
              disabled={loading || !termsAccepted || (!!turnstileSiteKey && !captchaToken)}
              className="w-full py-3 rounded-xl bg-[#CDFF00] text-black font-bold text-sm hover:brightness-110 active:scale-[0.98] disabled:opacity-50 transition-all outline-none"
            >
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          <div className="relative flex items-center justify-center my-4">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10"></div></div>
            <span className="relative px-3 bg-[#0a0a0a] text-xs text-gray-500">or continue with</span>
          </div>

          {!termsAccepted && (
            <p className="text-center text-[11px] text-gray-500 mb-2">Accept the terms above to enable one-tap sign-up</p>
          )}
          <div className="grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => handleGoogle()}
              disabled={!termsAccepted}
              aria-label="Continue with Google"
              className="flex items-center justify-center h-11 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:text-white hover:border-white/30 hover:bg-white/10 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <GoogleIcon className="w-5 h-5" />
            </button>
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
                  disabled={!termsAccepted}
                  aria-label="Continue with Facebook"
                  className="w-full flex items-center justify-center h-11 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:text-white hover:border-white/30 hover:bg-white/10 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <FacebookIcon className="w-5 h-5" />
                </button>
              )}
            />
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
