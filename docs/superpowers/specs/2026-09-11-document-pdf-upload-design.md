# Document upload — PDF, ek hi picker, aur "isme document hai hi nahi" ki rok

**Taareekh:** 2026-09-11
**Halat:** Design manzoor, plan likhna baaki

---

## Ye kyun

Do alag shikayatein, ek hi jagah se aati hain.

**1. 10 page ka document daalna azaab hai.** App sirf image leti hai. Jiske paas
10 page ka PDF hai (insurance policy, rent agreement, bank statement) use pehle
kisi doosri app se har page ki image banani padti hai, phir yahan ek-ek karke
daalni padti hai — kyunki picker ek waqt me ek hi cheez leta hai. Dus baar.
Aur uske baad app me wo dus alag-alag documents ban jaate hain, jinka aapas me
koi rishta nahi. Na user ko samajh aata hai, na admin ko, na AI ko.

**2. Bematlab ki photo storage bhar rahi hai.** Log apni, bacche ki, biwi ki
photo daal dete hain. Wo R2 par chadh jaati hai aur hamesha ke liye wahin padi
rehti hai. AI ne us photo me kuch bhi nahi dhoondha tha — ye baat app ko us waqt
pata bhi thi, par usne kuch kaha nahi.

## Kya NAHI kar rahe (aur kyun)

- **Image band nahi kar rahe.** Aadhaar, DL, RC, PAN — sab jeb me pade plastic
  card hain, unka PDF kahin se aata hi nahi. Camera hi us user ka ekmatra rasta
  hai. (Aur format ki rok bematlab photo rokti bhi nahi — selfie PDF me bhi daali
  ja sakti hai. Uska ilaaj AI ka jawab hai, format nahi.)
- **Word / Excel nahi jod rahe.** Gemini unhe seedha nahi padhta (server par
  conversion chahiye, jo free hosting par nahi bethega), app unhe dikha nahi
  sakti, aur expiry wala koi document `.docx` me aata hi nahi.
- **App ke andar PDF viewer nahi bana rahe.** Android ka WebView PDF khud nahi
  dikhata — wo Google ke viewer par bhejta hai, aur hamari file private signed
  URL par hai. Use bahar bhejna theek nahi.
- **Gemini wali koi nayi consent screen nahi.** Signup par pehle hi allow karaya
  jaata hai.

---

## Pehle se kya bana hua hai

PDF ka poora pichhla hissa maujood hai — kisi ko pata nahi tha:

| Jagah | Haal |
|---|---|
| `web/lib/storage-server.ts` ka `EXT` map | `application/pdf` **pehle se hai** — R2 upload PDF aaj bhi le lega |
| `app-mobile/src/lib/documents.ts` ka `mimeFromUri` | `.pdf` **pehle se hai** |
| `supabase/functions/ai/index.ts` (scan) | `mime` seedha Gemini ke `inline_data` me jaata hai — **koi rok nahi** |
| `app-mobile/src/lib/ai.ts` ka `scanDocumentAI` | `mime` **parameter pehle se leta hai** (default `image/jpeg`) |
| `app-mobile/src/lib/save-to-device.ts` | `application/pdf` ka naam aur mime **pehle se** handle karta hai |
| `app-mobile/src/components/doc-card.tsx` | Photo dikhata hi nahi — `doc.type` ka icon dikhata hai. PDF par surakshit |
| `app-mobile/src/lib/doc-cache.ts` ka `resolveDocUri` | cache → phone ki file → cloud. Offline par PDF bhi isi se aayega |
| `app-mobile/src/components/offline-gate.tsx` | Net na ho to poori app ki jagah OfflineScreen — "internet nahi hai" wahin saaf bolta hai |

Yaani server, storage, DB, AI aur offline cache — sab taiyaar hain. **Bas PDF
chunne ka koi rasta nahi hai, aur do jagah use `<Image>` me dikhane ki koshish
hogi.**

---

## Design

### 1. Ek hi picker — camera aur "Chuno"

`add-document` par teen ki jagah do button:

- **Camera** — `expo-image-picker`, `allowsEditing: true` jaisa ab hai. Kuch nahi badal raha.
- **Chuno** — `expo-document-picker`, `type: ["image/*", "application/pdf"]`.

Ye phone ka apna picker kholta hai jisme Photos, Downloads, Drive sab ek jagah
dikhte hain — wahi jo WhatsApp/Gmail me attach karte waqt dikhta hai.

**Jaan-boojh ke chhoda ja raha hai:** gallery se chuni image par crop ki screen
ab nahi aayegi (`allowsEditing` sirf ImagePicker ka hai). Camera par crop waisa
hi rahega. Ek picker ka faayda crop se bada hai, aur Gemini background wali photo
bhi theek padh leta hai.

