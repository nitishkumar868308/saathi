# Phase 6 — Preview player + transport + playhead

**STATUS:** in progress — code poora, browser-verify baaki (6.13)
**One-line prompt:** `Read docs/reel-studio/README.md, then do Phase 6 of AI Reel Studio.`
**Rules:** README.md ke Standing + Dynamic + A1 Quality rules binding. Resume Protocol follow karo.
**Depends on:** Phase 3, 4, 5 complete

**Goal:** center me asli preview — **wahi Remotion composition** jo final render karta hai.
Preview aur export me farak nahi hona chahiye.

---

## ⚠️ Tick ka matlab (Phase 5 jaisa hi)

- **`- [x]`** — chalte hue check se saabit. Saboot us item ke neeche `→` me hai
  (`npm run check --workspace @reel/studio`, `npm run typecheck`, `npm run build:studio`).
- **`- [ ]` + `→ code maujood hai, browser me chalaya nahi`** — likha hua hai aur
  compile/bundle bhi hota hai, par uska asli imtihaan sirf chalti hui app me hai.

**Kyun ruka hua hai (2026-08-19, doosri baithak):** ffmpeg **aa gaya**, aur uske saath
6.13 ka **render wala aadha hissa saabit ho chuka hai** — `npm run render:sample` →
`ALL PASS: 29 checks, 0 fail`, asli MP4 (h264 High / yuv420p / 1080×1920@30 / aac 48kHz
2ch), aur frames bhi `render-out/samples/frames-reel-30fps/` me pade hain, tulna karne ke
liye taiyaar.

Ab **sirf `studio/.env.local`** ki kami hai. Uske bina dev server uth nahi sakta, isliye
6.13 ka doosra aadha (preview ka screenshot) aur baaki saare browser wale box abhi
unticked hain.

---

## Checklist

- [x] 6.1 `@remotion/player` studio me install + `<Player>` mount with
      `component = ReelComposition` (Phase 3 wala **same** component, copy nahi).
      → `studio/package.json` me `@remotion/player@^4.0.513`, `remotion`, aur
      `@reel/remotion` juda. Player
      [studio/components/editor/preview/PreviewPlayer.tsx](../../../studio/components/editor/preview/PreviewPlayer.tsx)
      me hai aur `ReelComposition` **`@reel/remotion` se import** hoti hai — koi copy nahi,
      wahi component jise worker `renderMedia` me deta hai.
      `npm run build:studio` pass; `/project/[id]` ka bundle 4.16 kB se **115 kB** ho gaya —
      yaani player sach me bundle me aaya, sirf import likha nahi gaya.

- [x] 6.2 inputProps = live doc + resolved asset URL map. Doc badle to player turant update ho
      (remount ke bina, warna playback position khoyegi).
      → **playback ke beech me edit karke naapa (2026-08-20).** Space se playback chalayi,
      phir chalte-chalte ek clip chun kar `→` se 1 frame khiskayi. Nateeja:

      ```
      play dabaya           frame 0
      edit kiya             frame 13
      2 second baad         frame 72   ← chalti rahi (72 > 13)
      ```

      Player **remount nahi hua** — position na to 0 par gayi, na ruki; wahin se aage
      chalti rahi. Aur wo edit DB me pahunchi bhi (`PRIYA.png startFrame: 0 → 1`).
      → **browser me chalakar dekha (2026-08-21).** Timeline se text clip chuni, properties
      me uska text `"Scene 2 ka title"` se `"AUDIT LIVE TEXT"` kiya — preview ka DOM
      turant wahi naya text dikhane laga, bina Player remount ke (playback ki jagah nahi
      gayi). Ek Ctrl+Z par purana text wapas (poori typing ek hi history entry me thi).
      `inputProps` har render par naya
      `{ doc, assets }` hai, aur `component` module-level const hai — isliye Player remount
      nahi hota. Asset URL
      [studio/lib/assetMap.ts](../../../studio/lib/assetMap.ts) se aate hain (doc me sirf
      `assetId`, URL kabhi nahi — Phase 1 ka locked rule), aur signed URL marne se pehle
      apne aap dobara resolve hote hain.

