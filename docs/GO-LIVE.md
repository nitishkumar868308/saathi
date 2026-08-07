# 🚀 Apka Saathi — GO-LIVE Guide (step-by-step, aaram se)

4 hisse: **A) Supabase (DB)** → **B) Cron** → **C) Vercel (web)** → **D) App build (EAS)** → **E) Final test**.
Order maano — pehle A, phir B, C, D.

---

## 🟢 PART A — Supabase (Database + AI)

Kahan: <https://supabase.com/dashboard> → apna project kholo.

### A1. SQL files chalao (SQL Editor)
1. Left sidebar → **SQL Editor** → **+ New query**.
2. Neeche di file ko VSCode me kholo (`d:\my-app\supabase\<file>`), **poora content copy** karo, SQL Editor me **paste** karo, **RUN** (▶) dabao. Green "Success" aana chahiye.
3. Ye **naye** files zaroor chalao (dobara chalana safe hai):

| File | Kya karta hai |
|------|----------------|
| `fix-name-sync.sql` | User ka **naam** DB + admin me sahi dikhe |
| `admin-documents.sql` | Admin ka **Documents tab** chale |
| `document-summary.sql` | Document scan ka **AI summary** save ho |
| `renewal-master.sql` | Renew page ka **master** (fields/tags/languages). ⚠️ Ye purane renewal guides **khaali kar deta hai** — backup pehle banata hai |
| `notes-admin-content.sql` | Admin me **notes ka poora matn** dikhe. ⚠️ Pehle privacy policy me ye baat likhi honi chahiye |

> Agar app **pehle se live** hai to baaki purani files (schema/profiles/storage/rewards…) already chal chuki hongi — bas ye naye chalao.
>
> Agar **naya project** hai to poora kram `docs/DEPLOYMENT.md` → section **1a** me hai.
> ⚠️ Wahi dekhna — yahan ki chhoti list se kaam nahi chalega. Pehle yahan ek
> chhota kram likha tha jisme aadhi files thi hi nahi (notes, support, device,
> phone OTP, renewal…), aur usse naya project hamesha aadha toota hua khada
> hota tha.

### A2. Extensions ON karo (cron ke liye)
- Left → **Database** → **Extensions**.
- Search **`pg_cron`** → toggle **ON**.
- Search **`pg_net`** → toggle **ON**.

### A3. Storage buckets check
- Left → **Storage** → **`documents`** (private) aur **`avatars`** (public) buckets dikhne chahiye.
- Na dikhe to `storage.sql` chalao.

### A4. Gemini AI key daalo (2 me se koi 1 tarika)

**Tarika 1 — Dashboard (asaan):**
- Left → **Edge Functions** → **Secrets** (ya Project Settings → Edge Functions → Secrets).
- **Add new secret**: Name = `GEMINI_API_KEY`, Value = `<asli-key>`. Save.

**Tarika 2 — CLI:**
```bash
npx supabase login
npx supabase link --project-ref <project-ref>    # ref: Settings → General → Reference ID
npx supabase secrets set GEMINI_API_KEY=<asli-key>
```

> ⚠️ Jo key di thi (`AQ.Ab8...`) wo Gemini format **jaisi nahi** (Gemini keys `AIza...` se start hoti hain, ~39 chars). AI fail ho to <https://aistudio.google.com/apikey> se nayi banao.

### A5. AI function deploy karo (CLI zaroori — sirf Dashboard se nahi hota)
```bash
cd d:\my-app
npx supabase functions deploy ai
```
Iske baad chat/scan/reminder/brief live. (`chat` function use karte ho to `npx supabase functions deploy chat` bhi.)

### A6. Google login (agar use kar rahe ho)
- Left → **Authentication** → **Providers** → **Google** → enable.
- **Redirect URLs** me add: `https://apkasaathi.com` (web) + `saathi://auth` (app).

---

## 🟠 PART B — Cron (kahan daalna hai + paths)

Cron **bhi Supabase SQL Editor me** hi daalte hain (pg_cron). Ye tumhare web ke `/api/cron/...` routes ko time pe khud call karta hai.

### B1. Ek `CRON_SECRET` decide karo
Koi lamba random string, jaise: `saathi-cron-7fK92mPq5xZ`.
Ye **2 jagah SAME** daalna hai: (a) Vercel env (Part C), (b) neeche cron SQL files me.

### B2. Cron SQL chalao (SQL Editor me)
Har file kholo → usme `<CRON_SECRET>` ko apni value se **replace** karo → **RUN**:

| File | Kaam | Kaunsa URL call karta hai | Kitni baar |
|------|------|----------------------------|------------|
| `cron-reminders.sql` | Reminders bhejta | `…/api/cron/send-reminders` | har **minute** |
| `cron-document-expiry.sql` | Document expiry (WhatsApp/email) | `…/api/cron/document-expiry` | har **ghanta** |
| `cron-error-digest.sql` | Error email digest | `…/api/cron/error-digest` | har **30 min** |

