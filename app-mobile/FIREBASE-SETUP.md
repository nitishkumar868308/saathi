# Firebase — Crashlytics + Analytics setup (#6)

App me analytics/crashlytics ki **wiring ho chuki hai** (`src/lib/analytics.ts` +
key events: reminder_created, document_added, review_submitted, plus_purchased).
Abhi ye **no-op** hai — kuch nahi tootta. Neeche steps karte hi live ho jayega.

> ⚠️ Ye native module hai — **Expo Go me nahi chalega**, ek naya **dev/EAS build**
> banana padega. Aur `google-services.json` (aapke Firebase project ka) chahiye —
> uske bina build **fail** hoga. Isliye ye abhi auto-install nahi kiya.

## 1. Firebase project banao (free — Spark plan)

1. https://console.firebase.google.com → **Add project** (koi bhi naam).
2. Add app → **Android** → package name **`com.saathi.app`** (app.json wala).
3. **`google-services.json`** download karo → `app-mobile/google-services.json`
   me rakho (is folder me).
4. Console me: **Analytics** on karo (project banate waqt hota hai), aur
   **Crashlytics** → Get started dabao.

## 2. Packages install (SDK 57 pinned)

```bash
cd app-mobile
npx expo install @react-native-firebase/app @react-native-firebase/crashlytics @react-native-firebase/analytics expo-build-properties
```

## 3. app.json me plugins + google-services

`expo.plugins` me add karo (aur `android.googleServicesFile`):

```jsonc
{
  "expo": {
    "android": {
      "package": "com.saathi.app",
      "googleServicesFile": "./google-services.json"
    },
    "plugins": [
      "@react-native-firebase/app",
      "@react-native-firebase/crashlytics",
      [
        "expo-build-properties",
        { "android": { "extraMavenRepos": [] } }
      ]
    ]
  }
}
```

## 4. Wrapper ko live karo

`src/lib/analytics.ts` me:

- `const USE_FIREBASE = false;` → **`true`** kar do.
- Ye do lines **uncomment** karo (aur neeche wali `const analytics/crashlytics = null` hata do):

```ts
import analytics from "@react-native-firebase/analytics";
import crashlytics from "@react-native-firebase/crashlytics";
```

Bas — poori app ke saare `logEvent` / `recordError` / `logScreen` calls apne aap
live ho jaayenge. Kahin aur code change nahi.

## 5. Naya build

```bash
npx expo prebuild --clean
eas build --profile development --platform android   # ya production
```

Crashlytics/Analytics data Firebase console me kuch der (~a few hours analytics,
crashlytics turant) me dikhne lagega.

## Free?

Haan — Firebase **Spark (free)** plan: Analytics **unlimited events free**,
Crashlytics **free**. Koi card nahi chahiye.
