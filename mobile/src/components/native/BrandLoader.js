import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';

const logo = require('../../../assets/images/icon.png');

export default function BrandLoader({ fullScreen = false, label = 'Loading', testID }) {
  const spin = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const rotation = Animated.loop(Animated.timing(spin, {
      toValue: 1,
      duration: 1100,
      easing: Easing.linear,
      useNativeDriver: true,
    }));
    const breathing = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 0.9, duration: 620, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 620, useNativeDriver: true }),
    ]));
    rotation.start();
    breathing.start();
    return () => { rotation.stop(); breathing.stop(); };
  }, [pulse, spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <View testID={testID} accessibilityRole="progressbar" accessibilityLabel={label}
      style={[styles.container, fullScreen && styles.fullScreen]}>
      <View style={styles.markWrap}>
        <Animated.View style={[styles.ring, { transform: [{ rotate }] }]} />
        <Animated.Image source={logo} resizeMode="cover" style={[styles.logo, { transform: [{ scale: pulse }] }]} />
      </View>
      {!fullScreen && <Text style={styles.label}>{label}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', gap: 12, minHeight: 50 },
  fullScreen: { ...StyleSheet.absoluteFillObject, zIndex: 999, backgroundColor: '#050505' },
  markWrap: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 84, height: 84, borderRadius: 42, borderWidth: 2, borderColor: '#CDFF0030', borderTopColor: '#CDFF00', borderRightColor: '#CDFF00A0' },
  logo: { width: 66, height: 66, borderRadius: 19 },
  label: { color: '#9CA3AF', fontSize: 12, fontFamily: 'Poppins_600SemiBold' },
});
