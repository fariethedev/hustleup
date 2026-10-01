import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSelector } from 'react-redux';
import { addCartItem, cartKey } from '../utils/marketplace';

const CartContext = createContext(null);
const emptyCart = () => ({ items: [], sessions: {} });

function AccountCart({ accountId, children }) {
  const [cart, setCart] = useState(emptyCart);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState('');
  const current = useRef(cart);
  const writes = useRef(Promise.resolve());
  const key = `hustleup_cart_v1:${accountId}`;

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(key).then(raw => {
      const value = raw ? JSON.parse(raw) : emptyCart();
      if (active && Array.isArray(value.items)) {
        current.current = { items: value.items, sessions: value.sessions || {} };
        setCart(current.current);
      }
    }).catch(() => { if (active) setStorageError('Could not restore your cart.'); })
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, [key]);

  const update = useCallback((change) => {
    if (!ready) return;
    const next = change(current.current);
    current.current = next;
    setCart(next);
    writes.current = writes.current.catch(() => {}).then(() => AsyncStorage.setItem(key, JSON.stringify(next)));
    writes.current.then(() => setStorageError('')).catch(() => setStorageError('Cart changes could not be saved on this device.'));
  }, [key, ready]);

  const add = (item) => update(state => ({ ...state, items: addCartItem(state.items, item) }));
  const quantity = (item, count) => update(state => ({ ...state, items: count <= 0
    ? state.items.filter(row => cartKey(row) !== cartKey(item))
    : state.items.map(row => cartKey(row) === cartKey(item) ? { ...row, quantity: Math.min(99, count) } : row) }));
  const saveSession = (group, session) => update(state => ({ ...state, sessions: { ...state.sessions, [group]: session } }));
  const finishSession = (group) => update(state => {
    const session = state.sessions[group];
    const sessions = { ...state.sessions };
    delete sessions[group];
    return { sessions, items: state.items.filter(item => !session?.keys.includes(cartKey(item))) };
  });

  return <CartContext.Provider value={{ ...cart, ready, storageError, add, quantity, saveSession, finishSession }}>{children}</CartContext.Provider>;
}

export default function CartProvider({ children }) {
  const accountId = useSelector(state => state.auth.user?.id) || 'guest';
  return <AccountCart key={accountId} accountId={accountId}>{children}</AccountCart>;
}

export const useCart = () => useContext(CartContext);
