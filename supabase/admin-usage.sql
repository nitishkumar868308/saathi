-- Per-user usage (#10) — kaun kitna use karta hai, aur kaun bilkul nahi.
-- Admin dashboard "Usage" tab isi RPC se chalta hai (service_role se).

create or replace function public.admin_usage()
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
    p.id,
    p.email,
    p.full_name,
    p.plan,
    p.created_at,
    coalesce(d.cnt, 0) as documents,
    coalesce(r.cnt, 0) as reminders,
    coalesce(m.cnt, 0) as messages,
    -- greatest() NULL args ko ignore karta hai; sab null ho to created_at.
    greatest(p.created_at, d.last, r.last, m.last) as last_active
  from public.profiles p
  left join (
    select user_id, count(*) cnt, max(created_at) last
    from public.documents group by user_id
  ) d on d.user_id = p.id
  left join (
    select user_id, count(*) cnt, max(created_at) last
    from public.reminders group by user_id
  ) r on r.user_id = p.id
  left join (
    select user_id, count(*) cnt, max(created_at) last
    from public.messages group by user_id
  ) m on m.user_id = p.id
  order by greatest(p.created_at, d.last, r.last, m.last) desc nulls last;
$$;

revoke all on function public.admin_usage() from public, anon, authenticated;
grant execute on function public.admin_usage() to service_role;
