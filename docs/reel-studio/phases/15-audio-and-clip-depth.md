# Phase 15 — Audio depth + clip depth (fades, ducking, speed, freeze, crop)

**STATUS:** not started
**One-line prompt:** `Read docs/reel-studio/README.md, then do Phase 15 of AI Reel Studio.`
**Rules:** README.md ke Standing + Dynamic + **A1 Quality** rules binding. Resume Protocol follow karo.
**Depends on:** Phase 13, 14 complete

**Goal:** audio professional lage (voice saaf, music neeche, koi clipping nahi) aur clip-level
advanced ops aa jaayein. Voice quality par samjhauta nahi.

## Checklist

- [ ] 15.1 Audio item full: volume (dB scale bhi, sirf 0-1 nahi), mute, solo, pan (L/R),
      fade in/out (frames + easing curve), trim, loop (music ke liye), offset.
- [ ] 15.2 Volume automation: volume keyframes (Phase 13 se) + timeline pe **volume line**
      jo clip ke upar drag ho (asli editor jaisa).
- [ ] 15.3 **Audio ducking** (spec §12): rule-based — `{ voiceTracks[], duckedTracks[],
      targetDb, thresholdDb, attackFrames, releaseFrames }` project settings me.
      Implementation: voice items ke timing se duck envelope calculate karo (silence detection
      optional; timing-based pehle). Envelope preview me sunai de aur render me exactly wahi ho.
- [ ] 15.4 Ducking UI: on/off, target level slider (default -18dB music), attack/release,
      aur timeline pe duck envelope visible ho.
- [ ] 15.5 **A1 audio quality rules:** koi clipping nahi (mix ka peak check, true-peak -1dBTP),
      voice track pe kabhi upsample/downsample chain nahi, mix 48kHz float me, final AAC
      192–320k. Agar mix clip kar raha ho to export se pehle **warning** aur auto-gain suggestion.
- [ ] 15.6 Master audio section: master volume, loudness target (-14 LUFS default, configurable),
      limiter on/off. Ye render pipeline (Phase 11) ke FFmpeg step se juda ho — do jagah
      volume math nahi.
- [ ] 15.7 Clip speed: `playbackRate` (0.25x–4x) with duration auto-recompute,
      audio pitch-preserve option (FFmpeg `atempo` / `rubberband` na ho to batao),
      keyframes time-scale (Phase 13 ka 13.7).
- [ ] 15.8 Freeze frame: playhead pe frame freeze karke ek naya item (image jaisa) banao,
      original clip split ho.
- [ ] 15.9 Reverse (jahan practical): video/audio reverse — worker me FFmpeg se ek
      **temporary derived asset** banao (lifecycle `temporary`), item usko point kare.
      Original file kabhi na badle. Progress dikhao (ye slow hai — user ko batao).
- [ ] 15.10 Visual crop tool: preview par handles se crop, aspect lock, "fill frame" helper,
      crop keyframable.
- [ ] 15.11 Fit modes: cover / contain / fill / custom, aur "auto-fit to project aspect"
      helper (vertical reel me landscape video daalne par kaam aata hai — blurred-background
      fill bhi ek option ho).
- [ ] 15.12 Test: voice + music ka 20s clip — ducking on karke `ffmpeg -af ebur128` se prove
      karo ki voice ke dauraan music sach me neeche gaya (numbers paste karo). Fades ka
      waveform screenshot. Ek clip 2x speed pe, ek freeze frame, ek reverse — teeno render me.
- [ ] 15.13 `npm run typecheck` clean + check script me audio math assertions (dB<->linear,
      duck envelope, speed duration recompute).
- [ ] 15.14 Commit: "reel-studio: phase 15 — audio + clip depth".

## Verify (asli output paste karna)

```
ffmpeg -i out.mp4 -af ebur128=peak=true -f null -      # loudness + peaks
ffmpeg -i out.mp4 -af astats -f null -                 # clipping check
npx tsx packages/reel-core/scripts/check.ts
```

## Done when

Ducking asli measurement se sach saabit hota hai, koi clipping nahi, loudness target pe hai,
aur speed/freeze/reverse/crop sab render me sahi aate hain.

## Progress log

| Date | What was done | Verified by | Next |
|---|---|---|---|
| | | | |
