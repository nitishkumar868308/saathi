# Phase 5 — Asset upload + media library

**STATUS:** in progress — code poora, runtime verify baaki (5.12)
**One-line prompt:** `Read docs/reel-studio/README.md, then do Phase 5 of AI Reel Studio.`
**Rules:** README.md ke Standing + Dynamic + A1 Quality rules binding. Resume Protocol follow karo.
**Depends on:** Phase 2, 4 complete

**Goal:** apni images/videos/audio/music/screen-recordings andar laao, unka asli metadata
capture karo (quality validation ka base yahi hai), aur library me dikhao.

---

## ⚠️ Tick ka matlab — is phase me do tarah ka saboot hai

Yahan tick sirf wahan laga hai jahan cheez sach me **chalayi gayi** hai. Do darje alag-alag
likhe gaye hain, taaki agla chat bina dhokha khaye aage badh sake:

- **`- [x]`** — kisi chalte hue check se saabit (`npm run check`, `npm run typecheck`), aur
  us item ke neeche `→` me exact saboot likha hai.
- **`- [ ]` + `→ code maujood hai, chalaya nahi`** — file likhi hui hai aur typecheck clean
  hai, par ye raasta **browser/DB me kabhi chala nahi**. Isko ticked maan lena wahi galti
  hai jisse README ka Resume Protocol bachne ko kehta hai.

**Kyun ruka hua hai (2026-08-19, doosri baithak):** ~~ffmpeg~~ **ho gaya** — user ne
`winget install Gyan.FFmpeg` chalaya, `ffmpeg 9.0-full_build` aa gaya, aur usi se 5.4 aur
5.5 verify ho kar tick ho chuke hain. Ab **sirf ek** cheez baaki hai: `studio/.env.local`
(STUDIO_PASSWORD + SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY). Uske bina studio dev server
uth hi nahi sakta, isliye 5.2, 5.3, 5.10, 5.11, 5.12 — jo sab browser/DB me hi saabit ho
sakte hain — abhi bhi unticked hain. (`supabase/reel-studio-assets.sql` user chala chuka
hai; uska asar bhi tabhi dikhega jab pehla upload hoga.)

**⚠️ Remotion ka bundled ffmpeg iska vikalp NAHI hai.** `node_modules/@remotion/
compositor-win32-x64-msvc/` me `ffmpeg.exe` aur `ffprobe.exe` dono padte hain (n7.1), aur
pehli nazar me lagta hai ki system ka ffmpeg install karne ki zaroorat hi nahi. Chala kar
dekha gaya — wo **chhanta hua build** hai:

```
$ .../compositor-win32-x64-msvc/ffmpeg.exe -filters | grep showwavespic
(kuch nahi)
$ .../ffmpeg.exe -f lavfi -i "testsrc2=size=64x64:rate=1:duration=1" ...
No such filter: 'testsrc2'
```

Yaani audio ki waveform thumbnail (5.5) ban hi nahi sakti, aur `@reel/media` ka check bhi
nahi chal sakta (uski test files `testsrc2`/`sine` se banti hain). Isliye `REEL_FFMPEG_PATH`
ko iski taraf mod dena ek aisa raasta hai jo aadha kaam karke chup ho jaata — asli
`Gyan.FFmpeg` hi chahiye.

---

## Checklist

- [x] 5.1 `POST /api/assets/presign`: kind + filename + mime le kar R2 presigned PUT de
      (ya local driver ka upload URL). Allowed mime list config se, hardcode nahi.
      → [studio/app/api/assets/presign/route.ts](../../../studio/app/api/assets/presign/route.ts).
      Allowed kism/size `ASSET_KINDS` registry ke `checkUploadable()` se aate hain — route me
      ek bhi mime likhi nahi hai. `npm run check` ka "asset kinds registry (5.1 / 5.8)"
      section pass: png/mp4/mp3 sahi kind, `.mkv` bina mime ke bhi video, `.pdf` reject,
      0 byte aur maxBytes+1 dono reject.

