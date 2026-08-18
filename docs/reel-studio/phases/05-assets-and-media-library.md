# Phase 5 — Asset upload + media library

**STATUS:** not started
**One-line prompt:** `Read docs/reel-studio/README.md, then do Phase 5 of AI Reel Studio.`
**Rules:** README.md ke Standing + Dynamic + A1 Quality rules binding. Resume Protocol follow karo.
**Depends on:** Phase 2, 4 complete

**Goal:** apni images/videos/audio/music/screen-recordings andar laao, unka asli metadata
capture karo (quality validation ka base yahi hai), aur library me dikhao.

## Checklist

- [ ] 5.1 `POST /api/assets/presign`: kind + filename + mime le kar R2 presigned PUT de
      (ya local driver ka upload URL). Allowed mime list config se, hardcode nahi.
- [ ] 5.2 Browser upload: drag-drop + file picker + clipboard paste. Multiple files ek saath,
      per-file progress, cancel, retry. Bada file bhi (ek 200MB screen recording) chale.
- [ ] 5.3 Metadata browser me nikaalo **upload se pehle**: image → naturalWidth/Height;
      video → `loadedmetadata` se width/height/duration + `requestVideoFrameCallback` se fps
      estimate; audio → duration. Ye `reel_assets` me jaata hai.
- [ ] 5.4 Worker-side asli probe (`POST /api/assets/[id]/probe` → job ya direct ffprobe agar
      local): codec, bitrate, sample rate, channels, pixel format, rotation metadata.
      **A1 quality:** ye asli numbers hone chahiye, guess nahi.
- [ ] 5.5 Thumbnail/poster generate: image ke liye resize, video ke liye 1 frame,
      audio ke liye waveform PNG (ffmpeg `showwavespic`). Storage me `temp/thumbs/` nahi —
      `permanent/thumbs/` (chhote hain).
- [ ] 5.6 `lifecycle` set karo: user-uploaded = `permanent`. Generated (TTS/lipsync/render temp)
      = `temporary` + `expires_at` (config se, default 7 din).
- [ ] 5.7 Checksum (sha256, browser me streaming) — duplicate upload detect karo aur
      "ye file already hai" dikhao, dobara upload na karo.
- [ ] 5.8 Media library UI (LeftSidebar): tabs **registry se** (Media/Images/Videos/Audio/
      Music/Screen recordings), search, sort, kind filter, grid/list toggle, hover preview,
      rename, delete (agar kisi project me use ho raha hai to warn karo — kahan use hua bhi batao).
- [ ] 5.9 Asset detail panel: resolution, duration, fps, codec, size, aur ek **quality badge**
      (e.g. "1080p ✓", "480p — 4K me blurry"). Badge ka logic ek chhote helper me, jo Phase 20
      ke validator me reuse hoga.
- [ ] 5.10 Signed URL cache: client me short-lived URL cache + auto refresh on expiry.
      Doc me URL kabhi save nahi.
- [ ] 5.11 Local dev fast path: `REEL_STORAGE_DRIVER=local` pe upload disk pe jaaye,
      wahi UI bina badle chale.
- [ ] 5.12 Test: 3 images (ek 480p, ek 1080p, ek 4K), ek 30s video, ek mp3, ek wav upload karo.
      Sab ke metadata row mujhe dikhao (`select` output).
- [ ] 5.13 `npm run typecheck` clean. Commit: "reel-studio: phase 5 — assets + media library".

## Verify (asli output paste karna)

```
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
| | | | |
