# Bolti Tasveer — design

Ek tasveer, ek text, ek emotion — aur ek chhota clip jisme wo tasveer bolti hui
dikhti hai. Sab kuch free, bina kisi bahari API ke, aur maujooda pipeline ke
andar.

---

## Kya nahi ban raha — pehle ye

Ye **photoreal lip sync nahi hai** (HeyGen / D-ID / Wav2Lip jaisa). Wo is setup me
ban hi nahi sakta, aur uski teen thos wajahein hain:

1. **GPU nahi hai jahan render hota hai.** Render GitHub ke `ubuntu-latest`
   runner par hota hai — private repo par 2-core CPU, 7GB RAM, zero GPU.
   SadTalker/LivePortrait/MuseTalk CPU par ek 5-second clip par 10-40 minute
   lete hain.
2. **2000 Actions minute/month.** `reel-render.yml` me ye hadd khud likhi hui
   hai. Ek clip par 20 minute ka matlab mahine me ~100 clip — aur usi budget me
   saari normal reel bhi banni hain.
3. **License.** Wav2Lip ke weights (CPU par sabse tez option) unke apne repo me
   non-commercial research ke liye hain. Baaki naye models me se bhi kai
   "academic use only" hain.

User ke PC me RTX 3050 hai, yaani GPU wala raasta poori tarah band nahi hai. Par
tab har bolti-tasveer reel un ke PC ke on hone par tik jaati, aur license ka
khatra sar par rehta. Isliye chunav **stylized** ka hai, jaan-boojhkar.

**Jo ban raha hai:** ek achhi tarah bani hui 2D puppet — asli tasveer ke apne
honth, jabda, aankh aur bhaunh se chalti hui. Reel me ye sach me achhi lagti hai.
Par ye avatar nahi hai, aur kahin bhi wo vaada nahi kiya jaayega.

---

## Ek asool — sab kuch browser me

Muh ka hisaab aur chehre ke points, **dono studio me browser me** bante hain.
Server par ek bhi naya binary nahi, worker me ek bhi nayi dependency nahi.

Teen wajahein, teenon asli:

- **Studio Vercel par bhi ja chuki hai** (`studio/next.config.mjs` me
  2026-08-21 ka note). Wahan Rhubarb jaisa binary chal hi nahi sakta. Browser me
  rakhne se ye sawaal hi khatam.
- **Runner ka ek second bhi kharch nahi hota.** Worker sirf doc padh kar render
  karta hai, jaise abhi karta hai.
- **Kuch bahar nahi jaata.** MediaPipe ki model file repo me rahegi, Google ke
  CDN se nahi aayegi.

---

## Muh kaise chalega — hisaab, AI nahi

Yahan ek baat haath me hai jo aam taur par kisi ke paas nahi hoti: **awaaz khud
banti hai (TTS), aur uska text pehle se pata hai.** Isliye andaaza lagane ki
zaroorat hi nahi.

### Aath shape

`rest` · `MBP` · `FV` · `AA` · `EE` · `OO` · `L` · `S`

Aath hi kyun: Rhubarb (is kaam ka sabse jaancha hua tool) bhi aath hi shapes
(A–H) par tika hai. Isse kam par alag awaazein ek jaisi dikhne lagti hain; isse
zyada par do shapes ka farak dekhne wale ko dikhta hi nahi, aur sirf kaam badhta
hai.

### Do hisse, do alag jagah se

- **Shape text se.** Har akshar ka apna shape hota hai — `म/ब/प` par honth band,
  `आ` par poora khula, `ई` par chaura, `ओ/ऊ` par gol. Devanagari aur Latin dono
  ke liye niyam ki ek table.
- **Kab aur kitna, awaaz se.** Web Audio API se energy envelope — kahan bola ja
  raha hai aur kitne zor se.

**Aur inhe jodne ka tarika hi is design ki jaan hai:** envelope batata hai ki
bolna **kahan-kahan** ho raha hai (beech ke sannate kahan hain), aur text batata
hai ki us dauraan **kaunsa shape** aana chahiye. Akshar un bolne wale hisson me
baante jaate hain, khaali jagah me nahi.

⚠️ Sirf text se, poori lambai par barabar baant dena sabse aasan hai aur galat
hai: TTS beech me saans leti hai, aur wahan muh chalta rehta hai — dekhne wale ko
turant nakli lagta hai. ⚠️ Sirf envelope se karna bhi galat hai: har awaaz par
muh ek jaisa khulta-band hota hai, jise "chabaana" kehte hain.

### Kahan likha jaayega

Poora hisaab `@reel/core` me — na React, na fetch, na DOM. Wajah wahi hai jo
`wizard/draft.ts` ki hai: is hisaab ko ek script se chala kar dekha ja sakega
(`check-visemes.ts`), browser khole bina. UI ka kaam sirf envelope nikaal kar
dena hai.

---

## Chehre ke points

**MediaPipe Face Landmarker** — Apache 2.0, free, browser me WASM par. 468
points: honth, jabda, aankh, bhaunh.

⚠️ **Model file repo me rahegi** (`studio/public/`), CDN se nahi. Default tarika
jsdelivr se uthata hai — wo "sab kuch local" wale niyam ko todta hai, aur CDN ke
band hone par feature chup-chaap marta hai (screen par sirf "kuch nahi hua").

