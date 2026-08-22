# Saathi App — Phase 1: Foundation Implementation Plan

**Goal:** Ek chalta hua Expo (React Native) app khada karna — themed, navigation ke saath, Supabase se juda, aur Home + Chat screen ka skeleton — taaki iske upar features banaye ja sakein.

**Architecture:** Expo (managed workflow) + EAS Build for store-ready builds. Supabase JS client backend ke liye (data/auth/storage). File-based routing (expo-router). Warm theme design tokens landing page se match. AI aur real logic baad ke phases mein.

**Tech Stack:** Expo SDK 51+, expo-router, TypeScript, @supabase/supabase-js, react-native-async-storage, expo-secure-store, NativeWind (Tailwind for RN) — landing page ke theme ke saath consistency ke liye.

**Scope:** Sirf Foundation. Chat-AI, document scan, reminders, daily brief — alag phases (alag plans) mein.

---

## File Structure

```
app-mobile/
├── app/                      # expo-router screens (file-based)
│   ├── _layout.tsx           # root layout (fonts, providers)
│   ├── (tabs)/               # bottom tab group
│   │   ├── _layout.tsx       # tab bar config
│   │   ├── index.tsx         # Home (daily brief card + chat entry)
│   │   ├── documents.tsx     # Documents list (skeleton)
│   │   └── settings.tsx      # Settings (skeleton)
│   └── chat.tsx              # Chat screen (UI only, no AI yet)
├── src/
│   ├── theme/colors.ts       # design tokens (cream, terracotta, etc.)
│   ├── lib/supabase.ts       # Supabase client
│   └── utils/expiry.ts       # pure logic: expiry status (testable)
├── src/utils/__tests__/expiry.test.ts
├── .env                      # EXPO_PUBLIC_SUPABASE_URL / ANON_KEY
├── app.json                  # Expo config
├── tailwind.config.js        # NativeWind
├── babel.config.js
└── package.json
```

Har file ki ek zimmedari: screens UI, `lib/supabase.ts` backend connection, `theme/colors.ts` tokens, `utils/expiry.ts` pure logic (isliye ise test karenge).

---

## Prerequisites (user/engineer ke paas hona chahiye)

