# Phase 8 — Timeline editing: move / trim / split / cut / duplicate + undo

**STATUS:** in progress — core poora aur naapa hua, UI ka pointer wala hissa browser-verify baaki
**One-line prompt:** `Read docs/reel-studio/README.md, then do Phase 8 of AI Reel Studio.`
**Rules:** README.md ke Standing + Dynamic rules binding. Resume Protocol follow karo.
**Depends on:** Phase 7 complete

**Goal:** yahan editor "asli editor" banta hai. Professional cut/trim/split, frame-accurate,
**non-destructive**. Ye phase sabse zyada dhyaan se karna hai.

---

## ⚠️ Tick ka matlab (Phase 5/6/7 jaisa hi)

- **`- [x]`** — chalte hue check se saabit; saboot us item ke neeche `→` me hai.
- **`- [ ]`** — code likha hai aur build hota hai, par uska asli imtihaan baaki hai
  (browser ka pointer, ya `studio/.env.local`).

**Is phase ki khaas baat:** yahan ka **poora dimaag core me hai** (`packages/reel-core/src/
timeline/ops.ts`), aur core bina browser ke chalta hai. Isliye is phase ka zyada hissa sach
me naapa gaya hai — 85 se **132 assertion groups**. Jo bacha hai wo sirf ungli ka kaam hai:
ghaseetna, kinare kheenchna, key dabana.

---

## Checklist

- [ ] 8.1 Drag to move: horizontal (time) + vertical (track change, sirf compatible track type pe).
      Drag ke dauraan ghost preview, drop pe ek `moveItem` op — poora drag **ek undo entry**
      (history coalesce).
      → code maujood hai, browser me ghaseeta nahi.
      [useClipDrag.ts](../../../studio/components/editor/timeline/useClipDrag.ts) +
      [clipEdit.ts](../../../studio/lib/clipEdit.ts). Drag ke dauraan **doc ko haath nahi
      lagta** — sirf ek local ghost hilta hai, aur op drop par ek baar chalta hai; isliye
      "poora drag ek undo entry" apne aap sach hai, coalesce ki zaroorat hi nahi padti.
      Jo naapa ja saka wo naapa gaya — "ghost drop se mel khata hai" ke 6 test: move ka
      ghost aur `moveItems` ka nateeja frame-dar-frame ek jaisa, 0 par clamp dono jagah
      poore group par, aur track shift list ke bahar nahi jaata.
      ⚠️ Pointer listener `window` par lagte hain, element par nahi — tez ghaseetne par
      pointer clip se bahar nikal hi jaata hai aur element wale listener wahin chhoot jaate.

- [ ] 8.2 Snapping: playhead, doosre clips ke edges, track start, project end, aur scene
      boundaries. Threshold px me (zoom-aware), snap indicator line dikhe, `Alt` dabaye rakhne
      pe snapping band.
      → indicator browser me dekha nahi gaya; baaki sab naapa hua hai (7 test).
      `snapCandidates()` me playhead, har doosri clip ke **dono** kinare, 0, project ka ant,
      in/out, aur scene ki seemaayein — sab ek list me, isliye nayi kism ka snap jodna ek
      line hai.
      Hadd **px me** hai (`SNAP_THRESHOLD_PX = 8`) aur zoom ke saath frames me badalti hai —
      frames me rakhne par zoom-out par snapping bekaar aur zoom-in par chipku ho jaati hai.
      ⚠️ Test me ek baat khaas hai: **daayan kinara bhi snap karta hai**. Sirf baayan dekhna
      sabse aam galti hai — clip ko doosri clip ke *baad* lagana ho to tumhara daayan kinara
      uske baayein kinare se milta hai, aur baayein-wala snap wahan kabhi lagta hi nahi.
      Alt par snapping poori band — wo bhi test me hai.

- [ ] 8.3 Trim left / right edge drag: `trimStartFrame` + `durationInFrames` badle,
      **source ki limit pe clamp** (image ka koi limit nahi, video/audio ka duration limit hai).
      Trim ke dauraan live frame preview.
      → **source ki hadd lag gayi aur naapi gayi**; live frame preview baaki hai.
      `trimItemEnd` ab `sourceDurationFrames` leta hai (Phase 5 ke asli `duration_ms` se,
      [assetMeta.ts](../../../studio/lib/assetMeta.ts) ek hi request me poori list laata hai).
      Iske bina clip source ke aage khinch jaati hai aur render me wahan **kaala frame** aata
      hai — timeline me bilkul theek dikhta hai, sirf final MP4 me pakda jaata hai.
      Test (7): source ke ant par rukna, `trimStartFrame` bachi hui lambai ghata deta hai,
      image par koi upar ki hadd nahi, **2x speed par source aadha hi jaldi khatam hota hai**,
      aur ghost ki hadd op ki hadd se bilkul milti hai (warna chhodte hi clip kood jaati).

