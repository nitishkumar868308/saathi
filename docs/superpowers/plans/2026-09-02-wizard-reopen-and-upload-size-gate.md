# Wizard me dobara kholo + naap ki rok — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Renders panel se bane hue video ko wizard me wapas kholna (uske apne chunav ke saath), aur galat naap ki file ko upload se **pehle** rokna — exact naap batate hue.

**Architecture:** Wizard ka draft `doc.meta.wizard` me jama hota hai (likhta `applyWizard` khud hai). Har render job doc ka frozen snapshot pehle se rakhta hai, isliye draft us video ke saath apne aap freeze ho jaata hai — koi naya column, koi migration nahi. Naap ki rok `planFit` ke maujooda hisaab par chalti hai aur browser probe ke turant baad lagti hai, PUT se pehle.

**Tech Stack:** TypeScript, zod, Next.js 14 (app router), React 18, zustand. Repo me koi test runner nahi hai — jaanch ka tarika `check-*.ts` scripts hain (`npm run check --workspace @reel/core`).

---

## File Structure

**Naye:**
- `packages/reel-core/src/wizard/memory.ts` — wizard ki yaadgaar: banana, padhna, aur purane draft ko seedha karna. Pure TS, koi React/fetch nahi.
- `packages/reel-core/src/media/uploadSize.ts` — upload par naap ki rok ka faisla. Pure TS.
- `studio/app/api/render/[id]/wizard/route.ts` — job ke frozen doc me se sirf yaadgaar lautata hai.

**Badalne wale:**
- `packages/reel-core/src/schema/project.ts:731` — `MetaSchema` me `wizard` khaana.
- `packages/reel-core/src/wizard/draft.ts` (`applyWizard` ka ant, ~line 2255) — yaadgaar likhe.
- `packages/reel-core/src/index.ts` — do naye module export.
- `packages/reel-core/scripts/check-wizard.ts` — nayi jaanchein.
- `studio/lib/renders.ts:90` — `createRenderJob` job ke `meta` me `hasWizard` likhe.
- `studio/lib/store.tsx` — wizard kholne ki farmaaish store me.
- `studio/components/editor/Editor.tsx` — `WizardModal` yahan se chale (`ShortcutsDialog` ki tarah).
- `studio/components/editor/panels/AiPanel.tsx` — apna local state chhod kar store se chale.
- `studio/components/editor/wizard/WizardModal.tsx` — bane hue draft se bhi khule.
- `studio/components/editor/panels/RendersPanel.tsx` — "Wizard" button.
- `studio/lib/assetMeta.ts` — `has(assetId)`.
- `studio/lib/upload/uploader.ts` — naap ki rok.
- `studio/app/api/assets/[id]/complete/route.ts` — wahi rok server par.
- `studio/components/media/MediaPanel.tsx`, `studio/components/editor/scenes/AssetPicker.tsx` — uploader ko frame dena.

---

## Task 1: Wizard ki yaadgaar — banana aur padhna

**Files:**
- Create: `packages/reel-core/src/wizard/memory.ts`
- Modify: `packages/reel-core/src/index.ts`
- Test: `packages/reel-core/scripts/check-wizard.ts`

- [ ] **Step 1: `memory.ts` likho**

```ts
import type { WizardDraft } from "./draft";

/**
 * Wizard ki yaadgaar — bani hui reel ke saath uske chunav ("Wizard me kholo").
 *
 * ⚠️ `applyWizard` **ek taraf** chalta hai: draft → doc. Doc me sirf nateeja
 * bachta hai; awaaz ki category, video ka trim, volume points, hataye hue scene,
 * aur asli file aur uski fit ki hui copy ka farak — inme se kuch bhi doc me
 * likha nahi jaata. Isliye doc se draft *wapas* banana andaaza hota, hisaab
 * nahi: ek hi doc se do alag draft nikal sakte hain aur unme se kaunsa sach hai
 * iska koi jawab nahi hota. Wo andaaza aadmi ko uski apni reel me galat chunav
 * dikhata, aur wo galti sirf reel dobara bana kar pakdi jaati.
 *
 * Isliye draft **jama** kiya jaata hai, dobara nikala nahi jaata.
 */

export const WIZARD_MEMORY_VERSION = 1;

export interface WizardMemory {
  version: number;
  draft: WizardDraft;
  /**
   * `applyWizard` ne jo scene banaye the.
   *
   * ⚠️ Iske bina "wizard ke baad haath se badlav hue the ya nahi" ka koi jawab
   * nahi hota — aur wo jawab zaroori hai, kyunki dobara lagane par wo badlav
   * chale jaate hain. Bina bataye unhe mita dena wo galti hai jiski keemat sabse
   * zyada hai.
   */
  appliedSceneIds: string[];
  appliedAt: string;
}

export function writeWizardMemory(args: {
  draft: WizardDraft;
  appliedSceneIds: readonly string[];
}): WizardMemory {
  return {
    version: WIZARD_MEMORY_VERSION,
    draft: args.draft,
    appliedSceneIds: [...args.appliedSceneIds],
    appliedAt: new Date().toISOString(),
  };
}

/**
 * Doc me se yaadgaar padho — **samajh na aaye to `null`**.
 *
 * ⚠️ Yahan zod ka sakht schema jaan-boojhkar nahi hai, aur ye is poore feature ka
 * sabse zaroori faisla hai. Doc ko worker **sakht** parse karta hai
 * (`studio/lib/renders.ts` ka `parseDoc(input.doc)`), aur draft ka shape UI ke
 * saath badalta rehta hai. Sakht schema rakhne par ek purane shape ki yaadgaar
 * poore render ko maar deti — yaani ek suvidha ki wajah se video banna band, aur
 * wajah aisi jagah dikhti jiska is feature se koi lena-dena hi nahi.
 *
 * Isliye doc ke raaste par ye sirf "kuch pada hai" hai. Samajh aaya to button
 * dikhta hai; nahi aaya to nahi dikhta — aur baaki sab waise ka waisa chalta
 * rehta hai.
 */
export function readWizardMemory(value: unknown): WizardMemory | null {
  if (!value || typeof value !== "object") return null;
  const memory = value as Partial<WizardMemory>;

  if (memory.version !== WIZARD_MEMORY_VERSION) return null;
  if (!memory.draft || typeof memory.draft !== "object") return null;
  if (!Array.isArray(memory.draft.scenes)) return null;
  if (!Array.isArray(memory.appliedSceneIds)) return null;
  if (typeof memory.appliedAt !== "string") return null;

  return {
    version: memory.version,
    draft: memory.draft as WizardDraft,
    appliedSceneIds: memory.appliedSceneIds.filter(
      (id): id is string => typeof id === "string",
    ),
    appliedAt: memory.appliedAt,
  };
}
```

- [ ] **Step 2: `index.ts` me export jodo**

`packages/reel-core/src/index.ts` me `export * from "./wizard/draft";` ke theek neeche:

```ts
export * from "./wizard/memory";
```

- [ ] **Step 3: Jaanch likho**

