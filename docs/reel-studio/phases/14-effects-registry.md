# Phase 14 — Effects registry + color pipeline

**STATUS:** not started
**One-line prompt:** `Read docs/reel-studio/README.md, then do Phase 14 of AI Reel Studio.`
**Rules:** README.md ke Standing + Dynamic + A1 Quality rules binding. Resume Protocol follow karo.
**Depends on:** Phase 13 complete

**Goal:** effects **sirf configuration** hon (`{type, amount, enabled}`), ek hi pipeline se
apply hon. Kisi item component ke andar effect hardcode karna mana hai.

## Checklist

- [ ] 14.1 `EFFECTS` registry: `{ id, label, params (zod), defaults, controls, keyframable
      params, apply(style, params) }`. CSS-filter based effects ek generic path se.
- [ ] 14.2 Effects: `blur`, `brightness`, `contrast`, `saturation`, `grayscale`, `sepia`,
      `hue-rotate`, `opacity`, `vignette` (overlay based), `sharpen` (jahan practical ho),
      `dropShadow`, `roundedCorners`, `border`.
- [ ] 14.3 `applyEffects(item, frame)` — ek hi function jo effect stack ko order me compose
      kare aur final style de. `ItemRenderer` isko call kare; item components effects ke bare
      me kuch na jaanein.
- [ ] 14.4 Effect stack per item: add/remove/reorder/enable-disable, order matter kare.
- [ ] 14.5 Effect params **keyframable** (Phase 13 ka engine reuse) — e.g. blur 0 → 10.
- [ ] 14.6 Effect presets (data): "Soft glow", "Cinematic contrast", "B&W", "Vintage" —
      sirf param sets.
- [ ] 14.7 Track-level / project-level effect (optional but designed): registry same,
      apply scope alag. Agar abhi implement na karo to schema me jagah rakho aur UI me
      button **na dikhao**.
- [ ] 14.8 **A1 quality rules:** effects render me GPU/CSS se lagein (Remotion browser me),
      double-compression na ho. Blur jaise heavy effects pe render time impact measure karke
      mujhe batao. Banding aane par saaf batao (koi "quality ok" ka jhooth nahi).
- [ ] 14.9 Masking base (spec §17): `mask` field per item — `{ shape: rect|rounded|circle,
      inset, radius, feather }` + `image mask` ke liye jagah. Basic shapes implement karo
      (CSS clip-path / mask), image mask ko schema me rakho par UI band jab tak na bane.
- [ ] 14.10 Overlays: image/video overlay item ko blend mode ke saath (`normal, multiply,
      screen, overlay`) — registry se.
- [ ] 14.11 UI: properties panel me "Effects" section — add-effect dropdown (registry se),
      har effect ka collapsible card with generated controls, drag to reorder, eye toggle.
- [ ] 14.12 Ek naya effect (`hue-rotate`) add karke `git diff --stat` se prove karo ki
      sirf 1–2 file lagi.
- [ ] 14.13 Test: ek video clip pe blur keyframe (0→8) + brightness + rounded corners +
      drop shadow, ek image pe vignette + grayscale. Render karo, 4 frames dikhao,
      aur preview vs render compare karo.
- [ ] 14.14 `npm run typecheck` clean. Commit: "reel-studio: phase 14 — effects registry".

## Verify (asli output paste karna)

```
npm run dev:studio
# render + frame extract
git diff --stat     # naya effect = 1-2 files
```

## Done when

Effects poore config-driven hain, stack order kaam karta hai, params keyframable hain,
basic masks chalte hain, aur preview = render.

## Progress log

| Date | What was done | Verified by | Next |
|---|---|---|---|
| | | | |
