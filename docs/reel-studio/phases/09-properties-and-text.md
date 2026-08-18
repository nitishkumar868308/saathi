# Phase 9 — Generated properties panel + text items

**STATUS:** not started
**One-line prompt:** `Read docs/reel-studio/README.md, then do Phase 9 of AI Reel Studio.`
**Rules:** README.md ke Standing + Dynamic rules binding. Resume Protocol follow karo.
**Depends on:** Phase 8 complete

**Goal:** right sidebar jo **registry ke controls descriptor se khud ban jaaye** — kisi type
ke liye haath se panel likhna mana. Plus text layers poore control ke saath.

## Checklist

- [ ] 9.1 `PropertyPanel`: selected item ka type registry se lo, uske `controls[]` descriptor
      pe map karke UI banao. Naya item type = zero panel code.
- [ ] 9.2 Control components (`studio/components/controls/`): `slider`, `number`, `text`,
      `textarea`, `color`, `select`, `toggle`, `xy-pad`, `font-picker`, `range`, `easing-picker`.
      Har control `{path, value, onChange}` interface pe chale.
- [ ] 9.3 Value read/write **path se** (`transform.scale`) — `getByPath`/`setByPath` helper,
      aur write `applyOp('setItemProperty', ...)` se (undo ke liye).
- [ ] 9.4 Drag-to-change on number inputs, arrow keys se step, Shift se bada step,
      double-click se reset-to-default (default registry se).
- [ ] 9.5 Multi-select editing: common properties dikhao, mixed values pe "—" dikhao,
      badalne pe sab pe apply (ek undo entry).
- [ ] 9.6 **Size & Fit section (README 3B — ye bahut important hai):**
      x, y, scale, rotation, opacity, anchor, crop (numeric abhi; visual crop Phase 15 me),
      aur **fit mode**: `cover` / `contain` / `fill (stretch, warning ke saath)` / `custom`.
      `contain` ke background options: solid color, brand color, **blurred copy of the
      asset** (16:9 video ko 9:16 reel me daalne ka sabse kaam ka tarika), gradient.
- [ ] 9.6b Auto-fit buttons: "Fit to frame", "Fill frame", "Fit width", "Fit height",
      "Center", "Reset" — ek click, undo-able op. Aspect mismatch detect ho to panel khud
      suggest kare (e.g. "Landscape video in vertical project — Fill + blurred background?").
- [ ] 9.6c Har item ka **effective resolution readout** dikhao (source px vs frame px vs
      current scale) — A1 quality rule ka live feedback. Upscale > 100% pe warning color.
- [ ] 9.7 Timing section: start frame, duration, end frame, trim start — numeric edit bhi
      chale (timeline drag ke alawa), timecode input format accept kare.
- [ ] 9.8 Audio section (audio/video items): volume, mute, fade in/out (frames me).
- [ ] 9.9 **Text item full support:** content (multiline), font family (registry/font list se),
      size, weight, line height, letter spacing, color, align, vertical align, stroke
      (width+color), shadow (x,y,blur,color), background box (padding, radius, color, opacity),
      max width + auto-wrap, uppercase toggle.
- [ ] 9.10 Fonts **dynamic**: `studio/public/fonts/` + ek `fonts.json` registry; font
      load preview me aur render me **same** ho (Remotion me `@remotion/google-fonts` ya
      local `@font-face` — jo bhi ho, dono jagah ek hi source).
      Missing font pe saaf warning (Phase 20 validator me bhi jaayega).
- [ ] 9.11 Shape item: rect/rounded-rect/circle/line, fill, stroke, radius, opacity —
      overlays aur text background ke kaam aata hai.
- [ ] 9.12 Brand tokens: color pickers me brand palette shortcuts dikhein aur value
      `brand.primary` jaisi token save ho (Phase 17 ka base). Render time pe resolve.
- [ ] 9.13 Project settings panel: name, resolution preset, fps, background, duration —
      badalne pe items proportionally handle karne ka option (poochho, chupchaap mat karo).
- [ ] 9.14 Test: text item banao, stroke+shadow+background lagao, ek image ka scale keyframe
      ke bina badlo, render karke confirm karo ki preview = MP4 (2 frame compare).
- [ ] 9.15 `npm run typecheck` clean. Commit: "reel-studio: phase 9 — properties + text".

## Verify (asli output paste karna)

```
npm run dev:studio
npm run render:sample   # ya project ka test render
# preview screenshot vs rendered frame — text stroke/shadow bilkul same dikhe
```

## Done when

Panel poora registry-generated hai (naya type add karne pe panel khud aata hai — ye ek
dummy type add karke prove karo), text ke saare controls kaam karte hain, aur text render me
preview jaisa hi dikhta hai.

## Progress log

| Date | What was done | Verified by | Next |
|---|---|---|---|
| | | | |
