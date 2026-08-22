# In-App Payment (GPB) + Profile Details + Local Documents — Implementation Plan (v2)

**Goal:** Web pe plan button "App download karo" modal khole (koi web payment nahi), GST 18% comment out, billing/details form app me aaye (Supabase me save), aur payment app ke andar Google Play Billing (RevenueCat) se ho. Saath me document ki actual file local folder me save + full-screen view.

**Architecture:** Web (Next.js) sirf marketing — plan CTA modal, checkout page commented out. Payment app me RevenueCat (`react-native-purchases`, GPB wrapper), profile details Supabase `user_details` (per-user upsert, own-row RLS). Location cascade app se direct Supabase (public-read tables). Phone validation `libphonenumber-js` (pure JS). Documents `expo-file-system` se local copy.

**Tech Stack:** Next.js 14, Supabase (web REST fetch / app supabase-js), RevenueCat `react-native-purchases`, `libphonenumber-js`, Expo v57, expo-file-system, expo-router.

**Testing note:** Repo me koi test runner nahi (na web na app). Verification = `npm run lint`/`npm run build` (web) + `npx tsc --noEmit` + manual Expo run. Naya test framework add mat karo.

**⚠️ USER prerequisites (code se bahar — inke bina payment ship/test nahi hoga):**
1. Google Play Console: app internal-testing track pe; `plus_monthly` + `plus_yearly` subscription products.
2. Merchant/payments profile.
3. **EAS development build** (`eas build --profile development`) — Expo Go se GPB nahi chalega.
4. RevenueCat: project + Play link + Android API key → `.env` me `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`; entitlement id `plus`; offering with the two packages.

Code aisa likha hai ki RevenueCat/native module na mile (Expo Go) to app crash na ho — upgrade button gracefully "abhi available nahi" dikhaye.

---

## File Structure

**Create:**
- `supabase/locations-billing.sql` — countries/states/cities + user_details
- `app-mobile/src/lib/user-details.ts` — location cascade + user_details CRUD
- `app-mobile/src/lib/purchases.ts` — RevenueCat wrapper (safe)
- `app-mobile/src/components/phone-field.tsx` — country-code + phone input (libphonenumber-js)
- `app-mobile/src/app/profile-details.tsx` — details form screen
- `app-mobile/src/app/document-view.tsx` — full-screen document viewer

**Modify:**
- `supabase/schema.sql` — `documents.file_uri`
- `web/components/Pricing.tsx` — GST comment-out + "Download app" modal
- `web/app/checkout/page.tsx` — CheckoutClient comment-out + redirect
- `app-mobile/src/app/(tabs)/settings.tsx` — "Meri details" row
- `app-mobile/src/app/upgrade.tsx` — GST comment-out + details-check + RevenueCat purchase
- `app-mobile/src/lib/plan.ts` — `markProfilePlus()`
- `app-mobile/src/lib/documents.ts` — `file_uri`
- `app-mobile/src/app/add-document.tsx` — local copy
- `app-mobile/src/components/doc-card.tsx` — `onPress`
- `app-mobile/src/app/(tabs)/documents.tsx` + `index.tsx` — card tap → view
- `web/components/CheckoutClient.tsx` — (rehne do, unused; koi edit nahi)

---

## Phase A — Database

### Task 1: Locations + user_details SQL

**Files:** Create `supabase/locations-billing.sql`

- [ ] **Step 1: Create the file**

```sql
-- Saathi — Locations (country/state/city cascade) + per-user details
-- Supabase SQL Editor mein Run karo. (Dobara run safe hai.)

create table if not exists public.countries (
  id serial primary key,
  name text not null,
  code text unique
);
create table if not exists public.states (
  id serial primary key,
  country_id int not null references public.countries(id) on delete cascade,
  name text not null
);
create index if not exists states_country_idx on public.states(country_id);
create table if not exists public.cities (
  id serial primary key,
  state_id int not null references public.states(id) on delete cascade,
  name text not null
);
create index if not exists cities_state_idx on public.cities(state_id);

-- Per-user details (checkout/profile) — ek row per user, upsert.
create table if not exists public.user_details (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  phone text,                 -- E.164, jaise +919876543210
  phone_dial_code text,       -- +91
  phone_country text,         -- IN
  address text,
  gender text,
  country_id int references public.countries(id),
  state_id int references public.states(id),
  city_id int references public.cities(id),
  updated_at timestamptz not null default now()
);

-- RLS: location tables public-read (dropdown), user_details own-row.
alter table public.countries enable row level security;
alter table public.states enable row level security;
alter table public.cities enable row level security;
alter table public.user_details enable row level security;

drop policy if exists "read countries" on public.countries;
drop policy if exists "read states" on public.states;
drop policy if exists "read cities" on public.cities;
drop policy if exists "own user_details" on public.user_details;

create policy "read countries" on public.countries for select using (true);
create policy "read states" on public.states for select using (true);
create policy "read cities" on public.cities for select using (true);
create policy "own user_details" on public.user_details for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

- [ ] **Step 2: Run in Supabase SQL Editor.** Expected: Success; dobara run bhi success.

- [ ] **Step 3: Commit**

```bash
git add supabase/locations-billing.sql
git commit -m "feat(db): countries/states/cities + per-user user_details"
```

### Task 2: documents.file_uri column

**Files:** Modify `supabase/schema.sql`

- [ ] **Step 1:** documents `create table` block ke baad (line 11 ke baad) add karo:

```sql
-- Document ki local file ka path (app device pe). Abhi cloud pe nahi.
alter table public.documents add column if not exists file_uri text;
```

- [ ] **Step 2:** Supabase me Run karo. Expected: Success, column dikhe.

- [ ] **Step 3: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat(db): documents.file_uri column"
```

