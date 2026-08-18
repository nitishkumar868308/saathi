# Phase 12 — Scene system + Add Scene + Scene Cards (beginner mode)

**STATUS:** not started
**One-line prompt:** `Read docs/reel-studio/README.md, then do Phase 12 of AI Reel Studio.`
**Rules:** README.md ke Standing + Dynamic rules binding. Resume Protocol follow karo.
**Depends on:** Milestone 1 (Phase 0–11) complete

**Goal:** "koi bhi video bana sake" — Scene Cards mode. Aur **manual scene = AI scene**:
dono bilkul same Project JSON banate hain. Do editor kabhi nahi.

## Checklist

- [ ] 12.1 `SCENE_TYPES` registry: `image`, `image_audio`, `video`, `screen_recording`, `text`,
      `audio`, `music`, `character`, `lipsync`, `cta`, `overlay`, `shape`, `subtitle`.
      Har entry: `{ id, label, icon, slots, defaults, build(input) -> items[] }`.
      `build` hi wo jagah hai jahan scene → items banta hai (AI aur manual dono isko call karte hain).
- [ ] 12.2 `slots` declarative: e.g. `image_audio` ke slots = `{ image: 'asset:image',
      audio: 'asset:audio', caption: 'text?' }`. Slot definitions se UI khud banega.
- [ ] 12.3 `addScene(doc, typeId, input)` op: items banao, `scenes[]` me entry, tracks
      auto-assign (compatible track dhoondo, na mile to naya banao), scene ko timeline ke
      end me place karo (ya playhead pe, config se).
- [ ] 12.4 Scene ops: `reorderScenes` (aage/peeche move + drag), `duplicateScene`,
      `deleteScene` (uske items ke saath), `setSceneDuration` (items proportionally adjust,
      ya sirf primary item — dono option), `replaceSceneAsset(slot, assetId)`,
      `setSceneText(slot, value)`. **Sab named ops, sab undo-able.**
- [ ] 12.5 Scene reorder ripple: scene 2 aur 3 swap karne pe items ke startFrame recompute
      hon, gaps na bachein. Ye test se prove karo (spec ka example:
      `[Rahul][Papa][Problem][App][CTA]` → `[Rahul][Problem][Papa][App][CTA]`).
- [ ] 12.6 **Scene Cards UI** (beginner mode): vertical card list — thumbnail, scene type badge,
      duration (editable), dialogue/text (inline edit), asset thumbs with "Replace" button,
      aur **audio row (README 3C)**: audio ke liye 3-option model abhi se schema me rakho
      (`{mode: 'generate'|'upload'|'both', ...}`), par UI me sirf **Upload** dikhao —
      Generate/Both tabs Phase 22 me chalu honge, tab tak wo buttons **honge hi nahi**.
      Card actions: up/down, duplicate, delete, "Edit in timeline".
- [ ] 12.7 "+ Add Scene" panel: registry se type grid, type choose karne pe uske slots ka
      form (asset picker / text / duration / animation / transition dropdowns — sab registry se).
- [ ] 12.8 **Two-way sync:** Scene Cards aur timeline ek hi doc pe. Card me duration badlo →
      timeline turant update; timeline me clip trim karo → card ka duration update.
      Agar koi manual timeline edit scene ki shape todta hai (item scene se bahar khisak gaya),
      to card pe saaf "Custom edited" badge dikhao — chupchaap sync tootne mat do.
- [ ] 12.9 Mode toggle TopBar me: **Beginner (Scene Cards) / Advanced (Timeline)** —
      same project, same doc, koi conversion nahi. Choice per-project yaad rahe.
- [ ] 12.10 Beginner mode me preview + export dono available hon (beginner ko timeline
      dekhne ki zaroorat na pade).
- [ ] 12.11 Scene-level animation/transition dropdown (registry se) jo scene ke primary item
      pe apply ho.
- [ ] 12.12 Orphan/consistency guard: `validateSceneIntegrity(doc)` — items jinka `sceneId`
      missing hai, scenes jinke itemIds gayab hain. Ek "Fix" button jo repair op chalaye.
- [ ] 12.13 Test (ye poora karke dikhao): sirf Scene Cards se ek 25s reel banao —
      Rahul image+audio, Papa image+audio, text scene, music scene, CTA text.
      Phir 2 scenes reorder karo, ek duplicate karo, ek ka image replace karo, duration badlo.
      Export karo. Phir timeline mode me jaake confirm karo sab sahi baitha hai.
- [ ] 12.14 `npm run typecheck` clean + core check script me scene op assertions.
- [ ] 12.15 Commit: "reel-studio: phase 12 — scenes + scene cards".

## Verify (asli output paste karna)

```
npx tsx packages/reel-core/scripts/check.ts     # scene reorder/ripple assertions
npm run dev:studio                               # beginner-only flow
ffprobe -hide_banner <out.mp4>
```

## Done when

Bina timeline chhue ek poori reel ban jaati hai aur export hoti hai; scene ops sab undo-able
hain; aur beginner/advanced dono view ek hi doc pe two-way synced hain.

## Progress log

| Date | What was done | Verified by | Next |
|---|---|---|---|
| | | | |
