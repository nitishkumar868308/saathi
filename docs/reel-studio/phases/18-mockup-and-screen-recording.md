# Phase 18 — Phone mockup + screen recording workflow

**STATUS:** not started
**One-line prompt:** `Read docs/reel-studio/README.md, then do Phase 18 of AI Reel Studio.`
**Rules:** README.md ke Standing + Dynamic + A1 Quality rules binding. Resume Protocol follow karo.
**Depends on:** Phase 17 complete

**Goal:** Apka Saathi app ka screen recording ek professional demo shot bane — phone frame,
zoom-pan, rounded corners, shadow. Ye tumhare marketing reels ka sabse kaam ka feature hai.

## Checklist

- [ ] 18.1 `PhoneFrame` component (`packages/reel-remotion/mockups/`): props =
      `{ device, color, size, position, rotation, shadow, cornerRadius, showStatusBar }`.
      Device list **data** me (`devices.ts`): screen aspect, bezel width, radius, notch type.
      Naya device = ek entry.
- [ ] 18.2 Frame ke andar koi bhi asset (image ya video) fit ho — screen area me `cover`,
      aspect mismatch pe saaf handling (letterbox ya crop, user chunta hai).
- [ ] 18.3 SVG/CSS se frame banao (koi PNG asset dependency nahi jo render me miss ho jaaye).
      Shadow, glass reflection optional toggle.
- [ ] 18.4 3D-ish tilt (perspective rotateY/X) optional, keyframable — reels me achha lagta hai.
- [ ] 18.5 `screen_recording` scene type (Phase 12 registry) me phone frame default ON,
      plus "raw" mode.
- [ ] 18.6 **Zoom-pan tool** (asli kaam ki cheez): preview pe rectangle draw karke
      "zoom to this area from frame A to B" — background me ye scale+position keyframes
      (Phase 13) banata hai. Multiple zoom steps ek clip me.
- [ ] 18.7 Zoom presets: "Zoom to reminder screen", "Pan down list", "Highlight button" —
      ye sirf keyframe param sets hain (data).
- [ ] 18.8 **A1 quality guard:** zoom se effective resolution source se zyada na ho.
      Screen recording 1080x2400 hai aur tum 2x zoom kar rahe ho → warning:
      exact numbers ke saath ("effective 2160p needed, source 1080p"). Blurry ko chalne mat do.
      Recommendation do: recording ko higher resolution me dobara lo.
- [ ] 18.9 Screen recording helpers: auto-detect device aspect from asset metadata,
      auto-fit into project (vertical reel me phone frame perfect baithe),
      "trim dead time" helper (start/end ke khaali seconds kaat do — asli detection ya manual).
- [ ] 18.10 Rounded corners + border + shadow for raw recordings (Phase 14 effects reuse,
      naya code nahi).
- [ ] 18.11 Optional: touch/tap indicator overlay (circle pulse) jo timeline pe keyframe se
      place ho — demo videos me bahut kaam aata hai. Agar time na ho to skip karo par
      button **mat dikhao**.
- [ ] 18.12 Test: Apka Saathi ka ek asli screen recording lo (mai dunga; na ho to FFmpeg se
      dummy 1080x2400 recording banao), phone frame me daalo, do zoom step lagao,
      narration audio ke saath 15s clip render karo. 6 frames dikhao + upscale warning ka
      output dikhao jab 2.5x zoom karo.
- [ ] 18.13 `npm run typecheck` clean. Commit: "reel-studio: phase 18 — mockup + screen recording".

## Verify (asli output paste karna)

```
npm run dev:studio      # zoom-pan tool + phone frame
ffmpeg -i out.mp4 -vf fps=1 frames/%02d.png
```

## Done when

Screen recording phone frame me professional dikhti hai, zoom-pan keyframes se chalta hai,
aur over-zoom pe asli numbers ke saath warning aata hai.

## Progress log

| Date | What was done | Verified by | Next |
|---|---|---|---|
| | | | |