---

## Phase B — Web (GST comment-out + download modal + checkout off)

### Task 3: Pricing — GST comment-out + "Download app" modal

**Files:** Modify `web/components/Pricing.tsx`

- [ ] **Step 1: Comment out the gstTotal helper**

Top pe `function gstTotal(...) {...}` block ko comment karo (delete nahi):

```tsx
// GST abhi comment out — humare paas GST registration nahi, isliye user se nahi lenge.
// function gstTotal(price: string): string {
//   const n = Number(price.replace(/[^0-9.]/g, ""));
//   if (!n) return price;
//   const total = Math.round(n * 1.18);
//   return `₹${total.toLocaleString("en-IN")}`;
// }
```

- [ ] **Step 2: Add modal state + import**

`import { useState } from "react";` pehle se hai. `useT` line ke baad, component ke andar top pe add karo:

```tsx
  const [showDownload, setShowDownload] = useState(false);
```

- [ ] **Step 3: Comment out the GST note block**

`{showGst && (...)}` waale poore block ko comment karo. `const showGst = ...` line bhi comment:

```tsx
              {/* GST abhi off:
              const showGst = plan.gst && price !== "₹0";
              {showGst && (
                <p className={...}>{t.gstNote} · Total {gstTotal(price)}{period}</p>
              )} */}
```

(Practically: `const showGst` line ko `// const showGst = ...` karo, aur JSX block ko `{/* ... */}` me wrap karo.)

- [ ] **Step 4: CTA button — modal kholo (checkout/waitlist ke bajaye)**

CTA ko `<a href=...>` se `<button>` me badlo:

```tsx
              <button
                type="button"
                onClick={() => setShowDownload(true)}
                className={`mt-7 inline-flex h-12 items-center justify-center rounded-2xl px-6 text-sm font-semibold transition active:scale-[0.98] ${
                  highlight
                    ? "bg-terracotta text-white shadow-warm hover:bg-terracotta-dark"
                    : "border border-ink bg-transparent text-ink hover:bg-ink hover:text-cream"
                }`}
              >
                {plan.cta}
              </button>
```

- [ ] **Step 5: Add the download modal at end of the component**

Outer `<div>` ke closing se pehle (return ke andar, `<p className="... mt-6 ...">{t.note}</p>` ke baad) add karo:

```tsx
      {showDownload && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 px-5 backdrop-blur-sm"
          onClick={() => setShowDownload(false)}
        >
          <div
            className="w-full max-w-sm rounded-4xl border border-line bg-surface p-7 text-center shadow-warm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-terracotta/10 text-terracotta">
              <Sparkles size={30} />
            </div>
            <h3 className="mt-5 font-display text-2xl font-semibold">
              Saathi ab app pe hai 📱
            </h3>
            <p className="mt-2.5 text-ink-soft">
              Plus subscription aur saare features Saathi app ke andar milte hain.
              Play Store se app download karo aur seedhe app se hi upgrade karo — bilkul
              secure, Google Play ke through.
            </p>
            <a
              href="https://play.google.com/store/apps/details?id=app.saathi"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-terracotta px-6 text-sm font-semibold text-white shadow-warm transition hover:bg-terracotta-dark"
            >
              Play Store se download karo
            </a>
            <button
              type="button"
              onClick={() => setShowDownload(false)}
              className="mt-3 text-sm font-semibold text-ink-soft hover:text-ink"
            >
              Abhi nahi
            </button>
          </div>
        </div>
      )}
```

(`Sparkles` pehle se `lucide-react` se imported hai is file me.)

- [ ] **Step 6: Build + manual verify**

Run: `cd web && npx tsc --noEmit && npm run build` → success.
Run: `npm run dev` → Pricing me price sirf base (`₹99`/`₹999`), koi "+18% GST/Total" nahi. Plan button dabao → download modal khule. Play Store link naye tab me khule; backdrop/"Abhi nahi" se band ho.

- [ ] **Step 7: Commit**

```bash
git add web/components/Pricing.tsx
git commit -m "feat(web): plans open download-app modal; comment out GST"
```

### Task 4: Checkout page comment-out

**Files:** Modify `web/app/checkout/page.tsx`

- [ ] **Step 1: Replace page body — comment out CheckoutClient, redirect home**

```tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
// import { Suspense } from "react";
// import CheckoutClient from "@/components/CheckoutClient";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

// NOTE: Web checkout abhi OFF hai — payment app ke andar (Google Play Billing) hota hai.
// CheckoutClient code delete nahi kiya, baad me kaam aa sakta hai.
export default function CheckoutPage() {
  redirect("/");

  // return (
  //   <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-cream" />}>
  //     <CheckoutClient />
  //   </Suspense>
  // );
}
```

- [ ] **Step 2: Build.** Run: `cd web && npm run build` → success. `/checkout` kholte hi `/` pe redirect ho.

- [ ] **Step 3: Commit**

```bash
git add web/app/checkout/page.tsx
git commit -m "feat(web): comment out web checkout, redirect to home"
```

---

## Phase C — App: Profile details form

### Task 5: libphonenumber-js + user-details lib

**Files:** Modify `app-mobile/package.json`; Create `app-mobile/src/lib/user-details.ts`

- [ ] **Step 1: Install libphonenumber-js**

Run: `cd app-mobile && npx expo install libphonenumber-js`
Expected: `libphonenumber-js` `dependencies` me.

