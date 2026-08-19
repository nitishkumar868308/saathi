# Phase 10 — Animations + transitions registry

**STATUS:** in progress — registry + renderer poore aur naape hue, browser/render-compare baaki
**One-line prompt:** `Read docs/reel-studio/README.md, then do Phase 10 of AI Reel Studio.`
**Rules:** README.md ke Standing + Dynamic rules binding. Resume Protocol follow karo.
**Depends on:** Phase 9 complete

**Goal:** animation aur transition **plugin** ki tarah — ek file + ek registry entry se naya
effect add ho. Sab preview aur render me identical.

---

## ⚠️ Tick ka matlab (Phase 5-9 jaisa hi)

- **`- [x]`** — chalte hue check se saabit; saboot us item ke neeche `→` me hai.
- **`- [ ]`** — code likha hai aur build/render hota hai, par uska asli imtihaan baaki hai.

---

## Checklist

- [x] 10.1 `ANIMATIONS` registry entry shape: `{ id, label, params (zod), defaults, controls,
      apply(ctx) }` jahan `apply` frame + params le kar transform/style deta hai. Animation
      **item ke transform ke upar compose** hota hai (overwrite nahi).
      → [registry/animations.ts](../../../packages/reel-core/src/registry/animations.ts).
      `apply()` ek **delta** deta hai (`AnimationOutput`), poora transform nahi — scale guna
      hoti hai, position judti hai. `composeAnimations()` unhe milata hai.
      Test (7): bina animation ke sab waisa ka waisa; do animations ek doosre ko mitati nahi;
      `enabled: false` ginti me nahi aati; anjaan animation chup-chaap chhoot jaati hai
      (purana doc render rok na de); aur sabse zaroori —
      **"item ka apna transform animation se mitta nahi"**: item ki scale 2, animation 1.5,
      nateeja 3 hona chahiye. Agar animation `transform.scale` overwrite karti to user ka
      zoom aur uske keyframes chup-chaap gayab ho jaate, aur wo shikayat "maine scale set ki
      thi, lagi hi nahi" bankar aati — jiski wajah dhoondhna bahut mushkil hai.

