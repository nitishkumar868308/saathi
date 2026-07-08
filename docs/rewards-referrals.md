# Apka Saathi — First-1000 Reward + Referrals

Waitlist hata di gayi. Ab do offer hain, dono **admin se manage** hote hain.

## 1. Pehle 1000 users → 3 mahine Plus free
- Signup order (`profiles.created_at` rank ≤ 1000) ke hisaab se.
- Login pe app `claim_first_n_reward()` RPC call karti hai. **Idempotent** — ek hi baar milta hai.
- Grant hone pe `profiles.first_n_granted = true`.

## 2. Referral → dono ko 15 din Plus (cap 6 mahine)
- Har user ka apna `referral_code` (signup pe auto-generate).
- Share link: `https://apkasaathi.com/r/CODE` → app khulte hi code **auto-fill**.
- Naya user code daale → `apply_referral_code()` → `referrals` row banti hai.
- **Reward tab milta hai jab naya user dono kaam kare:**
  1. Pehla **document upload**
  2. Saathi se **kam se kam 1 chat**
  
  Tab `check_referral_qualification()` dono ko din de deta hai.
- **Cap sirf referrer pe** (6 mahine = 180 din). Naye user ko uska ek-baar ka reward hamesha.
- Din hamesha `greatest(now, plan_expires_at) + N days` pe **add** hote hain — **paid plan bhi extend** hota hai.

### Anti-fraud
- `referee_id` unique → ek user sirf ek baar refer ho sakta hai.
- Self-referral DB constraint se block.
- Chat message **server-side** record hota hai (`ai` edge function, service-role se `messages.user_id`), client se nahi.
- Document `user_id` ke saath insert hota hai.

## 3. Chat abhi "stub mode" me hai
`ai` edge function bina `ANTHROPIC_API_KEY` ke ek fixed reply deta hai — **par message phir bhi record karta hai**, isliye referral ki "first chat" condition aaj bhi kaam karti hai.

**Asli AI chalu karne ke liye sirf key set karo, koi code change nahi:**
```
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```
(Key kabhi app ki `.env` me mat daalna — ye server secret hai.)

## Admin panel — `/admin` → **Rewards** tab
Ye sab live change kar sakte ho (DB `app_config` table):

| Knob | Default | Matlab |
|---|---|---|
| `first_n_enabled` | true | First-1000 offer chalu/band |
| `first_n_users` | 1000 | Kitne users tak |
| `first_n_free_months` | 3 | Kitne mahine free |
| `referrals_enabled` | true | Referral chalu/band |
| `referral_days` | 15 | Har referral pe din (dono ko) |
| `referral_cap_months` | 6 | Referrer max kitne mahine kama sakta hai |

Saath me **"Manually Plus din do"** — email + din daal ke kisi ko bhi din grant/extend kar sakte ho.

## Web se referral share (`/referral`)
User apne **app wale hi account** se web pe login karke apna code/link share kar sakta hai
(copy, WhatsApp, native share) aur stats dekh sakta hai.

Iske liye web env me ye **do naye** vars chahiye:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```
⚠️ **Anon key hi daalna** — service-role key browser me chali jayegi. Anon key public
safe hai; suraksha RLS se aati hai (`profiles` own-row, `referrals` own-row).

Google login web pe chahiye to Supabase → Authentication → URL Configuration me
`https://apkasaathi.com/referral` ko redirect URL me add karo. (Email/password bina
kisi extra setup ke chalta hai.)

## Offer copy dynamic hai
Admin se numbers badalte hi **web aur app dono ka text** khud badal jaata hai —
koi deploy nahi chahiye. Offer band karo to uska banner/row poori tarah gayab.
- Web: `lib/offers.ts` → `/api/offers` → `useOffers()`
- App: `plan.getOffers()` → `use-offers.ts`

## Setup (order me)
1. Supabase SQL Editor me run karo: **`supabase/rewards-referrals.sql`**
2. `ai` edge function deploy karo (chat record + stub reply ke liye):
   ```
   supabase functions deploy ai
   ```
   Secrets: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` Supabase khud inject karta hai.
   `ANTHROPIC_API_KEY` **optional** — na ho to stub mode.
3. Web me `ADMIN_PASSWORD` + `SUPABASE_SERVICE_ROLE_KEY` set hon (admin panel ke liye).
4. Deep link chalane ke liye app ka `apkasaathi.com/r/*` association (Android App Links) baad me set karna — abhi web page Play Store bhej deta hai aur user code khud daal sakta hai.

## RPC reference
| Function | Kaun call karta hai | Returns |
|---|---|---|
| `claim_first_n_reward()` | app (login pe) | `granted` / `already` / `not_eligible` / `disabled` |
| `apply_referral_code(p_code)` | app (pehle SIGNED_IN pe) | `applied` / `invalid_code` / `already_referred` / `self` |
| `check_referral_qualification()` | app (chat/doc ke baad) | `rewarded` / `need_document` / `need_chat` / `no_referral` |
| `admin_grant_days(p_email, p_days)` | admin API (service_role) | `granted` / `user_not_found` |
| `grant_plus_days(uid, days)` | internal helper | — |

## Notes / abhi baaki
- `documents` / `messages` pe RLS abhi permissive hai (pre-launch). `user_id` add ho chuka hai — baad me own-row RLS lagana chahiye.
- Purana `claim_waitlist_reward()` function DB me pada reh sakta hai; app ab use nahi karti.
- `waitlist` table aur uska data **delete nahi kiya** — admin me legacy tab me dikhta hai.
