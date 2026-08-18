# Phase 20 — Export quality validation + asset lifecycle cleanup

**STATUS:** not started
**One-line prompt:** `Read docs/reel-studio/README.md, then do Phase 20 of AI Reel Studio.`
**Rules:** README.md ke Standing + Dynamic + **A1 Quality** rules binding. Resume Protocol follow karo.
**Depends on:** Phase 11 complete (Phase 18 ke baad best)

**Goal:** quality ka darwaza. Jo blurry/tuti cheez hai wo export se pehle pakdi jaaye, aur
4K ka jhooth kabhi na bole. Plus temporary files ka safai system.

## Checklist

- [ ] 20.1 `VALIDATION_RULES` registry: har rule = `{ id, severity: 'error'|'warning'|'info',
      scope: 'project'|'item'|'asset'|'export', check(ctx) -> null | {message, fix?, data} }`.
      **If-else spaghetti mana hai** — nayi check = ek entry.
- [ ] 20.2 Teen public functions (spec ke exact naam):
      `validateAssetQuality(asset, ctx)`, `validateProjectQuality(doc, assets, ctx)`,
      `validateExportSettings(doc, preset, ctx)` — sab
      `{ valid, errors[], warnings[], recommendations[] }` return karein.
- [ ] 20.3 Rules (minimum): missing asset; unreadable/corrupt asset; unsupported codec;
      zero-duration item; empty timeline; item outside project duration; overlapping items on
      same track (agar policy allow na kare); missing font; text overflow beyond safe area;
      silent audio track; audio clipping; loudness far from target; no audio at all;
      fps mismatch (source 24 vs project 30 → judder warning); aspect mismatch/pillarbox;
      **excessive upscaling** (source pixels vs required pixels including zoom/scale keyframes);
      source resolution below preset (480p in 1080p, 1080p in 4K);
      very long duration; huge project (render time estimate); temporary asset near expiry
      used in project.
- [ ] 20.4 Upscale math sahi karo: item ka **maximum effective scale** poore duration me
      (keyframes + animation + zoom-pan sab milakar) nikaalo, phir required pixels calculate
      karo. Ye asli math ho, andaaza nahi.
- [ ] 20.5 4K rule ka exact message (spec se):
      `"Low-resolution asset detected. This asset may appear blurry in 4K."`
- [ ] 20.6 Export presets me quality tiers: **Standard / High / 4K / Strict Quality**.
      `Strict` me critical problems pe export **block** ho (button disabled + reason list),
      baaki tiers me warning + "Export anyway".
- [ ] 20.7 Validation **do jagah** chale: UI me export se pehle (turant), aur worker me render
      se pehle (job ka doc frozen hai, isliye dobara check). Dono **same** functions —
      duplicate logic nahi.
- [ ] 20.8 Validation panel UI: errors/warnings/recommendations grouped, har issue pe
      "Show me" (us item pe jump + select) aur jahan possible "Auto-fix" (e.g. scale ghatao,
      duration clamp karo, missing font replace karo) — auto-fix ek undo-able op ho.
- [ ] 20.9 4K ke bare me imaandaari: 4K choose karne pe estimated render time aur file size
      dikhao (asli measurement se), aur agar saare assets 1080p hain to saaf bolo ki
      "4K se quality nahi badhegi, sirf time lagega".
- [ ] 20.10 **Asset lifecycle cleanup** (spec §27): `worker/scripts/cleanup.ts` —
      `temporary` assets jinke `expires_at` beet gaya aur jo kisi project doc me referenced
      nahi hain, unhe R2 + DB se delete karo. Dry-run default, `--apply` se asli delete.
      Referenced temp asset ko **kabhi** delete na karo (pehle project me use check karo).
- [ ] 20.11 Orphan scan: R2 me pade files jinka DB row nahi, aur DB rows jinki file nahi —
      dono report karo (delete sirf mere confirm pe).
- [ ] 20.12 Render temp cleanup: har job ke baad apna temp folder saaf, aur failure pe bhi.
- [ ] 20.13 Storage usage dashboard: kitna permanent, kitna temporary, top 10 bade assets,
      R2 free tier (10GB) ke against warning.
- [ ] 20.14 Test: jaan-boojh kar ek 480p image daalo + ek missing asset + ek clipping audio +
      ek missing font wala text. `4K` pe export try karo → warnings dikhein.
      `Strict` pe try karo → **block** ho. Poora validator output paste karo.
      Phir issues fix karke export successful karo.
- [ ] 20.15 Cleanup test: ek temp asset banao, expire karo, dry-run output dikhao, phir
      `--apply` chalao aur R2 se gaya ye confirm karo.
- [ ] 20.16 `npm run typecheck` clean + check script me validation rule assertions.
- [ ] 20.17 Commit: "reel-studio: phase 20 — quality validation + lifecycle".

## Verify (asli output paste karna)

```
npx tsx packages/reel-core/scripts/check.ts
npm run dev:studio        # 4K + Strict flow
npx tsx worker/scripts/cleanup.ts            # dry run
npx tsx worker/scripts/cleanup.ts --apply
```

## Done when

Validator asli problems pakadta hai (upscale math sahi), Strict block karta hai, 4K ka jhooth
nahi bolta, aur temp files safe tarike se saaf hote hain.

## Progress log

| Date | What was done | Verified by | Next |
|---|---|---|---|
| | | | |
