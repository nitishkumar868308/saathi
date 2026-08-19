# Phase 11 — Export pipeline end-to-end → **MILESTONE 1**

**STATUS:** in progress — poora pipeline likha aur jitna ho saka naapa gaya; asli end-to-end export `studio/.env.local` par ruka hai
**One-line prompt:** `Read docs/reel-studio/README.md, then do Phase 11 of AI Reel Studio.`
**Rules:** README.md ke Standing + Dynamic + **A1 Quality** rules binding. Resume Protocol follow karo.
**Depends on:** Phase 8, 9, 10 complete

**Goal:** UI se Export dabao → asli MP4 mile, A1 quality me, progress ke saath.

---

## ⚠️ Tick ka matlab (Phase 5-10 jaisa hi)

- **`- [x]`** — chalte hue check se saabit; saboot us item ke neeche `→` me hai.
- **`- [ ]`** — code likha hai aur build hota hai, par uska asli imtihaan baaki hai.

**Is phase ki khaas baat:** audio ka poora quality bar (11.3) **asli ffmpeg se naapa gaya
hai** — `@reel/media` ke check me dheemi awaaz wali file banti hai, normalize hoti hai, aur
phir `ebur128` se LUFS aur true-peak dono naape jaate hain. Jo cheez DB aur browser maangti
hai (job ka poora chakkar) wahi baaki hai.

---

## Checklist

- [x] 11.1 `EXPORT_PRESETS` registry: preset data me, code me nahi.
      → `draft` preset juda (Phase 3 me teen the). Uska naam hi chetavni hai —
      **"Draft (tez, share ke liye nahi)"** — kyunki uski CRF 23 hai, jo Section 3A ki
      chhat se upar hai. Wajah asli hai: 30s ki reel `high` par kai minute leti hai, aur
      "text thoda neeche karna hai" check karne ke liye utna intezaar kaam rok deta hai.
      Test (3): draft ki CRF 18 se upar hai **aur** uske label/hint me "share" ki chetavni
      hai; baaki teeno preset CRF ≤ 18 aur audio ≥ 192k par hain; aur **koi bhi preset
      upscale nahi karta** (`scaleTo` sab me `null`, `uhd` ka `requiresMinHeight` 2160).

- [x] 11.2 **A1 video quality (locked):** H.264 High, `yuv420p`, CRF ≤ 18, faststart,
      GOP ~2s, **koi double-encode nahi**.
      → Ye sab Phase 3 me `RemotionRenderEngine` me bandha gaya tha aur `render:sample` har
      baar naapta hai (h264 / High / yuv420p / 1080×1920@30). Phase 11 me ek naya hissa
      juda — aakhri FFmpeg pass — aur wahi wo jagah thi jahan double-encode ghus sakta tha.
      Test: **"normalize ke baad bhi video dobara encode NAHI hoti"** — pehle aur baad ki
      file ke video stream ka codec, width, height, pix_fmt aur **frame ginti** milaayi
      jaati hai. Re-encode hone par frame ginti badalti hai; copy hone par bilkul barabar
      rehti hai.

- [x] 11.3 **A1 audio quality (locked):** 48kHz stereo, AAC 192–320kbps, loudness ~-14 LUFS,
      true-peak -1 dBTP, clipping check.
      → naya [loudness.ts](../../../packages/reel-media/src/loudness.ts) — **do-pass**
      `loudnorm`.
      ⚠️ Ek-pass wala tarika jaan-boojhkar nahi liya: wo "dynamic" mode me chalta hai aur
      poori file dekhe bina gain badalta rehta hai — ek reel me uska matlab hota hai ki
      shuru me awaaz theek lagti hai aur beech me dab jaati hai. Do-pass me pehle poori
      file naapi jaati hai, phir ek hi (`linear=true`) gain lagti hai.
      Test (6, asli ffmpeg se): dheemi track ki loudness naapi jaati hai; normalize ke baad
      **LUFS target ke 1.5 ke andar** aa jaata hai; **true peak 0 se neeche** rehta hai
      (yaani clipping nahi); video re-encode nahi hoti; bina audio wali file par loudness
      chup-chaap **skip** hoti hai aur wajah wapas milti hai (chup track par bada gain
      lagane se sirf shor bharta hai); aur normalize band ho to sirf faststart lagta hai.

