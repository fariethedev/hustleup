import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useDispatch, useSelector } from 'react-redux';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Brush, Heart, MapPin, PackagePlus, Sparkles, Store } from 'lucide-react';
import { usersApi } from '../api/client';
import { completeOnboarding, selectIsAuthenticated, selectUser } from '../store/authSlice';

const INTEREST_OPTIONS = [
  'Fashion',
  'Food',
  'Fitness',
  'Beauty',
  'Art',
  'Music',
  'Gaming',
  'Tech',
  'Travel',
  'Home',
];

const SELLING_OPTIONS = [
  'Clothing',
  'Food',
  'Beauty',
  'Events',
  'Digital Products',
  'Services',
];

const BUYING_OPTIONS = [
  'Unique products',
  'Local services',
  'Creative sellers',
  'Daily essentials',
  'Event offers',
  'Trending shops',
];

const SHOP_THEMES = [
  { id: 'neon', name: 'Neon Market', className: 'from-[#CDFF00] via-[#9ef01a] to-[#0f172a]' },
  { id: 'sunset', name: 'Sunset Studio', className: 'from-[#f97316] via-[#fb7185] to-[#1f2937]' },
  { id: 'ocean', name: 'Ocean Edit', className: 'from-[#0ea5e9] via-[#14b8a6] to-[#082f49]' },
];

const toggleValue = (values, item) =>
  values.includes(item) ? values.filter((value) => value !== item) : [...values, item];