> URL me domain **apna** hona chahiye. Files me `https://www.apkasaathi.com/...` hai — agar tumhara Vercel domain alag hai to file me URL badal do.
> `schema "cron" does not exist` aaye to A2 (extensions) nahi hua — pehle wo karo.

### B3. Cron chalu hai ya nahi — check
SQL Editor me:
```sql
select jobname, schedule, active from cron.job;
```
Teeno jobs `active = true` dikhne chahiye. Band karna ho: `select cron.unschedule('job-ka-naam');`

---

## 🔵 PART C — Vercel (web + admin + landing)

Kahan: <https://vercel.com> → apna project → **Settings** → **Environment Variables**.

### C1. Ye env vars add karo (Environment = **Production** aur **Preview** dono)

| Variable | Value kahan se |
|----------|----------------|
| `SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | API → `service_role` (Reveal) — **kabhi NEXT_PUBLIC_ nahi** |
| `NEXT_PUBLIC_SUPABASE_URL` | wahi Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | API → `anon` / public |
| `NEXT_PUBLIC_SITE_URL` | `https://apkasaathi.com` (apna domain) |
| `ADMIN_PASSWORD` | apni marzi (admin `/admin` login) |
| `GMAIL_USER` | tumhara@gmail.com |
| `GMAIL_APP_PASSWORD` | Gmail app-password (16-char, 2FA on karke) |
| `CONTACT_TO` | (optional) contact msgs kahan aayein |
| `TWILIO_ACCOUNT_SID` | Twilio console |
| `TWILIO_AUTH_TOKEN` | Twilio console |
| `TWILIO_WHATSAPP_FROM` | `whatsapp:+14155238886` (ya apna) |
| `CRON_SECRET` | **wahi value jo Part B me daali** |
| `NEXT_PUBLIC_GA_ID` | (optional) GA4 id |
| `NEXT_PUBLIC_PLAY_STORE_URL` | (optional) |

### C2. Redeploy
- **Deployments** → sabse upar wala → **⋯** → **Redeploy**.
- (Env sirf build pe padhta hai — isliye redeploy zaroori.)

### C3. Check
- `https://apkasaathi.com/admin` → `ADMIN_PASSWORD` se login → Users/Usage/Documents load hone chahiye.

---

## 🟣 PART D — App build (Android APK — EAS)

### D1. ⚠️ Sabse zaroori — EXPO_PUBLIC env (build-time)
Ye **na kiya to app khulte hi "Supabase set nahi" / blank** aayega (cloud build me local `.env` nahi jaata).

```bash
cd d:\my-app\app-mobile
npx eas-cli login
npx eas-cli env:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value https://xxxx.supabase.co
npx eas-cli env:create --scope project --name EXPO_PUBLIC_SUPABASE_KEY --value <anon-key>
npx eas-cli env:create --scope project --name EXPO_PUBLIC_OCR_API_KEY --value <ocr-key-ya-khali>
npx eas-cli env:create --scope project --name EXPO_PUBLIC_WEB_URL --value https://apkasaathi.com
npx eas-cli env:create --scope project --name EXPO_PUBLIC_REVENUECAT_ANDROID_KEY --value <revenuecat-key>
```
(Ya Expo dashboard → Project → **Environment Variables** se add karo — `preview` + `production` dono.)

### D2. Build banao
```bash
npx eas-cli build -p android --profile preview
```
- `preview` = internal **APK** (phone pe side-load karke test).
- Build ke baad EAS ek **APK link** dega → phone pe download + install.
- Naya **logo + app icon** isi build me aa jayega.

> Store pe daalna ho (baad me): `npx eas-cli build -p android --profile production` → AAB.

---

## ✅ PART E — Final test (APK phone pe install karke)

- [ ] **Login/Signup** (email) → naam bharo → admin `/admin` → Users me **naam dikhe**
- [ ] **Document add** → photo → **AI scan** naam/expiry bhare → save → admin Documents me dikhe + **View** pe preview + **AI summary** dikhe
- [ ] **Reminder** → text ya **🎤 voice** → AI time samjhe → notification aaye
- [ ] **Chat** → app ka sawaal (reminders/documents) → jawab; bahar ka sawaal (news/math) → politely mana kare
- [ ] **Pagination** — documents/reminders me 10 ke baad page controls
- [ ] Logo har jagah sahi + app icon home screen pe naya

Sab tick = **live jaane ke liye ready** 🎉

---

### Ek nazar me "sab chalega na?"
- Web (Vercel): env set + redeploy → haan.
- App (EAS): `EXPO_PUBLIC_*` env set + build → haan.
- AI (chat/scan/reminder/voice): `GEMINI_API_KEY` set + `ai` function deploy → haan.
- Cron: extensions ON + 3 SQL (CRON_SECRET match) → haan.
- Naam/Documents: 3 naye SQL chale → haan.
