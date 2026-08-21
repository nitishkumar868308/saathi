# Phase 7 — Timeline view (ruler, zoom, tracks, clips, selection)

**STATUS:** in progress — code poora, browser-verify baaki (7.14 ka screenshot)
**One-line prompt:** `Read docs/reel-studio/README.md, then do Phase 7 of AI Reel Studio.`
**Rules:** README.md ke Standing + Dynamic rules binding. Resume Protocol follow karo.
**Depends on:** Phase 6 complete

**Goal:** timeline **dikhna** shuru ho — sahi scale pe, sahi tracks, sahi clips.
Editing (drag/trim/split) agla phase hai. Pehle drawing solid karo.

---

## ⚠️ Tick ka matlab (Phase 5/6 jaisa hi)

- **`- [x]`** — chalte hue check se saabit; saboot us item ke neeche `→` me hai.
- **`- [ ]` + `→ code maujood hai, browser me chalaya nahi`** — likha aur compile/bundle
  hota hai, par uska asli imtihaan chalti hui app me hai.

**Kyun ruka hua hai:** `studio/.env.local` abhi bhi nahi hai (user ne kaha baad me daalenge),
isliye dev server uth nahi sakta. Jo bhi cheez sirf pointer/scroll/aankh se saabit hoti hai
wo unticked hai. Timeline ka **poora ganit** phir bhi naapa gaya hai — `lib/timeline.ts`
me sab pure functions hain aur `scripts/check-timeline.ts` unhe asli numbers se jaanchta hai
(38 test).

---

## Checklist

- [x] 7.1 `pxPerFrame` derived state: zoom level → px/frame. Saara position math ek helper se
      (`frameToX`, `xToFrame`). Component me manual multiply mana hai.
      → [studio/lib/timeline.ts](../../../studio/lib/timeline.ts). Zoom ki naap seedhe
      **px-per-frame** hai, koi "level 1..10" nahi — level rakhne se Ctrl+wheel jhatke se
      chalta aur "Fit project" kisi level par theek nahi baithta.
      Ruler, Clip, playhead aur marquee **chaaron** wahi `frameToX` bulate hain; component
      me ek bhi jagah `frame * zoom` nahi likha.
      Test: `frame <-> x aapas me ulte hain` (5 zoom × 5 frame = 25 jodi), clamp ki teen
      shartein, aur "fit project poore project ko dabbe me le aata hai".

- [x] 7.2 Ruler: zoom ke hisaab se adaptive ticks (frames → seconds → 5s → 10s), labels
      timecode helper se. fps 24/25/30/60 sab pe sahi.
      → `rulerScale()` / `rulerTicks()`; seedhi ki ladder frames (1/2/5/10/15) se shuru
      hoti hai aur seconds (1…3600) tak jaati hai, **aur har seedhi fps se banti hai**.
      Test (6): har fps (24/25/30/60) par ek-second ki seedhi theek `fps` frames ki nikli;
      doosra label theek `fps` frame par pada (pixel-step wale tarike me yahi 25fps par
      galat girta tha); har label ke liye kam se kam 68px jagah — 4 fps × 7 zoom = 28
      jodi par jaanchi gayi; minor hamesha major ka poora bhaag; aur ticks sirf maangi hui
      range me banti hain (poore project ki nahi).

