-- Admin "Usage" v2 — sirf ginti nahi, ye bhi ki KAUN SA document/reminder/chat,
-- aur kis din. Date range se filter hota hai (aaj / kal / 7 din / custom).
-- supabase/admin-usage.sql ke baad chalao. Dobara chalana safe hai.

/**
 * Per-user ginti — par ab ek date range ke andar.
 * p_from / p_to null = sab kuch (lifetime).
 */
create or replace function public.admin_usage(
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns table (
  id uuid,
  email text,
  full_name text,
  plan text,
  created_at timestamptz,
  documents bigint,
  reminders bigint,
  messages bigint,
  last_active timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    p.id, p.email, p.full_name, p.plan, p.created_at,
    coalesce(d.cnt, 0), coalesce(r.cnt, 0), coalesce(m.cnt, 0),
    greatest(p.created_at, d.last, r.last, m.last) as last_active
  from public.profiles p
  left join (
    select user_id, count(*) cnt, max(created_at) last from public.documents
    where (p_from is null or created_at >= p_from)
      and (p_to   is null or created_at <  p_to)
    group by user_id
  ) d on d.user_id = p.id
  left join (
    select user_id, count(*) cnt, max(created_at) last from public.reminders
    where (p_from is null or created_at >= p_from)
      and (p_to   is null or created_at <  p_to)
    group by user_id
  ) r on r.user_id = p.id
  left join (
    select user_id, count(*) cnt, max(created_at) last from public.messages
    where (p_from is null or created_at >= p_from)
      and (p_to   is null or created_at <  p_to)
    group by user_id
  ) m on m.user_id = p.id
  order by greatest(p.created_at, d.last, r.last, m.last) desc nulls last;
$$;

/**
 * Ek user ne kya-kya kiya — asli items, time ke saath (naya pehle).
 * p_uid null = saare users (poore app ki activity feed).
 */
create or replace function public.admin_activity(
  p_uid uuid default null,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_limit int default 300
)
returns table (
  kind text,           -- document | reminder | chat
  item_id uuid,
  title text,
  detail text,
  user_id uuid,
  email text,
  full_name text,
  at timestamptz
)
language sql
security definer
set search_path = public
as $$
  with rows as (
    select 'document'::text kind, d.id item_id, d.name title,
           coalesce('expiry: ' || d.expiry::text, d.type) detail,
           d.user_id, d.created_at at
    from public.documents d
    where (p_uid is null or d.user_id = p_uid)
      and (p_from is null or d.created_at >= p_from)
      and (p_to   is null or d.created_at <  p_to)

    union all
    select 'reminder', r.id, r.title,
           coalesce(r.time_label, r.remind_at::text),
           r.user_id, r.created_at
    from public.reminders r
    where (p_uid is null or r.user_id = p_uid)
      and (p_from is null or r.created_at >= p_from)
      and (p_to   is null or r.created_at <  p_to)

    union all
    select 'chat', m.id, left(m.content, 160), m.role,
           m.user_id, m.created_at
    from public.messages m
    where (p_uid is null or m.user_id = p_uid)
      and (p_from is null or m.created_at >= p_from)
      and (p_to   is null or m.created_at <  p_to)
  )
  select rows.kind, rows.item_id, rows.title, rows.detail,
         rows.user_id, p.email, p.full_name, rows.at
  from rows
  left join public.profiles p on p.id = rows.user_id
  order by rows.at desc
  limit greatest(1, least(p_limit, 1000));
$$;

revoke all on function public.admin_usage(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.admin_usage(timestamptz, timestamptz) to service_role;
revoke all on function public.admin_activity(uuid, timestamptz, timestamptz, int) from public, anon, authenticated;
grant execute on function public.admin_activity(uuid, timestamptz, timestamptz, int) to service_role;
