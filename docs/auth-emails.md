# Auth emails — password reset & signup confirm, user ki bhasha me

Ye do email Supabase khud bhejta tha: **password reset** aur **signup confirm**.
Ab dono hamare haath se jaate hain — usi SMTP se jisse reminder aur welcome
jaate hain, aur usi bhasha me jo user ne app me chuni hai.

Is document me do cheezein hain:

1. wo bug jo is badlaav ki wajah bana (aur uska dashboard wala hissa — **ye
   karna zaroori hai**),
2. hook ka setup, step by step.

---

## 1. Bug: email me 8 ank, app me 6

Screenshot me email ka code `70228968` tha — **8 ank**. App ka khaana 6 ank par
kat jaata tha (`maxLength={6}`, aur `slice(0, 6)` baaki phenk deta tha). Yaani
user 8 ank type karta, app me sirf `702289` jaata, aur `verifyOtp` hamesha
"code sahi nahi hai" kehta.

User ke liye ye sabse bura roop tha: link bhi toota hua (Gmail ka scanner
recovery token pehle hi kha jaata hai), aur uska bataya hua vikalp bhi kabhi na
chalne wala.

Do wajah, dono theek ho gayi:

| Kahan | Kya tha | Kya hai |
| --- | --- | --- |
| Supabase dashboard | Email OTP length = **8** | **6** kar do (neeche) |
| `app-mobile/src/app/forgot-password.tsx` | 6 ank par kaat deta tha | 6–10 jo aaye, chal jaata hai (`CODE_MAX`) |
| Email ka text | "6-ank ka code" hardcoded | code ki ginti khud gin ke likhta hai |

### Dashboard me kya badalna hai

**Authentication → Sign In / Providers → Email** (us row par click karke expand
karo) **→ Email OTP Length → `6`** → Save.

⚠️ Ye setting `Authentication → Emails` wale page par **nahi** hai — wahan sirf
template aur SMTP hote hain. OTP ki lambai aur umar dono Email **provider** ke
andar hain.

6 hi rakhna behtar hai: OTP ka khaana aur `autoComplete="one-time-code"` dono
6 ank par sabse aaram se chalte hain, aur email padh ke type karne wale ke liye
6 ank 8 se kaafi aasan hote hain.

> Ab dashboard badalne par app tootegi nahi — app koi ginti maanti hi nahi, aur
> email apni ginti khud gin ke likhta hai. Ye do jagah pehle alag ho gayi thi,
> isliye ab kahin bhi `6` likh dena wahi bug wapas le aayega.

Usi jagah **Email OTP Expiration** bhi hai (default `3600` second = 60 minute).
Use badla to `AUTH_EMAIL_OTP_MINUTES` bhi badlo, warna email galat waqt bata
dega.

---

## 2. Bhasha: Send Email Hook

### Dikkat kya thi

Supabase ke `Authentication → Emails` wale template **poore project ke liye ek**
hote hain — ek subject, ek body. Wahan `{{ .Token }}` aur
`{{ .ConfirmationURL }}` to mil jaate hain, par ye jaanne ka koi zariya nahi ki
jise mail ja rahi hai usne Hindi chuni thi ya English.

Nateeja: reminder, document expiry, welcome, support ticket — sab user ki bhasha
me jaate the, aur theek wo do email jo **sabse pehle** aate hain hamesha ek hi
bhasha me. Jis buzurg ne app me Hindi chuni thi, uske paas bhi
"Password reset karein" Hinglish me pahunchta tha.

### Hal

Supabase ka **Send Email Hook**. Chalu hote hi GoTrue khud mail bhejna band kar
deta hai aur har auth email ke liye hamare endpoint par POST karta hai — user,
code aur token, sab de kar. Bhasha wahan `profiles.language` se uthti hai aur
mail hamare SMTP se jaata hai: wahi logo, wahi footer, wahi shakl jo baaki sab
emails ki hai.

Kaam kahan hota hai:

- `web/app/api/auth-email/route.ts` — hook ka endpoint (dastakhat check, kaunsa
  email hai, kis pate par, kaunsa token)
- `web/lib/email.ts` → `sendAuthEmail()` — teen bhashaon ka template
- `web/lib/user-locale.ts` → `localeForUserOrNull()` — bhasha kahan se aati hai

### Setup

Secret Supabase khud banata hai, aur **hook banane ke baad** hi dikhata hai —
isliye kram aisa rakho ki beech me kuch na toote.

**1. Web deploy karo** (endpoint live hona chahiye, tabhi Supabase use bulayega).

**2. Supabase → Authentication → Auth Hooks → "Send Email hook"**

- Type: **HTTPS**
- URL: `https://apkasaathi.com/api/auth-email`
- Create/Save

**3. Wahin dikhne wala secret (`v1,whsec_…`) poora copy karo.**

**4. Hook ko turant DISABLE kar do.** Secret bana rehta hai; ye sirf beech ka wo
waqt bachaane ke liye hai jisme hook chalu hai par secret hamare paas nahi.

**5. Vercel → Project Settings → Environment Variables** me daalo:

```
SEND_EMAIL_HOOK_SECRET=v1,whsec_xxxxxxxxxxxxxxxxxxxxxxxx
AUTH_EMAIL_OTP_MINUTES=60
```

**6. Redeploy karo** (env sirf build/start par padha jaata hai).

**7. Hook dobara ENABLE karo.**

> ⚠️ 4 aur 7 chhod dene par beech ka thoda waqt aisa reh jaata hai jisme hook
> chalu hai par secret nahi — aur us waqt sign-up aur password reset **dono fail
> honge** (endpoint 503 deta hai, jaan-boojh ke; 200 ka matlab hota "mail chali
> gayi", jo jhooth hota). Kam traffic ka waqt chuno.

### Test

1. App me bhasha **Hindi** karo → logout → "Password bhool gaye" → apna email daalo
2. Email poori Hindi me aani chahiye ("पासवर्ड रीसेट करें"), 6 ank ka code
3. Wahi code app me daalo → naya password banna chahiye
4. Bhasha **English** karke dohrao — email English me aani chahiye

Email na aaye to Supabase → **Logs → Auth Logs** dekho — wahan hook ka jawab (aur
hamara error) dikhta hai. Hamari taraf `app_errors` table me `route: "auth-email"`
wali rows aati hain, aur `service_usage` me `service='email'`,
`kind='auth_recovery'` wali (fail hone par `ok=false`).

### Sign-up wala email — ek chhoti si baat

Confirm wala email Supabase usi pal bhej deta hai jab account banta hai, aur
`profiles` ki row (jahan bhasha rehti hai) tab tak hoti hi nahi. Isliye app
sign-up ke saath bhasha `user_metadata.language` me bhi bhejti hai
(`signUpEmail()`), aur hook pehle `profiles.language` dekhta hai, na mile to
metadata.

### Hook band kar dena ho to

Supabase wapas apne `Authentication → Emails` wale template par gir jaata hai —
kuch tootega nahi, bas email dobara ek hi bhasha me jaane lagenge. Us template
me `{{ .Token }}` hona **zaroori** hai, warna code aata hi nahi aur app ka
"Code se aage badho" wala raasta bina code ke reh jaata hai.
