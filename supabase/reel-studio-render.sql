-- AI Reel Studio — Phase 11 (export pipeline) ke liye chhoti si badhotri.
-- Supabase SQL Editor me Run karo. (Dobara run karna safe hai — sab idempotent hai.)
--
-- `supabase/reel-studio.sql` pehle chal chuki honi chahiye.
--
-- ⚠️ TEEN CHEEZEIN, AUR TEENO KYUN:


/* ------------------------------------------------------------------ */
/*  1. preset ka check constraint — 'draft' bhi chalega                */
/* ------------------------------------------------------------------ */
--
-- Preset ki list ab `EXPORT_PRESETS` registry me hai (code me), aur Phase 11 me
-- usme `draft` juda. DB ka purana check sirf standard/high/uhd maanta tha,
-- isliye draft wali job insert par hi phat jaati.
--
-- ⚠️ Sawaal uthta hai ki check constraint rakhein hi kyun, jab sach registry me
-- hai? Kyunki ye ek **akhri deewar** hai: koi galat string seedha DB me chali
-- jaaye to render worker use uthakar `requireExportPreset` par marega — aur wo
-- galti tab dikhegi jab job queue me baith chuki hogi. Yahan rukna sasta hai.
-- Naya preset jodte waqt ye line badalni padti hai, aur wo yaad rehna chahiye.

alter table public.reel_render_jobs
  drop constraint if exists reel_render_jobs_preset_check;

alter table public.reel_render_jobs
  add constraint reel_render_jobs_preset_check
  check (preset in ('draft', 'standard', 'high', 'uhd'));


/* ------------------------------------------------------------------ */
/*  2. Naye column — thumbnail aur naapa hua quality data              */
/* ------------------------------------------------------------------ */
--
-- `output_thumb_key` — render ki poster image (UI me history me dikhti hai).
--
-- `meta jsonb` — render ke baad ka **asli naapa hua** data: ffprobe ke stream
-- numbers, loudness (LUFS/true-peak), aur kitna waqt laga.
--
-- Alag column banane ka mann hota hai (lufs numeric, codec text…), par wo
-- raasta hamesha ek jagah aakar rukta hai: agli baar ek aur cheez naapni ho
-- (LRA, HDR flags, encoder ki settings) to phir migration likhni padti. jsonb me
-- naya field jodna sirf code ka kaam hai — wahi "dynamic-first" rule.

alter table public.reel_render_jobs
  add column if not exists output_thumb_key text,
  add column if not exists meta jsonb not null default '{}'::jsonb;


/* ------------------------------------------------------------------ */
/*  3. Worker ka heartbeat                                             */
/* ------------------------------------------------------------------ */
--
-- ⚠️ Ye checklist 11.13 ke liye hai: "Worker band ho to UI me saaf 'Worker
-- offline' dikhe — **heartbeat se detect karo, jhooth nahi**."
--
-- Iske bina UI ke paas do hi raaste bachte, aur dono jhooth hain:
--   (a) hamesha "worker chal raha hai" dikhana — job queue me atki rehti hai
--       aur user samajh hi nahi paata ki kyun kuch nahi ho raha
--   (b) job ke queue me hone se andaaza lagana — par worker abhi-abhi shuru
--       hua ho to wo bhi galat hai
--
-- Worker har kuch second yahan apna waqt likh deta hai. UI sirf itna dekhta hai
-- ki aakhri dhadkan kitni purani hai.

create table if not exists public.reel_workers (
  id          text primary key,
  last_seen   timestamptz not null default now(),
  /* Abhi kaunsi job chala raha hai (null = khaali baitha hai). */
  current_job uuid references public.reel_render_jobs(id) on delete set null,
  version     text,
  created_at  timestamptz not null default now()
);

create index if not exists reel_workers_last_seen_idx
  on public.reel_workers (last_seen desc);

-- RLS: baaki reel_* tables ki tarah — sirf service_role.
alter table public.reel_workers enable row level security;


/* ------------------------------------------------------------------ */
/*  4. Sanity — chalane ke baad ye dekh lena                           */
/* ------------------------------------------------------------------ */
--
-- select conname, pg_get_constraintdef(oid)
--   from pg_constraint where conrelid = 'public.reel_render_jobs'::regclass
--   and conname = 'reel_render_jobs_preset_check';
-- Umeed: check (preset = any (array['draft','standard','high','uhd']))
--
-- select column_name from information_schema.columns
--   where table_name = 'reel_render_jobs'
--   and column_name in ('output_thumb_key', 'meta');
-- Umeed: dono dikhne chahiye.
--
-- select * from public.reel_workers;   -- abhi khaali, worker chalate hi bharega