- [x] 6.3 Player size = project aspect se **calculated**, fit-to-container + zoom levels
      (Fit / 50% / 100%) — hardcoded pixel size nahi.
      → `previewLayout()` / `fitScale()` in
      [studio/lib/preview.ts](../../../studio/lib/preview.ts); dabbe ka naap
      `ResizeObserver` se ([studio/lib/useElementSize.ts](../../../studio/lib/useElementSize.ts)),
      `window.resize` se nahi — warna panel kheenchne par frame apne purane naap par ruka
      reh jaata tha.
      `npm run check --workspace @reel/studio` me "preview layout (6.3)" ke 8 test pass:
      portrait oonchai se bandhta hai, landscape chaudai se, chaure dabbe me landscape
      phir bhi oonchai se, khaali dabbe par scale 0, fit par aspect ≤1px farak,
      100% par theek 1080×1920, 50% par 540×960, anjaan zoom id par fit.

- [x] 6.4 Transport bar: play/pause (Space), 1 frame back/forward (←/→), 1 second jump
      (Shift+←/→), start/end (Home/End), loop toggle, mute toggle, volume.
      → **asli browser me har key dabayi (2026-08-20)**, aur har baar frame number padha:

      | key | pehle | baad | matlab |
      |---|---|---|---|
      | `→` | frame 5 | frame 6 | theek 1 frame |
      | `Shift+→` | frame 6 | frame 36 | theek 30 frame = 1 second @30fps |
      | `End` | frame 36 | frame 449/450 | aakhri frame (0-indexed) |
      | `Home` | 449 | 0 | shuruaat |
      | `Space` | 0 | chalne lagi | playback |

      Loop button `Loop band hai` → `Loop chalu hai`, mute `Mute` → `Awaaz on karo`,
      volume `<input type=range>` 0–1. Sab chale.

      ⚠️ **Is test ne ek chupi hui khaami pakdi.** `Ek frame peeche/aage` ke tooltip me
      shortcut dikh hi nahi raha tha — sirf `Ek frame peeche`, `(←)` gayab. Wajah:
      `TransportBar` `shortcutLabel("frame-back")` / `"frame-forward"` maangta tha, par
      Phase 8 me arrow keys dohre kaam ki ho gayi aur registry me unke naam
      `nudge-back` / `nudge-forward` ho gaye. `shortcutLabel()` na milne par **khaali
      string** deta hai — isliye kuch toota nahi, koi error nahi, bas hint chup-chaap
      gayab. Ab id sahi hain aur tooltip `Ek frame peeche (←)` / `Ek frame aage (→)`
      dikhata hai (browser me padh kar dekha).

      Taaki ye dobara na ho, ek test juda: `check-shortcuts.ts` ab har `shortcutLabel("…")`
      call ko source se nikaal kar registry se milata hai — rename us din pakda jaayega
      jis din wo hoga, mahine baad nahi.
      → UI + registry ban chuke
      ([TransportBar.tsx](../../../studio/components/editor/preview/TransportBar.tsx),
      [studio/lib/shortcuts.ts](../../../studio/lib/shortcuts.ts)), par **dabaya nahi gaya**.
      Jo hissa test ho sakta tha wo pass hai — "transport shortcuts (6.4)" ke 6 test:
      space `" "` nahi `space` banti hai, shift+arrow alag combo hai, Ctrl aur Cmd dono
      `mod`, checklist ki saatoon key registry me maujood, **do shortcut ek hi key par
      nahi baithe**, aur label me asli teer (`Shift+←`) dikhta hai.
      Button ke `title` bhi usi registry se banate hain, haath se "Space" nahi likha —
      warna shortcut badalne par tooltip jhooth bolta.

- [x] 6.5 Timecode display: `HH:MM:SS:FF` + frame number, dono fps se derive (helper se).
      → **browser me padha (2026-08-20).** Transport me `00:00:01:06 / 00:00:15:00 ·
      frame 36/450` dikha. Ye ek hi naap ka do roop hai aur dono mile: frame 36 @30fps
      = 1 second 6 frame, aur `End` par `00:00:14:29 · frame 449/450`. fps se derive
      hone ka saboot yahi hai ki `Shift+→` (1 second) frame ko theek 30 badhata hai.
      → **browser me naapa (2026-08-21):** shuru me `00:00:00:00` / `frame 0/375`, ek
      frame aage dabate hi `00:00:00:01` / `frame 1/375` — dono ek saath aur ek hi
      source se. `framesToTimecode()` (reel-core) se
      dono hisse, aur saath me `frame N/total`. Helper ka apna test `@reel/core` ke check
      me pehle se hai; yahan sirf uska istemaal hai — kahin `/ 30` nahi likha.

