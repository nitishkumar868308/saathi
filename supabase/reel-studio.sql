-- AI Reel Studio — projects, assets, render queue.
-- Supabase SQL Editor me Run karo. (Dobara run karna safe hai — sab idempotent hai.)
--
-- Har table ka naam `reel_` se shuru hota hai. Ye jaan-boojhkar hai: is DB me
-- Apka Saathi ke ~60 tables pehle se hain (documents, reminders, profiles…) aur
-- `projects` / `assets` / `templates` jaise aam naam un se takra sakte the.
--
-- ⚠️ DO CHEEZEIN JO SPEC SE ALAG HAIN, AUR KYUN:
--
-- 1. **Koi Redis / BullMQ nahi.** Queue `reel_render_jobs` table hai aur claim
--    `for update skip locked` se hota hai (neeche `reel_claim_render_job`).
--    Managed Redis matlab har mahine paisa aur ek aur cheez jo band ho sakti hai.
--    Ek hi worker hai — Postgres ka queue uske liye kaafi se zyada hai.
--
-- 2. **tracks / timeline_items / scenes ki apni tables NAHI hain.** Poora
--    Project JSON ek hi `doc jsonb` column me rehta hai. Editor ek session me
--    items ko sau baar badalta hai; normalized rows me autosave aur undo dono
--    dard ban jaate. 30-second reel ka JSON 100KB se kam hota hai.
--
-- RLS: saari tables par on hai aur **ek bhi policy nahi** — matlab sirf
-- service_role (jo RLS bypass karta hai) inhe chhoo sakta hai. Studio server-side
-- hi likhta hai, aur worker bhi service key se aata hai. Single user hai, isliye
-- per-row policies abhi bekaar ki complexity hoti.


/* ------------------------------------------------------------------ */
/*  0. Shared helper — updated_at                                      */
/* ------------------------------------------------------------------ */

-- Apna helper isliye ki ye file akeli chal sake. `public.touch_updated_at()`
-- repo me pehle se hai (seo-blog.sql), par uspar nirbhar hone ka matlab hota ki
-- ye file us file ke baad hi chale — aur ek din wo order kisi se toot jaata.
create or replace function public.reel_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;


/* ------------------------------------------------------------------ */
/*  1. Projects — Project JSON ka ghar                                 */
/* ------------------------------------------------------------------ */

