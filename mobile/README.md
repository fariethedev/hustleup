# HustleSpace mobile

Native React Native + Expo Router app for Android and iPhone. Feature migration is in progress; see [FEATURE_PARITY.md](FEATURE_PARITY.md) for what is implemented and what still needs work.

## Development

Run `npm ci`, then `npx expo start` from this directory. The app defaults to the production gateway. For development/testing, set `EXPO_PUBLIC_API_URL` to your test gateway's full `/api/v1` URL (use a LAN-accessible address on a physical phone). For Expo web, allow the page's origin (default `http://localhost:19000`) in the backend gateway's `CORS_ALLOWED_ORIGINS`, then restart the gateway. Never put server secrets in EXPO_PUBLIC variables or app.json.

## Local validation

- `npx eslint app/profile/orders.js app/profile/bank.js src/utils/orderState.js src/utils/secureLinks.js`
- `node ../scripts/check-mobile-orders.mjs`
- `npx expo export --platform android --platform ios --output-dir dist-parity`

Export verifies native JavaScript/Hermes bundles. It does not produce a downloadable installer or test a real device.

## Installable builds (after account setup)

The Expo project is not yet linked to an owner account. Confirm ownership and the proposed app identifiers before creating signing credentials. Once linked:

- Android test APK: `eas build --platform android --profile preview`
- iPhone internal build: `eas build --platform ios --profile preview` (registered devices/provisioning required)
- iOS simulator: `eas build --platform ios --profile ios-simulator`
- Store packages: `eas build --platform all --profile production`

These commands start remote builds, may consume paid build quota, and are not run automatically. No app-store submission has been configured.

Build profiles follow [Expo internal distribution](https://docs.expo.dev/build/internal-distribution/) and [APK build guidance](https://docs.expo.dev/build-reference/apk/).
