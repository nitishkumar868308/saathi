# Bolti Tasveer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Studio me ek naya tab — tasveer + text + emotion daalo, aur ek chhota clip bane jisme wo tasveer bolti hui dikhe. Free, bina kisi bahari API ke.

**Architecture:** Muh ka shape TTS ke **text** se aata hai aur timing awaaz ke **energy envelope** se; dono `@reel/core` me jud'te hain (pure TS, check script se jaancha). Chehre ke points MediaPipe se browser me nikalte hain aur asset ke `meta` me jama hote hain. Render Remotion me ek **SVG triangle mesh** se hota hai jo asli tasveer ke apne honth kheenchta hai. `worker/` me kuch nahi badalta.

**Tech Stack:** TypeScript, zod, Remotion 4, React 18, MediaPipe Tasks Vision (WASM), Web Audio API. Koi test runner nahi — jaanch `check-*.ts` scripts se.

---

## ⚠️ Sabse zaroori niyam — sirf jodo, badlo mat

User ki saaf shart: **jo studio reel me abhi chal raha hai usme koi badlav nahi.**

Iska matlab is plan me:

- Naye **files** banenge. Maujooda file tabhi chhui jaayegi jab usme ek **nayi
  entry** jodni ho (registry ki list, schema ka naya optional field) — aur wo
  entry apne default ke saath aayegi, taaki purana raasta bilkul waisa hi chale.
- Kisi maujooda scene type, item type, wizard, renderer, ya export ka behaviour
  **nahi** badlega.
- Har task ke ant me `npm run check --workspace @reel/core` chalega. Wo 254 checks
  pehle se pass hain; unme se **ek bhi** toota to wo badlav galat hai, chahe naya
  feature chal raha ho.

---

## File Structure

**Naye (poore naye, kisi ko chhuye bina):**

| File | Zimmedari |
|---|---|
| `packages/reel-core/src/visemes/shapes.ts` | Aath muh ke shape ki registry |
| `packages/reel-core/src/visemes/fromText.ts` | Text → viseme ki qatar (akshar se) |
| `packages/reel-core/src/visemes/track.ts` | Qatar + envelope → waqt wala track |
| `packages/reel-core/src/visemes/emotions.ts` | `EMOTIONS` registry |
| `packages/reel-core/src/face/landmarks.ts` | Face data ka shape + kaunse points chahiye |
| `packages/reel-core/src/face/mesh.ts` | Landmarks + viseme + emotion → kheencha hua mesh |
| `packages/reel-core/src/face/affine.ts` | Teen point se affine matrix |
| `packages/reel-core/scripts/check-visemes.ts` | Upar ke sab ki jaanch |
| `packages/reel-remotion/src/items/TalkingPhotoItem.tsx` | SVG mesh renderer |
| `studio/lib/face/detect.ts` | MediaPipe browser me |
| `studio/lib/face/envelope.ts` | Web Audio se energy envelope |
| `studio/components/editor/panels/TalkingPhotoPanel.tsx` | Naya tab |
| `studio/public/models/face_landmarker.task` | Model file (~4MB) |
| `worker/scripts/render-warp.ts` | Spike ka saboot |

**Chhue jaane wale — sirf ek nayi entry, aur kuch nahi:**

| File | Kya judega |
|---|---|
| `packages/reel-core/src/index.ts` | naye module ka export |
| `packages/reel-core/src/schema/project.ts` | `TalkingPhotoSchema` + item par `talkingPhoto` field (default `null`) |
| `packages/reel-core/src/registry/itemTypes.ts` | ek naya item type |
| `packages/reel-core/src/registry/sceneTypes.ts` | ek naya scene type |
| `packages/reel-remotion/src/register.ts` | ek line |
| `studio/components/editor/panels/index.tsx` | ek panel entry |
| `packages/reel-core/package.json` | `check` me naya script |

---

## Task 1: Spike — SVG mesh warp Remotion me chalta hai?

**Files:**
- Create: `packages/reel-core/src/face/affine.ts`
- Create: `worker/scripts/render-warp.ts`
- Modify: `packages/reel-core/src/index.ts`, `worker/package.json`

**Kyun sabse pehle:** poora render isi ek baat par tika hai — Chromium ke
screenshot me SVG ka `clip-path` + `<image transform>` sach me kheencha hua
nikalta hai ya nahi. Ye baad me pata chalna sabse mehnga hota, kyunki tab tak
visemes, landmarks, panel — sab bane hue honge.

- [ ] **Step 1: `affine.ts` likho**

