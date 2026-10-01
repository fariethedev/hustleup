import { createSlice } from '@reduxjs/toolkit';
import { logout } from './authSlice';
import { CART_KEY } from '../utils/session';

const positiveQuantity = (value) => {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? Math.min(number, 999) : 1;
};

const normalizeItem = (item) => {
  if (!item || typeof item !== 'object' || item.listingId == null) return null;
  const price = Number(item.price);
  if (!String(item.listingId).trim() || !Number.isFinite(price) || price < 0) return null;
  // Offers are negotiated through bookings. A local price cannot authorize a discount.
  const line = { ...item };
  delete line.negotiatedPrice;
  return { ...line, listingId: String(item.listingId), price, quantity: positiveQuantity(item.quantity) };
};

export const isStorefrontItem = (item) => String(item.listingId).startsWith('shop:');
export const shopItemCheckoutPath = (item) => {
  const [, shopId, productId] = String(item.listingId).split(':');
  return `/shop/${encodeURIComponent(item.shopSlug || shopId)}/product/${encodeURIComponent(item.productId || productId)}/checkout`;
};

const loadSaved = () => {
  try {
    const raw = localStorage.getItem(CART_KEY);
    const saved = raw ? JSON.parse(raw) : [];
    return Array.isArray(saved) ? saved.map(normalizeItem).filter(Boolean) : [];
  } catch {
    return [];
  }
};

const persist = (items) => {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  } catch { /* Keep the in-memory basket usable when storage is unavailable. */ }
};

const cartSlice = createSlice({
  name: 'cart',
  initialState: { items: loadSaved(), open: false },
  reducers: {
    addToCart(state, { payload }) {
      const line = normalizeItem(payload);
      if (!line) return;
      const existing = state.items.find((i) => i.listingId === line.listingId);
      if (existing) {
        Object.assign(existing, line, { quantity: Math.min(999, existing.quantity + line.quantity) });
      } else {
        state.items.push(line);
      }
      state.open = true;
      persist(state.items);
    },
    removeFromCart(state, { payload }) {
      state.items = state.items.filter((i) => i.listingId !== String(payload));
      persist(state.items);
    },
    updateQuantity(state, { payload: { listingId, quantity } }) {
      const item = state.items.find((i) => i.listingId === String(listingId));
      if (item) item.quantity = positiveQuantity(quantity);
      persist(state.items);
    },
    setNegotiatedPrice(state, { payload: { listingId, price } }) {
      const item = state.items.find((i) => i.listingId === listingId);
      if (item) item.negotiatedPrice = price;
      persist(state.items);
    },
    clearCart(state) {
      state.items = [];
      persist([]);
    },
    openCart(state) {
      state.open = true;
    },
    closeCart(state) {
      state.open = false;
    },
  },
  extraReducers: (builder) => {
    // A basket belongs to the person who filled it. Signing out has to empty the live store
    // too, not just storage: without this the drawer keeps showing the previous user's items
    // until something forces a full page reload, and whoever signs in next inherits them.
    // Returning a literal rather than the slice's initialState matters — initialState was
    // read from localStorage when the module loaded, so it still holds the old items.
    builder.addCase(logout, () => ({ items: [], open: false }));
  },
});

export const {
  addToCart,
  removeFromCart,
  updateQuantity,
  setNegotiatedPrice,
  clearCart,
  openCart,
  closeCart,
} = cartSlice.actions;

export const selectCartItems = (s) => s.cart.items;
export const selectCartOpen = (s) => s.cart.open;
export const selectCartCount = (s) =>
  s.cart.items.reduce((acc, i) => acc + i.quantity, 0);
export const selectCartTotal = (s) =>
  s.cart.items.reduce(
    (acc, i) => acc + i.price * i.quantity,
    0
  );

/**
 * Postage across the basket.
 *
 * Deliberately NOT multiplied by quantity: a seller's shipping price is what it costs to
 * send one order, and someone taking three of an item is not posted three parcels. The
 * server does the same sum when it builds the Stripe session, so what the cart shows is
 * what gets charged.
 *
 * Kept out of {@link selectCartTotal} so the checkout can show goods and delivery as two
 * lines — a single blended number is exactly what makes people suspect a hidden fee.
 */
export const selectCartShipping = (s) =>
  s.cart.items.reduce((acc, i) => acc + (Number(i.shippingPrice) || 0), 0);

export default cartSlice.reducer;
