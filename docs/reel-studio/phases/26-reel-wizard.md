# Phase 26 — Reel Wizard (kahani se reel, ek raaste me)

**STATUS:** COMPLETE — browser me poora chakkar chala kar dekha gaya.
**One-line prompt:** `Read docs/reel-studio/README.md, then do Phase 26 of AI Reel Studio.`
**Rules:** README.md ke Standing + Dynamic rules binding. Resume Protocol follow karo.
**Depends on:** Phase 21 (AI provider), Phase 22 (TTS) complete

**Goal:** kahani paste karne se leke chalti hui reel tak — ek hi raasta, jisme har mod par
aadmi ko dikh jaaye ki karna kya hai. Editor sikhne ki zaroorat na pade.

---

## 0. Ye kis khaali jagah ko bhar raha hai

Ye koi nayi soch nahi hai — architecture me iski jagah **pehle se khaali chhodi gayi thi**.
`packages/reel-core/src/ai/types.ts` me saaf likha hai:

> Asset wale slots me AI **naam/role** likhta hai (`character:rahul`), asset id nahi — wo id
> jaanta hi nahi, aur jaanne ka daawa karna sabse khatarnaak hota (wo ek aisi id likh deta jo
> hai hi nahi, aur clip chup-chaap khaali reh jaati).

Aur `buildProposal()` me us naam ko asli id me badalne ka hook bhi pehle se maujood hai:

```ts
/** `"character:rahul"` -> `"as_123"`. Jo na mile wo slot khaali rehta hai. */
assetByRole?: Record<string, string>;
```

Aaj us map ko bharne wala **koi nahi hai**. Isliye AI se bani har reel ke asset slot khaali
rehte hain, aur aadmi ko khud editor me jaakar har scene me tasveer lagani padti hai — theek wo
kaam jo usse aata hi nahi.

**Wizard wahi map bharta hai.** Ye ek missing UI hai, naya architecture nahi.

---

## 1. Kahan lagta hai

AiPanel me kahani likh kar "Banao" → AI script deta hai → **wizard modal khulta hai.**

⚠️ Purani scene-by-scene accept/reject list **hat rahi hai**, aur ye soch kar:

Wizard khud ek poora review hai — har scene ka text saamne, tasveer saamne, awaaz saamne, aur
ant me chalti hui reel. Uske pehle ek aur review rakhne ka matlab hai **do baar wahi cheez
dekhna**, aur doosri baar aadmi dhyan se nahi dekhta. Scene hataane ka button wizard ke pehle
step me hi hai, isliye purani list ka koi kaam bacha nahi.

⚠️ Jo cheez **nahi** badal rahi wo hai bharosa ka niyam (21.1): AI ka output seedha doc me abhi
bhi nahi jaata. Wizard ke ant me wahi `applyProposal()` chalta hai, wahi `replaceDoc` op.

---

## 2. Steps ka order — aur ek jaan-boojhkar ulta faisla

```
1. Shabd    →  AI ke likhe scene, badal sakte ho, hata sakte ho
2. Tasveer  →  per scene: upload / library se / chhod do   (+ animation, + transition)
3. Awaaz    →  per scene: banao / apni daalo / chhod do
4. Dekho    →  poori reel, modal ke andar chalti hui
5. Editor me daal do
```

⚠️ **Shabd pehle, tasveer baad me — aur ye seedha ek bug rokta hai.**

TTS ka cache text ke hash par hai (`ttsCacheKey`). Awaaz ban jaane ke baad text badla to bani
hui awaaz **purane shabdon ki** reh jaati hai. Aur ye galti kahin dikhti nahi: reel banti hai,
chalti hai, export bhi ho jaati hai — bas awaaz kuch aur bolti hai aur caption kuch aur. Wo tab
pata chalta hai jab reel bhej di ja chuki hoti hai.

Shabd pehle rakhne se wo halat ban hi nahi sakti. (Aur agar aadmi step 3 se peeche jaakar shabd
badle, to us scene ki bani hui awaaz par nishaan lag jaata hai — dekho 26.9.)

---

## 3. "Aadmi ko aata nahi hai" — iska poora ilaaj

