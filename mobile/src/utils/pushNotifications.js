import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { AndroidImportance } from 'expo-notifications';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { usersApi } from '../api/client';
import { notificationTarget } from './notificationRoutes';

// Show incoming pushes as a banner + play the default sound even while the app is
// in the foreground — Expo's default behavior suppresses the banner otherwise.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Requests permission, fetches an Expo push token, and registers it with the backend
// (PATCH /users/me/push-token — see ExpoPushService on the backend). Silently does
// nothing on a simulator/emulator (no push capability) or before an EAS project ID is
// configured (`expo-notifications` needs one to mint a token) — mirrors the no-op-until-
// configured pattern used by every other integration in this app, so a dev without
// Firebase/EAS set up yet sees no crashes or warnings, just no push notifications.
export async function registerForPushNotifications() {
  try {
    if (!Device.isDevice) return null;

    if (Platform.OS === 'android') {
      // HIGH importance makes Android show a heads-up banner; DEFAULT only adds a silent
      // icon to the status bar, which is easy to miss for offers and messages.
      await Notifications.setNotificationChannelAsync('default', {
        name: 'HustleSpace',
        importance: AndroidImportance.HIGH,
        vibrationPattern: [0, 200, 120, 200],
        lightColor: '#CDFF00',
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return null;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) return null; // `eas init` hasn't been run yet — see INTEGRATIONS.md

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

    await usersApi.updatePushToken(token);
    return token;
  } catch {
    return null; // best-effort — never let push registration break app startup/login
  }
}

/**
 * Opens the screen a tapped push points at (the chat, the booking, the listing…), using the
 * same routes as the in-app notifications list. Covers taps that launch the app from closed
 * as well as taps while it runs; each response is handled once.
 */
export function usePushNavigation(router, ready) {
  const last = Notifications.useLastNotificationResponse();
  const handled = useRef(null);
  useEffect(() => {
    if (!ready || !last || last.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const id = last.notification.request.identifier;
    if (handled.current === id) return;
    handled.current = id;
    const target = notificationTarget(last.notification.request.content.data || {});
    router.push(target || '/notifications');
  }, [last, ready, router]);
}