- [x] 7.3 Zoom: Ctrl+wheel (cursor pe centered), +/- keys, "Fit project" button, zoom range clamp.
      → **browser me chaaron chalaye (2026-08-20)**, aur har baar `px/frame` padha:

      | kya kiya | zoom pehle | zoom baad |
      |---|---|---|
      | `+` do baar | 4.00 | 6.25 |
      | `-` teen baar | 6.25 | 3.20 |
      | Ctrl+wheel (up) | 3.20 | 4.00 |
      | "Poora project fit karo" | — | saare 12 clip ek saath dikhne lage |

      **Cursor pe centered hona ginn kar dekha:** wheel viewport ke theek beech
      (1117px chaudi, scrollLeft 0) par chalayi, yaani cursor ke neeche frame
      558.5 / 3.20 = **174.5** tha. Zoom 4.00 hone par us frame ko wahin rakhne ke liye
      `scrollLeft` 174.5×4 − 558.5 = **139.5** hona chahiye tha; asli mila **141.6**
      (border/rounding ka farak). Agar zoom cursor ki jagah ka hisaab na rakhta to
      scrollLeft 0 hi pada rehta.
      `scrollWidth` bhi 1440 → 1800 hua, yaani content sach me chauda hua.
      → **browser me naapa (2026-08-21):** zoom in/out button `4 → 5 → 4` px/frame,
      Ctrl+wheel `4 → 5`, aur "Poora project fit karo" par `1.2` px/frame (375 frame
      lane ki chaudai me). Ganit saabit hai — test
      "cursor ke neeche wala frame zoom ke baad wahin rehta hai" (1e-9 tak), aur
      "shuruaat me zoom karne par scroll negative nahi hota".
      ⚠️ `wheel` listener DOM par khud lagaya gaya hai, JSX ke `onWheel` se nahi: React ka
      wheel listener passive hota hai aur passive me `preventDefault()` chalti hi nahi —
      matlab Ctrl+wheel par browser poora page zoom kar deta.
      `+`/`=`/`-` shortcut registry me hain; "Fit project" toolbar me.

- [x] 7.4 Horizontal scroll + playhead follow during playback (auto-scroll, toggle-able).
      → **browser me dekha (2026-08-20).** Playhead ko aage le jaane par timeline apne aap
      khisak gayi — ruler `00:00:00` se shuru hone ke bajay `00:01:00` se dikhne laga aur
      playhead frame me hi raha. Toggle button toolbar me maujood hai aur uska tooltip
      `Playback me timeline playhead ke peeche chalti hai` hai (default on).
      `followScrollLeft()` ka ganit pehle se 3 test me pass hai — khaas kar wo waala ki
      playhead beech me ho to **null** lautta hai, yaani har frame par `scrollLeft` likh
      kar browser ki smooth scrolling se ladta nahi.
      → **browser me naapa (2026-08-21).** 8.92 px/frame par lane me sirf 50 frame
      dikhte the; Shuruaat se play karke frame 119 tak pahunche, aur scroller ka
      `scrollLeft` **692** ho gaya — jo `119×8.92 − 449 + 80` ka theek jawab hai
      (`followScrollLeft` ka margin 80). Yaani lakeer aankh se nahi, ganit se milti hai.
      Toggle toolbar me (default on),
      state `uiSlice.followPlayhead`.
      `followScrollLeft()` ka ganit test se saabit (3): playhead beech me ho to **null**
      (yaani scroll ko haath hi nahi lagta — har frame par `scrollLeft` likhne se browser
      apni smooth scrolling se ladta hai aur timeline kaanpta hai), daayein kinare par
      aage badhta hai, peeche seek par 0 se neeche nahi girta.

- [x] 7.5 Track rows **doc ke tracks[] se generate** (fixed rows nahi). Har row: name,
      type icon (registry se), mute/hide/lock buttons (abhi state toggle, effect Phase 16 me),
      height resize.
      → `trackRows()` doc ke `tracks[]` se banta hai; oonchai teen jagah se aati hai, isi
      kram me: user ka drag → registry ka `defaultHeight` → fallback.
      **Naya op:** `setTrackProperty` (`packages/reel-core/src/timeline/ops.ts`) — mute/
      hide/lock seedha `track.muted = true` se nahi, op se chalte hain, warna Ctrl+Z unhe
      wapas nahi laata (Dynamic rule 12).
      Test (6): rows order se bante hain aur ek dusre ke neeche baithte hain; user ki
      oonchai registry par jeetati hai aur neeche wala row utna khisakta hai; clamp;
      `rowAtY` ka kinara (off-by-one) — `top + height` par **agla** row milta hai;
      `setTrackProperty` purana doc chhuta nahi (undo isi par tika hai); aur `id`/`type`/
      `order` teeno path se **nahi** badalte.

