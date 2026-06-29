# Saathi — MVP Design Document

**Date:** 2026-06-29
**Status:** Draft (review ke liye taiyaar)
**Working naam:** Saathi (baad mein change ho sakta hai)

---

## 1. Vision (ek line)

> Ek AI saathi jo aapke zaroori documents aur dates kabhi bhulne nahi deta, aur ek dost ki tarah bina pooche aapki life ka khayal rakhta hai.

**Core identity = "dost"**, core job = "documents + important dates ka guardian".

---

## 2. Hum kis problem ko solve kar rahe hain

- Log apne zaroori documents (passport, driving license, insurance, FASTag, warranty, rent agreement) ki **expiry bhool jate hain** — aur last minute pareshani hoti hai.
- Roz ke kaam/reminders manage karna effort lagta hai.
- ChatGPT/Google **reactive** hain (aap poocho tabhi help) — **proactive nahi** (khud yaad nahi dilate).

**Hamara edge:** Proactive + India-first + warm "dost" personality.

---

## 3. Kis ke liye (target user)

- Pehla user: **khud + aap jaise log** (jo problem khud feel karte hain), India.
- Baad mein: young professionals / families.

---

## 4. MVP Features (jo banayenge)

| # | Feature | Kaam |
|---|---|---|
| 1 | **Dost se chat — type YA bol ke** 🎙️ | Type karo ya mic se bolo: "kal 8 baje uthana". Saathi text + voice (TTS) dono mein jawab de sakta hai. |
| 2 | **Document vault + AI** | Photo/PDF daalo → AI expiry date + key info nikalta hai → safe (private) rakhta hai. |
| 3 | **Smart reminders** | Document expiry pe khud yaad (1 mahina + 1 hafta pehle + expire pe), aur user ke bole hue reminders. |
| 4 | **Daily brief** | Har subah push: "Aaj 2 kaam, insurance is hafte expire ho raha hai, gym 7 baje." |
| 5 | **AI memory** | Jo user batata hai woh yaad rakhe (user ke apne DB mein, local/private). |

---

## 5. Abhi NAHI (Phase 2 — baad mein)

Gym/habit tracker (full), job-switch help, interview Q&A, calendar sync, family mode, web product version. Sab MVP chalne ke baad add honge.

---

## 6. Screens (MVP — 6)

1. **Welcome / Onboarding** — saathi ka naam set karo, notification + mic permission.
2. **Home** — upar **daily brief card**, neeche **chat** (type + voice). (Option C layout)
3. **Documents** — saved docs list, har doc pe status: 🟢 safe / 🟡 jald expire / 🔴 expire.
4. **Add Document** — camera / gallery se upload.
5. **Reminders** — saare reminders ek jagah.
6. **Settings** — privacy, data export/delete, saathi ka naam.

---

## 7. Architecture (kaise kaam karega)

```
📱 App (React Native / Expo)
      │
      ├──► Supabase ready-made API (GET/POST)  →  data save/load (documents, messages, reminders)
      │
      └──► Edge Functions (apna custom code)
                 ├─ POST /chat          → Claude AI se chat reply (streaming)
                 └─ POST /scan-document → document se expiry + info nikalna
                            │
                            └──► 🤖 Claude API (Haiku)

🗄️ Supabase = Database (PostgreSQL) + Auth (login) + Storage (documents) + Edge Functions
🔔 Notifications = Expo Notifications / FCM
🌐 Landing page = Next.js (Vercel pe, free)
```

### Components (har ek ka ek clear kaam)

- **App (Expo/React Native):** UI, chat, voice input/output, camera, notifications dikhana. Android first.
- **Supabase ready-made APIs:** simple data CRUD (documents, messages, reminders) — auto-generated, code nahi likhna.
- **Edge Function `/chat`:** user message le → Claude Haiku ko bheje → reply (streaming) → messages save → reply return. (Apna code, full control.)
- **Edge Function `/scan-document`:** image/PDF le → Claude (vision) se `{type, expiry_date, key_info}` nikale → documents table me save.
- **Reminder engine:** normal scheduled logic (AI nahi) — expiry ke aage 1 mahina/1 hafta/expire pe notification. Device-local + backend scheduled job.
- **Daily brief job:** har subah ek scheduled function → aaj ke reminders + is hafte ki expiry → ek chhota brief → push notification.

### AI ka use (cost control)

AI sirf 2 jagah: **chat reply** aur **document scan**. Baaki sab (reminders, expiry status, lists) **normal code** se. Model: **Claude Haiku** (sasta + fast).

---

## 8. Data Model (shuruaati tables)

- `users` — id, name, saathi_name, created_at
- `documents` — id, user_id, type, file_url, expiry_date, key_info, status, created_at
- `messages` — id, user_id, role (user/saathi), content, created_at
- `reminders` — id, user_id, title, remind_at, source (manual/expiry), status

*(Detail implementation plan mein final hoga.)*

---

## 9. Privacy (shuru se sahi — DPDP-ready)

- Documents **user ke apne private Supabase storage** mein (encrypted, sirf woh user access kare — Row Level Security).
- **Claude ke memory server pe kuch save NAHI** — Claude API stateless, hum sirf zaroori cheez bhejenge.
- User chahe toh **sab data export / delete** kar sake.
- Privacy policy + consent onboarding mein.
- Hamari chat/brainstorming bhi kisi external memory server pe save nahi (user ki request).

---

## 10. Speed (slow na ho)

- Supabase **region: Mumbai/Singapore** (India ke paas).
- Chat: **Haiku + streaming** (word-by-word) → fast feel.
- **Device cache** → app khulte hi data instant, background sync.
- Data operations milliseconds mein; sirf AI reply ~1-2 sec (har AI app jaisa).

---

## 11. Tech Stack (final — MVP)

- **App:** Expo (React Native), Android first
- **Backend/DB/Auth/Storage:** Supabase (free tier se shuru; open-source, baad mein migrate/self-host option)
- **Custom backend logic:** Supabase Edge Functions (apna code) — NestJS abhi NAHI
- **AI:** Claude Haiku (API key sirf backend/Edge Function mein, app mein kabhi nahi)
- **Notifications:** Expo Notifications / FCM
- **Landing page:** Next.js on Vercel (free)
- **Code storage:** GitHub
- **Voice:** speech-to-text (input) + text-to-speech (output)

---

## 12. Build Plan (phases)

| Phase | Kya | Time (approx) |
|---|---|---|
| **Phase 0** | **Landing page** (idea detail + waitlist signup) — validate demand | 1-2 din |
| **Phase 1** | **Mobile app MVP** (upar ke 5 features + 6 screens) | ~4-6 hafte |
| **Phase 2** | Gym/habit, job/interview, voice polish, web version | Baad mein |

---

## 13. Cost

- **One-time:** ~₹2,000 (Google Play account)
- **Monthly (MVP, chhote users):** ~₹1,000-2,000 (mostly Claude AI)
- **Optional:** domain ~₹800/saal (landing page ke liye)
- Supabase / Vercel / GitHub / notifications = **₹0** (free tiers)

---

## 14. Success Criteria (MVP safal kab?)

- 20-30 real users app use karein.
- Log **wapas aayein** (retention) — khaas kar daily brief + expiry alert ki wajah se.
- Kam se kam kuch users kahein: "achha hua, warna ye date miss ho jati."

---

## 15. Khule sawaal (implementation plan mein tय honge)

- Exact daily brief ka time (default subah 8 baje? user set kare?).
- Voice input ke liye on-device STT vs cloud STT.
- Reminders: pure device-local vs backend scheduled (ya dono).
- App ka final naam + branding.