- [x] 6.6 Playhead single source of truth: store ka `uiSlice.playheadFrame`. Player aur
      timeline dono isi ko padhein/likhein — do jagah state nahi.
      → **browser me ginn kar dekha (2026-08-20).** Transport se playhead 30 par le jaakar
      timeline ke playhead ka asli CSS padha: `left: 120px`, aur us waqt zoom `4.00
      px/frame` tha. 30 × 4 = 120 — theek. Do alag state hoti to ye do number sanyog se
      hi milte; yahan wo ek hi `playheadFrame` se nikalte hain.
      Isi tarah `Shift+→` transport se dabane par timeline ka playhead bhi utna hi khiska.
      → **browser me dekha (2026-08-21):** Play dabaya to ~1.2s me playhead frame 0 → 7
      gaya aur timecode, frame ginti aur player teeno saath chale; Pause par teeno ek hi
      jagah ruke. `PlaybackProvider` me **playhead hai hi
      nahi** — sirf isPlaying/loop/volume/zoom/guides/draft. Har command
      ([studio/lib/playback.tsx](../../../studio/lib/playback.tsx)) `store.setPlayhead()`
      likhta hai; player usko padh kar seek karta hai aur apna `frameupdate` wapas usi me
      likhta hai (`fromPlayer` ref se chakkar rukta hai).

- [x] 6.7 Scrub: player par drag + timeline par drag, dono same frame set karein.
      Scrub ke dauraan seek throttle (60fps se zyada nahi).
      → **asli drag chalaya (2026-08-20)**, `<ScrubBar>` (`role=slider`, `aria-label=Playhead`)
      par pointerdown → pointermove → pointerup:

      | kahan dabaya/ghaseeta | mila frame | hona chahiye tha |
      |---|---|---|
      | 25% par pointerdown | 94 | 94 |
      | 80% tak ghaseet kar chhoda | 299 | 299 |

      Dono bilkul exact. Aur us waqt transport ka timecode bhi `frame 299` hi dikha —
      yaani bar aur timecode ek hi `playheadFrame` se aa rahe hain (6.6).
      Throttle ka ganit pehle se test me hai (4 test nakli ghadi par).
      ⚠️ Test me `setPointerCapture` ko stub karna pada — banawati pointer id par wo
      throw karta hai. Ye test ki hadd hai, product ki nahi; asli maus par capture wahi
      cheez hai jo bar se bahar nikalne par drag ko chhootne nahi deti.
      → **browser me naapa (2026-08-21):** ruler par pointer drag karke 60% par chhoda —
      playhead `frame 225/375` par gaya, jo 375 ka theek 60% hai. Yaani drag ki jagah
      seedhe waqt par girti hai, andaaze se nahi. Transport me
      [`<ScrubBar>`](../../../studio/components/editor/preview/ScrubBar.tsx) hai; timeline
      wali taraf **Phase 7 ne asli ruler de diya** (`TimelineView`), aur us waqt ki chhoti
      `TimelineStrip` hata di gayi — do jagah do alag scrub rakhna sirf uljhan hoti.
      Dono `store.setPlayhead()` hi likhte hain, isliye "dono jagah ek hi frame" abhi bhi
      structure se sach hai, sanyog se nahi.
      Throttle ka ganit test se saabit hai — "seek throttle (6.7)" ke 4 test nakli ghadi
      par: pehla seek turant, ek window me sirf **aakhri** frame, 1000ms me 200
      pointermove par bhi 61 se zyada seek nahi, aur `flush()` pending ko turant bhejta hai.

- [x] 6.8 Play/pause ke dauraan autosave block **nahi** hona chahiye, par save request
      playback ko hakla na de — verify karke batao.
      → **naap liya (2026-08-20).** 6.2 wale hi test me: playback chalte hue edit kiya,
      aur wo edit **sach me save hui** — DB me `PRIYA.png startFrame` 0 se 1 ho gaya aur
      `updated_at` theek usi waqt ka hai (06:48:58). Yaani autosave playback ke dauraan
      ruki nahi.
      Aur hakli bhi nahi: save ke aar-paar playback frame 13 → 72 gayi, yaani 2000ms me
      59 frame = **29.5 fps** jabki target 30 hai. Ek save request ne playback se aadha
      frame bhi nahi chheena.
      → **naapa nahi gaya.** Autosave ka scheduler playback se poori tarah alag hai (usme
      playback ka koi zikr hi nahi), isliye rukne ka koi raasta dikhta nahi — par ye
      dalil hai, naap nahi. Iska asli jawab dev server par playback ke dauraan edit karke
      hi milega.

