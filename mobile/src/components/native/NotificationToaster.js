import React, { useEffect, useRef, useState } from 'react';
import { Animated, AppState, PanResponder, Pressable, Text, View } from 'react-native';
import { Feather } from './Icon';
import { useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { notificationsApi } from '../../api/client';
import { notificationTarget, typeOf } from '../../utils/notificationRoutes';
import { usePalette } from '../../theme/ThemeProvider';

const POLL_MS = 10000;
const SHOW_MS = 5500;

/**
 * In-app notifications that slide up from the bottom, like the toasts on hustlespace.space.
 * Polls for new unread notifications while the app is open; the first poll only records
 * what already exists so signing in never fires a burst. Tap opens it, swipe down or the
 * cross dismisses it, and it hides itself after a few seconds.
 */
export default function NotificationToaster() {
  const c = usePalette();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const authenticated = useSelector(s => s.auth.isAuthenticated);
  const [current, setCurrent] = useState(null);
  const queue = useRef([]);
  const seen = useRef(new Set());
  const seeded = useRef(false);
  const timer = useRef(null);
  const [y] = useState(() => new Animated.Value(160));

  function hide(after) {
    clearTimeout(timer.current);
    Animated.timing(y, { toValue: 160, duration: 200, useNativeDriver: true }).start(() => {
      setCurrent(null);
      after?.();
    });
  }
  function showNext() {
    const next = queue.current.shift();
    if (!next) return;
    setCurrent(next);
    y.setValue(160);
    Animated.spring(y, { toValue: 0, useNativeDriver: true, friction: 8, tension: 70 }).start();
    clearTimeout(timer.current);
    timer.current = setTimeout(() => hide(showNext), SHOW_MS);
  }
  const showing = useRef(false);
  useEffect(() => { showing.current = !!current; }, [current]);

  useEffect(() => {
    if (!authenticated) { seen.current = new Set(); seeded.current = false; queue.current = []; return undefined; }
    let alive = true;
    const poll = async () => {
      if (AppState.currentState !== 'active') return;
      try {
        const { data } = await notificationsApi.getAll();
        if (!alive || !Array.isArray(data)) return;
        const unread = data.filter(n => !n.read);
        if (!seeded.current) { unread.forEach(n => seen.current.add(n.id)); seeded.current = true; return; }
        const fresh = unread.filter(n => !seen.current.has(n.id)).reverse();
        fresh.forEach(n => seen.current.add(n.id));
        if (!fresh.length) return;
        queue.current.push(...fresh.slice(-3)); // never more than a few in a row
        if (!showing.current) showNext();
      } catch { /* a missed poll just waits for the next one */ }
    };
    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => { alive = false; clearInterval(interval); clearTimeout(timer.current); };
  }, [authenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  const [pan] = useState(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => g.dy > 6,
    onPanResponderMove: (_, g) => { if (g.dy > 0) y.setValue(g.dy); },
    onPanResponderRelease: (_, g) => {
      if (g.dy > 40) handlers.current.dismiss();
      else Animated.spring(y, { toValue: 0, useNativeDriver: true }).start();
    },
  }));
  const handlers = useRef({});
  useEffect(() => { handlers.current.dismiss = () => hide(showNext); });

  if (!current) return null;
  const meta = typeOf(current);
  const open = () => {
    const target = notificationTarget(current);
    const id = current.id;
    hide(showNext);
    notificationsApi.markRead(id).catch(() => {});
    router.push(target || '/notifications');
  };

  return (
    <Animated.View pointerEvents="box-none" {...pan.panHandlers}
      style={{ position: 'absolute', left: 14, right: 14, bottom: Math.max(insets.bottom, 10) + 92, transform: [{ translateY: y }], zIndex: 1000, elevation: 20 }}>
      <Pressable accessibilityRole="button" accessibilityLiveRegion="polite" accessibilityLabel={`${current.title || 'Notification'}. ${current.message || ''}`} onPress={open}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 20, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, opacity: pressed ? 0.92 : 1,
          shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } })}>
        <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: meta.color + '26' }}>
          <Feather name={meta.icon} size={19} color={meta.color === '#CDFF00' ? c.accent : meta.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ color: c.text, fontSize: 15, fontWeight: '800' }}>{current.title || 'New notification'}</Text>
          {!!current.message && <Text numberOfLines={2} style={{ color: c.muted, fontSize: 13, lineHeight: 18 }}>{current.message}</Text>}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Dismiss" onPress={() => hide(showNext)} hitSlop={10}
          style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: c.soft }}>
          <Feather name="x" size={15} color={c.muted} />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}