**Nayi dependency:** `expo-document-picker`. Ye iklauti nayi cheez hai.

### 2. AI PDF ko poora padhega

PDF `expo-file-system` se base64 me padha jaayega aur
`scanDocumentAI(base64, locale, "application/pdf")` par chala jaayega. Saare
page. Server par ek line nahi badal rahi.

**5MB SAKHT hadd hai — sirf AI ki nahi, upload ki bhi.** 5MB se badi koi bhi
file R2 par jaayegi hi nahi, save hi nahi hogi. Do wajah ek saath: base64 file ko
~33% mota kar deta hai aur edge function ka request utna bada nahi jaata; aur
R2 ka free tier 10GB hai, jise ek-do badi file bahut jaldi kha jaati hai.

**Image pehle daba kar aati hai.** `expo-image-manipulator` se `compress: 0.4` —
wahi jo aaj `ImagePicker` ka `quality: 0.4` karta hai. Isliye phone ki aam photo
hadd ke andar hi rahegi; rok lagbhag sirf badi PDF par lagegi.

**Kharche ki baat (saaf-saaf):** Gemini PDF ke har page ka alag paisa leta hai.
10 page ka PDF ≈ 10 photo jitna. Ye jaan-boojh ke maana gaya hai — cap isi liye
hai.

### 3. Save ke waqt teen alag jawab

Ye is poore kaam ki jaan hai. Teen alag haalat hain aur teenon ko **alag bolna**
hai. Ek jaisa bolna hi purani dikkat thi.

| AI ka jawab | Asli matlab | Faisla |
|---|---|---|
| `unclear` | AI ne padha, **kuch mila hi nahi** — yaani selfie/photo hai | **ROK.** R2 par kuch nahi, `documents` row bhi nahi |
| `offline` | Net nahi hai | Save hone do |
| `busy` / `slow` / `server` | AI chala hi nahi (Gemini bhara, server ki dikkat) | Save hone do |
| File 5MB+ | Hadd se badi | **ROK.** R2 par kuch nahi, row bhi nahi |

**"Save hone do" ka matlab sirf itna hai ki AI ki wajah se rok nahi lagegi.**
Uske baad neeche wali (Section 5) "pehle R2, phir device" wali tarteeb waise ki
waise lagti hai — yaani upload fail hua to wahan apna alag sawaal aayega. Do alag
baatein hain, dono alag jagah dikhengi.

Do rok, do alag lines:

> **Isme koi document nahi mila**
> Saaf photo ya PDF dobara daalo — Saathi documents aur unki expiry ke liye hai.

> **File 5MB se badi hai**
> Isse chhoti file daalo — ya kam page wali PDF.

"Kuch galat hua" **nahi** likha ja raha. Selfie par wo jhooth hai, aur user usi
selfie ko dus baar daalta rahega. Seedhi baat dobara-koshish ko sahi disha deti
hai.

**AI ki wajah se rok sirf `unclear` par.** Baaki teen par kabhi nahi. Warna net kharab hone par
app har asli Aadhaar par kahegi "isme document nahi mila", user dobara daalega,
phir wahi — aur wo bharosa wapas nahi aata. Aur storage bhi wahan nahi bach raha,
kyunki wo asli document tha.

Rok `save()` me lagegi — `addDocument` aur `uploadDocumentImage` dono se pehle.
File R2 par tabhi chadhti hai jab Save daba hai (`add-document.tsx:340`), isliye
yahan rokne par sach me kuch bhi upar nahi jaata.

### 4. PDF dikhana — do jagah

`resolveDocUri` PDF ka local rasta laut ayega (offline par bhi). Jahan-jahan
`<Image>` hai, wahan mime dekh kar do raste banenge.

**(a) `document-view.tsx`** — photo ki jagah ek card: file ka naam, size, aur
**"Kholo"** button. Zoom/ImageViewer PDF par nahi khulega. Purane versions wali
list me bhi wahi — thumbnail ki jagah PDF ka icon.

**(b) `offline-screen.tsx`** — uska apna chhota Modal viewer (router wahan chalta
nahi, isliye usne apna banaya hai). Wahi card, wahi "Kholo".

**Kholne ka tareeka:** `FileSystem.getContentUriAsync()` + `expo-intent-launcher`
(Android), `expo-sharing` (iOS). Dono pehle se install hain. File local hai,
isliye **offline bhi khulegi** — yahi is design ki sabse zaroori baat hai.

### 5. Pehle R2, uske baad device

**Ye poori tarah nayi baat hai — aaj ulta hota hai.**

Abhi `uploadDocumentImage` jaan-boojh ke device ko pehle bharta hai
(`queueUpload` -> `primeCachedFile` -> `flushUploads`). Uske upar likhi wajah
asli hai: user document tab daalta hai jab wo saamne hota hai — bank ke bahar,
RTO ke bahar — jahan signal aata-jaata rehta hai, aur wahan upload fail hone par
document apne hi phone par "offline nahi khulta" ban jaata tha.