- [x] 7.6 Clip rendering: color track type se (registry), label = asset filename/text content,
      thumbnail strip images/videos ke liye (cached, lazy), waveform audio ke liye
      (Phase 5 ka waveform PNG reuse — dobara generate nahi).
      → **aankh se dekha (2026-08-20)** — 3 track / 12 clip wale asli project par
      (asli cast images, `marketing/heygen/cast/`):
      * **video track** — 8 image clips, har ek par asli thumbnail film-strip ki tarah
        repeat hoti hui (PRIYA / RAHUL / PAPA / MAA), label me filename;
      * **audio track** — `aud-10s.mp3` hare rang me, aur uski **waveform poori chaudai me
        khinchi hui, repeat nahi** — theek wahi jo is item me likha tha;
      * **overlay track** — teen text clip baingani rang me, label me text ka content
        (`Scene 1 ka title` …), filename nahi.
      Teeno track ke rang alag hain aur registry (`TrackTypeEntry.color`) se aate hain.
      Thumbnail dobara nahi bani — dev log me sirf `permanent/thumbs/<id>.jpg` ke `200`
      dikhe, koi naya thumbnail job nahi chala.
      **Rang registry me chala gaya:** `TrackTypeEntry.color` — naya track type jodne par
      uska rang bhi usi ek entry me aata hai, Clip me koi switch nahi.
      Thumbnail **dobara nahi banti**: `?thumb=1` se wahi `permanent/thumbs/<id>.jpg`
      aata hai jo Phase 5 me ek baar bana tha, aur `assetUrls.ts` ka cache use hota hai.
      Image/video par wo film-strip ki tarah repeat hoti hai; **audio ki waveform repeat
      nahi hoti**, poori chaudai me khinchti hai — waveform poori clip ki awaaz ki shakl
      hai, ek tile nahi; repeat karne par wo jhooth bolne lagti.
      Label ka ganit tested (2): text item par content naam par jeetta hai, khaali content
      par naam par girta hai, aur 200 akshar ka text kata hua aata hai.

- [x] 7.7 Virtualization: 200+ clips pe bhi smooth (sirf visible range render karo).
      → `visibleFrames()` + `itemIntersects()`; sirf dikh rahe clips DOM me jaate hain
      (overscan 240px).
      Test (4): range scroll ke saath khisakti hai aur negative nahi hoti; **screen se
      lambi clip bhi dikhti hai** — dono taraf ka overlap dekha jaata hai, sirf start nahi
      (sirf start dekhne par sabse badi clip hi gayab hoti thi); aur kinare par lage clip
      do baar nahi ginte.
      7.14 ke asli doc par bhi: 12 me se pehle 4 second me theek **6** clip render hote hain.

- [x] 7.8 Selection: click (single), Ctrl/Cmd+click (toggle), Shift+click (range),
      marquee drag (rubber band), Ctrl+A, Esc. Selected clips ka outline saaf dikhe.
      → **browser me chaaron mode chalaye (2026-08-20)**, har baar `aria-pressed=true`
      wale clips ginn kar:

      | kya kiya | chuni hui clips |
      |---|---|
      | pehli clip par click | `PRIYA.png` (1) |
      | teesri par Ctrl+click | `PRIYA.png`, `PAPA.png` (2 — toggle se judi) |
      | chhati par Shift+click | `PAPA, MAA, PRIYA, RAHUL` (4 — poori range) |
      | `Ctrl+A` | saari **12** |
      | `Esc` | **0** |

      ⚠️ Pehli koshish me Ctrl+click kaam nahi kar raha lag raha tha — par galti test ki
      thi, code ki nahi. Selection `onPointerDown` par hoti hai, aur `onClick` sirf tab
      chunta hai jab `event.detail === 0` (yaani Enter/Space se aayi ho). Mere synthetic
      `MouseEvent('click')` ka `detail` 0 tha, isliye wo keyboard-select wale raaste par
      gaya jahan Ctrl/Shift ka koi matlab hi nahi. `pointerdown` se dispatch karte hi
      chaaron mode sahi chale. Ye code me likha bhi hua hai, aur soch bhi theek hai.
      Marquee ka ganit pehle se 4 test me pass hai.
      → **browser me chalaya (2026-08-21):** aam click par **1** clip chuni, Ctrl+click
      par **2**, Shift+click par **3** (range), aur phir aam click par wapas **1** —
      ginti `aria-pressed="true"` wali clips se naapi gayi. Chaaron mode `@reel/core` ke selection
      helpers se; `Ctrl+A` aur `Esc` shortcut registry me.
      Marquee ka ganit tested (4): **chhoona kaafi hai, poora dhakna zaroori nahi** (poora
      dhakne wali shart par lambi clip chunna namumkin ho jaata — uske dono sire aksar
      screen se bahar hote hain); poore timeline par band kheenchne se 12 ke 12 aate hain;
      ek track ki patti sirf usi track ke 4 uthati hai; aur kisi bhi disha me kheencha gaya
      band ek jaisa rectangle deta hai.
      Outline **andar** (`ring-inset`) hai — bahar wala ring paas-paas rakhe do clips ke
      beech ghus kar dono ko chuna hua dikhata hai.