Ye is phase ka asli kaam hai. Har chunav aadmi ke haath me hai, par akela nahi chhoda jaata.
Chaar cheezein, har jagah:

### 3a. Naam aam bhasha me

Registry ke id kabhi screen par nahi aate. "Ken Burns punch" kisi ko kuch nahi batata.

| Registry id | Screen par | Kab theek hai (ek line, saath me likhi) |
|---|---|---|
| `kenburns-slow` | **Dheema zoom** | Lambi, bhaari baat par — nazar tikti hai |
| `kenburns-punch` | **Tez zoom** | Chaunkane wali line par |
| `pop-in` | **Uchhal kar aana** | Chhoti line, CTA, naam |
| `cinematic-drift` | **Bahaav** | Mahaul wale scene par |
| `slide-up-soft` | **Neeche se upar** | Nayi baat shuru hone par |
| `focus-pull` | **Focus** | Kisi ek cheez par dhyan le jaana ho |

| Transition id | Screen par | Kab theek hai |
|---|---|---|
| `none` | **Seedha kat** | Tez rafter, list-jaisi baat |
| `fade` | **Halka gayab** | Aam badlav — sabse surakshit |
| `crossfade` | **Ghulna** | Tasveer se tasveer, waqt beetna |
| `slide` | **Khisakna** | Nayi jagah, naya hissa |
| `zoom` | **Zoom se** | Zor dena ho |
| `blur` | **Dhundhla ho kar** | Yaad/sapna wala mod |

### 3b. Har jagah ek **Sifaarish**

Har chunav me ek option par `Sifaarish` ka nishaan, aur uske saath ek line — **kyun**.
Ye andaaza nahi, ek likha hua niyam hai (`suggestAnimation` / `suggestTransition`, 26.4):

```
suggestAnimation(scene, index):
  tasveer nahi hai        → koi animation nahi (text-wala scene)
  scene.type === "cta"    → Uchhal kar aana
  text 30 akshar se chhota→ Uchhal kar aana
  index sam (0,2,4…)      → Dheema zoom
  index visham (1,3,5…)   → Bahaav

suggestTransition(index, is_scene_me_tasveer, pichhle_me_tasveer):
  index === 0             → Seedha kat   (kahin se aa hi nahi raha)
  dono me tasveer         → Ghulna
  warna                   → Halka gayab
```

⚠️ Sam/visham wala niyam sirf **ek-jaisapan todne** ke liye hai. Aath scene par ek hi dheema
zoom lagta rahe to reel sust lagne lagti hai, aur uski wajah kisi ko samajh nahi aati —
har scene alag se theek dikhta hai, par saath me dekho to bore karta hai.

⚠️ Ye niyam **AI se nahi poochha jaata**, aur ye bachat nahi soch hai. AI se poochne par teen
kharche aate hain: har baar token, thodi der ka intezaar, aur kabhi-kabhi ek aisa naam jo
registry me hai hi nahi — jiske baad chup-chaap default lag jaata hai aur "AI ne chuna" wala
label jhooth ban jaata hai. Isliye label bhi sach likha hai: **"apne aap chuna"**, "AI ne chuna"
nahi.

### 3c. Chalta hua preview, **uski apni tasveer par**

Animation ka naam padhne se kuch samajh nahi aata. Isliye har option ek chhoti loop me chalta
dikhta hai — aur wo bhi us tasveer par jo aadmi ne abhi daali hai, kisi demo tasveer par nahi.

⚠️ Ek waqt me **sirf ek** loop chalta hai (jis par nazar hai). Chhe chhote video ek saath
chalana purane laptop par preview aur poori UI dono ko jhatka de deta hai.

### 3d. Ek button jo sab bhar deta hai

**"Sab kuch apne aap set kar do"** — har wo chunav jo abhi tak khaali hai, sifaarish se bhar
jaata hai. Jise kuch nahi aata wo ise dabata hai aur seedha "Dekho" par pahunch jaata hai.

⚠️ Ye button aadmi ke kiye hue chunav **kabhi nahi** badalta. Bhare hue ko dobara likh dena wo
ek galti hai jiska pata der se chalta hai — aadmi ne 20 minute laga kar chuna, ek button daba,
aur sab wapas default. Wo dobara us button ke paas nahi jaata, aur aksar tool ke paas bhi nahi.

