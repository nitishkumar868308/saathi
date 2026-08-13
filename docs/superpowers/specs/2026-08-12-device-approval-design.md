# Device approval — naya phone, wahi account

**Date:** 2026-08-12
**Status:** bana diya gaya (SQL abhi chalayi nahi gayi — neeche "Chalane se pehle")

## Banate waqt spec se do farak

Dono banate waqt pakde gaye, isliye yahan darj hain:

**1. `device_tokens` me `device_id` column jodna pada.**
Spec me ye tha hi nahi. `save_device_token(p_token, p_platform)` sirf token aur
platform leta tha — yaani "purane phone ka token hata do" karna **namumkin** tha,
kyunki pata hi nahi chalta ki kaun sa token kis phone ka hai. Bina iske poora
feature aadha reh jaata. Ab function ka teesra parameter hai (`p_device_id`,
default null) aur purana 2-parameter wala version drop hota hai.

**2. `claim_device_if_free` me takeover.**
Spec me ye "khaali ghar hi lo" tha (`approved_user_id is null`). Wo ek chup-chaap
fail thi: ek hi phone par A ne login kiya (row A ke naam), A logout hua, B login
kiya — B ka apna koi active phone nahi, isliye use patti bhi nahi dikhti, aur
update `is null` par atak jaata tha. Natija: B ke reminder chup, aur screen par
ek shabd bhi nahi. Ab wo `activate_device` chalata hai, jo takeover sambhalta hai
(rok "ek USER ka ek phone" hai, "ek phone ka ek user" nahi).

## Kya problem hai

User naya phone leta hai aur usi ID se login karta hai. Aaj app use rokti nahi —
par teen cheezein chup-chaap toot jaati hain, aur teenon ka koi error nahi aata:

- **Reminder ke alarm phone ke ANDAR lagte hain** (notifee). Naye phone par wo
  tab tak nahi lagte jab tak app khule; purane phone par purane alarm bajte
  rehte hain. Ek reminder do phone par do alag waqt par baj sakta hai.
- **FCM token phone ka hota hai, user ka nahi.** Dono phone logged-in rahen to
  admin ka message dono par jaata hai — user ko lagta hai "do baar kyun aaya".
- **Purane phone par saare documents khule pade rehte hain** — chahe wo bech
  diya gaya ho.

Aaj ke `DeviceOwnerWarning` aur `MultiDeviceWarning` sirf CHETAVNI hain, rok
nahi. Wo baat keh dete hain par kuch theek nahi karte.

## Tay ho chuke faisle

| Sawaal | Faisla |
|---|---|
| Verification kaise? | **Sirf email OTP.** Phone number par nahi — naya phone lene par purana SIM aksar chala jaata hai; email hamesha pahunchta hai, aur SMS ka kharcha bhi bachta hai |
| Login block hoga? | **Nahi.** Sab data dikhega. Sirf notification/alarm rukega + ek saaf patti dikhegi |
| Purane phone ka kya? | **Ek waqt me ek hi active phone.** Naya active hote hi purana apne aap inactive |
| Admin ka role? | Device list dekhna + exception me manually approve karna. Har case ka rasta nahi |

## Ek zaroori design decision

**Pehla device apne aap active hoga, bina OTP ke.**

Niyam: jab user ka koi bhi active device NA ho, to abhi wala device apne aap
active ho jaata hai. OTP sirf tab maanga jaata hai jab uska pehle se ek active
device ho aur wo kisi DOOSRE par login kare.

Iske bina har naya signup pehle hi din ek email-OTP ki deewar se takrata — jo
onboarding ka sabse bura tarika hota.

⚠️ Iska ek tradeoff hai jo saaf likha jaana chahiye: jiske paas aapka password
hai wo login karke aapke documents DEKH sakta hai (kyunki humne "block nahi"
chuna hai). Uske phone par notification nahi jayengi aur aapka phone active hi
rahega — par dekhna nahi rukta. Ye maana hua tradeoff hai, chhupi hui kami nahi.

## Data model

### `devices` me naye column

```sql
alter table public.devices
  add column if not exists approved_user_id uuid references auth.users(id) on delete set null,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_via text;   -- 'first' | 'otp' | 'admin'
```

"Ek waqt me ek phone" **DB khud** guarantee karega, code nahi:

```sql
create unique index if not exists devices_one_active_per_user
  on public.devices (approved_user_id)
  where approved_user_id is not null;
```

⚠️ Ye partial unique index hi is poore feature ki reedh hai. Isse "do phone ek
saath active ho gaye" wali race condition ban hi nahi sakti — do parallel
approve me se ek DB par hi fail ho jayega.

### `device_approval` table — email code

`app_lock_reset` ka bilkul wahi dhaancha (wo pehle se chal raha hai, uske
rate-limit/cooldown/tries sab test ho chuke hain):

```sql
create table if not exists public.device_approval (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  code_hash text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  tries int not null default 0,
  used_at timestamptz,
  ip text
);
alter table public.device_approval enable row level security;
-- Koi policy nahi = app se bilkul nahi padha ja sakta. Sirf service_role.
```

## Naye RPC

