# Phase 1 — Project JSON schema + core types + registries

**STATUS:** not started
**One-line prompt:** `Read docs/reel-studio/README.md, then do Phase 1 of AI Reel Studio.`
**Rules:** README.md ke Standing + Dynamic rules binding. Resume Protocol follow karo.
**Depends on:** Phase 0 complete

**Goal:** poore product ki reedh ki haddi — Project JSON, uska zod schema, time helpers,
timeline ops, aur **registry system**. Sab pure TypeScript, koi React/DOM nahi.
Ye phase theek hua to baaki sab aasan; galat hua to sab dobara likhna padega.

## Checklist

- [ ] 1.1 `src/schema/project.ts`: zod schema exactly plan doc (00-architecture) ke format me —
      `version`, `project{id,name,width,height,fps,durationInFrames,background}`, `tracks[]`,
      `items[]`, `scenes[]`, `brand`, `meta`. Timing **integer frames** only (`z.number().int()`).
- [ ] 1.2 Types schema se infer karo (`z.infer`) — types haath se dobara mat likho.
- [ ] 1.3 `src/schema/migrate.ts`: `migrateDoc(unknown) -> Doc`. v1 identity migration +
      migration chain ka pattern (aage v2 add karna ek line ka kaam ho).
- [ ] 1.4 `src/schema/factory.ts`: `createEmptyProject({name, preset})`,
      `createItem(typeId, partial)`, `createTrack(typeId, partial)` — defaults **registry** se
      aate hain, hardcode nahi.
- [ ] 1.5 `src/config/presets.ts`: **README section 3B ki poori size list** data ke roop me —
      reel 1080x1920 (**default**), square 1080x1080, portrait 1080x1350, landscape 1920x1080,
      1440p, 4K 3840x2160, 4:3 1440x1080, aur `custom` (koi bhi width x height, even numbers
      enforce karo). fps choices 24/25/30/50/60. Koi magic number code me nahi.
- [ ] 1.5b `src/config/fit.ts`: fit modes (`cover`, `contain`, `fill`, `custom`) +
      contain-background options (color, brand token, blurred-asset, gradient) +
      `computeFit(source{w,h}, frame{w,h}, mode)` helper jo scale/position deta hai.
      Yahi helper preview, render, aur auto-fit buttons teeno use karenge.
- [ ] 1.6 `src/time.ts`: `framesToSeconds`, `secondsToFrames`, `framesToTimecode`,
      `snapFrame(frame, candidates, threshold)`, `clampFrame`. Poore repo me `/ fps` sirf yahin.
- [ ] 1.7 `src/registry/types.ts`: registry entry ka shape define karo —
      `{ id, label, icon, kind, schema, defaults, controls, keyframable }`.
      `controls` ek **declarative UI descriptor** array hai (Phase 9 ka panel isse banega):
      e.g. `{ path:"transform.scale", control:"slider", min:0.1, max:4, step:0.01, label:"Scale" }`.
- [ ] 1.8 `src/registry/itemTypes.ts`: `image`, `video`, `audio`, `text`, `shape` entries
      (render component baad me Phase 3 me judega — registry me sirf `componentKey` string).
- [ ] 1.9 `src/registry/trackTypes.ts`: video, image, text, audio, music, overlay, subtitle.
      Track count fixed **nahi** — sirf types.
- [ ] 1.10 `src/registry/index.ts`: `registerItemType()`, `getItemType(id)`, `listItemTypes()`
      helpers + empty registries for `TRANSITIONS`, `EFFECTS`, `ANIMATIONS`, `SCENE_TYPES`,
      `EXPORT_PRESETS`, `VALIDATION_RULES` (baad ke phases inme entries daalenge).
- [ ] 1.11 `src/timeline/ops.ts`: named pure ops — har op `(doc, args) => doc` (immer se):
      `addItem`, `moveItem`, `trimItemStart`, `trimItemEnd`, `splitItemAtFrame`,
      `deleteItems`, `duplicateItems`, `setItemProperty(path, value)`, `addTrack`,
      `removeTrack`, `reorderTracks`, `recomputeDuration`.
      **Split rule:** ek item do items me toote, dono ke `trimStartFrame` sahi ho,
      dono ka total frames original ke barabar, koi 1-frame gap/overlap nahi.
      **Non-destructive:** koi op file path ya asset ko nahi badalta.
- [ ] 1.12 `src/timeline/history.ts`: immer `produceWithPatches` se undo/redo stack,
      bounded (50), plus `coalesce(label)` support taaki drag ek hi undo entry bane.
- [ ] 1.13 `src/timeline/select.ts`: selection helpers (single, multi, range, by track).
- [ ] 1.14 `scripts/check.ts` (tsx se chalne wala): asli assertions —
      split frame math, trim clamp, duplicate ka naya id, undo/redo round-trip,
      schema reject on float frames, migrate on unknown version.
- [ ] 1.15 `npx tsx packages/reel-core/scripts/check.ts` chalao — sab pass, output paste karo.
- [ ] 1.16 `npm run typecheck` clean.
- [ ] 1.17 Commit: "reel-studio: phase 1 — project json, ops, registries".

## Verify (asli output paste karna)

```
npx tsx packages/reel-core/scripts/check.ts
npm run typecheck
```
Aur ek sample doc ka JSON paste karo jo `createEmptyProject()` + 2 items se bana ho.

## Done when

Schema, ops, history, registries ban gaye; check script ke saare assertions pass; aur
`splitItemAtFrame` ka frame math sach me exact hai (proof output me dikhe).

## Progress log

| Date | What was done | Verified by | Next |
|---|---|---|---|
| | | | |
