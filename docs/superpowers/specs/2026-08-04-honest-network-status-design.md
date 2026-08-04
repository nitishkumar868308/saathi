# Sach bolne wala network status (Phase 1)

**Date:** 2026-08-04
**Scope:** `app-mobile` — network banner, AI error handling
**Phase:** 5 me se pehla. Baaki: offline documents → renew links → dark mode → audit.

---

## Ek line me

"Internet dheema hai" tabhi dikhe jab internet sach me dheema ho — AI ke sochne
par, server ke slow hone par, ya bhaari DB query par bilkul nahi.

## Shikayat

> "Internet bahut fast hota hai lekin jab hum AI ka use kar rahe hote hain to
> internet slow aata hai."

Ye shikayat sahi hai, aur ye pehle bhi do baar "fix" ho chuki hai
(`ai.ts` ka `SLOW_AT = 0.8`, `network.ts` ka `slowMs` parameter). Dono baar fix
adhoora tha kyunki dono baar **threshold badla gaya, niyam nahi**.

## Asli jad

Aaj ka niyam: *"koi request N second se zyada le gayi → internet dheema."*

Ye niyam hi galat hai. Request der se aane ke chaar alag kaaran hote hain —
dheema internet, slow server, bhaari query, aur AI ka sochna — aur inme se
**sirf ek** ka internet se lena-dena hai. Ghadi in chaaron me fark nahi kar
sakti, isliye wo teen baar me se teen baar jhoot bolti hai.

### Jo aaj hota hai (chat me ek sawaal, net bilkul theek)

| Waqt | Kya hota hai | Kahan |
|---|---|---|
| 0s | AI call jaati hai, Gemini sochne lagta hai | `ai.ts:152` |
| 20s | `timed()` ka timer chhoot gaya → peela "internet dheema" banner | `ai.ts:107` |
| 25s | Timeout. Poori request **dobara** bhej di jaati hai | `ai.ts:150` |
| 45s | Phir se "internet dheema" banner | |
| 50s | Haar → `reportNetFailure("ai")` | `chat.tsx:258` |
| 50s | **Poori screen ka popup "internet ne saath nahi diya" + TTS awaaz** | `net-alert-modal.tsx:57` |

Internet ne kuch galat nahi kiya. Dikkat Gemini ki thi.

### Teen alag-alag bug

1. **`AiTimeoutError` khud ko network error batata hai.**
   `ai.ts:81` ka message hai `"AI timeout — network"`, aur
   `net-alert.ts:48-65` ka `isNetworkError()` `"timeout"` aur `"network"` dono
   par match karta hai. Yaani AI ka der se jawab dena **hamesha** internet ki
   galti gina jaata hai — definition se hi.

2. **Chat blame lagane se pehle jaanchta nahi.**
   `chat.tsx:243-259` `failed` flag aate hi seedha full-screen internet popup
   khol deta hai. `failed` teen bilkul alag cheezon se ban sakta hai — sach me
   offline, Gemini ka 429, ya `GEMINI_API_KEY` set hi nahi — aur teenon ka
   ek hi jawab dikhta hai: "internet ne saath nahi diya".

3. **Cross-talk — `slowUntil` ek global hai.**
   `network.ts:20`. AI chal rahi ho aur usi waqt Home ka
   `timed(Promise.all([...]))` (`index.tsx:159`, 4s default) chhoot jaye, to
   banner aa jaata hai. User AI ki screen dekh raha hota hai, isliye wo usse
   AI ka hi samajhta hai.

---

## Design

### Bunyaadi badlav — ghadi shak hai, saboot nahi

`timed()` ka timer ab seedha banner nahi chalayega. Wo sirf ek **shak** khada
karega; banner dikhane se pehle saboot maanga jaayega.

```
request slowMs cross kar gayi
        │
        ▼
  halka probe bhejo (generate_204, ~200 byte, 2.5s timeout)
        │
        ├── jaldi aa gaya  → internet theek hai → BANNER NAHI
        │                    (asli request chahe jitni der le)
        │
        └── atak gaya / fail → internet sach me dheema → BANNER DIKHAO
```

Probe apne aap me ek chhoti si network request hai, isliye wo *sirf* network ki
sehat naapta hai — usme na Gemini hai, na hamara DB, na koi bhaari query. Yahi
wo saboot hai jo aaj nadaarad hai.

**Ek probe ek baar.** Ek hi waqt me kai request chhoot sakti hain; sabke liye
alag probe bhejna bekaar hai. Ek in-flight probe ka promise share hoga, aur
uska nateeja 5 second tak cache rahega.

**Sirf slow ke liye.** `offline` banner ka raasta ab bhi wahi rahega
(`useNetworkStatus`, do lagatar probe fail) — wo pehle se probe-verified hai
aur jhoot nahi bolta.

### AI banner ko haath hi nahi lagayega

Do parat ki suraksha, kyunki user ne isi par sabse zyada zor diya:

1. **`withTimeout` se slow-timer hata denge.** `ai.ts:107` ab `timed()` ki jagah
   seedha `reportOnline()` call karega jab jawab aa jaye — jawab aa gaya matlab
   net pakka theek hai, ye batana ab bhi zaroori hai. Par AI kabhi `reportSlow`
   nahi chalayegi.

