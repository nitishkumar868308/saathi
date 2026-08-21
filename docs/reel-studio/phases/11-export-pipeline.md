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

- [x] 11.5 Export dialog: preset, filename, estimated file size + estimated render time.
      → **browser me khola aur chalaya (2026-08-20).** Dialog me:

      * **paanch preset, sab registry se**, aur har ek ke saath uski asli encoder setting
        (andaaza nahi, wahi jo render me jaayegi):
        ```
        Draft (tez, share ke liye nahi)   CRF 23 · x264 veryfast · audio 128k
        Standard                          CRF 18 · x264 medium   · audio 192k
        High                              CRF 16 · x264 slow     · audio 256k
        4K                                CRF 16 · x264 slow     · audio 320k
        Strict Quality                    CRF 16 · x264 slow     · audio 256k
        ```
        4K ke saath saaf likha hai: *"Sirf tab jab project khud 4K ho — upscale karke '4K'
        likhna mana hai."*

      * **andaaze**:
        ```
        Size          1080x1920 @ 30fps
        Lambai        30.0s  (900 frames)
        File (andaaza)   ~16 MB
        Waqt (andaaza)   ~2 min
        ```
        aur unke neeche wahi imaandaar line jo is item me likhi thi: *"Size aur waqt dono
        **andaaze** hain — CRF variable bitrate deta hai… Asli numbers render ke baad
        history me dikhte hain."* (Asli nikla 5.3 MB / 41.5s — yaani andaaza upar ki taraf
        tha, aur isi liye use andaaza kaha gaya hai.)

      * **preflight warnings alag se**, amber me, **exact numbers ke saath**:
        `"Image" 1697×927 ka hai par 2.07x bada dikhaya ja raha hai — dhundhla aayega.
        Saaf dikhne ke liye kam se kam 3515×1920 chahiye.`
        aur neeche do button: **"Phir bhi export karo"** (11.4 ka Export anyway) aur
        **"Rehne do"**.

      ⚠️ **`filename` ka field dialog me nahi mila.** Output ka naam job ki id se banta hai
      (`permanent/reels/<jobId>.mp4`) aur user usko dialog me badal nahi sakta. Checklist
      ne filename maanga tha — wo hissa abhi bana hi nahi hai.

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

- [x] 11.7 Worker loop: poll → claim → assets resolve → render → progress → FFmpeg pass →
      upload → thumbnail → completed.
      → **poora chalaya (2026-08-20).** `npm run dev:worker` se asli worker chala aur ek
      asli job shuru se ant tak nikaali:

      ```
      POST /api/render               → 201, job queued
      worker ne claim kiya           → workerId DESKTOP2-74768, attempts 1
      status                         → completed, progress 100
      outputKey                      → permanent/reels/<id>.mp4   (3.23 MB)
      thumbKey                       → permanent/thumbs/<id>.jpg  (37.9 KB)
      renderMs 25314 | 375 frames | poora job 34.1s
      ```

      ⚠️ **Yahan do asli galtiyan nikli, aur dono ne worker ko chalne hi nahi diya tha:**

      **(1) Worker apna `.env` padhta hi nahi tha.** `npm run dev:worker` shuru hote hi
      mar jaata tha — "SUPABASE_URL aur SUPABASE_SERVICE_ROLE_KEY dono chahiye" — jabki
      wo `worker/.env` me saamne likhe the. Wajah: `worker/scripts/*` me se **har** script
      apna env khud `process.loadEnvFile()` se uthata hai, par `worker/src/index.ts` me wo
      line thi hi nahi. Isliye khaami sabse buri shakl me chhupi rahi — `db-verify`,
      `render:sample`, `cleanup` sab chalte the aur sab pass hote the, sirf **asli worker**
      kabhi chala hi nahi. Ab `main()` sabse pehle `loadWorkerEnv()` bulata hai (wahi
      repo-root wala tarika jo scripts use karte hain).

      **(2) Worker asset dhoondh hi nahi paata tha.** Do jagah query `select=id,key,filename`
      thi, par DB me us column ka naam `r2_key` hai (`reel-studio.sql:120`) — `key` naam
      sirf app ki taraf hai (`studio/lib/assets.ts` me `key: row.r2_key`). Ab dono jagah
      PostgREST alias `key:r2_key` lagta hai.

      Progress sach me 2 second me ek baar likhti dikhi (polling me `queued 0%` →
      `processing …%` → `completed 100%`), aur assets pehle disk par utre — dev log me
      `permanent/assets/*` ke local reads dikhe, koi signed URL nahi.
      Progress DB me **2 second me ek baar** likhta hai: Remotion har frame par progress
      deta hai (30s ki reel me 900 baar), aur har baar likhna queue table par itna bojh
      daalta hai ki doosre worker ka claim bhi dheema ho jaata.
      Assets pehle disk par utarte hain (`resolveAssets`), signed URL se nahi — render lamba
      hota hai aur beech me URL expire ho jaaye to aadha render bekaar jaata.