```ts
/**
 * Teen point se affine matrix — mesh warp ka poora ganit (bolti tasveer).
 *
 * ⚠️ SVG me tasveer ka ek tukda kheenchne ka tarika ye hai: destination wale
 * triangle ka `clip-path` lagao, aur poori tasveer ko ek `matrix(...)` ke saath
 * uske andar rakho. Wo matrix source triangle ko destination triangle par le
 * jaati hai. Har triangle ke liye ek — yahi "mesh warp" hai.
 *
 * ⚠️ Ye hisaab yahan hai (core me), component me nahi, kyunki iska sahi hona
 * aankh se pakda hi nahi jaata: thoda galat matrix par tasveer bas "halki si
 * ajeeb" lagti hai. Yahan hone se ise ek script se naapa ja sakta hai.
 */

export interface Point {
  x: number;
  y: number;
}

/** SVG `matrix(a b c d e f)` — wahi kram jo SVG maangta hai. */
export interface Affine {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

export const IDENTITY: Affine = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

/**
 * `from` ke teen point ko `to` ke teen point par le jaane wali matrix.
 *
 * `null` = teeno point ek hi lakeer par hain (degenerate), yaani koi triangle
 * hai hi nahi. Aisi halat me matrix banti hi nahi — aur zabardasti banane par
 * tasveer poore frame par kheench jaati hai.
 */
export function affineFromTriangles(
  from: readonly [Point, Point, Point],
  to: readonly [Point, Point, Point],
): Affine | null {
  const [s0, s1, s2] = from;
  const [d0, d1, d2] = to;

  const det = (s1.x - s0.x) * (s2.y - s0.y) - (s2.x - s0.x) * (s1.y - s0.y);
  if (!Number.isFinite(det) || Math.abs(det) < 1e-9) return null;

  const a = ((d1.x - d0.x) * (s2.y - s0.y) - (d2.x - d0.x) * (s1.y - s0.y)) / det;
  const c = ((d2.x - d0.x) * (s1.x - s0.x) - (d1.x - d0.x) * (s2.x - s0.x)) / det;
  const b = ((d1.y - d0.y) * (s2.y - s0.y) - (d2.y - d0.y) * (s1.y - s0.y)) / det;
  const d = ((d2.y - d0.y) * (s1.x - s0.x) - (d1.y - d0.y) * (s2.x - s0.x)) / det;

  return { a, b, c, d, e: d0.x - a * s0.x - c * s0.y, f: d0.y - b * s0.x - d * s0.y };
}

/** `matrix(a b c d e f)` — seedha SVG ke `transform` me. */
export function affineToSvg(m: Affine): string {
  return `matrix(${m.a} ${m.b} ${m.c} ${m.d} ${m.e} ${m.f})`;
}

/** Matrix ko ek point par lagao — jaanch ke liye. */
export function applyAffine(m: Affine, p: Point): Point {
  return { x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f };
}
```

- [ ] **Step 2: `index.ts` me export**

`export * from "./media/uploadSize";` ke neeche:

```ts
export * from "./face/affine";
```

- [ ] **Step 3: Ganit ki jaanch (script se, render se pehle)**

Naya file `packages/reel-core/scripts/check-visemes.ts`:

```ts
/**
 * Bolti tasveer ka poora hisaab — shape, waqt, aur mesh (browser khole bina).
 *
 * ```
 * npm run check --workspace @reel/core
 * ```
 *
 * Repo me koi test runner nahi hai; yahan ka tarika `check-*` script hai. Wahi
 * tarika yahan bhi — ek hi tarika, ek hi jagah samajhne layak.
 */

import { affineFromTriangles, applyAffine } from "../src/index";

let passed = 0;
const failures: string[] = [];

function check(label: string, condition: boolean, detail = ""): void {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    failures.push(label);
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function near(a: number, b: number, tol = 1e-6): boolean {
  return Math.abs(a - b) < tol;
}

console.log("\naffine — teen point se matrix");

const src: [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }] = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 0, y: 10 },
];

const same = affineFromTriangles(src, src);
check("wahi triangle par matrix kuch nahi badalti", same !== null && near(same.a, 1) && near(same.d, 1) && near(same.e, 0) && near(same.f, 0));

const moved = affineFromTriangles(src, [
  { x: 5, y: 5 },
  { x: 15, y: 5 },
  { x: 5, y: 15 },
]);
check(
  "khiska hua triangle — teeno point sahi jagah pahunchte hain",
  moved !== null &&
    near(applyAffine(moved, src[0]).x, 5) &&
    near(applyAffine(moved, src[1]).x, 15) &&
    near(applyAffine(moved, src[2]).y, 15),
);

const stretched = affineFromTriangles(src, [
  { x: 0, y: 0 },
  { x: 20, y: 0 },
  { x: 0, y: 10 },
]);
check(
  "do guna chaura hone par x do guna hota hai, y waisa rehta hai",
  stretched !== null &&
    near(applyAffine(stretched, { x: 5, y: 5 }).x, 10) &&
    near(applyAffine(stretched, { x: 5, y: 5 }).y, 5),
);

check(
  "ek lakeer par pade teen point par matrix banti hi nahi",
  affineFromTriangles(src, [
    { x: 0, y: 0 },
    { x: 5, y: 5 },
    { x: 10, y: 10 },
  ]) === null,
  "zabardasti banane par tasveer poore frame par kheench jaati hai",
);

console.log(`\n${passed} ok, ${failures.length} fail`);
if (failures.length > 0) {
  for (const line of failures) console.log(`  - ${line}`);
  process.exit(1);
}
```

- [ ] **Step 4: `package.json` me script jodo**

`packages/reel-core/package.json` me `check` badlo:

```json
"check": "tsx scripts/check.ts && tsx scripts/check-wizard.ts && tsx scripts/check-visemes.ts",
```

- [ ] **Step 5: Chalao**

```bash
npm run check --workspace @reel/core
```

Expected: purane 254 checks + 4 naye, `0 fail`.

- [ ] **Step 6: Asli spike — Remotion me render karke naapo**