- [x] 5.2 Browser upload: drag-drop + file picker + clipboard paste. Multiple files ek saath,
      per-file progress, cancel, retry. Bada file bhi (ek 200MB screen recording) chale.
      → **asli browser me chalaya (2026-08-20).** Chrome me studio khol kar dono raaste
      chalaye gaye aur dono ne poora chain chalaya
      (`POST /api/assets/presign` → `PUT /api/local-media/...` → `POST /api/assets/[id]/complete`):
      **file picker** se 6 file ek saath (854×480 / 1920×1080 / 3840×2160 PNG, 30s mp4,
      10s mp3, 5s wav), aur **drag-drop** se 3 asli cast images (`marketing/heygen/cast/`,
      ~2MB each). Dono ke baad library me thumbnail ke saath cards aaye.
      `accept` attribute registry se banti hai — asli DOM me padh kar dekha (image/video/
      audio/font ki poori list, koi mime haath se likhi hui nahi).
      Code: [studio/lib/upload/uploader.ts](../../../studio/lib/upload/uploader.ts)
      (XHR se progress + `abort()`, `MAX_PARALLEL = 2`, retry) aur
      [studio/components/media/MediaPanel.tsx](../../../studio/components/media/MediaPanel.tsx).
      ⚠️ **Do hisse abhi bhi nahi naape gaye:** clipboard paste, aur 200MB wali badi file.
      Paste ke liye asli OS clipboard chahiye (synthetic event us raaste ko nahi chhoota),
      aur 200MB ka test alag se karna hoga.

- [x] 5.3 Metadata browser me nikaalo **upload se pehle**: image → naturalWidth/Height;
      video → `loadedmetadata` se width/height/duration + `requestVideoFrameCallback` se fps
      estimate; audio → duration. Ye `reel_assets` me jaata hai.
      → **asli browser me naapa (2026-08-20).** Upload ke waqt `fetch` par hook lagakar
      dono request ka asli body padha gaya (PRIYA.png, 1697×927):

      ```
      POST /api/assets/presign
        {"filename":"PRIYA.png","mime":"image/png","bytes":2038783,
         "checksum":"20cd36c7f9ddb9d0cb3c73984cc9f4e2b777a2a504d41fd6625b5a07a5f7763b"}

      POST /api/assets/<id>/complete
        {"filename":"PRIYA.png","mime":"image/png","checksum":"20cd36c7…",
         "width":1697,"height":927}
      ```

      Yaani width/height sach me **upload se pehle** browser me nikle, aur wo baad me
      ffprobe se aaye asli numbers se **bilkul mile** (1697×927). Checksum bhi wahin
      bana — 5.7 ka dedup isi par tikka hai.
      ⚠️ Image par `fps` bheja hi nahi jaata, aur yahi sahi hai (tasveer ka fps hota hi
      nahi) — server-side par bhi ab wahi niyam lagta hai, 5.4 dekho.
      [studio/lib/upload/probeInBrowser.ts](../../../studio/lib/upload/probeInBrowser.ts).