- [ ] **Step 2: Create the lib**

`app-mobile/src/lib/user-details.ts`:

```ts
import { supabase } from "./supabase";

export type LocationItem = { id: number; name: string };

export type UserDetails = {
  full_name: string;
  email: string;
  phone: string;
  phone_dial_code: string | null;
  phone_country: string | null;
  address: string;
  gender: string;
  country_id: number | null;
  state_id: number | null;
  city_id: number | null;
};

function client() {
  if (!supabase) throw new Error("Supabase set nahi hai (.env check karo)");
  return supabase;
}

export async function getCountries(): Promise<LocationItem[]> {
  const { data, error } = await client()
    .from("countries").select("id,name").order("name");
  if (error) throw error;
  return (data ?? []) as LocationItem[];
}
export async function getStates(countryId: number): Promise<LocationItem[]> {
  const { data, error } = await client()
    .from("states").select("id,name").eq("country_id", countryId).order("name");
  if (error) throw error;
  return (data ?? []) as LocationItem[];
}
export async function getCities(stateId: number): Promise<LocationItem[]> {
  const { data, error } = await client()
    .from("cities").select("id,name").eq("state_id", stateId).order("name");
  if (error) throw error;
  return (data ?? []) as LocationItem[];
}

export async function getUserDetails(): Promise<UserDetails | null> {
  const sb = client();
  const { data: u } = await sb.auth.getUser();
  const uid = u.user?.id;
  if (!uid) return null;
  const { data } = await sb
    .from("user_details").select("*").eq("user_id", uid).maybeSingle();
  return (data as UserDetails) ?? null;
}

export async function saveUserDetails(d: UserDetails): Promise<void> {
  const sb = client();
  const { data: u } = await sb.auth.getUser();
  const uid = u.user?.id;
  if (!uid) throw new Error("Login zaroori hai");
  const { error } = await sb.from("user_details").upsert(
    { user_id: uid, ...d, updated_at: new Date().toISOString() },
    { onConflict: "user_id" },
  );
  if (error) throw error;
}

export function isDetailsComplete(d: UserDetails | null): boolean {
  return (
    !!d && !!d.full_name && !!d.phone && !!d.address && !!d.gender && !!d.city_id
  );
}
```

- [ ] **Step 3: Typecheck.** Run: `cd app-mobile && npx tsc --noEmit` → no errors.

- [ ] **Step 4: Commit**

```bash
git add app-mobile/package.json app-mobile/package-lock.json app-mobile/src/lib/user-details.ts
git commit -m "feat(app): libphonenumber-js + user-details lib (locations + CRUD)"
```

### Task 6: PhoneField component

**Files:** Create `app-mobile/src/components/phone-field.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useMemo, useState } from "react";
import {
  View, Text, TextInput, Pressable, Modal, FlatList, StyleSheet,
} from "react-native";
import { getCountries, getCountryCallingCode, type CountryCode } from "libphonenumber-js";
import { colors } from "@/theme/colors";

function flag(cc: string) {
  return cc
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

export function PhoneField({
  country, onCountry, national, onNational,
}: {
  country: CountryCode;
  onCountry: (c: CountryCode) => void;
  national: string;
  onNational: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    const all = getCountries().map((c) => ({
      cc: c,
      code: getCountryCallingCode(c),
    }));
    if (!q) return all;
    const s = q.toLowerCase();
    return all.filter(
      (x) => x.cc.toLowerCase().includes(s) || x.code.includes(s),
    );
  }, [q]);

  return (
    <View style={styles.row}>
      <Pressable style={styles.codeBtn} onPress={() => setOpen(true)}>
        <Text style={styles.codeText}>
          {flag(country)} +{getCountryCallingCode(country)}
        </Text>
      </Pressable>
      <TextInput
        style={styles.input}
        value={national}
        onChangeText={onNational}
        placeholder="Phone number"
        placeholderTextColor={colors.inkSoft}
        keyboardType="phone-pad"
      />

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.modal}>
          <TextInput
            style={styles.search}
            value={q}
            onChangeText={setQ}
            placeholder="Country ya code search karo"
            placeholderTextColor={colors.inkSoft}
            autoFocus
          />
          <FlatList
            data={list}
            keyExtractor={(i) => i.cc}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                style={styles.item}
                onPress={() => {
                  onCountry(item.cc as CountryCode);
                  setOpen(false);
                  setQ("");
                }}
              >
                <Text style={styles.itemText}>
                  {flag(item.cc)}  {item.cc}  +{item.code}
                </Text>
              </Pressable>
            )}
          />
          <Pressable style={styles.close} onPress={() => setOpen(false)}>
            <Text style={styles.closeText}>Band karo</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8 },
  codeBtn: {
    justifyContent: "center",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
  },
  codeText: { fontSize: 15, fontWeight: "600", color: colors.ink },
  input: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: colors.ink,
    fontSize: 15,
  },
  modal: { flex: 1, backgroundColor: colors.cream, paddingTop: 60, paddingHorizontal: 16 },
  search: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: colors.ink,
    fontSize: 15,
    marginBottom: 10,
  },
  item: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.line },
  itemText: { fontSize: 15, color: colors.ink },
  close: { alignItems: "center", paddingVertical: 16 },
  closeText: { fontSize: 15, fontWeight: "700", color: colors.terracotta },
});
```

- [ ] **Step 2: Typecheck.** `cd app-mobile && npx tsc --noEmit` → no errors.

- [ ] **Step 3: Commit**

```bash
git add app-mobile/src/components/phone-field.tsx
git commit -m "feat(app): country-code phone field (libphonenumber-js)"
```

