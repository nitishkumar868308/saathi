# Checkout Billing + Local Documents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Web plans button ko checkout se jodo, checkout pe country-wise-validated billing details collect kar ke DB me save karo, aur app me document ki actual file local folder me save + full-screen view karo.

**Architecture:** Web (Next.js 14 app router) Supabase ko REST API (`fetch` + service-role key) se use karta hai — `supabase-js` nahi. Isi pattern ko location + billing ke liye reuse karenge. App (Expo v57 / expo-router) documents ki file `expo-file-system` se local `documentDirectory/documents/` me copy karta hai; sirf local path DB me store hota hai. Payment app me nahi — web checkout hi.

**Tech Stack:** Next.js 14, Supabase (PostgREST via fetch), Razorpay (fetch-based), `react-phone-number-input` (+ bundled `libphonenumber-js`), Expo v57, expo-file-system, expo-router.

**Testing note:** Is repo me koi test runner (jest/vitest) setup NAHI hai — na web me, na app me. Isliye plan "TDD unit test" ke bajaye **real verification** use karta hai: web ke liye `npm run lint` + `npm run build` + `curl` API check, app ke liye manual run (Expo). Yeh codebase ke existing pattern ke consistent hai. Naya test framework add mat karo.

**Env vars (already used by codebase):** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (web `.env.local`). App me `EXPO_PUBLIC_WEB_URL`.

---

## File Structure

**Create:**
- `supabase/locations-billing.sql` — countries/states/cities + billing_details tables + RLS
- `web/lib/locations.ts` — countries/states/cities REST fetch helpers
- `web/lib/billing-server.ts` — billing_details insert helper
- `web/app/api/locations/countries/route.ts` — GET countries
- `web/app/api/locations/states/route.ts` — GET states?country=<id>
- `web/app/api/locations/cities/route.ts` — GET cities?state=<id>
- `app-mobile/src/app/document-view.tsx` — full-screen document image viewer

**Modify:**
- `supabase/schema.sql` — `documents.file_uri` column add
- `web/app/api/razorpay/order/route.ts` — billing accept + save
- `web/components/Pricing.tsx` — CTA → `/checkout?plan=...`
- `web/components/CheckoutClient.tsx` — billing form + phone input + cascade selects
- `web/package.json` — `react-phone-number-input` dep
- `app-mobile/package.json` — `expo-file-system` dep
- `app-mobile/src/lib/documents.ts` — `file_uri` field
- `app-mobile/src/app/add-document.tsx` — image ko local folder me copy
- `app-mobile/src/components/doc-card.tsx` — `onPress` prop
- `app-mobile/src/app/(tabs)/documents.tsx` — card tap → view
- `app-mobile/src/app/(tabs)/index.tsx` — attention card tap → view

---

## Phase A — Database

### Task 1: Location + billing tables SQL

**Files:**
- Create: `supabase/locations-billing.sql`

- [ ] **Step 1: Create the SQL file**

```sql
-- Saathi — Locations (country/state/city cascade) + checkout billing details
-- Supabase SQL Editor mein Run karo. (Dobara run safe hai.)

-- 1. Countries
create table if not exists public.countries (
  id serial primary key,
  name text not null,
  code text unique
);

-- 2. States (country se linked)
create table if not exists public.states (
  id serial primary key,
  country_id int not null references public.countries(id) on delete cascade,
  name text not null
);
create index if not exists states_country_idx on public.states(country_id);

-- 3. Cities (state se linked)
create table if not exists public.cities (
  id serial primary key,
  state_id int not null references public.states(id) on delete cascade,
  name text not null
);
create index if not exists cities_state_idx on public.cities(state_id);

-- 4. Billing details (checkout pe save)
create table if not exists public.billing_details (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  full_name text not null,
  email text not null,
  phone text not null,              -- poora E.164, jaise +919876543210
  phone_dial_code text,             -- country calling code, jaise +91
  phone_country text,               -- ISO country, jaise IN
  address text not null,
  gender text not null,
  country_id int references public.countries(id),
  state_id int references public.states(id),
  city_id int references public.cities(id),
  order_id text,                    -- razorpay order id se link
  created_at timestamptz not null default now()
);

-- RLS: location tables public-read (dropdown ke liye), billing sirf server.
alter table public.countries enable row level security;
alter table public.states enable row level security;
alter table public.cities enable row level security;
alter table public.billing_details enable row level security;

drop policy if exists "read countries" on public.countries;
drop policy if exists "read states" on public.states;
drop policy if exists "read cities" on public.cities;

create policy "read countries" on public.countries for select using (true);
create policy "read states" on public.states for select using (true);
create policy "read cities" on public.cities for select using (true);
-- billing_details: koi public policy nahi — sirf service_role (server) access.
```