Naya file `worker/scripts/render-warp.ts`. Ye `worker/scripts/render-mask.ts`
ka bilkul wahi dhaancha follow karta hai (padho pehle) — ek doc banao, render
karo, aur **ffmpeg se pixel naapo**.

Test tasveer: do rang ka aadha-aadha chaukor (baayan laal, daayan neela) — ek
data-URI PNG, ya `render-out/` me pada koi sample. Uske upar ek SVG mesh jo
**daayen aadhe ko chaudai me do guna** kar deta hai.

Do render, aur unki **tulna**:

  (a) bina warp ke — beech wali lakeer frame ke beech me honi chahiye
  (b) warp ke saath — wo lakeer saaf **baayin taraf** khisak jaani chahiye

⚠️ Sirf (b) naapna kaafi nahi hai: agar SVG render hi na hua ho to frame khaali
hoga aur "lakeer beech me nahi hai" waise bhi sach nikal aayega. Yahi galti
`render-mask.ts` me likhi hui hai — wahan se seekho.

Naap ka tarika: `ffmpeg` se ek frame PNG me nikaalo, phir uske beech wali qatar
ke pixel padho (ya `ffprobe`/`signalstats` se). `render-mask.ts` me jo tarika
istemal hua hai, wahi yahan bhi.

`worker/package.json` me:

```json
"render:warp": "tsx scripts/render-warp.ts",
```

- [ ] **Step 7: Spike chalao**

```bash
npm run render:warp --workspace @reel/worker
```

Expected: dono check `ok`, aur nikla hua PNG aankh se dekhne par sach me
kheencha hua dikhe.

🛑 **STOP.** Agar ye fail hota hai — SVG mesh Chromium ke screenshot me theek
nahi aata — to **aage mat badho**. Raasta yahin badalna hai (canvas +
`delayRender()`, ya bina mesh ke simple scale). User ko batao aur poochho.

- [ ] **Step 8: Commit**

```bash
git add packages/reel-core/src/face/affine.ts packages/reel-core/scripts/check-visemes.ts packages/reel-core/src/index.ts packages/reel-core/package.json worker/scripts/render-warp.ts worker/package.json
git commit -m "spike(core): SVG mesh warp ka ganit + Remotion me uska saboot"
```

---

## Task 2: Aath shape aur text se unki qatar

**Files:**
- Create: `packages/reel-core/src/visemes/shapes.ts`, `packages/reel-core/src/visemes/fromText.ts`
- Modify: `packages/reel-core/src/index.ts`, `packages/reel-core/scripts/check-visemes.ts`

- [ ] **Step 1: `shapes.ts` — registry**

```ts
/**
 * Muh ke aath shape — bolti tasveer ka poora shabdkosh.
 *
 * ⚠️ Aath hi kyun: Rhubarb (is kaam ka sabse jaancha hua tool) bhi aath (A-H)
 * par tika hai. Isse kam par alag awaazein ek jaisi dikhne lagti hain; isse
 * zyada par do shapes ka farak dekhne wale ko dikhta hi nahi aur sirf kaam
 * badhta hai.
 *
 * ⚠️ `open` aur `wide` **naap nahi, anupaat hain** (0-1). Asli pixel landmarks
 * se aate hain — har chehre ka muh alag naap ka hota hai, aur yahan pixel likh
 * dene par ek chehre par theek baithta aur doosre par muh phat jaata.
 */

export interface VisemeShape {
  id: string;
  label: string;
  /** Muh kitna khulta hai — 0 = band, 1 = poora khula. */
  open: number;
  /** Kitna chaura — 1 = jaisa hai, <1 = gol/simta, >1 = kheencha hua. */
  wide: number;
  /** Honth kitne aage/gol (0 = normal, 1 = poora gol jaise "oo"). */
  round: number;
}

export const VISEME_SHAPES: readonly VisemeShape[] = [
  { id: "rest", label: "Aaram", open: 0.04, wide: 1, round: 0 },
  { id: "MBP", label: "म ब प", open: 0, wide: 0.98, round: 0.1 },
  { id: "FV", label: "फ व", open: 0.12, wide: 1.02, round: 0 },
  { id: "AA", label: "आ अ", open: 0.85, wide: 1.05, round: 0 },
  { id: "EE", label: "ई ए", open: 0.32, wide: 1.22, round: 0 },
  { id: "OO", label: "ऊ ओ", open: 0.42, wide: 0.72, round: 0.9 },
  { id: "L", label: "ल त द न", open: 0.36, wide: 1.02, round: 0 },
  { id: "S", label: "स श च ज", open: 0.2, wide: 1.12, round: 0 },
] as const;

export type VisemeId = (typeof VISEME_SHAPES)[number]["id"];

export const REST_VISEME = "rest";

export function getVisemeShape(id: string): VisemeShape | undefined {
  return VISEME_SHAPES.find((shape) => shape.id === id);
}
```

- [ ] **Step 2: `fromText.ts` — akshar se shape**

Yahan Devanagari aur Latin dono ke liye ek table banegi. Asool:

- Har **akshar** (syllable) ek viseme deta hai — uske **swar** (vowel) se.
- Agar akshar ka pehla vyanjan `म/ब/प` (`m/b/p`) hai to uske pehle ek chhota
  `MBP` (honth band) ghusta hai — kyunki wahi wo lamha hai jo dekhne wale ko
  saaf dikhta hai. Yahi `फ/व` (`f/v`) par `FV` ke saath.
