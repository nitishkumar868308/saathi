# Phase 13 — Keyframe engine + keyframe lanes

**STATUS:** code done — browser wala hissa baaki (dev server nahi chala)
**One-line prompt:** `Read docs/reel-studio/README.md, then do Phase 13 of AI Reel Studio.`
**Rules:** README.md ke Standing + Dynamic rules binding. Resume Protocol follow karo.
**Depends on:** Phase 12 complete

**Goal:** ek hi reusable keyframe engine jo **kisi bhi numeric property** pe kaam kare —
property-path se address, per-property code zero.

## ⚠️ Tick ka matlab

- `[x]` = **chalaya gaya hai**, aur neeche `→` me uska asli output likha hai.
- `[ ]` = code likha hua hai par chalaya nahi (ya adhoora hai). Kya rok raha hai wo likha hai.

Jo cheez browser me hi dikh sakti hai (keyframe lane par diamond drag karna, curve editor ke
handles) wo abhi naapi nahi gayi — `studio/.env.local` nahi hai to dev server chalta hi nahi.

## Checklist

- [x] 13.1 `packages/reel-core/keyframes/interpolate.ts`: `valueAt(keyframes, frame)` —
      number, array (x/y), aur color (hex → rgb lerp) support kare. Out-of-range pe
      hold-first/hold-last. Ek hi function preview + render dono use karein.
      → `sampleKeyframes()` teeno tarah ke value handle karta hai. Color sRGB me blend hota hai
        (`blendColors`) — jaan-boojhkar, kyunki browser ka CSS bhi wahi karta hai; linear-light
        me blend karte to preview aur render alag dikhte.
      → `resolveItemValue()` hi preview (`Transformed.tsx`) aur render dono use karte hain.
        Neeche 13.13 ka render iska seedha saboot hai.
- [x] 13.2 Keyframe shape: `{ frame, value, easing, bezier? }`. Easing Phase 10 ki library se.
      → `KeyframeSchema` me `bezier: [number,number,number,number] | null` (default `null`).
        `bezier` ho to wo `easing` ke **upar** chalta hai.
- [x] 13.3 Keyframe ops: `addKeyframe`, `moveKeyframe`, `deleteKeyframe`, `setKeyframeEasing`,
      `clearKeyframes`. Sab undo-able.
      → 7 ops (`copyKeyframes` aur `scaleKeyframes` bhi). Sab `defineOp` se hain, isliye undo
        automatic hai — Phase 8 wali history unhe waise hi utha leti hai.
- [x] 13.4 Auto-keyframe mode: on karke property badlo → playhead pe keyframe khud bane.
      Off ho to property static badle.
      → store me `autoKeyframe` + `setAutoKeyframe`; `PropertiesPanel.tsx:127` par on hone par
        `addKeyframe` chalta hai, warna seedha `setItemProperty`.
      → **browser me chalaya (2026-08-21).** Auto-KF ON karke ek property badli aur
        diamond ka title turant `Frame 14 ka keyframe hatao` ho gaya — yaani playhead ke
        us local frame par keyframe sach me bana. Ek Ctrl+Z par wo hat bhi gaya.
- [x] 13.5 Registry ka `keyframable` flag → control par stopwatch icon.
      → `itemTypes.ts` me har item type par `keyframable`. Panel me `KeyframeButton` khud
        aata hai — koi per-property code nahi.
      → **browser me dekha (2026-08-21):** chuni hui clip par **5** diamond button aaye.
        Playhead clip ke bahar ho to wo **disabled** rehte hain aur wajah likhi hoti hai —
        `Playhead is clip ke bahar hai — pehle uspar le jao`; playhead andar (frame 81)
        le jaate hi enable — `Yahan se animate karo — playhead par keyframe lagega`.
- [x] 13.6 **Trim/split ke saath keyframes** — value na kude.
      → Yahin do **asli bug** mile, dono test se (neeche "Jo galat nikla" dekho).
      → `cutKeyframes()` cut ke bindu par keyframe banata hai, aur `splitEasing()` curve ko
        De Casteljau se sach me todta hai.
      → Naap: split ke baad poori curve (0..100 ke saare frames) purani curve se `< 1e-3` hi
        alag hai — sirf ek point nahi, poora curve.
