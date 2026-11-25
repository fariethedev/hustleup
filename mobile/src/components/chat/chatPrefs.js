import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Per-device chat preferences, WhatsApp-style: pinned, muted and archived chats, "clear chat",
 * "delete chat" and "delete for me". These are personal views of a conversation that the other
 * person must never be affected by, so they live on the device rather than the server.
 */
const empty = () => ({ pinned: {}, muted: {}, archived: {}, cleared: {}, deleted: {}, hiddenMessages: {} });

export function useChatPrefs(userId) {
  const key = `hustlespace_chat_prefs_v1:${userId || 'guest'}`;
  const [prefs, setPrefs] = useState(empty);
  const current = useRef(prefs);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(key)
      .then(raw => {
        if (!active) return;
        const value = raw ? { ...empty(), ...JSON.parse(raw) } : empty();
        current.current = value;
        setPrefs(value);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [key]);

  const update = useCallback((change) => {
    const next = change(current.current);
    current.current = next;
    setPrefs(next);
    AsyncStorage.setItem(key, JSON.stringify(next)).catch(() => {});
  }, [key]);

  const toggle = useCallback((bucket, id, value = Date.now()) => update(p => {
    const copy = { ...p[bucket] };
    if (copy[id]) delete copy[id]; else copy[id] = value;
    return { ...p, [bucket]: copy };
  }), [update]);

  return {
    prefs,
    togglePin: id => toggle('pinned', id),
    toggleMute: id => toggle('muted', id),
    toggleArchive: id => toggle('archived', id),
    clearChat: id => update(p => ({ ...p, cleared: { ...p.cleared, [id]: new Date().toISOString() } })),
    deleteChat: id => update(p => ({
      ...p,
      cleared: { ...p.cleared, [id]: new Date().toISOString() },
      deleted: { ...p.deleted, [id]: new Date().toISOString() },
    })),
    hideMessage: msgId => update(p => ({ ...p, hiddenMessages: { ...p.hiddenMessages, [msgId]: true } })),
  };
}

/** A deleted chat comes back as soon as a newer message arrives, as in WhatsApp. */
export function chatVisible(prefs, partner) {
  const deletedAt = prefs.deleted[partner.id];
  if (!deletedAt) return true;
  return !!partner.lastMessageAt && new Date(partner.lastMessageAt) > new Date(deletedAt);
}

export function messageVisible(prefs, partnerId, message) {
  if (prefs.hiddenMessages[message.id]) return false;
  const clearedAt = prefs.cleared[partnerId];
  return !clearedAt || !message.createdAt || new Date(message.createdAt) > new Date(clearedAt);
}