`packages/reel-core/scripts/check-wizard.ts` ke import block me ye naam jodo
(`draftFromScript` ke aas-paas — wahi list hai):

```ts
  readWizardMemory,
  writeWizardMemory,
```

Aur file ke ant me, `console.log(`\n${passed} ok, ...`)` wali line se **UPAR**
(⚠️ us line ke neeche likhi hui jaanch ginti me nahi aati — us file me iski
wajah likhi hui hai):

```ts
console.log("\nwizard ki yaadgaar");

const memoryDraft = draftFromScript(script);
const memory = writeWizardMemory({ draft: memoryDraft, appliedSceneIds: ["sc_1", "sc_2"] });

check("bani hui yaadgaar wapas padhi jaati hai", readWizardMemory(memory) !== null);
check(
  "draft jaisa ka waisa aata hai",
  readWizardMemory(memory)?.draft.scenes.length === memoryDraft.scenes.length,
);
check("null par null", readWizardMemory(null) === null);
check("kachra par null", readWizardMemory({ hello: 1 }) === null);
check(
  "purane version par null",
  readWizardMemory({ ...memory, version: 0 }) === null,
  "yahi wo rok hai jo shape badalne par render ko marne se bachati hai",
);
check("bina scenes ke draft par null", readWizardMemory({ ...memory, draft: {} }) === null);
```

⚠️ `script` naam ka `AiScript` us file me pehle se bana hua hai
(`draftFromScript` ki jaanch ke liye). Naam alag nikle to wahi istemal karo jo
wahan pehle se chal raha hai — naya script mat banao.

- [ ] **Step 4: Chalao**

```bash
npm run check --workspace @reel/core
```

Expected: chhe nayi `ok` line, aur ant me `0 fail`.

- [ ] **Step 5: Commit**

```bash
git add packages/reel-core/src/wizard/memory.ts packages/reel-core/src/index.ts packages/reel-core/scripts/check-wizard.ts
git commit -m "feat(core): wizard ki yaadgaar - banana aur dheela padhna"
```

---

## Task 2: `doc.meta.wizard` khaana

**Files:**
- Modify: `packages/reel-core/src/schema/project.ts:731-734`
- Test: `packages/reel-core/scripts/check-wizard.ts`

- [ ] **Step 1: `MetaSchema` badlo**

```ts
export const MetaSchema = z.object({
  createdBy: z.enum(["manual", "ai", "template"]),
  sourceStory: z.string().nullable(),
  /**
   * Wizard ki yaadgaar — samajhne ka kaam `wizard/memory.ts` karta hai.
   *
   * ⚠️ `z.unknown()` jaan-boojhkar hai. Yahan sakht schema rakhne par draft ka
   * shape badalte hi har purana doc parse hona band kar deta — aur doc parse na
   * hone ka matlab **render fail** hai. Ek UI ki suvidha kabhi video banne ke
   * beech me nahi aani chahiye.
   *
   * ⚠️ `optional` hai, isliye purane doc bina badle khulte hain aur
   * `SCHEMA_VERSION` badalne ki koi zaroorat nahi.
   */
  wizard: z.unknown().optional(),
});
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck --workspace @reel/core
```

Expected: koi error nahi.

- [ ] **Step 3: Purane doc abhi bhi khulte hain — jaanch**

`check-wizard.ts` me Task 1 wale block ke neeche:

```ts
check(
  "bina wizard khaane wala purana doc bhi khulta hai",
  parseDoc({
    ...createEmptyProject({ name: "purana" }),
    meta: { createdBy: "manual", sourceStory: null },
  }).meta.wizard === undefined,
  "warna har purana project khulna band ho jaata",
);
```

Import list me `parseDoc` jodo.

⚠️ `createEmptyProject(...)` ka signature us file me pehle se chal raha hai —
wahi shakal copy karo, apni mat banao.

- [ ] **Step 4: Chalao**

```bash
npm run check --workspace @reel/core
```

Expected: `0 fail`.

- [ ] **Step 5: Commit**

```bash
git add packages/reel-core/src/schema/project.ts packages/reel-core/scripts/check-wizard.ts
git commit -m "feat(core): doc.meta me wizard ki yaadgaar ka khaana (dheela parse)"
```

---

## Task 3: `applyWizard` yaadgaar likhe

**Files:**
- Modify: `packages/reel-core/src/wizard/draft.ts` (`applyWizard` ka ant)
- Test: `packages/reel-core/scripts/check-wizard.ts`

- [ ] **Step 1: Jaanch pehle likho (fail honi chahiye)**

```ts
console.log("\nyaadgaar apply ke saath jama hoti hai");

const memoryProject = createEmptyProject({ name: "yaadgaar" });
const memoryApplied = applyWizard({
  doc: memoryProject,
  draft: autoFill(draftFromScript(script)),
});
const savedMemory = readWizardMemory(memoryApplied.doc.meta.wizard);

check("apply ke baad doc me yaadgaar hai", savedMemory !== null);
check(
  "usme utne hi scene hain jitne draft me the",
  savedMemory?.draft.scenes.length === draftFromScript(script).scenes.length,
);
check(
  "bane hue scene ki id yaad hain",
  savedMemory?.appliedSceneIds.length === Object.keys(memoryApplied.sceneIndexById).length,
  "inke bina 'haath se badlav hue the' ka koi jawab nahi hota",
);
```

- [ ] **Step 2: Chalao aur fail hote dekho**

```bash
npm run check --workspace @reel/core
```

Expected: `FAIL apply ke baad doc me yaadgaar hai` (aur baaki do bhi FAIL).

- [ ] **Step 3: `applyWizard` me likho**

`packages/reel-core/src/wizard/draft.ts` me file ke upar import jodo:

```ts
import { writeWizardMemory } from "./memory";
```

Aur `applyWizard` ke aakhri `return {` se **theek pehle** (jahan `lastFrame`
wala `if` block khatam hota hai):

```ts
  /*
   * Wizard ka apna draft doc ke saath jama — "Wizard me kholo" ka poora aadhaar.
   *
   * ⚠️ Ye yahan hai, UI me nahi, aur wo jaan-boojhkar hai. Doc yahi function
   * banata hai; yaad bhi yahi rakhega. Dono jagah alag rakhne par ek din wo alag
   * ho jaate hain — doc me kuch aur hota aur yaadgaar kuch aur kehti — aur wo
   * farak sirf wizard dobara khol kar pakda jaata.
   *
   * ⚠️ Har render job doc ka frozen snapshot rakhta hai, isliye ye yaadgaar us
   * video ke saath apne aap jam jaati hai. Alag column banane ki zaroorat isi
   * wajah se nahi padi.
   */
  doc = {
    ...doc,
    meta: {
      ...doc.meta,
      wizard: writeWizardMemory({
        draft: args.draft,
        appliedSceneIds: Object.keys(sceneIndexById),
      }),
    },
  };

  return {
```

- [ ] **Step 4: Chalao**

```bash
npm run check --workspace @reel/core
```

Expected: teeno nayi line `ok`, `0 fail`.