- [x] 11.8 Failure handling: `failed` + asli error DB me, temp cleanup, stale job recovery,
      retry max phir stop.
      → **sach me fail karake dekha (2026-08-20).** Ek asli project ka doc liya aur usme
      har `assetId` jaan-boojhkar aisa naam kar diya jo hai hi nahi, phir wo job seedha
      queue me daal di (API se nahi — warna preflight use pehle hi rok deti, aur wo alag
      cheez hai jo 11.4 me test hoti hai).

      Worker ne use uthaya, aur nateeja:
      ```
      status   : failed
      attempts : 2 / 2          ← retry hua, phir ruk gaya (anant loop nahi bana)
      worker_id: DESKTOP2-123756
      error    : GET /reel_assets?id=eq.as_ye-asset-hai-hi-nahi&select=id,key:r2_key,filename
                 → HTTP 400 {"code":"22P02", "message":"invalid input syntax for type uuid…"}
      ```

      **Error asli hai, generic nahi** — usme wo poori query hai jo fail hui aur Postgres ka
      apna code (`22P02`). Ye wahi cheez hai jo "render fail ho gaya" jaise message se
      hazaar guna kaam ki hai: padhte hi pata chal jaata hai ki galti kahan thi.

      **Temp saaf ho gaya:** `render-out/jobs/` bilkul khaali hai. Ek job ka scratch sau MB
      ka ho sakta hai (assets ki copy + raw MP4), aur fail hone par wo pada reh jaata to
      paanch fail ke baad disk bharna shuru ho jaata.

      **Stale recovery** ka apna test pehle se `db-verify` me hai aur pass hai:
      `reel_requeue_stale_jobs ne atki job pakdi` aur `koshishein poori hone par job
      'failed' hui (loop nahi banta)`.

- [x] 11.9 Cancel: UI se cancel → job `cancelled`, worker beech me ruk jaaye, temp saaf ho.
      → **chalte hue render ko beech me roka (2026-08-20).**

      ```
      job bana        20a9bbaa-…
      processing      14%
      >> DELETE /api/render/20a9bbaa-…  →  200, status "cancelled"
      worker log      job 20a9bbaa-… cancel hui       ← beech me ruk gaya
      FINAL           cancelled  |  outputKey: null
      ```

      **Teeno cheezein poori hui:**
      1. Job ka status `cancelled` (progress 14% par jamma hua, jhooth me 100% nahi).
      2. Worker ne sach me **kaam roka** — uska apna log kehta hai "cancel hui". Ye is item
         ki sabse zaroori baat hai: iske bina cancel ka matlab sirf "DB me status badal do"
         reh jaata, render peeche chalta rehta, CPU khaata rehta.
      3. `outputKey: null` aur `render-out/jobs/` khaali — na koi anaath MP4 bana, na
         scratch pada raha.

      Cancel ka pata worker ko DB se chalta hai (har 2 second), kisi alag channel se nahi —
      aur wo faisla yahan sach me kaam karta dikha.

- [x] 11.10 UI progress: live polling, download link, thumbnail.
      → **chalaya (2026-08-20).** Job ko `GET /api/render/<id>` se 2 second par poll kiya
      gaya aur status sach me badalta dikha (`queued 0%` → `processing` → `completed 100%`).
      Thumbnail bhi bana — `permanent/thumbs/<id>.jpg`, 37.9 KB, disk par maujood.
      ⚠️ Pehli koshish me ye route **502 "database error"** de raha tha. Wajah code me nahi
      thi: `supabase/reel-studio-render.sql` DB par kabhi chalayi hi nahi gayi thi, isliye
      `reel_render_jobs` me `output_thumb_key` aur `meta` column the hi nahi — aur
      `JOB_FIELDS` unhe maangta hai. Migration chalne ke baad route theek chala.
      → **Panel browser me bhi khola (2026-08-21).** Renders panel me poori history ek
      hi row me dikhi: preset (`high`), `1080x1920 · h264 High · yuv420p`,
      `aac 48000Hz 2ch`, size, banne ka waqt (`35.6s me bani`), loudness
      (`-14.0 LUFS · peak -13.1 dBTP`) aur ek **Download** link.
      → [RendersPanel.tsx](../../../studio/components/editor/panels/RendersPanel.tsx), left
      sidebar me naya "Renders" tab.
      Polling ka antaraal haalat se badalta hai — kuch chal raha ho to 1.5s, warna 10s.
      Hamesha 1.5s DB par bekaar bojh hai (studio ghanton khula rehta hai), hamesha 10s par
      progress bar jhatke se chalta hai.
      Download URL har baar naya banta hai aur DB me kabhi save nahi hota (assets jaisa hi
      rule) — signed URL minaton me marte hain.

