# In-App Payment (Google Play Billing) + Profile Details + Local Documents — Design (v2)

Date: 2026-07-07
Status: Approved (design v2). **v1 (web Razorpay checkout) superseded — reasons below.**

## Kyun badla (v1 → v2)

v1 me plan tha: app se web pe le jaakar Razorpay se pay. **Ye Google Play policy ke against hai** — app ke andar consume hone waale digital subscription ke liye Google **Google Play Billing (GPB)** force karta hai; Razorpay allowed nahi. Isliye:

- **Payment ab app ke andar** GPB se hoga (via **RevenueCat / `react-native-purchases`**).
- **Web pe koi checkout nahi** — plan button ek "App download karo (Play Store)" **modal** kholega.
- Web ka Razorpay checkout page **delete nahi, comment out** (baad me kaam aa sakta hai).
- Billing/details **form app me** aa gaya (Supabase me save), payment se decoupled.
- **GST 18% abhi comment out** (GST registration nahi hai) — sirf base price dikhega.

## R&D summary (verify kiya)

- `expo-in-app-purchases` **deprecated/removed**. Aaj ke options: **RevenueCat (`react-native-purchases`)** ✅ recommended, ya `expo-iap` (archive ho raha), ya `react-native-iap` (DIY).
- IAP **Expo Go me nahi chalta** — **EAS development build** zaroori (native module).
- Play Console pe: subscription products + base plans, merchant/payments profile, kam se kam internal/closed testing track, license-testers.
- Fee 15%/30%. India me **GST Google khud collect/remit** karta hai — hamara manual GST math waise bhi hata rahe hain.

## Prerequisites (USER ko karne honge — code se bahar)

Ye main nahi kar sakta; code taiyaar rahega par ship/test tabhi:
1. Google Play Console: app ko internal testing track pe daalo, `plus_monthly` & `plus_yearly` subscription products banao.
2. Merchant/payments profile set karo.
3. **EAS development build** banao (`eas build --profile development`) — Expo Go se hatna hoga.
4. RevenueCat account: project banao, Play Console se link, Android API key lo → `.env` me `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`.
5. Entitlement `plus` + offerings RevenueCat me configure karo.

Code ko aise likhenge ki **RevenueCat na mile (jaise Expo Go me) to app crash na ho** — upgrade button "abhi available nahi / dev build chahiye" jaisa gracefully handle kare.

## Non-goals (abhi nahi)

- Documents cloud pe (abhi local device hi).
- RevenueCat → Supabase webhook (abhi purchase success pe app khud `profiles.plan` update karega; webhook baad me).
- iOS / App Store billing (abhi Android focus).

---

## Workstream 1 — Web

### 1a. Plans button → "Download app" modal
`web/components/Pricing.tsx`:
- Plan CTA ab `/checkout` ya `#waitlist` nahi — ek **modal** kholega: "Saathi abhi app pe hai — Play Store se download karo". Nice copy + Play Store button/link. Pricing already client component hai, `useState` se modal.

### 1b. GST comment out
`web/components/Pricing.tsx`:
- `gstTotal()` function, `showGst` block, aur "+ GST · Total ..." note ko **comment out** (delete nahi). Sirf base price (`plan.price`) dikhe.

### 1c. Web checkout comment out
- `web/app/checkout/page.tsx`: `CheckoutClient` render **comment out**, page bas `/` pe redirect kare (ya khaali). `web/components/CheckoutClient.tsx` file rahegi (unused, delete nahi).
- Web location API routes / web billing save: **v2 me nahi bante** (form app me hai). Razorpay web order/verify routes jaise hain waise rahenge (unused).

---

## Workstream 2 — Database

**Nayi file:** `supabase/locations-billing.sql` (idempotent).

Tables:
- `countries(id, name, code)`, `states(id, country_id→countries, name)`, `cities(id, state_id→states, name)` — cascade. **Public read** RLS. User data import karega.
- `user_details` — **per-user, upsert** (v1 ke per-order `billing_details` ki jagah):
  ```
  user_id uuid unique → auth.users,
  full_name, email, phone (E.164), phone_dial_code, phone_country,
  address, gender, country_id, state_id, city_id, updated_at
  ```
  RLS: **own row** (`auth.uid() = user_id`) — app authed user seedha likhta/padhta hai.

**Modify:** `supabase/schema.sql` — `documents.file_uri text` column.

"Details complete?" ka matlab: `full_name, phone, address, gender, city_id` sab present.

---

## Workstream 3 — App: Profile details form

**Nayi screen:** `app-mobile/src/app/profile-details.tsx`
- Fields (sab required): Full name, Email, Phone (country-wise validation), Address, Gender, Country → State → City cascade.
- **Phone validation:** `libphonenumber-js` (pure JS, RN-safe) — default country IN, calling-code picker, `isValidPhoneNumber`. Save: `phone` (E.164 `+9198...`), `phone_dial_code` (`+91`), `phone_country` (`IN`).
- Cascade: Supabase se direct (`countries`/`states`/`cities`, public read).
- Load existing `user_details` → prefill/edit. Save → upsert.
- Entry: Settings me "Meri details" row se; aur upgrade flow se (details adhoori ho to).

**Settings:** `settings.tsx` me ek "Meri details" row add (profile-details kholta hai).

---

## Workstream 4 — App: Payment (RevenueCat / GPB)

- Dep: `react-native-purchases` + Expo config plugin (`app.json`). Env: `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`.
- **Wrapper:** `app-mobile/src/lib/purchases.ts` — safe init (module na mile to no-op), `getOfferings()`, `purchasePlus(pkg)`, `isPlusActive()` (entitlement `plus`). Expo Go / missing-key me graceful.
- **upgrade.tsx:**
  - GST comment out (base price only).
  - "Securely pay" → ab: (1) `user_details` complete? nahi → `profile-details` kholo (returnTo upgrade). (2) haan → RevenueCat purchase (`purchasePlus`).
  - Purchase success → app khud `profiles.plan='plus', plan_source='google_play'` update kare (RLS own-profile), taaki `getPlan()`/doc-limit turant unlock ho. (Webhook baad me.)
  - RevenueCat available na ho → toast: "Payment abhi is build me available nahi (dev build chahiye)".
- **plan.ts:** `getPlan()` waisa hi (Supabase). Purchase success pe profiles update hone se isPlus reflect hoga.

---

## Workstream 5 — App: Local documents (v1 se unchanged)

- `expo-file-system` add. Picked image ko `documentDirectory/documents/` me copy → local path.
- `documents.file_uri` column + `documents.ts` field + `add-document.tsx` copy.
- Nayi `document-view.tsx` — full-screen image. `doc-card` tap → view. Home + documents list wired.

---

## Rollout order

1. DB: `locations-billing.sql` (+ user_details) + `documents.file_uri`.
2. Web: GST comment-out + plans "download app" modal + checkout comment-out.
3. App: `libphonenumber-js` + `profile-details.tsx` + settings row.
4. App: `react-native-purchases` + `purchases.ts` + upgrade.tsx rewire + GST comment-out.
5. App: local documents (file_uri, copy, view, tap).
6. Verify (dev build note for payment).

## Open risks

- **GPB ship/test user ke Play Console + dev-build setup pe rukega** — code taiyaar, par "done" iske bina nahi.
- Location data import na ho to dropdown khaali (empty-state message).
- Local-only files: doosre device pe file nahi (accepted).
- No RevenueCat webhook: agar user refund/cancel kare to app-side `profiles.plan` stale reh sakta hai jab tak webhook add na ho (baad me).