- [ ] **Step 5: Commit**

```bash
git add packages/reel-core/src/wizard/draft.ts packages/reel-core/scripts/check-wizard.ts
git commit -m "feat(core): applyWizard apna draft doc ke saath jama karta hai"
```

---

## Task 4: Purane draft ko seedha karna (`rehydrateDraft`)

**Files:**
- Modify: `packages/reel-core/src/wizard/memory.ts`
- Test: `packages/reel-core/scripts/check-wizard.ts`

- [ ] **Step 1: Jaanch pehle likho**

```ts
console.log("\npurana draft seedha karna");

const oldMemory = writeWizardMemory({
  draft: autoFill(draftFromScript(script)),
  appliedSceneIds: ["sc_1", "sc_2"],
});
oldMemory.draft.scenes[0]!.voiceAssetId = "gayab_awaaz";
oldMemory.draft.scenes[0]!.voiceSeconds = 4;
oldMemory.draft.scenes[0]!.visualAssetId = "gayab_tasveer";
oldMemory.draft.musicAssetId = "gayab_music";
const firstIndex = oldMemory.draft.scenes[0]!.index;

const fresh = rehydrateDraft({
  memory: oldMemory,
  assetExists: () => false,
  docSceneIds: ["sc_1", "sc_2"],
});

check("gayab awaaz hata di jaati hai", fresh.draft.scenes[0]!.voiceAssetId === null);
check("uski lambai bhi", fresh.draft.scenes[0]!.voiceSeconds === null);
check("gayab tasveer hata di jaati hai", fresh.draft.scenes[0]!.visualAssetId === null);
check("gayab music hata diya jaata hai", fresh.draft.musicAssetId === null);
check("kaunse scene ki awaaz gayi wo bataya jaata hai", fresh.lostVoice.includes(firstIndex));
check("kaunse scene ki tasveer gayi wo bhi", fresh.lostVisual.includes(firstIndex));
check("wahi scene id hon to haath ka badlav nahi", fresh.handEdited === false);
check(
  "scene id badle hon to haath ka badlav pakda jaata hai",
  rehydrateDraft({ memory: oldMemory, assetExists: () => true, docSceneIds: ["sc_1"] })
    .handEdited === true,
);
check(
  "dobara kholne par hamesha 'purane hata kar'",
  fresh.draft.replaceExisting === true,
  "warna dobara lagne par reel do guni lambi ho jaati",
);
check(
  "maujood asset chhue nahi jaate",
  rehydrateDraft({ memory: oldMemory, assetExists: () => true, docSceneIds: ["sc_1", "sc_2"] })
    .draft.scenes[0]!.voiceAssetId === "gayab_awaaz",
);
```

Import list me `rehydrateDraft` jodo.

- [ ] **Step 2: Chalao aur fail hote dekho**

```bash
npm run check --workspace @reel/core
```

Expected: `rehydrateDraft` export na hone ki error.

- [ ] **Step 3: `memory.ts` me `rehydrateDraft` likho**

```ts
export interface RehydratedDraft {
  draft: WizardDraft;
  /** Jin scene ki awaaz ab maujood nahi (scene ka `index`). */
  lostVoice: number[];
  /** Jin scene ki tasveer/video ab maujood nahi (scene ka `index`). */
  lostVisual: number[];
  /** Wizard ke baad us doc me haath se badlav hue the? */
  handEdited: boolean;
}

/**
 * Purani yaadgaar ko aaj ke haal par bithao.
 *
 * ⚠️ TTS ki awaaz `temporary` hoti hai aur cleanup use utha leta hai. Gayab
 * asset ko chup-chaap chhod dene par wizard "awaaz hai" dikhata aur reel me us
 * jagah **chuppi** aati — aur wo galti sirf reel sun kar pakdi jaati hai, yaani
 * sabse mehngi jagah par. Isliye jo nahi hai use saaf hata diya jaata hai, aur
 * kaunsa gaya wo bataya jaata hai.
 */
export function rehydrateDraft(args: {
  memory: WizardMemory;
  /** Ye asset ab bhi maujood hai? */
  assetExists(assetId: string): boolean;
  /** Us doc me abhi jo scene hain. */
  docSceneIds: readonly string[];
}): RehydratedDraft {
  const lostVoice: number[] = [];
  const lostVisual: number[] = [];

  const scenes = args.memory.draft.scenes.map((scene) => {
    let next = scene;

    if (next.voiceAssetId && !args.assetExists(next.voiceAssetId)) {
      lostVoice.push(next.index);
      next = { ...next, voiceAssetId: null, voiceSeconds: null, voiceTrim: null };
    }

    /*
     * Fit ki hui copy pehle dekhi jaati hai, asli file uske baad — kyunki asli
     * file ke jaane par uski fit bhi bekaar ho jaati hai, par ulta sach nahi
     * hai: fit ki copy hat sakti hai aur asli file bachi reh sakti hai (tab wo
     * dobara ban jaayegi).
     */
    if (next.visualFitAssetId && !args.assetExists(next.visualFitAssetId)) {
      next = { ...next, visualFitAssetId: null, visualFitKey: null };
    }

    if (next.visualAssetId && !args.assetExists(next.visualAssetId)) {
      lostVisual.push(next.index);
      next = {
        ...next,
        visualAssetId: null,
        visualAssetKind: null,
        visualSize: null,
        visualTrim: null,
        visualFitAssetId: null,
        visualFitKey: null,
      };
    }

    if (next.backgroundAssetId && !args.assetExists(next.backgroundAssetId)) {
      next = { ...next, backgroundAssetId: null };
    }

    return next;
  });

  const musicAssetId =
    args.memory.draft.musicAssetId && !args.assetExists(args.memory.draft.musicAssetId)
      ? null
      : args.memory.draft.musicAssetId;

  const applied = [...args.memory.appliedSceneIds].sort();
  const current = [...args.docSceneIds].sort();
  const handEdited =
    applied.length !== current.length || applied.some((id, at) => id !== current[at]);

  return {
    draft: {
      ...args.memory.draft,
      scenes,
      musicAssetId,
      /*
       * ⚠️ Dobara kholne par **hamesha** "purane hata kar", chahe pichhli baar
       * kuch bhi chuna gaya ho. Aadmi ki niyat "is reel ko sudhaarna" hai, "is
       * reel ko maujooda project me jodna" nahi. Jodne par reel do guni lambi
       * ban jaati hai jisme pehle aadhe scene purane hote hain — aur wo galti
       * export ke baad hi dikhti hai.
       *
       * Chunav phir bhi wizard me saamne rehta hai, isliye jise sach me jodna ho
       * wo badal sakta hai.
       */
      replaceExisting: true,
    },
    lostVoice,
    lostVisual,
    handEdited,
  };
}
```

- [ ] **Step 4: Chalao**

```bash
npm run check --workspace @reel/core
```

Expected: sab nayi line `ok`, `0 fail`.

- [ ] **Step 5: Commit**

