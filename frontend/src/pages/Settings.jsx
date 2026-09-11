import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useDispatch, useSelector } from 'react-redux';
import { Paintbrush, CircleUser, ShieldPlus, BellElectric, SunMedium, MoonStar, MonitorSmartphone, CircleCheck, Loader, Navigation, Earth, Hash, PhoneCall, AtSign, DoorOpen, Key, CircleSlash, Building, BookOpenText, SquareArrowOutUpRight } from 'lucide-react';
import { selectUser, loadUserProfile, logout } from '../store/authSlice';
import { usersApi, authApi, followsApi, payoutsApi, publishersApi, dispatchToast } from '../api/client';
import { useTheme } from '../context/ThemeContext';
import { POLISH_CITIES } from '../utils/constants';
import SmartImage from '../components/SmartImage';
import HeroBrief from '../components/HeroBrief';

/**
 * Settings, as a real screen rather than a modal on a profile page.
 *
 * <h2>Why this exists</h2>
 * There was no settings page at all. The navbar's "Settings" link pointed at the viewer's
 * own profile, where a single Edit dialog covered name, bio, city and photos — and nothing
 * else was reachable from anywhere. Theme, blocked accounts, payouts and publisher status
 * each lived on a different screen, or nowhere.
 *
 * <h2>Why tabs and not one long page</h2>
 * These are separate concerns with separate stakes. Changing a theme is instant and
 * reversible; changing an email is neither. Putting them in one scroll invites the second to
 * be done by accident while reaching for the first, and makes the page impossible to scan.
 *
 * <p>The tab is in the URL (`/settings?tab=appearance`), so a link can point at a specific
 * panel and a refresh does not throw you back to the first one.
 */

const TABS = [
  { id: 'appearance', label: 'Appearance', icon: Paintbrush },
  { id: 'profile', label: 'Personal info', icon: CircleUser },
  { id: 'account', label: 'Account', icon: ShieldPlus },
  { id: 'privacy', label: 'Privacy', icon: CircleSlash },
  { id: 'selling', label: 'Selling', icon: Building },
];

