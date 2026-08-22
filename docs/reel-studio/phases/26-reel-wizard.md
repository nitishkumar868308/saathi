# Phase 26 — Reel Wizard (kahani se reel, ek raaste me)

**STATUS:** dimaag ban gaya aur naapa gaya (26.1-26.4, 26.8, 26.11) — UI baaki
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
- [ ] 26.5 Step 1 "Shabd" — edit, hata do
- [ ] 26.6 Step 2 "Tasveer" — upload / library / chhod do
- [ ] 26.7 Animation + transition chunne wala chalta hua preview (ek waqt me ek loop)
- [x] 26.8 `autoFill()` — sirf khaali chunav bharta hai (UI ka button baaki)
- [ ] 26.9 Step 3 "Awaaz" — banao / apni daalo / chhod do + purane shabdon ka nishaan
- [ ] 26.10 Step 4 "Dekho" — poori reel modal ke andar
- [x] 26.11 `applyWizard()` — `assetByRole` bhar kar `buildProposal` → `applyProposal`, ek op
- [ ] 26.12 AiPanel se purani accept/reject list hataana
- [ ] 26.13 Beech me band karne par tasdeek
- [ ] 26.14 Ek poora chakkar chala kar dekhna: kahani → reel, aur Ctrl+Z se poora wapas

**Done when:** ek aadmi jo editor kabhi nahi khola, kahani paste karke ek chalti hui reel bana
le — bina kisi se poochhe, aur bina ek baar bhi timeline chhue.

## Progress log

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