```bash
git add packages/reel-core/src/wizard/memory.ts packages/reel-core/scripts/check-wizard.ts
git commit -m "feat(core): purani wizard yaadgaar ko aaj ke haal par bithao"
```

---

## Task 5: Upload par naap ki rok ka faisla (core)

**Files:**
- Create: `packages/reel-core/src/media/uploadSize.ts`
- Modify: `packages/reel-core/src/index.ts`
- Test: `packages/reel-core/scripts/check-wizard.ts`

- [ ] **Step 1: Jaanch pehle likho**

```ts
console.log("\nupload par naap ki rok");

const reelFrame = { width: 1080, height: 1920 };

const tooSmall = checkUploadSize({
  filename: "chhoti.jpg",
  hasPixels: true,
  source: { width: 540, height: 960 },
  frame: reelFrame,
});
check("aadhi naap ki tasveer rukti hai", tooSmall.ok === false);
check(
  "exact naap bataya jaata hai",
  tooSmall.required?.width === 1080 && tooSmall.required?.height === 1920,
);
check("message me dono naap hain", (tooSmall.message ?? "").includes("1080x1920"));

check(
  "landscape footage rukta NAHI",
  checkUploadSize({
    filename: "wide.mp4",
    hasPixels: true,
    source: { width: 1920, height: 1080 },
    frame: reelFrame,
  }).ok === true,
  "wo contain + dhundhle kinare se baithta hai - rok pixel ki kami par hai, aspect par nahi",
);

check(
  "poore naap ki tasveer nikal jaati hai",
  checkUploadSize({ filename: "theek.jpg", hasPixels: true, source: reelFrame, frame: reelFrame })
    .ok === true,
);

check(
  "audio par rok lagti hi nahi",
  checkUploadSize({ filename: "gaana.mp3", hasPixels: false, source: null, frame: reelFrame })
    .ok === true,
);

check(
  "naap pata na ho to rok nahi",
  checkUploadSize({ filename: "ajeeb.mkv", hasPixels: true, source: null, frame: reelFrame })
    .ok === true,
  "bina naap ke mana karna andaaza hoga, aur wo sahi file ko rok deta",
);

check(
  "frame na ho to rok nahi",
  checkUploadSize({
    filename: "koi.jpg",
    hasPixels: true,
    source: { width: 100, height: 100 },
    frame: null,
  }).ok === true,
);
```

Import list me `checkUploadSize` jodo.

- [ ] **Step 2: Chalao aur fail hote dekho**

```bash
npm run check --workspace @reel/core
```

Expected: `checkUploadSize` export na hone ki error.

- [ ] **Step 3: `uploadSize.ts` likho**

```ts
import { MAX_CLEAN_UPSCALE, planFit, type FitSize } from "./fitPlan";

/**
 * Ye file reel me kaam aayegi ya nahi — **upload se pehle** (naap ki rok).
 *
 * ⚠️ Ye jaanch abhi tak **baad me** hoti thi: wizard me tasveer chunte waqt
 * (`requiredVisualSize`), ya export ke validator me. Dono jagah sach to batati
 * thi, par tab tak bytes storage par ja chuke hote the. Ek 480p tasveer jo reel
 * me kabhi kaam aa hi nahi sakti, wo bhi hamesha ke liye jagah ghere baithi
 * rehti hai — aur us jagah ka bojh baaki sab par dikhta hai.
 *
 * ⚠️ **Rok pixel ki kami par hai, aspect par nahi.** 1920x1080 ka landscape
 * video 1080x1920 ki reel me bilkul chalega — wo contain + apne hi dhundhle roop
 * se baithta hai, aur wo ek chuna hua raasta hai (`CONTAIN_BACKGROUNDS` ka
 * `blurred-asset`). Use rok dena aadmi ki sahi footage ko mana karna hota.
 * Rukti sirf wo file hai jo *kisi bhi* tarah bithane par phail kar dhundhli
 * hogi.
 *
 * ⚠️ Zoom ka hisaab yahan **nahi** lagta. Upload ke waqt ye pata hi nahi hota ki
 * us file par kaunsi harkat lagegi, aur sabse bade zoom ko maan kar rok lagana
 * un tasveeron ko bhi mana kar deta jo bina harkat ke bilkul theek hain. Zoom
 * wali chetavni scene par pehle se hai.
 */

export interface UploadSizeVerdict {
  ok: boolean;
  /** Kam se kam itna naap chahiye — `null` jab rok lagti hi nahi. */
  required: FitSize | null;
  /** Kitna phailna padega (1 = bilkul nahi). */
  upscale: number;
  message: string | null;
}

export function checkUploadSize(args: {
  filename: string;
  /** Is kism ke pixels hote hain? (`AssetKindEntry.hasPixels`) */
  hasPixels: boolean;
  /** File ka apna naap — `null` = pata nahi. */
  source: FitSize | null;
  /** Project ka frame — `null` = pata nahi. */
  frame: FitSize | null;
}): UploadSizeVerdict {
  const pass: UploadSizeVerdict = { ok: true, required: null, upscale: 1, message: null };

  if (!args.hasPixels) return pass;
  if (!args.frame || args.frame.width <= 0 || args.frame.height <= 0) return pass;
  if (!args.source || args.source.width <= 0 || args.source.height <= 0) return pass;

  const plan = planFit({ source: args.source, frame: args.frame, animationPresetId: null });
  if (!plan) return pass;
  if (plan.upscale <= MAX_CLEAN_UPSCALE) return { ...pass, upscale: plan.upscale };

  /*
   * Jis naap par phailna 1x ho jaata hai — yaani "itna chahiye". Ye wahi hisaab
   * hai jo `checkUpscale` ka `requiredSource` deta hai. Do jagah do alag number
   * dikhne par aadmi dono par bharosa kho deta hai.
   */
  const required: FitSize = {
    width: Math.ceil(args.source.width * plan.upscale),
    height: Math.ceil(args.source.height * plan.upscale),
  };

  return {
    ok: false,
    required,
    upscale: plan.upscale,
    message:
      `"${args.filename}" ${args.source.width}x${args.source.height} ka hai. ` +
      `${args.frame.width}x${args.frame.height} ki reel me ye ${plan.upscale.toFixed(1)}x phailegi — ` +
      `kam se kam ${required.width}x${required.height} chahiye. Isse chhoti file dhundhli aayegi.`,
  };
}
```

- [ ] **Step 4: `index.ts` me export jodo**

`export * from "./media/fitPlan";` ke neeche:

```ts
export * from "./media/uploadSize";
```

- [ ] **Step 5: Chalao**

```bash
npm run check --workspace @reel/core && npm run typecheck --workspace @reel/core
```

Expected: sab nayi line `ok`, `0 fail`, typecheck saaf.

- [ ] **Step 6: Commit**

```bash
git add packages/reel-core/src/media/uploadSize.ts packages/reel-core/src/index.ts packages/reel-core/scripts/check-wizard.ts
git commit -m "feat(core): upload se pehle naap ki rok, exact naap ke saath"
```

---

