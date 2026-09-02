# Wizard me dobara kholo + naap ki rok (design)

Do alag kaam, ek hi spec me — dono chhote hain aur dono `@reel/core` ke maujooda
hisaab par tikte hain, koi naya ganit nahi.

1. **Bane hue video ko wizard me wapas kholna** — Renders panel se.
2. **Galat naap ki file ko upload se pehle rokna** — exact naap batate hue.

---

## 1. "Wizard me kholo" — Renders panel se

### Dikkat

`applyWizard` (`packages/reel-core/src/wizard/draft.ts`) **ek taraf** chalta hai:
draft → doc. Doc me sirf nateeja bachta hai. Wizard ke chunav — awaaz ki
category, video ka trim, volume points, per-scene tweak, hataye hue scene, asli
file bनाम uski fit ki hui copy — doc me likhe hi nahi jaate.

Isliye bane hue video ke doc se wizard ko *wapas* banana andaaza hoga, hisaab
nahi. Ek hi doc se do alag draft nikal sakte hain, aur unme se kaunsa sach hai
iska koi jawab nahi hota.

### Ilaaj — draft ko doc ke saath jama karo

`MetaSchema` me ek naya khaana:

```ts
export const MetaSchema = z.object({
  createdBy: z.enum(["manual", "ai", "template"]),
  sourceStory: z.string().nullable(),
  /** Wizard ki yaad — samajhne ka kaam `wizard/memory.ts` karta hai. */
  wizard: z.unknown().nullable().default(null),
});
```

Isme jo baithta hai:

```ts
interface WizardMemory {
  version: 1;
  draft: WizardDraft;
  /** `applyWizard` ne jo scene banaye — haath ke badlav pakadne ke liye. */
  appliedSceneIds: string[];
  appliedAt: string;
}
```

**`z.unknown()` jaan-boojhkar hai, aur ye is design ka sabse zaroori faisla hai.**
Worker doc ko **sakht** parse karta hai (`studio/lib/renders.ts` me
`parseDoc(input.doc)`). Draft ka shape UI ke saath badalta rehta hai. Agar yahan
sakht schema hota, to ek purane shape ki yaadgaar poore render ko maar deti —
yaani ek UI ki suvidha ki wajah se video banna band. Doc ke raaste par ye sirf
"kuch pada hai" hai; use samajhne ka kaam `readWizardMemory()` karta hai, aur
samajh na aaye to `null` — button nahi dikhta, baaki sab waise ka waisa chalta
hai.

Likhta kaun hai: **`applyWizard` khud**, apne lautaye hue doc me. Wahi ek
function doc banata hai, wahi yaad bhi rakhta hai — do jagah likhne ka sawaal
hi nahi.

Freeze apne aap: har render job doc ka snapshot pehle se rakhta hai
(`reel_render_jobs.doc`). Draft us snapshot ke andar hai, isliye wo us video ke
saath jam jaata hai. **Koi naya column nahi, koi migration nahi.**

### Raasta

- `GET /api/render/[id]/wizard` — job ka frozen doc padho, sirf
  `readWizardMemory(doc.meta.wizard)` lautao. Poora doc kabhi nahi (100KB+).
- `RendersPanel` ke `completed` row me Download ke bagal me **"Wizard me kholo"**.
  Sirf tab dikhega jab us job ki yaadgaar padhi ja saki ho.
- `AiPanel` wizard ko `script` ke bajaye seedha `draft` se bhi khol sake — abhi
  wo sirf `AiScript` leta hai.

### Kholne se pehle draft seedha karna (`rehydrateDraft`)

- **Gayab awaaz.** TTS ki awaaz `temporary` hoti hai
  (`studio/app/api/tts/route.ts`) aur cleanup use utha leta hai. Jo
  `voiceAssetId` ab maujood nahi wo `null` ho jaata hai aur scene voice-stale
  mark hota hai, taaki wizard use dobara banane ko kahe. Chup-chaap chhod dene
  par wizard "awaaz hai" dikhata aur reel me us jagah chuppi aati — aur wo galti
  sirf reel sunkar pakdi jaati.
- **Gayab tasveer/video.** Jo visual ya fit asset ab nahi hai, uske field `null`,
  aur us scene par saaf likha jaata hai ki file chali gayi.
- **Fit dobara.** `visualFitKey` maujooda frame se milta hai ya nahi — na mile to
  fit dobara banegi (wahi jaanch jo `StepImage` pehle se karta hai).

