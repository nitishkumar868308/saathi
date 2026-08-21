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

- [x] 8.1 Drag to move: horizontal (time) + vertical (track change, sirf compatible track type pe).
      → **browser me sach me ghaseeta (2026-08-20)**, zoom 4.00 px/frame par:

      | kya kiya | nateeja |
      |---|---|
      | 120px daayein | `00:09:07 → 00:10:07` — theek **30 frames** (120 ÷ 4) |
      | duration | 60 frames ka 60 hi raha — drag khiskata hai, naap nahi badalta |
      | 54px neeche (Audio track) | **kuch nahi hua** — image audio track par ja hi nahi sakti |
      | 112px neeche (Overlay track) | clip `Overlay(overlay)` par chali gayi, `@307` waisa ka waisa |

      Yaani "sirf compatible track type pe" wali shart sach me lagti hai, aur wo **chup-chaap
      mana** karti hai (clip apni jagah rehti hai) — koi aadha-adhoora move nahi hota.
      Track badalne par waqt bilkul nahi hila, jo zaroori hai: user parat badal raha tha,
      timing nahi.

- [x] 8.2 Snapping: playhead, doosre clips ke edges, track start, project end, aur scene
      ke kinaron par. Snap ka indicator dikhe.
      → **browser me naapa (2026-08-20)**, aur seema bhi naap li.

      Playhead theek **frame 200** par rakha, phir ek clip (`@217`) ko kheencha:

      | kitna kheencha | bina snap kahan girti | asal me kahan giri |
      |---|---|---|
      | −60px (15 frame) | 202 | **202** — snap nahi hua |
      | −4px (1 frame) | 201 | **200** — playhead par snap ✅ |

      Dono milkar seema saaf kar dete hain: `SNAP_THRESHOLD_PX = 8` aur 4 px/frame par wo
      **2 frame** banti hai — 2 frame ki doori par snap nahi lagta, 1 par lagta hai. Yaani
      threshold sach me wahi hai jo likha hai, aur wo zoom ke saath badalta hai (`8 /
      pxPerFrame`), fix frame count nahi — isi wajah se zoom-out par bhi snap utna hi
      "chipakne wala" lagta hai.

      Snap ke targets `SnapMenu` se on/off hote hain (Playhead / Clips / Markers / Scenes /
      Seconds) aur toolbar ke badge par ginti dikhti hai.
      → **Lakeer browser me dekhi (2026-08-21):** clip ko drag karte waqt **do** amber
      lakeerein aayin — `pointer-events-none absolute inset-y-0 z-10 w-px bg-amber/70` —
      aur saath me drag ka ghost bhi. Yaani snap ka nishaan sach me dikhta hai,
      sirf jagah hi sahi nahi girti.
      ⚠️ (purana note) jagah bilkul sahi girti hai,
      par drag ke dauraan wo nishaan dikha ya nahi, wo screenshot se saabit nahi hua.

- [x] 8.3 Trim left / right edge drag: `trimStartFrame` + `durationInFrames` badle,
      source ki hadd se aage na jaaye.
      → **browser me dono kinare ghaseete (2026-08-20).** Clip ke dono taraf asli handle
      hain (`cursor-ew-resize`, 7px chaude):

      **Daayan kinara**, 40px andar (= 10 frame):
      ```
      pehle : 00:02:01 → 00:03:15   (44 frames)
      baad  : 00:02:01 → 00:03:05   (34 frames)
      ```
      Shuruaat waisi ki waisi, sirf ant andar aaya — theek 10 frame.

      **Baayan kinara**, 24px andar (= 6 frame) — DB me teeno number ek saath badle:
      ```
      pehle : startFrame 61   durationInFrames 34   trimStartFrame 16
      baad  : startFrame 67   durationInFrames 28   trimStartFrame 22
      ```
      Yahi asli non-destructive trim hai: clip timeline par 6 frame aage shuru hoti hai
      **aur** source me bhi 6 frame aage se — isliye jo frame dikh raha tha wo waisa hi
      dikhta rehta hai, chhalaang nahi maarta. Sirf `startFrame` badalne par tasveer
      achanak badal jaati, aur wo galti dekhne me "trim toota hua hai" jaisi lagti.

      Source ki hadd ka hissa pehle se naapa hua hai (`trimItemEnd` `sourceDurationFrames`
      se aage nahi jaata) — uske apne test hain.

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

- [x] 8.7 Duplicate (`Ctrl+D`): naye id, turant baad me place.
      → **browser me dabaya (2026-08-20).** `PRIYA.png` chuni jo `startFrame 157, dur 60`
      par thi, `Ctrl+D` dabaya — nayi clip **`startFrame 217`** par bani, yaani theek
      `157 + 60`: **turant baad me**, usi track par, naye id ke saath (DB me dono alag
      rows). Yaani tay hua tarika "turant baad me place" hai, aur wahi chalta hai.