## Task 6: Job ke saath ek sasta nishaan (`meta.hasWizard`)

**Files:**
- Modify: `studio/lib/renders.ts:1` (import) aur `:90-103` (`createRenderJob`)

**Kyun:** job ki list me `doc` kabhi nahi aata (100KB+, `JOB_FIELDS` dekho).
Button dikhana hai ya nahi — ye faisla list se hi ho jaana chahiye, warna har row
ke liye ek poora doc padhna padta.

- [ ] **Step 1: Import badlo**

```ts
import { parseDoc, readWizardMemory, type Doc } from "@reel/core";
```

- [ ] **Step 2: `createRenderJob` me nishaan**

`body` ke andar, `doc:` ke neeche:

```ts
      /*
       * ⚠️ Ek sasta nishaan, taaki "Wizard me kholo" dikhane ke liye poora doc na
       * padhna pade. Job ki list me `doc` jaan-boojhkar nahi aata, aur har row par
       * ek doc padhna matlab renders panel kholte hi kai sau KB.
       *
       * ⚠️ Worker apna `meta` likhte waqt `...job.meta` phailata hai
       * (`worker/src/index.ts`), isliye ye render poora hone ke baad bhi bacha
       * rehta hai — aur zaroorat theek usi waqt padti hai.
       */
      meta: { hasWizard: readWizardMemory(input.doc.meta.wizard) !== null },
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck --workspace @reel/studio
```

Expected: koi error nahi.

- [ ] **Step 4: Commit**

```bash
git add studio/lib/renders.ts
git commit -m "feat(studio): render job ke meta me hasWizard ka nishaan"
```

---

## Task 7: `GET /api/render/[id]/wizard`

**Files:**
- Create: `studio/app/api/render/[id]/wizard/route.ts`

- [ ] **Step 1: Route likho**

```ts
import { readWizardMemory } from "@reel/core";

import { fail, handle, ok } from "@/lib/api";
import { getRenderJobDoc } from "@/lib/renders";

/**
 * `GET /api/render/[id]/wizard` — is video ke wizard ka draft.
 *
 * ⚠️ Poora doc **kabhi nahi** jaata, sirf yaadgaar aur scene ki id. Doc 100KB+ ka
 * hota hai; use browser tak bhejna sirf isliye ki usme se do cheezein chahiye
 * thi, wo har baar wizard kholne par ek bekaar ka bojh hai — `renders.ts` me isi
 * wajah se list me bhi `doc` nahi aata.
 *
 * ⚠️ Job ka doc **frozen** hai (export ke waqt ka). Yahi is feature ka poora
 * aadhaar hai: project uske baad kitna bhi badal chuka ho, us video ke apne
 * chunav yahin surakshit hain.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: { id: string };
}

export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  return handle(async () => {
    const doc = await getRenderJobDoc(context.params.id);
    if (!doc) return fail("not found", 404, "aisi koi render job nahi hai");

    const memory = readWizardMemory(doc.meta.wizard);
    if (!memory) {
      return fail(
        "wizard ki yaad nahi hai",
        404,
        "ye reel wizard se nahi bani thi (ya us waqt ye jaankari jama hoti hi nahi thi).",
      );
    }

    return ok({ memory, docSceneIds: doc.scenes.map((scene) => scene.id) });
  });
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck --workspace @reel/studio
```

Expected: koi error nahi.

- [ ] **Step 3: Commit**

```bash
git add "studio/app/api/render/[id]/wizard/route.ts"
git commit -m "feat(studio): render job se wizard ka draft dene wala route"
```

---

## Task 8: Wizard kholne ki farmaaish store me

**Files:**
- Modify: `studio/lib/store.tsx` (type, state ~line 140, initial ~line 402, actions ~line 555)
- Modify: `studio/components/editor/Editor.tsx`
- Modify: `studio/components/editor/panels/AiPanel.tsx`

**Kyun:** abhi `WizardModal` `AiPanel` ke andar rehta hai aur uska khulna
`AiPanel` ke local `useState` me hai. Renders panel ek **doosra** panel hai — wo
us state tak pahunch hi nahi sakta. `ShortcutsDialog` isi dikkat ka hal pehle se
dikhata hai: state store me, modal `Editor.tsx` me.

⚠️ Ye task akela build nahi hota — Task 9 ke saath poora hota hai. Commit dono ke
baad ek saath.

- [ ] **Step 1: `store.tsx` me type**

Imports ke paas:

```ts
import type { AiScript, WizardDraft } from "@reel/core";

export interface WizardRequest {
  /** Har farmaaish par naya — `WizardModal` isi par remount hota hai. */
  key: number;
  /** AI se aayi script — `null` jab draft se khul raha ho. */
  script: AiScript | null;
  /** Bani hui reel ka draft — `null` jab script se khul raha ho. */
  draft: WizardDraft | null;
  /** Modal me sabse upar dikhne wali baat (kya gaya, kya badlega). */
  note: string | null;
}
```

⚠️ `AiScript` us file me pehle se import ho to dobara mat likho — usi line me
jod do.

- [ ] **Step 2: State field**

`EditorState` me `shortcutsOpen: boolean;` ke neeche:

```ts
  /**
   * Wizard kholne ki farmaaish — `null` = band.
   *
   * ⚠️ Ye store me hai, kisi panel ke `useState` me nahi, aur wo zaroori hai:
   * wizard ab **do** jagah se khulta hai (AI panel se nayi script par, aur
   * Renders panel se bani hui reel par). Ek panel ke andar rehne par doosra
   * panel use kholna to door, uske hone ka pata bhi nahi laga sakta.
   */
  wizardRequest: WizardRequest | null;
```

Actions ki list me (`setShortcutsOpen(open: boolean): void;` ke paas):

```ts
  openWizard(request: Omit<WizardRequest, "key">): void;
  closeWizard(): void;
```

- [ ] **Step 3: Initial value aur implementation**

Initial state me (`shortcutsOpen: false,` ke paas):

```ts
      wizardRequest: null,
```

Implementation me (`setShortcutsOpen` ke paas):

```ts
      openWizard(request) {
        /*
         * ⚠️ `key` har baar naya — `WizardModal` isi par remount hota hai. Iske
         * bina purani farmaaish ka aadha bhara hua draft nayi par bacha reh
         * jaata, aur aadmi ko sirf itna dikhta ki uska chunav maana hi nahi gaya.
         */
        set({ wizardRequest: { ...request, key: Date.now() } });
      },
      closeWizard() {
        set({ wizardRequest: null });
      },
```

- [ ] **Step 4: `Editor.tsx` me modal host karo**

Import jodo:

```ts
import { WizardModal } from "@/components/editor/wizard/WizardModal";
```

Aur **dono** return me (mobile wala ~line 101 aur desktop wala ~line 114),
`<ShortcutsDialog />` ke theek neeche:

```tsx
      {/* Wizard do jagah se khulta hai — isliye modal yahan hai, kisi panel me nahi. */}
      <WizardModal />
```

- [ ] **Step 5: `AiPanel.tsx` ko store par le jao**

