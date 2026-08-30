import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { shopsApi, dispatchToast } from '../api/client';
import { SHIPPING_METHODS } from '../utils/shipping';
import { invalidateShops } from '../hooks/useShops';
import { POLISH_CITIES, CURRENCIES, formatPrice } from '../utils/constants';
import SmartImage from './SmartImage';
import { uploadUrl } from '../config';
import {
  Store, ImagePlus, Plus, Pencil, Trash2, X, Check, Eye, EyeOff,
  Package, ExternalLink, Palette, Loader2,
} from 'lucide-react';

/* Seller-facing palette. Any hex is accepted by the API — these are just one-tap presets. */
const ACCENT_PRESETS = ['#CDFF00', '#00FFFF', '#FF00FF', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#3B82F6'];

const EMPTY_SHOP = {
  name: '', category: '', tagline: '', description: '',
  bannerUrl: '', accentColor: '#CDFF00', city: '', published: true,
};

const EMPTY_PRODUCT = {
  name: '', description: '', price: '', currency: 'PLN', category: '', imageUrl: '',
  // Collection is the safe opening default: always possible, costs nobody anything, and
  // promises the buyer nothing the seller hasn't offered.
  shippingMethod: 'PICKUP', shippingPrice: '',
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

  useEffect(() => {
    shopsApi.mine()
      .then((r) => {
        // 204 No Content — this seller hasn't created a shop yet.
        if (!r.data) { setShop(null); return; }
        setShop(r.data);
        setForm({ ...EMPTY_SHOP, ...r.data });
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
            <Store className="w-6 h-6 text-[#CDFF00]" />
          </div>
          <h3 className="text-lg font-black text-white uppercase tracking-tight mb-1.5">Open your shop</h3>
          <p className="text-xs text-gray-500 mb-5 leading-relaxed">
            A storefront gets you a card on Explore and a page of your own. You control every
            part of it from here — name, look, city and what's on the shelf.
          </p>

          <div className="space-y-2.5 text-left">
            <Field label="Shop name" value={form.name} onChange={(v) => set('name', v)} placeholder="e.g. Piękna Moda" />
            <Field label="Category" value={form.category} onChange={(v) => set('category', v)} placeholder="e.g. Fashion & Clothing" />
            <CityField value={form.city} onChange={(v) => set('city', v)} fallback={user?.city} />
          </div>

          <button
            onClick={createShop}
            disabled={saving || !form.name.trim()}
            className="w-full mt-5 py-3 rounded-xl bg-[#CDFF00] text-black font-black text-xs uppercase tracking-widest hover:bg-[#d9ff33] active:scale-[0.99] transition-all disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</> : <><Plus className="w-4 h-4" /> Create shop</>}
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
        <div className="relative h-32 bg-black">
          <SmartImage
            src={uploadUrl(form.bannerUrl)}
            alt=""
            fallbackIcon={Store}
            className="w-full h-full object-cover opacity-80"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] to-transparent" />
          <div
            className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-40"
            style={{ background: form.accentColor }}
          />
          <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 truncate">
                {form.category || 'No category'} · {form.city || 'No city'}
              </p>
              <h3 className="text-lg font-black text-white uppercase tracking-tight truncate">
                {form.name || 'Untitled shop'}
              </h3>
            </div>
            <Link
              to={`/shop/${shop.slug || shop.id}`}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/70 border border-white/20 text-[9px] font-black uppercase tracking-widest text-white hover:border-white/40 transition-colors"
            >
              <ExternalLink className="w-3 h-3" /> View
            </Link>
          </div>
        </div>

        {/* Read-only stats — derived from real reviews and listings, not editable here */}
        <div className="flex items-center gap-4 px-4 py-2.5 border-t border-white/5 text-[9px] font-black uppercase tracking-widest text-gray-500">
          <span>{shop.rating > 0 ? `${shop.rating.toFixed(1)}★` : 'No rating yet'}</span>
          <span>{shop.reviewCount} reviews</span>
          <span>{products.length} products</span>
          <span>{shop.listingCount} listings</span>
          <span className={`ml-auto flex items-center gap-1 ${form.published ? 'text-[#CDFF00]' : 'text-gray-500'}`}>
            {form.published ? <><Eye className="w-3 h-3" /> Live</> : <><EyeOff className="w-3 h-3" /> Hidden</>}
          </span>
        </div>
      </div>

      {/* ── Shop details ── */}
      <div className="glass rounded-2xl p-4 border border-white/5 space-y-3">
        <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-500">Storefront details</h4>

        <div className="grid sm:grid-cols-2 gap-2.5">
          <Field label="Shop name" value={form.name} onChange={(v) => set('name', v)} />
          <Field label="Category" value={form.category} onChange={(v) => set('category', v)} placeholder="e.g. Beauty & Skincare" />
        </div>

        <Field label="Tagline" value={form.tagline} onChange={(v) => set('tagline', v)} placeholder="One line buyers see on your card" maxLength={160} />

        <div>
          <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1.5">About your shop</label>
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
          <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1.5">Banner image</label>
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => bannerInput.current?.click()}
              disabled={uploadingBanner}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-bold hover:border-white/30 transition-colors disabled:opacity-60"
            >
              {uploadingBanner ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
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
          <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1.5">
            <Palette className="w-3 h-3" /> Accent colour
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
            className="flex-1 py-2.5 rounded-xl bg-[#CDFF00] text-black font-black text-xs uppercase tracking-widest hover:bg-[#d9ff33] active:scale-[0.99] transition-all disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : dirty ? <><Check className="w-4 h-4" /> Save changes</> : 'Saved'}
          </button>
          <button
            onClick={deleteShop}
            className="px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-black uppercase tracking-widest hover:bg-red-500/20 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Products ── */}
      <div className="glass rounded-2xl p-4 border border-white/5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-500">
            Products <span className="text-gray-600">({products.length})</span>
          </h4>
          <button
            onClick={() => setEditingProduct('new')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#CDFF00] text-black text-[9px] font-black uppercase tracking-widest hover:bg-[#d9ff33] active:scale-95 transition-all"
          >
            <Plus className="w-3.5 h-3.5" /> Add product
          </button>
        </div>

        {products.length === 0 ? (
          <div className="text-center py-8 rounded-xl border border-dashed border-white/10">
            <Package className="w-8 h-8 mx-auto text-white/15 mb-2" />
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
                    <SmartImage src={p.imageUrl} alt={p.name} fallbackIcon={Package} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{p.name}</p>
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                      {p.category || 'Uncategorised'} · <span className="text-[#CDFF00]">{formatPrice(p.price, p.currency)}</span>
                    </p>
                  </div>
                  <button
                    onClick={() => setEditingProduct(p)}
                    className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors shrink-0"
                    aria-label={`Edit ${p.name}`}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => deleteProduct(p.id)}
                    className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-colors shrink-0"
                    aria-label={`Delete ${p.name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
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
          <h3 className="text-sm font-black text-white uppercase tracking-tight">
            {isNew ? 'Add product' : 'Edit product'}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2.5">
          <Field label="Name" value={form.name} onChange={(v) => set('name', v)} placeholder="e.g. Oversized Graphic Tee" />

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1.5">Description</label>
            <textarea
              rows={2}
              value={form.description || ''}
              onChange={(e) => set('description', e.target.value)}
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-[#CDFF00] resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1.5">Price</label>
              <input
                type="number" min="0" step="0.01"
                value={form.price}
                onChange={(e) => set('price', e.target.value)}
                className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-[#CDFF00]"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1.5">Currency</label>
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
            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1.5">
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
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1.5">
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
            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1.5">Photo</label>
            <div className="flex items-center gap-2.5">
              <div className="w-14 h-14 rounded-lg overflow-hidden bg-black border border-white/10 shrink-0">
                <SmartImage src={form.imageUrl} alt="" fallbackIcon={Package} className="w-full h-full object-cover" />
              </div>
              <button
                onClick={() => fileInput.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-bold hover:border-white/30 transition-colors disabled:opacity-60"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
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
          className="w-full mt-5 py-2.5 rounded-xl bg-[#CDFF00] text-black font-black text-xs uppercase tracking-widest hover:bg-[#d9ff33] active:scale-[0.99] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><Check className="w-4 h-4" /> {isNew ? 'Add to shop' : 'Save changes'}</>}
        </button>
      </motion.div>
    </div>
  );
}

/* ── Small shared inputs ── */
function Field({ label, value, onChange, placeholder, maxLength }) {
  return (
    <div>
      <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1.5">{label}</label>
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
      <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1.5">City</label>
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
