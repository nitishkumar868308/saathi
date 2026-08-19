# Phase 0 — Toolchain + workspace skeleton

**STATUS:** in progress — 0.3-0.14 done, **0.1/0.2 blocked on tumhare FFmpeg install**
**One-line prompt:** `Read docs/reel-studio/README.md, then do Phase 0 of AI Reel Studio.`
**Rules:** README.md ke Standing + Dynamic rules binding hain. Resume Protocol follow karo.
**Depends on:** kuch nahi (ye pehla phase hai)

**Goal:** khaali par saaf neenv. FFmpeg chalu, npm workspaces bane, TypeScript build clean.
Koi feature nahi banega is phase me.

## Checklist

- [ ] 0.1 FFmpeg check: `ffmpeg -version` chalao. Na mile to mujhe exact command do
      (`winget install Gyan.FFmpeg`) aur **ruk jao** — khud install mat karo.
      → **BLOCKED.** `ffmpeg` PATH pe nahi mila (PowerShell + bash dono me). Command
      user ko de di gayi: `winget install Gyan.FFmpeg` (winget me `Gyan.FFmpeg 9.0`
      available hai — verified via `winget search Gyan.FFmpeg`). Install user karega.
- [ ] 0.2 `ffprobe -version` bhi verify karo (dono chahiye).
      → **BLOCKED.** Same install ke saath aayega (Gyan build me ffprobe bundled hai).
- [x] 0.3 Root `package.json` banao: `"private": true`, `"workspaces": ["studio","packages/*","worker"]`.
      `web/` aur `app-mobile/` workspaces me **nahi** aayenge (wo apne alag installs pe chalte hain).
- [x] 0.4 Root `tsconfig.base.json`: strict true, `moduleResolution: "bundler"`, path aliases
      `@reel/core/*` → `packages/reel-core/src/*`, `@reel/remotion/*` → `packages/reel-remotion/src/*`.
- [x] 0.5 `packages/reel-core` skeleton: package.json (name `@reel/core`, type module), tsconfig
      extending base, `src/index.ts` exporting kuch nahi abhi.
- [x] 0.6 `packages/reel-remotion` skeleton: same tarah (`@reel/remotion`).
- [x] 0.7 `worker/` skeleton: package.json (`@reel/worker`), tsconfig, `src/index.ts` jo `console.log`
      karke exit ho jaaye. `tsx` dev dependency.
- [x] 0.8 `studio/` skeleton: Next.js 14 App Router + TypeScript + Tailwind. Sirf ek `/` page jo
      "AI Reel Studio" likhta hai. Koi editor code nahi.
- [x] 0.9 `.gitignore` update: `studio/.next`, `worker/out`, `**/node_modules`, `*.local.env`,
      render output folder.
- [x] 0.10 `studio/.env.local.example` + `worker/.env.example`: SUPABASE_URL, SUPABASE_SERVICE_ROLE,
      R2_* (4 keys), `REEL_STORAGE_DRIVER=local|r2`, `REEL_OUTPUT_DIR`. Comment style repo jaisa
      (Hinglish). **Asli keys kahin commit nahi.**
- [x] 0.11 Root scripts: `dev:studio`, `dev:worker`, `typecheck` (saare packages), `build:studio`.
- [x] 0.12 `npm install` root se chalao, phir `npm run typecheck` — clean hona chahiye.
- [x] 0.13 `npm run dev:studio` chalake confirm karo `localhost:3000` khulta hai.
- [x] 0.14 Commit: "reel-studio: phase 0 — workspace skeleton".

## Verify (asli output paste karna)

```
ffmpeg -version | head -1
ffprobe -version | head -1
npm run typecheck
npm run dev:studio    # phir page open karke confirm
```

### Asli output (2026-08-19)