Par us tarteeb me ek chhupa hua chhed hai: **upload baar-baar fail hota rahe to
document HAMESHA ke liye sirf us phone par reh jaata hai, aur user ko iski khabar
hi nahi hoti.** Admin me wo "Sirf device" pada rehta hai — jo asal me "hum ise kho
chuke hain" ka doosra naam hai. Phone gaya, document gaya.

**Nayi tarteeb:**

1. Save dabte hi **pehle R2 par upload**.
2. Safal -> device ka cache bharo (`primeCachedFile`), sab sach.
3. Fail -> **chupchaap device par mat rakho**, user se poochho:

> **Cloud par nahi ja paya**
> Net kamzor hai. Sirf is phone par rakh lein? Net aate hi apne aap cloud par
> chala jaayega.
> `[ Dobara koshish ]` `[ Phone par rakho ]`

4. "Phone par rakho" chuna -> document `queueUpload` me jaata hai (jaisa aaj hai),
   **par ab uspar ek saaf nishaan lagega — "Sirf is phone par"** — list aur view
   dono par, jab tak upload na ho jaye. Jo baat abhi sirf admin ko dikhti thi, wo
   ab user ko bhi dikhegi.

**Kyun sakht "R2 pehle warna save hi nahi" nahi chuna:** poora net band hone par
`add-document` khulti hi nahi (`offline-gate.tsx` poori app ko dhak leta hai).
Yaani ye sirf **kamzor signal** wali soorat hai — bank ke bahar do danda net.
Wahan sakht rok user ka document daalna hi band kar deti, aur wo document kahin
save hi na hota. Beech ka rasta dono bacha leta hai: device-only document ab
**chupchaap** nahi banta.

**Ek baat saaf:** picker se aayi file OS ke apne temp cache me aati hi hai — usse
bacha nahi ja sakta, AI ko base64 bhejne aur R2 par chadhane ke liye wo file
chahiye. Jo hata rahe hain wo **app ka apna permanent folder** hai
(`persistImage`) — wo ab R2 ke BAAD hi bharega.

**⚠️ `document-renew.tsx` par bhi yahi tarteeb** — warna renew ki nayi file
purani ko dhak kar device par baith jaati aur cloud par kabhi na jaati.

### 6. Bhasha — har nayi line teenon me

`lib/i18n/dictionaries.ts` me teen locale hain: `hinglish` (default), `hi`, `en`.

**Is kaam ki ek bhi line screen par hardcode nahi hogi.** Neeche wali saari
lines dictionary me jaayengi aur `useT()` se aayengi:

- "Isme koi document nahi mila" wali rok
- "Internet nahi chal raha" / "AI abhi jawab nahi de paya"
- "Fail badi hai — naam aur expiry khud bhar do"
- "Cloud par nahi ja paya" wala sawaal + uske dono button
- "Sirf is phone par" wala nishaan
- PDF card ka "Kholo" button

### 7. `document-renew.tsx`

Wahan bilkul yahi flow hai — wahi picker, wahi teen jawab, wahi PDF card. Renew
par nayi file `-v2` naam se chadhti hai, wo waisa hi rahega.

---

## Kya nahi chhoo rahe

`doc-card`, `save-to-device`, `share`, `doc-cache`, `queueUpload`, R2 ka
`upload-url`/`commit`, edge function — in me se kisi me badlav nahi chahiye.

## Kaise jaanchenge

- Image se document — aaj jaisa hi chalta rahe (camera aur "Chuno", dono se).
- 3-page PDF — AI teenon page padhe, naam/expiry bhare.
- 6MB PDF — save **na** ho, R2 par kuch **na** jaaye, "File 5MB se badi hai" dikhe.
- Selfie — save **na** ho, R2 par kuch **na** jaaye, "koi document nahi mila" dikhe.
- Flight mode — OfflineScreen khule, purana PDF wahan se khul jaaye.
- Purana image document — jaisa tha waisa hi khule (kuch toota na ho).
- Kamzor signal (upload fail) — "Cloud par nahi ja paya" aaye, "Phone par rakho"
  par document bane aur uspar "Sirf is phone par" ka nishaan dikhe; net aane par
  nishaan khud hat jaye.
- Teenon bhasha (`hinglish`, `hi`, `en`) — har nayi line apni bhasha me aaye,
  koi angrezi ki line beech me na chamke.

## Iske baad (alag spec)

- **Hissa 2** — admin se document ka `summary` chhupana (`supabase/admin-documents.sql`).
- **Hissa 3** — admin me delivery trail: kis reminder/document ke liye kaun se
  raste (push / email / WhatsApp) par kya gaya, aur user ne use dekha ya nahi.
