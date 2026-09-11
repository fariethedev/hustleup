import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
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
import { CircleX, BriefcaseBusiness, ShoppingBasket, Hash, CircleCheck, Loader, ScanEye, EyeClosed, Navigation, MoveRight, MoveLeft, LockKeyhole, CircleUser, PhoneCall, WandSparkles } from 'lucide-react';
import { POLISH_CITIES } from '../utils/constants';
import { authApi } from '../api/client';
import PasswordStrength from '../components/PasswordStrength';
import { isValidPassword, passwordError } from '../utils/password';

const GoogleIcon = (props) => <svg viewBox="0 0 24 24" {...props}><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>;
const AppleIcon = (props) => <svg viewBox="0 0 24 24" {...props}><path fill="currentColor" d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.1 1 1.12-.42 2.15-1.12 3.63-.97 1.94.12 3.41 1.02 4.13 2.62-3.83 2-3.03 7.33.69 8.65a7.18 7.18 0 0 1-3.5 1.67zm-3.16-15.01c-.13-2.68 2.24-4.8 4.67-5.27.35 2.89-2.5 5.25-4.67 5.27z"/></svg>;
const FacebookIcon = (props) => <svg viewBox="0 0 24 24" {...props}><path fill="currentColor" d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c5.05-.5 9-4.76 9-9.95z"/></svg>;

const roles = [
  { value: 'BUYER', label: 'Buyer', hint: 'I want to shop & hire', icon: ShoppingBasket },
  { value: 'SELLER', label: 'Seller', hint: 'I want to sell & earn', icon: BriefcaseBusiness },
];

/**
 * The three steps, in order.
 *
 * <p>Split this way because the three ask for genuinely different things and fail in
 * different ways. Everything used to sit on one long form: a dozen inputs, a captcha and a
 * terms checkbox in a single scroll, where a mistake in the first field was only reported
 * after filling in the last. The password rules in particular arrived as a sentence under a
 * rejected submit, which is the one moment they are no longer useful.
 */
const STEPS = [
  { id: 1, label: 'Account', icon: LockKeyhole, blurb: 'Your email and a password' },
  { id: 2, label: 'Profile', icon: CircleUser, blurb: 'What to call you' },
  { id: 3, label: 'Finish', icon: WandSparkles, blurb: 'Check and confirm' },
];

const inputClass = (invalid) =>
  `w-full px-4 py-2.5 rounded-xl bg-white/5 border text-white placeholder-gray-500 focus:ring-1 outline-none transition-all text-sm ${
    invalid
      ? 'border-red-500/60 focus:border-red-500 focus:ring-red-500'
      : 'border-white/10 focus:border-[#CDFF00] focus:ring-[#CDFF00]'
  }`;