create table if not exists public.reel_projects (
  id          uuid primary key default gen_random_uuid(),

  -- Abhi single user hai, isliye null chalta hai. Column aaj rakh diya taaki
  -- kabhi doosra banda aaye to table ko haath na lagana pade.
  owner       uuid references auth.users(id) on delete set null,

  name        text not null,

  -- Poora Project JSON. Yahi ekmatra sach hai — AI, templates aur haath ki
  -- editing sab isi ko likhte hain, renderer sirf ise padhta hai.
  doc         jsonb not null,

  /*
   * ⚠️ Ye `doc.version` (schema version) NAHI hai. Ye optimistic-lock counter
   * hai: har save par +1 hota hai. Studio save karte waqt "mere paas 7 tha"
   * bhejta hai; agar DB me 8 ho chuka hai to save reject ho jaata hai.
   *
   * Iske bina do tab khule hone par baad wala tab pehle wale ka poora kaam
   * chupchaap mita deta — aur kisi ko pata bhi nahi chalta.
   */
  doc_version int not null default 1,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists reel_projects_touch on public.reel_projects;
create trigger reel_projects_touch before update on public.reel_projects
  for each row execute function public.reel_touch_updated_at();

create index if not exists reel_projects_owner_idx
  on public.reel_projects (owner, updated_at desc);


/* ------------------------------------------------------------------ */
/*  2. Project versions — history / snapshots                          */
/* ------------------------------------------------------------------ */

-- Undo/redo browser me chalti hai (patches se). Ye uski jagah nahi hai — ye
-- "kal shaam wali reel wapas chahiye" wali cheez hai. Autosave beech-beech me
-- yahan ek snapshot chhod deta hai, aur export ke waqt bhi ek banta hai.
create table if not exists public.reel_project_versions (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.reel_projects(id) on delete cascade,
  doc        jsonb not null,

  -- "autosave", "export se pehle", "AI ne scenes likhe" — insaan ke padhne layak.
  label      text,

  created_at timestamptz not null default now()
);

create index if not exists reel_project_versions_project_idx
  on public.reel_project_versions (project_id, created_at desc);


/* ------------------------------------------------------------------ */
/*  3. Assets — media ki metadata (asli file R2/disk par)              */
/* ------------------------------------------------------------------ */

create table if not exists public.reel_assets (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid references auth.users(id) on delete set null,

  -- ITEM_TYPES registry ke kinds jaisa: image / video / audio / font / other.
  -- Yahan check constraint jaan-boojhkar nahi lagaya — kinds registry me hain,
  -- aur naya kind add karte waqt migration likhna padta to registry ka poora
  -- matlab hi khatam ho jaata.
  kind        text not null,

  -- Storage me poori key: permanent/assets/<id>.<ext>
  -- Naam `r2_key` hai par local driver bhi yahi key use karta hai — driver
  -- badalne par DB ko kuch pata nahi chalta.
  r2_key      text not null unique,

  filename    text not null,
  mime        text not null,
  bytes       bigint not null default 0,

  -- Probe se aayi metadata. Null tab tak jab tak ffprobe nahi chala.
  -- Ye Section 3A ke upscale check ke liye zaroori hai — width/height jaane
  -- bina "ye 4K hai" wala jhooth pakda hi nahi ja sakta.
  width       int,
  height      int,
  duration_ms int,
  fps         numeric(7,3),
  sample_rate int,
  channels    int,

  /*
   * permanent — user ka upload, uski marzi ke bina kabhi delete nahi hota
   * temporary — hum ne banaya (TTS wav, render ka beech ka maal). `expires_at`
   *             ke baad cleanup ise utha sakta hai.
   *
   * Do lifecycle rakhne ki wajah: bina iske cleanup script likhna hamesha
   * darawna rehta hai — kya pata kaunsi file kisi ki asli file ho.
   */
  lifecycle   text not null default 'permanent'
              check (lifecycle in ('permanent', 'temporary')),
  expires_at  timestamptz,

  -- sha256. Ek hi file dobara upload hone par pehchan ne ke liye.
  checksum    text,

  created_at  timestamptz not null default now()
);

create index if not exists reel_assets_owner_kind_idx
  on public.reel_assets (owner, kind, created_at desc);

-- Cleanup job ka index — "kaun si temporary file ki umar poori ho gayi".
create index if not exists reel_assets_lifecycle_idx
  on public.reel_assets (lifecycle, expires_at)
  where lifecycle = 'temporary';

create index if not exists reel_assets_checksum_idx
  on public.reel_assets (checksum)
  where checksum is not null;


/* ------------------------------------------------------------------ */
/*  4. Render jobs — ye poora queue hai (Redis ki jagah)               */
/* ------------------------------------------------------------------ */

create table if not exists public.reel_render_jobs (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.reel_projects(id) on delete cascade,

  /*
   * ⚠️ Export ke waqt ka **jama hua (frozen)** doc.
   *
   * Job ke chalte hue editing karna bilkul normal hai. Agar worker
   * reel_projects se doc padhta to aadhe render ke beech doc badal jaata aur
   * output me aadha purana aadha naya aa jaata — aur wajah kabhi samajh nahi
   * aati. Isliye doc ki copy yahan jama kar li jaati hai.
   */
  doc           jsonb not null,

  preset        text not null default 'standard'
                check (preset in ('standard', 'high', 'uhd')),

  status        text not null default 'queued'
                check (status in ('queued', 'processing', 'completed', 'failed', 'cancelled')),

  progress      int not null default 0 check (progress between 0 and 100),
  error         text,

  output_r2_key text,
  output_bytes  bigint,
  duration_ms   int,

  -- Kis machine ne uthaya. Ek se zyada worker chalane par debug ka ekmatra sahara.
  worker_id     text,

  /*
   * attempts/max_attempts se "zeher wali job" ka loop rukta hai: jo job worker
   * ko har baar mara deti hai, wo bina inke hamesha ke liye requeue hoti rehti
   * aur queue kabhi khaali nahi hoti.
   */
  attempts      int not null default 0,
  max_attempts  int not null default 3,

  claimed_at    timestamptz,
  started_at    timestamptz,
  finished_at   timestamptz,
  created_at    timestamptz not null default now()
);

-- Claim query ka index: `where status='queued' order by created_at`.
create index if not exists reel_render_jobs_queue_idx
  on public.reel_render_jobs (status, created_at);

create index if not exists reel_render_jobs_project_idx
  on public.reel_render_jobs (project_id, created_at desc);

-- Stale-recovery query ka index.
create index if not exists reel_render_jobs_claimed_idx
  on public.reel_render_jobs (claimed_at)
  where status = 'processing';


/* ------------------------------------------------------------------ */
/*  5. Job claim — YAHI BullMQ KI JAGAH HAI                            */
/* ------------------------------------------------------------------ */

/*
 * Ek queued job uthao aur usi saans me 'processing' kar do.
 *
 * `for update skip locked` ka poora khel yahi hai: do worker ek saath aayein to
 * doosra pehle wale ki pakdi hui row ko **chhod kar aage badh jaata hai**, uske
 * chhootne ka intezaar nahi karta. Isliye ek job do baar kabhi render nahi hoti,
 * aur na hi workers ek doosre ka rasta rokte hain.
 *
 * Bina `skip locked` ke doosra worker pehle wale par atak jaata — aur ek job ke
 * 4 minute ke render me poora queue ruka rehta.
 */
create or replace function public.reel_claim_render_job(p_worker text)
returns setof public.reel_render_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.reel_render_jobs j
     set status     = 'processing',
         worker_id  = p_worker,
         claimed_at = now(),
         started_at = coalesce(j.started_at, now()),
         attempts   = j.attempts + 1,
         progress   = 0,
         error      = null
   where j.id = (
     select c.id
       from public.reel_render_jobs c
      where c.status = 'queued'
      order by c.created_at
      limit 1
      for update skip locked
   )
  returning j.*;
end;
$$;


/* ------------------------------------------------------------------ */
/*  6. Stale job recovery — worker mar gaya to?                        */
/* ------------------------------------------------------------------ */

/*
 * Worker ka laptop band ho gaya / process crash kar gaya — job hamesha ke liye
 * 'processing' me atki reh jaati hai aur koi doosra use uthata bhi nahi.
 *
 * Ye function un atki hui jobs ko wapas queue me daal deta hai. Jinki koshishein
 * poori ho chuki hain unhe 'failed' kar deta hai — chupchaap hamesha retry karne
 * se ek kharab job poore queue ko rok deti hai.
 *
 * Worker ise apne poll loop me kabhi-kabhaar chalata hai. Koi cron zaroori nahi.
 */
create or replace function public.reel_requeue_stale_jobs(p_minutes int default 15)
returns setof public.reel_render_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with stale as (
    select j.id, j.attempts, j.max_attempts
      from public.reel_render_jobs j
     where j.status = 'processing'
       and j.claimed_at < now() - (p_minutes * interval '1 minute')
     for update skip locked
  )
  update public.reel_render_jobs j
     set status = case when s.attempts >= s.max_attempts then 'failed' else 'queued' end,
         worker_id   = null,
         claimed_at  = null,
         progress    = 0,
         finished_at = case when s.attempts >= s.max_attempts then now() else null end,
         error = case
                   when s.attempts >= s.max_attempts
                     then format('Worker %s minute se chup raha; %s koshishon ke baad chhod diya',
                                 p_minutes, s.attempts)
                   else format('Worker %s minute se chup raha — wapas queue me (koshish %s/%s)',
                                 p_minutes, s.attempts, s.max_attempts)
                 end
    from stale s
   where j.id = s.id
  returning j.*;
end;
$$;


/* ------------------------------------------------------------------ */
/*  7. Templates / brand / characters / voices                         */
/* ------------------------------------------------------------------ */

-- Template = **data**, code nahi. Isi wajah se naya template banane ke liye
-- kuch deploy nahi karna padta — ek row daalo, bas.
/*
 * ⚠️ Ye do table (`reel_templates`, `reel_brand_presets`) Phase 17 me **dobara
 * banti hain**, aur wahan ka dhaancha alag hai (`id text`, `owner_id`,
 * `is_builtin`, RLS ke saath). Asli maalik wahi file hai:
 * `supabase/reel-studio-templates.sql`.
 *
 * Yahan wale roop sirf Phase 2 ke liye the aur ab bhi isliye pade hain ki
 * `db-verify` ki list me hain. Wo file khud dekh leti hai ki table purane
 * dhaanche ki to nahi, aur khaali ho to naye sire se bana deti hai.
 *
 * Ye note isliye likha hai ki ek baar `create table if not exists` ne yahan
 * chup-chaap sab kuch rok diya tha: Phase 17 ki file chalti thi, kuch banata
 * nahi thi, aur do line baad `column "owner_id" does not exist` par phat'ti thi
 * — jisse lagta tha ki galti index me hai.
 */
create table if not exists public.reel_templates (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  thumbnail_r2_key   text,
  doc                jsonb not null,
  tags               text[] not null default '{}',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

drop trigger if exists reel_templates_touch on public.reel_templates;
create trigger reel_templates_touch before update on public.reel_templates
  for each row execute function public.reel_touch_updated_at();

-- Brand tokens. Item me `"#C25A37"` nahi likha jaata, `"brand.primary"` likha
-- jaata hai — render ke waqt yahan se resolve hota hai. Isliye brand badalte hi
-- poori reel badal jaati hai, ek-ek item chhue bina.
create table if not exists public.reel_brand_presets (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  colors        jsonb not null default '{}'::jsonb,
  fonts         jsonb not null default '{}'::jsonb,
  logo_asset_id uuid references public.reel_assets(id) on delete set null,
  watermark     jsonb,
  cta           jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

drop trigger if exists reel_brand_presets_touch on public.reel_brand_presets;
create trigger reel_brand_presets_touch before update on public.reel_brand_presets
  for each row execute function public.reel_touch_updated_at();

-- Voices pehle banti hai kyunki characters usko point karte hain.
create table if not exists public.reel_voices (
  id              uuid primary key default gen_random_uuid(),
  provider        text not null check (provider in ('edge', 'piper', 'upload')),

  -- edge-tts ke liye `hi-IN-MadhurNeural` jaisa naam; upload ke liye asset ka id.
  voice_key       text not null,

  language        text,
  gender          text,
  sample_asset_id uuid references public.reel_assets(id) on delete set null,
  created_at      timestamptz not null default now(),

  unique (provider, voice_key)
);

create table if not exists public.reel_characters (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  image_asset_id uuid references public.reel_assets(id) on delete set null,
  voice_id       uuid references public.reel_voices(id) on delete set null,
  notes          text,
  created_at     timestamptz not null default now()
);


/* ------------------------------------------------------------------ */
/*  8. RLS — sab band, sirf service_role                               */
/* ------------------------------------------------------------------ */

/*
 * RLS on hai aur ek bhi policy nahi — matlab anon/authenticated ke liye ye
 * tables sach me maujood hi nahi hain. service_role RLS bypass karta hai,
 * isliye studio ke server-side routes aur worker dono theek chalte hain.
 *
 * ⚠️ Isi wajah se studio me `SUPABASE_SERVICE_ROLE` kabhi `NEXT_PUBLIC_` ke
 * saath nahi likhi ja sakti — wo browser me chali jaayegi aur ye poori deewar
 * bekaar ho jaayegi.
 */
alter table public.reel_projects         enable row level security;
alter table public.reel_project_versions enable row level security;
alter table public.reel_assets           enable row level security;
alter table public.reel_render_jobs      enable row level security;
alter table public.reel_templates        enable row level security;
alter table public.reel_brand_presets    enable row level security;
alter table public.reel_characters       enable row level security;
alter table public.reel_voices           enable row level security;

-- Queue ke functions bhi sirf service_role ke liye. `security definer` hone ki
-- wajah se ye RLS ke upar chalte hain, isliye inhe khula chhodna galti hoti.
revoke all on function public.reel_claim_render_job(text)   from public, anon, authenticated;
revoke all on function public.reel_requeue_stale_jobs(int)  from public, anon, authenticated;
grant execute on function public.reel_claim_render_job(text)  to service_role;
grant execute on function public.reel_requeue_stale_jobs(int) to service_role;


/* ------------------------------------------------------------------ */
/*  9. Sanity — apply karne ke baad ye chala kar dekh lena             */
/* ------------------------------------------------------------------ */

-- select table_name from information_schema.tables
--  where table_schema = 'public' and table_name like 'reel_%' order by 1;
--
-- select routine_name from information_schema.routines
--  where routine_schema = 'public' and routine_name like 'reel_%' order by 1;