| Function | Kaun bula sakta | Kaam |
|---|---|---|
| `my_device_state(p_id text)` | authenticated | `{ active, needs_approval, other: {platform, last_seen_at} }` |
| `claim_device_if_free(p_id text)` | authenticated | Koi active device na ho to isse active karo (`via='first'`). Warna kuch nahi |
| `device_approval_issue(p_user, p_device, p_hash, p_ip)` | service_role | Rate limit + code hash likho |
| `device_approval_check(p_user, p_device, p_hash)` | service_role | Code jaancho **aur usi call me** device active karo + baaki inactive + unke FCM token delete |
| `admin_device_list(p_uid uuid)` | service_role | Admin panel ke liye |
| `admin_device_approve(p_uid uuid, p_id text)` | service_role | Exception path |

⚠️ `device_approval_check` ka jaanchna aur activate karna **ek hi call me** hona
zaroori hai. Do call banane par doosri ke paas apna koi saboot nahi hota ki code
verify ho chuka tha — app seedha doosri maar ke bina code ke device active kar
leti. Yahi galti `app-lock-reset.ts` me pehle pakdi ja chuki hai.

⚠️ Har naye function par `revoke ... from public, anon, authenticated` likhna
zaroori hai. Postgres default se EXECUTE **PUBLIC** ko deta hai.

## Web API

- `POST /api/device/approve/send` — `appUser()` → `device_approval_issue` → email
- `POST /api/device/approve/confirm` — `appUser()` + `{ code, deviceId }` → `device_approval_check`
- `GET/POST /api/admin/devices` — `guard("devices")` → list / approve

Email template `sendDeviceApprovalEmail`, `sendAppLockResetEmail` ki tarah.
Tarteeb wahi: **pehle DB, phir email** — ulta karne par fail hue insert ke baad
code ja chuka hota hai jo kabhi verify nahi ho sakta.

## App

**Nayi file** `src/lib/device-approval.ts` — `app-lock-reset.ts` ka mirror.

**Gates (yahi asli rok hai):**
- `push.ts` — device active na ho to `save_device_token` mat bhejo
- `notifications.ts` → `runSync()` — active na ho to alarm mat lagao

**UI:** login ke baad ek patti (banner). Tap par modal:
- kyun ruka hai, saaf bhasha me
- "Email par code bhejo" → 6 ank ka input → verify
- "Code nahi aa raha? Support se baat karo" → `support.tsx`

**Logout par token hatao** (audit finding #2 — iske bina poora feature adhoora
hai): `signOut()` abhi sirf local lock bhoolta hai. Token row par purana
`user_id` pada rehta hai, yaani logout ke BAAD bhi us phone par us user ke
reminder aur admin broadcast aate rehte hain. Naya RPC `delete_my_device_token(p_token)`
(authenticated, sirf apna token) aur `signOut()` me uski call.

## Admin

- `ADMIN_MENUS` me naya `"devices"`
- `web/components/AdminDevices.tsx` — user ka device list: platform, fingerprint
  (brand/model), pehli baar kab dikha, aakhri baar kab, abhi active hai ya nahi
- "Is device ko approve karo" button → baaki apne aap inactive

⚠️ Admin ko device ki asli **hardware id kabhi nahi** dikhegi — wo hash bhi
server par nahi jaati (dekho `device.ts` ka comment). Sirf platform aur
brand/model wala fingerprint.

## Purane user kya karenge (migration)

Ye sabse nazuk hissa hai. Jo log aaj chal rahe hain unke paas `approved_user_id`
kisi bhi row me nahi hoga — yaani sab "inactive" ho jayenge aur sabke reminder
ek saath band ho jayenge. Wo is feature ki sabse mehngi galti hogi.

Isliye migration me: har user ke liye uska sabse haal me dikha device apne aap
approve kar do (`via='first'`):

```sql
insert into ... -- har user ka latest last_seen_at wala device
```

## Testing

1. Naya user, naya phone → OTP nahi maanga jaata, notification chalti hain
2. Wahi user, doosra phone → patti dikhti hai, alarm nahi lagte, data dikhta hai
3. OTP verify → naya phone active, purana inactive, purane ka token delete
4. Do phone par ek saath approve → ek DB par fail (partial unique index)
5. Purana user (migration ke baad) → kuch nahi badla, koi patti nahi
6. Logout → us phone ka token DB se gayab

## Chalane se pehle (zaroori tarteeb)

⚠️ **SQL abhi chalayi nahi gayi hai.** Yahan Postgres nahi hai, isliye main use
sirf likh saka — chala ke test nahi kar saka. Supabase SQL Editor me isi tarteeb
me:

1. `supabase/device-approval.sql` — poori file, ek baar
2. Uske baad **`device-tokens.sql` dobara MAT chalana.** Wo purana
   2-parameter wala `save_device_token` wapas laa dega, aur do overload hone par
   har token save "function is not unique" par fail hone lagega. (Wahan file me
   bhi ye warning likhi hai.)
3. Env var: `DEVICE_APPROVAL_PEPPER` (na ho to `APP_LOCK_PEPPER` → `OTP_PEPPER`
   par gir jaata hai; production me apna alag rakhna)

File ke aakhir me do jaanch wali query hain — migration ke baad wahi chala ke
dekh lena:
- har user ka ek hi active device (khaali aana chahiye)
- kitne users ka koi active device nahi (~0 hona chahiye)

## Jo is spec me JAAN-BOOJH KE nahi hai

- Tablet + phone dono active (aapne "ek waqt me ek" chuna)
- Login block karna (aapne "sab dikhe" chuna)
- SMS OTP (aapne "sirf email" chuna)