⚠️ Points **asset ke `meta` me** jama honge, item me nahi — bilkul `probe` ki
tarah. Ek tasveer par ek hi baar chalega, chahe wo dus reel me lage. Item me
rakhne par har naya scene wahi 3 second ka kaam dobara karta.

Sirf wahi points jama hote hain jo chahiye (honth andar-bahar, jabda ki lakeer,
aankh, bhaunh) — poore 468 nahi. Poora set har asset row ko bina wajah bhaari
karta hai.

---

## Render — SVG ka triangle mesh

Muh ka hissa asli tasveer se hi banta hai: honth ke aas-paas landmarks se ek
chhota **triangle mesh** banta hai, aur har frame par uske points viseme ke
hisaab se hilte hain. Jabda thoda neeche jaata hai, honth khulte hain.

Isse asli chehre ke apne honth istemal hote hain — rang, roshni aur texture
hamesha milte hain. Chipkaya hua muh yahi cheez kabhi nahi de paata.

⚠️ **Canvas nahi, SVG.** Remotion har frame ka screenshot Chromium se leta hai.
Canvas par draw karna ek async kaam hai, aur wo screenshot se race karta hai —
nateeja beech-beech me khaali ya purana frame, jo sirf bane hue MP4 me dikhta
hai. SVG DOM hai: jo likha hai wahi screenshot me aata hai, har baar.

⚠️ **Ye is poore kaam ka sabse jokhim bhara hissa hai**, isliye implementation me
sabse pehle ek chhota spike hoga: ek warp kiya hua frame render karke dekhna, uske
baad hi baaki sab. Ulta karne par pata aakhir me chalta — jab sab bana ho.

---

## Zinda dikhne ka asli raaz

**"Zinda" dikhna muh se nahi aata.** Sirf muh hilta hua chehra murda lagta hai,
chahe lip sync kitna bhi theek ho. Isliye har clip me — emotion koi bhi ho —
teen cheezein hamesha chalengi:

- **Palak jhapakna**, bekayda antaraal par (3-6 second). Barabar antaraal machine
  jaisa lagta hai.
- **Saans jaisa sway** — sir ka 1-2 degree jhukav, bahut dheema.
- **Bhaunh ka hilna** — bolte waqt zor wale hisson par.

**Emotion** ek registry hogi (`EMOTIONS`), bilkul `ANIMATION_PRESETS` ki tarah —
khush, gambhir, hairaan, dukhi, josh. Har entry sirf teen cheezein badalti hai:
bhaunh ki jagah, aankh kitni khuli, aur sway ki raftaar. Registry isliye ki nayi
emotion jodna ek entry ka kaam rahe, code ka nahi.

---

## Data kahan rehta hai

Item par ek naya named field — `text`, `shape`, `subtitle`, `mockup` ki tarah:

```ts
talkingPhoto: TalkingPhotoSchema.nullable().default(null)
```

Usme: voice asset ki id, emotion ka id, viseme track (shape + waqt), aur kis
face-data par wo bana tha.

⚠️ Yahan schema **sakht** hai — wizard ki yaadgaar (`doc.meta.wizard`) ki tarah
dheela nahi. Farak asli hai: wizard ki yaadgaar sirf UI ki suvidha hai, use na
padhne par bas ek button chhup jaata hai. Ye data **render ko chahiye** — iske
bina muh chalega hi nahi. Aadha-adhoora yahan pahunchna chup-chaap ek murda
chehra deta hai, aur wo galti bane hue MP4 me hi dikhti hai.

---

## Naya kya banega

| Kahan | Kya |
|---|---|
| `@reel/core` | `visemes/` — text→shape, envelope→timing. Pure TS + check script |
| `@reel/core` | `EMOTIONS` registry |
| `@reel/core` | `TalkingPhotoSchema` + `talkingPhoto` item field |
| `@reel/core` | naya scene type `talking_photo` |
| `@reel/core` | naya item type `talking_photo` |
| `studio` | naya left panel tab |
| `studio` | browser me landmarks (MediaPipe) + envelope (Web Audio) |
| `studio/public` | MediaPipe ki model file (~3MB) |
| `@reel/remotion` | naya item renderer — SVG mesh warp + aankh/bhaunh |

`worker/` me **kuch nahi** badalta.

---

## Do imaandaar hadd

1. **Tasveer me chehra hona chahiye.** Na mile to saaf mana — wahi tarika jo abhi
   naap ki rok ka hai (`checkUploadSize`), andaaza laga kar kuch bana dena nahi.
   Chehra na milne par bhi kuch bana dena matlab ek hilta hua dhabba, aur uski
   wajah kisi ko samajh nahi aati.
2. **Ek chehra, saamne dekhta hua.** Bahut side se li hui ya bahut jhuki hui
   tasveer par mesh theek nahi baithta. Aisi tasveer par chetavni dikhegi, rok
   nahi — kyunki "kitna side" ek dheeli hadd hai, aur uspar sakht mana karna sahi
   tasveeron ko bhi rok dega.

---

## Jaanch

- `@reel/core` me `check-visemes.ts` — text→shape ki table, envelope se baantna,
  sannate me muh band rehna, aur emotion registry ke naam. Browser khole bina.
- Render ka spike: ek warp kiya hua frame, aankh se dekh kar.
- Poora chakkar: text likho → awaaz bane → clip bane → export.