### Do jagah saaf sach

1. Job ke doc ke scene agar `appliedSceneIds` se mel na khaayen → "is reel me
   wizard ke baad haath se badlav hue the — dobara lagane par wo nahi aayenge."
2. Wizard **maujooda project doc** par lagta hai, us purane frozen doc par nahi.
   Purana render itihaas hai; use badla nahi ja sakta. Ye modal ke andar likha
   rahega.

### Ek imaandaar hadd

Jo render **abhi tak ho chuke hain** unke doc me ye yaadgaar hai hi nahi — un par
button nahi dikhega. Iska koi ilaaj nahi: wo jaankari us waqt likhi hi nahi gayi
thi. Ise chhupane ki jagah button hi na dikhana theek hai.

### Jaanch

`packages/reel-core/scripts/check-wizard.ts` me round-trip: draft →
`applyWizard` → `readWizardMemory` → wapas wahi draft. Browser khole bina chalta
hai, wahi tareeka jo poore wizard ka hai.

---

## 2. Naap ki rok — upload se **pehle**

### Dikkat

Abhi har file chadh jaati hai, aur naap ki chetavni **baad me** aati hai — wizard
me (`requiredVisualSize`) ya export ke validator me. Us waqt tak bytes storage
par ja chuke hote hain. Storage bharta hai, aur uska bojh baaki sab par dikhta
hai.

### Kahan

`studio/lib/upload/uploader.ts` ke `runTask` me — step 2 (browser probe) aur
step 3 (presign) ke **beech**. `probeFileInBrowser` pehle se hi wahan chalta hai
aur width/height deta hai, yaani faisla PUT se pehle ho sakta hai — **ek byte
bheje bina**.

### Hisaab — naya kuch nahi

Naya function `@reel/core` me, `checkUploadSize()`:

- Sirf `hasPixels` waali kism par (image / video). Audio, font par kuch nahi
  badalta.
- `planFit({ source, frame, animationPresetId: null })` chalta hai. Upload ke
  waqt ye pata hi nahi hota ki kaunsi harkat lagegi, isliye zoom ka hisaab yahan
  nahi lagta — wo per-scene chetavni pehle se maujood hai.
- `plan.upscale > MAX_CLEAN_UPSCALE` (1.6) → mana.
- **Rok pixel ki kami par hai, aspect par nahi.** 1920x1080 landscape 1080x1920
  reel me bilkul chalega — wo contain + dhundhle kinare se baithta hai, aur wo ek
  chuna hua raasta hai (`CONTAIN_BACKGROUNDS` me `blurred-asset`). Rukega sirf wo
  file jo *kisi bhi* tarah bithane par phail kar dhundhli hogi.
- Hadd wahi 1.6 hai jo `planFit` aur `fitFor` lagate hain. Alag number rakhne par
  upload ek baat kehta aur wizard doosri.

### Kya likha jaayega

Exact naap, `checkUpscale` ke `requiredSource` se:

> `IMG_2231.jpg 720x1280 ka hai. 1080x1920 ki reel me ye 1.5x phailegi — kam se
> kam 1080x1920 chahiye.`

Frame `useEditorStore` se milta hai. `MediaPanel` aur `AssetPicker` dono editor
ke andar hi chalte hain, isliye koi prop plumbing nahi. `VoiceRecorder` bhi wahi
hook chalata hai par wo audio hai — rok us par lagti hi nahi.

Reject hui file ka card wajah ke saath dikhta rahega, chup-chaap girti nahi —
wahi tareeka jo `checkUploadable` ki rok ka hai.

### Server par wahi rok dobara

`studio/app/api/assets/[id]/complete/route.ts` me probe ke baad wahi
`checkUploadSize`. Client par lagi rok soojh-boojh hai, deewar nahi — yahi baat
`checkUploadable` par pehle se likhi hai. Fail hone par row nahi banti aur file
storage se hat jaati hai; us route me `storage().delete(key)` ka raasta pehle se
maujood hai, isliye anaath bytes nahi bachte.

Naap na pata ho (probe fail) to rok **nahi** lagti. Bina naap ke mana karna
andaaza hoga, aur wo aadmi ki sahi file ko rok dega.

### Jaanch

`packages/reel-core` ke check script me: chhoti tasveer rukti hai, landscape
nikal jaati hai, audio par rok lagti hi nahi, aur naap na hone par nikal jaati
hai.
