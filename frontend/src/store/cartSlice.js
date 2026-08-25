import { createSlice } from '@reduxjs/toolkit';
import { logout } from './authSlice';
import { CART_KEY } from '../utils/session';

const loadSaved = () => {
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const persist = (items) => {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  } catch {}
};

const cartSlice = createSlice({
  name: 'cart',
  initialState: { items: loadSaved(), open: false },
  reducers: {
    addToCart(state, { payload }) {
      const existing = state.items.find((i) => i.listingId === payload.listingId);
      if (existing) {
        existing.quantity += 1;
      } else {
        state.items.push({ ...payload, quantity: payload.quantity ?? 1 });
      }
      state.open = true;
      persist(state.items);
    },
    removeFromCart(state, { payload }) {
      state.items = state.items.filter((i) => i.listingId !== payload);
      persist(state.items);
    },
    updateQuantity(state, { payload: { listingId, quantity } }) {
      const item = state.items.find((i) => i.listingId === listingId);
      if (item) item.quantity = Math.max(1, quantity);
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
    (acc, i) => acc + (i.negotiatedPrice ?? i.price) * i.quantity,
    0
  );

export default cartSlice.reducer;
