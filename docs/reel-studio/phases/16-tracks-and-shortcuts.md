# Phase 16 — Multi-track manager + shortcuts + workflow polish

**STATUS:** not started
**One-line prompt:** `Read docs/reel-studio/README.md, then do Phase 16 of AI Reel Studio.`
**Rules:** README.md ke Standing + Dynamic rules binding. Resume Protocol follow karo.
**Depends on:** Phase 15 complete

**Goal:** editor ka rozana ka istemaal tez ho — unlimited tracks, asli shortcuts,
aur wo chhoti cheezein jinke bina editor thakaa deta hai.

## Checklist

- [ ] 16.1 Track manager: add track (type registry se choose), remove (items ka kya karein —
      poochho), rename, reorder (drag), duplicate track.
- [ ] 16.2 Track controls sach me kaam karein: **mute** (render me bhi), **hide**
      (render me bhi), **lock** (edit block), **solo**, opacity per track, track height.
- [ ] 16.3 Track type compatibility: konsa item konse track pe ja sakta hai (registry se),
      galat drop pe saaf feedback.
- [ ] 16.4 Layer order = track order (z-index), drag se badle, preview me turant.
- [ ] 16.5 Keyboard shortcuts poore (`studio/lib/shortcuts.ts` registry se, Phase 4 ka system):
      Space play/pause, J/K/L shuttle, ←/→ frame, Shift+←/→ second, Home/End,
      I/O in-out, S split, Ctrl+D duplicate, Ctrl+C/X/V, Del / Shift+Del ripple,
      Ctrl+Z / Ctrl+Shift+Z, Ctrl+A, Ctrl+S manual save, +/- zoom, Shift+Z fit,
      M marker, [ ] trim to playhead, Alt+drag snapping off.
- [ ] 16.6 Shortcut cheat-sheet modal (`?`) — registry se auto-generated (haath se list nahi).
- [ ] 16.7 Shortcut remap UI (config localStorage me) — dynamic rule ka hissa.
- [ ] 16.8 Markers: timeline pe marker add/rename/delete/jump (M key), markers doc me.
- [ ] 16.9 Right-click context menus: clip pe (split, delete, duplicate, replace asset,
      speed, freeze, effects, transitions), track pe, timeline khaali jagah pe.
- [ ] 16.10 Multi-select drag across tracks, group/ungroup items (group = ek `groupId` field,
      saath move/trim ho).
- [ ] 16.11 Timeline snapping options panel: kis kis cheez pe snap kare (playhead, clips,
      markers, scene boundaries, seconds grid) — toggles.
- [ ] 16.12 Auto-scroll during drag near edges, aur drag-to-timeline se seedha asset drop.
- [ ] 16.13 "Replace asset" flow: clip pe replace karo → timing/keyframes/effects same rahein,
      sirf assetId badle (duration mismatch pe poochho: keep duration ya fit to source).
- [ ] 16.14 Crash-safety: local draft (IndexedDB) jo autosave fail hone par bhi kaam bacha le,
      aur reload pe "unsaved changes recover?" poochhe.
- [ ] 16.15 Test: 6 tracks ka project banao (2 video, 1 overlay, 1 text, 2 audio),
      mute/hide/lock verify karo **render me bhi** (hidden track MP4 me na dikhe — frame se prove).
      Saare shortcuts ek-ek chalake list do: WORKING / NOT WORKING.
- [ ] 16.16 `npm run typecheck` clean. Commit: "reel-studio: phase 16 — tracks + shortcuts".

## Verify (asli output paste karna)

```
npm run dev:studio
# hidden/muted track ke saath render, phir frame + audio check
ffmpeg -i out.mp4 -af astats -f null -
```

## Done when

Tracks poori tarah manage hote hain aur unke toggles render me bhi lagu hote hain, saare
shortcuts kaam karte hain, aur crash/reload pe kaam nahi khota.

## Progress log

| Date | What was done | Verified by | Next |
|---|---|---|---|
| | | | |
