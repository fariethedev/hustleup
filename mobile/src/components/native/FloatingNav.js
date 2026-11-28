import React, { useEffect, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { directMessagesApi } from '../../api/client';
import { usePalette } from '../../theme/ThemeProvider';

const tabs = [
  ['/', '/(tabs)', 'home', 'Home'],
  ['/explore', '/(tabs)/explore', 'search', 'Browse'],
  ['/messages', '/(tabs)/messages', 'message-circle', 'Messages'],
  ['/feed', '/(tabs)/feed', 'users', 'Community'],
  ['/more', '/(tabs)/more', 'menu', 'More'],
];

/**
 * Floating, frosted-glass navigation pill. It sits above the content with a soft shadow and
 * translucent fill so the page shows through, keeps a short label under every icon so each
 * destination is obvious, and marks the current tab with a lime chip. Screens reserve
 * ~150px of bottom padding so nothing hides behind it.
 */
export default function FloatingNav() {
  const c = usePalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const path = usePathname();
  const authenticated = useSelector(s => s.auth.isAuthenticated);
  const [keyboard, setKeyboard] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboard(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboard(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  useEffect(() => {
    if (!authenticated) return undefined;
    let alive = true;
    const load = async () => {
      try {
        const { data } = await directMessagesApi.getPartners();
        if (alive && Array.isArray(data)) setUnread(data.reduce((n, p) => n + (Number(p.unreadCount) || 0), 0));
      } catch { /* a failed badge must never block navigation */ }
    };
    load();
    const timer = setInterval(load, 30000);
    return () => { alive = false; clearInterval(timer); };
  }, [authenticated, path]);

  if (keyboard) return null;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 16, right: 16, bottom: Math.max(insets.bottom, 10) + 8, alignItems: 'center' }}>
      <View accessibilityRole="tablist" style={{
        width: '100%', maxWidth: 420, height: 70, borderRadius: 35, overflow: 'hidden',
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8,
        backgroundColor: c.light ? '#FFFFFFB3' : '#1B1B1FB3', borderWidth: 1, borderColor: c.light ? '#FFFFFFE6' : '#FFFFFF1F',
        shadowColor: '#1F2A12', shadowOpacity: 0.16, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 14,
      }}>
        <BlurView tint={c.light ? "systemChromeMaterialLight" : "systemChromeMaterialDark"} intensity={70} blurMethod="dimezisBlurViewSdk31Plus" style={StyleSheet.absoluteFill} />
        {tabs.map(([match, route, icon, label]) => {
          const selected = path === match;
          const badge = icon === 'message-circle' && authenticated && unread > 0;
          return (
            <Pressable key={route} accessibilityRole="tab" accessibilityLabel={badge ? `${label}, ${unread} unread` : label}
              accessibilityState={{ selected }} onPress={() => router.navigate(route)} hitSlop={4}
              style={({ pressed }) => ({ flex: 1, height: 56, alignItems: 'center', justifyContent: 'center', gap: 3, borderRadius: 28, opacity: pressed ? 0.7 : 1 })}>
              <View style={{ width: 46, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? '#CDFF00' : 'transparent' }}>
                <Feather name={icon} size={20} color={selected ? '#111111' : c.muted} />
                {badge && (
                  <View style={{ position: 'absolute', top: -3, right: 2, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: c.purple, borderWidth: 2, borderColor: c.card, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#FFFFFF', fontSize: 9.5, fontWeight: '800' }}>{unread > 9 ? '9+' : unread}</Text>
                  </View>
                )}
              </View>
              <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: selected ? '700' : '500', color: selected ? c.text : c.muted }}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