- [x] 8.4 Split at playhead (`S`): selected clip (ya playhead ke neeche wale sab) do items me.
      Verify: dono ke frames ka jod original ke barabar, koi gap/overlap nahi, dono
      independently editable, dono ke keyframes sahi jagah shift/split hue.
      → **naya op `splitAtFrame`** — ek hi op me saari clips todta hai, isliye **undo ek hi
      baar** (har clip par alag op chalane se 5 clips ke liye 5 Ctrl+Z lagte).
      Test (3): `left.duration + right.duration === original.duration`, `right.startFrame ===
      left.startFrame + left.duration` (koi gap/overlap nahi), `right.trimStartFrame`
      source me theek utna aage, keyframes sahi tukde par aur **naye item ke apne start se
      gine hue** (90 wala keyframe 40 par aata hai), aur dono tukde alag-alag sarkte hain.
      ⚠️ Locked clips chhod di jaati hain, error nahi aata — lock ka matlab "isko mat chhedo"
      hai, "kuch mat karo" nahi.

- [x] 8.5 In/Out points ka use: **Cut selection** (in-out ke beech ka hissa hatao) aur
      **Keep selection** (sirf in-out ke beech rakho). Dono ripple aur non-ripple mode me.
      → `cutRange` aur `keepRange`, dono `ripple` ke saath aur bina.
      Dono ke neeche ek hi helper hai — **`removeSpan`**, jo is phase ka dil hai. Ek clip
      span se chaar tarah mil sakti hai (poori andar / poori dhak rahi / daayan kinara /
      baayan kinara) aur chaaron ka apna jawab hai. Teen jagah teen baar likhne par teeno
      alag tarah se galat hoti hain.
      Test (11): chaaron case alag-alag, **`trimStartFrame` ka sahi badalna** (baayan kinara
      katne par source bhi utna aage — sirf `startFrame` badalna wo galti hai jo render me
      hi pakdi jaati hai), 2x speed par pointer dugna khiskta hai, locked clip chhui nahi
      jaati, ripple/non-ripple dono, ulti range par saaf error, aur `trackIds` dene par sirf
      wahi track kat'ta hai.

- [x] 8.6 Delete (`Del`) + **Ripple delete** (`Shift+Del`) — ripple me aage ke clips khisak jaayein
      (sirf usi track pe, ya "ripple all tracks" option se sab pe).
      → naya op `rippleDeleteItems` (`allTracks` ke saath).
      Test (6): ek clip par gaddha bhar jaata hai, do clips par dono gaddhe (aur gaddhe
      peeche se aage bharte hain — ulta karne par pehla shift baaki gaddhon ki jagah hi
      badal deta), bina `allTracks` ke doosra track chhuta nahi, `allTracks` par doosre
      track ki aage wali clips bhi khiskti hain, aur locked clip par saaf error.
      ⚠️ **Gaddhe ke beecho-beech padi clip chhui nahi jaati** (sirf `allTracks` me ho sakta
      hai). Usko kaat dena ek chupchaap hone wala data-loss hota — user ne to sirf doosre
      track ki ek clip delete ki thi. Poora hissa hataana ho to `cutRange` hai, jo ye kaam
      maang kar karta hai.

- [ ] 8.7 Duplicate (`Ctrl+D`): naye id, turant baad me place, ya same jagah alternate track pe
      (jo khaali ho). Keyframes/effects/transitions bhi copy hon.
      → **aadha.** `duplicateItems` (Phase 1 se) naye id deta hai, turant baad me rakhta hai,
      aur poora item clone karta hai — keyframes/effects/transitions sab saath aate hain.
      `Ctrl+D` shortcut registry me juda.
      **Jo nahi bana:** "same jagah alternate track pe (jo khaali ho)" wala vikalp. Ye
      jaan-boojhkar chhoda hai, chhupaya nahi — uske liye "khaali track" ka matlab tay karna
      padega (poora khaali? us span par khaali?) aur wo faisla Phase 16 (track manager) ke
      saath lena zyada theek rahega.