- Jahan koi akshar nahi (space, viraam) wahan `rest`.

```ts
export interface VisemeStep {
  viseme: string;
  /** Is akshar ka bhaar — lambe swar zyada waqt lete hain. */
  weight: number;
}

export function visemesFromText(text: string): VisemeStep[]
```

⚠️ Ye table **poori tarah sahi nahi hogi**, aur wo theek hai — lip sync me
"lagbhag sahi" aur "bilkul sahi" me aankh ko farak nahi dikhta. Par **honth band
hone wale lamhe (`MBP`) bilkul sahi hone chahiye**: `म`, `ब`, `प` par honth na
milna wo ek galti hai jo har dekhne wala turant pakad leta hai, bina jaane ki
kya galat hai.

- [ ] **Step 3: Jaanch `check-visemes.ts` me**

```ts
console.log("\ntext se muh ke shape");

check("khaali text par kuch nahi", visemesFromText("").length === 0);
check(
  "'माँ' par pehle honth band",
  visemesFromText("माँ")[0]?.viseme === "MBP",
  "म/ब/प par honth na milna wo galti hai jo har dekhne wala turant pakad leta hai",
);
check("'आ' par muh poora khulta hai", visemesFromText("आ")[0]?.viseme === "AA");
check("'ऊ' par gol", visemesFromText("ऊ")[0]?.viseme === "OO");
check("'papa' me dono p par honth band", visemesFromText("papa").filter((s) => s.viseme === "MBP").length === 2);
check("space par aaram", visemesFromText("a a").some((s) => s.viseme === "rest"));
check(
  "har step ka bhaar 0 se bada hai",
  visemesFromText("namaste dosto").every((s) => s.weight > 0),
  "bhaar 0 hone par wo akshar ko koi waqt milta hi nahi",
);
```

- [ ] **Step 4: Export + chalao**

`index.ts`: `export * from "./visemes/shapes";` aur `export * from "./visemes/fromText";`

```bash
npm run check --workspace @reel/core
```

Expected: sab `ok`, `0 fail`, **aur purane 254 bhi pass**.

- [ ] **Step 5: Commit**

```bash
git add packages/reel-core/src/visemes packages/reel-core/src/index.ts packages/reel-core/scripts/check-visemes.ts
git commit -m "feat(core): muh ke aath shape aur text se unki qatar"
```

---

## Task 3: Envelope se waqt — dono ka jodna

**Files:**
- Create: `packages/reel-core/src/visemes/track.ts`
- Modify: `packages/reel-core/src/index.ts`, `packages/reel-core/scripts/check-visemes.ts`

**Ye is poore feature ki jaan hai.** Envelope batata hai bolna **kahan** ho raha
hai; text batata hai **kaunsa shape**. Akele koi ek galat nateeja deta hai.

- [ ] **Step 1: `track.ts` likho**

```ts
import { REST_VISEME, type VisemeStep } from "./shapes";

/**
 * Muh ka poora track — kis waqt kaunsa shape, aur kitna khula.
 *
 * ⚠️ Yahan do alag jaankariyan jud'ti hain, aur dono ki zaroorat asli hai:
 *
 *   - **Envelope** (awaaz ki takat, waqt ke saath) batata hai ki bolna KAHAN ho
 *     raha hai. Sirf text se, poori lambai par barabar baant dena sabse aasan
 *     hai aur galat: TTS beech me saans leti hai, aur wahan muh chalta rehta hai
 *     — dekhne wale ko turant nakli lagta hai.
 *   - **Text** batata hai ki us dauraan KAUNSA shape aana chahiye. Sirf envelope
 *     se karne par har awaaz par muh ek jaisa khulta-band hota hai — jise
 *     "chabaana" kehte hain, aur wahi sabse aam nakli lip sync hai.
 */

export interface VisemeFrame {
  /** Kis waqt (second) se ye shape shuru hota hai. */
  atSeconds: number;
  viseme: string;
  /** Kitna zor — 0 se 1. Envelope se aata hai. */
  intensity: number;
}

/** Isse kam takat par maan liya jaata hai ki koi bol hi nahi raha. */
export const SILENCE_THRESHOLD = 0.08;

/** Itne se chhoti chuppi ko chuppi nahi maana jaata (shabdon ke beech ka jhol). */
export const MIN_SILENCE_SECONDS = 0.12;

export function buildVisemeTrack(args: {
  steps: readonly VisemeStep[];
  /** Barabar doori par li gayi awaaz ki takat (0-1). */
  envelope: readonly number[];
  /** Envelope kitne second ki hai. */
  durationSeconds: number;
}): VisemeFrame[]
```

Kaam ka kram:

1. Envelope se **bolne wale hisse** nikalo (takat `SILENCE_THRESHOLD` se upar,
   aur `MIN_SILENCE_SECONDS` se chhoti chuppi ko jodte hue).
2. Saare `steps` ko un hisson me unke `weight` ke anupaat me baanto.
3. Har chuppi ke hisse par ek `rest` frame daalo.
4. Har frame ka `intensity` us waqt ke envelope se.

- [ ] **Step 2: Jaanch**