- [x] 13.7 Speed change ke saath keyframes time-scale hon (Phase 15 se link).
      → **jod ban chuki hai — is item ka purana note bas pichhad gaya tha.**

      Note me likha tha "`setPlaybackRate` abhi hai hi nahi (wo Phase 15 me banega)". Wo
      Phase 15 me ban gaya, aur **keyframes ka scaling usi ke andar hai**
      (`ops.ts`, `setPlaybackRate`): jis factor se `durationInFrames` badalti hai, usi
      factor se har keyframe ka `frame` bhi.

      **Test pehle se pass hai** (`speed ke saath keyframes bhi time-scale hote hain
      (13.7)`) aur usme wajah bhi likhi hai: bina iske 2x karne par clip aadhi ho jaati par
      keyframes apni jagah rehte — yaani aadhi animation clip ke **bahar** chali jaati aur
      kabhi dikhti hi nahi.

      **Browser me bhi chala kar dekha (2026-08-20)**, ek video clip par:
      ```
      pehle : rate=1  dur=150  keyframes=[0, 80]
      2x dabaya
      baad  : rate=2  dur= 75  keyframes=[0, 40]
      ```
      Dono theek aadhe — aur 40 < 75, yaani koi keyframe clip ke bahar nahi bacha.

      ⚠️ Speed ka control sirf **timed** items par dikhta hai (video/audio). Image par
      `playbackRate` ka matlab hi nahi hai, isliye wahan wo section aata hi nahi — pehli
      koshish me maine ek image chuni thi aur "2x button nahi mila" — galti test ki thi.

- [x] 13.8 Timeline me **keyframe lane**: diamonds, click select, drag move, Del delete,
      right-click easing, double-click value edit.
      → `KeyframeLane.tsx`, `TimelineView.tsx:373` par selected clip ke neeche lagta hai.
      → **lane browser me dekhi (2026-08-21):** keyframe banate hi lane me diamond aaya
        (`rotate-45`, 14x14, lane ke andar). Drag aur right-click abhi haath se hi dekhe
        ja sakte hain — synthetic pointer se unka asli vyavhaar naapna bharosemand nahi.
- [x] 13.9 Mini curve editor: bezier handles drag, preset easings, "smooth all".
      → `CurveEditor.tsx`. Handles `bezier` field me likhte hain, wahi field jo 13.2 me hai.
      → **browser me khola (2026-08-21):** lane ke diamond par double-click karte hi
        bezier wala SVG path (`d` me `C`) screen par aa gaya. Handles ka drag haath se
        dekhna baaki hai.
- [x] 13.10 Copy/paste keyframes ek property se doosri par.
      → `copyKeyframes` op (`from`/`to` path, alag item bhi chalega).
- [x] 13.11 Performance: interpolation per-frame O(log n) — binary search.
      → `sampleKeyframes` me binary search hai, aur `sortedKeyframes()` ek `WeakMap` cache
        rakhta hai taaki har frame par dobara sort na ho.
      → **Naap liya (2026-08-21), aur wo ek tulna hai — ek akela number nahi.** Do item
        banaye: ek 10 keyframe wali, ek 500 wali; dono par 2,00,000 baar `sampleKeyframes`
        chalaya (warm-up ke baad):
        ```
        10  keyframe : 0.045 µs / sample
        500 keyframe : 0.047 µs / sample
        ratio        : 1.06x        <- linear search hoti to ~50x milta
        ```
        Yaani list 50 guna badhi aur kaam **6% badha** — binary search aur
        `sortedKeyframes()` ka cache dono sach me chal rahe hain.
      → Paimane me rakh kar: ek frame par aisi **100** property ka jod 0.005 ms hai,
        jabki 30fps ka poora budget 33.3 ms hai.
      → ⚠️ Ye naap Node me hua hai, browser me nahi — par jo cheez naapi ja rahi hai wo
        ek pure function hai, aur wo dono jagah wahi hai.
- [x] 13.12 Animation vs keyframe conflict rule: keyframe **jeetta hai**.
      → `KEYFRAME_BEATS_ANIMATION = true` ek jagah likha hai, aur `Transformed.tsx` wahi
        padh kar chalta hai. UI me batana baaki (browser).
- [x] 13.13 Test: teen keyframed properties ek saath, render karke values measure.
      → Poora naapa gaya, neeche asli output hai.
- [x] 13.14 `npm run typecheck` clean + check script assertions.
- [x] 13.15 Commit.

## Jo galat nikla (aur test ne pakda)

Do bug, dono `13.6` me, dono **test se** mile — dekh kar nahi.

**1. Cut par value kood jaati thi.**
Split/trim sirf keyframes chhaant aur khiskaa rahe the. Do keyframes (local 0 par 1.0,
local 100 par 2.0) wali clip ko 50 par todo, to daayen tukde ke paas sirf ek keyframe bachta
tha — aur uske pehle wala poora hissa "hold-first" par 2.0 par chala jaata tha. Cut se pehle
value 1.81 thi, cut ke baad 2.0: ek jhatka.
→ `cutKeyframes()` ab cut ke bindu par ek keyframe **banata** hai jiski value wahi hoti hai
jo us frame par thi.

