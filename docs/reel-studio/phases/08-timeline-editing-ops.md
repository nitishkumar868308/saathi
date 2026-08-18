# Phase 8 — Timeline editing: move / trim / split / cut / duplicate + undo

**STATUS:** not started
**One-line prompt:** `Read docs/reel-studio/README.md, then do Phase 8 of AI Reel Studio.`
**Rules:** README.md ke Standing + Dynamic rules binding. Resume Protocol follow karo.
**Depends on:** Phase 7 complete

**Goal:** yahan editor "asli editor" banta hai. Professional cut/trim/split, frame-accurate,
**non-destructive**. Ye phase sabse zyada dhyaan se karna hai.

## Checklist

- [ ] 8.1 Drag to move: horizontal (time) + vertical (track change, sirf compatible track type pe).
      Drag ke dauraan ghost preview, drop pe ek `moveItem` op — poora drag **ek undo entry**
      (history coalesce).
- [ ] 8.2 Snapping: playhead, doosre clips ke edges, track start, project end, aur scene
      boundaries. Threshold px me (zoom-aware), snap indicator line dikhe, `Alt` dabaye rakhne
      pe snapping band.
- [ ] 8.3 Trim left / right edge drag: `trimStartFrame` + `durationInFrames` badle,
      **source ki limit pe clamp** (image ka koi limit nahi, video/audio ka duration limit hai).
      Trim ke dauraan live frame preview.
- [ ] 8.4 Split at playhead (`S`): selected clip (ya playhead ke neeche wale sab) do items me.
      Verify: dono ke frames ka jod original ke barabar, koi gap/overlap nahi, dono
      independently editable, dono ke keyframes sahi jagah shift/split hue.
- [ ] 8.5 In/Out points ka use: **Cut selection** (in-out ke beech ka hissa hatao) aur
      **Keep selection** (sirf in-out ke beech rakho). Dono ripple aur non-ripple mode me.
- [ ] 8.6 Delete (`Del`) + **Ripple delete** (`Shift+Del`) — ripple me aage ke clips khisak jaayein
      (sirf usi track pe, ya "ripple all tracks" option se sab pe).
- [ ] 8.7 Duplicate (`Ctrl+D`): naye id, turant baad me place, ya same jagah alternate track pe
      (jo khaali ho). Keyframes/effects/transitions bhi copy hon.
- [ ] 8.8 Copy / Cut / Paste (`Ctrl+C/X/V`): paste playhead pe, cross-project paste bhi
      (clipboard me doc-fragment JSON).
- [ ] 8.9 Overlap policy config se: `overwrite` (default, upar wala jeete) ya `push` (aage khiskao)
      ya `reject`. Ek jagah decide ho, har op isko maane.
- [ ] 8.10 Nudge: arrow keys se selected clip 1 frame, Shift+arrow se 1 second.
- [ ] 8.11 Multi-item ops: move/trim/delete/duplicate selection ke saare items pe, relative
      spacing bani rahe.
- [ ] 8.12 **Non-destructive proof**: `reel_assets` ka koi row aur R2 ka koi file kisi bhi op se
      na badle. Ye ek test se prove karo (checksum before/after).
- [ ] 8.13 Undo/redo har op pe sahi (drag = 1 entry, multi-delete = 1 entry). 30 ops karke
      30 baar undo karo — doc bilkul shuruaati jaisa (deep equal) ho. Ye test script se prove karo.
- [ ] 8.14 `recomputeDuration` har structural op ke baad — project duration khud adjust ho
      (aur last clip delete karne pe chhoti ho).
- [ ] 8.15 Performance: 200 clips pe drag/trim 60fps rahe (kaam UI thread pe halka rakho,
      op sirf drop pe).
- [ ] 8.16 `packages/reel-core/scripts/check.ts` me naye assertions: cut/keep selection,
      ripple delete, split with keyframes, overlap policy, undo round-trip.
- [ ] 8.17 Manual test aur mujhe dikhao: ek 20s video clip lo → 5s–12s keep selection →
      10s pe split → ek clip duplicate → ek move → undo 5 baar → redo 5 baar.
      Har step ka frame number output paste karo.
- [ ] 8.18 `npm run typecheck` clean. Commit: "reel-studio: phase 8 — timeline editing ops".

## Verify (asli output paste karna)

```
npx tsx packages/reel-core/scripts/check.ts
npm run dev:studio    # manual sequence upar wala
npm run typecheck
```

## Done when

Saare ops frame-accurate hain, non-destructive hain (checksum proof), undo round-trip exact hai,
aur 200-clip project pe UI smooth hai.

## Progress log

| Date | What was done | Verified by | Next |
|---|---|---|---|
| | | | |
