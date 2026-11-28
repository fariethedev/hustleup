import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { palettes, resolveTheme, themePreference } from './palette';

const ThemeContext = createContext(null);
export function ThemeProvider({ children }) {
  const system = useColorScheme();
  const [preference, setPreference] = useState('light');
  const [ready, setReady] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem('hustleup_theme').then(value => { if (alive) setPreference(themePreference(value)); }).catch(() => {}).finally(() => { if (alive) setReady(true); });
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (alive) setReducedMotion(value); });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => { alive = false; subscription.remove(); };
  }, []);
  useEffect(() => { if (ready) AsyncStorage.setItem('hustleup_theme', preference).catch(() => {}); }, [preference, ready]);
  const resolved = resolveTheme(preference, system);
  const value = useMemo(() => ({ preference, resolved, palette: palettes[resolved], ready, reducedMotion, setTheme: value => setPreference(themePreference(value)) }), [preference, resolved, ready, reducedMotion]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
export function useAppTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('ThemeProvider is required');
  return value;
}
export const usePalette = () => useAppTheme().palette;