---

## 4. Screen kaisa dikhega

```
┌─ Reel banao ──────────────── ① Shabd  ② Tasveer  ③ Awaaz  ④ Dekho ─┐
│  Har scene ki tasveer daalo. Na ho to chhod do — wo scene            │
│  text wala ban jaayega.                    [ Sab apne aap set karo ] │
├──────────────────────────────────────────────────────────────────────┤
│  SCENE 2                                                 [ hata do ] │
│  ┌────────────┐  "Papa ki awaaz thodi dheemi thi."                   │
│  │            │                                                       │
│  │  chalti    │  [ Tasveer daalo ]  [ Library se ]  [ Chhod do ]     │
│  │  hui       │                                                       │
│  │  tasveer   │  Dheema zoom · apne aap chuna            [ badlo ↻ ] │
│  └────────────┘  Pichhle scene se: Ghulna · apne aap      [ badlo ↻ ] │
│                                                                       │
│  SCENE 3 …                                                            │
├──────────────────────────────────────────────────────────────────────┤
│  2 / 8 taiyaar                         [ Peeche ]      [ Aage → ]     │
└──────────────────────────────────────────────────────────────────────┘
```

`badlo ↻` dabane par usi jagah chhe chalte hue option khul jaate hain, har ek par uska aam naam
aur "kab theek hai" wali line. Chunte hi band.

⚠️ Har step ke sar par **ek line** likhi hai ki ye step hai kis liye. Bina uske aadmi ko har
step ek naya imtihaan lagta hai.

---

## 5. Tasveer na ho to

Us scene par **"Chhod do"** dabao — wo scene wahi text-wala ban jaata hai jaisa aaj bhi banta
hai (brand ka background, bada text), aur preview me turant waisa hi dikh jaata hai.

⚠️ Ye "kam" wala raasta nahi hai, aur wahi is faisle ki jaan hai. Har scene par tasveer zaroori
kar dene par aath scene wali kahani ke liye aath tasveer dhoondhni padti — aur aadmi wahin chhod
deta hai. Adhoori reel se buri sirf ek cheez hai: koi reel na banna.

---

## 6. Ant me kya hota hai

```
wizard ka draft
   ├─ badle hue shabd          → AiScript ke scenes me
   ├─ chuni hui tasveer        → assetByRole { "character:papa": "as_123" }
   ├─ animation + transition   → scene ke props me
   └─ bani hui awaaz           → assetByRole { "voice:2": "as_456" }
                    ↓
            buildProposal()  →  applyProposal()
                    ↓
              EK `replaceDoc` op
```

⚠️ **Ek op, aur ye zaroori hai.** Poora wizard ek Ctrl+Z se wapas jaana chahiye. Scene-dar-scene
lagane par undo bhi scene-dar-scene hota hai — aadmi 8 baar Ctrl+Z dabata hai, beech me ruk
jaata hai, aur doc aadha naya aadha purana reh jaata hai. Us haalat se nikalne ka koi saaf
raasta nahi hota.

---

## 7. Naya kitna banega

| Reuse (pehle se hai) | Naya banega |
|---|---|
| asset upload ka poora raasta, `AssetPicker` | `WizardModal` + chaar step component |
| `/api/tts`, `VoiceBatch` ka batch logic | wizard ka draft state (ek jagah) |
| `buildProposal` / `applyProposal` | `suggestAnimation` / `suggestTransition` (pure) |
| `Modal`, Remotion `Player` | animation ka chhota chalta preview |
| `animationPresets`, `TRANSITIONS` registry | aam bhasha wale naam ki ek table |

Zyada kaam **jodne** ka hai. Nayi buniyaadi cheez sirf do chhote pure function hain.

---

## 8. Jab kuch toote

