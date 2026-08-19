-- AI Reel Studio — Phase 23 (auto captions) ke liye queue ki badhotri.
-- Supabase SQL Editor me Run karo. (Dobara run karna safe hai — sab idempotent hai.)
--
-- `supabase/reel-studio.sql` aur `supabase/reel-studio-render.sql` pehle chal
-- chuki honi chahiye.
--
--
-- ⚠️ FAISLA: **alag `reel_jobs` table NAHI**, usi `reel_render_jobs` me ek
-- `kind` column (checklist 23.10 ne poochha tha ki decide karke batao).
--
-- Wajah seedhi hai. Ek transcription job ko wahi sab chahiye jo render job ko
-- chahiye, aur bilkul waisa hi:
--
--   * queue me lagna aur `for update skip locked` se claim hona
--   * progress (0..100) jo UI padhti hai
--   * cancel — user beech me rok sake
--   * `attempts` / `max_attempts` — warna fail hone par anant loop
--   * atki hui job ka wapas queue me aana (`reel_requeue_stale_jobs`)
--   * worker ka heartbeat, jisse "worker offline" pata chalta hai
--
-- Doosri table banane ka matlab hota ye saara ka saara dobara likhna — do claim
-- function, do requeue function, do RLS, do jagah cancel ka hisaab. Aur wo do
-- jagah ek din alag ho jaati hain: kisi ek me `attempts` ka fix lag jaata hai
-- aur doosri me nahi.
--
-- Iski keemat bhi saaf hai aur wo yahin likhi hai: table ka naam ab jhootha lagta
-- hai (`reel_render_jobs` me transcription bhi baithti hai), aur `doc` ab har
-- job me nahi hota. Naam badalne se studio + worker + har purani migration
-- chhedni padti — us keemat ke aage naam ki asuvidha choti hai.


/* ------------------------------------------------------------------ */
/*  1. kind — job kis tarah ki hai                                     */
/* ------------------------------------------------------------------ */

alter table public.reel_render_jobs
  add column if not exists kind text not null default 'render';

alter table public.reel_render_jobs
  drop constraint if exists reel_render_jobs_kind_check;

alter table public.reel_render_jobs
  add constraint reel_render_jobs_kind_check
  check (kind in ('render', 'transcribe'));


/* ------------------------------------------------------------------ */
/*  2. input / result — kaam ka saamaan aur uska nateeja               */
/* ------------------------------------------------------------------ */
--
-- `input`  — transcribe ke liye: asset id, bhasha, model, script.
-- `result` — nikle hue shabd (per-word timing ke saath).
--
-- ⚠️ Worker `doc` ko **haath nahi lagata**. Nateeja `result` me rakh kar chhod
-- deta hai, aur cues doc me UI daalti hai — usi `setCues` op se jo haath se
-- editing bhi karti hai.
--
-- Kyun: job chalte waqt user editing kar raha hota hai. Worker seedha doc likhe
-- to user ka abhi kiya hua kaam chup-chaap mit jaata hai, aur undo bhi kaam nahi
-- karta (undo studio ke andar hai, DB me nahi). Is tarah transcription ka
-- nateeja bhi ek normal, undo-hone-layak edit ban jaata hai.

alter table public.reel_render_jobs
  add column if not exists input  jsonb not null default '{}'::jsonb,
  add column if not exists result jsonb not null default '{}'::jsonb;


/* ------------------------------------------------------------------ */
/*  3. doc ab har job me nahi hota                                     */
/* ------------------------------------------------------------------ */
--
-- Transcribe job ke paas doc ka koi kaam nahi — usse ek audio file chahiye.
-- Poora doc jama karna (100KB ka JSON) sirf jagah kha jaata.
--
-- ⚠️ Par render job ke liye doc **abhi bhi zaroori** hai (wahi "frozen doc" wala
-- rule), isliye not-null hatane ke saath hi ek shart lag rahi hai jo sirf render
-- par lagti hai. Bina iske ek din doc-rahit render job queue me chali jaayegi
-- aur worker par jaakar phategi.

alter table public.reel_render_jobs
  alter column doc drop not null;

alter table public.reel_render_jobs
  drop constraint if exists reel_render_jobs_doc_needed;

alter table public.reel_render_jobs
  add constraint reel_render_jobs_doc_needed
  check (kind <> 'render' or doc is not null);


/* ------------------------------------------------------------------ */
/*  4. claim — ab kind ke hisaab se                                    */
/* ------------------------------------------------------------------ */
--
-- ⚠️ Purana 1-argument wala function pehle giraana padta hai. Default argument
-- ke saath naya banane par dono ek jaise call par fit ho jaate hain aur Postgres
-- "function is not unique" bolkar ruk jaata hai — aur wo galti tab dikhti hai
-- jab worker chal chuka hota hai.

drop function if exists public.reel_claim_render_job(text);

create or replace function public.reel_claim_render_job(
  p_worker text,
  p_kinds  text[] default array['render', 'transcribe']
)
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
        and c.kind = any(p_kinds)
      order by c.created_at
      limit 1
      for update skip locked
   )
  returning j.*;
end;
$$;


/* ------------------------------------------------------------------ */
/*  5. index                                                           */
/* ------------------------------------------------------------------ */
--
-- Claim har do second me chalta hai aur hamesha `status + kind` par filter karta
-- hai. Ek job ki table me bhi ye sasta hai, aur baad me mehnga ho jaata hai jab
-- history sau-do sau rows ki ho chuki hoti hai.

create index if not exists reel_render_jobs_queue_idx
  on public.reel_render_jobs (status, kind, created_at);