### Task 7: profile-details screen

**Files:** Create `app-mobile/src/app/profile-details.tsx`

- [ ] **Step 1: Create the screen**

```tsx
import { useEffect, useState } from "react";
import {
  View, Text, TextInput, Pressable, ScrollView, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import {
  isValidPhoneNumber, parsePhoneNumberFromString,
  getCountryCallingCode, type CountryCode,
} from "libphonenumber-js";

import { colors } from "@/theme/colors";
import { useToast } from "@/components/toast";
import { useAuth } from "@/components/auth-provider";
import { PhoneField } from "@/components/phone-field";
import {
  getCountries, getStates, getCities, getUserDetails, saveUserDetails,
  type LocationItem,
} from "@/lib/user-details";

const GENDERS = [
  { key: "male", label: "Male" },
  { key: "female", label: "Female" },
  { key: "other", label: "Other" },
];

export default function ProfileDetails() {
  const toast = useToast();
  const { session } = useAuth();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState(session?.user?.email ?? "");
  const [phoneCountry, setPhoneCountry] = useState<CountryCode>("IN");
  const [phoneNational, setPhoneNational] = useState("");
  const [address, setAddress] = useState("");
  const [gender, setGender] = useState("");

  const [countries, setCountries] = useState<LocationItem[]>([]);
  const [states, setStates] = useState<LocationItem[]>([]);
  const [cities, setCities] = useState<LocationItem[]>([]);
  const [countryId, setCountryId] = useState<number | null>(null);
  const [stateId, setStateId] = useState<number | null>(null);
  const [cityId, setCityId] = useState<number | null>(null);

  // Initial load: countries + existing details
  useEffect(() => {
    (async () => {
      try {
        const [cs, existing] = await Promise.all([getCountries(), getUserDetails()]);
        setCountries(cs);
        if (existing) {
          setFullName(existing.full_name ?? "");
          setEmail(existing.email ?? email);
          setAddress(existing.address ?? "");
          setGender(existing.gender ?? "");
          if (existing.phone_country) setPhoneCountry(existing.phone_country as CountryCode);
          if (existing.phone && existing.phone_dial_code) {
            setPhoneNational(existing.phone.replace(existing.phone_dial_code, ""));
          }
          if (existing.country_id) {
            setCountryId(existing.country_id);
            const st = await getStates(existing.country_id);
            setStates(st);
          }
          if (existing.state_id) {
            setStateId(existing.state_id);
            const ct = await getCities(existing.state_id);
            setCities(ct);
          }
          if (existing.city_id) setCityId(existing.city_id);
        }
      } catch {
        toast.show("Details load nahi hui", "error");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function pickCountry(id: number) {
    setCountryId(id); setStateId(null); setCityId(null); setStates([]); setCities([]);
    try { setStates(await getStates(id)); } catch { /* ignore */ }
  }
  async function pickState(id: number) {
    setStateId(id); setCityId(null); setCities([]);
    try { setCities(await getCities(id)); } catch { /* ignore */ }
  }

  const dial = `+${getCountryCallingCode(phoneCountry)}`;
  const fullPhone = `${dial}${phoneNational.replace(/\D/g, "")}`;
  const phoneOk = phoneNational.length > 0 && isValidPhoneNumber(fullPhone, phoneCountry);
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const valid =
    fullName.trim().length > 1 && emailOk && phoneOk &&
    address.trim().length > 3 && !!gender && !!countryId && !!stateId && !!cityId;

  async function onSave() {
    if (saving) return;
    if (!valid) { toast.show("Saare fields sahi se bharo", "info"); return; }
    setSaving(true);
    try {
      const parsed = parsePhoneNumberFromString(fullPhone, phoneCountry);
      await saveUserDetails({
        full_name: fullName.trim(),
        email: email.trim(),
        phone: parsed?.number ?? fullPhone,
        phone_dial_code: dial,
        phone_country: phoneCountry,
        address: address.trim(),
        gender,
        country_id: countryId,
        state_id: stateId,
        city_id: cityId,
      });
      toast.show("Details save ho gayi ✅", "success");
      if (returnTo) router.replace(returnTo as never);
      else router.back();
    } catch {
      toast.show("Save nahi hua", "error");
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = styles.input;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.title}>Meri details</Text>
        <View style={{ width: 22 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.terracotta} style={{ marginTop: 40 }} />
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <Text style={styles.label}>Poora naam</Text>
            <TextInput style={inputStyle} value={fullName} onChangeText={setFullName} placeholder="Aapka naam" placeholderTextColor={colors.inkSoft} />

            <Text style={styles.label}>Email</Text>
            <TextInput style={inputStyle} value={email} onChangeText={setEmail} placeholder="you@email.com" placeholderTextColor={colors.inkSoft} keyboardType="email-address" autoCapitalize="none" />

            <Text style={styles.label}>Phone number</Text>
            <PhoneField country={phoneCountry} onCountry={setPhoneCountry} national={phoneNational} onNational={setPhoneNational} />
            {phoneNational.length > 0 && !phoneOk && (
              <Text style={styles.err}>Sahi phone number daalo</Text>
            )}

            <Text style={styles.label}>Address</Text>
            <TextInput style={[inputStyle, { height: 72 }]} value={address} onChangeText={setAddress} placeholder="Ghar / office ka pata" placeholderTextColor={colors.inkSoft} multiline />

            <Text style={styles.label}>Gender</Text>
            <View style={styles.chips}>
              {GENDERS.map((g) => (
                <Pressable key={g.key} onPress={() => setGender(g.key)} style={[styles.chip, gender === g.key && styles.chipActive]}>
                  <Text style={[styles.chipText, gender === g.key && styles.chipTextActive]}>{g.label}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Country</Text>
            <SelectRow items={countries} value={countryId} placeholder={countries.length ? "Country chuno" : "Data import karo"} onSelect={pickCountry} />

            <Text style={styles.label}>State</Text>
            <SelectRow items={states} value={stateId} placeholder={countryId ? "State chuno" : "Pehle country"} onSelect={pickState} disabled={!countryId} />

            <Text style={styles.label}>City</Text>
            <SelectRow items={cities} value={cityId} placeholder={stateId ? "City chuno" : "Pehle state"} onSelect={setCityId} disabled={!stateId} />

            <View style={{ height: 20 }} />
          </ScrollView>

          <Pressable onPress={onSave} disabled={saving || !valid} style={({ pressed }) => [styles.save, (pressed || saving || !valid) && { opacity: 0.6 }]}>
            {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveText}>Save karo</Text>}
          </Pressable>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

// Simple inline select (chips-wrap). Small lists ke liye theek.
function SelectRow({
  items, value, placeholder, onSelect, disabled,
}: {
  items: LocationItem[];
  value: number | null;
  placeholder: string;
  onSelect: (id: number) => void;
  disabled?: boolean;
}) {
  if (disabled || items.length === 0) {
    return <Text style={styles.selectEmpty}>{placeholder}</Text>;
  }
  return (
    <View style={styles.chips}>
      {items.map((it) => (
        <Pressable key={it.id} onPress={() => onSelect(it.id)} style={[styles.chip, value === it.id && styles.chipActive]}>
          <Text style={[styles.chipText, value === it.id && styles.chipTextActive]}>{it.name}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
  },
  back: { padding: 4 },
  title: { fontSize: 18, fontWeight: "700", color: colors.ink },
  content: { padding: 20, paddingBottom: 20 },
  label: { marginTop: 18, marginBottom: 8, fontSize: 15, fontWeight: "700", color: colors.ink },
  input: {
    borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface,
    paddingHorizontal: 16, paddingVertical: 14, color: colors.ink, fontSize: 15,
  },
  err: { marginTop: 6, fontSize: 13, color: colors.terracotta, fontWeight: "600" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface,
    paddingHorizontal: 16, paddingVertical: 9,
  },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontSize: 13.5, fontWeight: "600", color: colors.inkSoft },
  chipTextActive: { color: colors.cream },
  selectEmpty: { fontSize: 14, color: colors.inkSoft, fontStyle: "italic" },
  save: {
    margin: 20, marginTop: 8, alignItems: "center", justifyContent: "center",
    height: 54, borderRadius: 18, backgroundColor: colors.terracotta,
  },
  saveText: { color: colors.white, fontWeight: "700", fontSize: 16 },
});
```

