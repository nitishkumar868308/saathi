# Phase 3 — Remotion composition + worker + FIRST REAL MP4

**STATUS:** not started
**One-line prompt:** `Read docs/reel-studio/README.md, then do Phase 3 of AI Reel Studio.`
**Rules:** README.md ke Standing + Dynamic rules binding. Resume Protocol follow karo.
**Depends on:** Phase 1, 2 complete

**Goal:** Project JSON se ek asli, chalne wala 1080x1920 MP4 nikale — bina kisi UI ke.
Windows + Chromium + FFmpeg ka risk yahin mar jaata hai.

## Checklist

- [ ] 3.1 Remotion license ka ek line summary mujhe do (solo free hai ya nahi) aur
      link do — phir aage badho.
- [ ] 3.2 `packages/reel-remotion` me Remotion install: `remotion`, `@remotion/transitions`,
      `@remotion/media-utils`. (Plan doc me listed hai — extra kuch chahiye to poochho.)
- [ ] 3.3 `src/ReelComposition.tsx`: inputProps = **poora doc**. Width/height/fps/duration
      doc se aate hain — hardcode nahi. Tracks order se layer hote hain (order = z-index).
- [ ] 3.4 `src/ItemRenderer.tsx`: item ka component **registry ke `componentKey` se** uthao.
      `switch (item.type)` sirf yahi ek lookup — components me nahi.
- [ ] 3.5 `src/items/ImageItem.tsx`, `VideoItem.tsx`, `AudioItem.tsx`, `TextItem.tsx`,
      `ShapeItem.tsx` — sab `transform` (x,y,scale,rotation,opacity,anchor) apply karein
      ek shared `<Transformed>` wrapper se, apna-apna nahi.
- [ ] 3.6 Registry entries me component wire karo (`registerItemComponent(id, comp)`), taaki
      naya item type = ek file + ek entry.
- [ ] 3.7 `src/Root.tsx`: `<Composition>` jo doc se `calculateMetadata` karke size/fps/duration
      set kare. Ek hi composition, sab kuch props se — har project ke liye nayi composition nahi.
- [ ] 3.8 Asset resolution: doc me `assetId` hai, URL nahi. `resolveAssets(doc, storage)` helper
      banao jo assetId → signed URL/local path ka map de, aur wo map inputProps me jaaye.
      **Kabhi doc ke andar URL save nahi karna** (expire ho jaate hain).
- [ ] 3.9 `worker/src/engines/types.ts`: `RenderEngine` interface —
      `render({doc, assets, outPath, preset, onProgress})`. Remotion ke bahar kuch leak na ho.
- [ ] 3.10 `worker/src/engines/remotion.ts`: `@remotion/bundler` + `@remotion/renderer` se
      bundle → `renderMedia` (h264, mp4, crf preset se) → progress callback.
- [ ] 3.11 `worker/src/ffmpeg.ts`: `ffprobe` se metadata padhna, `+faststart` pass,
      thumbnail nikalna. FFmpeg path env se override ho sake (`REEL_FFMPEG_PATH`).
- [ ] 3.12 `worker/scripts/render-sample.ts`: placeholder media **khud** FFmpeg se banao
      (ek gradient image, ek 5s tone/wav) — mujhse file mat maango. Ek sample doc banao
      `createEmptyProject()` + registry defaults se: image + Ken Burns + text overlay + audio.
- [ ] 3.13 `npm run render:sample` root script.
- [ ] 3.14 Render chalao. MP4 disk pe aaye. `ffprobe` output paste karo: 1080x1920, 30fps,
      h264, duration sahi, **audio stream present**.
- [ ] 3.15 3 frames extract karke (start/middle/end) mujhe dikhao ki Ken Burns sach me zoom
      kar raha hai aur text dikh raha hai.
- [ ] 3.16 Ek dusra sample chalao **16:9 aur fps 24** ke saath — sirf doc badalke, code
      touch kiye bina. Ye "dynamic" ka proof hai.
- [ ] 3.17 Render time note karo (30s reel me kitna laga) — mujhe batao.
- [ ] 3.18 `npm run typecheck` clean. Commit: "reel-studio: phase 3 — first real mp4".

## Verify (asli output paste karna)

```
npm run render:sample
ffprobe -hide_banner <output.mp4>
npm run render:sample -- --preset=landscape --fps=24
```

## Done when

Do MP4 (1080x1920@30 aur 1920x1080@24) sirf doc badal ke bane, dono chalte hain, audio ke
saath, aur `ffprobe` output paste kiya gaya hai. **Yahan tak sab UI ke bina.**

## Progress log

| Date | What was done | Verified by | Next |
|---|---|---|---|
| | | | |