```ts
console.log("\nawaaz aur text ka jodna");

const steps = visemesFromText("namaste");
const speaking = new Array(50).fill(0.7);
const silent = new Array(50).fill(0);

const allSpeaking = buildVisemeTrack({ steps, envelope: speaking, durationSeconds: 2 });
check("bolte waqt shape aate hain", allSpeaking.length > 0);
check("pehla frame 0 se shuru hota hai", allSpeaking[0]?.atSeconds === 0);
check(
  "koi frame lambai se bahar nahi jaata",
  allSpeaking.every((f) => f.atSeconds <= 2),
);

const halfSilent = buildVisemeTrack({
  steps,
  envelope: [...speaking, ...silent],
  durationSeconds: 2,
});
check(
  "chuppi wale hisse me muh band rehta hai",
  halfSilent.filter((f) => f.atSeconds > 1.2).every((f) => f.viseme === REST_VISEME),
  "yahi wo galti hai jo sirf text se karne par aati hai — saans me bhi muh chalta rehta",
);

check(
  "poori chuppi par sirf aaram",
  buildVisemeTrack({ steps, envelope: silent, durationSeconds: 1 }).every(
    (f) => f.viseme === REST_VISEME,
  ),
);

check(
  "zor envelope se aata hai, ek jaisa nahi",
  new Set(
    buildVisemeTrack({
      steps,
      envelope: [0.2, 0.9, 0.3, 0.8, 0.2, 0.95],
      durationSeconds: 1,
    }).map((f) => Math.round(f.intensity * 10)),
  ).size > 1,
  "har frame par ek hi zor matlab 'chabaana' — sabse aam nakli lip sync",
);

check("bina step ke bhi nahi phatta", buildVisemeTrack({ steps: [], envelope: speaking, durationSeconds: 1 }).length >= 0);
```

- [ ] **Step 3: Export + chalao + commit**

```bash
npm run check --workspace @reel/core
git add packages/reel-core/src/visemes/track.ts packages/reel-core/src/index.ts packages/reel-core/scripts/check-visemes.ts
git commit -m "feat(core): awaaz ka envelope aur text ka shape - dono jod kar muh ka track"
```

---

## Task 4: `EMOTIONS` registry

**Files:**
- Create: `packages/reel-core/src/visemes/emotions.ts`
- Modify: `packages/reel-core/src/index.ts`, `check-visemes.ts`

- [ ] **Step 1: Likho**

```ts
/**
 * Emotion — bhaunh, aankh, aur sir ka jhukav (bolti tasveer).
 *
 * ⚠️ Ye registry hai, `switch` nahi — nayi emotion jodna ek entry ka kaam rahe,
 * code ka nahi. Wahi wajah jo `ANIMATION_PRESETS` ki hai.
 *
 * ⚠️ Yahan muh ka koi chunav nahi hai, aur wo jaan-boojhkar hai. Muh jo bola ja
 * raha hai usse chalta hai; use emotion se badalna matlab lip sync tod dena.
 * Emotion chehre ke BAAKI hisse se aata hai — aur asal me wahin se aata bhi hai.
 */

export interface EmotionDef {
  id: string;
  label: string;
  /** Bhaunh kitni upar (+) ya neeche (-) — muh ki chaudai ke anupaat me. */
  brow: number;
  /** Aankh kitni khuli — 1 = normal, <1 = simti, >1 = phati hui. */
  eye: number;
  /** Sir ke sway ki raftaar ka guna — 1 = normal. */
  swaySpeed: number;
  /** Honth ke kinare upar (+) ya neeche (-) — halki muskaan ya udaasi. */
  mouthCorner: number;
}

export const EMOTIONS: readonly EmotionDef[] = [
  { id: "neutral", label: "Saada", brow: 0, eye: 1, swaySpeed: 1, mouthCorner: 0 },
  { id: "happy", label: "Khush", brow: 0.06, eye: 0.92, swaySpeed: 1.25, mouthCorner: 0.18 },
  { id: "serious", label: "Gambhir", brow: -0.05, eye: 0.96, swaySpeed: 0.75, mouthCorner: -0.04 },
  { id: "surprised", label: "Hairaan", brow: 0.16, eye: 1.18, swaySpeed: 1.1, mouthCorner: 0.04 },
  { id: "sad", label: "Dukhi", brow: -0.03, eye: 0.88, swaySpeed: 0.6, mouthCorner: -0.16 },
  { id: "excited", label: "Josh", brow: 0.1, eye: 1.06, swaySpeed: 1.5, mouthCorner: 0.14 },
] as const;

export const DEFAULT_EMOTION = "neutral";

export function getEmotion(id: string): EmotionDef | undefined {
  return EMOTIONS.find((emotion) => emotion.id === id);
}
```

- [ ] **Step 2: Jaanch**

```ts
console.log("\nemotion");

check("default emotion registry me hai", getEmotion(DEFAULT_EMOTION) !== undefined);
check("har emotion ka apna naam hai", EMOTIONS.every((e) => e.label.trim().length > 0));
check("koi id do baar nahi", new Set(EMOTIONS.map((e) => e.id)).size === EMOTIONS.length);
check(
  "khush aur dukhi ke honth ulti taraf jaate hain",
  (getEmotion("happy")?.mouthCorner ?? 0) > 0 && (getEmotion("sad")?.mouthCorner ?? 0) < 0,
);
check("anjaan id par undefined", getEmotion("nahi-hai") === undefined);
```