- [ ] **Step 2: Typecheck.** `cd app-mobile && npx tsc --noEmit` → no errors.

- [ ] **Step 3: Manual verify (Expo Go OK).** `npx expo start`. `profile-details` par jaake (Task 7 ke baad settings se): fields dikhein, phone country picker khule, galat phone pe error, cascade country→state→city (data import hone par). Save → toast.

- [ ] **Step 4: Commit**

```bash
git add app-mobile/src/app/profile-details.tsx
git commit -m "feat(app): profile details form (phone + cascade) saved to user_details"
```

### Task 8: Settings "Meri details" row

**Files:** Modify `app-mobile/src/app/(tabs)/settings.tsx`

- [ ] **Step 1: Add a details row above the plan card**

`settings.tsx` me plan `<Pressable>` (`onPress={() => router.push("/upgrade" ...)}`) ke turant pehle add karo:

```tsx
        <Pressable
          onPress={() => router.push("/profile-details" as never)}
          style={({ pressed }) => [styles.detailsRow, pressed && { opacity: 0.9 }]}
        >
          <Ionicons name="person-outline" size={20} color={colors.terracotta} />
          <Text style={styles.detailsText}>Meri details (name, phone, address…)</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.line} />
        </Pressable>
```

- [ ] **Step 2: Add styles**

`StyleSheet.create({...})` me add karo:

```tsx
  detailsRow: {
    flexDirection: "row", alignItems: "center", gap: 12, marginTop: 22,
    borderRadius: 16, borderWidth: 1, borderColor: colors.line,
    backgroundColor: colors.surface, paddingHorizontal: 16, paddingVertical: 15,
  },
  detailsText: { flex: 1, fontSize: 15, fontWeight: "600", color: colors.ink },
```

- [ ] **Step 3: Typecheck + verify.** `npx tsc --noEmit` → ok. App: Settings me "Meri details" row dikhe, tap → form khule.

- [ ] **Step 4: Commit**

```bash
git add "app-mobile/src/app/(tabs)/settings.tsx"
git commit -m "feat(app): settings 'Meri details' entry"
```

---

## Phase D — App: Payment (RevenueCat / GPB)

### Task 9: RevenueCat dep + purchases wrapper + plan.markProfilePlus

**Files:** Modify `app-mobile/package.json`, `app-mobile/src/lib/plan.ts`; Create `app-mobile/src/lib/purchases.ts`

- [ ] **Step 1: Install react-native-purchases**

Run: `cd app-mobile && npx expo install react-native-purchases`
Expected: dep added. (Autolinked in a dev build; Expo Go me native calls no-op honge — wrapper handle karta hai. Alag Expo config plugin ki zaroorat nahi.)

