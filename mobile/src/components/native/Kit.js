import React from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import Svg, { Circle, Defs, Pattern, Rect } from 'react-native-svg';
import { useCart } from '../../store/CartProvider';
import { mediaUrl } from '../../utils/media';
import FloatingNav from './FloatingNav';

export const LIME = '#CDFF00';
export const fonts = { body: 'Poppins_400Regular', medium: 'Poppins_600SemiBold', heading: 'Montserrat_800ExtraBold' };
export function usePalette() {
  return useColorScheme() === 'light'
    ? { bg: '#F7F7F5', card: '#FFFFFF', text: '#0E0E10', muted: '#61616B', line: '#DEDEE1', accent: '#526B00', soft: '#EDEDEB', light: true }
    : { bg: '#050505', card: '#111111', text: '#FFFFFF', muted: '#9CA3AF', line: '#292929', accent: LIME, soft: '#1C1C1C', light: false };
}
export function Copy({ children, style, heading, muted, ...props }) {
  const c = usePalette();
  return <Text {...props} style={[{ color: muted ? c.muted : c.text, fontFamily: heading ? fonts.heading : fonts.body, fontSize: 14, lineHeight: 22 }, style]}>{children}</Text>;
}
export function Dots() {
  const c = usePalette();
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}><Svg width="100%" height="100%"><Defs><Pattern id="dots" width="40" height="40" patternUnits="userSpaceOnUse"><Circle cx="10" cy="10" r="2" fill={c.accent} opacity={0.13} /><Circle cx="30" cy="30" r="2" fill={c.accent} opacity={0.07} /></Pattern></Defs><Rect width="100%" height="100%" fill="url(#dots)" /></Svg></View>;
}
export function IconButton({ icon, label, onPress, badge }) {
  const c = usePalette();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={k.icon}><Feather name={icon} size={21} color={c.text} />{badge > 0 && <View style={k.badge}><Text style={{ color: '#050505', fontSize: 9 }}>{badge > 9 ? '9+' : badge}</Text></View>}</Pressable>;
}
export function Header({ back, title }) {
  const router = useRouter();
  const user = useSelector(s => s.auth.user);
  const { items } = useCart();
  const c = usePalette();
  return <View style={[k.header, { borderColor: c.line }]}>
    {back ? <><IconButton icon="arrow-left" label="Go back" onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} /><Copy heading style={{ flex: 1, fontSize: 17 }}>{title}</Copy></> : <Pressable accessibilityLabel="HustleSpace home" onPress={() => router.push('/(tabs)')} style={{ flex: 1 }}><Copy heading style={{ fontSize: 19 }}>Hustle<Text style={{ color: c.accent }}>Space</Text></Copy></Pressable>}
    {!back && <IconButton icon="search" label="Search marketplace" onPress={() => router.push('/(tabs)/explore')} />}
    <IconButton icon="bell" label="Notifications" onPress={() => router.push('/notifications')} />
    <IconButton icon="shopping-bag" label="Shopping cart" badge={items.reduce((n, item) => n + item.quantity, 0)} onPress={() => router.push('/cart')} />
    {!back && <Pressable accessibilityRole="button" accessibilityLabel={user ? 'Your profile' : 'Sign in'} onPress={() => router.push(user ? '/(tabs)/profile' : '/login')} style={k.icon}>{user?.avatarUrl ? <Image source={{ uri: mediaUrl(user.avatarUrl) }} style={{ width: 30, height: 30, borderRadius: 15 }} /> : <Feather name="user" size={21} color={c.text} />}</Pressable>}
  </View>;
}
export function Screen({ children, back, title, scroll = true, refreshControl, showHeader = true }) {
  const c = usePalette();
  return <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: c.bg }}><Dots />{showHeader && <Header back={back} title={title} />}{scroll ? <ScrollView keyboardShouldPersistTaps="handled" refreshControl={refreshControl} contentContainerStyle={k.content}>{children}</ScrollView> : children}{back && <FloatingNav />}</SafeAreaView>;
}
export function Button({ children, onPress, icon, secondary, disabled, busy, style }) {
  const c = usePalette();
  return <Pressable accessibilityRole="button" disabled={disabled || busy} onPress={onPress} style={[k.button, { backgroundColor: secondary ? c.card : LIME, borderColor: secondary ? c.line : '#718E00', opacity: disabled || busy ? 0.55 : 1 }, style]}>{busy ? <ActivityIndicator color={secondary ? c.text : '#050505'} /> : React.isValidElement(icon) ? icon : icon ? <Feather name={icon} size={18} color={secondary ? c.text : '#050505'} /> : null}<Copy style={{ color: secondary ? c.text : '#050505', fontFamily: fonts.medium, fontSize: 13 }}>{children}</Copy></Pressable>;
}
export function Panel({ children, style }) {
  const c = usePalette();
  return <View style={[k.panel, { backgroundColor: c.card, borderColor: c.line }, style]}>{children}</View>;
}
export function Section({ eyebrow, title, subtitle, action, onAction }) {
  const c = usePalette();
  return <View style={{ gap: 7, marginTop: 18, marginBottom: 16 }}>{eyebrow && <Copy style={{ color: c.accent, fontFamily: fonts.medium, fontSize: 12 }}>{eyebrow}</Copy>}<View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Copy heading style={{ fontSize: 25, lineHeight: 31, flex: 1 }}>{title}</Copy>{action && <Pressable onPress={onAction} style={{ minHeight: 44, justifyContent: 'center' }}><Copy style={{ color: c.accent, fontSize: 12 }}>{action} →</Copy></Pressable>}</View>{subtitle && <Copy muted>{subtitle}</Copy>}</View>;
}
export function Notice({ message, onRetry, loading }) {
  const c = usePalette();
  return <Panel style={{ alignItems: 'center', gap: 12 }}>{loading ? <ActivityIndicator color={c.accent} /> : <Feather name="info" size={22} color={c.muted} />}<Copy muted style={{ textAlign: 'center' }}>{message}</Copy>{onRetry && <Button secondary onPress={onRetry}>Try again</Button>}</Panel>;
}
export const k = StyleSheet.create({
  content: { padding: 20, paddingBottom: 130, gap: 16 },
  header: { height: 56, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  icon: { width: 42, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', right: 0, top: 2, borderRadius: 10, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: LIME },
  button: { minHeight: 48, paddingHorizontal: 17, paddingVertical: 10, borderRadius: 24, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  panel: { padding: 18, borderRadius: 24, borderWidth: 1, gap: 10 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, fontFamily: fonts.body, fontSize: 16 },
});