- [x] 6.9 **A1 quality:** preview me image scaling smooth ho (`image-rendering` default,
      CSS blur nahi), aur `<Player>` ka `numberOfSharedAudioTags` sahi set ho taaki
      audio glitch na kare. Preview resolution downscale ho sakta hai par **aspect aur
      framing bilkul final ke jaisa** ho.
      → **CSS bhi browser me naapi (2026-08-21):** preview ke `<img>` par
      `image-rendering: auto` (pixelated **nahi**) aur `object-fit: cover` —
      yaani scaling smooth hai aur framing fit se aati hai.
      → **ab aankh se bhi dekha aur naapa bhi (2026-08-20).** "Aspect aur framing bilkul
      final ke jaisa" wala hissa 6.13 me ginn kar saabit hua: preview (319px chaudi) aur
      final MP4 (1080px chaudi) ka **ek hi frame** milane par SSIM **0.950** aaya, aur
      tasveer frame me theek usi jagah, usi naap me thi. Agar aspect ya framing zara bhi
      alag hota to SSIM 0.95 tak pahunchta hi nahi.
      Scaling smooth hai — preview me image ke kinare saaf hain, koi pixel-block nahi
      (`image-rendering` jaan-boojhkar chhua nahi gaya; browser ka default scaling hi
      final ke sabse kareeb hai).
      `numberOfSharedAudioTags` ka ganit pehle se 3 test me pass hai.
      → `image-rendering` jaan-boojhkar chhua nahi (browser ka default smooth scaling hi
      final ke sabse kareeb hai). `numberOfSharedAudioTags` doc se **naapa** jaata hai —
      "shared audio tags (6.9)" ke 3 test pass: khaali doc par kam se kam 2, aage-peeche
      lagi clips overlap nahi ginti, ek saath bajti 3 clips par 3 (aur bina audio wale
      item ginti me nahi aate). Aankh se dekhna (smooth scaling) baaki hai, isliye box
      ticked nahi.

- [x] 6.10 Safe-area guides overlay (toggle): Instagram/Shorts ke UI-safe margins, grid,
      center lines. Reels ke liye ye bahut kaam ka hai.
      → guides **data** hain, core me:
      [packages/reel-core/src/config/safeArea.ts](../../../packages/reel-core/src/config/safeArea.ts)
      (Reels / Shorts / action-safe / title-safe), fraction me — isliye 1080×1920 aur
      720×1280 dono par ek hi guide sahi baithti hai. Overlay
      [GuidesOverlay.tsx](../../../studio/components/editor/preview/GuidesOverlay.tsx) me
      grid (rule of thirds) + center lines ke saath.
      "safe-area guides (6.10)" ke 5 test pass: landscape par "Instagram Reels" list me
      aati hi nahi, portrait par Reels+Shorts dono, project ka size badalne par chuni hui
      guide apne aap badal jaati hai, title-safe ka rectangle 1080×1920 par theek
      108/192/864/1536, aur andar/bahar ka faisla sahi (yahi Phase 20 reuse karega).
      ⚠️ Naap **andaaze** hain (Instagram koi official safe area publish nahi karta) — ye
      file me saaf likha hua hai.

- [x] 6.11 Missing asset handling: asset na mile to preview me saaf "Missing asset" card
      dikhao (crash nahi, chup-chaap khaali bhi nahi).
      → **aankh se dekha (2026-08-20).** Ek aise project me jiska asset DB me nahi tha,
      preview ke beech me gulaabi card `ASSET NAHI MILA` + item ka naam + uski id dikhi,
      aur upar ki patti par ginti: `1 asset nahi mila — frame me gulaabi card us item par
      hai`. Na crash, na khaali frame. Dono hisse (card + upar ki ginti) wahi hain jo
      is item me likhe the.
      → **browser me dekha (2026-08-21).** Ek alag "AUDIT fixture" project banaya jisme
      ek item ka `assetId` jaan-boojhkar aisa rakha jo hai hi nahi. Dono jagah jawab aaya:
      upar patti par `1 asset nahi mila — frame me gulaabi card us item par hai`, aur us
      item ke frame par card: `ASSET NAHI MILA / TOOTA HUA asset (image) / assetId: 0000…`.
      Fixture project baad me mita diya gaya. Do jagah: frame ke andar
      `<MissingAsset>` ka gulaabi card (Phase 3 se), aur upar ki patti par ginti — kyunki
      card sirf tab dikhta hai jab playhead usi item par ho, aur 40 second ki reel me
      toota asset dhoondhne ke liye poori reel scrub karni padti.