- [ ] 8.8 Copy / Cut / Paste (`Ctrl+C/X/V`): paste playhead pe, cross-project paste bhi
      (clipboard me doc-fragment JSON).
      → **core saabit hai, clipboard ka plumbing browser me chalaya nahi.**
      `copyItems()` + `pasteItems` op + [clipboard.ts](../../../studio/lib/clipboard.ts).
      Test (6): paste playhead par girta hai aur naya id milta hai; kai clips ki **aapas ki
      doori bani rehti hai**; **24fps se 30fps me paste karne par lambai seconds me bani
      rehti hai** (48 frames -> 60 frames — frames waise ke waise chipkane par clip 20%
      chhoti ho jaati aur wo galti dikhti nahi, sirf "ajeeb" lagti); original track na mile
      to compatible track par girta hai; koi compatible track hi na ho to saaf error; aur
      copy doc ko chhuta tak nahi.
      ⚠️ Clipboard **do jagah** likhta hai. `navigator.clipboard` sirf secure context me
      chalti hai aur user mana kar sakta hai; cross-project paste uske bina nahi hoga, par
      usi project me copy-paste tootna nahi chahiye — isliye ek andar wali copy bhi rehti hai.

- [x] 8.9 Overlap policy config se: `overwrite` (default, upar wala jeete) ya `push` (aage khiskao)
      ya `reject`. Ek jagah decide ho, har op isko maane.
      → [config/overlap.ts](../../../packages/reel-core/src/config/overlap.ts) me teeno
      policy **data** ki tarah; `resolveOverlaps()` ek hi jagah, aur `moveItems`/`pasteItems`
      dono usi ko bulate hain. Toolbar ka select bhi usi list se banta hai.
      Test (5): overwrite me neeche wali clip kat jaati hai; overwrite me beech me girne par
      neeche wali **do tukde** ho jaati hai; push me kuch kat'ta nahi, sirf khisakta hai
      (dono clip poori lambai ke saath bachi rehti hain); reject par saaf error; aur bina
      overlap ke teeno policy bilkul ek jaisa nateeja deti hain.

- [ ] 8.10 Nudge: arrow keys se selected clip 1 frame, Shift+arrow se 1 second.
      → code maujood hai, key browser me dabayi nahi.
      ⚠️ **Yahan 6.4 se takraav tha aur faisla soch kar liya gaya hai.** 6.4 kehta hai arrow
      se playhead ek frame khiske; 8.10 kehta hai arrow se chuni hui clip khiske. Ek chunne
      par doosra marta. Isliye arrow ka matlab halat par tay hota hai: **kuch chuna hua hai
      to clip hilti hai, warna playhead.** Clip chun kar arrow dabane wala aadmi playhead
      hilana chahta hi nahi tha; aur selection chhodne ke liye Esc bilkul saamne hai.
      Lagataar arrow dabane par sab ek hi undo entry me milte hain (`coalesceKey`) — warna
      20 baar arrow ke baad 20 baar Ctrl+Z dabana padta.

- [x] 8.11 Multi-item ops: move/trim/delete/duplicate selection ke saare items pe, relative
      spacing bani rahe.
      → `moveItems` sab par **ek hi delta** lagata hai, isliye aapas ki doori apne aap bani
      rehti hai. `deleteItems` / `rippleDeleteItems` / `duplicateItems` / `copyItems` sab
      pehle se list lete hain. (Trim hamesha ek hi clip ka rehta hai — ye jaan-boojhkar hai,
      do alag lambai wali clips ka "ek saath trim" ka koi ek matlab hota hi nahi.)
      Test (5): doori bani rehti hai; **0 par clamp poore group par lagta hai, ek clip par
      nahi** (alag-alag clamp karne se baayein wali ruk jaati aur baaki chalti rehti — yaani
      selection ki shakl hi badal jaati, jo user ne kabhi nahi kaha); track badalna
      **sab-ya-kuch-nahi** hai aur fail hone par doc bilkul waisa ka waisa rehta hai; locked
      clip par error.