- [ ] **Step 3: Export + chalao + commit**

```bash
npm run check --workspace @reel/core
git add packages/reel-core/src/visemes/emotions.ts packages/reel-core/src/index.ts packages/reel-core/scripts/check-visemes.ts
git commit -m "feat(core): emotion ki registry - bhaunh, aankh, sway"
```

---

## Task 5: Chehre ka data aur kheencha hua mesh

**Files:**
- Create: `packages/reel-core/src/face/landmarks.ts`, `packages/reel-core/src/face/mesh.ts`
- Modify: `packages/reel-core/src/index.ts`, `check-visemes.ts`

**Ye is feature ka dil hai.**

- [ ] **Step 1: `landmarks.ts` — data ka shape**

```ts
export interface FacePoint {
  /** 0-1, tasveer ki chaudai ka anupaat. */
  x: number;
  /** 0-1, tasveer ki oonchai ka anupaat. */
  y: number;
}

/**
 * Ek chehre ka wo hissa jo bolti tasveer ko chahiye.
 *
 * ⚠️ Sirf zaroori points jama hote hain, poore 468 nahi. Poora set har asset row
 * ko bina wajah bhaari karta hai, aur usme se hum 400 se zyada kabhi chhuenge hi
 * nahi.
 *
 * ⚠️ Naap **anupaat me** hai (0-1), pixel me nahi. Wahi tasveer alag naap me fit
 * ho kar aati hai; pixel likh dene par fit ki hui copy par mesh khisak jaata hai.
 */
export interface FaceData {
  version: 1;
  lipsOuter: FacePoint[];
  lipsInner: FacePoint[];
  jaw: FacePoint[];
  leftEye: FacePoint[];
  rightEye: FacePoint[];
  leftBrow: FacePoint[];
  rightBrow: FacePoint[];
}

export function readFaceData(value: unknown): FaceData | null
```

⚠️ **MediaPipe ke index number khud chala kar verify karo.** Is plan me ya kisi
yaad me likhe hue index par bharosa mat karo — model ke output ko ek baar tasveer
par draw karke aankh se milao, tab jama karo. Galat index se mesh chehre ke
kisi aur hisse par baithta hai, aur wo galti render me hi dikhti hai.

- [ ] **Step 2: `mesh.ts` — kheenchna**

```ts
export interface MeshTriangle {
  /** Asli tasveer me ye teen point. */
  from: [FacePoint, FacePoint, FacePoint];
  /** Kheenchne ke baad wahi teen point. */
  to: [FacePoint, FacePoint, FacePoint];
}

export function buildMouthMesh(args: {
  face: FaceData;
  /** Is lamhe ka shape. */
  shape: VisemeShape;
  intensity: number;
  emotion: EmotionDef;
}): MeshTriangle[]
```

Asool: honth ke andar-bahar ke points se triangle bante hain; `open` unhe
upar-neeche kholta hai, `wide` chaudai badalta hai, `round` kinaron ko beech ki
taraf laata hai, aur `mouthCorner` kinaron ko upar/neeche.

⚠️ Kheenchav **`intensity` se guna** hota hai. Bina iske dheeme bole gaye hisse
par bhi muh poora khulta hai, aur wo cheekh jaisa lagta hai.

- [ ] **Step 3: Jaanch**

```ts
console.log("\nmuh ka mesh");

const face = /* ek chhota banaya hua FaceData — 8 point ke honth */;
const rest = getVisemeShape("rest")!;
const aa = getVisemeShape("AA")!;
const neutral = getEmotion("neutral")!;

check(
  "aaram par mesh kuch nahi kheenchta",
  buildMouthMesh({ face, shape: rest, intensity: 0, emotion: neutral }).every((t) =>
    t.from.every((p, i) => Math.abs(p.y - t.to[i]!.y) < 1e-6),
  ),
);

const open = buildMouthMesh({ face, shape: aa, intensity: 1, emotion: neutral });
check("khulne par honth sach me hilte hain", open.some((t) => t.from.some((p, i) => Math.abs(p.y - t.to[i]!.y) > 1e-3)));

check(
  "aadhe zor par aadha khulta hai",
  /* half ka kheenchav full se kam ho */,
  "bina iske dheeme bole gaye hisse par bhi muh poora khulta hai — cheekh jaisa",
);

check("har triangle ke teen point hain", open.every((t) => t.from.length === 3 && t.to.length === 3));
check("bina honth wale face par mesh khaali", buildMouthMesh({ face: emptyFace, shape: aa, intensity: 1, emotion: neutral }).length === 0);
```

- [ ] **Step 4: Export + chalao + commit**

```bash
npm run check --workspace @reel/core
git add packages/reel-core/src/face packages/reel-core/src/index.ts packages/reel-core/scripts/check-visemes.ts
git commit -m "feat(core): chehre ka data aur muh ka kheencha hua mesh"
```

---

## Task 6: Schema, item type, scene type — sirf nayi entry

**Files:**
- Modify: `packages/reel-core/src/schema/project.ts`, `registry/itemTypes.ts`, `registry/sceneTypes.ts`, `check-visemes.ts`

⚠️ **Yahan sabse zyada dhyan chahiye** — ye teeno saanjhi file hain. Sirf **jodo**.

