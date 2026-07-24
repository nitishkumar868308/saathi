# Apka Saathi — Deployment Checklist

Teen jagah deploy hota hai: **Supabase** (DB + storage + AI functions + cron),
**Vercel** (web + admin + landing), **EAS** (Android/iOS app). Order: pehle Supabase,
phir Vercel, phir app build.

---

## 1. Supabase (backend)

### 1a. SQL files — SQL Editor me is order me Run karo
Har file idempotent hai (dobara chalana safe). Order matters (FK/trigger dependencies):

1. `schema.sql`            — documents / reminders / messages + RLS
2. `profiles.sql`          — profiles table + new-user trigger
3. `auth-rls.sql`
4. `storage.sql`           — avatars (public) + documents (private) buckets
5. `locations-billing.sql` — countries/states/cities + user_details
6. `plans.sql`, `plan-limits.sql`
7. `rewards-referrals.sql` — plans, referrals, admin_grant_days, admin_user_detail
8. `reviews.sql`
9. `error-logs.sql`
10. `country-pricing.sql`, `add-country-currency.sql`
11. `landing.sql`, `welcome-email.sql`
12. `document-notify.sql`, `reminders-notify.sql`
13. `admin-usage.sql`, `admin-usage-detail.sql`
14. `remove-launch-offer.sql`, `drop-waitlist.sql`
15. **`fix-name-sync.sql`**  ← naam (full_name) DB + admin me sahi dikhe (#7). profiles/locations/rewards ke BAAD chalao.

### 1b. Storage
`storage.sql` do bucket banata hai — `avatars` (public) aur `documents` (private, 10MB, jpeg/png/webp/pdf). Per-user RLS already set. Kuch manual nahi karna.

### 1c. Extensions + Cron
`pg_cron` + `pg_net` chahiye. Cron SQL files ab khud `create extension if not exists` kar leti hain, phir bhi na ho to **Dashboard → Database → Extensions** se `pg_cron` aur `pg_net` toggle on.

Cron jobs (SQL Editor, har file me `<CRON_SECRET>` ko apni asli value se replace karke):
- `cron-reminders.sql`        — har minute reminder sender
- `cron-document-whatsapp.sql`— har ghanta document expiry WhatsApp
- `cron-error-digest.sql`     — har 30 min error email digest

> ⚠️ `schema "cron" does not exist` = extension enable nahi. Upar wali do `create extension` lines pehle chala do.

### 1d. Edge Functions (AI)
```bash
supabase functions deploy ai
supabase functions deploy chat   # (agar Claude-based chat path use ho raha ho)
```

### 1e. Function secrets  ← #4 Gemini key yahan
`SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY` Supabase khud inject karta hai. Sirf AI key set karni hai:
```bash
supabase secrets set GEMINI_API_KEY=YAHAN_ASLI_KEY
# agar chat function use ho:
supabase secrets set ANTHROPIC_API_KEY=...
```
> ⚠️ Jo key di gayi (`AQ.Ab8...`) wo normal Gemini key format (`AIza...`, ~39 chars) jaisi NAHI hai.
> AI calls fail ho to [aistudio.google.com/apikey](https://aistudio.google.com/apikey) se nayi key banao.
> `ai/index.ts` sirf `GEMINI_API_KEY` naam ka secret padhta hai — naam wahi rakhna.

### 1f. Auth
- **Authentication → Providers → Google**: enable, redirect URLs me web `NEXT_PUBLIC_SITE_URL/...` + app scheme `saathi://auth` add.
- **Email**: confirm-email on/off apni marzi (on ho to signup pe `needsConfirm` true aata hai — app already handle karta hai).

---

## 2. Vercel (web + admin)

**Project Settings → Environment Variables** (Production, aur Preview) — `.env.local.example` se:

| Var | Kahan se |
|---|---|
| `SUPABASE_URL` | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | API → service_role (Reveal) — **kabhi NEXT_PUBLIC_ nahi** |
| `NEXT_PUBLIC_SUPABASE_URL` | wahi URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | API → anon/public |
| `NEXT_PUBLIC_SITE_URL` | `https://apkasaathi.com` |
| `ADMIN_PASSWORD` | apni marzi (admin login) |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` | Gmail app-password (16-char) |
| `CONTACT_TO` | optional (default GMAIL_USER) |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_WHATSAPP_FROM` | Twilio console |
| `CRON_SECRET` | koi lamba random string — **wahi jo cron SQL me daala** |
| `NEXT_PUBLIC_PLAY_STORE_URL` | optional |
| `NEXT_PUBLIC_GA_ID` | optional (GA4) |

> Env badalne ke baad **Redeploy** zaroori — Next.js env sirf build/start pe padhta hai.

---

## 3. EAS (Android app) — `eas build -p android --profile preview`

**Sabse common galti:** `EXPO_PUBLIC_*` vars build-time pe inline hote hain. Local `.env`
gitignored hota hai, isliye EAS **cloud build** me wo values automatically nahi jaati →
app khulte hi "Supabase set nahi hai" ya blank. Do me se ek karo:

**Option A (recommended) — EAS environment variables:**
```bash
eas env:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value https://xxxx.supabase.co
eas env:create --scope project --name EXPO_PUBLIC_SUPABASE_KEY --value <anon-key>
eas env:create --scope project --name EXPO_PUBLIC_OCR_API_KEY --value <ocr-key>
eas env:create --scope project --name EXPO_PUBLIC_WEB_URL --value https://apkasaathi.com
eas env:create --scope project --name EXPO_PUBLIC_REVENUECAT_ANDROID_KEY --value <revenuecat-key>
```
(Ya Expo dashboard → Project → Environment Variables. `preview` + `production` dono environments ke liye set karo.)

**Option B — eas.json me `env` block** (values commit ho jaati hain, sirf non-secret ke liye theek):
```jsonc
"preview": {
  "distribution": "internal",
  "android": { "buildType": "apk" },
  "env": { "EXPO_PUBLIC_WEB_URL": "https://apkasaathi.com" }
}
```

### Build steps
```bash
cd app-mobile
npx eas-cli@latest login          # ek baar
npx eas-cli@latest build -p android --profile preview
```
- `preview` = internal APK (side-load karke test). `production` = store AAB (autoIncrement on).
- Build ke baad EAS ek APK link deta hai → phone pe install karke check karo:
  login/signup (naam save), document scan (Gemini key live?), reminders, plan flow.

### Zaroori mobile env (`app-mobile/.env` / EAS env)
```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_KEY=          # anon/publishable — service_role NAHI
EXPO_PUBLIC_OCR_API_KEY=           # optional fallback OCR
EXPO_PUBLIC_WEB_URL=https://apkasaathi.com
EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=
```

---

## Quick sanity checklist
- [ ] `fix-name-sync.sql` chalaya → admin Users me naam dikhne lage
- [ ] `GEMINI_API_KEY` secret set + `ai` function deployed → app me chat/scan chalta hai
- [ ] Cron 3 files chali (extension enabled) → koi `schema "cron"` error nahi
- [ ] Vercel env sab set + redeploy → `/admin` login + Usage/Users load hote hain
- [ ] EAS preview APK me login + scan + reminders chalte hain