- [ ] **Step 2: Create the safe wrapper**

`app-mobile/src/lib/purchases.ts`:

```ts
/**
 * RevenueCat (Google Play Billing) wrapper — safe.
 * Native module na mile (Expo Go) ya API key na ho to sab no-op.
 * Prereq: EXPO_PUBLIC_REVENUECAT_ANDROID_KEY, entitlement "plus", offering with packages.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Purchases: any = null;
try {
  // Expo Go me ye throw kar sakta hai — catch me handle.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Purchases = require("react-native-purchases").default;
} catch {
  Purchases = null;
}

const API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? "";
const ENTITLEMENT = "plus";
let configured = false;

export function purchasesAvailable(): boolean {
  return Boolean(Purchases && API_KEY);
}

export async function initPurchases(appUserId?: string): Promise<void> {
  if (!purchasesAvailable() || configured) return;
  try {
    await Purchases.configure({ apiKey: API_KEY, appUserID: appUserId });
    configured = true;
  } catch {
    /* ignore */
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getPlusPackages(): Promise<any[]> {
  if (!purchasesAvailable()) return [];
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current?.availablePackages ?? [];
  } catch {
    return [];
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function purchasePlus(pkg: any): Promise<boolean> {
  if (!purchasesAvailable()) throw new Error("purchases unavailable");
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return Boolean(customerInfo.entitlements.active[ENTITLEMENT]);
}

export async function isPlusActive(): Promise<boolean> {
  if (!purchasesAvailable()) return false;
  try {
    const info = await Purchases.getCustomerInfo();
    return Boolean(info.entitlements.active[ENTITLEMENT]);
  } catch {
    return false;
  }
}
```

- [ ] **Step 3: Add markProfilePlus to plan.ts**

`app-mobile/src/lib/plan.ts` ke end me add karo:

```ts
/** Purchase success ke baad profiles.plan = plus set karo (webhook aane tak bridge). */
export async function markProfilePlus(): Promise<void> {
  const sb = client();
  const { data: userData } = await sb.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return;
  await sb
    .from("profiles")
    .update({ plan: "plus", plan_source: "google_play" })
    .eq("id", uid);
}
```

- [ ] **Step 4: Typecheck.** `npx tsc --noEmit` → no errors.

- [ ] **Step 5: Commit**

```bash
git add app-mobile/package.json app-mobile/package-lock.json app-mobile/src/lib/purchases.ts app-mobile/src/lib/plan.ts
git commit -m "feat(app): RevenueCat wrapper + markProfilePlus bridge"
```

### Task 10: Rewire upgrade.tsx (GST off + details-check + purchase)

**Files:** Modify `app-mobile/src/app/upgrade.tsx`

- [ ] **Step 1: Swap imports**

`upgrade.tsx` top imports me — web-checkout waale hatao, naye jodo. In lines ko:

```ts
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { buildCheckoutUrl, getPlan, type PlanId } from "@/lib/plan";
```

is se replace karo:

```ts
import { getPlan, markProfilePlus } from "@/lib/plan";
import {
  purchasesAvailable, initPurchases, getPlusPackages, purchasePlus,
} from "@/lib/purchases";
import { getUserDetails, isDetailsComplete } from "@/lib/user-details";
```

- [ ] **Step 2: Init RevenueCat on mount**

`useEffect(() => { refresh(); }, []);` ko is se replace karo:

```ts
  useEffect(() => {
    refresh();
    initPurchases(session?.user?.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```

- [ ] **Step 3: Comment out GST math + display**

Line `const total = Math.round(base * 1.18);` ko comment karo:

```ts
  // GST abhi off (registration nahi) — base price hi lenge.
  // const total = Math.round(base * 1.18);
```

Gst `<Text style={styles.gst}>...</Text>` line ko comment karo:

```tsx
              {/* <Text style={styles.gst}>+ 18% GST · Total ₹{total}{period}</Text> */}
```

Pay button ka text `₹{total} — Securely pay` ko `₹{base} — Securely pay` karo:

```tsx
                    <Text style={styles.payText}>₹{base} — Securely pay</Text>
```

- [ ] **Step 4: Replace startCheckout with GPB flow**

Poora `startCheckout` function is se replace karo:

```ts
  async function startCheckout() {
    if (paying) return;
    const user = session?.user;
    if (!user) {
      toast.show("Pehle login karo", "error");
      return;
    }

    // 1. Details complete? nahi to form bharwao.
    let details = null;
    try {
      details = await getUserDetails();
    } catch {
      /* ignore, treat as incomplete */
    }
    if (!isDetailsComplete(details)) {
      toast.show("Pehle apni details bharo", "info");
      router.push({ pathname: "/profile-details", params: { returnTo: "/upgrade" } } as never);
      return;
    }

    // 2. RevenueCat available? (dev build + key chahiye)
    if (!purchasesAvailable()) {
      toast.show("Payment abhi is build me available nahi (dev build chahiye)", "info");
      return;
    }

    setPaying(true);
    try {
      const pkgs = await getPlusPackages();
      const wanted: PlanId = yearly ? "plus_yearly" : "plus_monthly";
      const pkg =
        pkgs.find((p) => String(p.product?.identifier ?? "").includes(wanted)) ?? pkgs[0];
      if (!pkg) {
        toast.show("Koi plan available nahi", "error");
        return;
      }
      const ok = await purchasePlus(pkg);
      if (ok) {
        await markProfilePlus();
        await refresh();
        toast.show("Saathi Plus active ho gaya! 🎉", "success");
      } else {
        toast.show("Purchase complete nahi hua", "error");
      }
    } catch {
      toast.show("Payment shuru nahi hua", "error");
    } finally {
      setPaying(false);
    }
  }
```

