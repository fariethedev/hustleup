import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Pattern, Rect } from 'react-native-svg';
import { Feather } from './Icon';
import { useRouter } from 'expo-router';
import { usePalette } from '../../theme/ThemeProvider';
import FloatingNav from './FloatingNav';
import BrandLoader from './BrandLoader';

export { usePalette } from '../../theme/ThemeProvider';
export const LIME = '#CDFF00';
/** Complementary accent: lime leads, purple supports (badges, eyebrows, active states). */
export const PURPLE = '#7D39EB';
export const fonts = { body: 'Poppins_400Regular', medium: 'Poppins_600SemiBold', heading: 'Poppins_600SemiBold' };
export function Copy({ children, style, heading, muted, ...props }) {
  const c = usePalette();
  // A fixed 22px line height clipped the tops of larger text (titles on listings and profiles).
  // When a caller sets a font size without a line height, scale the line height with it.
  const flat = StyleSheet.flatten(style) || {};
  // One type scale across the app: 15px body, nothing under 12px.
  const size = Math.max(12, flat.fontSize || 15);
  const lineHeight = flat.lineHeight && flat.lineHeight >= size * 1.15 ? flat.lineHeight : Math.round(size * (heading ? 1.3 : 1.5));
  return <Text {...props} style={[{ color: muted ? c.muted : c.text, fontFamily: heading ? fonts.heading : fonts.body, fontSize: 15 }, style, { fontSize: size, lineHeight }]}>{children}</Text>;
}
/**
 * The HustleSpace dotted backdrop, the same as the website's body background: two lime dots
 * per 40px tile, fixed behind the content (it does not scroll), fainter on the light theme.
 */
export function Dots() {
  const c = usePalette();
  const [a, b] = c.light ? [0.16, 0.1] : [0.13, 0.07];
  return <Svg pointerEvents="none" style={StyleSheet.absoluteFill}>
    <Defs>
      <Pattern id="hs-dots" width={40} height={40} patternUnits="userSpaceOnUse">
        <Circle cx={10} cy={10} r={2} fill="#B5DC1E" fillOpacity={a} />
        <Circle cx={30} cy={30} r={2} fill="#B5DC1E" fillOpacity={b} />
      </Pattern>
    </Defs>
    <Rect x={0} y={0} width="100%" height="100%" fill="url(#hs-dots)" />
  </Svg>;
}
export function IconButton({ icon, label, onPress, badge }) {
  const c = usePalette();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={k.icon}><Feather name={icon} size={21} color={c.text} />{badge > 0 && <View style={k.badge}><Text style={{ color: '#FFFFFF', fontSize: 9, fontWeight: '700' }}>{badge > 9 ? '9+' : badge}</Text></View>}</Pressable>;
}
/**
 * The one back button used across the app: a 40px circle with an arrow. `overlay` is the
 * translucent variant for headers that sit on top of a photo.
 */
export function BackButton({ onPress, fallback = '/(tabs)', label = 'Go back', overlay, style }) {
  const router = useRouter();
  const c = usePalette();
  const go = onPress || (() => (router.canGoBack() ? router.back() : router.replace(fallback)));
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={go} hitSlop={6}
    style={({ pressed }) => [{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: overlay ? '#00000066' : c.card, borderWidth: overlay ? 0 : 1, borderColor: c.line, opacity: pressed ? 0.7 : 1 }, style]}>
    <Feather name="arrow-left" size={20} color={overlay ? '#FFFFFF' : c.text} />
  </Pressable>;
}
/**
 * Slim bar for inner pages: a round back button and the page title. Main screens have no top
 * bar — search lives in Explore, the bell and your avatar on Home, and the cart in the bottom bar.
 */
export function Header({ back, title }) {
  if (!back) return null;
  return <View style={[k.header, { borderBottomWidth: 0, gap: 10 }]}>
    <BackButton />
    <Copy heading numberOfLines={1} style={{ flex: 1, fontSize: 18 }} accessibilityRole="header">{title}</Copy>
  </View>;
}
export function Screen({ children, back, title, scroll = true, refreshControl, showHeader = true }) {
  const c = usePalette();
  return <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: c.bg }}><Dots />{showHeader && <Header back={back} title={title} />}{scroll ? <ScrollView keyboardShouldPersistTaps="handled" refreshControl={refreshControl} contentContainerStyle={k.content}>{children}</ScrollView> : children}{back && <FloatingNav />}</SafeAreaView>;
}
export function Button({ children, onPress, icon, secondary, purple, disabled, busy, style }) {
  const c = usePalette();
  const fg = purple ? (c.light ? '#FFFFFF' : '#211435') : secondary ? c.text : '#152005';
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!(disabled || busy), busy: !!busy }} disabled={disabled || busy} onPress={onPress} style={({ pressed }) => [k.button, { backgroundColor: purple ? c.purple : secondary ? c.card : LIME, borderColor: purple ? c.purple : secondary ? c.line : '#718E00', opacity: disabled || busy ? 0.55 : pressed ? 0.82 : 1, transform: [{ scale: pressed && !disabled && !busy ? 0.985 : 1 }] }, style]}>{busy ? <ActivityIndicator color={fg} /> : React.isValidElement(icon) ? icon : icon ? <Feather name={icon} size={18} color={fg} /> : null}<Copy style={{ color: fg, fontFamily: fonts.medium, fontSize: 15, textAlign: 'center', flexShrink: 1 }}>{children}</Copy></Pressable>;
}
export function Panel({ children, style }) {
  const c = usePalette();
  return <View style={[k.panel, { backgroundColor: c.card, borderColor: c.line }, style]}>{children}</View>;
}
export function Section({ eyebrow, title, subtitle, action, onAction }) {
  const c = usePalette();
  return <View style={{ gap: 4, marginTop: 14, marginBottom: 12 }}>{eyebrow && <Copy style={{ color: c.purple, fontFamily: fonts.medium, fontSize: 12, letterSpacing: 0.4 }}>{eyebrow}</Copy>}<View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Copy heading style={{ fontSize: 22, flex: 1 }}>{title}</Copy>{action && <Pressable accessibilityRole="button" accessibilityLabel={`${action}: ${title}`} onPress={onAction} style={{ minHeight: 48, paddingHorizontal: 8, justifyContent: 'center' }}><Copy style={{ color: c.purple, fontSize: 15, fontFamily: fonts.medium }}>{action}</Copy></Pressable>}</View>{subtitle && <Copy muted>{subtitle}</Copy>}</View>;
}
export function Notice({ message, onRetry, loading }) {
  const c = usePalette();
  return <Panel style={{ alignItems: 'center', gap: 12 }}>{loading ? <BrandLoader compact label={message} /> : <Feather name="info" size={22} color={c.purple} />}<Copy muted style={{ textAlign: 'center' }}>{message}</Copy>{onRetry && <Button secondary onPress={onRetry}>Try again</Button>}</Panel>;
}
export const k = StyleSheet.create({
  content: { padding: 20, paddingBottom: 150, gap: 16 },
  header: { minHeight: 64, paddingVertical: 8, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  icon: { width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', right: 0, top: 2, borderRadius: 10, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: PURPLE },
  button: { minHeight: 48, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  panel: { padding: 18, borderRadius: 24, borderWidth: 1, gap: 10 },
  input: { minHeight: 50, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, fontFamily: fonts.body, fontSize: 15, paddingVertical: 12 },
});
