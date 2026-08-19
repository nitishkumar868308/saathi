# Phase 1 — Project JSON schema + core types + registries

**STATUS:** COMPLETE (2026-08-19)
**One-line prompt:** `Read docs/reel-studio/README.md, then do Phase 1 of AI Reel Studio.`
**Rules:** README.md ke Standing + Dynamic rules binding. Resume Protocol follow karo.
**Depends on:** Phase 0 complete ✅

**Goal:** poore product ki reedh ki haddi — Project JSON, uska zod schema, time helpers,
timeline ops, aur **registry system**. Sab pure TypeScript, koi React/DOM nahi.
Ye phase theek hua to baaki sab aasan; galat hua to sab dobara likhna padega.

## Checklist

- [x] 1.1 `src/schema/project.ts`: zod schema exactly plan doc (00-architecture) ke format me —
      `version`, `project{id,name,width,height,fps,durationInFrames,background}`, `tracks[]`,
      `items[]`, `scenes[]`, `brand`, `meta`. Timing **integer frames** only (`z.number().int()`).
      → Plus do cheezein jo plan me implied thi: `project.sizePresetId` (Section 3B ke liye),
      aur `item.fit` (fit mode + contain background). Width/height par **even** ka refine
      (yuv420p ki zaroorat). `DocSchema.superRefine` referential integrity check karta hai —
      toota `trackId` / `sceneId` / duplicate id sab yahin pakde jaate hain.
- [x] 1.2 Types schema se infer karo (`z.infer`) — types haath se dobara mat likho.
      → Saare 20 types `z.infer` se. Ek bhi haath se likha type nahi.
- [x] 1.3 `src/schema/migrate.ts`: `migrateDoc(unknown) -> Doc`. v1 identity migration +
      migration chain ka pattern (aage v2 add karna ek line ka kaam ho).
      → `MIGRATIONS` array khaali hai (v1 hi pehla hai); chain loop maujood hai.
      Aage ka version (99) **reject** hota hai — chupchaap kholne se naye fields gir jaate
      aur save karte hi user ka kaam kho jaata.
- [x] 1.4 `src/schema/factory.ts`: `createEmptyProject({name, preset})`,
      `createItem(typeId, partial)`, `createTrack(typeId, partial)` — defaults **registry** se
      aate hain, hardcode nahi.
      → `createItem` ka partial **nested** hai (`{ text: { content: "Namaste" } }`), isliye
      call sites ko defaults dobara nahi likhne padte.
- [x] 1.5 `src/config/presets.ts`: README section 3B ki poori size list data ke roop me.
      → 8 presets (reel default, square, portrait, landscape, 1440p, 4K, classic, custom),
      fps 24/25/30/50/60 (default 30), `normalizeDimension` even enforce karta hai.
      Code me ek bhi 1080/1920/30 hardcoded nahi.
- [x] 1.5b `src/config/fit.ts`: fit modes + contain-background options + `computeFit()`.
      → `computeFit` / `checkUpscale` (Section 3A ka upscale rule, zoom keyframe ko bhi
      ginta hai) / `suggestFit` (16:9 → 9:16 par khud salah deta hai) /
      `AUTO_FIT_ACTIONS` (6 buttons, list hai — hardcoded buttons nahi).
      **Render contract** file ke top par likha hai: total scale = fit.scale x transform.scale.
- [x] 1.6 `src/time.ts`: `framesToSeconds`, `secondsToFrames`, `framesToTimecode`,
      `snapFrame`, `clampFrame`. Poore repo me `/ fps` sirf yahin.
      → Verified: `grep -rn "/ *fps\|/ *30" packages/reel-core/src` — asli code sirf
      `time.ts:20` (`frames / fps`) aur `time.ts:54` me hai; baaki 3 hits comments hain
      (`presets.ts` ka doc-block). `* fps` bhi sirf `time.ts` ke `secondsToFrames` me.
- [x] 1.7 `src/registry/types.ts`: registry entry ka shape + `controls` declarative descriptor.
      → `ControlDescriptor` me `path`, `control`, `label`, `group`, `min/max/step`, `options`,
      `when` (conditional visibility — declarative, code nahi), `keyframable`.
- [x] 1.8 `src/registry/itemTypes.ts`: `image`, `video`, `audio`, `text`, `shape`.
      → Har entry me `componentKey` string (Phase 3 me component judega), per-type zod schema,
      controls, aur keyframable paths.