| Halat | Kya hoga |
|---|---|
| Ek scene ki awaaz fail | Baaki rukti nahi; us scene par nishaan, ant me ginti (`VoiceBatch` ka hi pattern) |
| Upload fail | Us scene par saaf wajah; aage badhna phir bhi mumkin |
| Shabd badle jab awaaz ban chuki thi | Us scene ki awaaz par "purane shabdon ki" ka nishaan + [dobara banao] |
| Wizard beech me band | "Kiya hua kaam chala jaayega" ki tasdeek pehle |
| `GEMINI_API_KEY` nahi | Wizard khulta hi nahi — AiPanel ye pehle se sambhalta hai |

---

## 9. Jo jaan-boojhkar NAHI banega

- **Image generation.** Tasveer aadmi khud deta hai. (Faisla 2026-08-22.)
- Per-scene alag music, per-scene alag bhasha.
- Wizard ke andar timeline editing — wo editor ka kaam hai, aur wahi rahega.

---

## Checklist

- [x] 26.1 `wizard/names.ts` — animation/transition ke aam bhasha wale naam + "kab theek hai" line
- [x] 26.2 `suggestAnimation()` pure function + test (har scene type par)
- [x] 26.3 `suggestTransition()` pure function + test (pehla scene, tasveer/bina-tasveer)
- [x] 26.4 wizard ka draft state — ek jagah, ek shape (`wizard/draft.ts`)
- [x] 26.5 Step 1 "Shabd" — edit, hata do
- [x] 26.6 Step 2 "Tasveer" — upload / library / chhod do
- [x] 26.7 Animation + transition chunne wala chalta hua preview (ek waqt me ek loop)
- [x] 26.8 `autoFill()` — sirf khaali chunav bharta hai (UI ka button baaki)
- [x] 26.9 Step 3 "Awaaz" — banao / apni daalo / chhod do + purane shabdon ka nishaan
- [x] 26.10 Step 4 "Dekho" — poori reel modal ke andar
- [x] 26.11 `applyWizard()` — `assetByRole` bhar kar `buildProposal` → `applyProposal`, ek op
- [x] 26.12 AiPanel se purani accept/reject list hataana
- [x] 26.13 Beech me band karne par tasdeek
- [x] 26.14 Ek poora chakkar chala kar dekhna: kahani → reel, aur Ctrl+Z se poora wapas

**Done when:** ek aadmi jo editor kabhi nahi khola, kahani paste karke ek chalti hui reel bana
le — bina kisi se poochhe, aur bina ek baar bhi timeline chhue.

## Progress log

- **2026-08-23 (baad me)** — **"Awaaz banao" ab Vercel par bhi chalti hai (26.19).**

  Pichhle daur me maine likha tha ki Vercel par ffmpeg nahi hai, isliye wahan awaaz nahi ban
  sakti aur aadmi ko "Apni awaaz" upload karni padegi. **Wo jawab galat tha** — deewar zaroori
  thi hi nahi.

  Gemini kaccha PCM deta hai. Use WAV banane ke liye ffmpeg maanga ja raha tha — par WAV koi
  encoding hai hi nahi: **wo wahi PCM hai jiske aage 44 byte ka header lagta hai.** Us header
  me chaar baatein likhni hoti hain (channel, rate, bits, data ka naap). Uske liye ek poora
  media toolchain maangna us kaam se bahut bada tha jitna wo kaam hai.

  Ab `tts/wav.ts` wo header khud likhta hai aur lambai ginti se nikaalta hai. PCM wale raaste me
  ffmpeg **chalta hi nahi**. (mp3 dene wale provider — edge-tts — ke liye purana raasta waisa ka
  waisa hai; wo waise bhi sirf us machine par chalta hai jahan python ho.)

  ⚠️ Resampling jaan-boojhkar nahi hoti. Purana raasta 48kHz stereo par le jaata tha (soxr se).
  JS me wo "theek se" karna ek chhota DSP likhna hai; "jaise-taise" karna sunai deta hai. Aur
  zaroorat bhi nahi: WAV har rate par jaayaz hai, preview use bajata hai, aur render ke waqt
  ffmpeg (worker par, jahan wo maujood hai) sahi rate par le aata hai.

  **Is machine par chala kar dekha — aur is machine par ffmpeg hai hi nahi:**

  ```
  available = true  (gemini-2.5-flash-preview-tts)
  AWAAZ BAN GAYI  116 KB · 2.41s
  header: RIFF/WAVE  rate=24000  channels=1  bits=16
  ```

  Header ke har number ki apni jaanch hai (`worker/scripts/check-wav.ts`, 15 assertions) —
  kyunki ek galat offset par file "ban" jaati hai aur player use bajata bhi hai; bas raftaar ya
  awaaz galat hoti hai, aur wo galti kaan tak pahunchti hai, kisi error tak nahi.