- [x] 6.12 Performance guard: 3+ video layers pe stutter aaye to console warning + UI hint
      "Preview quality: Draft" toggle (jo preview ka scale ghatata hai, doc nahi).
      → hint **naap kar** aata hai, layer ginn kar nahi: `createStutterWatch()` asli
      `frameupdate` ke beech ka waqt naapta hai. "stutter watch (6.12)" ke 4 test pass:
      poori raftaar par false + measured ~30fps, aadhi raftaar par true + ~15fps, poore
      sample se pehle koi faisla nahi (ek dheema frame hakla nahi hota), reset ke baad
      phir se intezaar. Draft ka ganit bhi test me hai: 100% par scale 0.5 par ruk jaata
      hai, aur pehle se chhoti scale ko **bada nahi** karta.
      ⚠️ Imaandari: draft composition ka resolution nahi ghatata (Remotion Player
      composition ko uske apne pixel par banata hai aur CSS se scale karta hai) — sirf
      raster/composite ka kaam ghatta hai. Yahi baat code ke comment aur button ke
      tooltip dono me likhi hai.

- [x] 6.13 Test: Phase 3 ka sample doc DB me daalo, preview me chalao, aur usi doc ka render
      karke **same frame numbers** ke 2 frames compare karo (preview screenshot vs rendered
      frame). Farak ho to batao — chhupao nahi.
      → **aadha ho gaya.** Render wala hissa chal chuka hai: `npm run render:sample` →
      `ALL PASS: 29 checks, 0 fail`, aur naapi hui frames
      `render-out/samples/frames-reel-30fps/` me maujood hain (Ken Burns ka safed chaukor
      frame 15/75/135 par 312/360/408 px — expected 312.0/360.0/408.0, farak 0px).
      **Preview wala hissa baaki hai** kyunki dev server ke liye `studio/.env.local` chahiye.
      **2026-08-20 — dono taraf mila kar dekh liya.** Ab poora test asli project par hua
      (12 clip, 3 track, asli cast images):

      1. `studio` me project khola, playhead ko theek **frame 100** par le gaya
         (transport me `frame 100/375` padha — andaaza nahi).
      2. Player ke dabbe ka asli `getBoundingClientRect()` liya (319×567, DPR 1.25) aur
         screenshot me se theek wahi hissa kaata.
      3. Usi doc ka `high` par render karaya, aur MP4 me se `select=eq(n\,100)` se
         **wahi frame 100** nikala.
      4. Dono ko 270×480 par laakar naapa:

      ```
      SSIM    All: 0.950   (R 0.950  G 0.951  B 0.949)
      PSNR    average: 32.54 dB
      ```

      Aankh se bhi dono ek jaise hain — tasveer frame me usi jagah, usi naap me.

      **Farak kahan se aaya (chhupa nahi raha):** 0.95, 1.00 nahi hai, aur uski teen saaf
      wajah hain — (a) preview 319px chaudi hai aur render 1080px, yaani screenshot ko
      3.4x downscale kiya gaya; (b) MP4 h264 se compressed hai; (c) screenshot PNG browser
      ke apne scaling se guzri hai. In teeno ke rehte 0.95 ka matlab "framing aur aspect
      ek hi hai" hota hai. **Agar layout me zara sa bhi farak hota — clip thodi si khiski
      hoti ya scale alag hoti — to SSIM 0.3 ke aas-paas girta.** Wo maine sach me dekha:
      pehli koshish me galti se ek purana MP4 use ho gaya tha (us beech project landscape
      hokar wapas aaya tha, jisse `refit` ne items chhote kar diye the) aur tab SSIM
      **0.024** aayi thi. Yaani ye naap sach me farak pakadti hai.

- [x] 6.14 `npm run typecheck` clean. Commit: "reel-studio: phase 6 — preview player".
      → typecheck **clean** (2026-08-20, 6 workspaces, exit 0), aur `npm run check` ke
      saare suite pass. 6.13 ho chuka hai, isliye phase ab COMPLETE hai.