export default function Settings() {
  const user = useSelector(selectUser);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const tab = TABS.some((t) => t.id === searchParams.get('tab'))
    ? searchParams.get('tab')
    : 'appearance';
  const setTab = (id) => setSearchParams({ tab: id }, { replace: true });

  useEffect(() => {
    if (!user) navigate('/login');
  }, [user, navigate]);

  if (!user) return null;

  return (
    <div className="min-h-screen text-white pb-20">
      <HeroBrief title="Settings" />

      <div className="max-w-4xl mx-auto px-4">
        {/* Horizontal on phones, a rail beside the panel from md up — five items do not fit
            a phone as a sidebar, and do not need a whole column on a laptop. */}
        <div className="md:flex md:gap-6">
          <nav className="md:w-52 md:shrink-0 mb-5 md:mb-0 -mx-4 px-4 md:mx-0 md:px-0 overflow-x-auto scrollbar-hide">
            <div className="flex md:flex-col gap-1.5 w-max md:w-full">
              {TABS.map((t) => {
                const Icon = t.icon;
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-colors ${
                      active
                        ? 'bg-[#CDFF00] text-black'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" /> {t.label}
                  </button>
                );
              })}
            </div>
          </nav>

          <div className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
              >
                {tab === 'appearance' && <AppearancePanel />}
                {tab === 'profile' && <ProfilePanel user={user} onSaved={() => dispatch(loadUserProfile())} />}
                {tab === 'account' && <AccountPanel user={user} onSignOut={() => { dispatch(logout()); navigate('/'); }} />}
                {tab === 'privacy' && <PrivacyPanel />}
                {tab === 'selling' && <SellingPanel />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Shared chrome ─────────────────────────────────────────────────────── */

function Section({ title, description, children }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 mb-4">
      <h2 className="text-sm font-black text-white tracking-tight">{title}</h2>
      {description && <p className="text-[12px] text-gray-500 leading-relaxed mt-1">{description}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Field({ label, hint, icon: Icon, ...props }) {
  return (
    <div>
      <label className="block text-[11px] font-black tracking-widest text-gray-500 mb-1.5">{label}</label>
      <div className="relative">
        {Icon && <Icon className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />}
        <input
          {...props}
          className={`w-full ${Icon ? 'pl-10' : 'pl-4'} pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-[#CDFF00] focus:ring-1 focus:ring-[#CDFF00] outline-none transition-all text-sm disabled:opacity-60`}
        />
      </div>
      {hint && <p className="mt-1.5 text-[11px] text-gray-600 leading-relaxed">{hint}</p>}
    </div>
  );
}

/* ── Appearance ────────────────────────────────────────────────────────── */

function AppearancePanel() {
  const { preference, resolved, setTheme } = useTheme();

  const options = [
    { id: 'light', label: 'Light', icon: SunMedium, blurb: 'Bright surfaces, dark text' },
    { id: 'dark', label: 'Dark', icon: MoonStar, blurb: 'The original HustleSpace look' },
    { id: 'system', label: 'System', icon: MonitorSmartphone, blurb: 'Follow your device' },
  ];

  return (
    <Section
      title="Theme"
      description="Applies immediately and is remembered on this device. It is a local preference, not part of your account, so signing in elsewhere does not carry it over."
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {options.map((o) => {
          const Icon = o.icon;
          const active = preference === o.id;
          return (
            <button
              key={o.id}
              onClick={() => setTheme(o.id)}
              className={`p-4 rounded-xl border text-left transition-all ${
                active
                  ? 'border-[#CDFF00] bg-[#CDFF00]/10'
                  : 'border-white/10 bg-white/5 hover:border-white/25'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <Icon className={`w-5 h-5 ${active ? 'text-[#CDFF00]' : 'text-gray-400'}`} />
                {active && <CircleCheck className="w-4 h-4 text-[#CDFF00]" strokeWidth={3} />}
              </div>
              <p className={`text-sm font-bold ${active ? 'text-white' : 'text-gray-300'}`}>{o.label}</p>
              <p className="text-[11px] text-gray-500 leading-snug mt-0.5">{o.blurb}</p>
            </button>
          );
        })}
      </div>

      {/* Says what "System" resolved to, because otherwise the choice and the screen can
          disagree with no explanation — a laptop that switches at sunset makes the setting
          look broken rather than obeyed. */}
      {preference === 'system' && (
        <p className="mt-3 text-[11px] text-gray-500">
          Your device is currently asking for <span className="text-[#CDFF00] font-bold">{resolved}</span>.
        </p>
      )}
    </Section>
  );
}

/* ── Personal info ─────────────────────────────────────────────────────── */

function ProfilePanel({ user, onSaved }) {
  const [form, setForm] = useState({
    fullName: user.fullName || '',
    username: user.username || '',
    bio: user.bio || '',
    city: user.city || '',
    phone: user.phone || '',
    website: user.website || '',
  });
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(user.avatarUrl || '');
  const [saving, setSaving] = useState(false);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const pickAvatar = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const save = async () => {
    setSaving(true);
    try {
      // Image first: if the upload fails there is no point writing the rest, and if the
      // profile write fails afterwards the photo is still theirs.
      if (avatarFile) await usersApi.uploadAvatar(avatarFile);
      await usersApi.updateProfile(form);
      onSaved?.();
      setAvatarFile(null);
      dispatchToast('Saved', 'success');
    } catch (e) {
      dispatchToast(e.response?.data?.error || e.response?.data?.message || 'Could not save that', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Section title="Photo" description="Shown on your profile, your posts and anything you list.">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full overflow-hidden bg-white/5 border border-white/10 shrink-0">
            <SmartImage src={avatarPreview} alt="" fallbackIcon={CircleUser} className="w-full h-full object-cover" />
          </div>
          <label className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-bold hover:border-white/30 transition-colors cursor-pointer">
            Choose a photo
            <input type="file" accept="image/*" className="hidden" onChange={pickAvatar} />
          </label>
        </div>
      </Section>

      <Section title="About you" description="Your name and handle are public. Phone stays private and is only used for order contact.">
        <div className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Field
              label="Full name"
              value={form.fullName}
              onChange={(e) => set('fullName', e.target.value)}
              placeholder="Your name"
            />
            <Field
              label="Username"
              icon={Hash}
              value={form.username}
              onChange={(e) => set('username', e.target.value.replace(/\s/g, ''))}
              maxLength={20}
              placeholder="yourhandle"
              hint="3–20 characters: letters, numbers, dots or underscores."
            />
          </div>

          <div>
            <label className="block text-[11px] font-black tracking-widest text-gray-500 mb-1.5">Bio</label>
            <textarea
              rows={3}
              value={form.bio}
              onChange={(e) => set('bio', e.target.value)}
              placeholder="What you do, in a line or two."
              className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-[#CDFF00] focus:ring-1 focus:ring-[#CDFF00] outline-none transition-all text-sm resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[11px] font-black tracking-widest text-gray-500 mb-1.5">City</label>
              <div className="relative">
                <Navigation className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  value={form.city}
                  onChange={(e) => set('city', e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:border-[#CDFF00] focus:ring-1 focus:ring-[#CDFF00] outline-none transition-all text-sm appearance-none"
                >
                  <option value="" className="bg-[#0A0A0A]">Not set</option>
                  {POLISH_CITIES.map((c) => <option key={c} value={c} className="bg-[#0A0A0A]">{c}</option>)}
                </select>
              </div>
            </div>
            <Field
              label="Phone"
              icon={PhoneCall}
              type="tel"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
              placeholder="+48 …"
            />
          </div>

          <Field
            label="Website"
            icon={Earth}
            value={form.website}
            onChange={(e) => set('website', e.target.value)}
            placeholder="https://…"
          />

          <button
            onClick={save}
            disabled={saving}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#CDFF00] text-black font-bold text-sm hover:brightness-110 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
          >
            {saving && <Loader className="w-4 h-4 animate-spin" />}
            {saving ? 'Saving' : 'Save changes'}
          </button>
        </div>
      </Section>
    </>
  );
}

/* ── Account ───────────────────────────────────────────────────────────── */

function AccountPanel({ user, onSignOut }) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  /**
   * Password changes go through the same emailed reset link as "forgot password".
   *
   * <p>There is no change-password-while-signed-in endpoint, and inventing one here would
   * mean a second, weaker path to the same outcome — one that a borrowed unlocked laptop
   * could walk straight through. Sending the link proves control of the mailbox first.
   */
  const sendReset = async () => {
    setSending(true);
    try {
      await authApi.forgotPassword(user.email);
      setSent(true);
      dispatchToast('Check your email for the reset link', 'success');
    } catch {
      // Deliberately the same message either way — whether an address is registered is not
      // something this endpoint should confirm to whoever is sitting at the keyboard.
      setSent(true);
      dispatchToast('If that address is registered, a reset link is on its way', 'success');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Section title="Sign-in details" description="Your email is how you sign in and where account notices are sent.">
        <div className="space-y-3.5">
          <Field
            label="Email"
            icon={AtSign}
            value={user.email || ''}
            disabled
            readOnly
            hint="Changing the address on an account is not self-serve yet — contact support if you need it moved."
          />
          <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10">
            <span className="min-w-0">
              <span className="block text-sm font-bold text-white">Password</span>
              <span className="block text-[11px] text-gray-500 leading-relaxed">
                We'll email you a link to set a new one.
              </span>
            </span>
            <button
              onClick={sendReset}
              disabled={sending || sent}
              className="px-4 py-2 rounded-lg bg-white/10 border border-white/10 text-white text-xs font-bold hover:bg-white/15 disabled:opacity-50 transition-colors flex items-center gap-2 shrink-0"
            >
              {sending ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
              {sent ? 'Link sent' : 'Send link'}
            </button>
          </div>
        </div>
      </Section>

      <Section title="Account type" description="What you signed up as. Sellers get listings, a storefront and payouts.">
        <p className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white font-bold">
          {user.role === 'SELLER' ? 'Seller' : user.role === 'ADMIN' ? 'Admin' : 'Buyer'}
        </p>
      </Section>

      <Section title="Session" description="Signs you out on this device only.">
        <button
          onClick={onSignOut}
          className="px-5 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-bold hover:bg-red-500/20 transition-colors flex items-center gap-2"
        >
          <DoorOpen className="w-4 h-4" /> Sign out
        </button>
      </Section>
    </>
  );
}

/* ── Privacy ───────────────────────────────────────────────────────────── */

function PrivacyPanel() {
  const [blocked, setBlocked] = useState(null);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    followsApi.blocked()
      .then((r) => setBlocked(r.data || []))
      .catch(() => setBlocked([]));
  }, []);

  const unblock = async (id) => {
    setBusyId(id);
    try {
      await followsApi.unblock(id);
      setBlocked((list) => list.filter((u) => String(u.id) !== String(id)));
      dispatchToast('Unblocked', 'success');
    } catch (e) {
      dispatchToast(e.response?.data?.error || 'Could not unblock', 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Section
      title="Blocked accounts"
      description="Blocking hides you from each other and stops messages both ways. Blocking used to be one-way traffic — you could block someone and never find the list again."
    >
      {blocked === null ? (
        <div className="py-8 flex justify-center"><Loader className="w-5 h-5 text-gray-600 animate-spin" /></div>
      ) : blocked.length === 0 ? (
        <p className="text-sm text-gray-500 py-2">You haven't blocked anyone.</p>
      ) : (
        <div className="space-y-2">
          {blocked.map((u) => (
            <div key={u.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-black/40 border border-white/5">
              <div className="w-9 h-9 rounded-full overflow-hidden bg-white/5 shrink-0">
                <SmartImage src={u.avatarUrl} alt="" fallbackIcon={CircleUser} className="w-full h-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-white truncate">{u.fullName || u.username}</p>
                {u.username && <p className="text-[11px] text-gray-500 truncate">@{u.username}</p>}
              </div>
              <button
                onClick={() => unblock(u.id)}
                disabled={busyId === u.id}
                className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-[11px] font-black tracking-widest hover:bg-white/10 disabled:opacity-50 transition-colors shrink-0"
              >
                {busyId === u.id ? <Loader className="w-3 h-3 animate-spin" /> : 'Unblock'}
              </button>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

/* ── Selling ───────────────────────────────────────────────────────────── */

function SellingPanel() {
  const [payout, setPayout] = useState(null);
  const [publisher, setPublisher] = useState(null);

  useEffect(() => {
    payoutsApi.status().then((r) => setPayout(r.data)).catch(() => setPayout({ connected: false }));
    publishersApi.me().then((r) => setPublisher(r.data || {})).catch(() => setPublisher({}));
  }, []);

  return (
    <>
      <Section title="Payouts" description="Where money from your sales is sent. Handled by Stripe — HustleSpace never sees your bank details.">
        {payout === null ? (
          <Loader className="w-5 h-5 text-gray-600 animate-spin" />
        ) : (
          <div className="flex items-center justify-between gap-3">
            <span className={`text-sm font-bold ${payout.payoutsEnabled ? 'text-[#CDFF00]' : 'text-gray-400'}`}>
              {payout.payoutsEnabled ? 'Connected and enabled' : payout.connected ? 'Connected — setup unfinished' : 'Not connected'}
            </span>
            <Link
              to="/dashboard?tab=payouts"
              className="px-4 py-2 rounded-lg bg-white/10 border border-white/10 text-white text-xs font-bold hover:bg-white/15 transition-colors flex items-center gap-1.5 shrink-0"
            >
              Manage <SquareArrowOutUpRight className="w-3 h-3" />
            </Link>
          </div>
        )}
      </Section>

      <Section title="Publishing" description="Verified outlets can post to the news desk; verified companies can post jobs.">
        {publisher === null ? (
          <Loader className="w-5 h-5 text-gray-600 animate-spin" />
        ) : (
          <div className="space-y-2">
            {[
              { label: 'News outlet', ok: publisher.canPostNews, to: '/publisher/apply?type=NEWS_OUTLET', icon: BookOpenText },
              { label: 'Hiring company', ok: publisher.canPostJobs, to: '/publisher/apply?type=HIRING_COMPANY', icon: ShieldPlus },
            ].map((row) => {
              const Icon = row.icon;
              return (
                <div key={row.label} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-black/40 border border-white/5">
                  <span className="flex items-center gap-2.5 min-w-0">
                    <Icon className="w-4 h-4 text-gray-500 shrink-0" />
                    <span className="text-sm font-bold text-white truncate">{row.label}</span>
                  </span>
                  {row.ok ? (
                    <span className="text-[11px] font-black tracking-widest text-[#CDFF00] shrink-0">Approved</span>
                  ) : (
                    <Link
                      to={row.to}
                      className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-[11px] font-black tracking-widest hover:bg-white/10 transition-colors shrink-0"
                    >
                      Apply
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Section>

      <Section title="Notifications" description="What HustleSpace sends you.">
        <p className="text-sm text-gray-500 leading-relaxed">
          Order updates, messages and delivery alerts are sent in-app, by email and — if you
          use the mobile app — as a push notification. Per-channel switches are not built yet,
          so this is listed here rather than shown as toggles that would not do anything.
        </p>
      </Section>
    </>
  );
}