export default function Register() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, error } = useSelector((state) => state.auth);

  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    fullName: '', username: '', email: '', password: '', phone: '', city: '', role: 'BUYER',
  });
  // Kept out of `form` deliberately: it is a typo check, not a field. Nothing server-side
  // should ever receive a second copy of the password.
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
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

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

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

  // Only a mismatch worth showing: both boxes have content and they differ.
  const mismatch = confirmPassword.length > 0 && form.password !== confirmPassword;

  /**
   * Whether the current step is complete enough to move on.
   *
   * <p>Gating Next rather than only the final submit is the point of splitting the form up:
   * a problem is caught on the screen that caused it, while the field is still in front of
   * the person, instead of three screens later.
   */
  const canAdvance = useMemo(() => {
    if (step === 1) {
      return /\S+@\S+\.\S+/.test(form.email)
        && isValidPassword(form.password)
        && form.password === confirmPassword
        && termsAccepted;
    }
    if (step === 2) {
      return form.fullName.trim().length > 1
        && form.username.trim().length >= 3
        && (usernameState ? usernameState.available : true)
        && !checkingUsername;
    }
    return !!termsAccepted && (!turnstileSiteKey || !!captchaToken);
  }, [step, form, confirmPassword, termsAccepted, usernameState, checkingUsername, captchaToken, turnstileSiteKey]);

  const next = () => {
    setLocalError('');
    if (step === 1 && !isValidPassword(form.password)) {
      setLocalError(passwordError(form.password));
      return;
    }
    if (step === 1 && form.password !== confirmPassword) {
      setLocalError('Both passwords must match');
      return;
    }
    setStep((s) => Math.min(STEPS.length, s + 1));
  };

  const back = () => { setLocalError(''); setStep((s) => Math.max(1, s - 1)); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Enter inside a field on step 1 or 2 should advance, not submit a half-filled form.
    if (step < STEPS.length) { if (canAdvance) next(); return; }

    setLocalError('');
    dispatch(clearError());

    // Re-checked here as well as per-step: someone can reach the last screen and then go
    // back and break an earlier field without the step gate running again.
    const pwProblem = passwordError(form.password);
    if (pwProblem) { setLocalError(pwProblem); setStep(1); return; }
    if (form.password !== confirmPassword) { setLocalError('Both passwords must match'); setStep(1); return; }
    if (!termsAccepted) { setLocalError('You must accept the Terms & Conditions to sign up'); return; }
    if (usernameState && !usernameState.available) {
      setLocalError(usernameState.wellFormed
        ? 'That username is already taken'
        : 'Username must be 3–20 characters: letters, numbers, dots or underscores');
      setStep(2);
      return;
    }

    const resultAction = await dispatch(registerUser({ ...form, captchaToken, termsAccepted }));
    if (registerUser.fulfilled.match(resultAction)) {
      // Straight to the code screen. The account exists but there is no session yet — the
      // server withholds it until the address is confirmed, and verifying is what signs you
      // in. (Where the server has no way to send mail it signs you in here instead, since a
      // code nobody can receive would be a lockout rather than a check.)
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
  const current = STEPS[step - 1];

  return (
    <div className="min-h-[calc(100vh-3.5rem)] md:min-h-[calc(100vh-4rem)] flex items-start justify-center px-4 pt-4 pb-10 sm:pt-6">
      <motion.div
        className="w-full min-w-0 max-w-xl"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="text-center mb-5">
          <h1 className="text-2xl font-heading font-black text-white">Create your account</h1>
          <p className="text-gray-400 text-sm mt-1">{current.blurb}</p>
        </div>

        {/* ── Step rail ──────────────────────────────────────────────────────
            Shows where you are and how much is left, which is the thing a
            multi-step form has to answer before anyone will start it. Completed
            steps are tappable so a correction does not mean starting again. */}
        <div className="flex items-center gap-2 mb-5">
          {STEPS.map((s, i) => {
            const done = step > s.id;
            const active = step === s.id;
            const Icon = s.icon;
            return (
              <div key={s.id} className="flex items-center gap-2 flex-1 min-w-0">
                <button
                  type="button"
                  onClick={() => done && setStep(s.id)}
                  disabled={!done && !active}
                  aria-current={active ? 'step' : undefined}
                  className={`flex items-center gap-2 min-w-0 transition-opacity ${
                    done ? 'cursor-pointer hover:opacity-80' : 'cursor-default'
                  } ${!done && !active ? 'opacity-40' : ''}`}
                >
                  <motion.span
                    initial={false}
                    animate={{ scale: active ? 1.08 : 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                      done
                        ? 'bg-[#CDFF00] border-[#CDFF00] text-black'
                        : active
                          ? 'bg-[#CDFF00]/15 border-[#CDFF00]/50 text-[#CDFF00]'
                          : 'bg-white/5 border-white/10 text-gray-500'
                    }`}
                  >
                    {done ? <CircleCheck className="w-4 h-4" strokeWidth={3} /> : <Icon className="w-4 h-4" />}
                  </motion.span>
                  <span className={`text-[11px] font-black tracking-widest truncate hidden sm:block ${
                    active ? 'text-white' : 'text-gray-500'
                  }`}>
                    {s.label}
                  </span>
                </button>
                {i < STEPS.length - 1 && (
                  <div className="flex-1 h-0.5 rounded-full bg-white/10 overflow-hidden">
                    <motion.div
                      initial={false}
                      animate={{ scaleX: step > s.id ? 1 : 0 }}
                      style={{ originX: 0 }}
                      transition={{ duration: 0.3 }}
                      className="h-full w-full bg-[#CDFF00]"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="glass bg-black/60 border border-white/10 rounded-3xl p-6 shadow-2xl backdrop-blur-3xl">
          {displayError && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center flex items-center justify-center gap-2">
              <CircleX className="w-4 h-4 shrink-0" /> {displayError}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Steps slide rather than cut, so it reads as one form moving along instead of
                three unrelated screens. mode="wait" stops the outgoing and incoming panels
                overlapping mid-transition. */}
            <AnimatePresence mode="wait" initial={false}>
              {/* ── STEP 1: account ───────────────────────────────────────── */}
              {step === 1 && (
                <motion.div
                  key="step-1"
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -24 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-3.5"
                >
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-1.5">Email</label>
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      value={form.email}
                      onChange={(e) => set('email', e.target.value)}
                      className={inputClass(!!fieldErrors?.email)}
                      placeholder="you@example.com"
                    />
                    {fieldErrors?.email && (
                      <p className="mt-1.5 text-[11px] text-red-400 font-medium">{fieldErrors.email}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-1.5">Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        autoComplete="new-password"
                        value={form.password}
                        onChange={(e) => set('password', e.target.value)}
                        onFocus={() => setPasswordFocused(true)}
                        className={`${inputClass(!!fieldErrors?.password)} pr-11`}
                        placeholder="Choose a strong password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        // Not in the tab order: keyboard users tabbing from password to the
                        // next field should not have to step through a visibility control.
                        tabIndex={-1}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        aria-pressed={showPassword}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors p-0.5"
                      >
                        {showPassword ? <EyeClosed className="w-4 h-4" /> : <ScanEye className="w-4 h-4" />}
                      </button>
                    </div>

                    {/* The rules, ticking off live. Shown from the moment the field is
                        touched — requirements that only appear on failure arrive after the
                        person has already committed to a password. */}
                    <PasswordStrength
                      value={form.password}
                      visible={passwordFocused || form.password.length > 0}
                    />

                    {fieldErrors?.password && (
                      <p className="mt-1.5 text-[11px] text-red-400 font-medium">{fieldErrors.password}</p>
                    )}
                  </div>

                  {/* A mistyped password on a sign-up form is invisible until the person
                      tries to log in and cannot, by which point they have no way to tell a
                      typo from a forgotten password. */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-1.5">Confirm password</label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className={`${inputClass(mismatch)} pr-11`}
                        placeholder="Type your password again"
                        aria-invalid={mismatch}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((v) => !v)}
                        tabIndex={-1}
                        aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                        aria-pressed={showConfirmPassword}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors p-0.5"
                      >
                        {showConfirmPassword ? <EyeClosed className="w-4 h-4" /> : <ScanEye className="w-4 h-4" />}
                      </button>
                    </div>
                    <AnimatePresence>
                      {mismatch && (
                        <motion.p
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-1.5 text-[11px] text-red-400 font-medium overflow-hidden"
                        >
                          Both passwords must match
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Terms live here rather than on the last step because the social buttons
                      below finish sign-up immediately — a checkbox two screens further on
                      could never have gated them. */}
                  <label className="flex items-start gap-2.5 text-xs text-gray-400 cursor-pointer pt-1">
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

                  <div className="relative flex items-center justify-center py-1">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10" /></div>
                    <span className="relative px-3 bg-[#0a0a0a] text-xs text-gray-500">or continue with</span>
                  </div>

                  {!termsAccepted && (
                    <p className="text-center text-[11px] text-gray-500 -mt-1">Accept the terms to enable one-tap sign-up</p>
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
                </motion.div>
              )}

              {/* ── STEP 2: profile ───────────────────────────────────────── */}
              {step === 2 && (
                <motion.div
                  key="step-2"
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -24 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-3.5"
                >
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-1.5">I want to join as</label>
                    <div className="grid grid-cols-2 gap-3">
                      {roles.map((role) => (
                        <button
                          key={role.value}
                          type="button"
                          onClick={() => set('role', role.value)}
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

                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-1.5">Full name</label>
                    <input
                      type="text"
                      required
                      autoComplete="name"
                      value={form.fullName}
                      onChange={(e) => set('fullName', e.target.value)}
                      className={inputClass(!!fieldErrors?.fullName)}
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
                      <Hash className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        required
                        value={form.username}
                        onChange={(e) => set('username', e.target.value.replace(/\s/g, ''))}
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
                        {checkingUsername && <Loader className="w-4 h-4 text-gray-500 animate-spin" />}
                        {!checkingUsername && usernameState?.available && <CircleCheck className="w-4 h-4 text-[#CDFF00]" />}
                        {!checkingUsername && usernameState && !usernameState.available && <CircleX className="w-4 h-4 text-red-400" />}
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

                  {/* City. Optional: the marketplace works without it, and a required field
                      here would cost sign-ups from anyone whose city is not on the list.
                      Setting it is what puts a real location on their listings and shop card
                      instead of the country-level "Polska" fallback. */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-1.5">
                        City <span className="font-normal text-gray-500">(optional)</span>
                      </label>
                      <div className="relative">
                        <Navigation className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                        <select
                          value={form.city}
                          onChange={(e) => set('city', e.target.value)}
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:border-[#CDFF00] focus:ring-1 focus:ring-[#CDFF00] outline-none transition-all text-sm appearance-none"
                        >
                          <option value="" className="bg-[#0A0A0A]">Where are you based?</option>
                          {POLISH_CITIES.map((city) => (
                            <option key={city} value={city} className="bg-[#0A0A0A]">{city}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Phone was on the payload but had no input anywhere, so it was always
                        sent empty. Optional, and asked for here where it belongs. */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-1.5">
                        Phone <span className="font-normal text-gray-500">(optional)</span>
                      </label>
                      <div className="relative">
                        <PhoneCall className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                        <input
                          type="tel"
                          autoComplete="tel"
                          value={form.phone}
                          onChange={(e) => set('phone', e.target.value)}
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-[#CDFF00] focus:ring-1 focus:ring-[#CDFF00] outline-none transition-all text-sm"
                          placeholder="+48 …"
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── STEP 3: finish ────────────────────────────────────────── */}
              {step === 3 && (
                <motion.div
                  key="step-3"
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -24 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  {/* A last look before committing. Two screens of input are easy to
                      misremember, and an email typo is the one mistake that locks someone
                      out of the account they just made. */}
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] divide-y divide-white/5">
                    {[
                      { label: 'Email', value: form.email },
                      { label: 'Name', value: form.fullName },
                      { label: 'Username', value: form.username ? `@${form.username}` : '' },
                      { label: 'Joining as', value: form.role === 'SELLER' ? 'Seller' : 'Buyer' },
                      { label: 'City', value: form.city || 'Not set' },
                      { label: 'Phone', value: form.phone || 'Not set' },
                    ].map((row) => (
                      <div key={row.label} className="flex items-center justify-between gap-3 px-4 py-2.5">
                        <span className="text-[11px] font-black tracking-widest text-gray-500 shrink-0">
                          {row.label}
                        </span>
                        <span className="text-sm text-white truncate">{row.value}</span>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="w-full text-[11px] font-black tracking-widest text-gray-500 hover:text-white transition-colors"
                  >
                    Something wrong? Go back and edit
                  </button>

                  {/* Only rendered once a real site key is configured — a blank key would
                      render a broken widget, so this stays invisible (and non-blocking,
                      since the backend's TurnstileService no-ops without a secret key too). */}
                  {turnstileSiteKey && (
                    <Turnstile siteKey={turnstileSiteKey} onSuccess={setCaptchaToken} className="mx-auto" />
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Navigation ─────────────────────────────────────────────── */}
            <div className="flex items-center gap-3 mt-5">
              {step > 1 && (
                <button
                  type="button"
                  onClick={back}
                  className="px-5 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-bold text-sm hover:bg-white/10 transition-colors flex items-center gap-2"
                >
                  <MoveLeft className="w-4 h-4" /> Back
                </button>
              )}
              <button
                type="submit"
                disabled={!canAdvance || loading}
                className="flex-1 py-3 rounded-xl bg-[#CDFF00] text-black font-bold text-sm hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all outline-none flex items-center justify-center gap-2"
              >
                {loading
                  ? 'Creating account…'
                  : step < STEPS.length
                    ? <>Continue <MoveRight className="w-4 h-4" /></>
                    : 'Create account'}
              </button>
            </div>
          </form>

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