- [x] 1.9 `src/registry/trackTypes.ts`: video, image, text, audio, music, overlay, subtitle.
      → 7 **kism**, 7 tracks nahi. `DEFAULT_INITIAL_TRACK_TYPES` sirf 2 hai (video + audio).
- [x] 1.10 `src/registry/index.ts`: `registerItemType()`, `getItemType(id)`, `listItemTypes()`
      + khaali `TRANSITIONS`, `EFFECTS`, `ANIMATIONS`, `SCENE_TYPES`, `EXPORT_PRESETS`,
      `VALIDATION_RULES`.
      → `registerBuiltins()` idempotent function hai — import ke side-effect par bharosa nahi
      kiya, wo module order badalne par chupchaap toot jaata hai.
- [x] 1.11 `src/timeline/ops.ts`: 12 named pure ops. Split rule + non-destructive rule.
      → Har op do roop me: `moveItem(doc, args)` aur `moveItem.recipe(draft, args)`.
      Doosra roop `history.ts` ko patches nikalne deta hai — ek hi code, do tarah se chalta hai,
      isliye undo aur normal edit kabhi alag behave nahi karte.
      `setItemProperty` protected paths (`startFrame`, `trackId`, …) ko mana kar deta hai.
- [x] 1.12 `src/timeline/history.ts`: immer `produceWithPatches`, bounded (50), `coalesce`.
- [x] 1.13 `src/timeline/select.ts`: single, multi, range, by track, at-frame, prune.
- [x] 1.14 `scripts/check.ts`: asli assertions.
- [x] 1.15 `npx tsx packages/reel-core/scripts/check.ts` — **70/70 pass**, output neeche.
- [x] 1.16 `npm run typecheck` clean (chaaron workspaces).
- [x] 1.17 Commit: "reel-studio: phase 1 — project json, ops, registries" (`4a5b81d`).

## Verify (asli output)

```
$ npx tsx packages/reel-core/scripts/check.ts
time helpers (1.6)                          6 ok
size presets (1.5)                          5 ok
fit + upscale (1.5b, Section 3A/3B)         9 ok
property paths (keyframes ki neenv)         2 ok
registries (1.7-1.10)                       6 ok
factory + schema (1.1-1.4)                 10 ok
migrate (1.3)                               3 ok
timeline ops (1.11)                        20 ok
history (1.12)                              6 ok
selection (1.13)                            2 ok
sample doc                                  1 ok
------------------------------------------------------------
ALL PASS: 70 assertions groups, 0 fail        (exit code 0)

$ npm run typecheck
> @reel/studio    tsc --noEmit
> @reel/core      tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.scripts.json
> @reel/remotion  tsc --noEmit -p tsconfig.json
> @reel/worker    tsc --noEmit -p tsconfig.json
EXIT=0   (zero errors)
```

### Split ka frame math — asli proof

Ye Phase 1 ka sabse zaroori assert hai (check script me `SPLIT ka frame math bilkul exact hai`):

```
original : startFrame=10  durationInFrames=120  trimStartFrame=0   playbackRate=1
split at frame 40

left     : startFrame=10  durationInFrames=30   trimStartFrame=0
right    : startFrame=40  durationInFrames=90   trimStartFrame=30   (naya id)

30 + 90 === 120                    -> na ek frame kam, na zyada
right.startFrame === 10 + 30       -> koi gap nahi, koi overlap nahi
right.assetId === left.assetId     -> non-destructive, file chhui hi nahi
```

playbackRate 2 ke saath bhi (alag assert):

```
original : startFrame=10 duration=100 trimStartFrame=30 playbackRate=2
split at 40  ->  left duration=30, right duration=70
right.trimStartFrame === 30 + round(30 * 2) === 90    -> source ke 60 frames khatam hue
```

### Sample doc (`createEmptyProject()` + 2 items)

