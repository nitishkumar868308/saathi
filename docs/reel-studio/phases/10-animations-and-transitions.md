# Phase 10 — Animations + transitions registry

**STATUS:** not started
**One-line prompt:** `Read docs/reel-studio/README.md, then do Phase 10 of AI Reel Studio.`
**Rules:** README.md ke Standing + Dynamic rules binding. Resume Protocol follow karo.
**Depends on:** Phase 9 complete

**Goal:** animation aur transition **plugin** ki tarah — ek file + ek registry entry se naya
effect add ho. Sab preview aur render me identical.

## Checklist

- [ ] 10.1 `ANIMATIONS` registry entry shape: `{ id, label, params (zod), defaults,
      controls, apply(ctx) }` jahan `apply` frame + params le kar transform/style deta hai.
      Animation **item ke transform ke upar compose** hota hai (overwrite nahi).
- [ ] 10.2 Animations: `kenburns` (zoom in/out with from/to + focal point), `pan`
      (left/right/up/down + amount), `fade` (in/out/both), `slide` (direction + distance),
      `scalePop`, `rotateIn`, `blurIn`. Har ek me easing param.
- [ ] 10.3 Easing library `packages/reel-core/keyframes/easing.ts`: linear, ease-in, ease-out,
      ease-in-out, cubic-bezier(custom), spring (Remotion ka spring). Ek hi implementation
      preview + render dono ke liye.
- [ ] 10.4 `TRANSITIONS` registry: `{ id, label, params, defaults, controls, component }`.
      Transitions: `cut`, `fade`, `crossfade`, `slide` (4 direction), `zoom`, `blur`, `wipe`.
      `@remotion/transitions` use karo jahan fit ho, par interface hamara rahe.
- [ ] 10.5 Transition **do clips ke beech** kaam kare (overlap based) aur clip ke
      `transitionIn/Out` se bhi. Overlap frames doc me explicit hon — implicit magic nahi.
- [ ] 10.6 Transition duration frames me, aur us se aage clip chhota ho to auto-clamp +
      UI warning.
- [ ] 10.7 Timeline UI: clip ke edges pe transition handle/badge, drag se duration,
      click se type change, right-click menu se remove.
- [ ] 10.8 Animation UI: properties panel me "Animation" section — registry se dropdown +
      us animation ke controls (descriptor se generated, Phase 9 ka system).
- [ ] 10.9 Multiple animations ek item pe (stack), order matter kare, reorder ho sake.
- [ ] 10.10 Presets: "Ken Burns slow", "Pop in", "Cinematic drift" — ye sirf param sets hain
      (data, code nahi), ek `animationPresets.ts` list me.
- [ ] 10.11 **Quality guard (A1):** Ken Burns/zoom me source resolution se zyada upscale hone
      pe warning do (e.g. 1080p image ko 1.5x zoom = 1620p chahiye). Ye check Phase 20 validator
      me bhi register karo. Blurry output chupana mana hai.
- [ ] 10.12 Ek naya animation (`rotateIn`) add karke prove karo ki sirf ek file + ek entry
      lagti hai — koi doosri file edit nahi hui (git diff dikhao).
- [ ] 10.13 Test: 3 image clips, teeno pe different animation, beech me crossfade + slide,
      render karo. Rendered video ke 6 frames nikaal ke dikhao ki animation aur transition
      sach me chal rahe hain.
- [ ] 10.14 `npm run typecheck` clean. Commit: "reel-studio: phase 10 — animations + transitions".

## Verify (asli output paste karna)

```
npm run dev:studio      # animation + transition lagao
npm run render:sample   # ya project render
ffmpeg -i out.mp4 -vf fps=2 frames/%02d.png   # frames dekh kar confirm
git diff --stat          # naya animation = 2 files only
```

## Done when

Animations aur transitions registry se aate hain, preview = render, upscale warning aata hai,
aur naya animation add karna sach me 2 file ka kaam hai.

## Progress log

| Date | What was done | Verified by | Next |
|---|---|---|---|
| | | | |
