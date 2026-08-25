import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { motion } from 'framer-motion';
import { selectUser, loadUserProfile } from '../store/authSlice';
import { usersApi, dispatchToast } from '../api/client';
import { LISTING_TYPES } from '../utils/constants';
import { Camera, Check, ArrowRight } from 'lucide-react';

// Seller shop-setup screen shown right after registering (or reachable again from the
// Dashboard's "Set up your shop" prompt for sellers who skipped it or registered before
// this existed). Buyers have nothing to configure here, so they never see this screen —
// registration/login route them straight to the dashboard.
export default function Onboarding() {
  const user = useSelector(selectUser);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [category, setCategory] = useState('');
  const [bannerFile, setBannerFile] = useState(null);
  const [bannerPreview, setBannerPreview] = useState('');
  const [saving, setSaving] = useState(false);

  const finish = async () => {
    setSaving(true);
    try {
      if (bannerFile) await usersApi.uploadBanner(bannerFile);
      if (category) await usersApi.updateProfile({ shopCategory: category });
      dispatch(loadUserProfile());
      dispatchToast('Shop set up!', 'success');
      navigate('/dashboard');
    } catch (e) {
      dispatchToast('Could not save shop setup', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleBanner = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBannerFile(file);
    setBannerPreview(URL.createObjectURL(file));
  };

  if (user?.role !== 'SELLER') {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
        <h1 className="text-2xl font-black text-white mb-2">You're all set!</h1>
        <p className="text-gray-400 text-sm mb-6">Jump in and start exploring HustleSpace.</p>
        <button
          onClick={() => navigate('/dashboard')}
          className="px-8 py-3 rounded-xl bg-[#CDFF00] text-black font-bold text-sm hover:bg-[#d9ff33] active:scale-95 transition-all"
        >
          Go to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <div className="text-center mb-10">
          <span className="text-[10px] font-black uppercase tracking-[0.35em] text-[#CDFF00] mb-2 block">Welcome, seller</span>
          <h1 className="text-2xl sm:text-3xl font-black text-white mb-2">Set up your shop</h1>
          <p className="text-sm text-gray-400">Pick a category and add a banner — you can change these anytime from your dashboard.</p>
        </div>

        {/* Banner */}
        <div className="mb-8">
          <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Shop banner</h3>
          <div
            onClick={() => document.getElementById('onboarding-banner-input').click()}
            className="group relative h-36 rounded-2xl border-2 border-dashed border-white/15 hover:border-[#CDFF00]/60 transition-all cursor-pointer overflow-hidden flex items-center justify-center bg-white/[0.03]"
          >
            {bannerPreview
              ? <img src={bannerPreview} className="w-full h-full object-cover" alt="" />
              : <span className="flex flex-col items-center gap-2 text-gray-600 group-hover:text-[#CDFF00] transition-colors">
                  <Camera className="w-6 h-6" /> <span className="text-xs font-bold uppercase tracking-widest">Upload a banner</span>
                </span>}
            <input id="onboarding-banner-input" type="file" accept="image/*" hidden onChange={handleBanner} />
          </div>
        </div>

        {/* Category grid */}
        <div className="mb-10">
          <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">What kind of shop is this?</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {LISTING_TYPES.map((cat) => {
              const active = category === cat.value;
              return (
                <button
                  key={cat.value}
                  onClick={() => setCategory(cat.value)}
                  className={`relative flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all ${
                    active
                      ? 'bg-[#CDFF00]/10 border-[#CDFF00] text-white'
                      : 'bg-white/[0.03] border-white/10 text-gray-400 hover:border-white/20 hover:text-white'
                  }`}
                >
                  {active && <Check className="w-4 h-4 text-[#CDFF00] absolute top-2 right-2" />}
                  <cat.icon className={`w-6 h-6 ${active ? 'text-[#CDFF00]' : ''}`} />
                  <span className="text-[11px] font-bold text-center leading-tight">{cat.label}</span>
                </button>
              );
            })}
          </div>
          {(category === 'HAIR_BEAUTY' || category === 'SKILL') && (
            <p className="text-xs text-gray-500 mt-3">
              You'll be able to set open appointment slots from your dashboard, and buyers will book a specific time instead of negotiating.
            </p>
          )}
          {category === 'EVENT' && (
            <p className="text-xs text-gray-500 mt-3">
              Buyers will be able to buy tickets directly, and you'll get a composer to post updates about your event.
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-3">
          <button onClick={() => navigate('/dashboard')} className="text-sm font-semibold text-gray-500 hover:text-white transition-colors">
            Skip for now
          </button>
          <button
            onClick={finish}
            disabled={saving}
            className="px-8 py-3 rounded-xl bg-[#CDFF00] text-black font-bold text-sm hover:bg-[#d9ff33] active:scale-95 transition-all disabled:opacity-60 flex items-center gap-2"
          >
            {saving ? 'Saving…' : <>Finish <ArrowRight className="w-4 h-4" /></>}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
