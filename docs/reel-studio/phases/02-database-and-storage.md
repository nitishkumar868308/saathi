# Phase 2 — Database + storage drivers

**STATUS:** in progress — **saara code done aur verified. Sirf SQL apply baaki hai
(2.8 ka rule: tumhare confirm ke bina apply nahi karna).**
**One-line prompt:** `Read docs/reel-studio/README.md, then do Phase 2 of AI Reel Studio.`
**Rules:** README.md ke Standing + Dynamic rules binding. Resume Protocol follow karo.
**Depends on:** Phase 1 complete ✅

**Goal:** doc kahan save hoga aur media kahan rahega — dono taiyaar. Queue bhi Postgres me
(Redis nahi). Storage do driver ke peeche: local disk (fast dev) aur R2 (asli).

## Checklist

- [x] 2.1 `supabase/reel-studio.sql` — existing `supabase/*.sql` ke style me (Hinglish
      comments, `create table if not exists`, dobara run karna safe). Aathon tables
      `reel_` prefix ke saath.
- [x] 2.2 `reel_projects`: id uuid pk, owner uuid null, name, `doc jsonb not null`,
      `doc_version int not null default 1`, created_at/updated_at + trigger.
      → `doc_version` par bada comment likha hai: ye `doc.version` (schema version) **nahi**
      hai, ye optimistic lock hai. Do tab khule hone par baad wala tab pehle wale ka kaam
      chupchaap na mita de.
- [x] 2.3 `reel_assets`: kind, r2_key (unique), filename, mime, bytes, width, height,
      duration_ms, fps, sample_rate, channels, lifecycle check, expires_at, checksum.
      Index `(owner, kind, created_at desc)` aur partial index `(lifecycle, expires_at)`
      sirf `temporary` par + checksum index.
- [x] 2.4 `reel_render_jobs`: project_id fk, frozen `doc jsonb`, preset check, status check,
      progress 0-100, error, output_*, worker_id, claimed/started/finished, created_at.
      Index `(status, created_at)`.
      → Plus `attempts` / `max_attempts` — ye plan me nahi tha par inke bina ek "zeher wali"
      job hamesha requeue hoti rehti aur queue kabhi khaali nahi hoti.
- [x] 2.5 `reel_claim_render_job(p_worker text)` — `for update skip locked`. **BullMQ ki jagah.**
- [x] 2.6 `reel_requeue_stale_jobs(p_minutes int default 15)` — atki hui jobs wapas queue me,
      koshishein poori hone par `failed`.
- [x] 2.7 RLS: aathon tables par on, **zero policies** = sirf service_role. Queue ke dono
      functions `security definer` hain isliye unse anon/authenticated ka execute revoke kiya.
- [x] 2.8 Apply karne ka tarika neeche likha hai. **SQL abhi APPLY NAHI kiya** — tumhare
      confirm ka intezaar hai.
- [x] 2.9 `packages/reel-core/src/storage/types.ts` — `StorageDriver` interface
      (`putSigned`, `getSignedUrl`, `put`, `get`, `delete`, `exists`). Pure TS, koi Node import nahi.
- [x] 2.10 `local` driver: files `<REEL_OUTPUT_DIR>/media` me; signed URL ki jagah studio ka
      `/api/local-media/[...key]` route (GET + PUT + HEAD, dev-only).
- [x] 2.11 `r2` driver: SigV4 signer `web/lib/r2.ts` se **copy** (original chhua bhi nahi).
      Shared jagah = naya `packages/reel-storage` package, jise studio aur worker dono
      import karte hain.
- [x] 2.12 Driver selection `REEL_STORAGE_DRIVER` se. Galat value par saaf error
      (chupchaap local par girna sabse khatarnak hota — lagta R2 par ja raha hai, jaata disk par).
- [x] 2.13 Key layout tay + `keys.ts` ke top par documented (neeche bhi).
- [x] 2.14 `worker/scripts/storage-smoke.ts` — dono driver par poora round trip.
- [x] 2.15 `npm run typecheck` clean + commit `2a05f13`.

## Verify (asli output)

### Storage smoke — local driver

```
$ npm run dev:studio          # dusre terminal me
$ npx tsx worker/scripts/storage-smoke.ts --driver=local

key validation (ye security ki deewar hai)
  ok   reject: ../../etc/passwd
  ok   reject: temp/../../secret.txt
  ok   reject: /absolute/path
  ok   reject: temp\windows\path
  ok   reject: temp//double
  ok   reject: temp/probe/file with space.bin

driver = local
root   = D:\my-app\render-out\media
key    = temp/probe/smoke-3952c860-....bin

  ok   shuruat me file maujood nahi
  ok   put ke baad file mil rahi hai
  ok   size bilkul sahi hai — 262144 bytes (chahiye 262144)
  ok   get ne bytes wapas diye
  ok   bytes byte-by-byte same hain
  ok   signed URL bana — http://localhost:3000/api/local-media/temp/probe/smoke-....bin
  ok   signed URL se HTTP par wahi bytes utre — 262144 bytes
  ok   putSigned ne PUT target diya
  ok   putSigned content-type bandh raha hai
  ok   putSigned URL par sach me upload hua — HTTP 201
  ok   upload ke baad wahi bytes wapas mile
  ok   delete ne true diya
  ok   delete ke baad file sach me gayab hai
  ok   dobara delete karna bhi theek hai (idempotent)

ALL PASS: 20 checks, 0 fail  (driver: local)
```