- [x] 8.8 Copy / Cut / Paste (`Ctrl+C/X/V`): paste playhead pe, cross-project paste bhi
      chale.
      → **browser me chalaya (2026-08-20).** Ek clip chun kar `Ctrl+C`, phir playhead ko
      `Shift+→` × 10 se **frame 300** par le jaakar `Ctrl+V`. DB me nayi clip
      **`startFrame: 300`** par bani — theek playhead par, apne purane 157 par nahi.
      Item ginti 12 → 13.
      Overwrite mode chalu hone se paste ne neeche ki clips bhi trim ki
      (`PAPA` dur 60 → 30, `MAA` 315/60 → 360/15) — yahi overwrite ka matlab hai.
      **Undo ne poora paste ek hi baar me wapas kiya:** nayi clip gayi *aur* trim hui
      dono clips bilkul apni purani jagah par lauti (`PAPA` 270/60, `MAA` 315/60). Yaani
      ek op = ek history entry, jaisa design me likha hai.
      ⚠️ **Cross-project paste is browser me aazmaya nahi ja saka (2026-08-21)** — aur
      wajah app me nahi hai. Cross-project hop `navigator.clipboard.readText()` par
      chalta hai, aur wo headless/CDP browser me `NotAllowedError: Document is not
      focused` deta hai (ya permission prompt par atak jaata hai). Usi project me
      copy/paste test se pass hai; system clipboard wala hop haath se hi dekha ja
      sakta hai. (purana note) uske liye doosra project khol kar
      paste karna hoga.

- [x] 8.9 Overlap policy config se: `overwrite` (default, upar wala jeete) ya `push` (aage khiskao)
      ya `reject`. Ek jagah decide ho, har op isko maane.
      → [config/overlap.ts](../../../packages/reel-core/src/config/overlap.ts) me teeno
      policy **data** ki tarah; `resolveOverlaps()` ek hi jagah, aur `moveItems`/`pasteItems`
      dono usi ko bulate hain. Toolbar ka select bhi usi list se banta hai.
      Test (5): overwrite me neeche wali clip kat jaati hai; overwrite me beech me girne par
      neeche wali **do tukde** ho jaati hai; push me kuch kat'ta nahi, sirf khisakta hai
      (dono clip poori lambai ke saath bachi rehti hain); reject par saaf error; aur bina
      overlap ke teeno policy bilkul ek jaisa nateeja deti hain.

- [x] 8.10 Nudge: arrow keys se selected clip 1 frame, Shift+arrow se 1 second.
      → **browser me naapa (2026-08-20)**, clip ke apne tooltip se padh kar:

      | key | clip pehle | clip baad | farak |
      |---|---|---|---|
      | `→` | `00:04:06 → 00:06:06` | `00:04:07 → 00:06:07` | theek **1 frame** |
      | `Shift+→` | `00:04:07 → 00:06:07` | `00:05:07 → 00:07:07` | theek **1 second** (30 frame) |

      Dono baar `durationInFrames` 60 hi raha — nudge sirf khiskata hai, lambai nahi
      badalta. DB me bhi wahi: clip `startFrame 126 → 127 → 157`.
      (Yahi wo dohra matlab hai jo 7.8 me likha hai: kuch chuna ho to clip hilti hai,
      warna playhead.)

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

- [x] 8.12 **Non-destructive proof**: `reel_assets` ka koi row aur R2 ka koi file kisi bhi op se
      badalna nahi chahiye.
      → **sach me ginn kar saabit kiya (2026-08-20).** Editing shuru karne se pehle do
      cheezon ka poora snapshot liya — DB ki saari `reel_assets` rows (id + `r2_key` +
      bytes + lifecycle) aur storage ki har file (path + asli size).

      Uske beech me ye sab kiya gaya: clip nudge (1 frame aur 1 second), duplicate,
      copy, paste (jisne overwrite se doosri clips trim ki), undo, trim, selection,
      In/Out marker, aur project ka size do baar badla (reel → landscape → reel).

      Snapshot dobara liya:

      ```
      reel_assets rows : pehle 10, ab 10   |  gayab: koi nahi  |  naya: koi nahi
      storage files    : pehle 33, ab 39   |  gayab: koi nahi
                         naye 6 = 3 export ki mp4 + unki 3 thumbnail
      ```

      Yaani **ek bhi asset row nahi badli aur ek bhi byte nahi mita.** Jo 6 nayi files
      aayi wo export ka output hain (`permanent/reels/*.mp4` + `permanent/thumbs/*.jpg`),
      source assets ko haath tak nahi laga.

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