1. `import { WizardModal } from "@/components/editor/wizard/WizardModal";` **hatao**.
2. `const [wizardOpen, setWizardOpen] = useState(false);` **hatao**.
3. Store se lo:

```ts
  const openWizard = useEditorStore((state) => state.openWizard);
  const wizardOpen = useEditorStore((state) => state.wizardRequest !== null);
```

4. `generate()` ke ant me jahan `setWizardOpen(true)` tha, wahan:

```ts
  openWizard({ script: nextScript, draft: null, note: null });
```

⚠️ `nextScript` wahi local variable hai jisme abhi-abhi AI ka nateeja aaya hai
(us function me uska jo bhi naam ho, wahi). State wala `script` mat bhejo —
`setScript` us render me abhi laga nahi hota, aur wizard purani script le kar
khul jaata.

5. `<WizardModal ... />` wala poora block (~line 250-262) **hatao**.
6. "Wizard dobara kholo" wale button ka `onClick`:

```tsx
          onClick={() => openWizard({ script, draft: null, note: null })}
```

- [ ] **Step 6: Typecheck (abhi error aana theek hai)**

```bash
npm run typecheck --workspace @reel/studio
```

Expected: sirf `WizardModal` ke props par error (`open`/`script`/`onClose`/
`onDone` ab nahi diye ja rahe). Wo Task 9 me theek hoga. Koi doosri error na ho.

---

## Task 9: `WizardModal` store se chale aur draft se bhi khule

**Files:**
- Modify: `studio/components/editor/wizard/WizardModal.tsx:60-110`

- [ ] **Step 1: Component do hisson me todo**

`export function WizardModal({ open, script, onClose, onDone }: {...}) {` se le
kar `if (!open || !draft) return null;` tak ka poora hissa hata kar ye lagao:

```tsx
export function WizardModal() {
  const request = useEditorStore((state) => state.wizardRequest);
  const closeWizard = useEditorStore((state) => state.closeWizard);

  if (!request) return null;
  return <WizardBody key={request.key} request={request} onClose={closeWizard} />;
}

/**
 * Asli wizard — `key` par remount hota hai.
 *
 * ⚠️ Remount jaan-boojhkar hai. Pehle draft ko nayi script par `useState` ke
 * andar hi badla jaata tha (`seenScript` wala tarika), aur ab do alag raaste hain
 * (nayi script se, aur bani hui reel ke draft se). Un dono ke liye alag "pehle
 * kya dekha tha" rakhne par ek raasta doosre ka aadha bhara draft le kar khulta
 * hai — aur aadmi ko sirf itna dikhta hai ki uska chunav maana hi nahi gaya.
 *
 * ⚠️ `useEffect` yahan bhi nahi — wahi wajah jo pehle likhi thi: effect se karne
 * par ek render ke liye purana draft nayi farmaaish ke saath dikhta hai, aur us
 * ek frame me scene ki ginti alag hoti hai, jo aankh ko jhatka lagta hai.
 */
function WizardBody({
  request,
  onClose,
}: {
  request: WizardRequest;
  onClose(): void;
}) {
  const doc = useEditorStore((state) => state.doc);
  const applyOp = useEditorStore((state) => state.applyOp);

  const [draft, setDraft] = useState<WizardDraft>(
    request.draft ??
      (request.script ? autoFill(draftFromScript(request.script)) : emptyDraft()),
  );
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
```

⚠️ `draft` ab `WizardDraft` hai, `WizardDraft | null` nahi — remount ne uski
zaroorat khatam kar di. Isliye neeche jahan bhi `setDraft((previous) => previous
? ... : previous)` likha hai, wahan `previous` kabhi `null` nahi hota; wo shart
hata kar seedha object lauta do. `update`, `move`, `addScene`, `setGap`,
`setMusic`, `setMusicVolume`, `setVoiceCategory`, `setTextScale`, `setTextColor`,
`setReplaceExisting`, `fillEverything` — sab me.

⚠️ `if (!draft) return;` jaisi shart `apply()` me bhi hai — wo bhi hata do.

Import badlo:

```ts
import { useEditorStore, type WizardRequest } from "@/lib/store";
```

- [ ] **Step 2: `onDone` ki jagah `onClose`**

`apply()` ke ant me jahan `onDone(applied)` tha:

```ts
      onClose();
```

⚠️ `AiPanel` ka "N scene ban gaye" wala sandesh ab nahi dikhega. Uski jagah
`applyOp` ka undo label pehle se maujood hai (`Ctrl+Z se poora wapas`), aur is
kaam ke liye store me ek aur sandesh ka khaana banana scope se bahar hai.
`AiPanel` me `done` wala state aur uska `<p>` ab bekaar hai — dono hata do.

- [ ] **Step 3: `note` dikhao**

Modal ke andar sabse upar, jahan `advice` ki list dikhti hai uske **theek pehle**:

```tsx
      {request.note ? (
        <p className="mb-2 rounded border border-amber/30 bg-amber/10 px-2 py-1.5 text-[11px] leading-snug text-amber">
          {request.note}
        </p>
      ) : null}
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck --workspace @reel/studio
```

Expected: koi error nahi.

- [ ] **Step 5: Haath se dekho**

```bash
npm run dev --workspace @reel/studio
```

Project kholo → AI panel → script banao → wizard pehle jaisa khule. Band karke
"Wizard dobara kholo" dabao → wahi script wapas aaye. "Editor me daalo" chale aur
`Ctrl+Z` se poora wapas ho.

- [ ] **Step 6: Commit (Task 8 + 9)**

```bash
git add studio/lib/store.tsx studio/components/editor/Editor.tsx studio/components/editor/panels/AiPanel.tsx studio/components/editor/wizard/WizardModal.tsx
git commit -m "refactor(studio): wizard ab store se khulta hai, kisi ek panel se nahi"
```

---

## Task 10: "Wizard" button — Renders panel me

**Files:**
- Modify: `studio/lib/assetMeta.ts:104-140`
- Modify: `studio/components/editor/panels/RendersPanel.tsx`

- [ ] **Step 1: `assetMeta` me `has()` jodo**

`AssetMeta` interface me:

```ts
  /** Ye asset ab bhi maujood hai? — purana draft kholte waqt zaroori. */
  has(assetId: string | null): boolean;
```

`useAssetDurations` ke return object me:

```ts
    has(assetId) {
      if (!assetId || !map) return false;
      return map.has(assetId);
    },
```

⚠️ `map === null` (list abhi aayi nahi) par `false` lautana theek hai, kyunki
button tab tak `disabled` rehta hai (Step 3). Yaani "abhi pata nahi" ko "nahi
hai" samajh lene wali halat kabhi aati hi nahi.

- [ ] **Step 2: `RendersPanel` me raasta**

Imports badlo:

```ts
import { formatBytes, readWizardMemory, rehydrateDraft } from "@reel/core";
import { Download, RefreshCw, Wand2, X } from "lucide-react";

import { useAssetDurations } from "@/lib/assetMeta";
```

