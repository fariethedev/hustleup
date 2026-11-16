import React, { useEffect, useState } from 'react';
import { Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { directMessagesApi } from '../../api/client';

const links = [
  ['/plans', 'star', 'Membership plans'],
  ['/leaderboard', 'award', 'Leaderboards'],
  ['/dashboard', 'grid', 'Dashboard'], ['/tickets', 'calendar', 'My tickets'],
  ['/profile/bank', 'credit-card', 'Bank & payouts'], ['/profile/sales', 'shopping-bag', 'My sales'],
  ['/profile/listings', 'plus-square', 'My listings'], ['/profile/settings', 'settings', 'Settings'],
  ['/profile/reviews', 'star', 'Reviews'],
  ['/(tabs)/bond', 'heart', 'Bond'], ['/jobs', 'briefcase', 'Jobs & Gigs'], ['/news', 'book-open', 'Campus News'],
];
const tabs = [['/', '/(tabs)', 'home', 'Home'], ['/explore', '/(tabs)/explore', 'compass', 'Explore'], ['/feed', '/(tabs)/feed', 'layers', 'Feed'], ['/messages', '/(tabs)/messages', 'send', 'Messages']];
export default function FloatingNav() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const path = usePathname();
  const authenticated = useSelector(s => s.auth.isAuthenticated);
  const light = useColorScheme() === 'light';
  const [open, setOpen] = useState(false);
  const [keyboard, setKeyboard] = useState(false);
  const [unread, setUnread] = useState(0);
  const fg = light ? '#171717' : '#D0D0D0';
  const panel = light ? '#FFFFFF' : '#0A0A0A';
  const accent = light ? '#526B00' : '#CDFF00';
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
  const navigate = route => { setOpen(false); router.navigate(route); };
  if (keyboard) return null;
  return <>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}><View style={{ flex: 1, justifyContent: 'flex-end', alignItems: 'center' }}><Pressable accessibilityLabel="Close navigation menu" onPress={() => setOpen(false)} style={[StyleSheet.absoluteFill, { backgroundColor: '#0006' }]} /><ScrollView style={{ maxHeight: '65%', width: 230, marginBottom: insets.bottom + 82, borderRadius: 20, backgroundColor: panel, borderWidth: 1, borderColor: light ? '#DDD' : '#333' }} contentContainerStyle={{ padding: 8 }}>{links.map(([route, icon, label]) => <Pressable key={route} accessibilityRole="button" onPress={() => navigate(route)} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', minHeight: 48, paddingHorizontal: 12 }}><Feather name={icon} size={18} color={icon === 'heart' ? '#C63CBD' : fg} /><Text style={{ color: fg, fontFamily: 'Poppins_600SemiBold', fontSize: 12 }}>{label}</Text></Pressable>)}</ScrollView></View></Modal>
    <View pointerEvents="box-none" style={{ position: 'absolute', bottom: insets.bottom + 8, left: 12, right: 12, alignItems: 'center' }}><View style={{ width: '100%', maxWidth: 310, height: 56, borderRadius: 30, overflow: 'hidden', backgroundColor: panel, borderWidth: 1, borderColor: light ? '#D4D4D4' : '#FFFFFF26', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingHorizontal: 4, elevation: 20, shadowOpacity: 0.25, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } }}><BlurView tint={light ? 'light' : 'dark'} intensity={80} style={StyleSheet.absoluteFill} />{tabs.map(([match, route, icon, label]) => <Pressable key={route} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: path === match }} onPress={() => navigate(route)} style={{ width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: path === match ? light ? '#0000000D' : '#FFFFFF19' : 'transparent' }}><Feather name={icon} size={22} color={path === match ? accent : fg} />{icon === 'send' && authenticated && unread > 0 && <View style={{ position: 'absolute', top: 1, right: 1, borderRadius: 9, backgroundColor: '#D000D0', paddingHorizontal: 4 }}><Text style={{ color: '#FFF', fontSize: 9 }}>{unread > 9 ? '9+' : unread}</Text></View>}</Pressable>)}<Pressable accessibilityRole="button" accessibilityLabel="More features" accessibilityState={{ expanded: open }} onPress={() => setOpen(true)} style={{ width: 46, height: 46, alignItems: 'center', justifyContent: 'center' }}><Feather name="grid" size={22} color={open ? accent : fg} /></Pressable></View></View>
  </>;
}