### Storage smoke — R2 driver (asli bucket)

```
$ npx tsx worker/scripts/storage-smoke.ts --driver=r2 --env-file=web/.env.local

driver = r2
bucket = apkasaathi-storage @ 8c9f6b…
key    = temp/probe/smoke-066025c6-....bin

  ok   shuruat me file maujood nahi
  ok   put ke baad file mil rahi hai
  ok   size bilkul sahi hai — 262144 bytes (chahiye 262144)
  ok   get ne bytes wapas diye
  ok   bytes byte-by-byte same hain
  ok   signed URL bana — https://<account>.r2.cloudflarestorage.com/apkasaathi-storage/temp/probe/smoke-....bin?…(signature chhupaya)
  ok   signed URL se HTTP par wahi bytes utre — 262144 bytes
  ok   putSigned ne PUT target diya
  ok   putSigned content-type bandh raha hai
  ok   putSigned URL par sach me upload hua — HTTP 200
  ok   upload ke baad wahi bytes wapas mile
  ok   delete ne true diya
  ok   delete ke baad file sach me gayab hai
  ok   dobara delete karna bhi theek hai (idempotent)

ALL PASS: 20 checks, 0 fail  (driver: r2)
```

Ye asli bucket par chala — 256KB `temp/probe/smoke-<uuid>.bin` par chadha, wapas utra,
aur delete ho gaya. Bucket me kuch peeche nahi chhoda. `documents/` ya `avatars/` ko
haath nahi lagaya (naya prefix `temp/probe/` use hua).

### Route ke guards (sach me test kiye)

```
# production build me — file disk par MAUJOOD hai phir bhi:
$ npm run build:studio && npm run start --workspace @reel/studio
$ curl http://localhost:3000/api/local-media/temp/probe/guard-test.bin
{"error":"not found","reason":"local-media route sirf dev me chalta hai"}
HTTP 404

# path traversal ke attempts (dev server par):
temp/%2e%2e/%2e%2e/package.json    -> 404
temp/../../package.json            -> 404
..%2f..%2fpackage.json             -> 400
temp/probe/file%20space.bin        -> 400
```

Ek bhi attempt me `package.json` ka content nahi mila.

### Typecheck + Phase 1 ke tests abhi bhi pass

```
$ npm run typecheck        EXIT=0   (paanchon workspaces)
$ npm run check            ALL PASS: 70 assertions groups, 0 fail
```

## 2.8 — SQL apply karne ka tarika (ye tum karo)

Repo ki apni convention yahi hai (saari 65 `supabase/*.sql` files me ye line likhi hai:
"Supabase SQL Editor me Run karo"), aur is machine par `supabase` CLI / `psql` install
bhi nahi hai. To:

1. https://supabase.com/dashboard → apna project → **SQL Editor** → **New query**
2. `supabase/reel-studio.sql` ka poora content paste karo → **Run**
3. Dobara run karna safe hai (sab `if not exists` / `create or replace` hai).

Apply ke baad ye chala kar output mujhe bhej dena — tabhi 2.8 sach me tick hoga:

```sql
-- 1. tables bane?
select table_name from information_schema.tables
 where table_schema = 'public' and table_name like 'reel_%' order by 1;
-- 8 rows aani chahiye

-- 2. functions bane?
select routine_name from information_schema.routines
 where routine_schema = 'public' and routine_name like 'reel_%' order by 1;
-- reel_claim_render_job, reel_requeue_stale_jobs, reel_touch_updated_at

-- 3. RLS on hai?
select relname, relrowsecurity from pg_class
 where relname like 'reel_%' and relkind = 'r' order by 1;
-- sab true

-- 4. claim function sach me chalta hai? (ye asli test hai — ek-ek karke chalao)
insert into public.reel_projects (name, doc) values ('sql-test', '{"version":1}'::jsonb);

insert into public.reel_render_jobs (project_id, doc)
  select id, '{"version":1}'::jsonb from public.reel_projects where name = 'sql-test';

select id, status, worker_id, attempts from public.reel_claim_render_job('test-worker');
-- 1 row: status='processing', worker_id='test-worker', attempts=1

select id, status from public.reel_claim_render_job('doosra-worker');
-- 0 rows — koi doosri queued job bachi hi nahi. Yahi skip-locked ka matlab hai:
-- doosra worker atakta nahi, seedha khaali haath lautta hai.

-- safai (render_jobs cascade se apne aap jaayengi)
delete from public.reel_projects where name = 'sql-test';
```