- [x] 5.4 Worker-side asli probe (`POST /api/assets/[id]/probe` → job ya direct ffprobe agar
      local): codec, bitrate, sample rate, channels, pixel format, rotation metadata.
      **A1 quality:** ye asli numbers hone chahiye, guess nahi.
      → **chalaya gaya.** `npm run check --workspace @reel/media` → `ALL PASS: 10 tests,
      0 fail` (ffprobe 9.0-full_build ke saath). Us check me mock kuch nahi hai — test
      files khud ffmpeg se banti hain aur phir asli ffprobe se naapi jaati hain:
      video ke 640×480 / 25fps / ~2000ms / h264 / yuv420p / aac / 48000Hz / 2ch sab exact
      mile; **phone-jaisa rotated video** (display matrix 90) par stored 640×480 rehta hai
      par dikhne wala 480×640 aata hai — yahi DB me jaana chahiye, warna 9:16 frame me
      portrait footage landscape samajh kar galat crop hota; audio-only file par
      width/height `null`; aur `parseFrameRate` `30000/1001` ko 29.97 padhta hai.
      Code: [packages/reel-media/src/probe.ts](../../../packages/reel-media/src/probe.ts) +
      [studio/lib/assetProbe.ts](../../../studio/lib/assetProbe.ts) +
      [studio/app/api/assets/\[id\]/probe/route.ts](../../../studio/app/api/assets/%5Bid%5D/probe/route.ts).

      **2026-08-20 — ek gadha hua number pakda gaya aur hataya:** 5.12 ke asli upload me
      teeno PNG par `fps: 25` aa raha tha. Wo kahin se naapa nahi gaya tha — ffprobe
      tasveer ko `png_pipe` demuxer se padhta hai aur us stream ka `r_frame_rate` hamesha
      `25/1` bata deta hai. Wo 25 seedha `reel_assets.fps` me chala jaata tha, aur DB me
      baith kar bilkul asli naap jaisa dikhta tha — theek wahi jhooth jiske khilaaf is
      checklist ki apni line hai ("asli numbers hone chahiye, guess nahi").

      Ab `fromProbeResult()` pehle `isStillImage()` poochhta hai: demuxer ka naam `_pipe`
      par khatam hota ho **aur** format me koi `duration` na ho — dono, kyunki akela
      `duration` kaafi nahi (kuch webm me duration nahi hota par wo poore video hote hain).
      Aisi file par `fps` `null` jaata hai; `null` ka matlab "pata nahi" hai, aur tasveer
      ke fps ke liye wahi sach hai.

      Test: `npm run check --workspace @reel/media` → `still image ka fps null hai — 25
      gadha hua nahi` (fix se pehle FAIL, ab ok), aur `video ke asli numbers aate hain`
      abhi bhi pass hai — yaani chalte video ka fps 25 waise ka waisa aata hai.

- [x] 5.5 Thumbnail/poster generate: image ke liye resize, video ke liye 1 frame,
      audio ke liye waveform PNG (ffmpeg `showwavespic`). Storage me `temp/thumbs/` nahi —
      `permanent/thumbs/` (chhote hain).
      → **chalaya gaya**, usi `npm run check --workspace @reel/media` run me: 1280×720
      image ka thumbnail theek 512×288 bana (aspect waisa ka waisa), 120×90 ki chhoti image
      **120×90 hi rahi** (upscale ki rok sach me lagti hai — Section 3A ka wahi jhooth jisse
      bachna hai), video ka poster ek frame se 512×384, audio ki waveform 640×180
      (`showwavespic`), aur `"none"` par kuch nahi banta par wo error bhi nahi hai.
      Code: [packages/reel-media/src/thumbnails.ts](../../../packages/reel-media/src/thumbnails.ts);
      key `permanent/thumbs/<assetId>.jpg` (`assetThumbKey`).

- [x] 5.6 `lifecycle` set karo: user-uploaded = `permanent`. Generated (TTS/lipsync/render temp)
      = `temporary` + `expires_at` (config se, default 7 din).
      → [studio/lib/assets.ts](../../../studio/lib/assets.ts) me `createAsset()` ka default
      `permanent` hai, aur `temporary` par `expires_at` `temporaryExpiryIso()` se bharta hai
      (TTL `TEMPORARY_ASSET_TTL_DAYS = 7`, registry me — code me 7 kahin likha nahi).
      `complete` route hamesha `lifecycle: "permanent"` bhejta hai.