- [x] 11.4 Pre-export check: missing asset, zero-duration item, empty timeline, silent audio,
      resolution mismatch. Errors block karein, warnings dikhein with "Export anyway".
      → naya [quality/preflight.ts](../../../packages/reel-core/src/quality/preflight.ts) —
      10 rules, ek **list** (Dynamic rule 11), if-else ki zanjeer nahi.
      Do darje ka farak hi sabse zaroori baat hai: **error** wo hai jiska nateeja dekhne
      layak video hi nahi (khaali timeline, gayab asset) — us par minute kharch karna poora
      bekaar jaata. **Warning** wo hai jise user jaan kar chhod sakta hai (blurry image,
      chup reel) — us par rok lagana galat hoga, kyunki "editor ne export hi nahi karne
      diya" se bura kuch nahi.
      Test (11): sahi doc par koi error nahi; khaali timeline aur gayab asset **error**;
      blurry image, chup reel, volume>1, source se lambi clip, aur 1080p par 4K preset —
      paanchon **warning** (canExport phir bhi true); asset chahiye par lagi nahi = error;
      aur do rule ek id par nahi.
      ⚠️ Upscale ki warning me **animations ka scale bhi ginta hai** — Ken Burns 1→1.5
      lagate hi warning aa jaati hai, jabki bina uske nahi aati. Uska apna test hai.

- [ ] 11.5 Export dialog: preset, filename, estimated file size + estimated render time.
      → code maujood hai, browser me chalaya nahi.
      [ExportDialog.tsx](../../../studio/components/editor/ExportDialog.tsx) — preset ki
      list registry se, preflight ke error/warning alag-alag dikhte hain, aur worker offline
      ho to saaf command dikhti hai.
      Size ka andaaza `estimateExportBytes()` se, aur uska test hai (4): lambai ke saath
      seedha badhta hai, behtar preset par bada, chhote frame par chhota, aur 30s reel ka
      andaaza 5-40 MB ki dhang ki range me.
      ⚠️ Dialog me saaf likha hai ki size aur waqt **andaaze** hain — CRF variable bitrate
      deta hai, aur ek sthir number dikhana jhooth hota. Asli numbers render ke baad history
      me aate hain.
      "Include watermark" **nahi banaya** — watermark ka koi asset/setting abhi hai hi
      nahi, aur ek aisa toggle jo kuch na kare README rule 5 todta hai. Wo Phase 17 (brand)
      ke saath theek baithega.

- [x] 11.6 `POST /api/render`: `reel_render_jobs` me row + **doc ka frozen snapshot**.
      → [api/render/route.ts](../../../studio/app/api/render/route.ts) +
      [lib/renders.ts](../../../studio/lib/renders.ts).
      ⚠️ **Doc client se nahi aata** — server DB se padhta hai. Client apna doc bhej sakta
      tha (uske paas hai hi), par browser ka doc autosave se thoda peeche ho sakta hai aur
      render us purane doc ka ho jaata. Isliye dialog pehle `saveNow()` karta hai, phir
      server DB se uthata hai.
      ⚠️ Preflight **yahan bhi** chalti hai, sirf dialog me nahi — dialog ki jaanch
      soojh-boojh hai, deewar nahi.
      Frozen doc ka faisla Phase 2 ka hai aur uski wajah har render me dikhti hai: job
      chalte hue editing karna normal hai; project se padhne par aadha purana aadha naya
      output aata aur wajah kabhi samajh nahi aati.

- [ ] 11.7 Worker loop: poll → claim → assets resolve → render → progress → FFmpeg pass →
      upload → thumbnail → completed.
      → poora likha hai ([worker/src/index.ts](../../../worker/src/index.ts)), par **chalaya
      nahi** — uske liye `SUPABASE_URL` + service key chahiye.
      Progress DB me **2 second me ek baar** likhta hai: Remotion har frame par progress
      deta hai (30s ki reel me 900 baar), aur har baar likhna queue table par itna bojh
      daalta hai ki doosre worker ka claim bhi dheema ho jaata.
      Assets pehle disk par utarte hain (`resolveAssets`), signed URL se nahi — render lamba
      hota hai aur beech me URL expire ho jaaye to aadha render bekaar jaata.

