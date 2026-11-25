import React from 'react';
import { Image, Text, View } from 'react-native';
import { fonts } from './Kit';

// The same artwork the web app uses (frontend/public/hustlespace-logo.png).
const logo = require('../../../assets/images/icon.png');

/** The HustleSpace mark, optionally with the wordmark beside or below it. */
export default function BrandLogo({ size = 40, wordmark = false, stacked = false, glow = false, textColor = '#F7F8F5' }) {
  const mark = (
    <View style={glow ? {
      borderRadius: size * 0.28,
      shadowColor: '#CDFF00', shadowOpacity: 0.55, shadowRadius: size * 0.45, shadowOffset: { width: 0, height: 0 },
      elevation: 12,
    } : null}>
      <Image source={logo} accessibilityIgnoresInvertColors style={{ width: size, height: size, borderRadius: size * 0.28 }} />
    </View>
  );
  if (!wordmark) return <View accessible accessibilityRole="image" accessibilityLabel="HustleSpace">{mark}</View>;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel="HustleSpace" style={{ flexDirection: stacked ? 'column' : 'row', alignItems: 'center', gap: stacked ? size * 0.3 : size * 0.25 }}>
      {mark}
      <Text style={{ color: textColor, fontFamily: fonts.heading, fontSize: stacked ? size * 0.32 : size * 0.48, letterSpacing: -0.3 }}>
        Hustle<Text style={{ color: '#CDFF00' }}>Space</Text>
      </Text>
    </View>
  );
}