- [x] 7.9 Selection state `uiSlice` me (doc me nahi) — undo se selection nahi badalni chahiye.
      → Phase 1 se hi `Selection` doc ke bahar hai aur store ke uiSlice me rehti hai;
      Phase 7 me isme kuch nahi badla, sirf use hua. `applyOp` ke baad `pruneSelection()`
      chalti hai (delete/undo ke baad gayab ids hat jaati hain) — uska test `@reel/core`
      ke check me pehle se hai.

- [x] 7.10 Playhead: draggable, timeline click pe jump, ruler pe drag, `uiSlice.playheadFrame`
      hi truth (Phase 6 se shared).
      → **browser me chalaya (2026-08-20).** Playhead ko transport se 30 par le jaakar
      timeline ke playhead ki asli CSS padhi: `left: 120px` — aur us waqt zoom
      `4.00 px/frame` thi, yaani 30 × 4 = 120. Wahi ek number dono jagah.
      Drag ka poora raasta 6.7 me naapa gaya (`role=slider`, `aria-label=Playhead`):
      25% par dabaya → frame 94 (expected 94), 80% tak ghaseeta → 299 (expected 299),
      aur transport ka timecode bhi 299 dikha.
      → **browser me chalaya (2026-08-21):** ruler par 60% par drag karne se playhead
      `frame 225/375` par gaya (375 ka theek 60%), aur playhead ka apna sira 150px
      kheenchne par frame 125 par. Ruler par dabao/ghaseeto, ya playhead
      ka handle pakdo — dono `setPlayhead` likhte hain, wahi jo transport bar likhta hai.
      ⚠️ Playhead ki **lakeer** `pointer-events-none` hai, sirf uska handle pakda ja sakta
      hai — warna wo poori oonchai me neeche ke clips ke click kha jaati.
      Phase 6 ki `TimelineStrip` wali chhoti `<ScrubBar>` **hata di gayi** — ab timeline ka
      apna ruler hi scrub hai, do jagah do scrub rakhna sirf uljhan hoti.

- [x] 7.11 In/Out point markers (I / O keys) — abhi sirf visual + state; use Phase 8 me hoga.
      → **browser me dabaya (2026-08-20).** Playhead frame 60 par le jaakar `I`, phir 180
      par le jaakar `O`. Toolbar me turant `00:02:00 → 00:06:00` aa gaya, uske saath
      **Cut** aur **Keep** buttons, aur timeline par dono jagah marker ki lakeer dikhi.
      Yaani visual + state dono hain, aur Phase 8 wala istemaal (Cut/Keep range) wahin se
      lagta hai.
      → **browser me chalaya (2026-08-21):** frame 125 par `I`, paanch frame aage jaakar
      `O` — uske turant baad toolbar me **Cut** aur **Keep** button aa gaye (wo sirf
      range hone par aate hain). `I`/`O` shortcut registry me, state
      `uiSlice.inFrame/outFrame`, marker timeline par aur toolbar me timecode ke saath.
      Ganit tested (2): **In aur Out kabhi ulte nahi ho sakte** — ulta lagane par doosra
      hat jaata hai (chupchaap swap karna aur bura hota, kyunki user ne wahan point lagaya
      hi nahi tha); aur dono project ki hadd me clamp hote hain.