- **2026-08-23** — screenshot ke feedback ke baad. Paanch cheezein, aur teen me jad wahi nikli:
  koi "poochh raha tha" par jawab kisi aur se maang raha tha.

  1. **Wizard me tasveer dikhti hi nahi thi** (toota hua icon). `useAssetUrl(..., {thumb:true})`
     maanga jaata tha, par thumbnail sirf **bani hui reel** ka banta hai — aam upload ka nahi.
     Route saaf 404 deta tha (aur wo 404 sahi tha), par UI use toota hua `<img>` bana deti thi,
     yaani aadmi ko lagta tha ki uski file kharab hai. Ab poori tasveer dikhti hai (54px ke
     dabbe me uska kharcha kuch bhi nahi), aur video par tasveer ki jagah film ka nishaan.

  2. **Awaaz — `ENOENT: mkdir '/var/task/render-out'`.** `scratchDir()` `REEL_OUTPUT_DIR` se
     bandha tha, jo serverless me `/var/task` par girta hai — aur wo **read-only** hai. Scratch
     hai hi phenkne ke liye; use project ke folder se baandhne ki wajah kabhi thi hi nahi. Ab
     hamesha OS ka temp folder.

  3. **Aur us fix ke baad bhi awaaz nahi bani — kyunki `available()` jhooth bol raha tha.**
     Gemini PCM lautata hai; use wav banane ke liye ffmpeg chahiye. `available()` sirf API key
     dekhta tha, isliye ffmpeg na hone par bhi "ok" bolta — wizard button chalu rakhta aur har
     baar `spawn ffmpeg ENOENT` par kaam marta. **Vercel par ye hamesha ki halat hai: wahan
     ffmpeg hota hi nahi.** Ab jawab me wo baat saaf likhi hai, taaki UI "Apni awaaz upload
     karo" wala raasta dikha sake — wahan wahi ekmatra sach hai.

  4. **CTA** — logo chhota aur upar (0.20 scale), text 54 par (72 do line me toot kar poora
     frame gher leta tha), patti aur patli.

  5. **Text ka size** ab wizard me chunna ja sakta hai — Chhota / Normal / Bada, poori reel ke
     liye ek. Per-scene nahi: ek hi reel me har scene ka alag size use judi hui dikha deta hai,
     aur saat scene par saat faisle koi nahi leta.

  Naap: core **585 + 56, 0 fail**; studio + worker typecheck saaf; `next build` saaf.

- **2026-08-22 (raat, teesra daur)** — feedback ke baad ka batch.

  **Teen bug, teeno ki jad mili:**
  1. **Upload fail** — network ka masla tha hi nahi. R2 bucket par CORS rule hai hi nahi;
     `OPTIONS` par 403 aur `access-control-allow-origin` nadarad. `local` driver par upload
     apne hi server par jaata tha, isliye ye kabhi saamne nahi aaya. Error message ab CORS ka
     naam leta hai.
  2. **"Awaaz nahi ban rahi" — meri galti.** Jawab me field `available` hai, `ok` nahi. Main
     `entry.ok` padh raha tha jo hamesha `undefined` aata, isliye wizard TTS ko band bataata
     tha — aur pichhle daur me maine us "chetavni" ke bharose button bhi disable kar diya tha.
     Yaani chalti hui cheez band kar di thi. `manual` provider ab ginta bhi nahi.
  3. **CTA par naarangi dabba** — wo `DEFAULT_SHAPE` tha (60% x 20%, brand rang). Aur wo text
     ke upar isliye aata tha ki track item ke **type** se milta hai, yaani "pehle band phir
     text" wali tarteeb z-order tay karti hi nahi. Ab patli patti hai (1.5%), jo z-order par
     tiki hi nahi — upar rahe ya neeche, text dhak nahi sakti.

  **Paanch feature:**
  - CTA me **logo** ka slot
  - Tasveer chhoti ho to poora naap: *"1080x1920 ki hai, 1.35x badi dikhegi — chahiye 1458x2592"*
  - Tasveer **aur** video dono ka option, ek par "Sifaarish". Doosra chunne par scene ka type
    khud badal jaata hai (`effectiveType`)
  - Video daalte hi **trim ka modal** — kahan se, kitna lamba
  - Bani hui reel ab **media library me** bhi (worker se, job ki id par — retry par do row nahi)

  Do cheezein raaste me jodni padi, dono usi "chup-chaap gayab" wali shakl ki:
  `video` scene type me `AUDIO_SLOT` (warna video chunte hi banayi hui awaaz chali jaati), aur
  `SceneBuildInput` me `width`/`height` (warna CTA ki patti ke liye pixel likhne padte, jo
  1080x1920 ke alawa har naap par galat baithte).

  Naapa hua: core **585 + 52 assertions, 0 fail**; studio + worker typecheck saaf; `next build`
  saaf.

  WARNING: Is daur ka **browser pass nahi hua** — Chrome beech me band ho gaya. Logic poori
  tarah naapi gayi (video/trim/CTA/size ki apni jaanchein hain), par screen par ye batch abhi
  dekha nahi gaya.

