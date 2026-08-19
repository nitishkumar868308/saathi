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

- [ ] 7.3 Zoom: Ctrl+wheel (cursor pe centered), +/- keys, "Fit project" button, zoom range clamp.
      → code maujood hai, browser me chalaya nahi. Ganit saabit hai — test
      "cursor ke neeche wala frame zoom ke baad wahin rehta hai" (1e-9 tak), aur
      "shuruaat me zoom karne par scroll negative nahi hota".
      ⚠️ `wheel` listener DOM par khud lagaya gaya hai, JSX ke `onWheel` se nahi: React ka
      wheel listener passive hota hai aur passive me `preventDefault()` chalti hi nahi —
      matlab Ctrl+wheel par browser poora page zoom kar deta.
      `+`/`=`/`-` shortcut registry me hain; "Fit project" toolbar me.

- [ ] 7.4 Horizontal scroll + playhead follow during playback (auto-scroll, toggle-able).
      → code maujood hai, browser me chalaya nahi. Toggle toolbar me (default on),
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

- [ ] 7.6 Clip rendering: color track type se (registry), label = asset filename/text content,
      thumbnail strip images/videos ke liye (cached, lazy), waveform audio ke liye
      (Phase 5 ka waveform PNG reuse — dobara generate nahi).
      → code maujood hai, browser me chalaya nahi.
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

- [ ] 7.8 Selection: click (single), Ctrl/Cmd+click (toggle), Shift+click (range),
      marquee drag (rubber band), Ctrl+A, Esc. Selected clips ka outline saaf dikhe.
      → code maujood hai, browser me chalaya nahi. Chaaron mode `@reel/core` ke selection
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

- [ ] 7.10 Playhead: draggable, timeline click pe jump, ruler pe drag, `uiSlice.playheadFrame`
      hi truth (Phase 6 se shared).
      → code maujood hai, browser me chalaya nahi. Ruler par dabao/ghaseeto, ya playhead
      ka handle pakdo — dono `setPlayhead` likhte hain, wahi jo transport bar likhta hai.
      ⚠️ Playhead ki **lakeer** `pointer-events-none` hai, sirf uska handle pakda ja sakta
      hai — warna wo poori oonchai me neeche ke clips ke click kha jaati.
      Phase 6 ki `TimelineStrip` wali chhoti `<ScrubBar>` **hata di gayi** — ab timeline ka
      apna ruler hi scrub hai, do jagah do scrub rakhna sirf uljhan hoti.

- [ ] 7.11 In/Out point markers (I / O keys) — abhi sirf visual + state; use Phase 8 me hoga.
      → code maujood hai, browser me chalaya nahi. `I`/`O` shortcut registry me, state
      `uiSlice.inFrame/outFrame`, marker timeline par aur toolbar me timecode ke saath.
      Ganit tested (2): **In aur Out kabhi ulte nahi ho sakte** — ulta lagane par doosra
      hat jaata hai (chupchaap swap karna aur bura hota, kyunki user ne wahan point lagaya
      hi nahi tha); aur dono project ki hadd me clamp hote hain.

- [ ] 7.12 Empty state: naye project me saaf "Media library se drag karo" hint.
      → code maujood hai, browser me chalaya nahi. `doc.items.length === 0` par hint, aur
      saath me saaf likha hai ki drag-se-clip Phase 8 me aayega — aisa hint dena jo aaj
      kaam hi na kare, README ke rule 5 ka hi doosra roop hota.

- [ ] 7.13 Accessibility/usability basics: clip pe hover tooltip (start, duration, timecode),
      keyboard se clip navigate (Tab/arrow).
      → code maujood hai, browser me chalaya nahi. Tooltip `clipTooltip()` se (naam +
      start → end + duration + frames).
      ⚠️ **Tab ke liye koi shortcut nahi rakha, aur ye jaan-boojhkar hai.** Clip khud
      `<button>` hai, isliye browser ka apna Tab ek clip se doosri par le jaata hai aur
      Enter dabane se wo chun jaati hai (`event.detail === 0` se pehchana jaata hai ki
      click maus se nahi aayi). Tab ko registry me pakad lene se poore app ka focus mar
      jaata — media panel, toolbar, dialog, kisi tak Tab se pahunchna namumkin ho jaata.
      Arrow wala roop `Alt+←/→` hai, kyunki khaali `←/→` Phase 6 me frame step ko mil
      chuke hain (6.4).

- [ ] 7.14 Test: 3 track aur 12 clip ka doc banao (script se), timeline me sab sahi jagah
      dikhe; fps 24 wala project bhi kholo aur ruler verify karo. Screenshot do.
      → **aadha ho gaya.** Doc script se ban chuka hai aur **naapa** ja chuka hai —
      `studio/scripts/check-timeline.ts` me 3 track / 12 clip ka doc **asli ops se**
      (`createEmptyProject` → `addTrack` → `createItem` → `addItem`) banta hai, aur 30fps
      *aur* 24fps dono par har clip ka rectangle jaancha jaata hai: x theek
      `i × 3 second`, width theek `2 second`, y theek us track ke row par.
      Ek test khaas isliye hai ki fps sach me use ho raha ho: 24 aur 30 par frames alag
      nikalne chahiye (270 vs 216) — ek jagah bhi fps hardcode ho to wo yahin pakda jaata.
      **Screenshot baaki hai** kyunki dev server ke liye `studio/.env.local` chahiye.

- [ ] 7.15 `npm run typecheck` clean. Commit: "reel-studio: phase 7 — timeline view".
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
