import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { shopsApi, shopServicesApi, shopAppointmentsApi, dispatchToast } from '../api/client';
import { SHIPPING_METHODS } from '../utils/shipping';
import { invalidateShops } from '../hooks/useShops';
import { POLISH_CITIES, CURRENCIES, formatPrice } from '../utils/constants';
import { SHOP_BUSINESS_TYPES, isAppointmentBusiness, DURATION_PRESETS } from '../utils/shopCategories';
import SmartImage from './SmartImage';
import { uploadUrl } from '../config';
import { Building2, ImageUp, CirclePlus, SquarePen, Eraser, CircleX, CircleCheck, ScanEye, EyeClosed, Box, SquareArrowOutUpRight, Paintbrush, Loader, CalendarClock, CalendarCheck2, UserRoundCheck, Timer, ClockAlert } from 'lucide-react';

/* Seller-facing palette. Any hex is accepted by the API — these are just one-tap presets. */
const ACCENT_PRESETS = ['#CDFF00', '#00FFFF', '#FF00FF', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#3B82F6'];

const EMPTY_SHOP = {
  name: '', category: '', businessType: 'GENERAL', tagline: '', description: '',
  bannerUrl: '', accentColor: '#CDFF00', city: '', published: true,
};

const EMPTY_PRODUCT = {
  name: '', description: '', price: '', currency: 'PLN', category: '', imageUrl: '',
  // Collection is the safe opening default: always possible, costs nobody anything, and
  // promises the buyer nothing the seller hasn't offered.
  shippingMethod: 'PICKUP', shippingPrice: '',
};

const EMPTY_SERVICE = {
  name: '', description: '', durationMinutes: 30, price: '', currency: 'PLN', active: true,
};

/**
 * The dashboard's shop tab: everything a buyer sees on this seller's shop card and shop page,
 * editable in one place by the person who owns it.
 *
 * <p>The server is the authority on ownership — every call here hits an endpoint that
 * re-checks the caller owns the shop. This component only decides what to *show*.
 */
export default function ShopManager({ user }) {
  const [shop, setShop] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_SHOP);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null); // product object, or 'new', or null
  const bannerInput = useRef(null);

  // Only ever populated for an appointment-based shop — see loadBookingData.
  const [services, setServices] = useState([]);
  const [slots, setSlots] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [editingService, setEditingService] = useState(null); // service object, or 'new', or null

  useEffect(() => {
    shopsApi.mine()
      .then((r) => {
        // 204 No Content — this seller hasn't created a shop yet.
        if (!r.data) { setShop(null); return; }
        setShop(r.data);
        setForm({ ...EMPTY_SHOP, ...r.data });
        if (isAppointmentBusiness(r.data.businessType)) loadBookingData(r.data.id);
      })
      .catch(() => setShop(null))
      .finally(() => setLoading(false));
  }, []);

  const set = (key, value) => { setForm((f) => ({ ...f, [key]: value })); setDirty(true); };

  const createShop = async () => {
    if (!form.name.trim()) { dispatchToast('Give your shop a name first', 'error'); return; }
    setSaving(true);
    try {
      const res = await shopsApi.create({ ...form, city: form.city || user?.city || '' });
      setShop(res.data);
      setForm({ ...EMPTY_SHOP, ...res.data });
      setDirty(false);
      invalidateShops();
      dispatchToast('Shop created — it’s live on Explore', 'success');
    } catch (e) {
      dispatchToast(e.response?.data?.message || 'Could not create your shop', 'error');
    } finally {
      setSaving(false);
    }
  };

  const saveShop = async () => {
    setSaving(true);
    try {
      const res = await shopsApi.update(shop.id, form);
      setShop(res.data);
      setForm({ ...EMPTY_SHOP, ...res.data });
      setDirty(false);
      invalidateShops();
      // A shop switched to an appointment type mid-session (or switched to one on its very
      // first save) has never loaded its own booking data — nothing to show until now.
      if (isAppointmentBusiness(res.data.businessType) && services.length === 0) loadBookingData(res.data.id);
      dispatchToast('Shop updated', 'success');
    } catch (e) {
      dispatchToast(e.response?.data?.message || 'Could not save your shop', 'error');
    } finally {
      setSaving(false);
    }
  };

  const uploadBanner = async (file) => {
    if (!file || !shop) return;
    setUploadingBanner(true);
    try {
      const res = await shopsApi.uploadMedia(shop.id, file);
      set('bannerUrl', res.data.url);
      dispatchToast('Banner uploaded — save to publish it', 'success');
    } catch {
      dispatchToast('Could not upload that image', 'error');
    } finally {
      setUploadingBanner(false);
    }
  };

  const deleteShop = async () => {
    if (!confirm('Delete your shop and all of its products? This cannot be undone.')) return;
    try {
      await shopsApi.remove(shop.id);
      setShop(null);
      setForm(EMPTY_SHOP);
      invalidateShops();
      dispatchToast('Shop deleted', 'success');
    } catch {
      dispatchToast('Could not delete your shop', 'error');
    }
  };

  const onProductSaved = (product, mode) => {
    setShop((s) => ({
      ...s,
      products: mode === 'create'
        ? [...(s.products || []), product]
        : (s.products || []).map((p) => (p.id === product.id ? product : p)),
    }));
    setEditingProduct(null);
    invalidateShops();
  };

  const deleteProduct = async (productId) => {
    if (!confirm('Remove this product from your shop?')) return;
    try {
      await shopsApi.removeProduct(shop.id, productId);
      setShop((s) => ({ ...s, products: (s.products || []).filter((p) => p.id !== productId) }));
      invalidateShops();
      dispatchToast('Product removed', 'success');
    } catch {
      dispatchToast('Could not remove that product', 'error');
    }
  };

  /** Services, slots and received appointments — loaded once, only for an appointment shop. */
  const loadBookingData = (shopId) => {
    shopServicesApi.list(shopId).then((r) => setServices(r.data || [])).catch(() => setServices([]));
    shopServicesApi.mySlots(shopId).then((r) => setSlots(r.data || [])).catch(() => setSlots([]));
    shopAppointmentsApi.received(shopId).then((r) => setAppointments(r.data || [])).catch(() => setAppointments([]));
  };

  const onServiceSaved = (service, mode) => {
    setServices((prev) => (mode === 'create' ? [...prev, service] : prev.map((s) => (s.id === service.id ? service : s))));
    setEditingService(null);
  };

  const deleteService = async (serviceId) => {
    if (!confirm('Delete this service? Its open slots go with it.')) return;
    try {
      await shopServicesApi.remove(shop.id, serviceId);
      setServices((prev) => prev.filter((s) => s.id !== serviceId));
      setSlots((prev) => prev.filter((s) => s.shopServiceId !== serviceId));
      dispatchToast('Service deleted', 'success');
    } catch (e) {
      dispatchToast(e.response?.data?.message || 'Could not delete that service — it may have booked appointments', 'error');
    }
  };

  const addSlot = async (serviceId, startTime, endTime) => {
    const res = await shopServicesApi.addSlot(shop.id, serviceId, startTime, endTime);
    setSlots((prev) => [...prev, { ...res.data, serviceName: services.find((s) => s.id === serviceId)?.name }]);
  };

  const removeSlot = async (slotId) => {
    try {
      await shopServicesApi.removeSlot(shop.id, slotId);
      setSlots((prev) => prev.filter((s) => s.id !== slotId));
    } catch {
      dispatchToast('Could not remove that slot', 'error');
    }
  };

  const updateAppointmentStatus = async (appointmentId, status) => {
    try {
      const res = await shopAppointmentsApi.updateStatus(shop.id, appointmentId, status);
      setAppointments((prev) => prev.map((a) => (a.id === appointmentId ? res.data : a)));
      // Cancelling frees the slot back up — reflect that without a second round trip.
      if (status === 'CANCELLED') {
        const cancelled = appointments.find((a) => a.id === appointmentId);
        if (cancelled) setSlots((prev) => prev.map((s) => (s.id === cancelled.slotId ? { ...s, booked: false } : s)));
      }
    } catch {
      dispatchToast('Could not update that appointment', 'error');
    }
  };

  if (loading) {
    return (
      <div className="space-y-2.5">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="glass rounded-2xl h-24 border border-white/5 animate-pulse" />
        ))}
      </div>
    );
  }

  /* ── No shop yet: a short create form rather than an empty state with nothing to do ── */
  if (!shop) {
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="max-w-lg mx-auto">
        <div className="glass rounded-2xl p-6 border border-white/5 text-center">
          <div className="w-12 h-12 rounded-full bg-[#CDFF00]/10 flex items-center justify-center mx-auto mb-3">
            <Building2 className="w-6 h-6 text-[#CDFF00]" />
          </div>
          <h3 className="text-lg font-black text-white tracking-tight mb-1.5">Open your shop</h3>
          <p className="text-xs text-gray-500 mb-5 leading-relaxed">
            A storefront gets you a card on Explore and a page of your own. You control every
            part of it from here — name, look, city and what's on the shelf.
          </p>

          <div className="space-y-2.5 text-left">
            <Field label="Shop name" value={form.name} onChange={(v) => set('name', v)} placeholder="e.g. Piękna Moda" />
            <Field label="Category" value={form.category} onChange={(v) => set('category', v)} placeholder="e.g. Fashion & Clothing" />
            <BusinessTypeField value={form.businessType} onChange={(v) => set('businessType', v)} />
            <CityField value={form.city} onChange={(v) => set('city', v)} fallback={user?.city} />
          </div>

          <button
            onClick={createShop}
            disabled={saving || !form.name.trim()}
            className="w-full mt-5 py-3 rounded-xl bg-[#CDFF00] text-black font-black text-xs tracking-widest hover:bg-[#d9ff33] active:scale-[0.99] transition-all disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {saving ? <><Loader className="w-4 h-4 animate-spin" /> Creating…</> : <><CirclePlus className="w-4 h-4" /> Create shop</>}
          </button>
        </div>
      </motion.div>
    );
  }

  const products = shop.products || [];

  return (
    <div className="space-y-4">
      {/* ── Live preview of the card buyers see, so edits have an obvious target ── */}
      <div className="glass rounded-2xl border border-white/5 overflow-hidden">
        <div className="relative h-32 bg-black media-overlay">
          <SmartImage
            src={uploadUrl(form.bannerUrl)}
            alt=""
            fallbackIcon={Building2}
            className="w-full h-full object-cover opacity-80"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] to-transparent" />
          <div
            className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-40"
            style={{ background: form.accentColor }}
          />
          <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[9px] font-black tracking-widest text-gray-400 truncate">
                {form.category || 'No category'} · {form.city || 'No city'}
              </p>
              <h3 className="text-lg font-black text-white tracking-tight truncate">
                {form.name || 'Untitled shop'}
              </h3>
            </div>
            <Link
              to={`/shop/${shop.slug || shop.id}`}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/70 border border-white/20 text-[9px] font-black tracking-widest text-white hover:border-white/40 transition-colors"
            >
              <SquareArrowOutUpRight className="w-3 h-3" /> View
            </Link>
          </div>
        </div>

        {/* Read-only stats — derived from real reviews and listings, not editable here */}
        <div className="flex items-center gap-4 px-4 py-2.5 border-t border-white/5 text-[9px] font-black tracking-widest text-gray-500">
          <span>{shop.rating > 0 ? `${shop.rating.toFixed(1)}★` : 'No rating yet'}</span>
          <span>{shop.reviewCount} reviews</span>
          <span>{products.length} products</span>
          <span>{shop.listingCount} listings</span>
          <span className={`ml-auto flex items-center gap-1 ${form.published ? 'text-[#CDFF00]' : 'text-gray-500'}`}>
            {form.published ? <><ScanEye className="w-3 h-3" /> Live</> : <><EyeClosed className="w-3 h-3" /> Hidden</>}
          </span>
        </div>
      </div>

      {/* ── Shop details ── */}
      <div className="glass rounded-2xl p-4 border border-white/5 space-y-3">
        <h4 className="text-[10px] font-black tracking-widest text-gray-500">Storefront details</h4>

        <div className="grid sm:grid-cols-2 gap-2.5">
          <Field label="Shop name" value={form.name} onChange={(v) => set('name', v)} />
          <Field label="Category" value={form.category} onChange={(v) => set('category', v)} placeholder="e.g. Beauty & Skincare" />
        </div>

        <BusinessTypeField value={form.businessType} onChange={(v) => set('businessType', v)} />

        <Field label="Tagline" value={form.tagline} onChange={(v) => set('tagline', v)} placeholder="One line buyers see on your card" maxLength={160} />

        <div>
          <label className="block text-[10px] font-black tracking-widest text-gray-500 mb-1.5">About your shop</label>
          <textarea
            rows={3}
            value={form.description || ''}
            onChange={(e) => set('description', e.target.value)}
            maxLength={2000}
            placeholder="What you sell, how you work, why buyers should pick you."
            className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-[#CDFF00] transition-colors resize-none"
          />
        </div>

        <CityField value={form.city} onChange={(v) => set('city', v)} fallback={user?.city} />

        {/* Banner */}
        <div>
          <label className="block text-[10px] font-black tracking-widest text-gray-500 mb-1.5">Banner image</label>
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => bannerInput.current?.click()}
              disabled={uploadingBanner}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-bold hover:border-white/30 transition-colors disabled:opacity-60"
            >
              {uploadingBanner ? <Loader className="w-4 h-4 animate-spin" /> : <ImageUp className="w-4 h-4" />}
              {uploadingBanner ? 'Uploading…' : 'Upload image'}
            </button>
            {form.bannerUrl && (
              <button
                onClick={() => set('bannerUrl', '')}
                className="px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold hover:bg-red-500/20 transition-colors"
              >
                Remove
              </button>
            )}
            <input
              ref={bannerInput}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => { uploadBanner(e.target.files?.[0]); e.target.value = ''; }}
            />
          </div>
        </div>

        {/* Accent colour */}
        <div>
          <label className="flex items-center gap-1.5 text-[10px] font-black tracking-widest text-gray-500 mb-1.5">
            <Paintbrush className="w-3 h-3" /> Accent colour
          </label>
          <div className="flex flex-wrap items-center gap-2">
            {ACCENT_PRESETS.map((c) => (
              <button
                key={c}
                onClick={() => set('accentColor', c)}
                aria-label={`Use accent ${c}`}
                className={`w-8 h-8 rounded-lg border-2 transition-transform hover:scale-110 ${
                  form.accentColor?.toLowerCase() === c.toLowerCase() ? 'border-white' : 'border-white/10'
                }`}
                style={{ background: c }}
              />
            ))}
            <input
              type="color"
              value={/^#[0-9a-f]{6}$/i.test(form.accentColor || '') ? form.accentColor : '#CDFF00'}
              onChange={(e) => set('accentColor', e.target.value)}
              aria-label="Custom accent colour"
              className="w-8 h-8 rounded-lg bg-transparent border-2 border-white/10 cursor-pointer"
            />
          </div>
        </div>

        {/* Visibility */}
        <label className="flex items-center gap-2.5 pt-1 cursor-pointer">
          <input
            type="checkbox"
            checked={form.published}
            onChange={(e) => set('published', e.target.checked)}
            className="accent-[#CDFF00] w-4 h-4"
          />
          <span className="text-sm text-gray-300">
            Show my shop on Explore
            <span className="block text-[11px] text-gray-500">Untick to hide it while you work on it — your products are kept.</span>
          </span>
        </label>

        <div className="flex items-center gap-2.5 pt-2 border-t border-white/5">
          <button
            onClick={saveShop}
            disabled={saving || !dirty}
            className="flex-1 py-2.5 rounded-xl bg-[#CDFF00] text-black font-black text-xs tracking-widest hover:bg-[#d9ff33] active:scale-[0.99] transition-all disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {saving ? <><Loader className="w-4 h-4 animate-spin" /> Saving…</> : dirty ? <><CircleCheck className="w-4 h-4" /> Save changes</> : 'Saved'}
          </button>
          <button
            onClick={deleteShop}
            className="px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-black tracking-widest hover:bg-red-500/20 transition-colors"
          >
            <Eraser className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Services & Appointments — only for a salon/barber/spa-style shop. A hair salon
          still sells product sometimes, so this sits alongside the shelf below rather than
          replacing it. ── */}
      {isAppointmentBusiness(form.businessType) && (
        <ServicesAndAppointments
          shop={shop}
          services={services}
          slots={slots}
          appointments={appointments}
          onAddService={() => setEditingService('new')}
          onEditService={setEditingService}
          onDeleteService={deleteService}
          onAddSlot={addSlot}
          onRemoveSlot={removeSlot}
          onAppointmentStatus={updateAppointmentStatus}
        />
      )}

      {editingService && (
        <ServiceModal
          shopId={shop.id}
          service={editingService === 'new' ? null : editingService}
          onClose={() => setEditingService(null)}
          onSaved={onServiceSaved}
        />
      )}

      {/* ── Products ── */}
      <div className="glass rounded-2xl p-4 border border-white/5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h4 className="text-[10px] font-black tracking-widest text-gray-500">
            Products <span className="text-gray-600">({products.length})</span>
          </h4>
          <button
            onClick={() => setEditingProduct('new')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#CDFF00] text-black text-[9px] font-black tracking-widest hover:bg-[#d9ff33] active:scale-95 transition-all"
          >
            <CirclePlus className="w-3.5 h-3.5" /> Add product
          </button>
        </div>

        {products.length === 0 ? (
          <div className="text-center py-8 rounded-xl border border-dashed border-white/10">
            <Box className="w-8 h-8 mx-auto text-white/15 mb-2" />
            <p className="text-xs text-gray-500">Nothing on the shelf yet. Add your first product.</p>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {products.map((p) => (
                <motion.div
                  key={p.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/15 transition-colors"
                >
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-black shrink-0">
                    <SmartImage src={p.imageUrl} alt={p.name} fallbackIcon={Box} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{p.name}</p>
                    <p className="text-[10px] font-black tracking-widest text-gray-500">
                      {p.category || 'Uncategorised'} · <span className="text-[#CDFF00]">{formatPrice(p.price, p.currency)}</span>
                    </p>
                  </div>
                  <button
                    onClick={() => setEditingProduct(p)}
                    className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors shrink-0"
                    aria-label={`Edit ${p.name}`}
                  >
                    <SquarePen className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => deleteProduct(p.id)}
                    className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-colors shrink-0"
                    aria-label={`Delete ${p.name}`}
                  >
                    <Eraser className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {editingProduct && (
        <ProductModal
          shopId={shop.id}
          product={editingProduct === 'new' ? null : editingProduct}
          onClose={() => setEditingProduct(null)}
          onSaved={onProductSaved}
        />
      )}
    </div>
  );
}

/* ── Product add/edit modal ── */
function ProductModal({ shopId, product, onClose, onSaved }) {
  const isNew = !product;
  const [form, setForm] = useState(product ? { ...EMPTY_PRODUCT, ...product } : EMPTY_PRODUCT);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef(null);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  // Collection and digital delivery have no postage to charge, so the field is hidden
  // rather than shown at zero for the seller to wonder about.
  const chargesPostage = !['PICKUP', 'DIGITAL', 'NONE'].includes(form.shippingMethod || 'PICKUP');

  const uploadImage = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const res = await shopsApi.uploadMedia(shopId, file);
      set('imageUrl', res.data.url);
    } catch {
      dispatchToast('Could not upload that image', 'error');
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!form.name.trim()) { dispatchToast('Product needs a name', 'error'); return; }
    if (form.price === '' || Number(form.price) < 0) { dispatchToast('Enter a valid price', 'error'); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        price: Number(form.price),
        // Methods with nothing to post send zero rather than whatever was typed before the
        // seller switched to collection.
        shippingPrice: chargesPostage ? Number(form.shippingPrice) || 0 : 0,
      };
      const res = isNew
        ? await shopsApi.addProduct(shopId, payload)
        : await shopsApi.updateProduct(shopId, product.id, payload);
      dispatchToast(isNew ? 'Product added' : 'Product updated', 'success');
      onSaved(res.data, isNew ? 'create' : 'update');
    } catch (e) {
      dispatchToast(e.response?.data?.message || 'Could not save that product', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center px-4">
      <div onClick={onClose} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-md bg-[#0a0a0a] border border-white/10 rounded-2xl p-5 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-black text-white tracking-tight">
            {isNew ? 'Add product' : 'Edit product'}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-500">
            <CircleX className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2.5">
          <Field label="Name" value={form.name} onChange={(v) => set('name', v)} placeholder="e.g. Oversized Graphic Tee" />

          <div>
            <label className="block text-[10px] font-black tracking-widest text-gray-500 mb-1.5">Description</label>
            <textarea
              rows={2}
              value={form.description || ''}
              onChange={(e) => set('description', e.target.value)}
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-[#CDFF00] resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[10px] font-black tracking-widest text-gray-500 mb-1.5">Price</label>
              <input
                type="number" min="0" step="0.01"
                value={form.price}
                onChange={(e) => set('price', e.target.value)}
                className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-[#CDFF00]"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black tracking-widest text-gray-500 mb-1.5">Currency</label>
              <select
                value={form.currency}
                onChange={(e) => set('currency', e.target.value)}
                className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-[#CDFF00] cursor-pointer"
              >
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <Field label="Shelf / category" value={form.category} onChange={(v) => set('category', v)} placeholder="e.g. Hoodies" />

          {/* Delivery terms live on the shelf, not on each order: they decide what the buyer
              is charged at checkout and which tracking steps you're offered afterwards. */}
          <div>
            <label className="block text-[10px] font-black tracking-widest text-gray-500 mb-1.5">
              How you send it
            </label>
            <select
              value={form.shippingMethod || 'PICKUP'}
              onChange={(e) => set('shippingMethod', e.target.value)}
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-[#CDFF00] cursor-pointer"
            >
              {SHIPPING_METHODS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          {chargesPostage && (
            <div>
              <label className="block text-[10px] font-black tracking-widest text-gray-500 mb-1.5">
                Delivery cost
              </label>
              <input
                type="number" min="0" step="0.01"
                value={form.shippingPrice}
                onChange={(e) => set('shippingPrice', e.target.value)}
                placeholder="0.00 — free delivery"
                className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-[#CDFF00] placeholder-gray-600"
              />
              <p className="mt-1.5 text-[9px] text-gray-500 leading-relaxed">
                Charged once per order on top of the price, and paid to you in full.
              </p>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-black tracking-widest text-gray-500 mb-1.5">Photo</label>
            <div className="flex items-center gap-2.5">
              <div className="w-14 h-14 rounded-lg overflow-hidden bg-black border border-white/10 shrink-0">
                <SmartImage src={form.imageUrl} alt="" fallbackIcon={Box} className="w-full h-full object-cover" />
              </div>
              <button
                onClick={() => fileInput.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-bold hover:border-white/30 transition-colors disabled:opacity-60"
              >
                {uploading ? <Loader className="w-4 h-4 animate-spin" /> : <ImageUp className="w-4 h-4" />}
                {uploading ? 'Uploading…' : 'Upload'}
              </button>
              <input
                ref={fileInput} type="file" accept="image/*" hidden
                onChange={(e) => { uploadImage(e.target.files?.[0]); e.target.value = ''; }}
              />
            </div>
          </div>
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="w-full mt-5 py-2.5 rounded-xl bg-[#CDFF00] text-black font-black text-xs tracking-widest hover:bg-[#d9ff33] active:scale-[0.99] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? <><Loader className="w-4 h-4 animate-spin" /> Saving…</> : <><CircleCheck className="w-4 h-4" /> {isNew ? 'Add to shop' : 'Save changes'}</>}
        </button>
      </motion.div>
    </div>
  );
}

/* ── Small shared inputs ── */
function Field({ label, value, onChange, placeholder, maxLength }) {
  return (
    <div>
      <label className="block text-[10px] font-black tracking-widest text-gray-500 mb-1.5">{label}</label>
      <input
        type="text"
        value={value || ''}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-[#CDFF00] transition-colors"
      />
    </div>
  );
}

/** City picker: browse filters by Polish city, so free text would strand the shop. */
function CityField({ value, onChange, fallback }) {
  return (
    <div>
      <label className="block text-[10px] font-black tracking-widest text-gray-500 mb-1.5">City</label>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-[#CDFF00] transition-colors cursor-pointer"
      >
        <option value="">{fallback ? `Use my profile city (${fallback})` : 'Pick a city'}</option>
        {POLISH_CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
    </div>
  );
}

/**
 * What kind of business this is — the one choice that decides whether the seller gets a
 * booking calendar alongside their shelf. A grid rather than a `<select>`: there are only
 * fifteen options and every one of them is more recognisable as an icon-plus-label than as
 * one more line of text in a dropdown a seller has to open to even see the choices.
 */
function BusinessTypeField({ value, onChange }) {
  return (
    <div>
      <label className="block text-[10px] font-black tracking-widest text-gray-500 mb-1.5">
        What kind of shop is this?
      </label>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
        {SHOP_BUSINESS_TYPES.map((t) => {
          const Icon = t.icon;
          const active = (value || 'GENERAL') === t.value;
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => onChange(t.value)}
              title={t.label}
              className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border text-center transition-all ${
                active
                  ? 'bg-[#CDFF00]/10 border-[#CDFF00] text-[#CDFF00]'
                  : 'bg-black/50 border-white/10 text-gray-400 hover:border-white/30 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-[8.5px] font-bold leading-tight line-clamp-2">{t.label}</span>
            </button>
          );
        })}
      </div>
      {isAppointmentBusiness(value) && (
        <p className="mt-2 text-[10px] text-gray-500 leading-relaxed flex items-start gap-1.5">
          <CalendarClock className="w-3 h-3 mt-0.5 shrink-0 text-[#CDFF00]" />
          Adds a Services & Appointments panel below, so customers can book a time instead of
          just messaging you to ask.
        </p>
      )}
    </div>
  );
}

/**
 * The booking side of an appointment-based shop: the menu of services, the calendar of open
 * slots, and the appointments customers have made. Three sub-panels rather than three tabs —
 * a seller managing a salon is reading all three together (what do I offer, when am I free,
 * who's coming in), and tabs would hide two of them at any moment.
 */
function ServicesAndAppointments({
  shop, services, slots, appointments,
  onAddService, onEditService, onDeleteService, onAddSlot, onRemoveSlot, onAppointmentStatus,
}) {
  const [slotServiceId, setSlotServiceId] = useState(services[0]?.id || '');
  const [slotDate, setSlotDate] = useState('');
  const [slotStart, setSlotStart] = useState('');
  const [slotDuration, setSlotDuration] = useState(30);
  const [addingSlot, setAddingSlot] = useState(false);

  // The service picker needs a live default once services finish loading — it mounts before
  // they arrive, when there is nothing yet to default to.
  useEffect(() => {
    if (!slotServiceId && services.length > 0) setSlotServiceId(services[0].id);
  }, [services, slotServiceId]);

  const addSlot = async () => {
    if (!slotServiceId || !slotDate || !slotStart) {
      dispatchToast('Pick a service, date and start time', 'error');
      return;
    }
    const start = new Date(`${slotDate}T${slotStart}:00`);
    const end = new Date(start.getTime() + slotDuration * 60000);
    const pad = (n) => String(n).padStart(2, '0');
    const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
    setAddingSlot(true);
    try {
      await onAddSlot(slotServiceId, iso(start), iso(end));
      dispatchToast('Slot opened', 'success');
      setSlotStart('');
    } catch (e) {
      dispatchToast(e.response?.data?.message || 'Could not open that slot', 'error');
    } finally {
      setAddingSlot(false);
    }
  };

  const upcomingSlots = [...slots].sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
  const activeAppointments = appointments.filter((a) => a.status === 'CONFIRMED');
  const pastAppointments = appointments.filter((a) => a.status !== 'CONFIRMED');

  return (
    <>
      {/* Services */}
      <div className="glass rounded-2xl p-4 border border-white/5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h4 className="text-[10px] font-black tracking-widest text-gray-500">
            Services <span className="text-gray-600">({services.length})</span>
          </h4>
          <button
            onClick={onAddService}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#CDFF00] text-black text-[9px] font-black tracking-widest hover:bg-[#d9ff33] active:scale-95 transition-all"
          >
            <CirclePlus className="w-3.5 h-3.5" /> Add service
          </button>
        </div>

        {services.length === 0 ? (
          <div className="text-center py-8 rounded-xl border border-dashed border-white/10">
            <CalendarClock className="w-8 h-8 mx-auto text-white/15 mb-2" />
            <p className="text-xs text-gray-500">No services yet. Add what customers can book — a haircut, a trim, a wash.</p>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {services.map((s) => (
                <motion.div
                  key={s.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  className={`flex items-center gap-3 p-2.5 rounded-xl border transition-colors ${
                    s.active ? 'bg-white/[0.03] border-white/5 hover:border-white/15' : 'bg-white/[0.01] border-white/5 opacity-50'
                  }`}
                >
                  <div className="w-10 h-10 rounded-lg bg-[#CDFF00]/10 flex items-center justify-center shrink-0">
                    <Timer className="w-4 h-4 text-[#CDFF00]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">
                      {s.name} {!s.active && <span className="text-gray-500 font-normal">· off menu</span>}
                    </p>
                    <p className="text-[10px] font-black tracking-widest text-gray-500">
                      {s.durationMinutes} min · <span className="text-[#CDFF00]">{formatPrice(s.price, s.currency)}</span>
                    </p>
                  </div>
                  <button
                    onClick={() => onEditService(s)}
                    className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors shrink-0"
                    aria-label={`Edit ${s.name}`}
                  >
                    <SquarePen className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onDeleteService(s.id)}
                    className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-colors shrink-0"
                    aria-label={`Delete ${s.name}`}
                  >
                    <Eraser className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Calendar */}
      <div className="glass rounded-2xl p-4 border border-white/5">
        <h4 className="text-[10px] font-black tracking-widest text-gray-500 mb-3">Open a time slot</h4>

        {services.length === 0 ? (
          <p className="text-xs text-gray-500">Add a service above before opening slots for it.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2.5 mb-2.5">
              <select
                value={slotServiceId}
                onChange={(e) => setSlotServiceId(e.target.value)}
                className="col-span-2 bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#CDFF00]"
              >
                {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <input type="date" value={slotDate} onChange={(e) => setSlotDate(e.target.value)}
                className="bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#CDFF00]" />
              <input type="time" value={slotStart} onChange={(e) => setSlotStart(e.target.value)}
                className="bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-[#CDFF00]" />
            </div>
            <div className="flex flex-wrap items-center gap-1.5 mb-3">
              <span className="text-[9px] font-black tracking-widest text-gray-500 mr-1">Length</span>
              {DURATION_PRESETS.map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setSlotDuration(mins)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                    slotDuration === mins ? 'bg-[#CDFF00] text-black' : 'bg-white/5 text-gray-400 hover:text-white'
                  }`}
                >
                  {mins}m
                </button>
              ))}
            </div>
            <button
              onClick={addSlot} disabled={addingSlot}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#CDFF00] text-black font-bold text-xs hover:bg-[#d9ff33] active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
            >
              <CirclePlus className="w-4 h-4" /> {addingSlot ? 'Opening…' : 'Open slot'}
            </button>
          </>
        )}

        {upcomingSlots.length > 0 && (
          <div className="space-y-2 mt-4 pt-4 border-t border-white/5">
            {upcomingSlots.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white truncate">{s.serviceName || 'Service'}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {new Date(s.startTime).toLocaleDateString()} · {new Date(s.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}–{new Date(s.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black tracking-widest ${s.booked ? 'bg-[#CDFF00]/15 text-[#CDFF00]' : 'bg-white/5 text-gray-400'}`}>
                    {s.booked ? 'Booked' : 'Open'}
                  </span>
                  {!s.booked && (
                    <button onClick={() => onRemoveSlot(s.id)} className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-all">
                      <Eraser className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Appointments */}
      <div className="glass rounded-2xl p-4 border border-white/5">
        <h4 className="text-[10px] font-black tracking-widest text-gray-500 mb-3">
          Appointments <span className="text-gray-600">({activeAppointments.length} upcoming)</span>
        </h4>

        {appointments.length === 0 ? (
          <div className="text-center py-8 rounded-xl border border-dashed border-white/10">
            <UserRoundCheck className="w-8 h-8 mx-auto text-white/15 mb-2" />
            <p className="text-xs text-gray-500">Bookings will show up here the moment someone reserves a slot.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {[...activeAppointments, ...pastAppointments].map((a) => (
              <div key={a.id} className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">{a.customerName || 'Customer'}</p>
                    <p className="text-[10px] font-black tracking-widest text-gray-500 mt-0.5">
                      {a.serviceName} · <span className="text-[#CDFF00]">{formatPrice(a.price, a.currency)}</span>
                    </p>
                    {a.startTime && (
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(a.startTime).toLocaleDateString()} · {new Date(a.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                    {a.customerPhone && <p className="text-xs text-gray-500 mt-0.5">{a.customerPhone}</p>}
                  </div>
                  <span className={`shrink-0 px-2.5 py-1 rounded-lg text-[9px] font-black tracking-widest ${
                    a.status === 'CONFIRMED' ? 'bg-[#CDFF00]/15 text-[#CDFF00]'
                      : a.status === 'COMPLETED' ? 'bg-emerald-500/15 text-emerald-400'
                      : a.status === 'NO_SHOW' ? 'bg-amber-500/15 text-amber-400'
                      : 'bg-white/5 text-gray-500'
                  }`}>
                    {a.status === 'NO_SHOW' ? 'No-show' : a.status.charAt(0) + a.status.slice(1).toLowerCase()}
                  </span>
                </div>
                {a.status === 'CONFIRMED' && (
                  <div className="flex items-center gap-2 mt-2.5 pt-2.5 border-t border-white/5">
                    <button
                      onClick={() => onAppointmentStatus(a.id, 'COMPLETED')}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold hover:bg-emerald-500/20 transition-colors"
                    >
                      <CircleCheck className="w-3 h-3" /> Completed
                    </button>
                    <button
                      onClick={() => onAppointmentStatus(a.id, 'NO_SHOW')}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold hover:bg-amber-500/20 transition-colors"
                    >
                      <ClockAlert className="w-3 h-3" /> No-show
                    </button>
                    <button
                      onClick={() => onAppointmentStatus(a.id, 'CANCELLED')}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-bold hover:bg-red-500/20 transition-colors ml-auto"
                    >
                      <CircleX className="w-3 h-3" /> Cancel
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

/* ── Service add/edit modal — mirrors ProductModal's chrome exactly ── */
function ServiceModal({ shopId, service, onClose, onSaved }) {
  const isNew = !service;
  const [form, setForm] = useState(service ? { ...EMPTY_SERVICE, ...service } : EMPTY_SERVICE);
  const [saving, setSaving] = useState(false);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    if (!form.name.trim()) { dispatchToast('Service needs a name', 'error'); return; }
    if (form.price === '' || Number(form.price) < 0) { dispatchToast('Enter a valid price', 'error'); return; }
    if (!form.durationMinutes || Number(form.durationMinutes) <= 0) { dispatchToast('Duration must be at least one minute', 'error'); return; }
    setSaving(true);
    try {
      const payload = { ...form, price: Number(form.price), durationMinutes: Number(form.durationMinutes) };
      const res = isNew
        ? await shopServicesApi.create(shopId, payload)
        : await shopServicesApi.update(shopId, service.id, payload);
      dispatchToast(isNew ? 'Service added' : 'Service updated', 'success');
      onSaved(res.data, isNew ? 'create' : 'update');
    } catch (e) {
      dispatchToast(e.response?.data?.message || 'Could not save that service', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center px-4">
      <div onClick={onClose} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-md bg-[#0a0a0a] border border-white/10 rounded-2xl p-5 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-black text-white tracking-tight">
            {isNew ? 'Add service' : 'Edit service'}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-500">
            <CircleX className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2.5">
          <Field label="Name" value={form.name} onChange={(v) => set('name', v)} placeholder="e.g. Men's Haircut" />

          <div>
            <label className="block text-[10px] font-black tracking-widest text-gray-500 mb-1.5">Description</label>
            <textarea
              rows={2}
              value={form.description || ''}
              onChange={(e) => set('description', e.target.value)}
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-[#CDFF00] resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[10px] font-black tracking-widest text-gray-500 mb-1.5">Price</label>
              <input
                type="number" min="0" step="0.01"
                value={form.price}
                onChange={(e) => set('price', e.target.value)}
                className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-[#CDFF00]"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black tracking-widest text-gray-500 mb-1.5">Currency</label>
              <select
                value={form.currency}
                onChange={(e) => set('currency', e.target.value)}
                className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-[#CDFF00] cursor-pointer"
              >
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black tracking-widest text-gray-500 mb-1.5">Duration</label>
            <div className="flex flex-wrap gap-1.5">
              {DURATION_PRESETS.map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => set('durationMinutes', mins)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    Number(form.durationMinutes) === mins ? 'bg-[#CDFF00] text-black' : 'bg-white/5 text-gray-400 hover:text-white'
                  }`}
                >
                  {mins} min
                </button>
              ))}
              <input
                type="number" min="1"
                value={form.durationMinutes}
                onChange={(e) => set('durationMinutes', e.target.value)}
                className="w-20 bg-white/[0.04] border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs outline-none focus:border-[#CDFF00]"
              />
            </div>
          </div>

          <label className="flex items-center gap-2.5 pt-1 cursor-pointer">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => set('active', e.target.checked)}
              className="accent-[#CDFF00] w-4 h-4"
            />
            <span className="text-sm text-gray-300">
              On the menu
              <span className="block text-[11px] text-gray-500">Untick to hide it from customers without losing its history.</span>
            </span>
          </label>
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="w-full mt-5 py-2.5 rounded-xl bg-[#CDFF00] text-black font-black text-xs tracking-widest hover:bg-[#d9ff33] active:scale-[0.99] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? <><Loader className="w-4 h-4 animate-spin" /> Saving…</> : <><CircleCheck className="w-4 h-4" /> {isNew ? 'Add to menu' : 'Save changes'}</>}
        </button>
      </motion.div>
    </div>
  );
}