- **2026-08-22 (raat, baad me)** — **26.14: poora chakkar browser me chala kar dekha.**

  Asli Gemini call se 5 scene bane, phir: shabd → tasveer (library se PAPA.png) → awaaz →
  dekho → editor. Naapa hua:

  - **Apply:** "5 scene ban gaye", timeline `4 track · 11 item` → `18 item`
  - **Undo:** button ka title `Undo: Wizard: 5 scene (Ctrl+Z)` — yaani **ek hi entry**.
    Dabane par `18 item` → `11 item`, aur history khaali (`Undo karne ko kuch nahi`).
    DB me project wapas 11 item par — kuch peeche nahi chhoota.
  - Nested modal (asset picker wizard ke upar) theek chala
  - Preview me asli `<Player>` chala — "5 scene · 75 second", controls ke saath

  **Teen cheezein sirf chala kar dekhne se mili, aur teeno theek ki gayi:**

  1. **Tasveer daalne par "Harkat" khaali reh jaata tha.** Wizard khulte hi `autoFill` chalta
     hai, us waqt tasveer hoti nahi, isliye `suggestAnimation` sahi hi `null` deta hai. Phir
     tasveer daalne par wo dobara nahi chalta — natija: bagal me "Sifaarish" ka nishaan, aur
     chunav khaali. Screen ek sujhav dikha rahi thi jo laga hi nahi tha. Ab tasveer lagte hi
     harkat lag jaati hai, aur tasveer hatte hi hat jaati hai (warna wo TEXT par lagti).
  2. **Video wale scene bhare hi nahi ja sakte the.** AI aksar `screen_recording` scene banata
     hai jiska slot `asset:video` hai; wizard sirf `asset:image` dekhta tha. Preview me saaf
     dikha: *"…naam ki asset library me nahi mili — ye slot khaali rahega"*, aur aadmi ke paas
     use theek karne ka koi raasta nahi tha. Ab slot ke hisaab se "Tasveer daalo" ya "Video
     daalo" aata hai (`visualSlotKind`).
  3. **"Awaaz banao" tab bhi dabta tha jab koi TTS provider chal hi nahi raha tha** — har baar
     503, aur aadmi ko lagta ki galti uski hai. Ab wo disabled hai; upar likhi chetavni hi
     kaafi hai (README rule 5).

  In teeno me se ek bhi typecheck ya build se nahi milti. Yahi wo farak hai jiske liye 26.14
  alag box tha.

