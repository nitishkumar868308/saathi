# Phase 13 — Keyframe engine + keyframe lanes

**STATUS:** not started
**One-line prompt:** `Read docs/reel-studio/README.md, then do Phase 13 of AI Reel Studio.`
**Rules:** README.md ke Standing + Dynamic rules binding. Resume Protocol follow karo.
**Depends on:** Phase 12 complete (ya Phase 11 ke baad kabhi bhi)

**Goal:** ek hi reusable keyframe engine jo **kisi bhi numeric property** pe kaam kare —
property-path se address, per-property code zero.

## Checklist

- [ ] 13.1 `packages/reel-core/keyframes/interpolate.ts`: `valueAt(keyframes, frame)` —
      number, array (x/y), aur color (hex → rgb lerp) support kare. Out-of-range pe
      hold-first/hold-last. Ek hi function preview + render dono use karein.
- [ ] 13.2 Keyframe shape: `{ frame, value, easing, bezier? }`. Easing Phase 10 ki library se.
- [ ] 13.3 Keyframe ops: `addKeyframe(itemId, path, frame, value)`, `moveKeyframe`,
      `deleteKeyframe`, `setKeyframeEasing`, `clearKeyframes(path)`. Sab undo-able.
- [ ] 13.4 Auto-keyframe mode: on karke property badlo → playhead pe keyframe khud bane.
      Off ho to property static badle.
- [ ] 13.5 Registry ka `keyframable` flag: jo properties keyframable hain unke control pe
      ek stopwatch icon aaye (Phase 9 ke generated panel me automatic).
      Minimum: position(x,y), scale, rotation, opacity, volume, blur, brightness, saturation,
      crop, text size/color.
- [ ] 13.6 **Trim/split ke saath keyframes:** split pe keyframes dono halves me sahi frame pe
      baant jaayein; trim pe out-of-range keyframes clamp/preserve hon (value na kude).
      Ye assertions check script me add karo (Phase 8 ka 8.4 yahin se pakka hota hai).
- [ ] 13.7 Speed change ke saath keyframes time-scale hon (Phase 15 se link — dono taraf test).
- [ ] 13.8 Timeline me **keyframe lane**: selected clip ke neeche expandable rows (per property),
      keyframe diamonds — click select, drag move (frame snap), Del delete, right-click easing,
      double-click value edit.
- [ ] 13.9 Mini curve editor (ek property ke liye): bezier handles drag, preset easings,
      "smooth all" button. Simple rakho par asli ho.
- [ ] 13.10 Copy/paste keyframes ek property se doosri property/item pe.
- [ ] 13.11 Performance: 500 keyframes wale project me playback smooth (interpolation
      per-frame O(log n) — binary search, linear scan nahi).
- [ ] 13.12 Animation vs keyframe conflict rule: keyframe **jeetta hai** (animation base,
      keyframe override) — ye rule ek jagah likho aur UI me batao.
- [ ] 13.13 Test: ek image pe scale 1.0 → 1.15 (0s → 5s, ease-in-out) + opacity fade +
      x-position pan, teen keyframed properties ek saath. Render karke frame 0/45/90/149 ke
      values measure karke dikhao ki interpolation sahi hai (preview aur render ka same value).
- [ ] 13.14 `npm run typecheck` clean + check script assertions (interpolate math, split with
      keyframes, easing curves).
- [ ] 13.15 Commit: "reel-studio: phase 13 — keyframe engine".

## Verify (asli output paste karna)

```
npx tsx packages/reel-core/scripts/check.ts
npm run dev:studio          # keyframe lane + curve editor
# render karke frames compare
```

## Done when

Koi bhi keyframable property keyframe ho sakti hai bina naya code likhe (ek nayi property
pe prove karo), split/trim/speed keyframes ko todte nahi, aur preview = render values.

## Progress log

| Date | What was done | Verified by | Next |
|---|---|---|---|
| | | | |