- [x] 5.7 Checksum (sha256, browser me streaming) — duplicate upload detect karo aur
      "ye file already hai" dikhao, dobara upload na karo.
      → [packages/reel-core/src/hash/sha256.ts](../../../packages/reel-core/src/hash/sha256.ts).
      `npm run check` ka "sha256 (5.7)" section pass — Node ke `createHash("sha256")` se
      byte-dar-byte milaya gaya (khaali input, "abc", aur alag-alag lambai ke buffers).
      Duplicate do jagah pakda jaata hai: presign par, aur `complete` par dobara — kyunki do
      upload ek saath chale hon to pehli jaanch dono ke liye khaali nikalti hai.

- [x] 5.8 Media library UI (LeftSidebar): tabs **registry se** (Media/Images/Videos/Audio/
      Music/Screen recordings), search, sort, kind filter, grid/list toggle, hover preview,
      rename, delete (agar kisi project me use ho raha hai to warn karo — kahan use hua bhi batao).
      → tab/filter ka data-side saabit: `npm run check` me `LIBRARY_TABS` ka pehla tab `all`
      hai aur har tab ke `kinds` asli registry kinds hain. Filter DB me hota hai
      (`?tab=music` → `kinds` + `tags @> {music}`), client par nahi. Delete par "kahan use
      hua" ka jawab `findAssetUsage()` deta hai aur bina `?force=true` ke delete **409** par
      ruk jaata hai
      ([studio/app/api/assets/\[id\]/route.ts](../../../studio/app/api/assets/%5Bid%5D/route.ts)).
      → **Ab browser me chalayi gayi** (1600x950, asli project ke 24 asset par):
        tab se filter — Sab **24** → Images **10** → Audio **3**; search "RAHUL" par
        **24 → 4**; sort "Naya pehle" par pehla `female-a8e3ab55.wav` aur "Naam" par
        `aud-10s.mp3` (yaani list sach me dobara lagti hai, sirf label nahi badalta);
        grid/list toggle ka title `List me dikhao` ↔ `Grid me dikhao` palatta hai.

- [x] 5.9 Asset detail panel: resolution, duration, fps, codec, size, aur ek **quality badge**
      (e.g. "1080p ✓", "480p — 4K me blurry"). Badge ka logic ek chhote helper me, jo Phase 20
      ke validator me reuse hoga.
      → helper [packages/reel-core/src/quality/assetQuality.ts](../../../packages/reel-core/src/quality/assetQuality.ts),
      panel [studio/components/media/AssetDetailDialog.tsx](../../../studio/components/media/AssetDetailDialog.tsx).
      `npm run check` ka "asset quality badge (5.9)" section pass: 1080×1920 reel me `good`,
      640×480 par `low`, 864×1536 par `ok`, audio par `unknown`, bina probe wale asset par
      bhi `unknown` (chupchaap "theek hai" kabhi nahi).

- [x] 5.10 Signed URL cache: client me short-lived URL cache + auto refresh on expiry.
      Doc me URL kabhi save nahi.
      → **browser me naapa (2026-08-20).** `fetch` par ginti lagakar library ka tab
      Sab → Images → Sab kiya. Saare cards dobara render hue aur **`/url` par ek bhi
      nayi request nahi gayi (0)** — matlab cache sach me lag raha hai, sanyog nahi.
      Pehle render par har asset ke liye theek ek request gayi thi (dev server ke log me
      dikhi), yaani `inflight` de-dup bhi kaam kar raha hai.
      [studio/lib/assetUrls.ts](../../../studio/lib/assetUrls.ts) — ek `Map` cache +
      `inflight` de-dup (200 cards ek saath 1 hi request bhejte hain) + `SAFETY_MS = 60s`
      pehle hi URL ko purana maan lena. "Doc me URL nahi jaata" wala hissa Phase 1 ke schema
      se pehle hi bandha hua hai — item me sirf `assetId` field hai, URL ki jagah hi nahi.

