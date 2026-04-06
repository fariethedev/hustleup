import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Provider, useDispatch, useSelector } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { store } from '../src/store';
import { setUser } from '../src/store/authSlice';

function AuthGate({ children }) {
  const router = useRouter();
  const segments = useSegments();
  const navState = useRootNavigationState();   // null until navigation is mounted
  const dispatch = useDispatch();
  const isAuthenticated = useSelector((s) => s.auth.isAuthenticated);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate Redux from AsyncStorage once on startup
  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem('hustleup_token');
        const raw   = await AsyncStorage.getItem('hustleup_user');
        if (token && raw) dispatch(setUser(JSON.parse(raw)));
      } catch {}
      setHydrated(true);
    })();
  }, []);

  // Redirect once BOTH hydration AND navigation are ready
  useEffect(() => {
    if (!hydrated || !navState?.key) return;   // wait for nav container to mount
    const inAuthScreen = segments[0] === 'login' || segments[0] === 'register';
    if (!isAuthenticated && !inAuthScreen) {
      router.replace('/login');
    } else if (isAuthenticated && inAuthScreen) {
      router.replace('/(tabs)');
    }
  }, [hydrated, isAuthenticated, segments, navState?.key]);

  // Render children always so the Stack mounts and navState.key becomes available.
  // Show a lime spinner overlay while we haven't finished reading AsyncStorage.
  return (
    <>
      {children}
      {!hydrated && (
        <View style={{
          position: 'absolute', inset: 0,
          backgroundColor: '#050505',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <View style={{
            width: 56, height: 56, borderRadius: 18,
            backgroundColor: '#CDFF00',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <ActivityIndicator color="#050505" />
          </View>
        </View>
      )}
    </>
  );
}

export default function RootLayout() {
  return (
    <Provider store={store}>
      <AuthGate>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#050505' },
            animation: 'fade',
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="login" />
          <Stack.Screen name="register" />
        </Stack>
        <StatusBar style="light" />
      </AuthGate>
    </Provider>
  );
}