`RendersPanel` ke andar, baaki hooks ke paas:

```ts
  const doc = useEditorStore((state) => state.doc);
  const openWizard = useEditorStore((state) => state.openWizard);
  const assets = useAssetDurations(doc.project.fps);
```

`download` function ke neeche:

```ts
  /**
   * Bani hui reel ko wizard me wapas kholo.
   *
   * ⚠️ Draft us job ke **frozen doc** se aata hai, maujooda project se nahi —
   * wahi us video ka apna sach hai. Par apply hamesha **maujooda** doc par lagta
   * hai: purana render itihaas hai, use badla nahi ja sakta. Ye baat modal me
   * likhi jaati hai, chhupayi nahi.
   */
  async function openInWizard(jobId: string): Promise<void> {
    const response = await fetch(`/api/render/${jobId}/wizard`);
    const data = (await response.json()) as {
      memory?: unknown;
      docSceneIds?: string[];
      reason?: string;
    };
    if (!response.ok) {
      setError(data.reason ?? "wizard ka draft nahi mila");
      return;
    }

    const memory = readWizardMemory(data.memory);
    if (!memory) {
      setError("is reel ka wizard draft padha nahi ja saka");
      return;
    }

    const fresh = rehydrateDraft({
      memory,
      assetExists: (assetId) => assets.has(assetId),
      docSceneIds: data.docSceneIds ?? [],
    });

    const lines = ["Ye maujooda project par lagega — purana render waise ka waisa rahega."];
    if (fresh.handEdited) {
      lines.push(
        "Is reel me wizard ke baad haath se badlav hue the — dobara lagane par wo nahi aayenge.",
      );
    }
    if (fresh.lostVoice.length > 0) {
      lines.push(
        `${fresh.lostVoice.length} scene ki banayi hui awaaz ab nahi hai (wo apne aap mit jaati hai) — dobara banani padegi.`,
      );
    }
    if (fresh.lostVisual.length > 0) {
      lines.push(`${fresh.lostVisual.length} scene ki file ab nahi hai — dobara chunni padegi.`);
    }

    setError(null);
    openWizard({ script: null, draft: fresh.draft, note: lines.join(" ") });
  }
```

`jobs.map` me `JobRow` ko do naye prop do:

```tsx
              <JobRow
                key={job.id}
                job={job}
                onCancel={cancel}
                onDownload={download}
                onOpenWizard={openInWizard}
                wizardReady={assets.loaded}
              />
```

- [ ] **Step 3: `JobRow` me button**

Signature:

```tsx
function JobRow({
  job,
  onCancel,
  onDownload,
  onOpenWizard,
  wizardReady,
}: {
  job: RenderJob;
  onCancel(jobId: string): Promise<void>;
  onDownload(jobId: string): Promise<void>;
  onOpenWizard(jobId: string): Promise<void>;
  /** Asset ki list aa chuki hai? — uske bina gayab file pehchani nahi ja sakti. */
  wizardReady: boolean;
}) {
```

`meta` ke inline type me jodo:

```ts
    hasWizard?: boolean;
```

Aur Download wale button ke **theek pehle**:

```tsx
        {/*
          ⚠️ Shart `meta.hasWizard` par hai, sirf `completed` par nahi. Purane
          render ke doc me ye jaankari likhi hi nahi gayi thi — un par button
          dikhana matlab ek aisa button jo dabane par hamesha "nahi mila" kehta
          hai, aur wo button na hone se bura hai.
        */}
        {job.status === "completed" && meta.hasWizard ? (
          <Button
            className="px-1.5 py-0.5 text-[11px]"
            icon={<Wand2 size={11} />}
            disabled={!wizardReady}
            title={wizardReady ? "Is reel ko wizard me kholo" : "media ki list aa rahi hai…"}
            onClick={() => void onOpenWizard(job.id)}
          >
            Wizard
          </Button>
        ) : null}
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck --workspace @reel/studio
```

Expected: koi error nahi.

- [ ] **Step 5: Poora raasta haath se dekho**

```bash
npm run dev --workspace @reel/studio
```

1. Wizard se ek reel banao (text + tasveer + awaaz) aur export karo.
2. Render poora hone par Renders panel me us job par **Wizard** button dikhe.
3. Dabao → wizard poora bhara hua khule (wahi text, wahi tasveerein, wahi awaaz
   ka chunav), upar peela note ke saath.
4. Us badlav se **pehle** bane render par button **na** dikhe.

- [ ] **Step 6: Commit**

```bash
git add studio/lib/assetMeta.ts studio/components/editor/panels/RendersPanel.tsx
git commit -m "feat(studio): bani hui reel ko Renders panel se wizard me kholo"
```

---

## Task 11: Naap ki rok — upload se pehle (client)

**Files:**
- Modify: `studio/lib/upload/uploader.ts:3` (import), `:56` (options), `:225` (runTask)
- Modify: `studio/components/media/MediaPanel.tsx:85`
- Modify: `studio/components/editor/scenes/AssetPicker.tsx:165`

- [ ] **Step 1: Import badlo**

```ts
import {
  checkUploadable,
  checkUploadSize,
  sha256HexFromStream,
  type AssetKindEntry,
} from "@reel/core";
```

- [ ] **Step 2: `UseUploaderOptions` me `frame`**

```ts
  /**
   * Project ka frame — naap ki rok isi par tikti hai. `null`/na do = pata nahi,
   * tab rok lagti hi nahi.
   *
   * ⚠️ Ye option se aata hai, store se seedha nahi. `uploader` ek upload ka hook
   * hai; use editor ke store se baandh dene par wo ek aisi jagah se bhi chalta
   * hai jahan koi project khula hi nahi hota.
   */
  frame?: { width: number; height: number } | null;
```

- [ ] **Step 3: `runTask` me rok**

Step 2 (`probeFileInBrowser`) ke **turant baad** aur step 3 (presign) se
**pehle**:

```ts
    /*
     * 2b. Naap ki rok — PUT se PEHLE.
     *
     * ⚠️ Jagah maayne rakhti hai. Ye jaanch pehle **baad me** hoti thi (wizard me
     * tasveer chunte waqt, ya export ke validator me) — sach wahan bhi batati
     * thi, par tab tak bytes storage par ja chuke hote the. Ek 480p tasveer jo
     * reel me kabhi kaam aa hi nahi sakti, wo bhi hamesha ke liye jagah ghere
     * baithi reh jaati thi.
     *
     * Yahan rukne par ek bhi byte nahi jaata.
     */
    const size = checkUploadSize({
      filename: task.file.name,
      hasPixels: task.kind.hasPixels,
      source: probe.width && probe.height ? { width: probe.width, height: probe.height } : null,
      frame: options.frame ?? null,
    });
    if (!size.ok) {
      patch(taskId, { phase: "error", error: size.message });
      return;
    }
```

⚠️ `options` `runTask` ka parameter hai (`optionsRef.current` se aata hai) — wo
pehle se maujood hai.

- [ ] **Step 4: `MediaPanel` frame de**