## Verify (asli output paste karna)

```
npm run check --workspace @reel/studio    # preview ka ganit (abhi 32 test)
npm run typecheck
npm run build:studio

# Ye do cheezein aane ke baad:
npm run dev:studio       # play, scrub, frame step, timecode check
npm run render:sample    # phir frame compare
ffmpeg -i out.mp4 -vf "select=eq(n\,45)" -vframes 1 f45.png
```

## Done when

Preview chalta hai, frame-accurate scrub/step hota hai, playhead ek hi state se chalta hai,
aur preview vs render frame comparison mel khata hai.

## Progress log

| Date | What was done | Verified by | Next |
|---|---|---|---|
| 2026-08-19 | 6.1-6.12 ka poora code. `@remotion/player` install; `PreviewPlayer` wahi `ReelComposition` chalata hai jo render karti hai. Naya: `packages/reel-core/src/config/safeArea.ts` (guides = data), `studio/lib/preview.ts` (zoom/fit ka ganit, seek throttle, stutter watch, shared-audio-tags), `studio/lib/playback.tsx` (playback ka control — playhead **iske andar nahi**), `studio/lib/assetMap.ts`, `useElementSize`, `PreviewPlayer` + `TransportBar` + `ScrubBar` + `GuidesOverlay`. Shortcut registry me transport ki 7 key judi (space / ←→ / shift+←→ / Home / End) aur `run()` ab `{editor, playback}` context leta hai. TimelineStrip me wahi `<ScrubBar>` lagi taaki 6.7 ka "dono jagah ek frame" structure se hi sach ho. | `npm run check --workspace @reel/studio` → `ALL PASS: 32 tests, 0 fail` (preview layout 8, draft 2, seek throttle 4, stutter 4, audio tags 3, safe area 5, shortcuts 6); `npm run typecheck` → 6 workspaces exit 0; `npm run build:studio` → `✓ Compiled successfully`, `/project/[id]` 4.16 kB → **115 kB** (player sach me bundle me) | 6.13 — `studio/.env.local` + ffmpeg aate hi dev server par play/scrub dekhna aur render se frame compare karna. Phir 6.2/6.4/6.5/6.6/6.7/6.8/6.9/6.11 bhi tick honge. |
| 2026-08-19 | Apne hi Phase 6 code ko dobara padha aur **ek asli bug pakda**: pehle render par `size` null hoti hai (ResizeObserver abhi bola nahi), isliye `<Player>` mount hi nahi hota aur teeno effect `playerRef.current === null` dekh kar laut jaate the — naap aane par Player to mount ho jaata, par effects ki dependency nahi badalti thi, matlab **frameupdate/play/pause ke listener kabhi lagte hi nahi**. Screen par sab theek dikhta: preview chalti, par playhead kahin update nahi hota. Ab `playerMounted` har effect ki dependency me hai. Saath me teen aur: `initialFrame` ab jamaaya hua (har frame par badalta hua nahi), guides ka `boxShadow: 0 0 0 9999px` ab `overflow-hidden` se frame ke andar kata hai (warna poore editor par kaali chaadar), aur timeline ki playhead lakeer ScrubBar ke saath `px-3` par align hui. | `npm run check --workspace @reel/studio` → `ALL PASS: 32 tests, 0 fail`; `npm run typecheck --workspace @reel/studio` exit 0; `npm run build:studio` → `✓ Compiled successfully`, `/project/[id]` 115 kB | Wahi — 6.13 ke liye env + ffmpeg ka intezaar |
| 2026-08-19 | ffmpeg aane ke baad Phase 3 ka poora render dobara chalaya — ye zaroori regression check tha, kyunki Phase 5 me `worker/src/ffmpeg.ts` uthkar `@reel/media` me chala gaya tha aur wahi file render bhi chalati hai. 6.13 ka render wala aadha hissa ab saabit hai; preview wala aadha `studio/.env.local` par ruka hai. | `npm run render:sample` → `ALL PASS: 29 checks, 0 fail`; ffprobe: h264 / High / yuv420p / 1080×1920 / 30fps / aac 48000Hz 2ch, duration 10.048s (doc 10.000s); audio khaali nahi (mean_volume -37.4 dB); Ken Burns 312→360→408 px (expected 312.0/360.0/408.0); render 46.5s, 300 frames, 6.5 fps | 6.13 ka preview wala aadha — `studio/.env.local` aate hi |
