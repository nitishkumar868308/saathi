# Apka Saathi — WhatsApp + Email Reminders Setup

Reminder time pe user ko **WhatsApp (Twilio) + Email (Gmail)** bhejne ka pipeline.
Flow: Supabase **pg_cron** (har minute) → web route `/api/cron/send-reminders` →
due reminders dhundho → WhatsApp + email bhejo → `notified_at` set karo.

## 0. ⚠️ Sabse pehle — Twilio token rotate karo
Aapka Auth Token chat me expose ho gaya tha. Twilio Console → **Account → API keys & tokens
→ Auth Token → Regenerate**. Naya token hi neeche use karna.

## 1. Web (apkasaathi.com) env vars
Ye web deployment ke env (`.env.local` / Vercel env) me daalo:

```
# Supabase (pehle se hai)
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...

# Gmail (pehle se hai — email isi se jayega)
GMAIL_USER=you@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx

# Twilio WhatsApp
TWILIO_ACCOUNT_SID=AC78a20272ba0e3975e3bcb4c0f9227a61
TWILIO_AUTH_TOKEN=<naya-rotate-kiya-hua-token>
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886   # sandbox number (trial). Live me apna.

# Cron protection (koi bhi random strong string)
CRON_SECRET=<ek-lamba-random-secret>
```

## 2. Twilio WhatsApp Sandbox (testing ke liye)
1. Twilio Console → Messaging → **Try it out → WhatsApp Sandbox**.
2. Sandbox ka number + join code milega (jaise "join <two-words>").
3. Apne WhatsApp se us number pe **"join <code>"** bhejo — ab aapka number opted-in hai.
4. `TWILIO_WHATSAPP_FROM` = sandbox number (`whatsapp:+14155238886` type).
5. **Important:** Sandbox sirf un numbers pe bhejta hai jinhone join kiya ho. Apna
   number app ke "Meri details" me bhi wahi daalo (E.164, +91...).

> Live launch pe: apna WhatsApp sender register karo (Meta business verification +
> approved utility template chahiye). Tab `TWILIO_WHATSAPP_FROM` apna number.

## 3. Supabase — DB columns aur cron
1. SQL Editor me run karo: **`supabase/reminders-notify.sql`**
   (reminders me `user_id` + `notified_at` add karta hai).
2. Dashboard → Database → **Extensions** → `pg_cron` aur `pg_net` **enable** karo.
3. **`supabase/cron-reminders.sql`** kholo, `<CRON_SECRET>` ko step-1 wali value se
   badlo, phir SQL Editor me run karo. (Har minute route call hoga.)

## 4. Test
- App me ek reminder banao ~2 min baad ka (apne opted-in number/email wale user se).
- 1-2 min me WhatsApp + email aa jana chahiye.
- Manual test bhi kar sakte ho:
  ```
  curl -X POST https://apkasaathi.com/api/cron/send-reminders \
    -H "Authorization: Bearer <CRON_SECRET>"
  ```
  Response: `{ processed, whatsapp, email, errors }`.

## Kaise kaam karta hai (short)
- App reminder save karti hai `reminders` me `user_id` ke saath (local push bhi lagti hai).
- Cron har minute due reminders (remind_at <= now, is_on, notified_at null) leta hai.
- Har reminder: `profiles.email` + `user_details.phone` se WhatsApp + email.
- `notified_at` set — dobara nahi jata.
- Templates branded hain (Apka Saathi logo/emoji) — `web/lib/email.ts` +
  `web/lib/twilio.ts` me.

## Notes / limits
- **Local push** (app me) alag hai aur turant lagti hai; WhatsApp/email server se
  time pe jaate hain — dono chalte hain.
- Gmail free ~500 emails/day tak. Zyada volume pe Resend/SES pe shift karna.
- WhatsApp reminders "utility" category — cheap; par business-verified template
  live me chahiye. Sandbox me testing free.