2. **`aiBusy` counter.** `network.ts` me ek counter — koi bhi AI call chalu
   hone par `+1`, khatam hone par `-1`. `useNetworkStatus` `aiBusy > 0` hone par
   `slow: false` lautayega. Isse koi *doosri* request (Home ka refresh, documents
   ka load) bhi AI ke dauraan banner nahi chala sakti.

   `offline` is suppression se bahar hai — agar net sach me chala gaya hai to wo
   AI ke dauraan bhi dikhna chahiye.

### AI ki fail ko uski asli wajah se joden

`askSaathi` ka `failed?: boolean` ab kaafi nahi. Uski jagah:

```ts
export type AiFailure =
  | "offline"   // probe fail — net sach me nahi hai
  | "busy"      // 429 / 503 — Gemini ya edge function bhara hua hai
  | "server"    // 4xx/5xx — key nahi hai, function deploy nahi hai, etc.
  | "slow";     // timeout, par net theek hai — AI ne der kar di

export type SaathiReply = {
  reply: string;
  action: SaathiAction | null;
  failure?: AiFailure;   // pehle: failed?: boolean
};
```

`describeError` (`ai.ts:122`) pehle se HTTP status nikaal leta hai par use phenk
deta hai. Ab wo status wapas aayega aur `failure` isi se tay hoga. Timeout ke
case me `probeInternet()` chalega — pass hua to `"slow"`, fail hua to
`"offline"`.

### Popup vs inline — kaunsa kab

| `failure` | User ko kya dikhega |
|---|---|
| `offline` | Abhi wala full-screen popup + awaaz. **Ye sach hai, isliye rahega.** |
| `busy` | Chat me inline line: "Saathi abhi bahut busy hai — thodi der me dobara bhejo" + retry |
| `server` | Chat me inline line: "Saathi abhi jawab nahi de paaya" + retry |
| `slow` | Chat me inline line: "Saathi ne der kar di" + retry |

Yaani full-screen popup aur awaaz **sirf sach me offline hone par**. Baaki
teenon chat ke andar hi handle honge — screen chhodni nahi padegi, awaaz nahi
aayegi.

`reportNetFailure("ai", …)` ka call `chat.tsx:258` se hat ke sirf `offline`
branch me jaayega. `net-alert.ts` ka `"ai"` kind bacha rahega (doosre callers
use karte hain).

### Andha retry band

`callAi` (`ai.ts:144-176`) har fail par dobara poori request bhejta hai — timeout
par bhi. Timeout ka matlab hai hum **pehle hi 25 second de chuke hain**; 25 aur
dena sazaa hai, aur wahi 50-second wala intezaar banata hai jisse "internet slow
hai" ka ehsaas hota hai.

Naya niyam: retry sirf tab jab request **turant** tooti ho (transport error,
1-2 second me pata chal jaata hai). Timeout par retry nahi — user ko seedha
inline retry button milega, jise wo tab dabaye jab wo khud chahe.

### Intezaar chhota mehsoos ho

Chat ke typing dots ab chup nahi rahenge:

- 0-6s — sirf dots (abhi jaisa)
- 6s baad — "Saathi soch raha hai…"
- 15s baad — "thoda waqt lag raha hai…"

Ye jhoot nahi hai aur banner se ulta kaam karta hai: banner kehta tha "aapka net
kharab hai" (galat, aur user ke haath me kuch nahi), ye kehta hai "main soch
raha hoon" (sach, aur intezaar samajh me aata hai).

---

## Files

| File | Badlav |
|---|---|
| `src/lib/network.ts` | `timed()` probe se verify kare; `probeSlow()` (cached, shared); `aiBusy` counter; `useNetworkStatus` me slow suppression |
| `src/lib/ai.ts` | `AiFailure` type; `describeError` se status wapas; `withTimeout` slow-timer ke bina; timeout par retry band |
| `src/app/(tabs)/chat.tsx` | `failure` par switch; popup sirf `offline` par; inline error + retry; progressive typing text |
| `src/lib/i18n/dictionaries.ts` | naye strings × 3 bhasha (hinglish/hi/en) |

`net-alert.ts` aur `net-alert-modal.tsx` — koi badlav nahi. Wo apna kaam theek
karte hain; galat sirf ye tha ki unhe bulaya galat waqt par jaata tha.

## Testing

Manual, kyunki ismein sab kuch waqt aur network par tika hai:

1. **Fast net + slow AI** — chat me lamba sawaal. **Koi banner nahi**, koi popup
   nahi, koi awaaz nahi. 6s/15s par typing text badle.
2. **Airplane mode + chat** — full-screen popup aur awaaz aaye (ye sahi hai).
3. **Sach me dheema net** (Android emulator par "Full" → "EDGE", ya Chrome
   DevTools throttle) + documents refresh — peela banner aaye.
4. **Fast net + bhaari query** — banner nahi aana chahiye.
5. **AI + saath me Home refresh** — cross-talk band, banner nahi.
6. **429 simulate** — inline "busy" line, popup nahi.
7. Teeno bhasha me naye strings dikhein.

## Jo is phase me NAHI hai

- Offline documents (Phase 2)
- Renew links (Phase 3)
- Dark mode (Phase 4)
- WhatsApp/email/notification audit (Phase 5)
- Web/admin ka network status — ye shikayat sirf mobile app ki hai
