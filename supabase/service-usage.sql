-- Item 3 — AI aur WhatsApp/Twilio ka kitna istemaal ho raha hai.
--
-- Ab tak admin ka "Usage" tab sirf ye batata tha ki KAUN user kitna active hai.
-- Ye alag sawaal hai: HUMARA kitna kharcha ho raha hai — Gemini ko kitne token
-- gaye, Twilio se kitne WhatsApp nikle, SMTP se kitne email. Launch se pehle
-- ye pata hona zaroori hai, warna bill dekh kar hi pata chalega.
--
-- Ek hi table me sab, kyunki sawaal hamesha ek saath poocha jaata hai
-- ("is mahine kitna laga?"), alag-alag table se jodna bekaar mehnat hai.

create table if not exists public.service_usage (
  id uuid primary key default gen_random_uuid(),
  -- 'gemini' | 'twilio' | 'email'
  service text not null,
  -- gemini: 'chat' | 'scan' | 'reminder' | 'brief' | 'docfollow'
  -- twilio: 'reminder' | 'document'
  -- email:  'reminder' | 'document' | 'welcome' | 'contact'
  kind text not null,
  -- Kis user ke kaam se laga (pata ho to). Null bhi chalega — cron ke kaam me
  -- user pata hota hai, par edge function me kabhi-kabhi nahi.
  user_id uuid,
  -- Gemini me token, baaki sab me message/email ki ginti (1).
  units integer not null default 1,
  -- Gemini ka model, Twilio ka error, waghera — baad me dekhne ke liye.
  meta jsonb,
  -- Kaam hua ya fail — fail bhi ginna zaroori hai (retry ka kharcha lagta hai).
  ok boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.service_usage enable row level security;
-- Koi client policy nahi — sirf service_role likhta/padhta hai.

create index if not exists service_usage_created_idx
  on public.service_usage (created_at desc);
create index if not exists service_usage_service_idx
  on public.service_usage (service, created_at desc);

/* ------------------------------------------------------------------ */
/*  Admin ke liye jod-ghata                                            */
/* ------------------------------------------------------------------ */

-- Service + kind ke hisaab se total. Range optional — null do to sab.
create or replace function public.admin_service_usage(
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns table (
  service text,
  kind text,
  calls bigint,
  units bigint,
  failures bigint,
  last_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    u.service,
    u.kind,
    count(*) as calls,
    coalesce(sum(u.units), 0)::bigint as units,
    count(*) filter (where not u.ok) as failures,
    max(u.created_at) as last_at
  from public.service_usage u
  where (p_from is null or u.created_at >= p_from)
    and (p_to is null or u.created_at < p_to)
  group by u.service, u.kind
  order by u.service, u.kind;
$$;

revoke all on function public.admin_service_usage(timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.admin_service_usage(timestamptz, timestamptz)
  to service_role;

-- Rozana ka trend — chart ke liye.
create or replace function public.admin_service_usage_daily(
  p_days integer default 30
)
returns table (
  day date,
  service text,
  calls bigint,
  units bigint
)
language sql
security definer
set search_path = public
as $$
  select
    (u.created_at at time zone 'Asia/Kolkata')::date as day,
    u.service,
    count(*) as calls,
    coalesce(sum(u.units), 0)::bigint as units
  from public.service_usage u
  where u.created_at >= now() - (p_days || ' days')::interval
  group by 1, 2
  order by 1 desc, 2;
$$;

revoke all on function public.admin_service_usage_daily(integer)
  from public, anon, authenticated;
grant execute on function public.admin_service_usage_daily(integer) to service_role;

/* ------------------------------------------------------------------ */
/*  Safai — purana data hamesha ke liye rakhna bekaar hai              */
/* ------------------------------------------------------------------ */

-- 120 din se purani rows hata do. pg_cron se rozana chalao:
--   select cron.schedule('service-usage-cleanup', '30 2 * * *',
--     $$ select public.prune_service_usage(); $$);
create or replace function public.prune_service_usage()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.service_usage where created_at < now() - interval '120 days';
$$;

revoke all on function public.prune_service_usage() from public, anon, authenticated;
grant execute on function public.prune_service_usage() to service_role;