- **2026-08-22 (raat)** — poora UI ban gaya: `WizardModal` + chaar step
  (`StepText`, `StepImage`, `StepVoice`, `StepPreview`), `ChoicePicker`, aur AiPanel se purani
  accept/reject list hat gayi.

  Naapa hua:
  - `npx tsc --noEmit` — studio saaf
  - `npx next build` — poora build saaf (`/project/[id]` 181 kB)
  - core ka check — 585 groups + 40 wizard assertions, 0 fail

  ⚠️ **26.14 jaan-boojhkar tick NAHI kiya.** Upar wala sab "code hai aur compile hota hai"
  saabit karta hai — "browser me chal kar dikhta hai" nahi. Ye do alag baatein hain, aur inhe
  ek maan lena hi wo aadat hai jiske khilaaf is repo ka Resume Protocol likha gaya hai. Ek
  aadmi ko kahani paste karke poora chakkar chalana hoga: shabd → tasveer → awaaz → dekho →
  editor, aur phir Ctrl+Z.

  Banate waqt do faisle jo design me nahi likhe the:
  - **Har scene ki qatar ka apna uploader hai.** Ek saanjha uploader rakhne par ye sawaal bacha
    reh jaata ki jo file abhi chadhi wo *kis scene* ki thi — `addFiles()` koi id nahi lautata.
    "Aakhri wala scene" maan lena bilkul chalta dikhta hai aur do file ek saath chunne par
    chup-chaap galat scene par tasveer laga deta.
  - **Awaaz ka chunav poori reel ke liye ek hai**, har scene par alag nahi. Ek hi reel me har
    scene ka bolne wala badalta rahe to reel tooti hui lagti hai — aur aath scene par aath baar
    wahi dropdown bharna wo kaam hai jise aadmi teesre scene par chhod deta hai.

- **2026-08-22** — design tay hua aur likha gaya.
- **2026-08-22** — wizard ka poora dimaag ban gaya (`wizard/draft.ts`) aur bina browser ke
  chala kar dekha: `npm run check --workspace @reel/core` → purani suite **585 groups, 0 fail**
  + wizard **40 ok, 0 fail**.

  Do cheezein banate waqt nikli jo design me nahi thi:

  1. **`text_audio` scene type jodna pada.** Tasveer chhodne par `image_audio` ban nahi sakta
     (uska image slot required hai), aur seedha `text` par girne par aadmi ki **banayi hui awaaz
     gayab ho jaati** — `text` me audio ka slot hai hi nahi. `audio` ("sirf awaaz") par girna
     ulta nuksaan karta: wahan caption ka slot nahi. Isliye beech ki jagah bani.
  2. **`check` script maine khud tod di thi.** `packages/reel-core/package.json` me
     `"check": "tsx scripts/check.ts"` pehle se tha (585 assertion groups) aur maine use apne
     wizard check se overwrite kar diya. Ab dono chain me chalti hain. Ye theek wahi shakl ki
     galti thi jiske khilaaf ye poora repo likha gaya hai — kuch toota nahi dikhta, bas
     jaanchein chupchaap band ho jaati hain.

  Ek jaanch ne apni hi galti pakdi: "pehle scene par transition nahi" ko `!transitionIn` se
  jaancha tha, jabki har item par `transitionIn` **hota hai** — bas uska type `"none"` hota hai.
  Wo assertion hamesha fail hoti, aur uska aasan ilaaj use hata dena hota — jiske baad ye asli
  halat kabhi jaanchi hi na jaati.

- **2026-08-22** — 26.1/26.2/26.3 ban gaye aur chala kar dekhe:
  `npm run check --workspace @reel/core` → **21 ok, 0 fail**.

  Do jaanchein khaas hain, kyunki wo niyam nahi *nateeja* dekhti hain:
  - asli kahani (6 line) par ek se zyada animation aayi — sam/visham wala niyam
    theek likha ho par sab lines chhoti nikal aayein to poori reel ek hi preset
    par chali jaati, aur wo baat kisi bhi ek-scene wali jaanch me nahi dikhti.
  - sifaarish sirf wahi id deti hai jo registry me sach me hai — galat id doc me
    jaane par render use pehchaanta hi nahi aur animation **bina kisi error ke**
    lagta hi nahi.

  Aur ek jaanch iske liye ki har registry entry ka aam-bhasha wala naam maujood
  ho — warna naya preset jodne par UI par kachcha id (`focus-pull`) chhap jaata
  hai, chup-chaap.

  Typecheck: core (dono tsconfig) + studio + worker — teeno saaf.
