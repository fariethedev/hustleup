import React from 'react';
import { Pressable, View } from 'react-native';
import { Feather } from './Icon';
import { useAppTheme } from '../../theme/ThemeProvider';
import { Copy, fonts } from './Kit';

export default function AppearancePicker() {
  const { preference, setTheme, palette: c } = useAppTheme();
  return <View accessibilityRole="radiogroup" accessibilityLabel="Appearance" style={{ gap: 8 }}>
    <Copy heading style={{ fontSize: 20 }}>Appearance</Copy>
    <Copy muted>Choose what is easiest for you to read.</Copy>
    {[['system', 'Follow phone', 'smartphone'], ['light', 'Light', 'sun'], ['dark', 'Dark', 'moon']].map(([value, label, icon]) => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: preference === value }} onPress={() => setTheme(value)} style={({ pressed }) => ({ minHeight: 56, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: pressed || preference === value ? c.soft : c.card, borderRadius: 14, borderWidth: 1, borderColor: preference === value ? c.accent : c.line })}>
      <Feather name={icon} size={22} color={c.accent} /><Copy style={{ flex: 1, fontFamily: fonts.medium }}>{label}</Copy>
      <Feather name={preference === value ? 'check-circle' : 'circle'} size={22} color={preference === value ? c.accent : c.muted} />
    </Pressable>)}
  </View>;
}