- [ ] **Step 5: Add PlanId type import**

`type PlanId` ab `@/lib/plan` se import nahi ho raha (Step 1 me hata diya). Step 1 ke import ko update karo:

```ts
import { getPlan, markProfilePlus, type PlanId } from "@/lib/plan";
```

- [ ] **Step 6: Typecheck.** `cd app-mobile && npx tsc --noEmit` → no errors. (Agar `styles.gst`/`Linking`/`WebBrowser`/`buildCheckoutUrl` unused warning aaye to unke references hata do — `styles.gst` style definition rehne do, koi harm nahi.)

- [ ] **Step 7: Manual verify (Expo Go).** `npx expo start`. Upgrade screen: price sirf base (no GST line). "Securely pay" dabao bina details ke → "Pehle details bharo" + form khule. Details bhar ke wapas → dabao → Expo Go me "Payment abhi is build me available nahi" toast (kyunki native module nahi). Crash nahi.

- [ ] **Step 8: Commit**

```bash
git add app-mobile/src/app/upgrade.tsx
git commit -m "feat(app): upgrade uses GPB (RevenueCat) + details gate; GST off"
```

---

## Phase E — App: Local documents

### Task 11: expo-file-system dep + documents.file_uri

**Files:** Modify `app-mobile/package.json`, `app-mobile/src/lib/documents.ts`

- [ ] **Step 1: Install.** Run: `cd app-mobile && npx expo install expo-file-system`.

- [ ] **Step 2: Add file_uri to Document type + addDocument**

`documents.ts` me `Document` type:

```ts
export type Document = {
  id: string;
  name: string;
  type: string;
  expiry: string | null;
  file_uri: string | null;
  created_at: string;
};
```

`addDocument`:

```ts
export async function addDocument(input: {
  name: string;
  type: string;
  expiry: string | null;
  file_uri?: string | null;
}): Promise<Document> {
  if (!(await canAddDocument())) throw new DocLimitError();
  const { data, error } = await client()
    .from("documents")
    .insert({
      name: input.name,
      type: input.type,
      expiry: input.expiry,
      file_uri: input.file_uri ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Document;
}
```

- [ ] **Step 3: Typecheck + commit**

```bash
cd app-mobile && npx tsc --noEmit
git add app-mobile/package.json app-mobile/package-lock.json app-mobile/src/lib/documents.ts
git commit -m "feat(app): expo-file-system + documents.file_uri"
```

### Task 12: Copy picked image to local folder

**Files:** Modify `app-mobile/src/app/add-document.tsx`

> **NOTE (Expo v57):** `app-mobile/AGENTS.md` — code se pehle https://docs.expo.dev/versions/v57.0.0/sdk/filesystem/ padho. Neeche `expo-file-system/legacy` API (v57 me stable: `documentDirectory`, `makeDirectoryAsync`, `copyAsync`). Naya `File`/`Directory` API prefer karo to same behaviour (permanent copy) me adapt karo.

- [ ] **Step 1: Import + helper.** Imports me:

```ts
import * as FileSystem from "expo-file-system/legacy";
```

`const quick = [...]` ke paas (component ke bahar):

```ts
async function persistImage(cacheUri: string): Promise<string> {
  const dir = FileSystem.documentDirectory + "documents/";
  try {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  } catch {
    /* already exists */
  }
  const ext = (cacheUri.split(".").pop() || "jpg").split("?")[0].slice(0, 5);
  const dest = `${dir}${Date.now()}-${Math.floor(Math.random() * 1e6)}.${ext}`;
  await FileSystem.copyAsync({ from: cacheUri, to: dest });
  return dest;
}
```

- [ ] **Step 2: savedUri state.** `const [imageUri, setImageUri] = useState<string | null>(null);` ke neeche:

```ts
  const [savedUri, setSavedUri] = useState<string | null>(null);
```

- [ ] **Step 3: Persist after pick.** `setImageUri(asset.uri);` ke turant baad:

```ts
      try {
        setSavedUri(await persistImage(asset.uri));
      } catch {
        setSavedUri(asset.uri);
      }
```

- [ ] **Step 4: Pass file_uri on save.** `addDocument({...})` ko:

```ts
      await addDocument({
        name: name.trim(),
        type,
        expiry: expiry || null,
        file_uri: savedUri,
      });
```

- [ ] **Step 5: Typecheck + commit**

```bash
cd app-mobile && npx tsc --noEmit
git add app-mobile/src/app/add-document.tsx
git commit -m "feat(app): copy picked document image to local folder"
```

### Task 13: Document view screen

**Files:** Create `app-mobile/src/app/document-view.tsx`

- [ ] **Step 1: Create**

```tsx
import { View, Text, Image, Pressable, StyleSheet, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { colors } from "@/theme/colors";

export default function DocumentView() {
  const { uri, name } = useLocalSearchParams<{ uri?: string; name?: string }>();
  const { width, height } = Dimensions.get("window");
  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>{name || "Document"}</Text>
        <View style={{ width: 22 }} />
      </View>
      <View style={styles.body}>
        {uri ? (
          <Image source={{ uri }} style={{ width: width - 32, height: height * 0.72 }} resizeMode="contain" />
        ) : (
          <View style={styles.empty}>
            <Ionicons name="document-outline" size={40} color={colors.inkSoft} />
            <Text style={styles.emptyText}>Is document ki file save nahi hai.</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
  },
  back: { padding: 4 },
  title: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "700", color: colors.ink },
  body: { flex: 1, alignItems: "center", justifyContent: "center", padding: 16 },
  empty: { alignItems: "center", gap: 12 },
  emptyText: { fontSize: 15, color: colors.inkSoft, textAlign: "center" },
});
```

