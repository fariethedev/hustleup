import React from 'react';
import { View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Button, Copy, Panel, Screen, usePalette } from '../src/components/native/Kit';

export const WELCOME_SEEN_KEY = 'hustleup_seen_welcome';
export default function Welcome() {
  const c = usePalette();
  const router = useRouter();
  const start = async route => {
    await AsyncStorage.setItem(WELCOME_SEEN_KEY, '1').catch(() => {});
    router.replace(route);
  };
  return <Screen showHeader={false}>
    <View style={{ paddingTop: 32, gap: 20 }}>
      <View style={{ width: 72, height: 72, backgroundColor: c.soft, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }}><Feather name="shopping-bag" size={32} color={c.accent} /></View>
      <Copy heading accessibilityRole="header" style={{ fontSize: 32 }}>Welcome to HustleSpace</Copy>
      <Copy style={{ fontSize: 19 }}>Local shops, useful services and your community. All in one place.</Copy>
      <Panel>
        {[['search', 'Find something you need'], ['calendar', 'Book a local service'], ['message-circle', 'Talk directly to sellers']].map(([icon, label]) => <View key={icon} style={{ flexDirection: 'row', gap: 14, alignItems: 'center', paddingVertical: 10 }}><Feather name={icon} size={24} color={c.accent} /><Copy style={{ flex: 1 }}>{label}</Copy></View>)}
      </Panel>
      <Button onPress={() => start('/(tabs)')}>Start browsing</Button>
      <Button secondary onPress={() => start('/login')}>Sign in</Button>
      <Button secondary onPress={() => start('/register')}>Create an account</Button>
      <Copy muted>You can look around before creating an account.</Copy>
    </View>
  </Screen>;
}
