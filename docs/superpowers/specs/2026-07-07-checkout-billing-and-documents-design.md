# Checkout Billing + Local Documents — Design

Date: 2026-07-07
Status: Approved (design), pending implementation plan

## Goal

Do char alag kaam ek saath:

1. **Web plans button bug** — plan CTA checkout pe nahi jaata; fix karo.
2. **Web checkout form** — payment se pehle billing details collect karo aur DB me save karo.
3. **Database** — India-first cascade location tables (country → state → city) + billing details table.
4. **App documents** — uploaded document ki actual file local folder me save karo aur app ke andar full view karo. Plus payment app me nahi (Play-Store-safe), web pe hi.

## Non-goals (abhi nahi)

- Documents ko Supabase Storage / cloud pe rakhna (abhi sirf local device). Cross-device file sync isliye nahi milega — sirf naam/type/expiry sync hoga.
- App me apna payment gateway. App sirf feature-limits enforce karta hai; upgrade web pe.
- PDF viewer. Abhi documents image (photo) hote hain (ImagePicker se), to full-screen image view kaafi hai.

---

## Workstream 1 — Web: Plans button → Checkout

**File:** `web/components/Pricing.tsx`

- Abhi paid plan ka CTA `href="#waitlist"` hai — kabhi checkout pe nahi jaata.
- Fix: paid ("Plus") plan ke CTA ko `/checkout?plan=<planId>` pe le jaao, jahan `planId` = billing toggle ke hisaab se `plus_yearly` (jab `yearly` true) ya `plus_monthly`.
- Free plan ka CTA `#waitlist` par hi rahega (koi payment nahi).
- Plan ko paid vs free identify karne ke liye: `plan.highlight` (Plus card) = paid. Agar i18n data me reliable flag na ho to `plan.price !== "₹0"` se detect karo.

**Acceptance:** Landing pe Plus plan ka button dabao → `/checkout?plan=plus_yearly` (ya monthly) khule.

---

## Workstream 2 — Web: Checkout form

**File:** `web/components/CheckoutClient.tsx`

Pay button se pehle ek details form. Saare fields **required**; jab tak sab valid na hon, Pay disabled.

Fields:
- Full name (query `name` se prefill agar mile)
- Email (query `email` se prefill)
- Phone (10-digit India validation)
- Address (multi-line)
- Gender (select: Male / Female / Other)
- Country (select) → State (select) → City (select) — cascade

Cascade behaviour:
- Mount pe countries load (`GET /api/locations/countries`).
- Country choose → us country ke states load (`GET /api/locations/states?country=<id>`), state+city reset.
- State choose → us state ki cities load (`GET /api/locations/cities?state=<id>`), city reset.

Submit / Pay flow:
1. Form valid → `POST /api/razorpay/order` body me `{ plan, userId, billing: { fullName, email, phone, address, gender, countryId, stateId, cityId } }`.
2. Order route order banata hai **aur** billing details `billing_details` table me save karta hai (order_id ke saath linked).
3. Razorpay modal khulta hai (jaisa abhi hai). Prefill name/email/phone billing se.
4. Verify unchanged.

**Acceptance:** Checkout pe saare fields bharo → Pay enable ho → Razorpay khule → `billing_details` me ek row aaye order_id ke saath.

---

## Workstream 3 — Database

**Nayi file:** `supabase/locations-billing.sql` (idempotent, dobara run safe).

```sql
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

create table if not exists public.cities (
  id serial primary key,
  state_id int not null references public.states(id) on delete cascade,
  name text not null
);

create table if not exists public.billing_details (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  full_name text not null,
  email text not null,
  phone text not null,
  address text not null,
  gender text not null,
  country_id int references public.countries(id),
  state_id int references public.states(id),
  city_id int references public.cities(id),
  order_id text,                 -- razorpay order id se link
  created_at timestamptz not null default now()
);
```

RLS:
- `countries`, `states`, `cities`: RLS on, **public read** allowed (dropdown ke liye) — `for select using (true)`. Write sirf service_role.
- `billing_details`: RLS on, koi public policy nahi (sirf server/service_role likhta-padhta hai).

Indexes: `states(country_id)`, `cities(state_id)` (cascade lookups fast).

Data import: user khud CSV/SQL se countries/states/cities bharega.

**API routes (service-role backed, Next.js):**
- `GET /api/locations/countries` → `[{ id, name }]`
- `GET /api/locations/states?country=<id>` → `[{ id, name }]`
- `GET /api/locations/cities?state=<id>` → `[{ id, name }]`

Yeh routes existing server supabase helper (jaisa `web/lib/plan-server.ts` use karta hai) reuse karenge. Anon key browser me expose nahi hoga.

**Acceptance:** Location API routes sahi cascade data lautaayein; billing insert order route se ho.

---

## Workstream 4 — App: Payment + Documents

### 4a. Payment (Play-Store-safe) — verify only
- `app-mobile/src/app/upgrade.tsx` jaisa hai waisa rahega; pay button pehle se `WebBrowser.openAuthSessionAsync(url, returnUrl)` se web checkout kholta hai.
- App me koi Razorpay/native payment nahi. Sirf verify karo ki checkout URL sahi banta hai aur wapas aane pe plan refresh hota hai.

### 4b. Document local save
- Dependency add: `expo-file-system` (Expo v57 versioned docs ke hisaab se).
- `add-document.tsx`: photo pick hone ke baad ImagePicker ka cache URI ko permanent folder me copy karo — `FileSystem.documentDirectory + "documents/"` (folder ensure/create karo), unique filename.
- Copied local URI ko `addDocument()` me `file_uri` ke roop me pass karo.
- `supabase/schema.sql`: `documents` table me `file_uri text` column add (`alter table ... add column if not exists`).
- `app-mobile/src/lib/documents.ts`: `Document` type me `file_uri: string | null`; `addDocument` input me `file_uri` accept + insert.

### 4c. Document view
- Nayi screen: `app-mobile/src/app/document-view.tsx` — params se `file_uri` (ya doc id) le kar poori photo full-screen dikhaye (pinch-zoom nice-to-have; basic full-screen `Image` + close button minimum).
- `doc-card` / documents list: card **tap** (short press) pe `router.push` view screen (long-press abhi delete ke liye hai — woh rahega).
- File missing ho (purana doc bina file_uri) to friendly message: "Is document ki file save nahi hai."

**Acceptance:** Naya document add karo photo ke saath → documents list me tap karo → poori photo full-screen khule. App restart ke baad bhi file rahe (cache clear se na jaaye).

---

## Rollout / order of work

1. DB: `locations-billing.sql` + `documents.file_uri` column.
2. Web: location API routes.
3. Web: Pricing button fix.
4. Web: Checkout form + order route billing save.
5. App: `expo-file-system` + local save + `file_uri`.
6. App: document-view screen + card tap.
7. App: upgrade/web-checkout flow verify.

## Open risks

- Local-only files: user doosre device pe file nahi dekh payega (accepted for now).
- Play Store: web-checkout link bhi kabhi-kabhi policy pe review me aa sakta hai; abhi user ne yeh flow choose kiya hai.
- Location data import user pe depend karta hai — jab tak import nahi, dropdown khaali dikhega (empty-state message dikhana chahiye).