- [ ] **Step 2: Typecheck + commit**

```bash
cd app-mobile && npx tsc --noEmit
git add app-mobile/src/app/document-view.tsx
git commit -m "feat(app): full-screen document view screen"
```

### Task 14: Wire card tap → view

**Files:** Modify `doc-card.tsx`, `(tabs)/documents.tsx`, `(tabs)/index.tsx`

- [ ] **Step 1: DocCard onPress prop**

`doc-card.tsx`:

```tsx
export function DocCard({
  doc, onPress, onLongPress,
}: {
  doc: Document;
  onPress?: () => void;
  onLongPress?: () => void;
}) {
```

`<Pressable>`:

```tsx
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      style={({ pressed }) => [styles.card, pressed && (onPress || onLongPress) && styles.pressed]}
    >
```

- [ ] **Step 2: documents.tsx list.map**

```tsx
            list.map((doc) => (
              <DocCard
                key={doc.id}
                doc={doc}
                onPress={() =>
                  router.push({
                    pathname: "/document-view",
                    params: { uri: doc.file_uri ?? "", name: doc.name },
                  })
                }
                onLongPress={() => confirmDelete(doc)}
              />
            ))
```

- [ ] **Step 3: index.tsx attention.map**

```tsx
            {attention.map((doc) => (
              <DocCard
                key={doc.id}
                doc={doc}
                onPress={() =>
                  router.push({
                    pathname: "/document-view",
                    params: { uri: doc.file_uri ?? "", name: doc.name },
                  })
                }
              />
            ))}
```

- [ ] **Step 4: Typecheck.** `npx tsc --noEmit` → no errors.

- [ ] **Step 5: Manual verify (end-to-end, Expo Go).** Photo ke saath document add → documents tab me card **tap** → full-screen photo. **Long-press** → delete confirm (intact). App band kar ke dobara kholo → tap → photo abhi bhi dikhe.

- [ ] **Step 6: Commit**

```bash
git add app-mobile/src/components/doc-card.tsx "app-mobile/src/app/(tabs)/documents.tsx" "app-mobile/src/app/(tabs)/index.tsx"
git commit -m "feat(app): tap document card to view full image"
```

---

## Phase F — Prerequisites doc + final verify

### Task 15: Write payment setup guide

**Files:** Create `docs/payment-setup.md`

- [ ] **Step 1: Create the guide**

```md
# Saathi — In-App Payment (Google Play Billing) Setup

App me payment RevenueCat + Google Play Billing se hota hai. Ye steps USER karega
(code taiyaar hai, par inke bina payment test/ship nahi hoga):

1. **Google Play Console**
   - App ko internal testing track pe publish karo (signed AAB).
   - Subscriptions banao: product id `plus_monthly`, `plus_yearly` (base plans set karo).
   - Merchant/payments profile complete karo.
   - License testers add karo (test purchase bina charge ke).
2. **EAS Development Build** (Expo Go se GPB nahi chalta)
   - `eas build --profile development --platform android`
   - Isi dev build me `react-native-purchases` native module chalega.
3. **RevenueCat**
   - Project banao, Google Play se link (service account JSON).
   - Entitlement id: `plus`. Offering me `plus_monthly` + `plus_yearly` packages jodo.
   - Android API key lo → app `.env` me: `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=...`
4. **GST**: abhi off (registration nahi). Google India me GST khud handle karta hai;
   Console me tax-inclusive price set karna. Baad me apna GST invoice chahiye to alag.
5. **Webhook (baad me)**: RevenueCat → Supabase webhook se `profiles.plan` sync karo
   (refund/cancel handle). Abhi purchase success pe app khud plan set karta hai.
```

- [ ] **Step 2: Commit**

```bash
git add docs/payment-setup.md
git commit -m "docs: Google Play Billing / RevenueCat setup guide"
```

### Task 16: Final web + app sanity

- [ ] **Step 1: Web build.** `cd web && npm run build` → success.
- [ ] **Step 2: App typecheck.** `cd app-mobile && npx tsc --noEmit` → no errors.
- [ ] **Step 3: App boots in Expo Go** (`npx expo start`) → koi crash nahi; upgrade + profile-details + document view sab chalein (payment ko chhod, jo dev-build maangega).

---

## Self-Review (author checklist)

- **Spec coverage:** Web download modal + GST off (T3) ✓; web checkout commented (T4) ✓; DB locations + user_details own-row (T1) + documents.file_uri (T2) ✓; app details form phone-country-validated + cascade, saved to user_details (T5,T6,T7) ✓; settings entry (T8) ✓; in-app GPB via RevenueCat + details-gate + profiles bridge, graceful when unavailable (T9,T10) ✓; GST off in app (T10) ✓; local document save + full view + tap (T11–T14) ✓; prerequisites documented (T15) ✓.
- **Types:** `UserDetails`, `LocationItem`, `PlanId` (from plan.ts), `CountryCode` (libphonenumber-js), `Document.file_uri`, `purchasesAvailable/getPlusPackages/purchasePlus`, `markProfilePlus`, `isDetailsComplete` — consistent across tasks.
- **Reversibility:** GST + web checkout sirf comment-out (delete nahi). ✓
- **No test framework:** verification lint/build/tsc/manual — intentional.
```
