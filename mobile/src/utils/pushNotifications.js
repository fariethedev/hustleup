import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { usersApi } from '../api/client';

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
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
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
