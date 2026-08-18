# Phase 17 — Templates engine + brand token system

**STATUS:** not started
**One-line prompt:** `Read docs/reel-studio/README.md, then do Phase 17 of AI Reel Studio.`
**Rules:** README.md ke Standing + Dynamic rules binding. Resume Protocol follow karo.
**Depends on:** Phase 12 complete (Phase 16 ke baad best)

**Goal:** yahan se reel banana **minuton ka kaam** ban jaata hai. Template = data, brand =
tokens. Template kabhi flattened video nahi — hamesha editable timeline.

## Checklist

- [ ] 17.1 Template format: `{ id, name, description, thumbnail, targetPreset, slots[],
      scenes[] }` — `scenes[]` scene-type + slot bindings ka data hai, code nahi.
      DB `reel_templates.doc jsonb` me.
- [ ] 17.2 `slots[]` declarative: `{ key, label, kind: 'image'|'video'|'audio'|'text'|'color',
      required, hint }`. Template apply karne pe **slot-filling wizard** dikhe (registry se
      generated form).
- [ ] 17.3 `applyTemplate(templateId, filledSlots) -> doc`: `SCENE_TYPES.build()` (Phase 12)
      use karke poora editable doc banao. Missing slot pe placeholder item + saaf badge
      ("Yahan image daalo") — chupchaap khaali nahi.
- [ ] 17.4 Template ka aspect **project preset se adapt** ho: 9:16 template ko 1:1 ya 16:9 pe
      apply karne pe layout re-fit ho (safe-area aware), tudke nahi. Ye dynamic rule ka test hai.
- [ ] 17.5 "Save as template" — mojooda project se template banao (assets ko slot me convert
      karne ka option, ya fixed asset rakhne ka).
- [ ] 17.6 Built-in template: **"Rahul + Papa Conversation"** — 6 scenes
      (Rahul dialogue, Papa dialogue, Problem, App screen recording, character/lipsync slot
      optional, CTA). Sab slots se bhara jaaye.
- [ ] 17.7 Do aur built-in templates: "App feature demo" (screen recording + captions + CTA)
      aur "Testimonial" (photo + voice + quote text). Reels ke saath 1:1 aur 16:9 variants.
- [ ] 17.8 Template gallery UI: thumbnail grid, preview (chhota autoplay preview render se ya
      poster), "Use template" → slot wizard → editable project.
- [ ] 17.9 **Brand tokens:** `reel_brand_presets` — colors (primary/cream/amber + neutrals),
      fonts (heading/body), logo asset, watermark (position/opacity/size), CTA text + link,
      end-screen config. Apka Saathi preset seed karo: `#C25A37`, `#F7F2E9`, `#F4B860`.
- [ ] 17.10 Token resolution: doc me `"brand.primary"` jaisi string; render time pe
      `resolveBrand(doc, preset)` se asli value. Preview aur render dono ek hi resolver se.
- [ ] 17.11 Brand switch: preset badlo → poori reel ka look badle. Par jahan user ne **manual
      override** kiya hai wo bacha rahe (override flag), aur mujhe batao kitne overrides the.
- [ ] 17.12 Watermark/logo/end-screen ko project settings se on/off, aur export dialog se bhi.
- [ ] 17.13 Font handling: brand fonts local `studio/public/fonts/` me, preview + render me
      same `@font-face`. Missing font pe error (Phase 20 validator me register).
- [ ] 17.14 Test: "Rahul + Papa" template se project banao (slots bharo), 2 scenes reorder karo,
      ek dialogue badlo, ek image replace karo, brand preset ka primary color badlo →
      poora look badle. Export karo. Phir **same template ko 1:1 pe** apply karke export karo.
- [ ] 17.15 `npm run typecheck` clean. Commit: "reel-studio: phase 17 — templates + brand".

## Verify (asli output paste karna)

```
npm run dev:studio      # template -> slot wizard -> editable timeline
ffprobe -hide_banner <reel.mp4>  &&  ffprobe -hide_banner <square.mp4>
```

## Done when

Template se ek editable reel 5 minute me ban jaati hai, aspect badalne pe layout theek rehta
hai, brand token badalne se poora look badalta hai, aur manual overrides safe hain.

## Progress log

| Date | What was done | Verified by | Next |
|---|---|---|---|
| | | | |