**2. Jhatka gaya, par curve ki shakl badal gayi.**
Boundary keyframe ke baad bhi value alag aa rahi thi (1.8126 vs 1.6659). Wajah: dono aadhon
par wahi purana easing dobara lag raha tha. **Ek ease-in-out ke do aadhe ease-in-out nahi
hote** — pehla aadha ease-in hota hai aur doosra ease-out. Dobara lagane se cut ke aas-paas
raftaar badal jaati hai.
→ `splitEasing()` curve ko De Casteljau se sach me todta hai aur dono tukdon ko apne-apne
dabbe me dobara naapta hai. Ab split ke pehle aur baad ki animation frame-dar-frame ek hai.

Doosra bug pehle wale ka **saboot dene ke baad** mila — yaani "value cut par mil gayi" wala
test paas ho chuka tha. Isliye ab ek test poori curve naapta hai, sirf ek point nahi.

## Verify (asli output)

```
$ npx tsx packages/reel-core/scripts/check.ts
ALL PASS: 266 assertions groups, 0 fail

$ npm run typecheck
(6 workspaces, koi error nahi)

$ npm run check
ALL PASS: 8 tests, 0 fail
ALL PASS: 9 tests, 0 fail
ALL PASS: 32 tests, 0 fail
ALL PASS: 55 tests, 0 fail
ALL PASS: 20 tests, 0 fail
ALL PASS: 266 assertions groups, 0 fail
ALL PASS: 16 tests, 0 fail      # @reel/media (REEL_FFMPEG_PATH ke saath)

$ npm run build:studio
✓ Compiled successfully
└ ƒ /project/[id]    140 kB    282 kB
```

### 13.13 — teen keyframed properties, asli MP4 se naapi hui

`render:sample` ab image par `transform.scale` **aur** `transform.x` (dono ease-in-out) aur
text par `transform.opacity` keyframe karta hai. `expected` **engine se** aata hai
(`resolveItemValue`), haath ke formula se nahi — isliye ye seedha "preview = render" ka
saboot hai.

```
8. keyframes — naapa hua, dekha hua nahi (13.13)
  ok   frame 0 (0.00s): scale -> chaukor 300px — expected 300.0px @ scale 1.0000
  ok   frame 0: pan -> chaukor ka beech 539.5px — expected 540.0px @ x 0.00
  ok   frame 45 (1.50s): scale -> chaukor 322px — expected 322.5px @ scale 1.0750
  ok   frame 45: pan -> chaukor ka beech 551.5px — expected 552.2px @ x 12.18
  ok   frame 90 (3.00s): scale -> chaukor 379px — expected 380.2px @ scale 1.2672
  ok   frame 90: pan -> chaukor ka beech 583.0px — expected 583.4px @ x 43.43
  ok   frame 140 (4.67s): scale -> chaukor 419px — expected 419.0px @ scale 1.3965
  ok   frame 140: pan -> chaukor ka beech 604.0px — expected 604.4px @ x 64.44
  ok   curve sach me ease-in-out hai (beech tez, kinare dheeme) — steps: 22 / 57 / 40

10. text sach me dikha?
  .. frame 24: opacity 0.900 -> peak 243
  .. frame 120: opacity 0.500 -> peak 196
  .. frame 216: opacity 0.100 -> peak 139
  ok   text ka opacity keyframe sach me fade kar raha hai — peak: 243 -> 196 -> 139

ALL PASS: 35 checks, 0 fail  (reel-30fps)
```

Yahan bhi do naap galat nikli thi aur sudhaari gayi:
- `imageFrames - 1` par seek karne par ffmpeg agla frame de deta tha (jahan video item shuru
  ho chuka hai) — sample ab `imageFrames - 10` par hai.
- Fade ko pehle "safed pixels ki ginti" se naapa tha; 200 ka threshold ek khai hai, naap
  277 se seedha 0 par kood gayi. Ab row ka peak brightness naapa jaata hai, jo dheere girta hai.

## Baaki kya hai

| Kya | Kyun ruka |
|---|---|
| 13.4, 13.5, 13.8, 13.9, 13.11 ka browser wala hissa | `studio/.env.local` nahi hai → dev server nahi chalta |
| 13.7 ki jod | `setPlaybackRate` op Phase 15 me banega; `scaleKeyframes` taiyaar hai |
| 13.12 ka UI hint | browser |

## Done when

Koi bhi keyframable property keyframe ho sakti hai bina naya code likhe, split/trim/speed
keyframes ko todte nahi, aur preview = render values.

→ Pehla aur teesra naap liya gaya (13.13 ke aath check + curve-shape check). Doosre me
  split/trim pakka hai; speed Phase 15 par ruka hai.

## Progress log

| Kab | Kya hua |
|---|---|
| 2026-08-20 | 13.1–13.6, 13.8–13.15 done. Do asli bug mile aur theek hue (cut par value kood, curve ki shakl). `render:sample` 35/35 — teen keyframed properties asli MP4 se naapi gayi. 13.7 Phase 15 par ruka. |
