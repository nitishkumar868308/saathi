# Phase 2 — Database + storage drivers

**STATUS:** not started
**One-line prompt:** `Read docs/reel-studio/README.md, then do Phase 2 of AI Reel Studio.`
**Rules:** README.md ke Standing + Dynamic rules binding. Resume Protocol follow karo.
**Depends on:** Phase 1 complete

**Goal:** doc kahan save hoga aur media kahan rahega — dono taiyaar. Queue bhi Postgres me
(Redis nahi). Storage do driver ke peeche: local disk (fast dev) aur R2 (asli).

## Checklist

- [ ] 2.1 `supabase/reel-studio.sql` banao, existing `supabase/*.sql` files ke style me
      (Hinglish comments, `create table if not exists`, idempotent).
      Tables: `reel_projects`, `reel_project_versions`, `reel_assets`, `reel_render_jobs`,
      `reel_templates`, `reel_brand_presets`, `reel_characters`, `reel_voices`.
      (Prefix `reel_` isliye ki existing app ke tables se na takraye.)
- [ ] 2.2 `reel_projects`: id uuid pk, owner uuid null, name text, `doc jsonb not null`,
      `doc_version int not null default 1`, created_at, updated_at + `updated_at` trigger.
- [ ] 2.3 `reel_assets`: kind text (registry ke kinds), r2_key, filename, mime, bytes,
      width, height, duration_ms, fps, sample_rate, channels,
      `lifecycle text check (lifecycle in ('permanent','temporary'))`, expires_at, checksum.
      Index on (owner, kind), aur (lifecycle, expires_at).
- [ ] 2.4 `reel_render_jobs`: project_id fk, `doc jsonb` (frozen snapshot), preset text,
      status text check queued/processing/completed/failed/cancelled, progress int 0-100,
      error text, output_r2_key, output_bytes, duration_ms, worker_id, claimed_at,
      started_at, finished_at, created_at. Index on (status, created_at).
- [ ] 2.5 SQL function `reel_claim_render_job(p_worker text)` jo
      `for update skip locked` se ek queued job claim karke row return kare.
      **Yahi BullMQ ki jagah hai.**
- [ ] 2.6 Stale job recovery: `reel_requeue_stale_jobs(p_minutes int)` — processing me atke
      jobs ko wapas queued karo (worker crash ho jaaye to).
- [ ] 2.7 RLS: tables pe RLS enable, writes sirf service_role se (studio server-side hi likhega).
      Single-user hai, complex policies nahi.
- [ ] 2.8 SQL apply karne ka exact tarika mujhe batao (dashboard SQL editor ya `supabase db`
      command) — **khud apply mat karo jab tak mai confirm na karu**.
- [ ] 2.9 `packages/reel-core/src/storage/types.ts`: `StorageDriver` interface —
      `putSigned(key, mime)`, `getSignedUrl(key, ttl)`, `put(key, buffer)`, `get(key)`,
      `delete(key)`, `exists(key)`.
- [ ] 2.10 `local` driver: files `REEL_OUTPUT_DIR`/`media` me; signed URL ki jagah
      studio ka `/api/local-media/[...key]` route (dev only).
- [ ] 2.11 `r2` driver: signer `web/lib/r2.ts` se **copy** karo (original edit nahi),
      `worker/src/storage/r2.ts` + studio ke liye shared jagah pe rakho.
- [ ] 2.12 Driver selection env se: `REEL_STORAGE_DRIVER`. Galat value pe saaf error.
- [ ] 2.13 Key layout tay karo aur doc me likho:
      `permanent/assets/<assetId>.<ext>`, `permanent/reels/<jobId>.mp4`,
      `temp/tts/<id>.wav`, `temp/render/<jobId>/...`.
- [ ] 2.14 `worker/scripts/storage-smoke.ts`: dono driver pe put → signed URL → get → delete
      ka round trip chalao aur output paste karo (R2 sirf tab jab keys env me hain).
- [ ] 2.15 `npm run typecheck` clean. Commit: "reel-studio: phase 2 — db + storage".

## Verify (asli output paste karna)

```
npx tsx worker/scripts/storage-smoke.ts --driver=local
npx tsx worker/scripts/storage-smoke.ts --driver=r2     # agar R2 keys set hain
```
Plus Supabase me tables list karke dikhao (ya SQL apply karne ke baad `select` ka output).

## Done when

SQL file taiyaar (aur mere confirm ke baad applied), claim function `skip locked` ke saath
kaam karta hai, aur dono storage driver ka round-trip smoke test pass hai.

## Progress log

| Date | What was done | Verified by | Next |
|---|---|---|---|
| | | | |
