# Firebase — Crashlytics + Analytics setup (#6)

App me analytics/crashlytics ki **wiring ho chuki hai** (`src/lib/analytics.ts` +
key events: reminder_created, document_added, review_submitted, plus_purchased).
Abhi ye **no-op** hai — kuch nahi tootta. Neeche steps karte hi live ho jayega.

> ⚠️ Ye native module hai — **Expo Go me nahi chalega**, ek naya **dev/EAS build**
> banana padega. Aur `google-services.json` (aapke Firebase project ka) chahiye —
> uske bina build **fail** hoga. Isliye ye abhi auto-install nahi kiya.

## 1. Firebase project banao (free — Spark plan)

1. https://console.firebase.google.com → **Add project** (koi bhi naam).
2. Add app → **Android** → package name **`com.apkasaathi.app`** (app.json wala).
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
      "package": "com.apkasaathi.app",
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

---

# Push notification — admin se users ko (item 8)

> **Code poora ho chuka hai.** Baaki sirf do cheezein hain: Supabase me ek SQL
> chalana, aur Vercel me teen env var daalna. Neeche dono ka exact tareeka hai.

Firebase project: **`saathi-c42f0`** · Android package: **`com.apkasaathi.app`**
`google-services.json` `app-mobile/` me pada hai aur `app.json` usse pehchaan
chuka hai — us par aur kuch nahi karna.

## Pehle ye samajh lo — email aur notification do alag cheezein hain

App me ab tak jo notification aati thi wo **local** hai: reminder banate waqt
phone ke andar hi alarm set ho jaata hai (`@notifee/react-native`). Isme koi
server nahi — isliye ye bina internet ke bhi bajti hai, par isi wajah se admin
panel se kuch **bheja nahi ja sakta tha**. Admin sirf email bhej paata tha.

Push (FCM) me server Google ko message deta hai aur Google phone tak pahunchata
hai. Iske liye har phone ka "pata" (token) server ke paas hona chahiye.

## Jo code ban chuka hai

| Kahan | Kya |
|---|---|
| `supabase/device-tokens.sql` | `device_tokens` table + `save_device_token()` + `delete_device_tokens()` |
| `app-mobile/src/lib/push.ts` | Token register + refresh listener + foreground me notification dikhana |
| `app-mobile/src/app/_layout.tsx` | Login ke baad dono chaalu |
| `web/lib/fcm.ts` | FCM v1 sender (service-account se OAuth, 50 ka batch, dead token detect) |
| `web/app/api/admin/notify/route.ts` | `channel: "email" \| "push" \| "both"` |
| `web/components/AdminBroadcast.tsx` | Channel ke teen button + result me "kitne device par pahunchi" |

## 1. Supabase — SQL chalao

SQL editor me ye **do** files chalao (order matter nahi karta):

```
supabase/device-tokens.sql      <- push ke liye (naya)
supabase/reminder-repeat.sql    <- roz wale reminder ke liye
```

Iske bina app token save karne ki koshish karegi aur chup-chaap fail hoti rahegi
(app kuch nahi todegi, par push kabhi nahi pahunchegi).

## 2. Firebase — Cloud Messaging + service account key

1. [Firebase Console](https://console.firebase.google.com) → project **saathi-c42f0**
2. **Project settings → Cloud Messaging** → *Firebase Cloud Messaging API (V1)*
   **Enable** karo (agar pehle se enabled nahi hai).
3. **Project settings → Service accounts** → **Generate new private key**
   → ek JSON file download hogi.

> ⚠️ Ye JSON **secret** hai — `google-services.json` se bilkul alag cheez hai.
> Isse kabhi app me, git me, ya chat me mat daalna. Ye leak ho gayi to koi bhi
> aapke saare users ko notification bhej sakta hai. Sirf Vercel env me.

## 3. Vercel me kya daalna hai — teen env var

Vercel → project → **Settings → Environment Variables**. Downloaded JSON kholo
aur usme se ye teen value uthao:

| Name | Value | JSON me kahan |
|---|---|---|
| `FIREBASE_PROJECT_ID` | `saathi-c42f0` | `project_id` |
| `FIREBASE_CLIENT_EMAIL` | `firebase-adminsdk-…@saathi-c42f0.iam.gserviceaccount.com` | `client_email` |
| `FIREBASE_PRIVATE_KEY` | `-----BEGIN PRIVATE KEY-----\nMIIE…\n-----END PRIVATE KEY-----\n` | `private_key` |

Teenon me **Production + Preview + Development** — teenon environment tick karo.

### Sabse aasan tareeka — script se nikalo

Haath se copy karne ki zaroorat nahi. Downloaded JSON ka path do:

```bash
cd web
node scripts/firebase-env.mjs ~/Downloads/saathi-c42f0-firebase-adminsdk-xxxxx.json
```

Ye teenon value bilkul sahi shakal me chhaap dega — bas copy karke Vercel me
paste karo. Local `.env.local` me seedha likhwana ho to `--write` laga do:

```bash
node scripts/firebase-env.mjs <file.json> --write
```

Galti se `google-services.json` de diya to script khud rok degi aur bata degi ki
wo galat file hai.

### `FIREBASE_PRIVATE_KEY` — yahan sabse zyada log fansate hain

JSON me key aisi dikhti hai:

```json
"private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADAN...\n-----END PRIVATE KEY-----\n"
```

Vercel ke box me **JSON wali poori value, waise ki waise** paste karo — `\n`
ko asli enter mat banao, aur shuru-aakhir ke double quotes **mat** daalo.
Code (`web/lib/fcm.ts`) khud `\n` ko asli newline me badal deta hai.

Galat: enter dabakar multi-line banana → `error:0909006C:PEM routines`
Galat: `"-----BEGIN…"` quotes ke saath → wahi PEM error
Sahi: ek hi line, `-----BEGIN PRIVATE KEY-----\nMIIE…` se shuru

Teenon var daalne ke baad **redeploy** karna zaroori hai — Vercel purane build me
naye env var nahi ghusata.

## 4. App ka naya build

`@react-native-firebase/messaging` native module hai — purani APK me push kaam
nahi karegi, chahe sab kuch sahi ho.

```bash
cd app-mobile
npx expo prebuild --clean
eas build --platform android --profile preview
```

## 5. Test karo

1. Nayi APK install karo aur **login** karo (token login ke baad hi jaata hai).
2. Supabase → `device_tokens` table me ek row aani chahiye.
3. Admin panel → **Message users** → **"Khud chuno"** → apna account tick karo
   → channel **"Phone notification"** → bhejo.
4. Result me `1 device me se 1 par notification pahunch gayi` dikhna chahiye.

## Kuch nahi aaya to kahan dekho

| Dikkat | Wajah |
|---|---|
| Admin me push ke button **band** hain | Vercel me teen env var nahi hain (ya redeploy nahi hua) |
| `device_tokens` khaali hai | `device-tokens.sql` nahi chala, ya purani APK hai, ya login nahi kiya |
| `0 device` | Chune hue users me se kisi ne nayi APK me login nahi kiya |
| `fcm auth failed: 400` | `FIREBASE_PRIVATE_KEY` ki shakal galat (upar wala section dekho) |
| Bheja to gaya par phone par nahi dikha | Notification permission band hai — app me Settings → "Reminders reliable banao" |

## Free?

Haan. **FCM bilkul free hai** — koi limit nahi, koi card nahi. Bhejne ka kaam
Vercel se hota hai, isliye Cloud Functions ka kharcha bhi nahi.
