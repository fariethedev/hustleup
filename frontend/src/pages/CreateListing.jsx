import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useSelector } from 'react-redux';
import { selectIsAuthenticated, selectIsSeller } from '../store/authSlice';
import { listingsApi } from '../api/client';
import { LISTING_TYPES, CURRENCIES, POLISH_CITIES } from '../utils/constants';
import { Lock, Image as ImageIcon, Check, X, ArrowRight, ArrowLeft, Play, CalendarClock } from 'lucide-react';
import { isVideoUrl } from '../utils/media';

/**
 * How many photos/clips a listing should carry. Listings with a full gallery convert better,
 * so the form asks for this many — but it isn't a hard gate: the backend tops any listing
 * short of five up with category-matched supporting shots, so a seller with two good photos
 * still gets a complete-looking page instead of being blocked from posting.
 */
const TARGET_MEDIA = 5;

/** Hard cap on uploads, to keep a single listing from becoming a photo dump. */
const MAX_MEDIA = 10;

export default function CreateListing() {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const isSeller = useSelector(selectIsSeller);
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    title: '', description: '', listingType: '', price: '', currency: 'PLN',
    negotiable: false, swapEnabled: false, city: '', meta: '',
    eventStartsAt: '', eventVenue: '',
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
      formData.append('swapEnabled', form.swapEnabled);
      formData.append('city', form.city);
      // EVENT-only. Sent as plain strings and parsed leniently server-side, so a blank
      // value from a non-event listing is simply ignored rather than rejected.
      if (form.listingType === 'EVENT') {
        formData.append('eventStartsAt', form.eventStartsAt || '');
        formData.append('eventVenue', form.eventVenue || '');
      }
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

              {/* Swap Mode opt-in — off by default, because a seller who only wants cash
                  shouldn't have to field trade offers. */}
              <button
                type="button"
                onClick={() => set('swapEnabled', !form.swapEnabled)}
                className={`w-full p-5 rounded-xl border text-left flex items-center gap-4 transition-all outline-none ${
                  form.swapEnabled ? 'bg-[#FF00FF]/10 border-[#FF00FF]' : 'bg-black/50 border-white/10 hover:border-white/30'
                }`}
              >
                <div className={`w-6 h-6 rounded flex items-center justify-center border shrink-0 ${form.swapEnabled ? 'bg-[#FF00FF] border-[#FF00FF]' : 'border-gray-600'}`}>
                  {form.swapEnabled && <Check className="w-4 h-4 text-black" />}
                </div>
                <div>
                  <span className={`block font-black uppercase tracking-widest text-sm mb-1 ${form.swapEnabled ? 'text-[#FF00FF]' : 'text-gray-400'}`}>Open to swaps</span>
                  <p className="text-xs text-gray-500 font-medium">Let people trade an item or a skill for this instead of cash</p>
                </div>
              </button>

              {/* City picker rather than free text: browse filters everything by Polish city,
                  so a typo'd or blank city quietly drops the listing out of every city view. */}
              <div>
                <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">City / Location</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {POLISH_CITIES.slice(0, 6).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => set('city', c)}
                      className={`px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${
                        form.city === c
                          ? 'bg-[#CDFF00] text-black'
                          : 'bg-black border border-white/10 text-gray-400 hover:text-white hover:border-white/30'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  list="polish-cities"
                  value={form.city}
                  onChange={(e) => set('city', e.target.value)}
                  className="w-full px-5 py-4 rounded-xl bg-black border border-white/10 text-white focus:border-[#CDFF00] focus:ring-1 focus:ring-[#CDFF00] outline-none transition-all font-bold"
                  placeholder="Pick or type a city, e.g. Warszawa"
                />
                <datalist id="polish-cities">
                  {POLISH_CITIES.map((c) => <option key={c} value={c} />)}
                </datalist>
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
              {/* EVENT-only: a ticket has to print a date and a venue, so these are asked
                  for here rather than buried in the free-text description. */}
              {form.listingType === 'EVENT' && (
                <div className="p-5 rounded-xl bg-[#CDFF00]/5 border border-[#CDFF00]/25 space-y-4">
                  <h3 className="text-xs font-black text-[#CDFF00] uppercase tracking-widest flex items-center gap-2">
                    <CalendarClock className="w-4 h-4" /> Event details
                  </h3>
                  <div>
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Starts</label>
                    <input
                      type="datetime-local"
                      value={form.eventStartsAt}
                      onChange={(e) => set('eventStartsAt', e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-black border border-white/10 text-white focus:border-[#CDFF00] outline-none transition-all font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Venue / address</label>
                    <input
                      type="text"
                      value={form.eventVenue}
                      onChange={(e) => set('eventVenue', e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-black border border-white/10 text-white focus:border-[#CDFF00] outline-none transition-all font-bold"
                      placeholder="e.g. Klub Hybrydy, ul. Złota 7/9"
                    />
                  </div>
                  <p className="text-[10px] text-gray-500 leading-relaxed">
                    Both appear on every ticket, and buyers get a scannable QR code the moment they book.
                    You scan them in from the listing's Door screen.
                  </p>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-black text-gray-500 uppercase tracking-widest">
                    Photos & video
                  </label>
                  <span className={`text-[10px] font-black uppercase tracking-widest ${
                    images.length >= TARGET_MEDIA ? 'text-[#CDFF00]' : 'text-gray-600'
                  }`}>
                    {images.length} / {TARGET_MEDIA}
                  </span>
                </div>

                <label className={`block w-full p-10 rounded-xl border-2 border-dashed text-center transition-all outline-none ${
                  images.length >= MAX_MEDIA
                    ? 'border-white/10 opacity-40 cursor-not-allowed'
                    : 'border-white/20 cursor-pointer hover:border-[#CDFF00]/50 hover:bg-[#CDFF00]/5'
                }`}>
                  <ImageIcon className="w-10 h-10 mx-auto text-gray-500 mb-3" />
                  <p className="text-sm font-bold text-gray-300 uppercase tracking-widest mb-1">Upload Media</p>
                  <p className="text-xs text-gray-600 font-medium">
                    {images.length >= MAX_MEDIA
                      ? `Maximum ${MAX_MEDIA} items reached`
                      : `Images or short clips — aim for ${TARGET_MEDIA}`}
                  </p>
                  <input
                    type="file"
                    multiple
                    accept="image/*,video/*"
                    className="hidden"
                    disabled={images.length >= MAX_MEDIA}
                    // slice() enforces the cap even when someone multi-selects past it in the
                    // file picker, where the disabled attribute can't help.
                    onChange={(e) => {
                      setImages([...images, ...Array.from(e.target.files)].slice(0, MAX_MEDIA));
                      // Clearing the input lets the same file be re-picked after a removal;
                      // otherwise the browser suppresses the change event as a no-op.
                      e.target.value = '';
                    }}
                  />
                </label>

                {/* Honest about what happens with a thin gallery, rather than blocking the
                    seller or quietly padding without telling them. */}
                <p className={`text-[10px] mt-2 leading-relaxed ${
                  images.length >= TARGET_MEDIA ? 'text-[#CDFF00]' : 'text-gray-500'
                }`}>
                  {images.length >= TARGET_MEDIA
                    ? 'Great — your listing will show a full gallery of your own media.'
                    : `Listings with ${TARGET_MEDIA}+ photos get noticed. Post fewer and we'll fill the rest of the gallery with ${
                        LISTING_TYPES.find((t) => t.value === form.listingType)?.label.toLowerCase() || 'category'
                      } stock shots behind yours.`}
                </p>

                {images.length > 0 && (
                  <div className="flex flex-wrap gap-3 mt-4">
                    {images.map((file, i) => (
                      <MediaThumb
                        key={`${file.name}-${file.lastModified}-${i}`}
                        file={file}
                        isLead={i === 0}
                        onRemove={() => setImages(images.filter((_, idx) => idx !== i))}
                      />
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
                {form.listingType === 'EVENT' && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500 font-bold uppercase tracking-widest text-[10px]">Starts</span>
                    <span className="text-white font-bold">
                      {form.eventStartsAt ? new Date(form.eventStartsAt).toLocaleString() : 'Not set'}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500 font-bold uppercase tracking-widest text-[10px]">Media</span>
                  <span className="text-white font-bold">
                    {images.length > 0 ? `${images.length} uploaded` : 'None — gallery will be filled for you'}
                  </span>
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

/**
 * Preview tile for one file queued for upload — a still for images, a poster-less <video>
 * for clips so the seller can confirm they picked the right take.
 *
 * The object URL is created in an effect and revoked on unmount. Calling
 * `URL.createObjectURL` inline during render (as this form used to) allocates a fresh blob
 * URL on every re-render and never releases any of them, which leaks the whole file in memory
 * each time — noticeable fast when the files are video.
 */
function MediaThumb({ file, isLead, onRemove }) {
  const [url, setUrl] = useState('');
  const isVideo = file.type ? file.type.startsWith('video/') : isVideoUrl(file.name);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  return (
    <div className="relative group">
      {isVideo ? (
        <video src={url} muted className="w-24 h-24 rounded-lg object-cover bg-black" />
      ) : (
        <img src={url} alt="" className="w-24 h-24 rounded-lg object-cover" />
      )}

      {isVideo && (
        <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/80 text-[8px] font-black uppercase tracking-widest text-white flex items-center gap-1">
          <Play className="w-2 h-2 fill-white" /> Clip
        </span>
      )}

      {/* The first item is the one that shows on browse cards and shares, so it's worth
          calling out which photo the seller is actually leading with. */}
      {isLead && (
        <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-[#CDFF00] text-[8px] font-black uppercase tracking-widest text-black">
          Cover
        </span>
      )}

      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove this file"
        className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-[#CDFF00] text-black flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}
