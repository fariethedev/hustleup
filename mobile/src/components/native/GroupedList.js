import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Feather } from './Icon';
import { Copy, fonts, usePalette } from './Kit';

/**
 * Inset grouped list, iOS-settings style: a caption above one rounded card whose rows are
 * separated by hairlines. Shared by the dashboard and settings so both read the same way.
 */
export function Group({ title, footer, children }) {
  const c = usePalette();
  const rows = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={{ gap: 8 }}>
      {!!title && <Copy style={{ color: c.muted, fontFamily: fonts.medium, fontSize: 13, letterSpacing: 0.4, marginLeft: 6, textTransform: 'uppercase' }}>{title}</Copy>}
      <View style={{ borderRadius: 20, backgroundColor: c.card, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line, overflow: 'hidden' }}>
        {rows.map((row, i) => (
          <React.Fragment key={i}>
            {i > 0 && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.line, marginLeft: 62 }} />}
            {row}
          </React.Fragment>
        ))}
      </View>
      {!!footer && <Copy muted style={{ fontSize: 12.5, marginHorizontal: 6 }}>{footer}</Copy>}
    </View>
  );
}

/**
 * One row: tinted icon tile, label with optional subtitle, and on the right a value, a count
 * badge or a chevron. `tone` colours the icon tile (accent, purple, warn, danger).
 */
export function Row({ icon, label, subtitle, value, count, onPress, tone = 'accent', chevron = true, danger }) {
  const c = usePalette();
  const tint = danger ? '#EF4444' : tone === 'purple' ? c.purple : tone === 'warn' ? '#F59E0B' : c.accent;
  const tileBg = danger ? '#EF44441A' : tone === 'purple' ? c.purpleSoft : tone === 'warn' ? '#F59E0B1F' : c.light ? '#52640014' : '#CDFF0014';
  const showCount = count !== undefined && count !== null && count !== '' && count !== 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[label, subtitle, showCount ? `${count}` : value].filter(Boolean).join(', ')}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 72, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: pressed ? c.soft : 'transparent' })}
    >
      <View style={{ width: 40, height: 40, borderRadius: 11, backgroundColor: tileBg, alignItems: 'center', justifyContent: 'center' }}>
        <Feather name={icon} size={17} color={tint} />
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <Copy style={{ fontFamily: fonts.medium, fontSize: 15, color: danger ? '#EF4444' : c.text }} >{label}</Copy>
        {!!subtitle && <Copy muted style={{ fontSize: 13 }}>{subtitle}</Copy>}
      </View>
      {showCount && (
        <View style={{ minWidth: 24, height: 24, paddingHorizontal: 7, borderRadius: 12, backgroundColor: tone === 'warn' ? '#F59E0B' : c.purple, alignItems: 'center', justifyContent: 'center' }}>
          <Copy style={{ color: '#FFFFFF', fontFamily: fonts.medium, fontSize: 11 }}>{count}</Copy>
        </View>
      )}
      {!showCount && !!value && <Copy muted style={{ fontSize: 12.5 }} numberOfLines={1}>{value}</Copy>}
      
    </Pressable>
  );
}