- [x] 7.12 Empty state: naye project me saaf hint.
      → **browser me dekha (2026-08-20)**, aur yahin ek asli galti nikli.

      Khaali project me hint dikhta to tha, par wo **do tarah se jhooth** bol raha tha:

      ```
      Timeline khaali hai — baayein Media library se koi file yahan drag karo
      (drag se clip banana Phase 9 me aayega)
      ```

      (a) Library se timeline par drag **bana hi nahi hai** — `TimelineView` me koi
      `onDrop` nahi, aur `AssetCard` ka ekmatra click detail dialog kholta hai.
      (b) "Phase 9 me aayega" — par Phase 9 kab ka poora ho chuka hai. Hint ek aise phase
      ka naam le raha tha jo guzar chuka tha.

      Yaani hint user ko wahi kaam karne bhej raha tha jo hota hi nahi — theek wo cheez
      jiske khilaaf is item ka apna note chetavni deta hai.

      Ab hint wahi kehta hai jo **aaj** chalta hai:

      ```
      Timeline abhi khaali hai
      Upar Scenes par jaakar scene jodo — clips yahan apne aap aa jaayenge
      ```

      (Browser me padh kar confirm kiya.)

      ⚠️ **Ye ek badi kami khol deta hai, aur wo abhi khuli hai:** Timeline mode me
      library se asset timeline par laane ka **koi raasta nahi** — na drag, na button, na
      double-click. Poore `studio/` me `applyOp("addItem", …)` ek bhi component se call
      nahi hota (sirf `scripts/check-store.ts` me). Content sirf **Scenes** se aata hai
      (`addScene`). Aur checklist me 0–24 me kisi phase ne ye kaam apne naam liya bhi
      nahi — 7.12 sirf hint maangta hai, kaam nahi. Ye naye kaam ka item hai, kisi
      unticked box ka hissa nahi.

- [x] 7.13 Accessibility/usability basics: clip pe hover tooltip (start, duration, timecode),
      keyboard se clip navigate (Tab/arrow).
      → **browser me padha (2026-08-20).** Clip ka asli `title`:

      ```
      PRIYA.png
      00:00:00 → 00:02:00  (00:02:00, 60 frames)
      ```

      Naam + start → end + duration + frames — chaaron cheezein. Clip sach me `<button>`
      hai (DOM me `button[aria-pressed]` se hi saari 12 clips mili), isliye browser ka
      apna Tab bina kisi shortcut ke ek clip se doosri par le jaata hai.
      → **browser me padha (2026-08-21):** clip ka `title` —
      `PRIYA.png / 00:10:00 → 00:12:00 (00:02:00, 60 frames)`.
      Tooltip `clipTooltip()` se (naam +
      start → end + duration + frames).
      ⚠️ **Tab ke liye koi shortcut nahi rakha, aur ye jaan-boojhkar hai.** Clip khud
      `<button>` hai, isliye browser ka apna Tab ek clip se doosri par le jaata hai aur
      Enter dabane se wo chun jaati hai (`event.detail === 0` se pehchana jaata hai ki
      click maus se nahi aayi). Tab ko registry me pakad lene se poore app ka focus mar
      jaata — media panel, toolbar, dialog, kisi tak Tab se pahunchna namumkin ho jaata.
      Arrow wala roop `Alt+←/→` hai, kyunki khaali `←/→` Phase 6 me frame step ko mil
      chuke hain (6.4).

