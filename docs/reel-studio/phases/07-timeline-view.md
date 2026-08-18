# Phase 7 — Timeline view (ruler, zoom, tracks, clips, selection)

**STATUS:** not started
**One-line prompt:** `Read docs/reel-studio/README.md, then do Phase 7 of AI Reel Studio.`
**Rules:** README.md ke Standing + Dynamic rules binding. Resume Protocol follow karo.
**Depends on:** Phase 6 complete

**Goal:** timeline **dikhna** shuru ho — sahi scale pe, sahi tracks, sahi clips.
Editing (drag/trim/split) agla phase hai. Pehle drawing solid karo.

## Checklist

- [ ] 7.1 `pxPerFrame` derived state: zoom level → px/frame. Saara position math ek helper se
      (`frameToX`, `xToFrame`). Component me manual multiply mana hai.
- [ ] 7.2 Ruler: zoom ke hisaab se adaptive ticks (frames → seconds → 5s → 10s), labels
      timecode helper se. fps 24/25/30/60 sab pe sahi.
- [ ] 7.3 Zoom: Ctrl+wheel (cursor pe centered), +/- keys, "Fit project" button, zoom range clamp.
- [ ] 7.4 Horizontal scroll + playhead follow during playback (auto-scroll, toggle-able).
- [ ] 7.5 Track rows **doc ke tracks[] se generate** (fixed rows nahi). Har row: name,
      type icon (registry se), mute/hide/lock buttons (abhi state toggle, effect Phase 16 me),
      height resize.
- [ ] 7.6 Clip rendering: color track type se (registry), label = asset filename/text content,
      thumbnail strip images/videos ke liye (cached, lazy), waveform audio ke liye
      (Phase 5 ka waveform PNG reuse — dobara generate nahi).
- [ ] 7.7 Virtualization: 200+ clips pe bhi smooth (sirf visible range render karo).
- [ ] 7.8 Selection: click (single), Ctrl/Cmd+click (toggle), Shift+click (range),
      marquee drag (rubber band), Ctrl+A, Esc. Selected clips ka outline saaf dikhe.
- [ ] 7.9 Selection state `uiSlice` me (doc me nahi) — undo se selection nahi badalni chahiye.
- [ ] 7.10 Playhead: draggable, timeline click pe jump, ruler pe drag, `uiSlice.playheadFrame`
      hi truth (Phase 6 se shared).
- [ ] 7.11 In/Out point markers (I / O keys) — abhi sirf visual + state; use Phase 8 me hoga.
- [ ] 7.12 Empty state: naye project me saaf "Media library se drag karo" hint.
- [ ] 7.13 Accessibility/usability basics: clip pe hover tooltip (start, duration, timecode),
      keyboard se clip navigate (Tab/arrow).
- [ ] 7.14 Test: 3 track aur 12 clip ka doc banao (script se), timeline me sab sahi jagah
      dikhe; fps 24 wala project bhi kholo aur ruler verify karo. Screenshot do.
- [ ] 7.15 `npm run typecheck` clean. Commit: "reel-studio: phase 7 — timeline view".

## Verify (asli output paste karna)

```
npm run dev:studio
# zoom in/out, scrub, marquee select, 24fps project ka ruler check
npm run typecheck
```

## Done when

Timeline sahi scale pe draw hota hai, tracks doc se aate hain, selection ke saare modes chalte
hain, playhead shared hai, aur 200 clips pe UI smooth rehta hai.

## Progress log

| Date | What was done | Verified by | Next |
|---|---|---|---|
| | | | |