- Node.js 18+ installed
- Phone pe **Expo Go** app (Play Store se) — testing ke liye, ya Android emulator
- Ek **Supabase project** (free) — [supabase.com](https://supabase.com) pe banao, `Project URL` + `anon public key` note karo (Settings → API)

---

### Task 1: Scaffold the Expo app

**Files:**
- Create: `app-mobile/` (poora Expo project)

- [ ] **Step 1: Create the Expo app with expo-router + TypeScript template**

Run (project root `d:\my-app` se):
```bash
npx create-expo-app@latest app-mobile
```
Expected: `app-mobile/` folder ban jaye with default expo-router template. (Default template already TypeScript + expo-router hota hai.)

- [ ] **Step 2: Verify it runs**

Run:
```bash
cd app-mobile
npx expo start
```
Expected: QR code dikhe. Phone pe Expo Go se scan karo → default app khule. `Ctrl+C` se band karo.

- [ ] **Step 3: Reset to a clean app folder**

Run:
```bash
cd app-mobile
npm run reset-project
```
Expected: Boilerplate `app/` example hat jaye, saaf `app/index.tsx` bane. (Agar `reset-project` script na ho, `app/` ke andar example files manually delete karke ek simple `app/index.tsx` bana lo.)

- [ ] **Step 4: Commit**

```bash
cd d:\my-app
git add app-mobile
git commit -m "chore(app): scaffold Expo app with expo-router"
```

---

### Task 2: Install dependencies

**Files:**
- Modify: `app-mobile/package.json`

- [ ] **Step 1: Install runtime deps**

Run (`app-mobile/` se):
```bash
npx expo install @supabase/supabase-js @react-native-async-storage/async-storage expo-secure-store react-native-url-polyfill
npx expo install nativewind tailwindcss react-native-safe-area-context @expo/vector-icons
```
Expected: Sab install ho jayein bina error.

- [ ] **Step 2: Install dev/test deps**

Run:
```bash
npm install --save-dev jest jest-expo @types/jest
```
Expected: Install success.

- [ ] **Step 3: Add test script to package.json**

Modify `app-mobile/package.json` — `"scripts"` mein add:
```json
"test": "jest"
```
Aur top-level add:
```json
"jest": { "preset": "jest-expo" }
```

- [ ] **Step 4: Commit**

```bash
git add app-mobile/package.json app-mobile/package-lock.json
git commit -m "chore(app): add supabase, nativewind, jest deps"
```

---

### Task 3: Set up the warm theme (design tokens + NativeWind)

**Files:**
- Create: `app-mobile/src/theme/colors.ts`
- Create: `app-mobile/tailwind.config.js`
- Create: `app-mobile/babel.config.js`
- Create: `app-mobile/metro.config.js`
- Create: `app-mobile/nativewind-env.d.ts`
- Create: `app-mobile/global.css`

- [ ] **Step 1: Create color tokens (landing page se match)**

Create `app-mobile/src/theme/colors.ts`:
```ts
export const colors = {
  cream: "#F7F2E9",
  creamDeep: "#EFE7D6",
  surface: "#FFFCF6",
  ink: "#2E2823",
  inkSoft: "#6B5F54",
  terracotta: "#C25A37",
  terracottaDark: "#A8492B",
  amber: "#E0A458",
  sage: "#7C8A6B",
  line: "#E5DBC9",
} as const;

export type ColorKey = keyof typeof colors;
```

- [ ] **Step 2: Configure Tailwind (NativeWind) with same palette**

Create `app-mobile/tailwind.config.js`:
```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        cream: "#F7F2E9",
        "cream-deep": "#EFE7D6",
        surface: "#FFFCF6",
        ink: "#2E2823",
        "ink-soft": "#6B5F54",
        terracotta: "#C25A37",
        "terracotta-dark": "#A8492B",
        amber: "#E0A458",
        sage: "#7C8A6B",
        line: "#E5DBC9",
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 3: Create global.css**

Create `app-mobile/global.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 4: Configure Babel for NativeWind**

Create `app-mobile/babel.config.js`:
```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
  };
};
```

- [ ] **Step 5: Configure Metro for NativeWind (zaroori — warna className kaam nahi karega)**

Create `app-mobile/metro.config.js`:
```js
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: "./global.css" });
```

- [ ] **Step 6: Add NativeWind types**

Create `app-mobile/nativewind-env.d.ts`:
```ts
/// <reference types="nativewind/types" />
```

- [ ] **Step 7: Commit**

```bash
git add app-mobile/src/theme app-mobile/tailwind.config.js app-mobile/babel.config.js app-mobile/metro.config.js app-mobile/global.css app-mobile/nativewind-env.d.ts
git commit -m "feat(app): warm theme tokens + NativeWind setup"
```

---

### Task 4: Supabase client

**Files:**
- Create: `app-mobile/.env`
- Create: `app-mobile/.env.example`
- Create: `app-mobile/src/lib/supabase.ts`
- Modify: `app-mobile/.gitignore` (ensure `.env` ignored)

- [ ] **Step 1: Env files**

Create `app-mobile/.env.example`:
```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```
Create `app-mobile/.env` (real values Supabase Settings → API se; ANON key hi — service key kabhi app mein nahi):
```
EXPO_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-KEY
```

- [ ] **Step 2: Ensure .env is gitignored**

Modify `app-mobile/.gitignore` — add line (agar nahi hai):
```
.env
```

- [ ] **Step 3: Create the Supabase client**

Create `app-mobile/src/lib/supabase.ts`:
```ts
import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

- [ ] **Step 4: Commit**

```bash
git add app-mobile/src/lib app-mobile/.env.example app-mobile/.gitignore
git commit -m "feat(app): supabase client + env config"
```

---

### Task 5: Expiry status util (pure logic — TDD)

**Files:**
- Create: `app-mobile/src/utils/expiry.ts`
- Test: `app-mobile/src/utils/__tests__/expiry.test.ts`

- [ ] **Step 1: Write the failing test**

Create `app-mobile/src/utils/__tests__/expiry.test.ts`:
```ts
import { expiryStatus } from "../expiry";

describe("expiryStatus", () => {
  const today = new Date("2026-06-30");

  it("returns 'expired' when date is in the past", () => {
    expect(expiryStatus("2026-06-01", today)).toBe("expired");
  });

  it("returns 'soon' when within 14 days", () => {
    expect(expiryStatus("2026-07-05", today)).toBe("soon");
  });

  it("returns 'safe' when far in the future", () => {
    expect(expiryStatus("2026-12-31", today)).toBe("safe");
  });

  it("returns 'soon' on the boundary (14 days)", () => {
    expect(expiryStatus("2026-07-14", today)).toBe("soon");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (`app-mobile/` se): `npm test -- expiry`
Expected: FAIL — "Cannot find module '../expiry'".

- [ ] **Step 3: Write minimal implementation**

Create `app-mobile/src/utils/expiry.ts`:
```ts
export type ExpiryStatus = "safe" | "soon" | "expired";

/** Returns expiry bucket. `soon` = within 14 days (inclusive). */
export function expiryStatus(
  expiryDate: string,
  now: Date = new Date(),
): ExpiryStatus {
  const expiry = new Date(expiryDate);
  const msPerDay = 1000 * 60 * 60 * 24;
  const days = Math.ceil((expiry.getTime() - now.getTime()) / msPerDay);
  if (days < 0) return "expired";
  if (days <= 14) return "soon";
  return "safe";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- expiry`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add app-mobile/src/utils
git commit -m "feat(app): expiry status util with tests"
```

---

### Task 6: Root layout (load global.css, safe area)

**Files:**
- Create/Modify: `app-mobile/app/_layout.tsx`

- [ ] **Step 1: Write the root layout**

Create/replace `app-mobile/app/_layout.tsx`:
```tsx
import "../global.css";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="chat" options={{ presentation: "card" }} />
      </Stack>
    </SafeAreaProvider>
  );
}
```

- [ ] **Step 2: Verify app still starts**

Run: `npx expo start` → Expo Go mein khol. Expected: app crash na ho (abhi blank/tabs aayenge). `Ctrl+C`.

- [ ] **Step 3: Commit**

```bash
git add app-mobile/app/_layout.tsx
git commit -m "feat(app): root layout with safe area + nativewind css"
```

---

### Task 7: Bottom tabs (Home, Documents, Settings)

**Files:**
- Create: `app-mobile/app/(tabs)/_layout.tsx`
- Create: `app-mobile/app/(tabs)/documents.tsx`
- Create: `app-mobile/app/(tabs)/settings.tsx`

- [ ] **Step 1: Tab bar config**

Create `app-mobile/app/(tabs)/_layout.tsx`:
```tsx
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../src/theme/colors";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.terracotta,
        tabBarInactiveTintColor: colors.inkSoft,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.line,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="documents"
        options={{
          title: "Documents",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="document-text" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
```

- [ ] **Step 2: Documents screen skeleton**

Create `app-mobile/app/(tabs)/documents.tsx`:
```tsx
import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Documents() {
  return (
    <SafeAreaView className="flex-1 bg-cream">
      <View className="px-5 pt-4">
        <Text className="font-semibold text-2xl text-ink">Documents</Text>
        <Text className="mt-2 text-ink-soft">
          Yahan aapke saved documents aur unki expiry aayegi.
        </Text>
      </View>
    </SafeAreaView>
  );
}
```

- [ ] **Step 3: Settings screen skeleton**

Create `app-mobile/app/(tabs)/settings.tsx`:
```tsx
import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Settings() {
  return (
    <SafeAreaView className="flex-1 bg-cream">
      <View className="px-5 pt-4">
        <Text className="font-semibold text-2xl text-ink">Settings</Text>
        <Text className="mt-2 text-ink-soft">
          Privacy, data delete, saathi ka naam — yahan.
        </Text>
      </View>
    </SafeAreaView>
  );
}
```

- [ ] **Step 4: Verify tabs render**

Run: `npx expo start` → Expo Go. Expected: 3 tabs (Home, Documents, Settings) neeche dikhe, terracotta active color. `Ctrl+C`.

- [ ] **Step 5: Commit**

```bash
git add "app-mobile/app/(tabs)"
git commit -m "feat(app): bottom tabs with Documents + Settings skeletons"
```

---

### Task 8: Home screen (daily brief card + chat entry)

**Files:**
- Create/Modify: `app-mobile/app/(tabs)/index.tsx`

- [ ] **Step 1: Build the Home screen**

Create/replace `app-mobile/app/(tabs)/index.tsx`:
```tsx
import { View, Text, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors } from "../../src/theme/colors";

export default function Home() {
  const router = useRouter();
  return (
    <SafeAreaView className="flex-1 bg-cream">
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        {/* Greeting */}
        <Text className="font-semibold text-3xl text-ink">Namaste 👋</Text>
        <Text className="mt-1 text-ink-soft">Aaj ka aapka Saathi brief</Text>

        {/* Daily brief card */}
        <View className="mt-5 rounded-3xl bg-ink p-5">
          <Text className="text-lg font-semibold text-cream">
            Good morning ☀️
          </Text>
          <Text className="mt-2 leading-6 text-cream/80">
            Aaj 2 kaam hain. Car insurance is hafte expire ho raha hai — dhyan
            rakhna.
          </Text>
        </View>

        {/* Chat entry */}
        <Pressable
          onPress={() => router.push("/chat")}
          className="mt-4 flex-row items-center gap-3 rounded-3xl border border-line bg-surface p-4 active:opacity-80"
        >
          <View className="h-11 w-11 items-center justify-center rounded-2xl bg-terracotta">
            <Ionicons name="heart" size={20} color={colors.surface} />
          </View>
          <View className="flex-1">
            <Text className="font-semibold text-ink">Saathi se baat karo</Text>
            <Text className="text-ink-soft">Type karo ya bol ke poocho</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.inkSoft} />
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Verify Home renders + navigates**

Run: `npx expo start` → Home tab. Expected: greeting, dark brief card, "Saathi se baat karo" button. Button dabane pe chat screen khule (agla task). `Ctrl+C`.

- [ ] **Step 3: Commit**

```bash
git add "app-mobile/app/(tabs)/index.tsx"
git commit -m "feat(app): Home screen with daily brief card + chat entry"
```

---

### Task 9: Chat screen skeleton (UI only — no AI yet)

**Files:**
- Create: `app-mobile/app/chat.tsx`

- [ ] **Step 1: Build the chat UI (static bubbles + input, no backend)**

Create `app-mobile/app/chat.tsx`:
```tsx
import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors } from "../src/theme/colors";

type Msg = { id: string; role: "user" | "saathi"; text: string };

export default function Chat() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([
    { id: "1", role: "saathi", text: "Namaste! Main aapka Saathi. Kya yaad rakhna hai?" },
  ]);

  function send() {
    const text = input.trim();
    if (!text) return;
    // NOTE: AI reply agle phase mein — abhi sirf echo placeholder
    setMessages((m) => [
      ...m,
      { id: String(m.length + 1), role: "user", text },
      { id: String(m.length + 2), role: "saathi", text: "Theek hai, yaad rakh liya 👍 (AI jald aayega)" },
    ]);
    setInput("");
  }

  return (
    <SafeAreaView className="flex-1 bg-cream">
      {/* header */}
      <View className="flex-row items-center gap-3 border-b border-line px-4 py-3">
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </Pressable>
        <View className="h-9 w-9 items-center justify-center rounded-2xl bg-terracotta">
          <Ionicons name="heart" size={16} color={colors.surface} />
        </View>
        <Text className="font-semibold text-lg text-ink">Saathi</Text>
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
          {messages.map((m) => (
            <View
              key={m.id}
              className={
                m.role === "user"
                  ? "self-end max-w-[80%] rounded-2xl rounded-br-md bg-terracotta px-4 py-2.5"
                  : "self-start max-w-[80%] rounded-2xl rounded-bl-md bg-surface border border-line px-4 py-2.5"
              }
            >
              <Text className={m.role === "user" ? "text-white" : "text-ink"}>
                {m.text}
              </Text>
            </View>
          ))}
        </ScrollView>

        {/* input bar */}
        <View className="flex-row items-center gap-2 border-t border-line px-3 py-2.5">
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Kuch bhi bolo..."
            placeholderTextColor={colors.inkSoft}
            className="flex-1 rounded-2xl border border-line bg-surface px-4 py-3 text-ink"
            onSubmitEditing={send}
          />
          <Pressable
            onPress={send}
            className="h-12 w-12 items-center justify-center rounded-2xl bg-terracotta active:opacity-80"
          >
            <Ionicons name="arrow-up" size={20} color={colors.surface} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Verify chat UI**

Run: `npx expo start` → Home → "Saathi se baat karo". Expected: chat khule, message type karke send karo → user bubble + placeholder saathi reply dikhe. Back button kaam kare. `Ctrl+C`.

- [ ] **Step 3: Commit**

```bash
git add app-mobile/app/chat.tsx
git commit -m "feat(app): chat screen skeleton (UI only)"
```

---

### Task 10: EAS build setup (store-ready builds ke liye taiyaari)

**Files:**
- Create: `app-mobile/eas.json` (eas cli banata hai)
- Modify: `app-mobile/app.json`

- [ ] **Step 1: Install EAS CLI + login**

Run:
```bash
npm install -g eas-cli
eas login
```
Expected: Expo account se login (free account [expo.dev](https://expo.dev) pe banao). 

- [ ] **Step 2: Configure the project for builds**

Run (`app-mobile/` se):
```bash
eas build:configure
```
Expected: `eas.json` ban jaye, `app.json` mein project id add ho.

- [ ] **Step 3: Set app identity in app.json**

Modify `app-mobile/app.json` — ensure ye fields:
```json
{
  "expo": {
    "name": "Saathi",
    "slug": "saathi",
    "android": { "package": "com.yourname.saathi" }
  }
}
```
(`com.yourname.saathi` ko apne unique naam se badlo.)

- [ ] **Step 4: (Optional) Build a preview APK to test on real device**

Run:
```bash
eas build -p android --profile preview
```
Expected: Cloud mein build ho, ek installable APK link mile. (Ye Play Store ke liye nahi — sirf khud test karne ke liye. Store ke liye baad mein `--profile production` + `eas submit`.)

- [ ] **Step 5: Commit**

```bash
git add app-mobile/eas.json app-mobile/app.json
git commit -m "chore(app): EAS build configuration"
```

---

## Definition of Done (Phase 1)

- `npx expo start` → app Expo Go mein chalta hai
- 3 tabs (Home, Documents, Settings), warm theme
- Home pe daily brief card + chat entry
- Chat screen — type/send kaam karta hai (placeholder reply)
- Supabase client wired (env se)
- `npm test` → expiry util tests pass
- EAS configured (store build ke liye taiyaar)
- Sab kuch commit + GitHub pe push

---

## Next Phases (alag plans, jab yahan tak pahunchein)

- **Phase 2 — Chat + AI:** Supabase Edge Function `/chat` (Gemini Flash), messages table, streaming reply, real memory.
- **Phase 3 — Documents:** camera/upload, Edge Function `/scan-document` (Gemini vision → expiry), documents table + storage (private, RLS), Documents screen real data.
- **Phase 4 — Reminders + Notifications:** expo-notifications, expiry reminders (1 month/1 week/on-expiry), natural-language reminders.
- **Phase 5 — Daily Brief:** scheduled function, morning push.
- **Phase 6 — Voice:** speech-to-text input + text-to-speech reply.
- **Phase 7 — Auth + Privacy:** login, RLS, data export/delete, consent.