- [ ] **Step 1: `TalkingPhotoSchema` + item field**

`project.ts` me `SubtitleSchema` ke paas:

```ts
export const VisemeFrameSchema = z.object({
  atSeconds: z.number().min(0),
  viseme: z.string().min(1),
  intensity: z.number().min(0).max(1),
});

export const TalkingPhotoSchema = z.object({
  /** Bolne wali awaaz. */
  voiceAssetId: IdSchema.nullable(),
  emotionId: z.string().min(1),
  /** Muh ka poora track — studio me banta hai, render sirf padhta hai. */
  track: z.array(VisemeFrameSchema),
});
```

Aur `ItemSchema` me, `subtitle` ke neeche:

```ts
  /**
   * Bolti tasveer ka data — `null` = ye aam tasveer hai.
   *
   * ⚠️ `default(null)` zaroori hai: iske bina har purana doc parse hona band kar
   * deta, aur doc parse na hona matlab render fail. Wahi tarika jo `subtitle`
   * aur `mockup` ka tha.
   *
   * ⚠️ Yahan schema **sakht** hai (`doc.meta.wizard` ki tarah dheela nahi), aur
   * farak asli hai: wizard ki yaadgaar sirf UI ki suvidha hai — na padhi jaaye
   * to ek button chhup jaata hai. Ye data **render ko chahiye**; aadha-adhoora
   * yahan pahunchna chup-chaap ek murda chehra deta hai, aur wo galti bane hue
   * MP4 me hi dikhti hai.
   */
  talkingPhoto: TalkingPhotoSchema.nullable().default(null),
```

- [ ] **Step 2: Item type registry me ek entry**

`itemTypes.ts` me, baaki entries ke baad:

```ts
  {
    id: "talking_photo",
    label: "Bolti tasveer",
    componentKey: "TalkingPhotoItem",
    // ...baaki fields wahi shakal jo `image` entry ki hai — usse dekh kar bharo
  },
```

- [ ] **Step 3: Scene type registry me ek entry**

`sceneTypes.ts` me:

```ts
  {
    id: "talking_photo",
    // slots: tasveer (required), text (required), awaaz
  },
```

- [ ] **Step 4: Purana kuch nahi toota — saabit karo**

```ts
check(
  "purana doc bina talkingPhoto ke bhi khulta hai",
  parseDoc(createEmptyProject({ name: "purana" })).items.every((i) => i.talkingPhoto === null),
);
```

- [ ] **Step 5: Chalao**

```bash
npm run check --workspace @reel/core && npm run typecheck --workspace @reel/core
```

Expected: **254 purane checks bhi pass** — ek bhi toota to badlav galat hai.

- [ ] **Step 6: Commit**

```bash
git add packages/reel-core/src
git commit -m "feat(core): bolti tasveer ka schema, item type aur scene type (sirf nayi entry)"
```

---

## Task 7: Remotion ka renderer

**Files:**
- Create: `packages/reel-remotion/src/items/TalkingPhotoItem.tsx`
- Modify: `packages/reel-remotion/src/register.ts` (ek line)

- [ ] **Step 1: Component likho**

Dhaancha: `ImageItem.tsx` padho aur wahi tarika follow karo (asset ka URL,
`Transformed` wrapper). Uske upar:

- Poori tasveer ek `<image>` — jaisi hai
- Uske upar SVG me har `MeshTriangle` ke liye ek `<g clip-path>` + `<image transform>`
- Aankh/bhaunh emotion ke hisaab se
- Palak jhapakna aur sway `localFrame` se — **bekayda antaraal par**

```tsx
/*
 * ⚠️ Palak barabar antaraal par nahi jhapakti. 4 second par theek 4 second wala
 * jhapakna machine jaisa lagta hai — dekhne wale ko wajah samajh nahi aati, bas
 * chehra "ajeeb" lagta hai. Isliye antaraal ek beej se badalta hai.
 */
```

⚠️ **Canvas mat lagao.** Remotion har frame ka screenshot Chromium se leta hai;
canvas par draw karna async hai aur us screenshot se race karta hai — nateeja
beech-beech me purana ya khaali frame, jo sirf bane hue MP4 me dikhta hai. Task 1
ne saabit kiya hai ki SVG chalta hai.

- [ ] **Step 2: `register.ts` me ek line**

```ts
  registerItemComponent("TalkingPhotoItem", TalkingPhotoItem);
```

- [ ] **Step 3: Typecheck + spike wala render dobara**

```bash
npm run typecheck --workspace @reel/remotion
npm run render:warp --workspace @reel/worker
```

- [ ] **Step 4: Commit**

```bash
git add packages/reel-remotion/src
git commit -m "feat(remotion): bolti tasveer ka renderer - SVG mesh se"
```

---

## Task 8: Browser me chehre ke points

**Files:**
- Create: `studio/lib/face/detect.ts`, `studio/public/models/face_landmarker.task`
- Modify: `studio/package.json` (`@mediapipe/tasks-vision`)

- [ ] **Step 1: Dep + model file**

```bash
npm install @mediapipe/tasks-vision --workspace @reel/studio
```

Model file (`face_landmarker.task`, ~4MB) `studio/public/models/` me rakho.