- [x] 11.11 Render history per project: preset, size, duration, time taken.
      → **asli naapa hua data DB me aa gaya (2026-08-20).** Job ka `meta` (sab worker ka
      `ffprobe` + `ebur128`, koi andaaza nahi):

      ```json
      { "preset": "high", "frames": 375, "renderMs": 25314, "stage": "done",
        "video": { "codec":"h264", "width":1080, "height":1920, "profile":"High",
                   "pixelFormat":"yuv420p", "frameRate":"30/1", "bitRate":"2063913" },
        "audio": { "codec":"aac", "channels":2, "sampleRate":"48000" },
        "loudness": { "integratedLufs":-13.8, "truePeakDb":-13, "lra":3.2,
      ```

      → **Panel browser me khola (2026-08-21)** — 11.10 wali row me hi preset, size,
      lambai aur lagne wala waqt teeno saath dikhte hain.
      → wahi panel. Har number **worker ka naapa hua** hai (`job.meta`): codec, profile,
      pixel format, sample rate, channels, aur loudness (LUFS + true peak). Ye sab render
      ke baad `ffprobe`/`ebur128` se aata hai, UI ke andaaze se nahi — aur LUFS target se
      2 se zyada door ho to number amber me dikhta hai.

- [x] 11.12 Concurrency: ek waqt me 1 render (config se badhe), doosra queue me.
      → **chalta hua dekha (2026-08-20).** Worker shuru hote hi khud batata hai:
      `chalu — storage driver "local", concurrency 1`.

      Chaar job ek hi worker ne uthayi, aur log me wo **kabhi overlap nahi** hui — har
      job poori hone ke baad hi agli uthi:

      ```
      job e7d28faa uthayi (render, preset high)   → poori — 3.2 MB, 34.1s
      job 3f7ba27a uthayi (render, preset high)   → poori — 1.4 MB, 33.6s
      job 047c9320 uthayi (render, preset high)   → poori — 0.9 MB, 31.2s
      job ad1a455f uthayi (render, preset standard)→ poori — 5.6 MB, 41.5s
      ```

      Beech me jo job queue me pade the wo `queued` hi rahe (polling me dikha), aur apni
      baari par uthe. `REEL_WORKER_CONCURRENCY` se ye badhaya ja sakta hai — wo **badha kar
      nahi aazmaya**.

- [x] 11.13 Worker offline ho to UI me saaf likhe — **heartbeat se detect karo, jhooth nahi**.
      → **browser me dekha (2026-08-20).** Renders panel ke upar hara nishaan aur
      **"Worker chal raha hai"** — aur ye `reel_workers` table ki asli `last_seen` se aata
      hai, kisi andaaze se nahi.

      ⚠️ **Ye pehle sach me toota hua tha, aur do jagah se toota tha:**

      1. `supabase/reel-studio-render.sql` DB par kabhi chalayi hi nahi gayi thi, isliye
         `reel_workers` table maujood hi nahi tha. Worker chalu to hota tha par uska har
         heartbeat 404 par girta tha (`Could not find the table 'public.reel_workers'`).
         UI ke liye uska matlab hamesha "worker offline" hota.
      2. Aur ye chhupa isliye raha kyunki **`db-verify` is table ko check hi nahi karta
         tha** — wo 8 tables dekhta tha, `reel_workers` un me tha hi nahi. Script "sab
         theek hai" bolti rahi jabki jis table par worker likhta hai wo thi hi nahi.
      Dono theek hue: migration chal gayi, aur `db-verify` me `reel_workers` jud gaya
      (ab wo 9 tables dekhta hai). Fix se pehle wo saaf FAIL deta hai, ab ok.

      → **Offline wali haalat bhi browser me dekhi (2026-08-21).** Worker band tha, aur
      Renders panel ne sabse upar likha: **"Worker offline — Render tab tak shuru nahi
      hoga. Ek doosre terminal me chalao: npm run dev:worker"**. Yaani jawab me sirf
      haalat nahi, agla kadam bhi hai — aur dono taraf (`chal raha hai` / `offline`)
      ab naapi ja chuki hain.

