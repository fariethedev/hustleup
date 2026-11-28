import React, { useEffect, useState } from 'react';
import { Keyboard, LayoutAnimation, Platform, Pressable, StyleSheet, Text, UIManager, View } from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) UIManager.setLayoutAnimationEnabledExperimental(true);
import { usePathname, useRouter } from 'expo-router';
import { Feather } from './Icon';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { directMessagesApi } from '../../api/client';
import { usePalette } from '../../theme/ThemeProvider';

// Same destinations, names, order and icons as the website's bottom bar (Navbar.jsx):
// Home, Explore, Feed, Messages, then More.
const tabs = [
  ['/', '/(tabs)', 'home', 'Home'],
  ['/explore', '/(tabs)/explore', 'compass', 'Explore'],
  ['/feed', '/(tabs)/feed', 'layers', 'Feed'],
  ['/messages', '/(tabs)/messages', 'send', 'Messages'],
  ['/more', '/(tabs)/more', 'layout-grid', 'More'],
];

/**
 * Floating, frosted-glass navigation pill. It sits above the content with a soft shadow and
 * translucent fill so the page shows through, keeps a short label under every icon so each
 * destination is obvious, and the current tab opens into a lime pill with its label. Screens reserve
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
        width: '100%', maxWidth: 420, height: 62, borderRadius: 31, overflow: 'hidden',
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, gap: 2,
        backgroundColor: c.light ? '#FFFFFFB3' : '#1B1B1FB3', borderWidth: 1, borderColor: c.light ? '#FFFFFFE6' : '#FFFFFF1F',
        shadowColor: '#1F2A12', shadowOpacity: 0.16, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 14,
      }}>
        <BlurView tint={c.light ? "systemChromeMaterialLight" : "systemChromeMaterialDark"} intensity={70} blurMethod="dimezisBlurViewSdk31Plus" style={StyleSheet.absoluteFill} />
        {tabs.map(([match, route, icon, label]) => {
          const selected = path === match;
          const badge = route === '/(tabs)/messages' && authenticated && unread > 0;
          return (
            <Pressable key={route} accessibilityRole="tab" accessibilityLabel={badge ? `${label}, ${unread} unread` : label}
              accessibilityState={{ selected }} onPress={() => { if (!selected) LayoutAnimation.configureNext(LayoutAnimation.create(180, 'easeInEaseOut', 'opacity')); router.navigate(route); }} hitSlop={4}
              style={({ pressed }) => ({ flex: selected ? 2.3 : 1, height: 50, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, height: 46, paddingHorizontal: selected ? 14 : 0, minWidth: 46, borderRadius: 23,
                backgroundColor: selected ? c.lime : 'transparent' }}>
                <View>
                  <Feather name={icon} size={20} color={selected ? '#151A00' : c.muted} />
                  {badge && (
                    <View style={{ position: 'absolute', top: -7, right: -10, minWidth: 17, height: 17, paddingHorizontal: 4, borderRadius: 9, backgroundColor: c.danger, borderWidth: 2, borderColor: c.card, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: '#FFFFFF', fontSize: 9, fontWeight: '800' }}>{unread > 9 ? '9+' : unread}</Text>
                    </View>
                  )}
                </View>
                {selected && <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '800', color: c.onLime }}>{label}</Text>}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
