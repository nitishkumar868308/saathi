-- Apka Saathi — Admin message tracking (kisko gaya, kisne khola, kaun kahan gaya)
-- Supabase SQL Editor me Run karo. (Dobara run safe hai.)
-- NOTE: pehle profiles.sql, device-tokens.sql chala lena.
--
-- Ab tak admin panel se email/notification bhejne ke BAAD kuch pata hi nahi
-- chalta tha. Response me sirf ek ginti aati thi ("42 bheja"), aur wo bhi kahin
-- save nahi hoti thi. Do sabse zaroori sawaal bina jawab ke reh jaate the:
--
--   1. "Isko pichhle mahine kitni baar message gaya?"  — kahin likha hi nahi tha.
--   2. "Kisne khola, kisne click kiya, kaun ignore kar gaya?" — koi nishaan nahi.
--
-- Teen table isi ke liye:
--
--   message_batches — ek "bhejna" (ek subject, ek audience, ek waqt).
--   message_sends   — us batch me har user ka apna record, har channel ka alag
--                     (email aur push do alag rows). Open/click ki ginti isi row
--                     par rollup hoti hai — admin list isi se banti hai, taaki
--                     har screen par lakhon events na ginne pade.
--   message_events  — har ek open/click ka apna nishaan (kab, kahan gaya).
--                     Ek user 5 baar khole to yahan 5 rows, sends par count 5.
--
-- Privacy: yahan koi IP address nahi rakha jaata. User-agent sirf 200 char tak,
-- sirf isliye ki "phone se khola ya laptop se" pata chal sake.

/* ------------------------------------------------------------------ */
/* 1. Batches                                                          */
/* ------------------------------------------------------------------ */

