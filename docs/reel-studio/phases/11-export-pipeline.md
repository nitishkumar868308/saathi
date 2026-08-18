# Phase 11 — Export pipeline end-to-end → **MILESTONE 1**

**STATUS:** not started
**One-line prompt:** `Read docs/reel-studio/README.md, then do Phase 11 of AI Reel Studio.`
**Rules:** README.md ke Standing + Dynamic + **A1 Quality** rules binding. Resume Protocol follow karo.
**Depends on:** Phase 8, 9, 10 complete

**Goal:** UI se Export dabao → asli MP4 mile, A1 quality me, progress ke saath.
Iske baad Milestone 1 poora: **manual editor jo asli video banata hai.**

## Checklist

- [ ] 11.1 `EXPORT_PRESETS` registry: `standard` (CRF 20), `high` (CRF 18), `max` (CRF 16),
      plus resolution/fps override option. Bitrate/CRF, audio bitrate, pixel format,
      color settings — sab preset data me, code me nahi.
- [ ] 11.2 **A1 video quality settings (locked):** H.264 High profile, `yuv420p`,
      CRF ≤ 18 (high preset default), `preset slow`/`medium` (speed vs quality mujhe batao),
      `-movflags +faststart`, GOP ~2s, **koi double-encode nahi** (Remotion se seedha final
      encode; FFmpeg pass sirf remux/faststart/loudness — video re-encode sirf tab jab
      zaroori ho, aur tab lossless-ish settings pe).
      Scaling `lanczos`, source se upscale avoid.
- [ ] 11.3 **A1 audio quality (locked):** 48kHz stereo, AAC 192–320kbps, loudness
      normalization ~-14 LUFS (social standard) with true-peak -1dBTP, clipping check.
      Voice track ko kabhi resample-degrade na karo (source 48k ho to 48k hi rahe).
- [ ] 11.4 Pre-export check (light version, poora Phase 20 me): missing asset, unreadable
      asset, zero-duration item, empty timeline, silent audio, resolution mismatch.
      Errors block karein, warnings dikhein with "Export anyway".
- [ ] 11.5 Export dialog: preset, resolution, fps, filename, "include watermark" toggle,
      estimated file size + estimated render time (asli measurement se, guess nahi).
- [ ] 11.6 `POST /api/render`: `reel_render_jobs` me row + **doc ka frozen snapshot** +
      asset id list. Response me jobId.
- [ ] 11.7 Worker loop (`worker/src/index.ts`): poll (2s) → `reel_claim_render_job` →
      assets resolve → `RenderEngine.render` → progress DB me (throttled, ~1%/2s) →
      FFmpeg pass → upload R2 (`permanent/reels/`) → thumbnail → `completed`.
- [ ] 11.8 Failure handling: exception pe `failed` + asli error message DB me,
      temp files cleanup, aur worker crash pe `reel_requeue_stale_jobs` se recovery.
      Retry max 2, phir stop (infinite loop nahi).
- [ ] 11.9 Cancel: UI se cancel → job `cancelled`, worker beech me ruk jaaye (Remotion ka
      abort signal), temp saaf ho.
- [ ] 11.10 UI progress: queued/processing %/completed/failed, live (polling 1–2s),
      completed pe download link (signed URL) + "Open folder" (local driver pe) + thumbnail.
- [ ] 11.11 Render history per project: pichhle renders, unka preset, size, duration, time taken.
- [ ] 11.12 Concurrency: ek waqt me 1 render (config se badhe), doosra queue me. Worker id
      log me.
- [ ] 11.13 Worker start karne ka ek command + README line: `npm run dev:worker`.
      Worker band ho to UI me saaf "Worker offline — start it with npm run dev:worker"
      (heartbeat se detect karo, jhooth nahi).
- [ ] 11.14 **MILESTONE TEST (ye poora karke dikhao):** haath se 30s reel banao —
      3 images (Ken Burns), 1 voiceover audio, 1 background music (volume kam),
      2 text overlays, 1 crossfade, 1 split, 1 duplicate. Export at `high`.
      Paste karo: `ffprobe` (resolution/fps/codec/profile/bitrate/audio codec+rate),
      loudness measurement (`ffmpeg -af ebur128` ya `loudnorm` print), aur 4 frames.
      Phir mujhe file bhi bata do kahan hai — mai khud dekh kar bolunga.
- [ ] 11.15 Same project ko `landscape` preset pe export karo — sirf project settings badal ke.
- [ ] 11.16 `npm run typecheck` clean. Commit: "reel-studio: phase 11 — export pipeline (milestone 1)".
- [ ] 11.17 README.md ka Progress board update + Milestone 1 ka summary likho: kya kya
      sach me kaam karta hai, kya nahi.

## Verify (asli output paste karna)

```
npm run dev:worker
# UI se export
ffprobe -hide_banner -show_streams <out.mp4> | grep -E "codec_name|profile|width|height|r_frame_rate|bit_rate|sample_rate|channels"
ffmpeg -i <out.mp4> -af ebur128=peak=true -f null -    # loudness
```

## Done when

UI se export karke A1-quality MP4 milta hai (CRF ≤18, 48kHz AAC ≥192k, faststart,
loudness ~-14 LUFS), progress sahi dikhta hai, cancel/fail handle hote hain, aur
Milestone 1 ka test video mere paas play hone laayak hai.

## Progress log

| Date | What was done | Verified by | Next |
|---|---|---|---|
| | | | |