`useUploader({ ... })` ke andar:

```ts
    frame: { width: doc.project.width, height: doc.project.height },
```

`doc` us component me na ho to:

```ts
  const doc = useEditorStore((state) => state.doc);
```

- [ ] **Step 5: `AssetPicker` frame de**

Wahi line `useUploader({ ... })` me jodo. ⚠️ Us file me project ka naap pehle se
mil raha ho (`project.width` / `project.height` waise hi istemal hota hai) to
wahi use karo — naya hook mat banao.

⚠️ `VoiceRecorder` ko haath mat lagao: wahan sirf awaaz chadhti hai aur
`hasPixels: false` par rok waise bhi nahi lagti, isliye `frame` dena ek bekaar ki
line hoti.

- [ ] **Step 6: Typecheck**

```bash
npm run typecheck --workspace @reel/studio
```

Expected: koi error nahi.

- [ ] **Step 7: Haath se dekho**

```bash
npm run dev --workspace @reel/studio
```

1. 1080x1920 project me 540x960 ki tasveer daalo → upload shuru hi na ho; card
   par exact naap wala sandesh dikhe.
2. 1920x1080 landscape video daalo → **chadhna chahiye**.
3. ek mp3 daalo → chadhna chahiye.

- [ ] **Step 8: Commit**

```bash
git add studio/lib/upload/uploader.ts studio/components/media/MediaPanel.tsx studio/components/editor/scenes/AssetPicker.tsx
git commit -m "feat(studio): chhoti file upload se pehle hi ruk jaati hai, exact naap ke saath"
```

---

## Task 12: Wahi rok server par

**Files:**
- Modify: `studio/app/api/assets/[id]/complete/route.ts`
- Modify: `studio/lib/upload/uploader.ts` (step 5 ki body)

**Kyun:** client par lagi rok soojh-boojh hai, deewar nahi — yahi baat
`checkUploadable` par pehle se likhi hai. Aur ek aur wajah: browser ka bataya naap
galat ho sakta hai (rotation apne aap laga deta hai), jabki probe ka naap asli
hota hai.

- [ ] **Step 1: Import badlo**

```ts
import { assetKindForFile, checkUploadSize } from "@reel/core";
```

- [ ] **Step 2: `CompleteSchema` me `frame`**

```ts
  /**
   * Project ka frame — naap ki rok ke liye.
   *
   * ⚠️ Ye client se aata hai, aur wo theek hai: ye deewar nahi, dohri jaanch hai.
   * Iska asli faayda ye hai ki yahan **probe ka naapa hua** number lagta hai,
   * browser ka andaaza nahi.
   */
  frame: z
    .object({
      width: z.number().int().positive(),
      height: z.number().int().positive(),
    })
    .optional(),
```

- [ ] **Step 3: Probe ke baad rok**

`probeAndThumbnail` wale `try/catch` ke **turant baad**, `return ok(...)` se
pehle:

```ts
    /*
     * Naap ki rok — ab **probe ke naape hue** number par.
     *
     * ⚠️ Yahan tak aane ka matlab hai ki client ki rok chook gayi (purana tab
     * khula tha, ya browser ne galat naap bataya tha — rotation par aisa hota
     * hai). Us halat me file ko rehne dena wahi nuksaan hai jisse ye poora kaam
     * bachne ke liye bana hai: ek aisi file jo reel me kabhi kaam nahi aayegi,
     * hamesha ke liye jagah ghere baithi rehti hai.
     *
     * ⚠️ Row aur file **dono** hatti hain. Sirf ek hataane par doosri anaath reh
     * jaati hai — aur is route par dono taraf ki safai ka raasta pehle se
     * maujood hai.
     */
    const size = checkUploadSize({
      filename,
      hasPixels: kind.hasPixels,
      source: asset.width && asset.height ? { width: asset.width, height: asset.height } : null,
      frame: body.data.frame ?? null,
    });
    if (!size.ok) {
      await deleteAssetRow(asset.id);
      await storage().delete(key);
      return fail("naap kaafi nahi", 422, size.message ?? "ye file is reel ke liye chhoti hai");
    }
```

- [ ] **Step 4: Client frame bheje**

`studio/lib/upload/uploader.ts` ke step 5 (`/complete` wali `postJson`) ki body me:

```ts
      ...(options.frame ? { frame: options.frame } : {}),
```

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck --workspace @reel/studio
```

Expected: koi error nahi.

- [ ] **Step 6: Haath se dekho**

`uploader.ts` ka step 2b wala `if (!size.ok)` block **thodi der ke liye** comment
karo, phir 540x960 ki tasveer daalo. Upload chalega par `complete` par 422 aayega
aur card par wahi exact naap wala sandesh dikhega. Storage me file nahi bachni
chahiye. Jaanch ke baad comment wapas hatao.

- [ ] **Step 7: Commit**

```bash
git add "studio/app/api/assets/[id]/complete/route.ts" studio/lib/upload/uploader.ts
git commit -m "feat(studio): naap ki rok server par bhi, probe ke asli naap se"
```

---

## Task 13: Poora chakkar ek baar

- [ ] **Step 1: Sab checks**

```bash
npm run check --workspace @reel/core
npm run typecheck --workspace @reel/core
npm run typecheck --workspace @reel/studio
npm run check --workspace @reel/studio
```

Expected: chaaron saaf, `0 fail`.

- [ ] **Step 2: Studio build**

```bash
npm run build --workspace @reel/studio
```

Expected: build poora ho.

- [ ] **Step 3: Ek asli reel**

1. Nayi reel wizard se banao (text + tasveer + awaaz).
2. Export karo, render poora hone do.
3. Renders panel → **Wizard** dabao → poora bhara hua wizard khule.
4. Ek scene ka text badlo → "Editor me daalo" → maujooda doc par lage.
5. Ek 480p tasveer daalne ki koshish karo → ruk jaaye, exact naap dikhe.

- [ ] **Step 4: Bacha hua kuch**

```bash
git status
```

Expected: kuch bacha na ho.

---

## Self-review notes

- **Spec ka har hissa dhanka hua hai:** `doc.meta.wizard` khaana → Task 2;
  `applyWizard` likhe → Task 3; dheela parse → Task 1+2; route → Task 7; button →
  Task 10; rehydrate (gayab awaaz/tasveer/fit/music) → Task 4; dono chetavni →
  Task 10 (banata hai) + Task 9 (dikhata hai); purane render par button nahi →
  Task 6+10; core ki jaanch → Task 1, 3, 4, 5; upload ki rok client → Task 11,
  server → Task 12; `MAX_CLEAN_UPSCALE` wahi ek hadd → Task 5.
- **Naam har task me ek jaise:** `readWizardMemory`, `writeWizardMemory`,
  `rehydrateDraft`, `checkUploadSize`, `WizardRequest`, `openWizard`,
  `closeWizard`, `assets.has`, `options.frame`, `meta.hasWizard`.
- Task 8 aur 9 alag se build nahi hote — unka commit ek saath hai, aur ye dono
  task me likha hai.
