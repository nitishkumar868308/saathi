# Phase 19 — Captions system (manual + SRT/VTT + styles)

**STATUS:** not started
**One-line prompt:** `Read docs/reel-studio/README.md, then do Phase 19 of AI Reel Studio.`
**Rules:** README.md ke Standing + Dynamic rules binding. Resume Protocol follow karo.
**Depends on:** Phase 17 complete (auto-captions Phase 23 me, AI ke saath)

**Goal:** captions — reels ke liye zaroori. Bina AI ke bhi poora kaam kare: haath se banao
ya SRT/VTT import karo. Hamesha editable text rahe, kabhi burned-in asset nahi.

## Checklist

- [ ] 19.1 `subtitle` item type (registry): `{ cues[], style, position }` jahan cue =
      `{ startFrame, endFrame, text, words?[] }`. `words[]` per-word timing (karaoke ke liye).
- [ ] 19.2 Caption editor panel: cue list (add/split/merge/delete), inline text edit,
      timing edit (numeric + timeline drag), "split at playhead" for cues,
      character/line limit hint (reels me 2 line max, 32 char/line default — config se).
- [ ] 19.3 Timeline pe caption track: har cue ek chhota block, drag se timing, snap to audio.
- [ ] 19.4 SRT + VTT **import**: file drop → cues (timing seconds → frames, rounding rule
      explicit). Encoding issues (UTF-8 BOM, Hindi text) handle karo — test Hindi file se.
- [ ] 19.5 SRT + VTT **export**: doc se file bana ke download (Instagram/YouTube ke liye).
- [ ] 19.6 Caption **styles registry** (`CAPTION_STYLES`): `normal`, `bold`, `highlight-word`,
      `karaoke`, `pop` (scale bounce per word), `typewriter`, `boxed`.
      Har style = `{ id, label, params, defaults, controls, component }`. Naya style = 1 file.
- [ ] 19.7 Style params: font, size, weight, color, active-word color, stroke, shadow,
      background box, radius, padding, max width, position (bottom/center/top + offset),
      safe-area aware placement (Phase 6 ke guides se consistent).
- [ ] 19.8 Karaoke/highlight ke liye word timing: agar `words[]` nahi hai to cue duration me
      words ko length ke hisaab se distribute karo (approximation) — aur UI me saaf batao ki
      ye estimate hai (Phase 23 me asli word timing aayegi).
- [ ] 19.9 Brand tokens captions me bhi (`brand.primary` highlight color).
- [ ] 19.10 Multi-language captions: ek item me ek language; do subtitle items = do languages,
      dono ka on/off toggle (Hindi + English reels ke liye kaam ka).
- [ ] 19.11 Preview = render check: text metrics browser me aur render me same hone chahiye
      (font loading race se bachna — Remotion me `delayRender` tak font wait kare).
- [ ] 19.12 Test: 20s voiceover ke liye 8 cues haath se banao, `karaoke` style lagao,
      SRT export karo, wo SRT dobara import karke confirm karo timing same aayi.
      Render karo aur 6 frames dikhao jisme highlight word badalta dikhe.
      Ek Hindi (Devanagari) caption bhi test karo — font render me tootna nahi chahiye.
- [ ] 19.13 `npm run typecheck` clean. Commit: "reel-studio: phase 19 — captions".

## Verify (asli output paste karna)

```
npm run dev:studio
# SRT export -> import round trip ka diff
ffmpeg -i out.mp4 -vf fps=3 frames/%02d.png
```

## Done when

Captions haath se ban jaati hain, SRT/VTT round-trip exact hai, karaoke/highlight render me
sach me chalta hai, Devanagari text sahi render hota hai, aur captions editable rehti hain.

## Progress log

| Date | What was done | Verified by | Next |
|---|---|---|---|
| | | | |
