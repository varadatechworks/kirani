# Kirani native app (Android + iOS)

Cross-platform React Native application using Expo. The app is separate from the existing web/PWA and uses the Kirani API as its system of record.

## Local development

Requirements: Node.js 20.6+, npm, Android Studio (Android emulator) and/or Xcode on macOS (iOS simulator).

```sh
cd apps/mobile
npm install
```

Set the API URL in the shell before starting Expo:

```sh
# macOS / Linux
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000 npx expo start

# Windows PowerShell
$env:EXPO_PUBLIC_API_BASE_URL="http://10.0.2.2:3000"
npx expo start
```

For Android emulator use `http://10.0.2.2:3000`; for a physical device use the development machine's LAN IP. For iOS simulator, `http://localhost:3000` usually reaches the host machine. Configure HTTPS for any shared test environment.

## Authentication limitation (important)

The current Kirani API validates signed bearer tokens but does **not** expose a production user sign-in, OTP verification, MFA or refresh-token endpoint. The app therefore does not invent a password/OTP login flow or embed a signing secret.

A development-only bearer-token connection screen can be enabled by setting `EXPO_PUBLIC_ENABLE_DEV_TOKEN_LOGIN=true` in a local development build. Generate a short-lived token only with the root development script while `NODE_ENV=development`; never use a development token in preview/production. Tokens are stored with Expo SecureStore and can be disconnected.

Before a production app can be called end-to-end complete, implement and approve the identity provider flow (mobile verification, MFA/recovery as required, refresh/revocation), then replace the development connection screen with that flow. Do not expose the JWT signing secret to the app.

## Build

```sh
npx expo prebuild
npx expo run:android
# iOS build requires macOS/Xcode
npx expo run:ios
```

For cloud builds, run `npx eas-cli init` from this directory to link/create the EAS project, then use `npx eas-cli build --profile preview --platform android` or `npx eas-cli build --profile production --platform all`.

Bundle identifiers are provisional: `com.varadatechworks.kirani`. Confirm ownership/availability before publishing. App signing, store accounts, privacy declarations, screenshots, push credentials and store review are external release tasks.

## Current app scope

- Secure local token storage and disconnect.
- Customer order list with refresh, loading, empty and error states.
- Role-aware home shell and API health/identity status.
- Accessible touch targets, safe-area layout and network error messaging.
- API client sends bearer tokens and correlation references through server errors.

Further native feature screens (catalogue/basket/checkout, farmer profile/listings, mill processing, packing/QR scanning, delivery/POD and admin/finance) should be added against verified API contracts rather than mocked endpoints.