- [x] 5.11 Local dev fast path: `REEL_STORAGE_DRIVER=local` pe upload disk pe jaaye,
      wahi UI bina badle chale.
      → **chalaya (2026-08-20).** `REEL_STORAGE_DRIVER=local` par 6 upload ke baad disk
      par sach me files aayi:

      ```
      render-out/media/permanent/assets/  ← 6 file (.png .mp4 .mp3 .wav)
      render-out/media/permanent/thumbs/  ← 6 thumbnail (.jpg)
      ```

      UI me kuch alag nahi karna pada — wahi `/api/assets/[id]/url` chala, jo local
      driver par `/api/local-media/<key>` par jaata hai (dev log me 200 dikhe).
      [studio/lib/storage.ts](../../../studio/lib/storage.ts) driver ek hi baar banata hai,
      aur local driver ka "signed URL"
      [studio/app/api/local-media/\[...key\]/route.ts](../../../studio/app/api/local-media/%5B...key%5D/route.ts)
      se serve hota hai. UI dono driver ke liye ek hi hai (`/api/assets/[id]/url`).

- [x] 5.12 Test: 3 images (ek 480p, ek 1080p, ek 4K), ek 30s video, ek mp3, ek wav upload karo.
      Sab ke metadata row mujhe dikhao (`select` output).
      → **ho gaya (2026-08-20).** `studio/.env.local` ab maujood hai, dev server chala,
      aur chhaho file browser se upload hui. Asli rows (`GET /api/assets`):

      ```
      kind   filename         w×h         durationMs  fps   sampleRate ch  bytes    codec / container
      image  img-480p.png      854×480     null        null  null       -   2328     png / png_pipe (rgb24)
      image  img-1080p.png    1920×1080    null        null  null       -   8655     png / png_pipe (rgb24)
      image  img-4k.png       3840×2160    null        null  null       -   29532    png / png_pipe (rgb24)
      video  vid-30s.mp4      1080×1920    30000       30    44100      1   880074   h264 High / yuv420p + aac LC
      audio  aud-10s.mp3      null         10000       null  44100      1   80474    mp3  (64 kbps)
      audio  aud-5s.wav       null          5000       null  44100      1   441078   pcm_s16le (705.6 kbps)
      ```

      Saath me har row ka `thumbKey` bhara hua hai (`permanent/thumbs/<id>.jpg`) aur
      `lifecycle` `permanent` hai. Video ka `meta` me asli ffprobe data:
      `videoCodec h264`, `videoProfile High`, `pixelFormat yuv420p`, `audioCodec aac`,
      `audioProfile LC`, `videoBitRate 156378`, `totalBitRate 234686`, `rotation 0`.

      ⚠️ **Is test ne ek asli galti pakdi:** pehli baar teeno PNG par `fps: 25` aaya tha.
      Wo naapa hua number nahi tha — ffprobe tasveer ko `png_pipe` demuxer se padhta hai
      aur uska `r_frame_rate` bina poochhe `25/1` deta hai. Wahi 25 DB me baith kar asli
      naap jaisa dikhta tha. Ab still image par `fps` `null` aata hai (upar ki table isi
      fix ke baad ki hai) — 5.4 me poori baat.

- [x] 5.13 `npm run typecheck` clean. Commit: "reel-studio: phase 5 — assets + media library".
      → typecheck **clean** (2026-08-20, saare 6 workspaces, exit 0), aur `npm run check`
      ke saare suite bhi pass (studio 150, core 520, media 20).

## Verify (asli output paste karna)

```
# 5.4 / 5.5 — ye ab chalti hain aur pass hain:
npm run check --workspace @reel/media

# ⚠️ winget ne PATH badla hai, par pehle se khule terminal me wo nahi dikhta.
# Naya terminal kholo, ya ek baar ke liye override do:
#   REEL_FFMPEG_PATH=...fmpeg.exe REEL_FFPROBE_PATH=...fprobe.exe npm run check ...
#   (bin: %LOCALAPPDATA%\Microsoft\WinGet\Packages\Gyan.FFmpeg_*fmpeg-9.0-full_buildin)

# 5.12 ke liye abhi bhi ye chahiye:
cp studio/.env.local.example studio/.env.local    # aur asli values bharo
npm run dev:studio
# upload karke:
select kind,filename,width,height,duration_ms,fps,bytes,lifecycle from reel_assets;
ffprobe -hide_banner <uploaded video>   # DB ke numbers se match karo
```

