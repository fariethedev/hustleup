import React, { useEffect, useState } from 'react';
import { Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text, View, useColorScheme, useWindowDimensions } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { directMessagesApi } from '../../api/client';

const links = [
  { route: 'profile', icon: 'user', label: 'My profile' },
  { route: '/cart', icon: 'shopping-bag', label: 'Cart' },
  { route: '/profile/orders', icon: 'package', label: 'My orders' },
  { route: '/(tabs)/messages', icon: 'send', label: 'Messages' },
  { route: '/notifications', icon: 'bell', label: 'Notifications' },
  { route: '/shop/manage', icon: 'shopping-bag', label: 'My shop' },
  { route: '/swaps', icon: 'repeat', label: 'Swaps' },
  { route: '/dashboard', icon: 'grid', label: 'Dashboard' },
  { route: '/leaderboard', icon: 'award', label: 'Leaderboards' },
  { route: '/bond', icon: 'heart', label: 'Bond' },
  { route: '/profile/settings', icon: 'settings', label: 'Settings' },
  { group: 'editorial', icon: 'briefcase', label: 'Jobs & news', children: [
    ['/jobs', 'briefcase', 'Jobs & gigs'],
    ['/news', 'book-open', 'Campus news'],
  ] },
];
const tabs = [['/', '/(tabs)', 'home', 'Home'], ['/explore', '/(tabs)/explore', 'compass', 'Explore'], ['/feed', '/(tabs)/feed', 'layers', 'Feed']];
export default function FloatingNav() {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const router = useRouter();
  const path = usePathname();
  const authenticated = useSelector(s => s.auth.isAuthenticated);
  const light = useColorScheme() === 'light';
  const [open, setOpen] = useState(false);
  const [editorialOpen, setEditorialOpen] = useState(false);
  const [keyboard, setKeyboard] = useState(false);
  const [unread, setUnread] = useState(0);
  const me = useSelector(s => s.auth.user);
  const fg = light ? '#171717' : '#D0D0D0';
  const panel = light ? '#FFFFFF' : '#0A0A0A';
  // The bar is translucent so the BlurView behind the icons shows through (frosted glass);
  // a solid fill here would hide the blur entirely.
  const glass = light ? '#FFFFFF8C' : '#14141473';
  const glassEdge = light ? '#FFFFFFCC' : '#FFFFFF2E';
  const activeFill = light ? '#7C3AED1F' : '#8B5CF638';
  const accent = light ? '#526B00' : '#CDFF00';
  const menuContentHeight = 16 + links.reduce((height, item) => height + (item.children
    ? 48 + (editorialOpen ? item.children.length * 42 : 0)
    : 48), 0);
  const menuAvailableHeight = Math.max(160, windowHeight - insets.bottom - 112);
  const menuHeight = Math.min(menuContentHeight, menuAvailableHeight);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboard(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboard(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  useEffect(() => {
    if (!authenticated) return;
    let active = true;
    const load = async () => { try { const { data } = await directMessagesApi.getPartners(); if (active && Array.isArray(data)) setUnread(data.reduce((n, p) => n + (Number(p.unreadCount) || 0), 0)); } catch { /* A failed badge request must not block navigation. */ } };
    load(); const timer = setInterval(load, 30000);
    return () => { active = false; clearInterval(timer); };
  }, [authenticated, path]);
  const navigate = route => {
    setOpen(false);
    setEditorialOpen(false);
    if (route === 'profile') router.push(me?.id ? `/profile/${me.id}` : '/login');
    else if (route === '/bond') router.push('/bond');
    else router.navigate(route);
  };
  if (keyboard) return null;
  return <>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}><View style={{ flex: 1, justifyContent: 'flex-end', alignItems: 'center' }}><Pressable accessibilityLabel="Close navigation menu" onPress={() => setOpen(false)} style={[StyleSheet.absoluteFill, { backgroundColor: '#0006' }]} /><ScrollView style={{ height: menuHeight, maxHeight: menuAvailableHeight, flexGrow: 0, width: 230, marginBottom: insets.bottom + 72, borderRadius: 20, backgroundColor: panel, borderWidth: 1, borderColor: light ? '#DDD' : '#333' }} contentContainerStyle={{ padding: 8, flexGrow: 0 }}>{links.map(item => item.children ? <View key={item.group}><Pressable accessibilityRole="button" accessibilityState={{ expanded: editorialOpen }} onPress={() => setEditorialOpen(value => !value)} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', minHeight: 48, paddingHorizontal: 12 }}><Feather name={item.icon} size={18} color={fg} /><Text style={{ flex: 1, color: fg, fontFamily: 'Poppins_600SemiBold', fontSize: 12 }}>{item.label}</Text><Feather name={editorialOpen ? 'chevron-up' : 'chevron-down'} size={16} color={fg} /></Pressable>{editorialOpen && item.children.map(([route, icon, label]) => <Pressable key={route} accessibilityRole="button" onPress={() => navigate(route)} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', minHeight: 42, paddingLeft: 42, paddingRight: 12 }}><Feather name={icon} size={16} color={fg} /><Text style={{ color: fg, fontFamily: 'Poppins_400Regular', fontSize: 12 }}>{label}</Text></Pressable>)}</View> : <Pressable key={item.route} accessibilityRole="button" onPress={() => navigate(item.route)} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', minHeight: 48, paddingHorizontal: 12 }}><Feather name={item.icon} size={18} color={item.icon === 'heart' || item.icon === 'award' ? '#8B5CF6' : fg} /><Text style={{ color: fg, fontFamily: 'Poppins_600SemiBold', fontSize: 12 }}>{item.label}</Text></Pressable>)}</ScrollView></View></Modal>
    <View pointerEvents="box-none" style={{ position: 'absolute', bottom: Math.max(insets.bottom, 8) + 10, left: 20, right: 20, alignItems: 'center' }}>
      <View style={{ width: '100%', maxWidth: 340, height: 64, borderRadius: 32, overflow: 'hidden', backgroundColor: glass, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: glassEdge, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, elevation: 12, shadowColor: '#000', shadowOpacity: light ? 0.12 : 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } }}>
        <BlurView tint={light ? 'systemChromeMaterialLight' : 'systemChromeMaterialDark'} intensity={60} blurMethod="dimezisBlurViewSdk31Plus" style={StyleSheet.absoluteFill} />
        {tabs.map(([match, route, icon, label]) => <Pressable key={route} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: path === match }} onPress={() => navigate(route)} hitSlop={6} style={{ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: path === match ? activeFill : 'transparent' }}><Feather name={icon} size={22} color={path === match ? accent : fg} />{icon === 'send' && authenticated && unread > 0 && <View style={{ position: 'absolute', top: 1, right: 1, borderRadius: 9, backgroundColor: '#8B5CF6', paddingHorizontal: 4 }}><Text style={{ color: '#FFF', fontSize: 9 }}>{unread > 9 ? '9+' : unread}</Text></View>}</Pressable>)}
        <Pressable accessibilityRole="button" accessibilityLabel="More features" accessibilityState={{ expanded: open }} onPress={() => setOpen(true)} hitSlop={6} style={{ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: open ? activeFill : 'transparent' }}><Feather name="grid" size={22} color={open ? accent : fg} /></Pressable>
      </View>
    </View>
  </>;
}