create table if not exists public.message_batches (
  id         uuid primary key default gen_random_uuid(),
  subject    text not null,
  body       text not null,
  -- 'email' | 'push' | 'both' — admin ne kya chuna tha.
  channel    text not null,
  -- 'all' | 'inactive' | 'picked'
  audience   text not null,
  -- Kitne users target the (bhejne se pehle ki ginti).
  total      int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists mb_time_idx on public.message_batches(created_at desc);

/* ------------------------------------------------------------------ */
/* 2. Sends — ek batch me ek user, ek channel                          */
/* ------------------------------------------------------------------ */

create table if not exists public.message_sends (
  id        uuid primary key default gen_random_uuid(),
  batch_id  uuid not null references public.message_batches(id) on delete cascade,
  -- User delete ho jaye to record rehne dena hai (ginti sahi rahe), isliye
  -- set null. Email column alag se isliye rakha hai ki delete ke baad bhi pata
  -- chale ki us waqt kahan bheja gaya tha.
  user_id   uuid references auth.users(id) on delete set null,
  email     text,
  -- 'email' | 'push'  (channel = 'both' par ek hi user ki DO rows banti hain)
  channel   text not null,
  -- 'sent' | 'skipped' | 'failed'
  status    text not null default 'sent',
  error     text,
  -- Push me: is user ke kitne phone par gaya. Email me hamesha 0.
  devices   int not null default 0,

  /* --- rollup: admin list ki har row isi se banti hai --- */
  opened_at   timestamptz,
  clicked_at  timestamptz,
  open_count  int not null default 0,
  click_count int not null default 0,
  -- Aakhri click ke baad user kahan pahuncha: 'app' | 'web'.
  last_target text,

  created_at timestamptz not null default now()
);

create index if not exists ms_batch_idx on public.message_sends(batch_id);
create index if not exists ms_user_idx  on public.message_sends(user_id, created_at desc);
create index if not exists ms_time_idx  on public.message_sends(created_at desc);

/* ------------------------------------------------------------------ */
/* 3. Events — har open/click ka apna nishaan                          */
/* ------------------------------------------------------------------ */

create table if not exists public.message_events (
  id         bigserial primary key,
  send_id    uuid not null references public.message_sends(id) on delete cascade,
  -- 'open'      — email ka pixel load hua (email khola gaya)
  -- 'click'     — email ke link par click
  -- 'push_open' — phone ki notification par tap (app ne bataya)
  type       text not null,
  -- 'app' | 'web' | null — click ke baad user kahan gaya.
  target     text,
  url        text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists me_send_idx on public.message_events(send_id, created_at desc);
create index if not exists me_time_idx on public.message_events(created_at desc);

/* ------------------------------------------------------------------ */
/* 4. RLS — sab kuch service_role (admin API) ke haath me              */
/* ------------------------------------------------------------------ */
--
-- Teeno table par RLS on hai aur koi policy nahi: yaani anon/authenticated ko
-- kuch nahi milta. Admin panel service-role key se padhta hai (RLS bypass), aur
-- tracking endpoints bhi wahi key use karte hain.
--
-- Ek apwaad neeche hai: app ko notification-tap batana hota hai, aur wo user ke
-- apne session se hota hai. Uske liye ek security-definer RPC hai — table par
-- seedhi pahunch phir bhi band rehti hai.

alter table public.message_batches enable row level security;
alter table public.message_sends   enable row level security;
alter table public.message_events  enable row level security;

drop policy if exists "no direct batch access" on public.message_batches;
drop policy if exists "no direct send access"  on public.message_sends;
drop policy if exists "no direct event access" on public.message_events;

/* ------------------------------------------------------------------ */
/* 5. Event record karo (rollup ke saath)                              */
/* ------------------------------------------------------------------ */

/**
 * Ek open/click likho aur send row ka rollup bhi update kar do.
 *
 * ⚠️ Dono kaam EK hi function me isliye hain ki wo ek transaction me hon. Alag
 * karne par pixel-load aur count kabhi-kabhi alag ho jaate (Gmail ke proxy ek
 * hi mail ke liye do-teen baar pixel maangte hain, aur beech me request timeout
 * ho sakti hai) — phir "khola" dikhta par ginti 0 rehti.
 *
 * `p_target` sirf click me kaam ka hai ('app' ya 'web').
 */
create or replace function public.record_message_event(
  p_send_id uuid,
  p_type    text,
  p_target  text default null,
  p_url     text default null,
  p_agent   text default null
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_send_id is null then return; end if;
  if p_type not in ('open', 'click', 'push_open') then return; end if;
  -- Bina maujood send_id par kuch nahi karte — warna koi bhi random uuid bhej
  -- ke events table bhar sakta hai.
  if not exists (select 1 from public.message_sends where id = p_send_id) then
    return;
  end if;

  insert into public.message_events (send_id, type, target, url, user_agent)
  values (p_send_id, p_type, nullif(p_target, ''), nullif(p_url, ''), left(nullif(p_agent, ''), 200));

  if p_type = 'open' then
    update public.message_sends
       set open_count = open_count + 1,
           -- Pehla open hi "kab khola" hai. Baad wale sirf ginti badhate hain.
           opened_at  = coalesce(opened_at, now())
     where id = p_send_id;
  else
    update public.message_sends
       set click_count = click_count + 1,
           clicked_at  = coalesce(clicked_at, now()),
           last_target = coalesce(nullif(p_target, ''), last_target),
           -- Click hua matlab khola to gaya hi — chahe pixel block ho gaya ho.
           -- Bina iske "click 1, open 0" wali ajeeb row banti hai (Gmail image
           -- off wale users me ye bahut aam hai).
           open_count  = greatest(open_count, 1),
           opened_at   = coalesce(opened_at, now())
     where id = p_send_id;
  end if;
end;
$$;

revoke all on function public.record_message_event(uuid, text, text, text, text) from public, anon, authenticated;
-- Sirf service_role — web ke tracking endpoints isi key se chalte hain.
grant execute on function public.record_message_event(uuid, text, text, text, text) to service_role;

/* ------------------------------------------------------------------ */
/* 6. App se: notification par tap                                     */
/* ------------------------------------------------------------------ */

/**
 * Phone ne notification par tap batayi.
 *
 * App ke paas send_id push ke `data` me aata hai. Yahan do jaanch zaroori hai:
 *
 *   1. Session ho (anon nahi) — warna koi bhi kisi ke bhi send par tap likh de.
 *   2. Wo send row ISI user ki ho — warna ek user doosre ke stats bigaad sakta
 *      hai. Ye chhoti si `user_id = auth.uid()` shart hi poori suraksha hai.
 *
 * Chup-chaap return karta hai: app me is call ka fail hona kuch nahi todta, aur
 * user ko iske baare me kuch dikhana bhi nahi chahiye.
 */
create or replace function public.record_push_open(p_send_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_send_id is null or auth.uid() is null then return; end if;
  if not exists (
    select 1 from public.message_sends
     where id = p_send_id and user_id = auth.uid()
  ) then
    return;
  end if;

  insert into public.message_events (send_id, type, target)
  values (p_send_id, 'push_open', 'app');

  update public.message_sends
     set click_count = click_count + 1,
         clicked_at  = coalesce(clicked_at, now()),
         last_target = 'app',
         open_count  = greatest(open_count, 1),
         opened_at   = coalesce(opened_at, now())
   where id = p_send_id;
end;
$$;

revoke all on function public.record_push_open(uuid) from public, anon;
grant execute on function public.record_push_open(uuid) to authenticated;