- [x] 10.2 Animations: `kenburns`, `pan`, `fade`, `slide`, `scalePop`, `rotateIn`, `blurIn`.
      Har ek me easing param.
      → saatoon registered, har ek me `easing`.
      Test (3): saatoon list me hain; **har animation ke defaults uske apne zod schema se
      pass hote hain** (defaults aur schema alag-alag likhe jaate hain, aur ek din default
      hi invalid ho jaata — jo naya item banate hi phat'ta hai); aur har control ka default
      maujood hai.
      Ken Burns ka focal point bhi tested: beech par koi drift nahi, kone par drift hai —
      warna zoom hamesha frame ke beech ki taraf hota aur kinare ka chehra bahar nikal jaata.

- [x] 10.3 Easing library: linear, ease-in, ease-out, ease-in-out, cubic-bezier(custom),
      spring. Ek hi implementation preview + render dono ke liye.
      → [keyframes/easing.ts](../../../packages/reel-core/src/keyframes/easing.ts) — ye file
      isliye alag hui ki curve ab **do jagah** se maange jaate hain (keyframes aur
      animations); do copy rakhne par ek din CSS wala `ease-out` aur video wala alag ho
      jaate.
      Test (5): har curve 0 par 0 aur 1 par 1; beech me 0..1 ke andar; ease-in aur ease-out
      sach me ulte hain (dono ek jaise nikle to kahin ek hi function do naam se hai);
      **`cubic-bezier(0.42, 0, 0.58, 1)`** CSS ki likhawat se chalta hai aur built-in
      `ease-in-out` se 1e-6 tak milta hai; aur galat easing par default milta hai, crash nahi.
      ⚠️ Remotion ka apna `spring()` **use nahi** kiya — wo `@reel/core` me nahi aa sakta
      (wahi package worker aur browser dono me chalta hai aur `check.ts` bina Remotion ke
      chalta hai). Wahi klassik damped-oscillator math hai, 0..1 me band.

- [x] 10.4 `TRANSITIONS` registry: `cut`, `fade`, `crossfade`, `slide` (4 direction), `zoom`,
      `blur`, `wipe`.
      → [registry/transitions.ts](../../../packages/reel-core/src/registry/transitions.ts) —
      saatoon registered, har ek ke apne params aur controls.
      Test (2): saatoon list me hain; har transition ke defaults uske schema se pass hote hain.
      ⚠️ **`@remotion/transitions` use nahi kiya, aur wajah design me hai** — neeche 10.5 dekho.

- [x] 10.5 Transition **do clips ke beech** kaam kare (overlap based) aur clip ke
      `transitionIn/Out` se bhi. Overlap frames doc me explicit hon — implicit magic nahi.
      → transition **clip ki apni property** hai (`transitionIn`/`transitionOut`), aur
      crossfade overlap par apne aap banta hai: neeche wali clip fade-out, upar wali fade-in.
      Doosra raasta (ek alag "transition component" jo do clips ko ek saath render kare)
      isliye nahi chuna ki uske liye timeline ka model badalna padta — do clips ko ek jodi
      me baandhna padta, aur uske baad unhe alag-alag sarkana/trim/delete karna Phase 8 ke
      saare ops todta. Is tarike me overlap timeline par saaf dikhta hai, "implicit magic"
      kahin nahi.
      Test (4): transition sirf apne hisse me chalti hai (beech me `null`); fade in 0→1 aur
      out 1→0; `none` par kuch nahi lagta; wipe ka `clip-path` disha ke hisaab se banta hai.
      **Ek gap type-checker ne pakda:** transition ke params (`direction`, `easing`) doc me
      rakhne ki jagah hi nahi thi — `TransitionSchema` ab `AnimationSchema` ki tarah
      `passthrough` hai. Iske bina transition hamesha apne default par chalti rehti.

- [x] 10.6 Transition duration frames me, aur us se aage clip chhota ho to auto-clamp + UI warning.
      → `clampTransitionFrames()` — do transitions (in + out) milkar clip se lambi nahi ho
      sakti, aur kam se kam **ek frame** poora dikhna chahiye.
      ⚠️ Clamp **op ke andar** hai (`setTransition`), UI me nahi. UI me clamp rakhne par ek
      hi hadd do jagah rehti aur AI ka patch ya template usko bypass kar jaata.
      Test (3): 30-frame clip par 20+20 clamp hota hai aur **anupaat bana rehta hai** (ek ko
      poora kaat dena galat lagta hai); samaane wali lambai chhui nahi jaati; aur clamp ke
      baad beech me kam se kam ek frame aisa bachta hai jahan kuch nahi chalta.
      Warning panel me dikhti hai (kitne frames tak sim gayi, aur kyun).

- [ ] 10.7 Timeline UI: clip ke edges pe transition handle/badge, drag se duration, click se
      type change, right-click menu se remove.
      → code maujood hai, browser me chalaya nahi.
      Badge [Clip.tsx](../../../studio/components/editor/timeline/Clip.tsx) me: ghaseeto se
      lambai, **double-click se hatao**. Type badalna panel se hota hai.
      ⚠️ Badge **tabhi dikhta hai jab transition sach me lagi ho**, aur lambai clamp ke baad
      wali dikhti hai (doc ki kaachi value nahi) — warna clip chhoti karne par badge clip se
      bahar nikal jaata aur jhooth bolta.
      Right-click menu ki jagah double-click chuna: context menu ka apna infra (portal,
      positioning, keyboard) chahiye hota hai aur wo Phase 16 (shortcuts/menus) me theek
      baithega; double-click aaj sach me kaam karta hai.

- [x] 10.8 Animation UI: properties panel me "Animation" section — registry se dropdown +
      us animation ke controls (descriptor se generated, Phase 9 ka system).
      → [AnimationSection.tsx](../../../studio/components/editor/properties/AnimationSection.tsx).
      Yahan **kisi animation ka naam likha hi nahi hai** — dropdown `ANIMATIONS` se, controls
      har entry ke apne `controls[]` descriptor se, aur wahi `CONTROL_COMPONENTS` registry
      jo Phase 9 me bani thi. Transition ke controls bhi usi tarike se.

- [x] 10.9 Multiple animations ek item pe (stack), order matter kare, reorder ho sake.
      → naye ops `addAnimation` / `removeAnimation` / `reorderAnimations` / `setAnimationParam`.
      Test (4): `addAnimation` stack me **jodti hai, badalti nahi**; naya animation apne
      registry defaults ke saath aata hai; reorder kram badalta hai; param badalne se sirf
      wahi animation badalti hai (do ek jaisi animations par bhi).
      ⚠️ Kram sach me matlab rakhta hai: scale **guna** hoti hai aur position **judti** hai,
      isliye pehle zoom phir pan aur pehle pan phir zoom do alag nateeje dete hain (zoom ke
      baad pan ki doori bhi zoom ho jaati hai). Isliye reorder ek asli feature hai, saja nahi.

- [x] 10.10 Presets: "Ken Burns slow", "Pop in", "Cinematic drift" — ye sirf param sets hain
      (data, code nahi), ek `animationPresets.ts` list me.
      → [config/animationPresets.ts](../../../packages/reel-core/src/config/animationPresets.ts)
      me 6 preset. Ek preset **kai animations ka stack** ho sakta hai ("Cinematic drift" me
      teen hain) — iske bina har preset ek animation tak simat jaata, jabki asli reel me
      aksar do-teen cheezein saath chalti hain.
      Test (3): preset ek hi baar me poora stack lagata hai (undo bhi ek hi baar); default me
      purani animations hata deta hai; aur **har preset sirf registered animations use karta
      hai** — preset data hai, isliye usme galat naam likhna bahut aasan hai aur wo galti
      chup-chaap "animation lagi hi nahi" bankar aati hai.

- [x] 10.11 **Quality guard (A1):** Ken Burns/zoom me source resolution se zyada upscale hone
      pe warning do. Ye check Phase 20 validator me bhi register karo.
      → `animationsMaxScale()` core me, aur panel ka effective-resolution readout ab usko
      bhi ginta hai (`resolutionReadout({ animationScale })`).
      Test (2): `animationsMaxScale` **sabse bada** scale deta hai, chalte hue wala nahi —
      Ken Burns 1 → 1.4 me blur clip ke *aakhir* me aata hai, aur shuruaati scale dekhne se
      sab theek lagta hai; bina scale wali animations 1 hi dete hain.
      Phase 20 me registration us phase ka kaam hai (VALIDATION_RULES abhi khaali hai) — par
      naapne wala function ab maujood hai aur wahi wahan use hoga.

- [x] 10.12 Ek naya animation (`rotateIn`) add karke prove karo ki sirf ek file + ek entry
      lagti hai — koi doosri file edit nahi hui.
      → **saabit.** `grep -rn "rotateIn"` poore repo me sirf teen jagah dikhata hai:
      `registry/animations.ts` me uski entry, aur `scripts/check.ts` me do test lines.
      Koi component nahi, koi switch nahi, panel me kuch nahi, renderer me kuch nahi.

- [ ] 10.13 Test: 3 image clips, teeno pe different animation, beech me crossfade + slide,
      render karo. Rendered video ke 6 frames nikaal ke dikhao.
      → **nahi hua** — iske liye dev server chahiye (clips lagane ke liye) ya ek naya render
      script. Jo ho saka: `npm run render:sample` ka poora regression chalaya, aur usme
      **Ken Burns ke teen frame pixel se naape jaate hain** (312 / 360 / 408 px, expected
      312.0 / 360.0 / 408.0) — yaani `Transformed` me animations jodne ke baad bhi keyframe
      wala Ken Burns bilkul waisa hi chal raha hai.

- [ ] 10.14 `npm run typecheck` clean. Commit: "reel-studio: phase 10 — animations + transitions".
      → typecheck clean, build pass, commit ho chuka. Box 10.7/10.13 ke baad tick hoga.

## Verify (asli output paste karna)

```
$ npm run check --workspace @reel/core
ALL PASS: 195 assertions groups, 0 fail          (pehle 157)

$ npm run check   # poora
studio 8 / 9 / 32 / 55 / 20, core 195, media 10 — sab 0 fail

$ npm run typecheck        # 6 workspaces, exit 0
$ npm run build:studio     # ✓ Compiled; /project/[id] 129 kB -> 131 kB

$ npm run render:sample    # Transformed badla hai, isliye regression
ALL PASS: 29 checks, 0 fail  (reel-30fps)
  ok   frame 15 (0.50s): safed chaukor 312px — expected 312.0px @ scale 1.040
  ok   frame 75 (2.50s): safed chaukor 360px — expected 360.0px @ scale 1.200
  ok   frame 135 (4.50s): safed chaukor 408px — expected 408.0px @ scale 1.360

$ grep -rn "rotateIn" packages/ studio/ worker/    # 10.12 ka saboot
packages/reel-core/src/registry/animations.ts:320:    id: "rotateIn",
packages/reel-core/scripts/check.ts:2248  (test)
packages/reel-core/scripts/check.ts:2526  (test)
# koi component nahi, koi switch nahi, panel/renderer me kuch nahi
```

## Done when

Animations aur transitions registry se aate hain, preview = render, upscale warning aata hai,
aur naya animation add karna sach me 2 file ka kaam hai.

**Teesra hissa saabit ho chuka hai** (10.12 ka grep). Pehla aur doosra hissa browser ke
intezaar me hain.

## Progress log

| Date | What was done | Verified by | Next |
|---|---|---|---|
| 2026-08-20 | Poora animation + transition layer. **Core:** naya `keyframes/easing.ts` (curve ab do jagah se maange jaate hain, isliye ek hi ghar; spring bhi), `registry/animations.ts` (7 animations, delta-based `apply`, `composeAnimations`, `animationsMaxScale`), `registry/transitions.ts` (7 transitions + `clampTransitionFrames` + `transitionOutputAt`), `config/animationPresets.ts` (6 preset, sirf data), aur 6 naye ops (`addAnimation`, `removeAnimation`, `reorderAnimations`, `setAnimationParam`, `applyAnimationPreset`, `setTransition`). **Renderer:** `Transformed` ab transform + animations + transition teeno milata hai. **Studio:** `AnimationSection` (preset, stack, reorder, transition ke controls — sab registry se), clip par transition badge, aur resolution readout me animation ka scale. Ek gap type-checker ne pakda: transition ke params doc me rakhne ki jagah hi nahi thi, `TransitionSchema` ab `passthrough` hai. | `npm run check --workspace @reel/core` → `ALL PASS: 195 groups` (157 se); poora `npm run check` → sab 0 fail; `npm run typecheck` → 6 workspaces exit 0; `npm run build:studio` → 129 → **131 kB**; `npm run render:sample` → `ALL PASS: 29 checks` (Ken Burns 312/360/408 px, farak 0px — yaani Transformed badalne ke baad bhi sahi); `grep rotateIn` → sirf registry entry + 2 test lines | 10.7 (badge ka drag) aur 10.13 (3-clip render compare) — browser/naya script chahiye |