⚠️ **CDN se mat load karo.** MediaPipe ka default tarika jsdelivr se uthata hai —
wo "sab kuch local" wale niyam ko todta hai, aur CDN band hone par feature
chup-chaap marta hai (screen par sirf "kuch nahi hua"). WASM npm package se aata
hai; model file repo se.

- [ ] **Step 2: `detect.ts`**

```ts
export async function detectFace(image: HTMLImageElement): Promise<FaceData | null>
```

`null` = chehra nahi mila. Chup-chaap kuch bana dena mana hai.

- [ ] **Step 3: Index verify karo**

Ek chhota dev page ya console script se: model ka output ek tasveer par draw
karke dekho ki honth/aankh/bhaunh sach me wahi points hain. **Tabhi aage badho.**

- [ ] **Step 4: Asset ke meta me jama**

`meta.face` me — `probe` ki tarah. Ek tasveer par ek hi baar.

- [ ] **Step 5: Commit**

---

## Task 9: Awaaz ka envelope

**Files:**
- Create: `studio/lib/face/envelope.ts`

- [ ] **Step 1: Likho**

```ts
/** Awaaz ki takat, barabar doori par (0-1). */
export async function audioEnvelope(url: string, samplesPerSecond = 50): Promise<number[]>
```

Web Audio ka `decodeAudioData`, phir har khaane ka RMS, phir sabse bade par
normalize.

⚠️ Normalize zaroori hai: dheemi TTS par bina normalize ke poora envelope
threshold se neeche reh jaata hai aur muh kabhi khulta hi nahi.

- [ ] **Step 2: Commit**

---

## Task 10: Naya tab

**Files:**
- Create: `studio/components/editor/panels/TalkingPhotoPanel.tsx`
- Modify: `studio/components/editor/panels/index.tsx` (ek entry)

- [ ] **Step 1: Panel**

Andar: tasveer chuno (`AssetPicker`), text likho, emotion chuno (`EMOTIONS` par
map), awaaz banao (wahi TTS raasta jo `VoiceGenerate` istemal karta hai), aur
"Bana do".

⚠️ Chehra na mile to **saaf mana**, wahi tarika jo `checkUploadSize` ka hai.

⚠️ TTS **2.5 par hi** — 3.1 ek call par ~₹44 leta hai, 2.5 ~₹0.17.

- [ ] **Step 2: Registry me entry**

```ts
  {
    id: "talking-photo",
    label: "Bolti Tasveer",
    icon: Mic,
    component: TalkingPhotoPanel,
  },
```

- [ ] **Step 3: Commit**

---

## Task 11: Panel se doc tak

**Files:**
- Modify: `studio/components/editor/panels/TalkingPhotoPanel.tsx`

- [ ] **Step 1: Jodo**

Detect → TTS → envelope → `visemesFromText` → `buildVisemeTrack` → ek scene +
do item (talking photo + audio) `applyOp` se.

⚠️ Ek hi `applyOp` — poora scene ek baar me, taaki `Ctrl+Z` ek hi baar me sab
wapas kare. Wahi wajah jo wizard ki hai.

- [ ] **Step 2: Commit**

---

## Task 12: Poora chakkar

- [ ] **Step 1: Sab checks**

```bash
npm run check --workspace @reel/core
npm run typecheck --workspace @reel/core
npm run typecheck --workspace @reel/studio
npm run typecheck --workspace @reel/remotion
npm run check --workspace @reel/studio
npm run build --workspace @reel/studio
```

Expected: sab saaf. **Purane 254 core checks me se ek bhi na toote.**

- [ ] **Step 2: Purana kuch nahi toota**

Ek purani reel wizard se banao aur export karo — bilkul pehle jaisi banni
chahiye.

- [ ] **Step 3: Naya chalao**

Tasveer + text + emotion → clip bane → export → MP4 me muh chalta dikhe.

---

## Self-review notes

- **Spec ka har hissa:** aath shape → Task 2; text→shape → Task 2; envelope se
  timing aur dono ka jodna → Task 3; emotion registry → Task 4; landmarks +
  model file repo me → Task 8; mesh warp → Task 1 (ganit) + 5 (mesh) + 7
  (render); SVG-not-canvas → Task 1, 7; chehra na mile to mana → Task 8, 10;
  asset meta me jama → Task 8; palak/sway → Task 7; schema sakht → Task 6;
  worker me kuch nahi → koi task nahi (jaan-boojhkar).
- **Naam har jagah ek jaise:** `VISEME_SHAPES`, `getVisemeShape`,
  `visemesFromText`, `buildVisemeTrack`, `EMOTIONS`, `getEmotion`, `FaceData`,
  `readFaceData`, `buildMouthMesh`, `affineFromTriangles`, `TalkingPhotoSchema`,
  `talkingPhoto`, `TalkingPhotoItem`, `detectFace`, `audioEnvelope`.
- **Task 1 ek darwaza hai.** Wo fail hua to plan yahin rukta hai aur raasta
  badalta hai — ye us task me saaf likha hai.
- Task 5, 8 aur 10 me code poora nahi likha hai (mesh ka ganit, MediaPipe ke
  index, aur panel ka UI) — kyunki teenon me asli naap chala kar dekhna padta
  hai, aur andaaze se likha hua code yahan galat hone par chup-chaap galat
  dikhta. Un teenon me "chala kar verify karo" saaf likha hai.