- [ ] **Step 2: Verify SQL syntax by running in Supabase SQL Editor**

User (ya aap) Supabase dashboard → SQL Editor me paste kar ke Run karo.
Expected: "Success. No rows returned." Dobara run karo → phir bhi success (idempotent).

- [ ] **Step 3: Commit**

```bash
git add supabase/locations-billing.sql
git commit -m "feat(db): countries/states/cities + billing_details tables"
```

---

### Task 2: documents.file_uri column

**Files:**
- Modify: `supabase/schema.sql`

- [ ] **Step 1: Add file_uri column after the documents table block**

`supabase/schema.sql` me, documents `create table` block ke turant baad (line 11 ke baad, `-- 2. Reminders` se pehle) yeh line add karo:

```sql
-- Document ki local file ka path (app device pe). Abhi cloud pe nahi.
alter table public.documents add column if not exists file_uri text;
```

- [ ] **Step 2: Run in Supabase SQL Editor**

Poora `schema.sql` (ya sirf yeh alter line) Supabase me Run karo.
Expected: Success. `documents` table me `file_uri` column dikhe (Table editor me confirm).

- [ ] **Step 3: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat(db): documents.file_uri column for local file path"
```

---

## Phase B — Web backend (locations + billing)

### Task 3: Location REST helpers

**Files:**
- Create: `web/lib/locations.ts`

- [ ] **Step 1: Create the helper file**

```ts
/**
 * Location lookups (country/state/city) — Supabase REST (service_role).
 * web/lib/store.ts jaisa hi fetch pattern.
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export type LocationItem = { id: number; name: string };

export function locationsConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}

function headers() {
  return {
    apikey: SUPABASE_KEY as string,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
  };
}

async function sbSelect<T>(query: string): Promise<T[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${query}`, {
    headers: headers(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`supabase select failed: ${res.status}`);
  return (await res.json()) as T[];
}

export async function getCountries(): Promise<LocationItem[]> {
  if (!locationsConfigured()) return [];
  return sbSelect<LocationItem>("countries?select=id,name&order=name.asc");
}

export async function getStates(countryId: number): Promise<LocationItem[]> {
  if (!locationsConfigured()) return [];
  return sbSelect<LocationItem>(
    `states?select=id,name&country_id=eq.${countryId}&order=name.asc`,
  );
}

export async function getCities(stateId: number): Promise<LocationItem[]> {
  if (!locationsConfigured()) return [];
  return sbSelect<LocationItem>(
    `cities?select=id,name&state_id=eq.${stateId}&order=name.asc`,
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd web && npx tsc --noEmit`
Expected: No errors from `lib/locations.ts`.

- [ ] **Step 3: Commit**

```bash
git add web/lib/locations.ts
git commit -m "feat(web): location REST helpers (countries/states/cities)"
```

---

### Task 4: Location API routes

**Files:**
- Create: `web/app/api/locations/countries/route.ts`
- Create: `web/app/api/locations/states/route.ts`
- Create: `web/app/api/locations/cities/route.ts`

- [ ] **Step 1: Create countries route**

`web/app/api/locations/countries/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getCountries } from "@/lib/locations";

export const runtime = "nodejs";

export async function GET() {
  try {
    const data = await getCountries();
    return NextResponse.json(data);
  } catch (err) {
    console.error("[locations/countries]", err);
    return NextResponse.json({ error: "load failed" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create states route**

`web/app/api/locations/states/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getStates } from "@/lib/locations";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const countryId = Number(searchParams.get("country"));
  if (!countryId) {
    return NextResponse.json({ error: "country required" }, { status: 400 });
  }
  try {
    const data = await getStates(countryId);
    return NextResponse.json(data);
  } catch (err) {
    console.error("[locations/states]", err);
    return NextResponse.json({ error: "load failed" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Create cities route**

`web/app/api/locations/cities/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getCities } from "@/lib/locations";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const stateId = Number(searchParams.get("state"));
  if (!stateId) {
    return NextResponse.json({ error: "state required" }, { status: 400 });
  }
  try {
    const data = await getCities(stateId);
    return NextResponse.json(data);
  } catch (err) {
    console.error("[locations/cities]", err);
    return NextResponse.json({ error: "load failed" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Verify routes respond**

Run: `cd web && npm run dev` (background), phir:
```bash
curl -s http://localhost:3000/api/locations/countries
```
Expected: JSON array (`[]` agar abhi data import nahi kiya; `[{"id":..,"name":".."}]` agar hai). Koi 500 nahi. `states?country=1` bina data ke `[]` deta hai. Dev server band kar do.

- [ ] **Step 5: Commit**

```bash
git add web/app/api/locations
git commit -m "feat(web): location API routes (countries/states/cities)"
```

---

### Task 5: Billing save helper

**Files:**
- Create: `web/lib/billing-server.ts`

- [ ] **Step 1: Create the helper**

```ts
/**
 * Checkout billing details ko Supabase me save karo (service_role).
 * Razorpay order banne ke saath call hota hai.
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export type BillingInput = {
  userId?: string;
  fullName: string;
  email: string;
  phone: string;
  phoneDialCode?: string;
  phoneCountry?: string;
  address: string;
  gender: string;
  countryId?: number;
  stateId?: number;
  cityId?: number;
  orderId: string;
};

export function billingDbConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}

function headers(extra?: Record<string, string>) {
  return {
    apikey: SUPABASE_KEY as string,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

export async function saveBillingDetails(b: BillingInput): Promise<void> {
  if (!billingDbConfigured()) return;
  await fetch(`${SUPABASE_URL}/rest/v1/billing_details`, {
    method: "POST",
    headers: headers({ Prefer: "return=minimal" }),
    body: JSON.stringify([
      {
        user_id: b.userId ?? null,
        full_name: b.fullName,
        email: b.email,
        phone: b.phone,
        phone_dial_code: b.phoneDialCode ?? null,
        phone_country: b.phoneCountry ?? null,
        address: b.address,
        gender: b.gender,
        country_id: b.countryId ?? null,
        state_id: b.stateId ?? null,
        city_id: b.cityId ?? null,
        order_id: b.orderId,
      },
    ]),
    cache: "no-store",
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `cd web && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add web/lib/billing-server.ts
git commit -m "feat(web): billing_details save helper"
```

---

### Task 6: Order route saves billing

**Files:**
- Modify: `web/app/api/razorpay/order/route.ts`

- [ ] **Step 1: Add billing type + import at top**

Existing imports ke baad add karo:

```ts
import { saveBillingDetails, type BillingInput } from "@/lib/billing-server";
```

- [ ] **Step 2: Parse billing from body**

Body parse block me (jahan `plan` aur `userId` nikaalte hain), ek aur variable add karo. Poora try-block ise se replace karo:

```ts
  let plan: PlanId;
  let userId: string | undefined;
  let billing: Omit<BillingInput, "orderId"> | undefined;
  try {
    const body = await request.json();
    plan = body?.plan;
    userId = body?.userId ? String(body.userId) : undefined;
    billing = body?.billing ?? undefined;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
```

- [ ] **Step 3: Save billing after order create**

`recordPayment(...)` ke `await` ke turant baad (return se pehle) yeh add karo:

```ts
    if (billing) {
      await saveBillingDetails({ ...billing, userId, orderId: order.id });
    }
```

- [ ] **Step 4: Typecheck + build**

Run: `cd web && npx tsc --noEmit && npm run build`
Expected: Build success, koi type error nahi.

- [ ] **Step 5: Commit**

```bash
git add web/app/api/razorpay/order/route.ts
git commit -m "feat(web): save billing_details when order is created"
```

---

## Phase C — Web frontend

### Task 7: Pricing button → checkout

**Files:**
- Modify: `web/components/Pricing.tsx:144-153`

- [ ] **Step 1: Compute planId + destination inside the plans.map**

`web/components/Pricing.tsx` me, `.map((plan) => {` ke andar, `const showGst = ...` line ke baad yeh add karo:

```tsx
          const isPaid = plan.price !== "₹0";
          const planId = yearly ? "plus_yearly" : "plus_monthly";
          const href = isPaid ? `/checkout?plan=${planId}` : "#waitlist";
```

- [ ] **Step 2: Use the href in the CTA anchor**

Usi CTA `<a>` me `href="#waitlist"` ko `href={href}` se badlo:

```tsx
              <a
                href={href}
                className={`mt-7 inline-flex h-12 items-center justify-center rounded-2xl px-6 text-sm font-semibold transition active:scale-[0.98] ${
                  highlight
                    ? "bg-terracotta text-white shadow-warm hover:bg-terracotta-dark"
                    : "border border-ink bg-transparent text-ink hover:bg-ink hover:text-cream"
                }`}
              >
                {plan.cta}
              </a>
```

- [ ] **Step 3: Verify in browser**

Run: `cd web && npm run dev`. `http://localhost:3000` → Pricing section → Plus plan ka button dabao.
Expected: `/checkout?plan=plus_yearly` (yearly toggle on) ya `plus_monthly` khule. Free plan button page ke `#waitlist` pe jaaye.

- [ ] **Step 4: Commit**

```bash
git add web/components/Pricing.tsx
git commit -m "fix(web): plans CTA routes to checkout, not waitlist"
```

---

### Task 8: Add phone-input dependency

**Files:**
- Modify: `web/package.json`

- [ ] **Step 1: Install the library**

Run: `cd web && npm install react-phone-number-input`
Expected: `react-phone-number-input` (aur bundled `libphonenumber-js`) `dependencies` me aa jaaye, `package-lock.json` update ho.

- [ ] **Step 2: Commit**

```bash
git add web/package.json web/package-lock.json
git commit -m "chore(web): add react-phone-number-input"
```

---

### Task 9: Checkout billing form

**Files:**
- Modify: `web/components/CheckoutClient.tsx` (poora rewrite)

- [ ] **Step 1: Replace the whole file with the form version**

`web/components/CheckoutClient.tsx` ka poora content is se replace karo:

```tsx
"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { useSearchParams } from "next/navigation";
import { ShieldCheck, Loader2, CheckCircle2, Lock } from "lucide-react";
import PhoneInput, {
  isValidPhoneNumber,
  parsePhoneNumber,
} from "react-phone-number-input";
import "react-phone-number-input/style.css";
import SaathiMark from "@/components/SaathiMark";

type PlanId = "plus_monthly" | "plus_yearly";
type LocationItem = { id: number; name: string };

const PLAN_UI: Record<PlanId, { title: string; base: string; total: string; period: string }> = {
  plus_monthly: { title: "Saathi Plus · Monthly", base: "₹99", total: "₹117", period: "/month" },
  plus_yearly: { title: "Saathi Plus · Yearly", base: "₹999", total: "₹1,179", period: "/year" },
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

export default function CheckoutClient() {
  const params = useSearchParams();
  const plan = (params.get("plan") as PlanId) || "plus_yearly";
  const uid = params.get("uid") ?? undefined;
  const returnTo = params.get("return") ?? undefined;

  const ui = PLAN_UI[plan] ?? PLAN_UI.plus_yearly;
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState("");

  // Form state
  const [fullName, setFullName] = useState(params.get("name") ?? "");
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [phone, setPhone] = useState<string | undefined>(undefined);
  const [address, setAddress] = useState("");
  const [gender, setGender] = useState("");

  // Cascade selects
  const [countries, setCountries] = useState<LocationItem[]>([]);
  const [states, setStates] = useState<LocationItem[]>([]);
  const [cities, setCities] = useState<LocationItem[]>([]);
  const [countryId, setCountryId] = useState("");
  const [stateId, setStateId] = useState("");
  const [cityId, setCityId] = useState("");

  // Load countries on mount
  useEffect(() => {
    fetch("/api/locations/countries")
      .then((r) => r.json())
      .then((d) => setCountries(Array.isArray(d) ? d : []))
      .catch(() => setCountries([]));
  }, []);

  // Country change → load states, reset state+city
  useEffect(() => {
    setStates([]);
    setStateId("");
    setCities([]);
    setCityId("");
    if (!countryId) return;
    fetch(`/api/locations/states?country=${countryId}`)
      .then((r) => r.json())
      .then((d) => setStates(Array.isArray(d) ? d : []))
      .catch(() => setStates([]));
  }, [countryId]);

  // State change → load cities, reset city
  useEffect(() => {
    setCities([]);
    setCityId("");
    if (!stateId) return;
    fetch(`/api/locations/cities?state=${stateId}`)
      .then((r) => r.json())
      .then((d) => setCities(Array.isArray(d) ? d : []))
      .catch(() => setCities([]));
  }, [stateId]);

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const phoneOk = !!phone && isValidPhoneNumber(phone);
  const formValid =
    fullName.trim().length > 1 &&
    emailOk &&
    phoneOk &&
    address.trim().length > 3 &&
    !!gender &&
    !!countryId &&
    !!stateId &&
    !!cityId;

  async function pay() {
    if (status === "loading" || !formValid || !phone) return;
    setStatus("loading");
    setError("");
    try {
      const parsed = parsePhoneNumber(phone);
      const billing = {
        fullName: fullName.trim(),
        email: email.trim(),
        phone,
        phoneDialCode: parsed ? `+${parsed.countryCallingCode}` : undefined,
        phoneCountry: parsed?.country ?? undefined,
        address: address.trim(),
        gender,
        countryId: Number(countryId),
        stateId: Number(stateId),
        cityId: Number(cityId),
      };

      const orderRes = await fetch("/api/razorpay/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, userId: uid, billing }),
      });
      if (!orderRes.ok) {
        const j = await orderRes.json().catch(() => ({}));
        throw new Error(j?.error || "order failed");
      }
      const order = await orderRes.json();

      if (!window.Razorpay) throw new Error("Razorpay load nahi hua");

      const rzp = new window.Razorpay({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amount,
        currency: order.currency,
        name: "Saathi",
        description: order.label,
        prefill: { email: email.trim(), name: fullName.trim(), contact: phone },
        theme: { color: "#C25A37" },
        handler: async (resp: Record<string, string>) => {
          const verifyRes = await fetch("/api/razorpay/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...resp, plan, userId: uid }),
          });
          if (verifyRes.ok) {
            setStatus("done");
            if (returnTo) setTimeout(() => (window.location.href = returnTo), 1500);
          } else {
            setStatus("error");
            setError("Payment verify nahi hua. Support se baat karo.");
          }
        },
        modal: { ondismiss: () => setStatus("idle") },
      });
      rzp.open();
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Kuch gadbad ho gayi");
    }
  }

  const inputCls =
    "mt-1.5 w-full rounded-2xl border border-line bg-cream-deep/20 px-4 py-3 text-sm outline-none focus:border-terracotta";

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-5 py-10">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />
      <div className="w-full max-w-md rounded-4xl border border-line bg-surface p-7 shadow-warm sm:p-8">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-terracotta text-white shadow-warm">
            <SaathiMark size={22} className="text-white" />
          </span>
          <span className="font-display text-xl font-semibold">Saathi</span>
        </div>

        {status === "done" ? (
          <div className="mt-8 text-center">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-sage text-white">
              <CheckCircle2 size={32} />
            </span>
            <h1 className="mt-5 font-display text-2xl font-semibold">Payment ho gaya! 🎉</h1>
            <p className="mt-2 text-ink-soft">Saathi Plus activate ho gaya. Ab app mein wapas jao.</p>
          </div>
        ) : (
          <>
            <h1 className="mt-6 font-display text-2xl font-semibold">{ui.title}</h1>
            <div className="mt-4 rounded-2xl border border-line bg-cream-deep/30 p-5">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-sm text-ink-soft">{ui.base} + 18% GST</p>
                  <p className="font-display text-3xl font-semibold">
                    {ui.total}
                    <span className="text-base font-normal text-ink-soft">{ui.period}</span>
                  </p>
                </div>
                <ShieldCheck size={26} className="text-sage" />
              </div>
            </div>

            {/* Billing form */}
            <div className="mt-5 space-y-3.5">
              <div>
                <label className="text-sm font-semibold">Poora naam</label>
                <input className={inputCls} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Aapka naam" />
              </div>
              <div>
                <label className="text-sm font-semibold">Email</label>
                <input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" />
              </div>
              <div>
                <label className="text-sm font-semibold">Phone number</label>
                <div className="mt-1.5 rounded-2xl border border-line bg-cream-deep/20 px-3 py-2.5 focus-within:border-terracotta">
                  <PhoneInput
                    international
                    defaultCountry="IN"
                    value={phone}
                    onChange={setPhone}
                    placeholder="Phone number"
                  />
                </div>
                {phone && !phoneOk && (
                  <p className="mt-1 text-xs text-terracotta-dark">Sahi phone number daalo</p>
                )}
              </div>
              <div>
                <label className="text-sm font-semibold">Address</label>
                <textarea className={inputCls} rows={2} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Ghar / office ka pata" />
              </div>
              <div>
                <label className="text-sm font-semibold">Gender</label>
                <select className={inputCls} value={gender} onChange={(e) => setGender(e.target.value)}>
                  <option value="">Choose…</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold">Country</label>
                <select className={inputCls} value={countryId} onChange={(e) => setCountryId(e.target.value)}>
                  <option value="">{countries.length ? "Choose country…" : "Koi country nahi (data import karo)"}</option>
                  {countries.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold">State</label>
                <select className={inputCls} value={stateId} onChange={(e) => setStateId(e.target.value)} disabled={!countryId}>
                  <option value="">{states.length ? "Choose state…" : "Pehle country chuno"}</option>
                  {states.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold">City</label>
                <select className={inputCls} value={cityId} onChange={(e) => setCityId(e.target.value)} disabled={!stateId}>
                  <option value="">{cities.length ? "Choose city…" : "Pehle state chuno"}</option>
                  {cities.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {error && <p className="mt-3 text-sm font-medium text-terracotta-dark">{error}</p>}

            <button
              onClick={pay}
              disabled={status === "loading" || !formValid}
              className="mt-6 inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-terracotta px-6 text-base font-semibold text-white shadow-warm transition hover:bg-terracotta-dark disabled:opacity-50"
            >
              {status === "loading" ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  <Lock size={16} />
                  Securely pay {ui.total}
                </>
              )}
            </button>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-ink-soft">
              <Lock size={12} />
              Razorpay se secure payment · UPI, card, netbanking
            </p>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + build**

Run: `cd web && npx tsc --noEmit && npm run build`
Expected: Build success. (Agar `parsePhoneNumber` type import error de, to `parsePhoneNumber` `react-phone-number-input` se export hota hai — confirm import spelling.)

- [ ] **Step 3: Manual verify**

Run: `cd web && npm run dev`. `http://localhost:3000/checkout?plan=plus_yearly` kholo.
Expected:
- Saare fields dikhein; phone input me country flag + `+91` default.
- Jab tak sab fields valid nahi, "Securely pay" button faded/disabled.
- Galat phone (jaise `+91 123`) pe error text aur button disabled.
- Country data import na ho to country dropdown me "Koi country nahi" message.

- [ ] **Step 4: Commit**

```bash
git add web/components/CheckoutClient.tsx
git commit -m "feat(web): checkout billing form with phone + cascade location"
```

---

## Phase D — App: local documents

### Task 10: expo-file-system dep + documents lib field

**Files:**
- Modify: `app-mobile/package.json`
- Modify: `app-mobile/src/lib/documents.ts`

- [ ] **Step 1: Install expo-file-system**

Run: `cd app-mobile && npx expo install expo-file-system`
Expected: `expo-file-system` `dependencies` me aaye (Expo v57 compatible version).

- [ ] **Step 2: Add file_uri to Document type + addDocument**

`app-mobile/src/lib/documents.ts` me `Document` type me field add karo:

```ts
export type Document = {
  id: string;
  name: string;
  type: string;
  expiry: string | null; // 'YYYY-MM-DD'
  file_uri: string | null;
  created_at: string;
};
```

Aur `addDocument` ka input + insert update karo:

```ts
export async function addDocument(input: {
  name: string;
  type: string;
  expiry: string | null;
  file_uri?: string | null;
}): Promise<Document> {
  // Free plan limit check
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

- [ ] **Step 3: Typecheck**

Run: `cd app-mobile && npx tsc --noEmit`
Expected: No errors from `documents.ts`. (Doosri files me `file_uri` add karne se pehle koi error nahi aana chahiye kyunki field optional read hai.)

- [ ] **Step 4: Commit**

```bash
git add app-mobile/package.json app-mobile/package-lock.json app-mobile/src/lib/documents.ts
git commit -m "feat(app): expo-file-system dep + documents.file_uri"
```

---

### Task 11: Save picked image to local folder

**Files:**
- Modify: `app-mobile/src/app/add-document.tsx`

> **NOTE (Expo v57):** `app-mobile/AGENTS.md` kehta hai — code likhne se pehle https://docs.expo.dev/versions/v57.0.0/sdk/filesystem/ padho. Neeche legacy API (`expo-file-system/legacy`) use ho raha hai jo v57 me stable hai aur `documentDirectory`/`copyAsync`/`makeDirectoryAsync` deta hai. Agar naya `File`/`Directory` API prefer karo to docs se signature confirm kar ke adapt karo — behaviour same rahe (image ko permanent folder me copy karke uska path return karna).

- [ ] **Step 1: Add import + helper**

`add-document.tsx` ke imports me add karo:

```ts
import * as FileSystem from "expo-file-system/legacy";
```

Component ke bahar (imports ke neeche, `const quick = [...]` ke paas) yeh helper add karo:

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

- [ ] **Step 2: Track a saved local uri in state**

`const [imageUri, setImageUri] = useState<string | null>(null);` ke neeche add karo:

```ts
  const [savedUri, setSavedUri] = useState<string | null>(null);
```

- [ ] **Step 3: Persist image right after pick**

`pickImage` ke andar, `setImageUri(asset.uri);` ke turant baad add karo:

```ts
      try {
        const local = await persistImage(asset.uri);
        setSavedUri(local);
      } catch {
        setSavedUri(asset.uri); // fallback: cache uri (best effort)
      }
```

- [ ] **Step 4: Pass file_uri when saving**

`save()` me `addDocument({ ... })` call ko update karo:

```ts
      await addDocument({
        name: name.trim(),
        type,
        expiry: expiry || null,
        file_uri: savedUri,
      });
```

- [ ] **Step 5: Typecheck**

Run: `cd app-mobile && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 6: Manual verify (Expo)**

Run: `cd app-mobile && npx expo start`. App me document add karo (camera/gallery se photo), Save karo.
Expected: Save ho jaaye, koi crash nahi. (Actual file open next task me verify hoga.)

- [ ] **Step 7: Commit**

```bash
git add app-mobile/src/app/add-document.tsx
git commit -m "feat(app): copy picked document image to local folder"
```

---

### Task 12: Document view screen

**Files:**
- Create: `app-mobile/src/app/document-view.tsx`

- [ ] **Step 1: Create the viewer screen**

```tsx
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  Dimensions,
} from "react-native";
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
        <Text style={styles.title} numberOfLines={1}>
          {name || "Document"}
        </Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.body}>
        {uri ? (
          <Image
            source={{ uri }}
            style={{ width: width - 32, height: height * 0.72 }}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.empty}>
            <Ionicons name="document-outline" size={40} color={colors.inkSoft} />
            <Text style={styles.emptyText}>
              Is document ki file save nahi hai.
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  back: { padding: 4 },
  title: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "700", color: colors.ink },
  body: { flex: 1, alignItems: "center", justifyContent: "center", padding: 16 },
  empty: { alignItems: "center", gap: 12 },
  emptyText: { fontSize: 15, color: colors.inkSoft, textAlign: "center" },
});
```

- [ ] **Step 2: Typecheck**

Run: `cd app-mobile && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add app-mobile/src/app/document-view.tsx
git commit -m "feat(app): full-screen document view screen"
```

---

### Task 13: Wire card tap → view

**Files:**
- Modify: `app-mobile/src/components/doc-card.tsx`
- Modify: `app-mobile/src/app/(tabs)/documents.tsx`
- Modify: `app-mobile/src/app/(tabs)/index.tsx`

- [ ] **Step 1: Add onPress prop to DocCard**

`doc-card.tsx` me props aur Pressable update karo:

```tsx
export function DocCard({
  doc,
  onPress,
  onLongPress,
}: {
  doc: Document;
  onPress?: () => void;
  onLongPress?: () => void;
}) {
```

Aur `<Pressable>` me `onPress` add karo + pressed style dono ke liye:

```tsx
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      style={({ pressed }) => [
        styles.card,
        pressed && (onPress || onLongPress) && styles.pressed,
      ]}
    >
```

- [ ] **Step 2: Navigate from documents list**

`documents.tsx` me DocCard render ko update karo (list.map wala):

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

- [ ] **Step 3: Navigate from home attention cards**

`index.tsx` me attention DocCard render update karo:

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

- [ ] **Step 4: Typecheck**

Run: `cd app-mobile && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Manual verify (end-to-end)**

Run: `cd app-mobile && npx expo start`.
- Naya document photo ke saath add karo.
- Documents tab me us card ko **tap** karo → full-screen photo khule.
- Card ko **long-press** karo → delete confirm aaye (purana behaviour intact).
- App fully band kar ke dobara kholo → wahi document tap karo → photo abhi bhi dikhe (cache clear se na gayi).

- [ ] **Step 6: Commit**

```bash
git add app-mobile/src/components/doc-card.tsx "app-mobile/src/app/(tabs)/documents.tsx" "app-mobile/src/app/(tabs)/index.tsx"
git commit -m "feat(app): tap document card to view full image"
```

---

## Phase E — App checkout flow verify (no code change expected)

### Task 14: Verify app → web checkout still works

**Files:** none (verification only)

- [ ] **Step 1: Confirm upgrade flow**

`app-mobile/src/app/upgrade.tsx` review karo — `startCheckout` `buildCheckoutUrl(...)` se web `/checkout?...` banata hai aur `WebBrowser.openAuthSessionAsync` se kholta hai. Koi native payment nahi.

- [ ] **Step 2: Manual verify**

App me Settings → upgrade, ya document limit hit kar ke upgrade screen pe jaao → "Securely pay" dabao.
Expected: In-app browser me web `/checkout` khule (naya billing form ke saath). App me koi Razorpay native nahi. Yeh Play-Store-safe hai.

- [ ] **Step 3: (agar zaroori ho) commit koi note**

Koi code change nahi to commit nahi. Bas confirm.

---

## Self-Review (author checklist — reference only)

- **Spec coverage:** Plans button fix (T7) ✓, checkout form all-required + phone country validation (T8,T9) ✓, phone saves E.164 + dial code + country (T9→T5→T1) ✓, country/state/city cascade tables + import-ready (T1,T3,T4,T9) ✓, billing saved to DB (T5,T6) ✓, app payment stays web-only (T14) ✓, document local folder save (T10,T11) ✓, document full view (T12,T13) ✓, documents.file_uri (T2,T10) ✓.
- **Types:** `LocationItem`, `BillingInput`, `Document.file_uri`, `persistImage` return string — consistent across tasks.
- **No test framework:** verification via lint/build/curl/manual — intentional, matches repo.