```jsonc
{
  "version": 1,
  "project": {
    "id": "p_39", "name": "Check fixture", "sizePresetId": "reel",
    "width": 1080, "height": 1920, "fps": 30,
    "durationInFrames": 450, "background": "#000000"
  },
  "tracks": [
    { "id": "tr_78", "type": "video", "name": "Video",       "order": 0,
      "muted": false, "hidden": false, "locked": false },
    { "id": "tr_79", "type": "audio", "name": "Voice / Audio", "order": 1,
      "muted": false, "hidden": false, "locked": false }
  ],
  "items": [
    {
      "id": "it_86", "trackId": "tr_78", "type": "image", "sceneId": null,
      "name": "Rahul intro",
      "startFrame": 0, "durationInFrames": 120,
      "trimStartFrame": 0, "playbackRate": 1,
      "assetId": "as_rahul",
      "transform": { "x": 0, "y": 0, "scale": 1, "rotation": 0, "opacity": 1,
                     "anchor": [0.5, 0.5], "crop": null },
      "fit": { "mode": "cover",
               "background": { "kind": "blurred-asset", "value": null } },
      "animations": [], "keyframes": {}, "effects": [],
      "audio": { "volume": 1, "muted": false, "fadeInFrames": 0, "fadeOutFrames": 0 },
      "transitionIn":  { "type": "none", "durationInFrames": 0 },
      "transitionOut": { "type": "none", "durationInFrames": 0 },
      "text": null, "shape": null, "hidden": false, "locked": false
    },
    {
      "id": "it_87", "trackId": "tr_79", "type": "audio", "sceneId": null,
      "name": "Voiceover",
      "startFrame": 0, "durationInFrames": 300,
      "trimStartFrame": 0, "playbackRate": 1,
      "assetId": "as_vo",
      /* transform / fit / audio wagairah image jaise hi defaults */
      "text": null, "shape": null, "hidden": false, "locked": false
    }
  ],
  "scenes": [],
  "brand": { "presetId": null },
  "meta": { "createdBy": "manual", "sourceStory": null }
}
```

(Poora JSON check script ke output me chhapta hai — `npm run check`.)

## Faisle jo is phase me liye gaye (aage ke phases inhe maanein)

1. **Keyframe ka `frame` item-local hai** (0 = item ka apna start), absolute timeline frame
   nahi. Isliye clip sarkane se uski animation nahi sarakti. Split aur trim keyframes ko
   shift karte hain — dono ka test maujood hai. Phase 13 isi par khada hoga.
2. **`fit.scale` aur `transform.scale` alag hain.** Total scale = fit.scale x transform.scale.
   Isliye "Fill frame" dabane ke baad bhi zoom keyframes waise ke waise chalte hain.
   Phase 3 ka renderer isi contract ko follow karega (`config/fit.ts` ke top par likha hai).
3. **Ops project duration ko sirf badhate hain, ghatate nahi.** Ghatana `recomputeDuration`
   op karta hai. Apne aap ghatne se user ki chhodi hui khaali jagah har edit par gayab hoti.
4. **`setItemProperty` protected paths block karta hai** (`startFrame`, `durationInFrames`,
   `trimStartFrame`, `trackId`, `id`, `type`) — inke apne ops hain, warna invariants toot jaate.
5. **`src/` me Node ke types nahi aate.** Check script Node par chalta hai, isliye uska
   typecheck alag `tsconfig.scripts.json` se hota hai. (Ye galti pakdi bhi gayi — pehle script
   typecheck se bahar tha aur usme ek asli type error chhupa hua tha.)
6. **`trimItemEnd` par upper clamp abhi nahi hai** — source ki asli lambai Phase 5 (assets)
   me pata chalegi, tab clamp wahin judega. Aaj sirf "kam se kam 1 frame" ka rule hai.

## Done when

Schema, ops, history, registries ban gaye; check script ke saare assertions pass; aur
`splitItemAtFrame` ka frame math sach me exact hai (proof output me dikhe).

→ **Teeno ho gaye.** 70/70 assertions pass, split ka proof upar likha hai.

## Progress log

| Date | What was done | Verified by | Next |
|---|---|---|---|
| 2026-08-19 | 1.1-1.17 poore. `@reel/core` me schema + migrate + factory + presets + fit + time + path + registries + 12 timeline ops + patch-based history + selection, aur 899-line check script. Commit `4a5b81d`. | `npx tsx packages/reel-core/scripts/check.ts` → `ALL PASS: 70 assertions groups, 0 fail` (exit 0); `npm run typecheck` chaaron workspaces exit 0; studio se `@reel/core` import karke typecheck pass (probe file hata di) | Phase 2 — Database + storage drivers |