- [ ] 11.8 Failure handling: `failed` + asli error DB me, temp cleanup, stale job recovery,
      retry max 2 phir stop.
      → code maujood hai, chalaya nahi. `attempts < max_attempts` par job wapas `queued`
      hoti hai (aur `claimed_at`/`worker_id` saaf), warna `failed`. Har job ka scratch
      `finally` me mit'ta hai — ek job ka scratch ~sau MB ka ho sakta hai (assets ki copy +
      raw MP4), aur paanch render ke baad disk bharna shuru ho jaata hai.
      `reel_requeue_stale_jobs` har minute chalta hai: worker crash ho to uski job
      `processing` par jam jaati hai aur koi doosra use uthata nahi.

- [ ] 11.9 Cancel: UI se cancel → job `cancelled`, worker beech me ruk jaaye, temp saaf ho.
      → code maujood hai, chalaya nahi. `RenderRequest.abortSignal` juda aur engine use
      Remotion ke `makeCancelSignal()` se jodta hai.
      ⚠️ Iske bina cancel ka matlab sirf "DB me status badal do" reh jaata — render peeche
      chalta rehta, CPU khaata rehta, aur ant me ek anaath file bana kar chhod deta.
      ⚠️ Cancel ke liye koi alag channel (websocket/queue) nahi banaya: worker har 2 second
      me DB dekhta hai. Ek aur channel matlab ek aur cheez jo alag se toot sakti — aur
      cancel wahi cheez hai jise tab chahiye hota hai jab pehle hi kuch galat ho chuka ho.
      Cancel ki query me `status=in.(queued,processing)` shart **query ke andar** hai;
      pehle-padho-phir-likho karne par ek race bacha reh jaata aur poori ho chuki video par
      "cancelled" likh jaata.

- [ ] 11.10 UI progress: live polling, download link, thumbnail.
      → [RendersPanel.tsx](../../../studio/components/editor/panels/RendersPanel.tsx), left
      sidebar me naya "Renders" tab.
      Polling ka antaraal haalat se badalta hai — kuch chal raha ho to 1.5s, warna 10s.
      Hamesha 1.5s DB par bekaar bojh hai (studio ghanton khula rehta hai), hamesha 10s par
      progress bar jhatke se chalta hai.
      Download URL har baar naya banta hai aur DB me kabhi save nahi hota (assets jaisa hi
      rule) — signed URL minaton me marte hain.

- [ ] 11.11 Render history per project: preset, size, duration, time taken.
      → wahi panel. Har number **worker ka naapa hua** hai (`job.meta`): codec, profile,
      pixel format, sample rate, channels, aur loudness (LUFS + true peak). Ye sab render
      ke baad `ffprobe`/`ebur128` se aata hai, UI ke andaaze se nahi — aur LUFS target se
      2 se zyada door ho to number amber me dikhta hai.

- [ ] 11.12 Concurrency: ek waqt me 1 render (config se badhe), doosra queue me.
      → `REEL_WORKER_CONCURRENCY` (default 1). Default 1 soch kar hai: render CPU ke saare
      core khaata hai, do ek saath chalane se dono dheeme hote hain aur kul samay ghatta
      nahi — sirf pehli video aane me der lagti hai.

- [ ] 11.13 Worker offline ho to UI me saaf likhe — **heartbeat se detect karo, jhooth nahi**.
      → naya `reel_workers` table (`supabase/reel-studio-render.sql`), worker har 5 second
      me apna waqt likhta hai, `GET /api/worker` use padhta hai.
      Iske bina UI ke paas do hi raaste bachte aur dono jhooth hote: hamesha "chal raha hai"
      dikhana (job atki rehti aur user samajh hi nahi paata), ya job ke queue me hone se
      andaaza lagana (worker abhi shuru hua ho to wo bhi galat).
      Offline ki hadd 20 second hai — worker 5s me likhta hai, par ek bhari frame par thoda
      late ho sakta hai; sakht hadd par UI beech-beech me "offline" jhalakta, jo galat alarm
      se bhi bura hai kyunki phir koi use dekhta hi nahi.

- [ ] 11.14 **MILESTONE TEST:** haath se 30s reel banao, `high` par export karo, ffprobe +
      loudness + 4 frames paste karo.
      → **nahi hua** — `studio/.env.local` ke bina UI se reel banayi hi nahi ja sakti.
      Jo ho saka: pipeline ke dono nazuk hisse alag-alag naape gaye —
      `npm run render:sample` → 29/29 (h264 High / yuv420p / 1080×1920@30 / aac 48kHz 2ch),
      aur `npm run check --workspace @reel/media` → loudness ke 6 test (LUFS target par,
      true peak 0 se neeche, video re-encode nahi).