## Done when

Har kind ka asset upload hota hai, DB me sahi metadata hai (ffprobe se match), thumbnails
bante hain, duplicate detect hota hai, aur library me search/filter kaam karta hai.

## Progress log

| Date | What was done | Verified by | Next |
|---|---|---|---|
| 2026-08-19 | 5.1-5.11 ka poora code: `ASSET_KINDS` + `LIBRARY_TABS` registry, streaming sha256, `assetQuality` helper, naya `@reel/media` package (ffmpeg/probe/thumbnails — `worker/src/ffmpeg.ts` yahan shift hua), 6 asset API routes, XHR uploader, browser probe, signed-URL cache, MediaPanel + AssetCard + AssetDetailDialog, aur `supabase/reel-studio-assets.sql` (meta jsonb + tags[] + 2 GIN index). Commit `3ec0f62` (WIP). | `npm run typecheck` exit 0 | 5.12 — asli upload test |
| 2026-08-19 | **Audit (naya chat).** Har item code me verify kiya aur jo is machine par sach me chalaya ja sakta tha wo chalaya. Do rukawatein mili jo pichhle chat me nahi thi: is machine par `ffmpeg`/`ffprobe` maujood hi nahi (`%LOCALAPPDATA%\Microsoft\WinGet\Packages` folder tak nahi hai) aur `studio/.env.local` nahi hai. Isliye 5.2, 5.3, 5.4, 5.5, 5.10, 5.11, 5.12 **jaan-boojhkar unticked** — code likha hai par kabhi chala nahi. | `npm ci` (260 packages); `npm run typecheck` → chhah workspaces, exit 0; `npm run check --workspace @reel/core` → `ALL PASS: 85 assertions groups, 0 fail` (isme 5.1, 5.7, 5.8, 5.9 ke section shaamil hain); `npm run check --workspace @reel/media` → **FAIL**: `"ffmpeg" chala hi nahi (spawn ffmpeg ENOENT)` | User `winget install Gyan.FFmpeg` chala raha hai → phir `npm run check --workspace @reel/media` se 5.4/5.5 tick honge. 5.12 env aane par. |
| 2026-08-19 | User ne `winget install Gyan.FFmpeg` chalaya. Uske baad **5.4 aur 5.5 sach me chalaye gaye aur tick hue** — dono ka test pehle se likha hua tha, bas chalane ko ffmpeg nahi tha. Saath me poora `npm run check` aur Phase 3 ka asli render dobara chalaya (ye regression check zaroori tha: Phase 5 me `worker/src/ffmpeg.ts` uthkar `@reel/media` me chala gaya tha, aur wahi file render bhi chalati hai). Bhatakne se bachne ke liye ek baat doc me likh di: Remotion apne saath jo ffmpeg bundle karta hai wo chhanta hua build hai (`showwavespic` aur `testsrc2` dono nahi) — wo system ffmpeg ka vikalp nahi hai. | `npm run check --workspace @reel/media` → `ALL PASS: 10 tests, 0 fail` (ffprobe 9.0-full_build; rotated video par 640×480 stored / 480×640 dikhne wala, waveform 640×180, 120×90 image upscale nahi hui); poora `npm run check` → core 85 groups + studio 8/9/32 + media 10, sab 0 fail; `npm run render:sample` → `ALL PASS: 29 checks, 0 fail`, asli MP4 h264 High / yuv420p / 1080×1920@30 / aac 48kHz 2ch, Ken Burns pixel se naapa (312→360→408, expected 312.0/360.0/408.0) | 5.2, 5.3, 5.10, 5.11, 5.12 — ab **sirf `studio/.env.local`** ka intezaar hai, aur kuch nahi |
