# Phase 0 — Toolchain + workspace skeleton

**STATUS:** not started
**One-line prompt:** `Read docs/reel-studio/README.md, then do Phase 0 of AI Reel Studio.`
**Rules:** README.md ke Standing + Dynamic rules binding hain. Resume Protocol follow karo.
**Depends on:** kuch nahi (ye pehla phase hai)

**Goal:** khaali par saaf neenv. FFmpeg chalu, npm workspaces bane, TypeScript build clean.
Koi feature nahi banega is phase me.

## Checklist

- [ ] 0.1 FFmpeg check: `ffmpeg -version` chalao. Na mile to mujhe exact command do
      (`winget install Gyan.FFmpeg`) aur **ruk jao** — khud install mat karo.
- [ ] 0.2 `ffprobe -version` bhi verify karo (dono chahiye).
- [ ] 0.3 Root `package.json` banao: `"private": true`, `"workspaces": ["studio","packages/*","worker"]`.
      `web/` aur `app-mobile/` workspaces me **nahi** aayenge (wo apne alag installs pe chalte hain).
- [ ] 0.4 Root `tsconfig.base.json`: strict true, `moduleResolution: "bundler"`, path aliases
      `@reel/core/*` → `packages/reel-core/src/*`, `@reel/remotion/*` → `packages/reel-remotion/src/*`.
- [ ] 0.5 `packages/reel-core` skeleton: package.json (name `@reel/core`, type module), tsconfig
      extending base, `src/index.ts` exporting kuch nahi abhi.
- [ ] 0.6 `packages/reel-remotion` skeleton: same tarah (`@reel/remotion`).
- [ ] 0.7 `worker/` skeleton: package.json (`@reel/worker`), tsconfig, `src/index.ts` jo `console.log`
      karke exit ho jaaye. `tsx` dev dependency.
- [ ] 0.8 `studio/` skeleton: Next.js 14 App Router + TypeScript + Tailwind. Sirf ek `/` page jo
      "AI Reel Studio" likhta hai. Koi editor code nahi.
- [ ] 0.9 `.gitignore` update: `studio/.next`, `worker/out`, `**/node_modules`, `*.local.env`,
      render output folder.
- [ ] 0.10 `studio/.env.local.example` + `worker/.env.example`: SUPABASE_URL, SUPABASE_SERVICE_ROLE,
      R2_* (4 keys), `REEL_STORAGE_DRIVER=local|r2`, `REEL_OUTPUT_DIR`. Comment style repo jaisa
      (Hinglish). **Asli keys kahin commit nahi.**
- [ ] 0.11 Root scripts: `dev:studio`, `dev:worker`, `typecheck` (saare packages), `build:studio`.
- [ ] 0.12 `npm install` root se chalao, phir `npm run typecheck` — clean hona chahiye.
- [ ] 0.13 `npm run dev:studio` chalake confirm karo `localhost:3000` khulta hai.
- [ ] 0.14 Commit: "reel-studio: phase 0 — workspace skeleton".

## Verify (asli output paste karna)

```
ffmpeg -version | head -1
ffprobe -version | head -1
npm run typecheck
npm run dev:studio    # phir page open karke confirm
```

## Done when

FFmpeg + ffprobe available, `npm run typecheck` bilkul clean, studio localhost pe khulta hai,
aur teen packages (`reel-core`, `reel-remotion`, `worker`) import-able bane hue hain.

## Progress log

| Date | What was done | Verified by | Next |
|---|---|---|---|
| | | | |