## Key layout (2.13)

```
permanent/assets/<assetId>.<ext>   user ka upload — uski marzi ke bina kabhi delete nahi
permanent/reels/<jobId>.mp4        final render
permanent/thumbs/<jobId>.jpg       render ka thumbnail
temp/tts/<id>.wav                  TTS ki awaaz (Phase 22)
temp/render/<jobId>/<name>         render ke beech ka maal
temp/probe/<id>.<ext>              ffprobe ke liye utara hua tukda
```

`permanent/` banaam `temp/` ka bantwara hi Phase 20 ke cleanup ko likhne layak banata hai:
script sirf `temp/` chhoo sakti hai, isliye "kahin kisi ki asli file to nahi mit rahi"
wala dar hi khatam ho jaata hai.

Keys hamesha `storageKey.*()` se banti hain, haath se kabhi nahi — warna upload ek key par
jaata hai aur DB me doosri likhi jaati hai, aur file "kho jaati" hai jabki bucket me hi baithi hoti.

## Faisle jo is phase me liye gaye

1. **Naya package `@reel/storage`.** Checklist me tha "worker/src/storage/r2.ts + studio ke
   liye shared jagah". Drivers ko Node ka `crypto`/`fs` chahiye, par `@reel/core`
   jaan-boojhkar Node-free hai (browser me bhi chalta hai). Copy-paste karke do jagah
   rakhne se behtar ek shared package hai — `packages/*` workspace glob me pehle se aata hai.
2. **Koi nayi npm dependency nahi.** SigV4 khud ka hai, `fs`/`crypto` built-in, aur env file
   `process.loadEnvFile()` (Node 20.12+) se load hoti hai — `dotenv` ki zaroorat hi nahi padi.
3. **`attempts` / `max_attempts`** render jobs par (plan me nahi tha). Inke bina crash karane
   wali job hamesha requeue hoti rehti hai.
4. **Local driver ka "signed URL" sach me signed nahi hai.** Wo studio ka route hai, aur
   route sirf dev me + sirf local driver par chalta hai. Ye jhooth nahi bola gaya — interface
   ek hai par local wala nakli signature nahi banata.
5. **Signed URL kabhi log me poora nahi chhapta.** R2 ke presigned URL me `X-Amz-Credential`
   (access key id) aur signature dono hote hain; smoke test query hissa chhupa deta hai.

## Ek asli bug jo mila aur theek hua

`REEL_OUTPUT_DIR=./render-out` **har process ke apne cwd se** resolve ho raha tha:

```
worker (repo root se chalta hai)  ->  D:\my-app\render-out\media
studio (studio/ se chalta hai)    ->  D:\my-app\studio\render-out\media
```

Yaani worker file likhta tha aur studio usi file ko "disk par nahi mili" batata tha.
Smoke test me ye HTTP 404 ban kar saamne aaya. Ab relative path hamesha **repo root**
se resolve hota hai (`findRepoRoot` wo `package.json` dhoondhta hai jisme `workspaces` hai),
isliye dono kahin se bhi chalein, ek hi folder dekhte hain.

## Done when

SQL file taiyaar (aur mere confirm ke baad applied), claim function `skip locked` ke saath
kaam karta hai, aur dono storage driver ka round-trip smoke test pass hai.

→ Storage wala hissa **poora ho gaya** (local 20/20, r2 20/20). SQL file taiyaar hai par
**apply nahi hui**, isliye claim function abhi chalake dikhaya nahi ja sakta. Ye do
tumhare ek "haan" par khatam ho jaayenge.

## Progress log

| Date | What was done | Verified by | Next |
|---|---|---|---|
| 2026-08-19 | 2.1-2.7 SQL likhi (8 tables + claim/requeue functions + RLS). 2.9-2.15: StorageDriver interface + key layout `@reel/core` me, naya `@reel/storage` package (local + r2 driver, SigV4 `web/lib/r2.ts` se copy), studio ka `/api/local-media` route, aur smoke script. Commit `2a05f13`. | `storage-smoke --driver=local` 20/20; `--driver=r2` 20/20 asli bucket par (upload+download+delete, file hata di); prod build me route 404 jabki file disk par thi; 4 traversal attempts 400/404; `npm run typecheck` exit 0; `npm run check` 70/70 | **2.8 — tum SQL apply karo** (Dashboard → SQL Editor → `supabase/reel-studio.sql` → Run), phir upar wali 4 verify queries ka output do. Uske baad Phase 3 |