```
$ ffmpeg -version
bash: ffmpeg: command not found          <-- 0.1 BLOCKED
$ ffprobe -version
bash: ffprobe: command not found         <-- 0.2 BLOCKED

$ winget search Gyan.FFmpeg
FFmpeg                      Gyan.FFmpeg              9.0     winget
FFmpeg (Essentials Build)   Gyan.FFmpeg.Essentials   8.1.1   winget

$ node -v && npm -v
v20.20.1
10.8.2

$ npm install
added 113 packages, and audited 118 packages in 18s

$ npm run typecheck
> @reel/studio@0.0.0 typecheck
> tsc --noEmit
> @reel/core@0.0.0 typecheck
> tsc --noEmit -p tsconfig.json
> @reel/remotion@0.0.0 typecheck
> tsc --noEmit -p tsconfig.json
> @reel/worker@0.0.0 typecheck
> tsc --noEmit -p tsconfig.json
(zero errors — chaaron workspaces clean)

$ npm run start --workspace @reel/worker
[reel-worker] skeleton chal gaya — abhi koi job nahi uthata (Phase 3 me aayega).

$ npm run build:studio
 ✓ Compiled successfully
 ✓ Generating static pages (4/4)
Route (app)                Size      First Load JS
┌ ○ /                      138 B     87.3 kB
└ ○ /_not-found            873 B     88.1 kB

$ npm run dev:studio  &&  curl localhost:3000
localhost:3000 -> HTTP 200
<title>AI Reel Studio</title>
<h1 class="text-3xl font-semibold tracking-tight">AI Reel Studio</h1>
# Tailwind sach me compile hua (layout.css 11715 bytes):
.min-h-screen { min-height: 100vh; }
.text-3xl { font-size: 1.875rem; line-height: 2.25rem; }
.tracking-tight { letter-spacing: -0.025em; }
```

Alias proof (0.4) — temp probe file `@reel/core/__alias_probe` studio aur worker dono se
import karke `npm run typecheck` chalaya: zero errors. Probe files delete kar diye,
repo me nahi hain.

## Known issues / decisions is phase se

1. **FFmpeg install pending** — 0.1/0.2 tabhi tick honge. Ye Phase 3 (first MP4) tak
   chahiye hi chahiye; Phase 1-2 iske bina chal jaate hain.
2. **`npm audit`: 2 high, next@14.2.35 par.** Fix ke liye `next@16` chahiye (breaking, plan
   se bahar). Studio locked decision ke hisaab se sirf **localhost** pe chalta hai, public
   deploy nahi hai — isliye Next 14 hi rakha, `web/` bhi ^14.2.35 par hi hai. Agar kabhi
   studio ko host karna ho to pehle ye upgrade karna padega.
3. **Node v20.20.1** mila (plan doc me v22.18 likha tha). Next 14 aur tsx dono ke liye
   theek hai; root `package.json` me `engines.node >=20.9.0` daal diya.
4. Phase 0 me sirf Next+React+Tailwind+tsx install kiye. Plan me listed baaki deps
   (zustand, immer, zod, remotion, supabase-js…) apne-apne phase me aayenge — bina zaroorat
   ke install nahi kiye.

## Done when

FFmpeg + ffprobe available, `npm run typecheck` bilkul clean, studio localhost pe khulta hai,
aur teen packages (`reel-core`, `reel-remotion`, `worker`) import-able bane hue hain.

→ Teen me se **teen** ho gaye. Sirf FFmpeg wala hissa baaki hai (user ka install).

## Progress log

| Date | What was done | Verified by | Next |
|---|---|---|---|
| 2026-08-19 | 0.3-0.14 poore: workspace root, tsconfig.base + aliases, reel-core / reel-remotion / worker skeletons, Next 14 studio, .gitignore, env examples, root scripts. Commit `fa88d0b`. | `npm run typecheck` chaaron workspaces clean; `npm run build:studio` pass; `curl localhost:3000` → HTTP 200 + `<h1>AI Reel Studio</h1>`; worker `tsx` se chalke exit hua; alias probe import compile hua | 0.1/0.2 — user `winget install Gyan.FFmpeg` chalaye, phir `ffmpeg -version` / `ffprobe -version` verify karke tick karo, tab STATUS: COMPLETE |