- [ ] 8.12 **Non-destructive proof**: `reel_assets` ka koi row aur R2 ka koi file kisi bhi op se
      na badle. Ye ek test se prove karo (checksum before/after).
      → **doc-level saabit hai, DB/R2 level baaki hai.**
      Test (2): saat alag-alag ops ki ek lambi chain ke baad koi naya `assetId` nahi aata,
      koi `trimStartFrame` negative nahi hota, koi clip 1 frame se chhoti nahi hoti aur koi
      timeline se pehle nahi jaati; aur **koi op purana doc badalta hi nahi** (immutability).
      Structural taur par ops file me `fs`/storage ka koi import hai hi nahi — `@reel/core`
      me Node ka koi API nahi aata (wo browser me bhi chalta hai).
      **Jo baaki hai:** `reel_assets` ki rows aur R2 ki files ka asli checksum before/after —
      uske liye `studio/.env.local` chahiye.

- [x] 8.13 Undo/redo har op pe sahi (drag = 1 entry, multi-delete = 1 entry). 30 ops karke
      30 baar undo karo — doc bilkul shuruaati jaisa (deep equal) ho. Ye test script se prove karo.
      → Test: 10 alag-alag kism ke op × 3 round = **30 ops, phir 30 undo → `deepEqual` shuruaati
      doc ke saath**. Redo ka apna test bhi (5 undo + 5 redo = wahi doc).
      ⚠️ Ek test khaas isliye juda ki mera apna pehla version isi par phisla tha: **history
      no-op edit ki entry banati hi nahi**. Maine ek cut aisi jagah lagayi thi jahan kuch tha
      hi nahi, aur "30 ops" chupchaap 28 ho gaye. Ab har op ke baad jaancha jaata hai ki doc
      sach me badla — bina us jaanch ke ye test jhootha ho jaata hai.

- [x] 8.14 `recomputeDuration` har structural op ke baad — project duration khud adjust ho
      (aur last clip delete karne pe chhoti ho).
      → `STRUCTURAL_OPS` ek **list** hai (if-else nahi), aur store ka `applyOp` structural op
      ke baad `recomputeDuration` **usi history entry ke andar** chalata hai — alag op ki
      tarah nahi, warna ek clip delete karne par do baar Ctrl+Z dabana padta.
      Test (2): aakhri clip delete karne par project 300 → 200 frames; aur list me har
      badalne wala op maujood hai (naya structural op jodte waqt naam daalna bhool jaana
      bilkul aam hai, aur uska nateeja ye ki lambai chupchaap purani padi rehti hai).
      ⚠️ Items khaali hon to lambai ko haath nahi lagate — exact ginti wahan 1 frame deti
      hai, aur naya khaali project 1 frame ka ho jaana toota hua lagta.

- [ ] 8.15 Performance: 200 clips pe drag/trim 60fps rahe (kaam UI thread pe halka rakho,
      op sirf drop pe).
      → design isi ke hisaab se hai (drag me sirf ghost hilta hai, doc/history/autosave teeno
      sote rehte hain; clips pehle se virtualized hain — 7.7), par **200 clips par naapa nahi
      gaya**. Ye number browser ke bina nikalta hi nahi.

- [x] 8.16 `packages/reel-core/scripts/check.ts` me naye assertions: cut/keep selection,
      ripple delete, split with keyframes, overlap policy, undo round-trip.
      → paanchon jud gaye aur uske alawa bhi: multi-move, trim ki hadd, copy/paste,
      duration, non-destructive. `npm run check --workspace @reel/core` → **85 se 132
      assertion groups**, 0 fail.

- [ ] 8.17 Manual test aur mujhe dikhao: ek 20s video clip lo → 5s–12s keep selection →
      10s pe split → ek clip duplicate → ek move → undo 5 baar → redo 5 baar.
      Har step ka frame number output paste karo.
      → **script se ho gaya, UI se nahi.** `npm run edit-sequence --workspace @reel/core`
      ([edit-sequence.ts](../../../packages/reel-core/scripts/edit-sequence.ts)) wahi
      sequence chalati hai aur har step ke frame numbers chhaapti hai. Output neeche "Verify"
      me hai. Ye saabit karta hai ki **ops** sahi hain; button sach me chalte hain ya nahi
      wo dev server par hi dikhega.

- [ ] 8.18 `npm run typecheck` clean. Commit: "reel-studio: phase 8 — timeline editing ops".
      → typecheck **clean hai** (6 workspaces, exit 0), `npm run build:studio` bhi pass,
      commit ho chuka. Box tab tick hoga jab UI wale item bhi ho jaayein.

## Verify (asli output paste karna)