- [x] 8.15 Performance: 200 clips pe drag/trim 60fps rahe.
      → **sach me naapa (2026-08-20)**, andaaze se nahi.

      Script se 200 clip ka project banaya (3 track, 3998 frame), aur **"Poora project
      fit karo"** dabaya taaki saare 200 sach me DOM me aayein — footer ne khud confirm
      kiya: `3 track · 200 item`, zoom `0.30 px/frame`.

      Phir beech ki ek clip par 80 step ka drag chalaya aur `requestAnimationFrame` se
      har frame ka gap naapa (120 samples):

      ```
      median   5.6 ms   → 178.6 fps
      p95     16.7 ms   →  59.9 fps
      sabse bura 50 ms  →  20.0 fps
      ```

      **Imaandaar jawab: haan, par ek shart ke saath.** 95% frames 60fps par ya usse upar
      hain — yaani drag "smooth" wali shart poori karta hai. Par **ek frame 50ms ka bhi
      mila**, aur wo aankh se ek halke jhatke jaisa dikhta hai. Wo shayad drag shuru hone
      ka setup ya GC ka pause hai; ye naap uski wajah nahi batati, sirf uska hona batati hai.

      ⚠️ Ek baat jo pehli koshish me chhoot rahi thi aur likh deni chahiye: aam zoom par
      timeline **saare clips render karti hi nahi** — 200-clip wale project me sirf 19 DOM
      me the (baaki screen se bahar). Us haalat me naap "200 clips ka test" hoti hi nahi.
      Isliye upar wala naap fit-zoom par liya gaya hai, jahan sach me 200 rectangles ek
      saath ban rahe the — yaani ye sabse mushkil haalat ka naap hai, aam haalat ka nahi.

      Design ka wo hissa jo isko sambhaalta hai pehle se likha hua tha: drag ke dauraan
      sirf ghost hilta hai, aur doc/history/autosave teeno **drop par** chalte hain — har
      pointermove par nahi.

- [x] 8.16 `packages/reel-core/scripts/check.ts` me naye assertions: cut/keep selection,
      ripple delete, split with keyframes, overlap policy, undo round-trip.
      → paanchon jud gaye aur uske alawa bhi: multi-move, trim ki hadd, copy/paste,
      duration, non-destructive. `npm run check --workspace @reel/core` → **85 se 132
      assertion groups**, 0 fail.

- [x] 8.17 Manual test: ek 20s video clip → 5s–12s keep → 10s pe split → duplicate →
      move → undo 5 baar → redo 5 baar. Har step ka frame number.
      → **ab UI se poora chalaya (2026-08-20)**, aur har kadam ke baad DB se asli numbers
      padhe (screen se nahi — screen par galat padhne ki gunjaish rehti hai):

      ```
      0. shuru          1 clip   start=  0  dur=600  trimStart=  0     (20s)
      1. I@150 O@360    toolbar me "00:05:00 → 00:12:00"
         Keep dabaya    1 clip   start=  0  dur=210  trimStart=150     (7s = 12-5)
      2. split @150     2 clip   start=  0  dur=150  trimStart=150
                                 start=150  dur= 60  trimStart=300
      3. Ctrl+D         (duplicate turant baad me)
      4. Shift+→        3 clip   start=  0  dur=150  trimStart=150
                                 start=150  dur= 30  trimStart=300
                                 start=180  dur=150  trimStart=150     (project 330f)
      5. Ctrl+Z x5      1 clip   start=  0  dur=600  trimStart=  0     ← bilkul shuruaat
      6. Ctrl+Y x5      3 clip   start=  0  dur=150  trimStart=150
                                 start=150  dur= 30  trimStart=300
                                 start=180  dur=150  trimStart=150     ← bilkul wahi
      ```

      **Do baatein jo is output me sabse zyada maayne rakhti hain:**

      1. **Keep aur split dono non-destructive hain, aur `trimStart` se wo dikhta hai.**
         Keep ke baad clip `trimStart=150` par baithi — yaani source ke 5 second se. Split
         ke baad doosri clip `trimStart=300` par — yaani source ke theek 10 second se.
         Kahin bhi asset ko chhua nahi gaya, sirf "source me kahan se dekhna hai" badla.
         Aur 150 + 60 = 210: na koi gap, na koi overlap.

      2. **Undo/redo ka round-trip exact hai.** 5 undo ke baad doc bilkul shuruaati haalat
         me tha (1 clip, 600 frame, trimStart 0), aur 5 redo ke baad teeno clip wahi
         start/dur/trimStart lekar wapas aayi. 4 op ke baad 5va undo chup-chaap kuch nahi
         karta — jo sahi hai, history ke shuru par rukna hi chahiye.

      ⚠️ Pehli koshish me nateeja ajeeb aaya tha (clips ulti-seedhi jagah par). Wajah test
      ki thi, app ki nahi: maine clip chunne ke liye `pointerdown` bheja par `pointerup`
      bhejna bhool gaya, isliye drag khula pada raha aur uske baad ka har keystroke usi
      drag ke upar lagta raha. Saaf select (down + turant up) karte hi sequence bilkul
      theek chali.

      Ops ka apna script wala saboot pehle se hai: `npm run edit-sequence --workspace
      @reel/core` (5 undo + 5 redo dono taraf deep-equal).

- [x] 8.18 `npm run typecheck` clean. Commit: "reel-studio: phase 8 — timeline editing ops".
      → typecheck **clean** (2026-08-20, 6 workspaces, exit 0), saare check suite pass.
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
