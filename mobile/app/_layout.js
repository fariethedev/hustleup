import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Stack, useRouter, useSegments, useRootNavigationState, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Provider, useDispatch, useSelector } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Sentry from '@sentry/react-native';
import { useFonts } from 'expo-font';
import { Poppins_400Regular } from '@expo-google-fonts/poppins/400Regular';
import { Poppins_600SemiBold } from '@expo-google-fonts/poppins/600SemiBold';
import { Montserrat_800ExtraBold } from '@expo-google-fonts/montserrat/800ExtraBold';
import { store } from '../src/store';
import CartProvider from '../src/store/CartProvider';
import { setUser } from '../src/store/authSlice';
import { registerForPushNotifications, usePushNavigation } from '../src/utils/pushNotifications';
import BrandLoader from '../src/components/native/BrandLoader';

// No-ops safely if extra.sentryDsn is blank. Note: this captures JS-level errors
// fine under Expo Go, but full native crash reporting needs an EAS dev build —
// see INTEGRATIONS.md.
Sentry.init({
  dsn: Constants.expoConfig?.extra?.sentryDsn || undefined,
  environment: __DEV__ ? 'development' : 'production',
  tracesSampleRate: 0.2,
});

function AuthGate({ children }) {
  const router = useRouter();
  const segments = useSegments();
  const { returnTo } = useLocalSearchParams();
  const navState = useRootNavigationState();   // null until navigation is mounted
  const dispatch = useDispatch();
  const isAuthenticated = useSelector((s) => s.auth.isAuthenticated);
  const [hydrated, setHydrated] = useState(false);
  const [needsWelcome, setNeedsWelcome] = useState(false);
  const welcomeShown = useRef(false);

  // Hydrate Redux from AsyncStorage once on startup
  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem('hustleup_token');
        const raw   = await AsyncStorage.getItem('hustleup_user');
        if (token && raw) dispatch(setUser(JSON.parse(raw)));
        else setNeedsWelcome(!(await AsyncStorage.getItem('hustleup_seen_welcome')));
      } catch {}
      setHydrated(true);
    })();
  }, [dispatch]);

  // Redirect once BOTH hydration AND navigation are ready
  useEffect(() => {
    if (!hydrated || !navState?.key) return;   // wait for nav container to mount
    const inAuthScreen = segments[0] === 'login' || segments[0] === 'register';
    const recoveryScreen = ['forgot-password', 'reset-password', 'verify-code'].includes(segments[0]);
    // First launch while signed out: show the intro once, before anything else.
    if (!isAuthenticated && needsWelcome && !welcomeShown.current) {
      welcomeShown.current = true;
      if (segments[0] !== 'welcome' && !recoveryScreen) { router.replace('/welcome'); return; }
    }
    if (segments[0] === 'welcome') { if (isAuthenticated) router.replace('/(tabs)/feed'); return; }
    const publicTab = segments[0] === '(tabs)' && (!segments[1] || ['index', 'explore', 'feed'].includes(segments[1]));
    const publicDetail = segments[0] === 'listing' || (segments[0] === 'profile' && segments[1] === '[id]');
    if (!isAuthenticated && !inAuthScreen && !publicTab && !publicDetail && !recoveryScreen) {
      const requestedBond = segments[0] === 'bond' || (segments[0] === '(tabs)' && segments[1] === 'bond');
      router.replace(requestedBond ? { pathname: '/login', params: { returnTo: '/bond' } } : '/login');
    } else if (isAuthenticated && inAuthScreen) {
      router.replace(returnTo === '/bond' ? '/bond' : '/(tabs)/feed');
    }
  }, [hydrated, isAuthenticated, needsWelcome, segments, navState?.key, router, returnTo]);

  // Register (or re-register, e.g. after a token refresh) this device for push
  // notifications once the user is signed in. No-ops until Firebase/EAS are configured.
  useEffect(() => {
    if (hydrated && isAuthenticated) registerForPushNotifications();
  }, [hydrated, isAuthenticated]);

  // Tapping a push opens what it is about, once the session is restored and signed in.
  usePushNavigation(router, hydrated && isAuthenticated);

  // Render children always so the Stack mounts and navState.key becomes available.
  // Show a lime spinner overlay while we haven't finished reading AsyncStorage.
  return (
    <>
      {children}
      {!hydrated && (
        <View testID="auth-hydration" style={{
          position: 'absolute', inset: 0,
          backgroundColor: '#050505',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <BrandLoader fullScreen label="Restoring your session" />
        </View>
      )}
    </>
  );
}

function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Poppins_400Regular, Poppins_600SemiBold, Montserrat_800ExtraBold });
  if (!fontsLoaded && !fontError) return <View style={{ flex: 1, backgroundColor: '#050505', justifyContent: 'center' }}><BrandLoader label="Loading HustleSpace" /></View>;
  return (
    <Provider store={store}>
      <AuthGate>
        <CartProvider>
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
          <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
        </Stack>
        <StatusBar style="light" />
        </CartProvider>
      </AuthGate>
    </Provider>
  );
}

export default Sentry.wrap(RootLayout);