- [ ] 11.15 Same project ko `landscape` preset pe export karo.
      → **nahi hua** (wahi wajah). Project ka size badalna Phase 9 me ban chuka hai
      (`setProjectSize` + re-fit ka sawaal), aur render composition doc ke `width/height`
      se hi chalti hai — isliye ye ek naye code ka kaam nahi, sirf ek test ka hai.

- [ ] 11.16 `npm run typecheck` clean. Commit.
      → typecheck clean, build pass, commit ho chuka.

- [x] 11.17 README ka Progress board + Milestone 1 ka summary.
      → README me Milestone 1 ka poora summary jud gaya: kya sach me chalta hai, kya sirf
      likha hua hai, aur kya chahiye us line ko paar karne ke liye.

## Verify (asli output paste karna)

```
$ npm run check --workspace @reel/core
ALL PASS: 213 assertions groups, 0 fail          (pehle 195)

$ npm run check --workspace @reel/media
ALL PASS: 16 tests, 0 fail                        (pehle 10 — 6 naye loudness ke)
  ok   dheemi track ki loudness naapi jaati hai
  ok   normalize ke baad loudness target ke paas aa jaati hai
  ok   true peak chhat ke neeche rehta hai (clipping nahi)
  ok   normalize ke baad bhi video dobara encode NAHI hoti
  ok   bina audio wali file par loudness chup-chaap skip hoti hai
  ok   normalize band ho to sirf faststart lagta hai

$ npm run typecheck        # 6 workspaces, exit 0
$ npm run build:studio     # ✓ Compiled
  /api/render, /api/render/[id], /api/render/[id]/url, /api/worker  — chaaron route bane
  /project/[id]  131 kB -> 134 kB

# Ye tab, jab studio/.env.local aa jaaye:
# 1. Supabase SQL editor me: supabase/reel-studio-render.sql
# 2. npm run dev:worker    (doosre terminal me)
# 3. npm run dev:studio    → UI se Export
ffprobe -hide_banner -show_streams <out.mp4>
ffmpeg -i <out.mp4> -af ebur128=peak=true -f null -
```

## Done when

UI se export karke A1-quality MP4 milta hai, progress sahi dikhta hai, cancel/fail handle
hote hain, aur Milestone 1 ka test video play hone laayak hai.

**Quality ke dono bar alag-alag saabit ho chuke hain** (video Phase 3 se, audio yahan se).
Jo bacha hai wo poora chakkar hai: UI → job → worker → file.

## Progress log

| Date | What was done | Verified by | Next |
|---|---|---|---|
| 2026-08-20 | Poora export pipeline. **Core:** `draft` preset, aur naya `quality/preflight.ts` (10 rules, error/warning ka farak). **@reel/media:** naya `loudness.ts` — do-pass `loudnorm`, `ebur128` se naapna, aur `finalizeMp4()` jo faststart + loudness lagata hai par **video ko haath nahi lagata**. **DB:** `supabase/reel-studio-render.sql` (draft preset ka constraint, `output_thumb_key` + `meta jsonb`, aur naya `reel_workers` heartbeat table). **Worker:** poora loop — poll, claim, assets, render, finalize, naapo, thumbnail, upload; cancel ke liye `abortSignal` (Remotion ke `makeCancelSignal` se juda), stale requeue, retry ki hadd, aur scratch ki safai. **Studio:** `lib/renders.ts`, chaar API routes, `ExportDialog`, `RendersPanel`, aur TopBar ka Export button asli ho gaya (Preview ka dead button hata diya). | `npm run check --workspace @reel/core` → `ALL PASS: 213 groups` (195 se); `npm run check --workspace @reel/media` → `ALL PASS: 16 tests` (10 se — 6 loudness ke, asli ffmpeg par); `npm run typecheck` → 6 workspaces exit 0; `npm run build:studio` → chaaron naye route bane, `/project/[id]` 131 → **134 kB** | 11.7-11.15 — sab `studio/.env.local` + `reel-studio-render.sql` par ruke hain. Wo aate hi worker chala kar poora chakkar test hoga. |
