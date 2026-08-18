# Phase 6 — Preview player + transport + playhead

**STATUS:** not started
**One-line prompt:** `Read docs/reel-studio/README.md, then do Phase 6 of AI Reel Studio.`
**Rules:** README.md ke Standing + Dynamic + A1 Quality rules binding. Resume Protocol follow karo.
**Depends on:** Phase 3, 4, 5 complete

**Goal:** center me asli preview — **wahi Remotion composition** jo final render karta hai.
Preview aur export me farak nahi hona chahiye.

## Checklist

- [ ] 6.1 `@remotion/player` studio me install + `<Player>` mount with
      `component = ReelComposition` (Phase 3 wala **same** component, copy nahi).
- [ ] 6.2 inputProps = live doc + resolved asset URL map. Doc badle to player turant update ho
      (remount ke bina, warna playback position khoyegi).
- [ ] 6.3 Player size = project aspect se **calculated**, fit-to-container + zoom levels
      (Fit / 50% / 100%) — hardcoded pixel size nahi.
- [ ] 6.4 Transport bar: play/pause (Space), 1 frame back/forward (←/→), 1 second jump
      (Shift+←/→), start/end (Home/End), loop toggle, mute toggle, volume.
- [ ] 6.5 Timecode display: `HH:MM:SS:FF` + frame number, dono fps se derive (helper se).
- [ ] 6.6 Playhead single source of truth: store ka `uiSlice.playheadFrame`. Player aur
      timeline dono isi ko padhein/likhein — do jagah state nahi.
- [ ] 6.7 Scrub: player par drag + timeline par drag, dono same frame set karein.
      Scrub ke dauraan seek throttle (60fps se zyada nahi).
- [ ] 6.8 Play/pause ke dauraan autosave block **nahi** hona chahiye, par save request
      playback ko hakla na de — verify karke batao.
- [ ] 6.9 **A1 quality:** preview me image scaling smooth ho (`image-rendering` default,
      CSS blur nahi), aur `<Player>` ka `numberOfSharedAudioTags` sahi set ho taaki
      audio glitch na kare. Preview resolution downscale ho sakta hai par **aspect aur
      framing bilkul final ke jaisa** ho.
- [ ] 6.10 Safe-area guides overlay (toggle): Instagram/Shorts ke UI-safe margins, grid,
      center lines. Reels ke liye ye bahut kaam ka hai.
- [ ] 6.11 Missing asset handling: asset na mile to preview me saaf "Missing asset" card
      dikhao (crash nahi, chup-chaap khaali bhi nahi).
- [ ] 6.12 Performance guard: 3+ video layers pe stutter aaye to console warning + UI hint
      "Preview quality: Draft" toggle (jo preview ka scale ghatata hai, doc nahi).
- [ ] 6.13 Test: Phase 3 ka sample doc DB me daalo, preview me chalao, aur usi doc ka render
      karke **same frame numbers** ke 2 frames compare karo (preview screenshot vs rendered
      frame). Farak ho to batao — chhupao nahi.
- [ ] 6.14 `npm run typecheck` clean. Commit: "reel-studio: phase 6 — preview player".

## Verify (asli output paste karna)

```
npm run dev:studio       # play, scrub, frame step, timecode check
npm run render:sample    # phir frame compare
ffmpeg -i out.mp4 -vf "select=eq(n\,45)" -vframes 1 f45.png
```

## Done when

Preview chalta hai, frame-accurate scrub/step hota hai, playhead ek hi state se chalta hai,
aur preview vs render frame comparison mel khata hai.

## Progress log

| Date | What was done | Verified by | Next |
|---|---|---|---|
| | | | |