```
$ npm run check --workspace @reel/core
ALL PASS: 132 assertions groups, 0 fail          (pehle 85 the)

$ npm run check --workspace @reel/studio
ALL PASS: 8 / 9 / 32 / 55 tests, 0 fail          (timeline 38 se 55)

$ npm run edit-sequence --workspace @reel/core   # checklist 8.17
0. Shuruaat — ek 20s clip
         : 0-600 (00:00:00->00:20:00, trim@0)          project: 600 frames
1. Keep selection 150-360 (5s-12s, ripple)
         : 0-210 (00:00:00->00:07:00, trim@150)        project: 210 frames
2. Split @ frame 150 (keep ke baad wala 10s)
         : 0-150 (00:00:00->00:05:00, trim@150)
         : 150-210 (00:05:00->00:07:00, trim@300)      project: 210 frames
3. Daayein wala tukda duplicate
         : 0-150   / 150-210 / 210-270 (trim@300)      project: 270 frames
4. Copy ko +60 frame aage sarkao
         : 0-150   / 150-210 / 270-330                 project: 330 frames
5. Copy ko +30 frame aur aage
         : 0-150   / 150-210 / 300-360                 project: 360 frames
--- undo x5 ---   -> 0-600, project 600 frames
  ok   doc bilkul shuruaati jaisa hai (deep equal)
--- redo x5 ---   -> 0-150 / 150-210 / 300-360, project 360
  ok   doc bilkul paanch ops wala hai (deep equal)
SEQUENCE OK — 5 ops, 5 undo, 5 redo, dono taraf deep-equal

$ npm run typecheck        # 6 workspaces, exit 0
$ npm run build:studio     # ✓ Compiled successfully; /project/[id] 123 kB

# Ye tab, jab studio/.env.local aa jaaye:
npm run dev:studio    # upar wala sequence maus se, aur 8.12 ka DB/R2 checksum
```

**Padhne layak ek baat:** step 2 me split `frame 150` par laga hai, `300` par nahi — kyunki
keep selection ke baad wo clip 0 se shuru ho chuki hai, isliye source ka 10s ab timeline ke
5s par hai. `trim@300` uski gawahi hai (source me 300 frames = 10 second). Yahi wo cheez hai
jo aankh se dekhne par kabhi saaf nahi hoti.

## Done when

Saare ops frame-accurate hain, non-destructive hain (checksum proof), undo round-trip exact hai,
aur 200-clip project pe UI smooth hai.

## Progress log

| Date | What was done | Verified by | Next |
|---|---|---|---|
| 2026-08-19 | Poora editing layer. **Core:** naya `removeSpan` primitive (is phase ka dil — cut, keep aur overwrite teeno usi par khade hain), `resolveOverlaps` + `config/overlap.ts` (8.9), aur naye ops `moveItems`, `rippleDeleteItems`, `cutRange`, `keepRange`, `pasteItems`, `splitAtFrame`, plus `copyItems()` helper aur `STRUCTURAL_OPS` list. `trimItemEnd` ab source ki hadd maanta hai. **Studio:** `lib/clipEdit.ts` (snapping/ghost/trim ka ganit), `useClipDrag` hook (drag+trim, op sirf drop par), `lib/clipboard.ts`, `lib/assetMeta.ts` (source ki asli lambai), Clip me trim handles, timeline toolbar me overlap policy + Cut/Keep, aur shortcuts me editing group (S / Del / Shift+Del / Ctrl+D / Ctrl+C / Ctrl+X / Ctrl+V). Store: `overlapPolicy`, aur structural op ke baad usi entry me `recomputeDuration`. | `npm run check --workspace @reel/core` → `ALL PASS: 132 assertions groups, 0 fail` (85 se); `npm run check --workspace @reel/studio` → 8/9/32/**55**, 0 fail (timeline 38 se); `npm run edit-sequence --workspace @reel/core` → poora 8.17 sequence, 5 undo + 5 redo dono taraf deep-equal; `npm run typecheck` → 6 workspaces exit 0; `npm run build:studio` → `✓ Compiled successfully`, `/project/[id]` 120 → **123 kB** | 8.1/8.2/8.3/8.10/8.15/8.17 ka UI wala hissa aur 8.12 ka DB/R2 checksum — sab `studio/.env.local` par ruke hain. 8.7 me "alternate track" wala vikalp jaan-boojhkar chhoda (Phase 16 ke saath behtar baithega). |
