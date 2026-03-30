import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useSelector } from 'react-redux';
import { selectIsAuthenticated, selectIsSeller } from '../store/authSlice';
import { listingsApi } from '../api/client';
import { LISTING_TYPES, CURRENCIES } from '../utils/constants';
import { Lock, Image as ImageIcon, Check, X, ArrowRight, ArrowLeft } from 'lucide-react';

export default function CreateListing() {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const isSeller = useSelector(selectIsSeller);
  const navigate = useNavigate();
  
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    title: '', description: '', listingType: '', price: '', currency: 'PLN',
    negotiable: false, city: '', meta: '',
  });
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isAuthenticated) { navigate('/login'); return null; }
  if (!isSeller) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-center glass rounded-3xl p-10 max-w-md border border-white/5">
          <Lock className="w-16 h-16 mx-auto text-gray-600 mb-6" />
          <h2 className="text-2xl font-black text-white uppercase tracking-wider mb-2">Sellers Only</h2>
          <p className="text-gray-400 mb-8 font-medium">You need a seller account to post listings on the marketplace.</p>
          <button onClick={() => navigate('/register')} className="w-full py-4 rounded-xl bg-[#CDFF00] text-black font-black uppercase tracking-widest hover:bg-[#E0FF4D] transition-all">
            Become a Seller
          </button>
        </div>
      </div>
    );
  }

  const handleSubmit = async () => {
    setError('');
    if (!form.title || !form.listingType || !form.price) {
      setError('Title, category, and price are required');
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('title', form.title);
      formData.append('description', form.description);
      formData.append('listingType', form.listingType);
      formData.append('price', form.price);
      formData.append('currency', form.currency);
      formData.append('negotiable', form.negotiable);
      formData.append('city', form.city);
      if (form.meta) formData.append('meta', form.meta);
      images.forEach((img) => formData.append('images', img));
      
      const res = await listingsApi.create(formData);
      navigate(`/listing/${res.data.id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create listing');
    } finally {
      setLoading(false);
    }
  };

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 mt-10">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl sm:text-4xl font-heading font-extrabold text-white mb-2 uppercase tracking-wide">
          Post <span className="text-[#CDFF00]">Listing</span>
        </h1>
        <p className="text-gray-400 mb-8 font-bold uppercase tracking-wider text-sm">Monetize your hustle</p>

        {/* Progress Tracker */}
        <div className="flex items-center gap-2 mb-10">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all border ${
                step >= s ? 'bg-[#CDFF00] text-black border-[#CDFF00]' : 'bg-transparent text-gray-600 border-white/10'
              }`}>{s}</div>
              {s < 3 && <div className={`flex-1 h-0.5 transition-all ${step > s ? 'bg-[#CDFF00]' : 'glass bg-black/40 border border-white/10'}`} />}
            </div>
          ))}
        </div>

        <div className="glass rounded-3xl p-8 border border-white/5">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-[#CDFF00]/10 border border-[#CDFF00]/20 text-[#CDFF00] text-sm font-bold uppercase tracking-wider text-center flex items-center justify-center gap-2">
              <X className="w-4 h-4" /> {error}
            </div>
          )}

          {/* Step 1: Core Details */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-3">Category *</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {LISTING_TYPES.map((type) => {
                    const Icon = type.icon;
                    const isActive = form.listingType === type.value;
                    return (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => set('listingType', type.value)}
                        className={`p-4 rounded-xl border text-center transition-all flex flex-col items-center gap-2 ${
                          isActive
                            ? 'bg-[#CDFF00]/10 border-[#CDFF00] text-[#CDFF00]'
                            : 'bg-black/50 border-white/10 text-gray-400 hover:border-white/30 hover:text-white'
                        }`}
                      >
                        <Icon className="w-6 h-6" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">{type.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Listing Title *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => set('title', e.target.value)}
                  className="w-full px-5 py-4 rounded-xl bg-black border border-white/10 text-white focus:border-[#CDFF00] focus:ring-1 focus:ring-[#CDFF00] outline-none transition-all font-bold"
                  placeholder="e.g. Professional Hair Braiding"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => set('description', e.target.value)}
                  rows={4}
                  className="w-full px-5 py-4 rounded-xl bg-black border border-white/10 text-white focus:border-[#CDFF00] focus:ring-1 focus:ring-[#CDFF00] outline-none transition-all font-medium resize-vertical"
                  placeholder="Describe your offer in detail..."
                />
              </div>

              <div className="pt-4">
                <button
                  onClick={() => { if (form.title && form.listingType) setStep(2); }}
                  className="w-full py-4 rounded-xl bg-[#CDFF00] text-black font-black uppercase tracking-widest hover:bg-[#E0FF4D] transition-all disabled:opacity-50 disabled:bg-gray-700 disabled:text-gray-400 flex items-center justify-center gap-2 outline-none"
                  disabled={!form.title || !form.listingType}
                >
                  Next Step <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Pricing */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Price *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.price}
                    onChange={(e) => set('price', e.target.value)}
                    className="w-full px-5 py-4 rounded-xl bg-black border border-white/10 text-white focus:border-[#CDFF00] focus:ring-1 focus:ring-[#CDFF00] outline-none transition-all font-black text-xl"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Currency</label>
                  <select
                    value={form.currency}
                    onChange={(e) => set('currency', e.target.value)}
                    className="w-full px-4 py-4 rounded-xl bg-black border border-white/10 text-white focus:border-[#CDFF00] font-black outline-none transition-all"
                  >
                    {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <button
                type="button"
                onClick={() => set('negotiable', !form.negotiable)}
                className={`w-full p-5 rounded-xl border text-left flex items-center gap-4 transition-all outline-none ${
                  form.negotiable ? 'bg-[#CDFF00]/10 border-[#CDFF00]' : 'bg-black/50 border-white/10 hover:border-white/30'
                }`}
              >
                <div className={`w-6 h-6 rounded flex items-center justify-center border shrink-0 ${form.negotiable ? 'bg-[#CDFF00] border-[#CDFF00]' : 'border-gray-600'}`}>
                  {form.negotiable && <Check className="w-4 h-4 text-black" />}
                </div>
                <div>
                  <span className={`block font-black uppercase tracking-widest text-sm mb-1 ${form.negotiable ? 'text-[#CDFF00]' : 'text-gray-400'}`}>Price Negotiable</span>
                  <p className="text-xs text-gray-500 font-medium">Allow buyers to submit counter-offers</p>
                </div>
              </button>

              <div>
                <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">City / Location</label>
                <input
                  type="text"
                  value={form.city}
                  onChange={(e) => set('city', e.target.value)}
                  className="w-full px-5 py-4 rounded-xl bg-black border border-white/10 text-white focus:border-[#CDFF00] focus:ring-1 focus:ring-[#CDFF00] outline-none transition-all font-bold"
                  placeholder="e.g. Warszawa"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button onClick={() => setStep(1)} className="flex-1 py-4 rounded-xl glass bg-black/40 border border-white/10 border border-white/10 text-white font-bold uppercase tracking-widest hover:glass bg-black/40 border border-white/10 transition-all flex items-center justify-center gap-2 outline-none">
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <button
                  onClick={() => { if (form.price) setStep(3); }}
                  className="flex-1 py-4 rounded-xl bg-[#CDFF00] text-black font-black uppercase tracking-widest hover:bg-[#E0FF4D] transition-all disabled:opacity-50 disabled:bg-gray-700 disabled:text-gray-400 flex items-center justify-center gap-2 outline-none"
                  disabled={!form.price}
                >
                  Next <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Images & Summary */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Photos (Optional)</label>
                <label className="block w-full p-10 rounded-xl border-2 border-dashed border-white/20 text-center cursor-pointer hover:border-[#CDFF00]/50 hover:bg-[#CDFF00]/5 transition-all outline-none">
                  <ImageIcon className="w-10 h-10 mx-auto text-gray-500 mb-3" />
                  <p className="text-sm font-bold text-gray-300 uppercase tracking-widest mb-1">Upload Media</p>
                  <p className="text-xs text-gray-600 font-medium">PNG, JPG to 10MB</p>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => setImages([...images, ...Array.from(e.target.files)])}
                  />
                </label>
                {images.length > 0 && (
                  <div className="flex flex-wrap gap-3 mt-4">
                    {images.map((img, i) => (
                      <div key={i} className="relative group">
                        <img src={URL.createObjectURL(img)} alt="" className="w-24 h-24 rounded-lg object-cover" />
                        <button
                          onClick={() => setImages(images.filter((_, idx) => idx !== i))}
                          className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-[#CDFF00] text-white flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Summary */}
              <div className="p-6 rounded-xl bg-black border border-white/10 space-y-3">
                <h3 className="text-xs font-black text-[#CDFF00] uppercase tracking-widest mb-4">Summary</h3>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500 font-bold uppercase tracking-widest text-[10px]">Category</span>
                  <span className="text-white font-bold">{LISTING_TYPES.find(t => t.value === form.listingType)?.label}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500 font-bold uppercase tracking-widest text-[10px]">Title</span>
                  <span className="text-white font-bold">{form.title}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500 font-bold uppercase tracking-widest text-[10px]">Price</span>
                  <span className="text-white font-black">{form.price} {form.currency} {form.negotiable && <span className="text-[#CDFF00] ml-1">(OBO)</span>}</span>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button onClick={() => setStep(2)} className="flex-1 py-4 rounded-xl glass bg-black/40 border border-white/10 border border-white/10 text-white font-bold uppercase tracking-widest hover:glass bg-black/40 border border-white/10 transition-all flex items-center justify-center gap-2 outline-none">
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex-[2] py-4 rounded-xl bg-[#CDFF00] text-black font-black uppercase tracking-widest hover:bg-[#E0FF4D] shadow-lg hover:shadow-[#CDFF00]/20 disabled:opacity-50 transition-all outline-none"
                >
                  {loading ? 'Publishing...' : 'Publish Listing'}
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