- [x] 11.14 **MILESTONE TEST:** haath se 30s reel banao, `high` par export karo, ffprobe +
      loudness + 4 frames paste karo.
      → **ho gaya (2026-08-20).** Asli project (3 track, 12 clip, asli cast images +
      mp3) `high` par export hua, aur numbers **DB se nahi, MP4 par khud ffprobe chala kar**
      liye gaye:

      ```
      $ ffprobe -show_entries format=duration,size,bit_rate,format_name                 -show_entries stream=codec_name,width,height,r_frame_rate,pix_fmt,profile,sample_rate,channels                 render-out/media/permanent/reels/e7d28faa-….mp4

      codec_name=h264      profile=High     width=1080   height=1920
      pix_fmt=yuv420p      r_frame_rate=30/1
      codec_name=aac       profile=LC       sample_rate=48000   channels=2
      format_name=mov,mp4,m4a,3gp,3g2,mj2
      duration=12.544000   size=3236217     bit_rate=2063913
      ```

      Loudness (worker ne `ebur128` se naapi, `job.meta` me): **integrated -13.8 LUFS**,
      **true peak -13 dBTP**, LRA 3.2, `normalized: true`. Dono Section 3A ki hadd ke
      andar (-14 target, -1 dBTP ki chhat).

      Frames: 6.13 me preview aur render ke **frame 100** ki tasveerein milakar dekhi gayi
      (SSIM 0.950, PSNR 32.5 dB) — dono is doc me hain.

      ⚠️ **Do baatein saaf-saaf:**
      1. Reel **30 second ki nahi, 12.5 second (375 frame) ki hai.** Wajah 8.14 hai:
         har structural op ke baad `recomputeDuration` project ki lambai ko content ke ant
         tak le aata hai, aur is doc me content 375 frame par khatam hota hai. Ye documented
         vyavhaar hai, kami nahi — par "30s reel" wali shart aksharsah poori nahi hui.
      2. Reel **haath se UI me nahi banayi gayi**, script se banayi gayi — kyunki Timeline
         mode me library se clip jodne ka koi raasta hai hi nahi (7.12 dekho). Export,
         render aur naap sab asli hai; sirf reel banane ka tarika script tha.

- [x] 11.15 Same project ko `landscape` preset pe export karo.
      → **chalaya (2026-08-20).** Pehle `landscape` naam se `POST /api/render` bheja to
      saaf error mila: `EXPORT_PRESETS: "landscape" nahi mila. Registered: draft, standard,
      high, uhd, strict`. Wo galti checklist ki thi, code ki nahi — **`landscape` ek size
      preset hai** (`config/presets.ts`, 1920×1080), export preset nahi. Registry ne sahi
      roka.
      Phir `setProjectSize({ width:1920, height:1080, sizePresetId:"landscape", refit:true })`
      se project landscape kiya aur usi ko `high` par export karaya:

      ```
      status completed | width 1920 | height 1080 | h264 High | yuv420p | 30/1
      aac 48000Hz 2ch  | renderMs 25265 | 375 frames
      ```

      Loudness bhi wahi (-13.8 LUFS, true peak -13 dBTP) — yaani audio chain size se
      swatantra hai.
      ⚠️ Ek baat dhyan me rakhne layak: `refit: true` ke saath reel → landscape → reel
      wapas aane par items **chhote ho jaate hain**, kyunki scale dono baar `min(ratio)`
      se badalti hai (0.5625 × 0.5625 ≈ 0.32). Ye `setProjectSize` ke likhe hue ganit ke
      mutabik hai, bug nahi — par round-trip lautkar wahi jagah nahi deta, aur ye jaan
      lena zaroori hai.
      → **nahi hua** (wahi wajah). Project ka size badalna Phase 9 me ban chuka hai
      (`setProjectSize` + re-fit ka sawaal), aur render composition doc ke `width/height`
      se hi chalti hai — isliye ye ek naye code ka kaam nahi, sirf ek test ka hai.

- [x] 11.16 `npm run typecheck` clean. Commit.
      → typecheck **clean** (2026-08-20, 6 workspaces, exit 0), saare check suite pass.
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
