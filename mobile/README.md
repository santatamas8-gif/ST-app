# ST App – Mobil

Expo (React Native) + TypeScript, ugyanaz a Supabase backend mint a web app.

## Architektúra

- **UI:** `app/` (Expo Router), `src/components/`
- **State:** `src/context/AuthContext.tsx`
- **Data:** `src/repositories/` (wellness, sessions) – a UI csak ezeket hívja
- **Services:** `src/services/` (Supabase client, auth, secure storage)
- **Models:** `src/models/types.ts`
- **Config:** `src/config/env.ts` (dev/staging/prod)

Session token: **expo-secure-store** (SecureStore), nincs API hívás közvetlenül a UI-ból.

## Első indítás

1. Másold a `.env.example` fájlt `.env` névre, és töltsd ki:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - opcionálisan `EXPO_PUBLIC_APP_ENV=staging` vagy `prod`
2. Telepítés: `npm install`
3. Indítás: `npm start` (vagy `npx expo start`), majd válaszd az emulátort vagy a telefont (Expo Go).

## Parancsok

- `npm start` – Expo dev server
- `npm run android` – Android
- `npm run ios` – iOS (Mac kell)

## EAS Build (.apk)

1. Telepítés (egyszer): `npm install -g eas-cli` vagy használd: `npx eas ...`
2. Bejelentkezés: `npx eas login` (Expo fiók)
3. Projekt linkelés (első alkalommal a mobile mappából): `npx eas build:configure` ha kéri
4. Android APK: `npx eas build --platform android --profile preview`
5. A build után az expo.dev-en megjelenik a letöltési link; töltsd le az .apk-t és telepítsd a telefonra.

**Env a buildhez:** A preview/production buildhez a Supabase URL és anon key az EAS Secrets-ben kell legyen (ne a .env a repóban). Első build előtt: `npx eas secret:create --name EXPO_PUBLIC_SUPABASE_URL --value "https://xxx.supabase.co"` és ugyanígy `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Vagy a build során a webes felületen add meg.

## Következő lépések (Play Store felé)

- Staged rollout, Crashlytics (Firebase), offline/sync bővítés