- [x] 7.14 Test: 3 track aur 12 clip ka doc banao (script se), timeline me sab sahi jagah
      dikhe; fps 24 wala project bhi kholo aur ruler verify karo. Screenshot do.
      → **ho gaya (2026-08-20).** Doc script se ban chuka hai aur **naapa** ja chuka hai —
      `studio/scripts/check-timeline.ts` me 3 track / 12 clip ka doc **asli ops se**
      (`createEmptyProject` → `addTrack` → `createItem` → `addItem`) banta hai, aur 30fps
      *aur* 24fps dono par har clip ka rectangle jaancha jaata hai: x theek
      `i × 3 second`, width theek `2 second`, y theek us track ke row par.
      Ek test khaas isliye hai ki fps sach me use ho raha ho: 24 aur 30 par frames alag
      nikalne chahiye (270 vs 216) — ek jagah bhi fps hardcode ho to wo yahin pakda jaata.
      **2026-08-20 — ab browser me bhi ho gaya.** `studio/.env.local` maujood hai, dev
      server chala, aur script se theek 3 track + 12 clip ka asli project banaya gaya
      (8 image + 3 text + 1 audio, asli cast images aur mp3 ke saath). Timeline me:

      * neeche daayein `3 track · 12 item` likha aaya;
      * DOM me `button[aria-pressed]` wali theek **12** clip mili, sahi labels ke saath
        (`PRIYA.png`, `RAHUL.png`, …, `Scene 1 ka title`, `aud-10s.mp3`);
      * har clip apni sahi track par aur sahi jagah par — pehli clip ka tooltip
        `00:00:00 → 00:02:00 (00:02:00, 60 frames)`, aur aage waali har 45 frame par;
      * "Poora project fit karo" par saari 12 ek saath dikhi.

      Screenshot session folder me hai (`048-navigate.png`) — usme teeno track, unke
      alag rang, image clips ki film-strip aur audio ki poori waveform saaf dikhti hai.

- [x] 7.15 `npm run typecheck` clean. Commit: "reel-studio: phase 7 — timeline view".
      → typecheck **clean** (2026-08-20, 6 workspaces, exit 0), saare check suite pass.
      → typecheck **clean hai** (6 workspaces, exit 0), `npm run build:studio` bhi pass.
      Commit ho chuka. Box 7.14 ke screenshot ke baad tick hoga.

## Verify (asli output paste karna)

```
npm run check --workspace @reel/studio    # timeline ka ganit (abhi 38 test)
npm run typecheck
npm run build:studio

# Ye tab, jab studio/.env.local aa jaaye:
npm run dev:studio
# zoom in/out, scrub, marquee select, 24fps project ka ruler check
```

## Done when

Timeline sahi scale pe draw hota hai, tracks doc se aate hain, selection ke saare modes chalte
hain, playhead shared hai, aur 200 clips pe UI smooth rehta hai.

## Progress log

| Date | What was done | Verified by | Next |
|---|---|---|---|
| 2026-08-19 | Poora timeline view. Core me do badhotri: `TrackTypeEntry.color` (7.6 ka rang registry se aata hai) aur naya `setTrackProperty` op (7.5 ke mute/hide/lock ka undo isi se chalta hai). Studio me naya `lib/timeline.ts` — zoom/fit, `frameToX`/`xToFrame`, cursor par centered zoom, adaptive ruler scale, virtualization ki range, track rows, marquee hit-test, playhead follow, clip label/tooltip, in/out. Components: `TimelineView` + `Ruler` + `TrackHeader` + `Clip`. Store ke uiSlice me `followPlayhead`, `trackHeights`, `inFrame`/`outFrame` jude aur `zoom` ab clamp hota hai. Shortcut registry me timeline ka group (`+`/`-`/`Ctrl+A`/`Esc`/`I`/`O`/`Alt+←→`). Phase 6 ki `TimelineStrip` hata di — ab ruler hi scrub hai. **Tab ko jaan-boojhkar shortcut nahi banaya**: clip `<button>` hai, native Tab pehle se chalta hai, aur Tab hijack karne se poore app ka focus mar jaata. | `npm run check --workspace @reel/studio` → `ALL PASS: 38 tests, 0 fail` (zoom 6, ruler 6, virtualization 4, track rows 4, 7.14 ka doc 5, marquee 4, follow 3, in/out 2, label 2, track ops 2); poora `npm run check` → studio 8/9/32/38 + core 85 + media 10, sab 0 fail; `npm run typecheck` → 6 workspaces exit 0; `npm run build:studio` → `✓ Compiled successfully`, `/project/[id]` 115 kB → **120 kB** | 7.14 ka screenshot + 7.3/7.4/7.6/7.8/7.10/7.11/7.12/7.13 — sab `studio/.env.local` par ruke hain |