export default function Onboarding() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const user = useSelector(selectUser);
  const isSeller = user?.role === 'SELLER';
  const existingOnboarding = user?.onboarding || {};

  const questions = useMemo(
    () => [
      {
        id: 'interests',
        title: 'What do you love?',
        subtitle: 'Pick the spaces that feel closest to you.',
        icon: Heart,
      },
      {
        id: 'focus',
        title: isSeller ? 'What do you want to sell?' : 'What do you want to discover?',
        subtitle: isSeller ? 'This shapes your first seller setup.' : 'This shapes what the app highlights for you.',
        icon: PackagePlus,
      },
      {
        id: 'location',
        title: 'Where are you based?',
        subtitle: 'Add your city so your profile feels real from the start.',
        icon: MapPin,
      },
      {
        id: 'brand',
        title: isSeller ? 'Customize your shop' : 'Pick your style',
        subtitle: isSeller ? 'Name it and choose the look.' : 'Choose the vibe you want your account to carry.',
        icon: isSeller ? Store : Brush,
      },
      {
        id: 'bio',
        title: isSeller ? 'Tell shoppers about you' : 'Tell us about you',
        subtitle: 'A short intro finishes your setup.',
        icon: Sparkles,
      },
    ],
    [isSeller],
  );

  const [questionIndex, setQuestionIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    interests: existingOnboarding.interests || [],
    focusAreas: existingOnboarding.focusAreas || [],
    city: existingOnboarding.city || user?.city || '',
    shopName: existingOnboarding.shopName || `${user?.fullName || 'My'} Shop`,
    shopTagline: existingOnboarding.shopTagline || '',
    shopTheme: existingOnboarding.shopTheme || SHOP_THEMES[0].id,
    shopBannerUrl: existingOnboarding.shopBannerUrl || user?.shopBannerUrl || '',
    profileBio: existingOnboarding.profileBio || user?.bio || '',
  });

  if (!isAuthenticated) {
    return <Navigate to="/register" replace />;
  }

  if (user?.onboardingCompleted) {
    return <Navigate to="/dashboard" replace />;
  }

  const currentQuestion = questions[questionIndex];
  const CurrentIcon = currentQuestion.icon;

  const validateCurrentQuestion = () => {
    switch (currentQuestion.id) {
      case 'interests':
        return form.interests.length ? '' : 'Choose at least one interest.';
      case 'focus':
        return form.focusAreas.length ? '' : isSeller ? 'Choose what you want to sell.' : 'Choose what you want to explore.';
      case 'location':
        return form.city.trim() ? '' : 'Add your city before continuing.';
      case 'brand':
        if (!form.shopTheme) return 'Choose a theme.';
        if (isSeller && !form.shopName.trim()) return 'Your shop needs a name.';
        if (isSeller && !form.shopTagline.trim()) return 'Add a short tagline for your shop.';
        return '';
      case 'bio':
        return form.profileBio.trim() ? '' : 'Write a short intro to finish setup.';
      default:
        return '';
    }
  };

  const finishOnboarding = async () => {
    setSaving(true);

    const onboarding = {
      interests: form.interests,
      focusAreas: form.focusAreas,
      city: form.city.trim(),
      shopName: isSeller ? form.shopName.trim() : '',
      shopTagline: isSeller ? form.shopTagline.trim() : '',
      shopTheme: form.shopTheme,
      shopBannerUrl: isSeller ? form.shopBannerUrl.trim() : '',
      profileBio: form.profileBio.trim(),
      completedAt: new Date().toISOString(),
    };

    try {
      const profileRes = await usersApi.updateProfile({
        bio: form.profileBio.trim(),
        city: form.city.trim(),
        ...(isSeller && form.shopBannerUrl.trim() ? { shopBannerUrl: form.shopBannerUrl.trim() } : {}),
      });

      dispatch(
        completeOnboarding({
          onboarding,
          profile: profileRes.data,
        }),
      );
      navigate('/dashboard');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to save your onboarding details.');
    } finally {
      setSaving(false);
    }
  };

  const handleNext = async () => {
    const nextError = validateCurrentQuestion();
    if (nextError) {
      setError(nextError);
      return;
    }

    setError('');

    if (questionIndex === questions.length - 1) {
      await finishOnboarding();
      return;
    }

    setQuestionIndex((current) => current + 1);
  };

  const progress = ((questionIndex + 1) / questions.length) * 100;

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <motion.div
        key={currentQuestion.id}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl"
      >
        <div className="glass rounded-[2rem] border border-white/10 p-6 sm:p-8 lg:p-10">
          <div className="mb-8">
            <div className="mb-4 flex items-center justify-between gap-4">
              <p className="text-xs font-black uppercase tracking-[0.35em] text-[#CDFF00]">
                Question {questionIndex + 1} of {questions.length}
              </p>
              <div className="rounded-2xl border border-white/10 bg-black/40 p-3 text-[#CDFF00]">
                <CurrentIcon className="h-5 w-5" />
              </div>
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-[#CDFF00] transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <div className="text-center">
            <h1 className="text-3xl font-heading font-extrabold text-white sm:text-4xl">{currentQuestion.title}</h1>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-gray-400 sm:text-base">{currentQuestion.subtitle}</p>
          </div>

          <div className="mt-10">
            {currentQuestion.id === 'interests' && (
              <div className="flex flex-wrap justify-center gap-3">
                {INTEREST_OPTIONS.map((interest) => (
                  <button
                    key={interest}
                    type="button"
                    onClick={() => setForm((current) => ({ ...current, interests: toggleValue(current.interests, interest) }))}
                    className={`rounded-full border px-4 py-2 text-sm font-bold transition-all ${
                      form.interests.includes(interest)
                        ? 'border-[#CDFF00] bg-[#CDFF00] text-black'
                        : 'border-white/10 bg-black/40 text-gray-300 hover:border-white/30'
                    }`}
                  >
                    {interest}
                  </button>
                ))}
              </div>
            )}

            {currentQuestion.id === 'focus' && (
              <div className="grid gap-3 sm:grid-cols-2">
                {(isSeller ? SELLING_OPTIONS : BUYING_OPTIONS).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setForm((current) => ({ ...current, focusAreas: toggleValue(current.focusAreas, option) }))}
                    className={`rounded-3xl border px-5 py-5 text-center text-sm font-black uppercase tracking-[0.2em] transition-all ${
                      form.focusAreas.includes(option)
                        ? 'border-[#CDFF00] bg-[#CDFF00]/10 text-white'
                        : 'border-white/10 bg-black/40 text-gray-300 hover:border-white/25'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}

            {currentQuestion.id === 'location' && (
              <div className="mx-auto max-w-md">
                <label className="mb-3 block text-center text-xs font-black uppercase tracking-[0.35em] text-gray-400">City</label>
                <input
                  value={form.city}
                  onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))}
                  className="w-full rounded-3xl border border-white/10 bg-[#121212] px-5 py-4 text-center text-white outline-none transition-all focus:border-[#CDFF00]"
                  placeholder="Warsaw"
                />
              </div>
            )}

            {currentQuestion.id === 'brand' && (
              <div className="space-y-6">
                {isSeller && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <CenteredField
                      label="Shop name"
                      value={form.shopName}
                      onChange={(value) => setForm((current) => ({ ...current, shopName: value }))}
                      placeholder="Northside Vintage"
                    />
                    <CenteredField
                      label="Tagline"
                      value={form.shopTagline}
                      onChange={(value) => setForm((current) => ({ ...current, shopTagline: value }))}
                      placeholder="Curated finds with real hustle"
                    />
                  </div>
                )}

                <div className="grid gap-4 md:grid-cols-3">
                  {SHOP_THEMES.map((theme) => (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => setForm((current) => ({ ...current, shopTheme: theme.id }))}
                      className={`overflow-hidden rounded-[1.5rem] border text-left transition-all ${
                        form.shopTheme === theme.id
                          ? 'border-[#CDFF00] shadow-[0_0_30px_rgba(205,255,0,0.1)]'
                          : 'border-white/10'
                      }`}
                    >
                      <div className={`h-24 bg-gradient-to-br ${theme.className}`} />
                      <div className="bg-black px-4 py-4 text-center">
                        <p className="text-sm font-black uppercase tracking-[0.2em] text-white">{theme.name}</p>
                      </div>
                    </button>
                  ))}
                </div>

                {isSeller && (
                  <div className="mx-auto max-w-xl">
                    <CenteredField
                      label="Banner image URL"
                      value={form.shopBannerUrl}
                      onChange={(value) => setForm((current) => ({ ...current, shopBannerUrl: value }))}
                      placeholder="https://images.unsplash.com/..."
                    />
                  </div>
                )}
              </div>
            )}

            {currentQuestion.id === 'bio' && (
              <div className="mx-auto max-w-xl">
                <label className="mb-3 block text-center text-xs font-black uppercase tracking-[0.35em] text-gray-400">
                  {isSeller ? 'Shop intro' : 'Profile intro'}
                </label>
                <textarea
                  rows="5"
                  value={form.profileBio}
                  onChange={(event) => setForm((current) => ({ ...current, profileBio: event.target.value }))}
                  className="w-full rounded-3xl border border-white/10 bg-[#121212] px-5 py-4 text-center text-white outline-none transition-all focus:border-[#CDFF00]"
                  placeholder={isSeller ? 'Tell shoppers what makes your shop worth visiting.' : 'Tell us what you want from HustleUp.'}
                />
              </div>
            )}
          </div>

          {error && (
            <div className="mt-8 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-center text-sm font-semibold text-rose-300">
              {error}
            </div>
          )}

          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => setQuestionIndex((current) => Math.max(current - 1, 0))}
              disabled={questionIndex === 0 || saving}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 px-5 py-3 text-sm font-bold text-gray-300 transition-all hover:border-white/30 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#CDFF00] px-6 py-3 text-sm font-black uppercase tracking-[0.25em] text-black transition-all hover:bg-[#b8e600] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Saving...' : questionIndex === questions.length - 1 ? 'Finish setup' : 'Next'}
              {!saving && <ArrowRight className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function CenteredField({ label, value, onChange, placeholder }) {
  return (
    <div>
      <label className="mb-3 block text-center text-xs font-black uppercase tracking-[0.35em] text-gray-400">{label}</label>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-3xl border border-white/10 bg-[#121212] px-5 py-4 text-center text-white outline-none transition-all focus:border-[#CDFF00]"
        placeholder={placeholder}
      />
    </div>
  );
}
